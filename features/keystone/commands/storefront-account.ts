import { Decimal } from 'decimal.js'
import { CommandError, refuse } from '../lib/command'
import { businessSettings } from '../lib/domain'
import { formatTicketNumber } from '../models/tickets'
import { ticketReceipt } from './storefront-public'
import { REQUEST_INCLUDE, shapeRequest } from './storefront-seller'

/**
 * Company portal reads (dissertation §8.3 C1 to C11, also used by buyers §8.4 and nonprofits §8.5).
 * Each takes the account slug; the server proves the signed-in user holds an active AccountContact on
 * that account and answers NOT_FOUND otherwise, so a slug never reveals another company (§7.3).
 * Staff use the dashboard, not these.
 */

const db = (c: any) => c.sudo().prisma
const DAY = 86_400_000
const notFound = (what: string): never => { throw new CommandError(`${what} not found.`, 'NOT_FOUND') }

export async function requireContact(prisma: any, session: any, accountSlug: string, roles = ['admin', 'member', 'billing', 'driver']) {
  if (!session?.itemId) throw new CommandError('Sign in first.', 'UNAUTHENTICATED')
  const account = await prisma.account.findFirst({ where: { slug: String(accountSlug || ''), status: { in: ['active', 'suspended'] } } })
  if (!account) notFound('Account')
  const contact = await prisma.accountContact.findFirst({ where: { accountId: account.id, userId: session.itemId, status: 'active' } })
  if (!contact) notFound('Account')
  if (!roles.includes(contact.role)) throw new CommandError('Your role on this account cannot see this. Ask an account admin.', 'FORBIDDEN')
  return { account, contact }
}

const MONEY_ROLES = ['admin', 'billing']
const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
const dayOf = (v: string) => {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) refuse('Enter the date as YYYY-MM-DD.')
  return new Date(Date.UTC(Number(m![1]), Number(m![2]) - 1, Number(m![3])))
}

/** Days a container has sat at the site, and the rental that has built up past the free days. */
function containerRental(c: any, now: Date) {
  if (!c.placedOn || c.status !== 'at_customer') return { daysOnSite: null, rentalAccruingCents: null }
  const days = Math.max(0, Math.floor((now.getTime() - new Date(c.placedOn).getTime()) / DAY))
  const from = c.rentalChargedThrough ? new Date(c.rentalChargedThrough) : new Date(new Date(c.placedOn).getTime() + (c.type?.freeRentalDays || 0) * DAY)
  const billable = Math.max(0, Math.floor((now.getTime() - from.getTime()) / DAY))
  return { daysOnSite: days, rentalAccruingCents: billable * (c.type?.rentalFeePerDayCents || 0) }
}

export async function accountOverview(prisma: any, session: any, slug: string, now = new Date()) {
  const { account, contact } = await requireContact(prisma, session, slug)
  const settings: any = await businessSettings(prisma)
  const since = monthStart(now)
  const [tickets, openRequests, containersOnSite, unsettled, invoices] = await Promise.all([
    prisma.scaleTicket.findMany({ where: { accountId: account.id, status: { in: ['completed', 'settled'] }, completedAt: { gte: since } }, select: { totalCents: true, lines: { select: { payWeight: true } } } }),
    prisma.serviceRequest.count({ where: { accountId: account.id, status: { in: ['requested', 'awaiting_payment', 'approved', 'scheduled'] } } }),
    prisma.container.count({ where: { accountId: account.id, status: 'at_customer' } }),
    prisma.scaleTicket.aggregate({ where: { accountId: account.id, status: 'completed', paymentMode: 'on_account', settlementId: null }, _sum: { totalCents: true } }),
    prisma.invoice.findMany({ where: { accountId: account.id, status: { in: ['open', 'partially_paid'] } }, select: { totalCents: true, paidCents: true } }),
  ])
  const charges = await prisma.accountCharge.aggregate({ where: { accountId: account.id, status: 'open' }, _sum: { amountCents: true } })
  const weight = tickets.reduce((s: Decimal, t: any) => t.lines.reduce((a: Decimal, l: any) => a.plus(String(l.payWeight || '0')), s), new Decimal(0))
  return {
    account: { id: account.id, slug: account.slug, name: account.name, accountNumber: account.accountNumber || null, status: account.status, paymentTerms: account.paymentTerms, hasCredit: account.hasCredit, settlementCycle: account.settlementCycle || null },
    role: contact.role, monthWeight: weight.toFixed(2), monthValueCents: tickets.reduce((s: number, t: any) => s + t.totalCents, 0), openRequests, containersOnSite,
    unsettledCents: (unsettled._sum.totalCents || 0) - (charges._sum.amountCents || 0), openInvoiceCents: invoices.reduce((s: number, i: any) => s + Math.max(0, i.totalCents - i.paidCents), 0),
    currencyCode: settings.currencyCode || 'USD', weightUnit: settings.weightUnit || 'lb',
  }
}

/** C2: the account's price list, latest entry per material (falls back to nothing, never the private board). */
export async function accountPrices(prisma: any, session: any, slug: string, now = new Date()) {
  const { account } = await requireContact(prisma, session, slug)
  const settings: any = await businessSettings(prisma)
  const list = account.priceListId ? await prisma.priceList.findUnique({ where: { id: account.priceListId } }) : null
  if (!list?.isActive) return { priceListName: null, currencyCode: settings.currencyCode || 'USD', items: [] }
  const entries = await prisma.priceEntry.findMany({
    where: { priceListId: list.id, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
    include: { material: { include: { category: true } } }, orderBy: [{ effectiveFrom: 'desc' }],
  })
  const seen = new Set<string>()
  const items: any[] = []
  for (const e of entries) {
    if (!e.material || seen.has(e.materialId)) continue
    seen.add(e.materialId)
    items.push({
      materialId: e.materialId, materialName: e.material.name, materialSlug: e.material.slug, categoryName: e.material.category?.name || null, unit: e.unit, unitPrice: new Decimal(String(e.unitPrice)).toString(),
      unitPriceHigh: e.unitPriceHigh === null ? null : new Decimal(String(e.unitPriceHigh)).toString(), effectiveFrom: e.effectiveFrom, effectiveTo: e.effectiveTo, direction: e.material.direction || 'buy',
    })
  }
  items.sort((a, b) => a.materialName.localeCompare(b.materialName))
  return { priceListName: list.name, currencyCode: settings.currencyCode || 'USD', items }
}

export async function accountTickets(prisma: any, session: any, a: { accountSlug: string; siteId?: string | null; materialId?: string | null; from?: string | null; to?: string | null; take?: number | null; skip?: number | null }) {
  const { account } = await requireContact(prisma, session, a.accountSlug)
  const settings: any = await businessSettings(prisma)
  const where: any = { accountId: account.id, status: { not: 'open' } }
  if (a.siteId) where.siteId = a.siteId
  if (a.materialId) where.lines = { some: { materialId: a.materialId } }
  if (a.from || a.to) {
    where.createdAt = {}
    if (a.from) where.createdAt.gte = dayOf(a.from)
    if (a.to) where.createdAt.lt = new Date(dayOf(a.to).getTime() + DAY)
  }
  const take = Math.min(100, Math.max(1, Math.trunc(Number(a.take ?? 25))))
  const skip = Math.max(0, Math.trunc(Number(a.skip ?? 0)))
  const [count, rows] = await Promise.all([
    prisma.scaleTicket.count({ where }),
    prisma.scaleTicket.findMany({ where, include: { yard: true, site: true, lines: { select: { materialName: true, payWeight: true, unit: true } } }, orderBy: [{ createdAt: 'desc' }], take, skip }),
  ])
  return {
    count, currencyCode: settings.currencyCode || 'USD',
    items: rows.map((t: any) => {
      const byWeight = t.lines.filter((l: any) => l.unit !== 'each')
      return {
        id: t.id, displayNumber: formatTicketNumber(t.yard.code, t.direction, t.number), status: t.status, completedAt: t.completedAt, createdAt: t.createdAt, totalCents: t.totalCents,
        netWeight: byWeight.length ? byWeight.reduce((s: Decimal, l: any) => s.plus(String(l.payWeight || '0')), new Decimal(0)).toFixed(2) : null,
        siteName: t.site?.name || null, materials: [...new Set(t.lines.map((l: any) => l.materialName))].join(', ') || null, yard: { name: t.yard.name, timezone: t.yard.timezone || null },
      }
    }),
  }
}

export async function accountTicket(prisma: any, session: any, slug: string, id: string) {
  const { account } = await requireContact(prisma, session, slug)
  const t = await prisma.scaleTicket.findUnique({ where: { id }, select: { id: true, accountId: true, lookupCode: true, adjustsId: true } })
  if (!t || t.accountId !== account.id) notFound('Ticket')
  const receipt: any = await ticketReceipt(prisma, t.id)
  return { ...receipt, lookupCode: t.lookupCode, adjustsId: t.adjustsId || null, invoiceId: null, amountDueCents: null }
}

export async function accountSites(prisma: any, session: any, slug: string) {
  const { account } = await requireContact(prisma, session, slug)
  const rows = await prisma.serviceSite.findMany({ where: { accountId: account.id }, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] })
  return rows.map((s: any) => ({ id: s.id, name: s.name, addressLine1: s.addressLine1 || null, addressLine2: s.addressLine2 || null, city: s.city || null, region: s.region || null, postalCode: s.postalCode || null, contactName: s.contactName || null, contactPhone: s.contactPhone || null, accessNotes: s.accessNotes || null, isActive: s.isActive }))
}

export async function accountContainers(prisma: any, session: any, slug: string, now = new Date()) {
  const { account } = await requireContact(prisma, session, slug)
  const rows = await prisma.container.findMany({ where: { accountId: account.id, status: { in: ['at_customer', 'assigned', 'in_transit'] } }, include: { type: true, site: true, currentMaterial: true }, orderBy: [{ number: 'asc' }] })
  return rows.map((c: any) => ({
    id: c.id, number: c.number, status: c.status, placedOn: c.placedOn, ...containerRental(c, now),
    type: c.type ? { name: c.type.name, capacityLabel: c.type.capacityLabel || null, freeRentalDays: c.type.freeRentalDays } : null,
    site: c.site ? { id: c.site.id, name: c.site.name } : null, currentMaterial: c.currentMaterial ? { name: c.currentMaterial.name } : null,
  }))
}

const requestYard = (r: any) => ({ ...shapeRequest(r), yard: r.yard ? { id: r.yard.id, name: r.yard.name, phone: r.yard.phone || null, timezone: r.yard.timezone || null } : null })

export async function accountServiceRequests(prisma: any, session: any, slug: string) {
  const { account } = await requireContact(prisma, session, slug)
  const rows = await prisma.serviceRequest.findMany({ where: { accountId: account.id }, include: REQUEST_INCLUDE, orderBy: [{ createdAt: 'desc' }], take: 200 })
  return rows.map(requestYard)
}
export async function accountServiceRequest(prisma: any, session: any, slug: string, id: string) {
  const { account } = await requireContact(prisma, session, slug)
  const r = await prisma.serviceRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE })
  if (!r || r.accountId !== account.id) notFound('Request')
  return requestYard(r)
}

export async function accountSettlements(prisma: any, session: any, slug: string) {
  const { account } = await requireContact(prisma, session, slug, MONEY_ROLES.concat('member'))
  const rows = await prisma.settlement.findMany({ where: { accountId: account.id, status: { not: 'draft' } }, include: { payout: true }, orderBy: [{ periodEnd: 'desc' }], take: 200 })
  return rows.map((s: any) => ({
    id: s.id, number: s.number, status: s.status, periodStart: s.periodStart, periodEnd: s.periodEnd, ticketTotalCents: s.ticketTotalCents, chargeTotalCents: s.chargeTotalCents,
    donationTotalCents: s.donationTotalCents, netCents: s.netCents, paidAt: s.paidAt, payoutStatus: s.payout?.status || null,
  }))
}

export async function accountCharges(prisma: any, session: any, slug: string, unsettledOnly = false) {
  const { account } = await requireContact(prisma, session, slug, MONEY_ROLES.concat('member'))
  const where: any = { accountId: account.id, status: { not: 'waived' } }
  if (unsettledOnly) where.status = 'open'
  const rows = await prisma.accountCharge.findMany({ where, include: { container: true }, orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }], take: 500 })
  return rows.map((c: any) => ({ id: c.id, kind: c.kind, description: c.description || null, amountCents: c.amountCents, serviceDate: c.serviceDate, status: c.status, containerNumber: c.container?.number || null }))
}

const shapeInvoice = (i: any, detail = false) => ({
  id: i.id, number: i.number, kind: i.kind, status: i.status, subtotalCents: i.subtotalCents, taxCents: i.taxCents, totalCents: i.totalCents, paidCents: i.paidCents, refundedCents: i.refundedCents,
  dueOn: i.dueOn, createdAt: i.createdAt,
  ...(detail ? {
    lines: (i.lines || []).map((l: any) => ({ description: l.description, quantity: l.weight === null ? null : String(l.weight), amountCents: l.amountCents })),
    payments: (i.payments || []).filter((p: any) => p.status === 'succeeded' || p.status === 'reversed').map((p: any) => ({ id: p.id, amountCents: p.amountCents, method: p.method, status: p.status, createdAt: p.receivedAt || p.createdAt, refundedCents: p.refundedCents })),
  } : {}),
})

export async function accountInvoices(prisma: any, session: any, slug: string) {
  const { account } = await requireContact(prisma, session, slug, MONEY_ROLES.concat('member'))
  const rows = await prisma.invoice.findMany({ where: { accountId: account.id, status: { not: 'void' } }, orderBy: [{ createdAt: 'desc' }], take: 200 })
  return rows.map((i: any) => shapeInvoice(i))
}
export async function accountInvoice(prisma: any, session: any, slug: string, id: string) {
  const { account } = await requireContact(prisma, session, slug, MONEY_ROLES.concat('member'))
  const i = await prisma.invoice.findUnique({ where: { id }, include: { lines: true, payments: { orderBy: { createdAt: 'asc' } } } })
  if (!i || i.accountId !== account.id || i.status === 'draft') notFound('Invoice')
  return shapeInvoice(i, true)
}

/** C11: weight and value by material by month for a calendar year; the storefront makes the CSV. */
export async function accountDiversionReport(prisma: any, session: any, slug: string, year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) refuse('Choose a year.')
  const { account } = await requireContact(prisma, session, slug)
  const settings: any = await businessSettings(prisma)
  const lines = await prisma.ticketLine.findMany({
    where: { ticket: { accountId: account.id, status: { in: ['completed', 'settled'] }, completedAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } } },
    select: { materialName: true, payWeight: true, amountCents: true, unit: true, material: { select: { category: { select: { name: true } } } }, ticket: { select: { completedAt: true } } },
  })
  const rows = new Map<string, { month: string; materialName: string; categoryName: string | null; weight: Decimal; valueCents: number }>()
  for (const l of lines) {
    const month = new Date(l.ticket.completedAt).toISOString().slice(0, 7)
    const key = `${month}|${l.materialName}`
    const row = rows.get(key) || { month, materialName: l.materialName, categoryName: l.material?.category?.name || null, weight: new Decimal(0), valueCents: 0 }
    if (l.unit !== 'each') row.weight = row.weight.plus(String(l.payWeight || '0'))
    row.valueCents += l.amountCents
    rows.set(key, row)
  }
  return {
    weightUnit: settings.weightUnit || 'lb', currencyCode: settings.currencyCode || 'USD',
    rows: [...rows.values()].sort((a, b) => a.month.localeCompare(b.month) || a.materialName.localeCompare(b.materialName)).map((r) => ({ ...r, weight: r.weight.toFixed(2) })),
  }
}

export const portalTypeDefs = `
  type AccountSummary { id: ID!, slug: String!, name: String!, accountNumber: String, status: String!, paymentTerms: String!, hasCredit: Boolean!, settlementCycle: String }
  type AccountOverview { account: AccountSummary!, role: String!, monthWeight: String!, monthValueCents: Int!, openRequests: Int!, containersOnSite: Int!, unsettledCents: Int!, openInvoiceCents: Int!, currencyCode: String!, weightUnit: String! }
  type AccountPrice { materialId: ID!, materialName: String!, materialSlug: String!, categoryName: String, unit: String!, unitPrice: String!, unitPriceHigh: String, effectiveFrom: DateTime!, effectiveTo: DateTime, direction: String! }
  type AccountPrices { priceListName: String, currencyCode: String!, items: [AccountPrice!]! }
  type AccountTicketRow { id: ID!, displayNumber: String!, status: String!, completedAt: DateTime, createdAt: DateTime, totalCents: Int!, netWeight: String, siteName: String, materials: String, yard: MyTicketYard }
  type AccountTicketPage { count: Int!, currencyCode: String!, items: [AccountTicketRow!]! }
  type AccountSiteView { id: ID!, name: String!, addressLine1: String, addressLine2: String, city: String, region: String, postalCode: String, contactName: String, contactPhone: String, accessNotes: String, isActive: Boolean! }
  type AccountContainerType { name: String!, capacityLabel: String, freeRentalDays: Int! }
  type AccountContainerSite { id: ID!, name: String! }
  type NamedRef { name: String! }
  type AccountContainerView { id: ID!, number: String!, status: String!, placedOn: DateTime, daysOnSite: Int, rentalAccruingCents: Int, type: AccountContainerType, site: AccountContainerSite, currentMaterial: NamedRef }
  type AccountSettlementView { id: ID!, number: Int, status: String!, periodStart: DateTime, periodEnd: DateTime, ticketTotalCents: Int!, chargeTotalCents: Int!, donationTotalCents: Int!, netCents: Int!, paidAt: DateTime, payoutStatus: String }
  type AccountChargeView { id: ID!, kind: String!, description: String, amountCents: Int!, serviceDate: DateTime, status: String!, containerNumber: String }
  type AccountInvoiceLineView { description: String!, quantity: String, amountCents: Int! }
  type AccountPaymentView { id: ID!, amountCents: Int!, method: String!, status: String!, createdAt: DateTime, refundedCents: Int! }
  type AccountInvoiceView { id: ID!, number: Int, kind: String!, status: String!, subtotalCents: Int!, taxCents: Int!, totalCents: Int!, paidCents: Int!, refundedCents: Int!, dueOn: DateTime, createdAt: DateTime, lines: [AccountInvoiceLineView!], payments: [AccountPaymentView!] }
  type DiversionRow { month: String!, materialName: String!, categoryName: String, weight: String!, valueCents: Int! }
  type DiversionReport { weightUnit: String!, currencyCode: String!, rows: [DiversionRow!]! }
  extend type RequestYard { timezone: String }
`

export const portalQueryDefs = `
  accountOverview(accountSlug: String!): AccountOverview
  accountPrices(accountSlug: String!): AccountPrices
  accountTickets(accountSlug: String!, siteId: ID, materialId: ID, from: String, to: String, take: Int, skip: Int): AccountTicketPage
  accountTicket(accountSlug: String!, id: ID!): TicketReceipt
  accountSites(accountSlug: String!): [AccountSiteView!]!
  accountContainers(accountSlug: String!): [AccountContainerView!]!
  accountServiceRequests(accountSlug: String!): [MyServiceRequest!]!
  accountServiceRequest(accountSlug: String!, id: ID!): MyServiceRequest
  accountSettlements(accountSlug: String!): [AccountSettlementView!]!
  accountCharges(accountSlug: String!, unsettledOnly: Boolean): [AccountChargeView!]!
  accountInvoices(accountSlug: String!): [AccountInvoiceView!]!
  accountInvoice(accountSlug: String!, id: ID!): AccountInvoiceView
  accountDiversionReport(accountSlug: String!, year: Int!): DiversionReport
`

export const portalResolvers = {
  Query: {
    accountOverview: (_: unknown, a: any, c: any) => accountOverview(db(c), c.session, a.accountSlug),
    accountPrices: (_: unknown, a: any, c: any) => accountPrices(db(c), c.session, a.accountSlug),
    accountTickets: (_: unknown, a: any, c: any) => accountTickets(db(c), c.session, a),
    accountTicket: (_: unknown, a: any, c: any) => accountTicket(db(c), c.session, a.accountSlug, a.id),
    accountSites: (_: unknown, a: any, c: any) => accountSites(db(c), c.session, a.accountSlug),
    accountContainers: (_: unknown, a: any, c: any) => accountContainers(db(c), c.session, a.accountSlug),
    accountServiceRequests: (_: unknown, a: any, c: any) => accountServiceRequests(db(c), c.session, a.accountSlug),
    accountServiceRequest: (_: unknown, a: any, c: any) => accountServiceRequest(db(c), c.session, a.accountSlug, a.id),
    accountSettlements: (_: unknown, a: any, c: any) => accountSettlements(db(c), c.session, a.accountSlug),
    accountCharges: (_: unknown, a: any, c: any) => accountCharges(db(c), c.session, a.accountSlug, Boolean(a.unsettledOnly)),
    accountInvoices: (_: unknown, a: any, c: any) => accountInvoices(db(c), c.session, a.accountSlug),
    accountInvoice: (_: unknown, a: any, c: any) => accountInvoice(db(c), c.session, a.accountSlug, a.id),
    accountDiversionReport: (_: unknown, a: any, c: any) => accountDiversionReport(db(c), c.session, a.accountSlug, a.year),
  },
}
