import { createHash } from 'node:crypto'
import { hasFlag, seesAllYards, sessionYardIds } from '../access'
import { CommandError, compareAndSet, refuse, requireYard, runCommand, type CommandCtx, type Tx } from '../lib/command'
import { normalizeId, normalizeName, yardRules } from '../lib/domain'
import { parseCsvObjects, toCsv } from '../../recycling/csv'

/**
 * Compliance (dissertation §4.9): the daily report CSV, do-not-buy import, theft alerts for a line,
 * and the police lookup. The report records what the yard's rules profile asks for; the owner sets the rules.
 */

/** Calendar day bounds in the yard's time zone, as UTC instants. */
export function dayBounds(date: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) refuse('Use a date like 2026-11-20.')
  const [y, m, d] = date.split('-').map(Number)
  const offsetAt = (utc: number) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(utc))
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - utc
  }
  const local = (day: number) => {
    const guess = Date.UTC(y, m - 1, day)
    return new Date(guess - offsetAt(guess - offsetAt(guess)))
  }
  return { start: local(d), end: local(d + 1) }
}

export const DAILY_REPORT_COLUMNS = [
  'ticket_number', 'completed_at', 'seller_last_name', 'seller_first_name', 'date_of_birth', 'address', 'id_type', 'id_number', 'id_issuer', 'id_expires',
  'vehicle_plate', 'vehicle_plate_region', 'vehicle_description', 'material', 'net_weight', 'pay_weight', 'unit', 'unit_price', 'amount', 'payment_methods', 'operator',
] as const

export async function buildDailyReportRows(tx: Tx, yardId: string, date: string) {
  const yard = await tx.yard.findUnique({ where: { id: yardId } })
  if (!yard) refuse('Yard not found.')
  const { profile } = await yardRules(tx, yardId)
  const omitPrice = Boolean((profile as any).reportOmitsPrice)
  const { start, end } = dayBounds(date, yard.timezone || 'America/New_York')
  const tickets = await tx.scaleTicket.findMany({
    where: { yardId, direction: 'inbound', status: { in: ['completed', 'settled'] }, completedAt: { gte: start, lt: end }, isAdjustment: false, sellerId: { not: null } },
    include: { seller: { include: { identityDocuments: { where: { isCurrent: true }, orderBy: { createdAt: 'desc' }, take: 1 } } }, lines: { orderBy: { sortOrder: 'asc' } }, payouts: true, completedBy: true },
    orderBy: { number: 'asc' },
  })
  const rows: unknown[][] = []
  for (const t of tickets) {
    const s = t.seller
    const id = s?.identityDocuments?.[0]
    const address = [s?.addressLine1, s?.addressLine2, s?.city, s?.region, s?.postalCode].filter(Boolean).join(', ')
    const methods = [...new Set((t.payouts || []).map((p: any) => (p.allowedMethods || []).join('/')))].join('; ')
    for (const l of t.lines) {
      rows.push([
        `${yard.code}-I-${String(t.number).padStart(6, '0')}`, t.completedAt, s?.lastName, s?.firstName, s?.dateOfBirth ? new Date(s.dateOfBirth).toISOString().slice(0, 10) : '', address,
        id?.kind || '', id?.number || '', id?.issuer || '', id?.expiresOn ? new Date(id.expiresOn).toISOString().slice(0, 10) : '',
        t.vehiclePlate, t.vehiclePlateRegion, t.vehicleDescription, l.materialName, String(l.netWeight), String(l.payWeight), l.unit,
        omitPrice ? '' : String(l.unitPrice ?? ''), omitPrice ? '' : (l.amountCents / 100).toFixed(2), methods, t.completedBy?.name || '',
      ])
    }
  }
  return { rows, ticketCount: tickets.length, omitPrice }
}

export async function generateDailyReportTx(ctx: CommandCtx, input: { yardId: string; reportDate: string }) {
  requireYard(ctx.session, input.yardId)
  const existing = await ctx.tx.complianceReport.findFirst({ where: { yardId: input.yardId, reportDate: input.reportDate } })
  if (existing?.status === 'submitted') refuse('This report was already submitted; it cannot be generated again.')
  const { rows, ticketCount } = await buildDailyReportRows(ctx.tx, input.yardId, input.reportDate)
  const csv = toCsv([...DAILY_REPORT_COLUMNS], rows)
  const fileHash = createHash('sha256').update(csv).digest('hex')
  const data = { csv, fileHash, ticketCount, generatedById: ctx.actorId, status: 'generated' }
  const report = existing
    ? await ctx.tx.complianceReport.update({ where: { id: existing.id }, data })
    : await ctx.tx.complianceReport.create({ data: { yardId: input.yardId, reportDate: input.reportDate, ...data } })
  await ctx.audit({ eventType: 'compliance_report.generated', aggregateType: 'ComplianceReport', aggregateId: report.id, yardId: input.yardId, after: { reportDate: input.reportDate, ticketCount, fileHash } })
  return report
}

export async function markReportSubmittedTx(ctx: CommandCtx, input: { reportId: string; note?: string | null }) {
  const report = await ctx.tx.complianceReport.findUnique({ where: { id: input.reportId } })
  if (!report) refuse('Report not found.')
  requireYard(ctx.session, report.yardId)
  await compareAndSet(ctx.tx, 'complianceReport', report.id, 'generated', { status: 'submitted', submittedAt: ctx.now, submittedById: ctx.actorId, submissionNote: input.note || '' }, 'This report was already submitted.')
  await ctx.audit({ eventType: 'compliance_report.submitted', aggregateType: 'ComplianceReport', aggregateId: report.id, yardId: report.yardId, after: { fileHash: report.fileHash } })
  return ctx.tx.complianceReport.findUnique({ where: { id: report.id } })
}

/** CSV import for the do-not-buy list. Columns: first_name, last_name, date_of_birth, id_number, plate, source, reason, expires_on. */
export async function importDoNotBuyTx(ctx: CommandCtx, input: { csv: string; source?: string | null }) {
  const rows = parseCsvObjects(String(input.csv || ''))
  if (!rows.length) refuse('The file has no rows.')
  if (rows.length > 5000) refuse('Import at most 5,000 rows at a time.')
  const sources = ['yard', 'court', 'state_list', 'law_enforcement']
  let created = 0
  let skipped = 0
  const errors: string[] = []
  for (const [i, r] of rows.entries()) {
    const first = r.first_name || r.firstname || ''
    const last = r.last_name || r.lastname || ''
    const idNumber = r.id_number || r.id || ''
    const plate = r.plate || r.vehicle_plate || ''
    if (!(last && (r.date_of_birth || idNumber)) && !plate && !idNumber) { errors.push(`Row ${i + 2}: needs a name with date of birth, an ID number or a plate.`); continue }
    const dob = r.date_of_birth ? new Date(`${r.date_of_birth}T00:00:00Z`) : null
    if (dob && Number.isNaN(dob.getTime())) { errors.push(`Row ${i + 2}: date of birth is not a date.`); continue }
    const expires = r.expires_on ? new Date(`${r.expires_on}T00:00:00Z`) : null
    const nameNormalized = normalizeName(first, last)
    const idNumberNormalized = normalizeId(idNumber)
    const plateNormalized = normalizeId(plate)
    const dup = await ctx.tx.doNotBuyEntry.findFirst({ where: { isActive: true, nameNormalized, idNumberNormalized, plateNormalized } })
    if (dup) { skipped++; continue }
    const source = sources.includes(r.source) ? r.source : sources.includes(String(input.source)) ? input.source : 'state_list'
    await ctx.tx.doNotBuyEntry.create({ data: { firstName: first, lastName: last, nameNormalized, dateOfBirth: dob, idNumber, idNumberNormalized, plate, plateNormalized, source, reason: r.reason || 'Imported list', expiresOn: expires && !Number.isNaN(expires.getTime()) ? expires : null, isActive: true, addedById: ctx.actorId } })
    created++
  }
  await ctx.audit({ eventType: 'do_not_buy.imported', aggregateType: 'DoNotBuyEntry', aggregateId: 'import', after: { created, skipped, errors: errors.length } })
  return { created, skipped, errors: errors.slice(0, 50) }
}

/** Active alerts that match a material by link or keyword, for the ticket screen banner. */
export async function matchingTheftAlerts(tx: Tx, materialId: string, now = new Date()) {
  const material = await tx.material.findUnique({ where: { id: materialId } })
  if (!material) return []
  const alerts = await tx.theftAlert.findMany({ where: { isActive: true, OR: [{ expiresOn: null }, { expiresOn: { gt: now } }] }, include: { materials: { select: { id: true } } }, orderBy: { reportedOn: 'desc' }, take: 200 })
  const name = material.name.toLowerCase()
  return alerts.filter((a: any) => a.materials.some((m: any) => m.id === materialId) || String(a.keywords || '').split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean).some((k: string) => name.includes(k)))
}

/** §4.9 step 8: police lookup by name, ID number, plate, material and date range; staff yard scope applies. */
export async function policeLookup(tx: Tx, session: any, input: { name?: string | null; idNumber?: string | null; plate?: string | null; materialId?: string | null; from?: string | null; to?: string | null; yardId?: string | null }) {
  const where: any = { direction: 'inbound', status: { in: ['completed', 'settled', 'voided'] } }
  if (!seesAllYards(session)) where.yardId = { in: sessionYardIds(session) }
  if (input.yardId) where.yardId = seesAllYards(session) || sessionYardIds(session).includes(input.yardId) ? input.yardId : '__none__'
  const and: any[] = []
  if (input.name?.trim()) {
    const parts = input.name.trim().split(/\s+/)
    and.push({ seller: { AND: parts.map((p) => ({ OR: [{ firstName: { contains: p, mode: 'insensitive' } }, { lastName: { contains: p, mode: 'insensitive' } }] })) } })
  }
  if (input.idNumber?.trim()) and.push({ seller: { identityDocuments: { some: { numberNormalized: normalizeId(input.idNumber) } } } })
  if (input.plate?.trim()) and.push({ vehiclePlate: { contains: normalizeId(input.plate), mode: 'insensitive' } })
  if (input.materialId) and.push({ lines: { some: { materialId: input.materialId } } })
  if (input.from || input.to) and.push({ completedAt: { ...(input.from ? { gte: new Date(input.from) } : {}), ...(input.to ? { lt: new Date(input.to) } : {}) } })
  if (!and.length) refuse('Search by at least one of name, ID number, plate, material or dates.')
  where.AND = and
  return tx.scaleTicket.findMany({ where, orderBy: { completedAt: 'desc' }, take: 200, select: { id: true } })
}

// ---------------------------------------------------------------------------------------------

export const complianceTypeDefs = `
  type DoNotBuyImportResult { created: Int!, skipped: Int!, errors: [String!]! }
`
export const complianceMutationDefs = `
  generateComplianceReport(yardId: ID!, reportDate: String!): ComplianceReport
  markComplianceReportSubmitted(reportId: ID!, note: String): ComplianceReport
  importDoNotBuyList(csv: String!, source: String): DoNotBuyImportResult
`
export const complianceQueryDefs = `
  theftAlertsForMaterial(materialId: ID!): [TheftAlert!]
  policeLookup(name: String, idNumber: String, plate: String, materialId: ID, from: String, to: String, yardId: ID): [ScaleTicket!]
  complianceReportCsv(reportId: ID!): String
`

const C = 'canManageCompliance' as const
export const complianceResolvers = {
  Mutation: {
    generateComplianceReport: (_: unknown, a: any, c: any) => runCommand(c, { name: 'generateComplianceReport', input: a, permission: C }, (ctx) => generateDailyReportTx(ctx, a)).then((r: any) => c.db.ComplianceReport.findOne({ where: { id: r.id } })),
    markComplianceReportSubmitted: (_: unknown, a: any, c: any) => runCommand(c, { name: 'markComplianceReportSubmitted', input: a, permission: C }, (ctx) => markReportSubmittedTx(ctx, a)).then((r: any) => c.db.ComplianceReport.findOne({ where: { id: r.id } })),
    importDoNotBuyList: (_: unknown, a: any, c: any) => runCommand(c, { name: 'importDoNotBuyList', input: { size: String(a.csv || '').length, source: a.source }, permission: C }, (ctx) => importDoNotBuyTx(ctx, a)),
  },
  Query: {
    theftAlertsForMaterial: async (_: unknown, a: any, c: any) => {
      if (!hasFlag(c.session, 'canManageTickets') && !hasFlag(c.session, C)) return []
      const alerts = await matchingTheftAlerts(c.sudo().prisma, a.materialId)
      return c.db.TheftAlert.findMany({ where: { id: { in: alerts.map((x: any) => x.id) } } })
    },
    policeLookup: async (_: unknown, a: any, c: any) => {
      if (!hasFlag(c.session, C)) throw new CommandError('You cannot search tickets this way.', 'FORBIDDEN')
      const ids = await policeLookup(c.sudo().prisma, c.session, a)
      return c.db.ScaleTicket.findMany({ where: { id: { in: ids.map((t: any) => t.id) } }, orderBy: { completedAt: 'desc' } })
    },
    complianceReportCsv: async (_: unknown, a: any, c: any) => {
      if (!hasFlag(c.session, C)) throw new CommandError('Report not found.', 'NOT_FOUND')
      const report = await c.sudo().prisma.complianceReport.findUnique({ where: { id: a.reportId } })
      if (!report) throw new CommandError('Report not found.', 'NOT_FOUND')
      requireYard(c.session, report.yardId)
      return report.csv
    },
  },
}
