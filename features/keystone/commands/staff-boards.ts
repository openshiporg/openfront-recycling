import { Decimal } from 'decimal.js'
import { hasFlag, isStaff, seesAllYards } from '../access'
import { CommandError, refuse, requireYard } from '../lib/command'
import { normalizeId } from '../lib/domain'
import { formatTicketNumber } from '../models/tickets'
import { ticketComplianceChecklist } from './tickets'

/**
 * Staff reads for the dashboard (dissertation §9): scale-house board, drawer state, price board grid
 * and seller search. Reads only; every change goes through the existing commands. Each read checks
 * the role flag and the yard (§7.2) before touching the database with sudo.
 */

const db = (c: any) => c.sudo().prisma
const DAY = 86_400_000
const staffOnly = (c: any, ...flags: string[]) => {
  if (!isStaff(c.session)) throw new CommandError('Staff only.', 'FORBIDDEN')
  if (flags.length && !flags.some((f) => hasFlag(c.session, f as any))) throw new CommandError('Your role cannot see this.', 'FORBIDDEN')
}
const sellerName = (s: any) => (s ? `${s.firstName} ${s.lastName}`.trim() : null)

/** Start of "today" in the yard's time zone, as a UTC instant. */
function startOfLocalDay(now: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((p) => [p.type, p.value]))
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
  const offset = asUtc - now.getTime()
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) - offset)
}

// ---------------------------------------------------------------------------------------------
// Scale-house board: Checked in, Weighing, Ready to complete, Ready to pay
// ---------------------------------------------------------------------------------------------

export async function scaleHouseBoard(prisma: any, yardId: string, now = new Date()) {
  const yard = await prisma.yard.findUnique({ where: { id: yardId } })
  if (!yard) refuse('Yard not found.')
  const dayStart = startOfLocalDay(now, yard.timezone || 'America/New_York')
  const dayEnd = new Date(dayStart.getTime() + DAY)

  const visits = await prisma.visit.findMany({
    where: { yardId, status: { in: ['booked', 'arrived'] }, plannedDate: { gte: new Date(dayStart.getTime() - DAY), lt: dayEnd } },
    include: { seller: true, vehicle: true },
    orderBy: [{ status: 'asc' }, { plannedDate: 'asc' }],
  })
  const visitIdsWithTicket = new Set((await prisma.scaleTicket.findMany({ where: { visitId: { in: visits.map((v: any) => v.id) } }, select: { visitId: true } })).map((t: any) => t.visitId))
  const checkedIn = visits.filter((v: any) => !visitIdsWithTicket.has(v.id)).map((v: any) => ({
    visitId: v.id, code: v.code, status: v.status, sellerId: v.sellerId, sellerName: sellerName(v.seller), plannedDate: v.plannedDate,
    vehiclePlate: v.vehicle?.plate || null, expectedItems: Array.isArray(v.expectedItems) ? v.expectedItems.map((i: any) => i?.materialName || i?.name || String(i)).filter(Boolean) : [],
  }))

  const open = await prisma.scaleTicket.findMany({
    where: { yardId, status: 'open' },
    include: { seller: true, account: true, lines: { select: { id: true, amountCents: true, payWeight: true } }, weighEvents: { select: { id: true } } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })
  const card = (t: any) => ({
    ticketId: t.id, number: formatTicketNumber(yard.code, t.direction, t.number), direction: t.direction, sellerId: t.sellerId, sellerName: sellerName(t.seller), accountId: t.accountId, accountName: t.account?.name || null,
    vehiclePlate: t.vehiclePlate || null, lineCount: t.lines.length, totalCents: t.lines.reduce((s: number, l: any) => s + (l.amountCents || 0), 0),
    payWeight: t.lines.reduce((s: Decimal, l: any) => s.plus(String(l.payWeight || 0)), new Decimal(0)).toFixed(), openedAt: t.createdAt, minutesOpen: Math.floor((now.getTime() - new Date(t.createdAt).getTime()) / 60_000),
  })
  const weighing = open.filter((t: any) => t.lines.length === 0).map((t: any) => ({ ...card(t), missing: [] as any[] }))
  const ready = open.filter((t: any) => t.lines.length > 0)
  const readyToComplete = [] as any[]
  for (const t of ready) {
    const { items } = await ticketComplianceChecklist(prisma, t.id, now)
    readyToComplete.push({ ...card(t), missing: items })
  }

  const payouts = await prisma.payout.findMany({
    where: { status: { in: ['ready', 'held'] }, ticket: { yardId } },
    include: { ticket: true, seller: true, account: true },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })
  const readyToPay = payouts.map((p: any) => ({
    payoutId: p.id, ticketId: p.ticketId, number: p.ticket ? formatTicketNumber(yard.code, p.ticket.direction, p.ticket.number) : null, sellerName: sellerName(p.seller), accountName: p.account?.name || null,
    amountCents: p.amountCents, status: p.status, releaseAt: p.releaseAt, allowedMethods: Array.isArray(p.allowedMethods) ? p.allowedMethods : [], completedAt: p.ticket?.completedAt || null,
  }))
  return { yardId, yardName: yard.name, generatedAt: now, checkedIn, weighing, readyToComplete, readyToPay }
}

// ---------------------------------------------------------------------------------------------
// Drawer state
// ---------------------------------------------------------------------------------------------

export async function drawerState(prisma: any, session: any, yardId: string) {
  const drawers = await prisma.cashDrawer.findMany({ where: { yardId, isActive: true }, orderBy: { name: 'asc' } })
  const out = [] as any[]
  for (const d of drawers) {
    const s = await prisma.cashDrawerSession.findFirst({ where: { drawerId: d.id, status: { in: ['open', 'counting'] } }, include: { cashier: { select: { id: true, name: true } } } })
    const last = s ? null : await prisma.cashDrawerSession.findFirst({ where: { drawerId: d.id, status: 'closed' }, orderBy: { closedAt: 'desc' }, include: { cashier: { select: { name: true } }, approvedBy: { select: { name: true } } } })
    const events = s ? await prisma.cashDrawerEvent.findMany({ where: { sessionId: s.id }, orderBy: { createdAt: 'desc' }, take: 25 }) : []
    const totals = s ? await prisma.cashDrawerEvent.groupBy({ by: ['kind'], where: { sessionId: s.id }, _sum: { amountCents: true }, _count: true }) : []
    out.push({
      drawerId: d.id, name: d.name,
      session: s ? {
        id: s.id, status: s.status, cashierId: s.cashierId, cashierName: s.cashier?.name || null, isMine: s.cashierId === session?.itemId, openingFloatCents: s.openingFloatCents, expectedCents: s.expectedCents,
        countedCents: s.countedCents, varianceCents: s.varianceCents, openedAt: s.openedAt,
        totals: totals.map((t: any) => ({ kind: t.kind, count: t._count, amountCents: t._sum.amountCents || 0 })),
        events: events.map((e: any) => ({ id: e.id, kind: e.kind, amountCents: e.amountCents, note: e.note, payoutId: e.payoutId, ticketId: e.ticketId, createdAt: e.createdAt })),
      } : null,
      lastClosed: last ? { id: last.id, closedAt: last.closedAt, cashierName: last.cashier?.name || null, countedCents: last.countedCents, varianceCents: last.varianceCents, approvedByName: last.approvedBy?.name || null } : null,
    })
  }
  const pendingApproval = await prisma.cashDrawerSession.count({ where: { status: 'counting', drawer: { yardId } } })
  return { yardId, drawers: out, pendingApproval }
}

// ---------------------------------------------------------------------------------------------
// Price board grid
// ---------------------------------------------------------------------------------------------

export async function priceBoardGrid(prisma: any, priceListId: string, now = new Date()) {
  const list = await prisma.priceList.findUnique({ where: { id: priceListId }, include: { yard: true } })
  if (!list) refuse('Price list not found.')
  const materials = await prisma.material.findMany({ where: { isActive: true }, include: { category: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  const entries = await prisma.priceEntry.findMany({ where: { priceListId, effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: 'desc' }, include: { publishedBy: { select: { name: true } } } })
  const scheduled = await prisma.priceEntry.findMany({ where: { priceListId, effectiveFrom: { gt: now } }, orderBy: { effectiveFrom: 'asc' } })
  const byMat = new Map<string, any[]>()
  for (const e of entries) byMat.set(e.materialId, [...(byMat.get(e.materialId) || []), e])
  let lastPublishedAt: Date | null = null
  const rows = materials.map((m: any) => {
    const hist = byMat.get(m.id) || []
    const cur = hist.find((e: any) => !e.effectiveTo || new Date(e.effectiveTo) > now) || null
    const prev = cur ? hist.find((e: any) => e.id !== cur.id && new Date(e.effectiveFrom) < new Date(cur.effectiveFrom)) || null : null
    const next = scheduled.find((e: any) => e.materialId === m.id) || null
    if (cur && (!lastPublishedAt || new Date(cur.effectiveFrom) > lastPublishedAt)) lastPublishedAt = new Date(cur.effectiveFrom)
    const curP = cur ? new Decimal(String(cur.unitPrice)) : null
    const prevP = prev ? new Decimal(String(prev.unitPrice)) : null
    return {
      materialId: m.id, materialName: m.name, code: m.code, categoryName: m.category?.name || null, direction: m.direction, defaultUnit: m.defaultUnit, materialIsPublic: m.isPublic,
      unit: cur?.unit || m.defaultUnit, unitPrice: curP?.toFixed() ?? null, unitPriceHigh: cur?.unitPriceHigh != null ? new Decimal(String(cur.unitPriceHigh)).toFixed() : null, isPublic: cur ? cur.isPublic : m.isPublic,
      effectiveFrom: cur?.effectiveFrom || null, publishedByName: cur?.publishedBy?.name || null,
      previousPrice: prevP?.toFixed() ?? null, change: curP && prevP ? curP.minus(prevP).toFixed() : null,
      scheduledPrice: next ? new Decimal(String(next.unitPrice)).toFixed() : null, scheduledFrom: next?.effectiveFrom || null,
    }
  })
  return { priceListId: list.id, name: list.name, kind: list.kind, yardId: list.yardId, yardName: list.yard?.name || null, lastPublishedAt, rows }
}

// ---------------------------------------------------------------------------------------------
// Seller search by name, ID number, phone or plate
// ---------------------------------------------------------------------------------------------

export async function searchSellers(prisma: any, q: string, limit = 25) {
  const raw = String(q || '').trim().slice(0, 80)
  if (raw.length < 2) return []
  const take = Math.min(Math.max(1, Math.trunc(limit) || 25), 50)
  const name = raw.toLowerCase().replace(/\s+/g, ' ')
  const norm = normalizeId(raw)
  const digits = raw.replace(/\D/g, '')
  const hits = new Map<string, Set<string>>()
  const add = (ids: string[], why: string) => ids.forEach((id) => { if (id) hits.set(id, (hits.get(id) || new Set()).add(why)) })

  const tokens = name.split(' ').filter(Boolean)
  add((await prisma.seller.findMany({ where: { AND: tokens.map((t) => ({ searchName: { contains: t } })) }, select: { id: true }, take })).map((s: any) => s.id), 'name')
  if (norm.length >= 3) {
    add((await prisma.identityDocument.findMany({ where: { numberNormalized: { contains: norm } }, select: { sellerId: true }, take })).map((d: any) => d.sellerId), 'id_number')
    const plates: any[] = await prisma.$queryRaw`SELECT DISTINCT "seller" AS "sellerId" FROM "Vehicle" WHERE "seller" IS NOT NULL AND upper(regexp_replace("plate", '[^A-Za-z0-9]', '', 'g')) LIKE ${`%${norm}%`} LIMIT ${take}`
    add(plates.map((p) => p.sellerId), 'plate')
    const ticketPlates: any[] = await prisma.$queryRaw`SELECT DISTINCT "seller" AS "sellerId" FROM "ScaleTicket" WHERE "seller" IS NOT NULL AND upper(regexp_replace("vehiclePlate", '[^A-Za-z0-9]', '', 'g')) LIKE ${`%${norm}%`} LIMIT ${take}`
    add(ticketPlates.map((p) => p.sellerId), 'plate')
  }
  if (digits.length >= 4) {
    const phones: any[] = await prisma.$queryRaw`SELECT "id" FROM "Seller" WHERE regexp_replace("phone", '[^0-9]', '', 'g') LIKE ${`%${digits}%`} LIMIT ${take}`
    add(phones.map((p) => p.id), 'phone')
  }
  const ids = [...hits.keys()].slice(0, take)
  if (!ids.length) return []
  const sellers = await prisma.seller.findMany({
    where: { id: { in: ids } },
    include: { identityDocuments: { where: { isCurrent: true }, take: 1 }, vehicles: { where: { isRemoved: false }, select: { plate: true, plateRegion: true } } },
  })
  const last = await prisma.scaleTicket.groupBy({ by: ['sellerId'], where: { sellerId: { in: ids }, status: { in: ['completed', 'settled'] } }, _max: { completedAt: true }, _count: true })
  const lastBy = new Map(last.map((l: any) => [l.sellerId, l]))
  const rank = (why: Set<string>) => (why.has('id_number') ? 0 : why.has('plate') ? 1 : why.has('phone') ? 2 : 3)
  return sellers
    .map((s: any) => {
      const doc = s.identityDocuments[0]
      const l: any = lastBy.get(s.id)
      return {
        id: s.id, name: sellerName(s), phone: s.phone || null, email: s.email || null, city: s.city || null, status: s.status, idVerification: s.idVerification, matchedOn: [...(hits.get(s.id) || [])],
        idKind: doc?.kind || null, idLast4: doc ? String(doc.number).slice(-4) : null, idExpiresOn: doc?.expiresOn || null,
        plates: s.vehicles.map((v: any) => [v.plate, v.plateRegion].filter(Boolean).join(' ')), lastTicketAt: l?._max?.completedAt || null, ticketCount: l?._count || 0,
      }
    })
    .sort((a: any, b: any) => rank(new Set(a.matchedOn)) - rank(new Set(b.matchedOn)) || a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------------------------

export const staffBoardTypeDefs = `
  type ScaleHouseVisitCard { visitId: ID!, code: String, status: String!, sellerId: ID, sellerName: String, plannedDate: DateTime, vehiclePlate: String, expectedItems: [String!]! }
  type ScaleHouseTicketCard { ticketId: ID!, number: String!, direction: String!, sellerId: ID, sellerName: String, accountId: ID, accountName: String, vehiclePlate: String, lineCount: Int!, totalCents: Int!, payWeight: String!, openedAt: DateTime!, minutesOpen: Int!, missing: [ComplianceItem!]! }
  type ScaleHousePayoutCard { payoutId: ID!, ticketId: ID, number: String, sellerName: String, accountName: String, amountCents: Int!, status: String!, releaseAt: DateTime, allowedMethods: [String!]!, completedAt: DateTime }
  type ScaleHouseBoard { yardId: ID!, yardName: String!, generatedAt: DateTime!, checkedIn: [ScaleHouseVisitCard!]!, weighing: [ScaleHouseTicketCard!]!, readyToComplete: [ScaleHouseTicketCard!]!, readyToPay: [ScaleHousePayoutCard!]! }

  type DrawerEventRow { id: ID!, kind: String!, amountCents: Int!, note: String, payoutId: ID, ticketId: ID, createdAt: DateTime! }
  type DrawerKindTotal { kind: String!, count: Int!, amountCents: Int! }
  type DrawerSessionState { id: ID!, status: String!, cashierId: ID, cashierName: String, isMine: Boolean!, openingFloatCents: Int!, expectedCents: Int!, countedCents: Int, varianceCents: Int, openedAt: DateTime, totals: [DrawerKindTotal!]!, events: [DrawerEventRow!]! }
  type DrawerLastClose { id: ID!, closedAt: DateTime, cashierName: String, countedCents: Int, varianceCents: Int, approvedByName: String }
  type DrawerStateRow { drawerId: ID!, name: String!, session: DrawerSessionState, lastClosed: DrawerLastClose }
  type DrawerState { yardId: ID!, drawers: [DrawerStateRow!]!, pendingApproval: Int! }

  type PriceGridRow { materialId: ID!, materialName: String!, code: String, categoryName: String, direction: String!, defaultUnit: String!, materialIsPublic: Boolean!, unit: String!, unitPrice: String, unitPriceHigh: String, isPublic: Boolean!, effectiveFrom: DateTime, publishedByName: String, previousPrice: String, change: String, scheduledPrice: String, scheduledFrom: DateTime }
  type PriceBoardGrid { priceListId: ID!, name: String!, kind: String!, yardId: ID, yardName: String, lastPublishedAt: DateTime, rows: [PriceGridRow!]! }

  type SellerSearchResult { id: ID!, name: String!, phone: String, email: String, city: String, status: String!, idVerification: String!, matchedOn: [String!]!, idKind: String, idLast4: String, idExpiresOn: DateTime, plates: [String!]!, lastTicketAt: DateTime, ticketCount: Int! }
`

export const staffBoardQueryDefs = `
  scaleHouseBoard(yardId: ID!): ScaleHouseBoard
  drawerState(yardId: ID!): DrawerState
  priceBoardGrid(priceListId: ID!): PriceBoardGrid
  searchSellers(q: String!, limit: Int): [SellerSearchResult!]!
`

export const staffBoardResolvers = {
  Query: {
    scaleHouseBoard: async (_: unknown, { yardId }: any, c: any) => {
      staffOnly(c, 'canManageTickets', 'canGradeTickets', 'canPaySellers')
      requireYard(c.session, yardId)
      return scaleHouseBoard(db(c), yardId)
    },
    drawerState: async (_: unknown, { yardId }: any, c: any) => {
      staffOnly(c, 'canPaySellers', 'canManageCashDrawers', 'canManageFinance')
      requireYard(c.session, yardId)
      return drawerState(db(c), c.session, yardId)
    },
    priceBoardGrid: async (_: unknown, { priceListId }: any, c: any) => {
      staffOnly(c, 'canManagePricing', 'canManageTickets', 'canManageMaterials')
      const list = await db(c).priceList.findUnique({ where: { id: priceListId } })
      if (!list) throw new CommandError('Price list not found.', 'NOT_FOUND')
      if (list.yardId) requireYard(c.session, list.yardId)
      else if (!seesAllYards(c.session) && !hasFlag(c.session, 'canManagePricing')) throw new CommandError('Your role cannot see this list.', 'FORBIDDEN')
      return priceBoardGrid(db(c), priceListId)
    },
    searchSellers: async (_: unknown, { q, limit }: any, c: any) => {
      staffOnly(c, 'canManageTickets', 'canManageSellers', 'canManageCompliance', 'canPaySellers')
      return searchSellers(db(c), q, limit ?? 25)
    },
  },
}
