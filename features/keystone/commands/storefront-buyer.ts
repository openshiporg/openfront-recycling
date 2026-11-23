import { Decimal } from 'decimal.js'
import { CommandError } from '../lib/command'
import { businessSettings } from '../lib/domain'
import { requireContact } from './storefront-account'
import { estimateValueCents, type WeightUnitBase } from '../../recycling/ticketMath'

/**
 * Buyer (dissertation §8.4 B3, B4, B5, B7, B8) and nonprofit (§8.5 N1 to N3) portal reads. The
 * actions already exist: submitOffer (with buyNow), respondToOffer, fileClaim, withdrawClaim,
 * updateNonprofitProfile, upsertCampaign, endCampaign; N4 is accountSettlements. Every read takes the
 * account slug and proves an active AccountContact first (requireContact), so another company's
 * slug answers NOT_FOUND.
 */

const db = (c: any) => c.sudo().prisma
const notFound = (what: string): never => { throw new CommandError(`${what} not found.`, 'NOT_FOUND') }
const dec = (v: unknown) => (v === null || v === undefined ? null : new Decimal(String(v)).toFixed())
const NON_DRIVER = ['admin', 'member', 'billing']
const MONEY_ROLES = ['admin', 'billing']

async function buyer(prisma: any, session: any, slug: string, roles?: string[]) {
  const r = await requireContact(prisma, session, slug, roles)
  if (!r.account.isBuyer) throw new CommandError('This account does not buy material from the yard.', 'FORBIDDEN')
  return r
}
async function nonprofit(prisma: any, session: any, slug: string, roles?: string[]) {
  const r = await requireContact(prisma, session, slug, roles)
  if (!r.account.isNonprofit) throw new CommandError('This account is not a nonprofit.', 'FORBIDDEN')
  return r
}

// B3 offers --------------------------------------------------------------------------------

export async function accountOffers(prisma: any, session: any, slug: string) {
  const { account } = await buyer(prisma, session, slug, NON_DRIVER)
  const rows = await prisma.offer.findMany({ where: { accountId: account.id }, include: { listing: { include: { material: true, yard: true } }, contact: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 200 })
  return rows.map((o: any) => ({
    id: o.id, status: o.status, listingId: o.listingId, listingTitle: o.listing?.title || null, materialName: o.listing?.material?.name || null, yardName: o.listing?.yard?.name || null,
    weight: dec(o.weight), unit: o.unit, unitPrice: dec(o.unitPrice), pickupFrom: o.pickupFrom, pickupTo: o.pickupTo, message: o.message || null,
    counterUnitPrice: dec(o.counterUnitPrice), counterWeight: dec(o.counterWeight), counterMessage: o.counterMessage || null, decisionReason: o.decisionReason || null,
    expiresAt: o.expiresAt, salesOrderId: o.salesOrderId, contactName: o.contact?.name || null, createdAt: o.createdAt,
    canAcceptCounter: o.status === 'countered', canWithdraw: o.status === 'submitted' || o.status === 'countered',
  }))
}

// B4, B5 orders and shipments ---------------------------------------------------------------

const ORDER_INCLUDE = {
  yard: true,
  lines: { orderBy: { createdAt: 'asc' } },
  shipments: { orderBy: { createdAt: 'asc' }, include: { units: { select: { tagNumber: true, form: true, weight: true } }, invoice: { select: { id: true, number: true, status: true, totalCents: true, paidCents: true } } } },
} as const

function shapeOrder(o: any, base: WeightUnitBase) {
  const ordered = o.lines.reduce((s: Decimal, l: any) => s.plus(String(l.weight || 0)), new Decimal(0))
  const shipped = o.lines.reduce((s: Decimal, l: any) => s.plus(String(l.shippedWeight || 0)), new Decimal(0))
  return {
    id: o.id, number: o.number, status: o.status, yardName: o.yard?.name || null, buyerReference: o.buyerReference || null, shipTo: o.shipTo || null, terms: o.terms || null, paymentTerms: o.paymentTerms,
    netDays: o.netDays, weightBasis: o.weightBasis, shipWindowStart: o.shipWindowStart, shipWindowEnd: o.shipWindowEnd, cancelReason: o.cancelReason || null, createdAt: o.createdAt,
    orderedWeight: ordered.toFixed(), shippedWeight: shipped.toFixed(),
    valueCents: o.lines.reduce((s: number, l: any) => s + estimateValueCents(String(l.weight), String(l.unitPrice ?? 0), l.unit, base), 0),
    lines: o.lines.map((l: any) => ({ id: l.id, materialName: l.materialName, weight: dec(l.weight), unit: l.unit, unitPrice: dec(l.unitPrice), shippedWeight: dec(l.shippedWeight), tolerancePercent: dec(l.tolerancePercent) })),
    shipments: o.shipments.map((s: any) => {
      const released = Boolean(s.releasedAt) && s.status !== 'cancelled'
      return {
        id: s.id, number: s.number, status: s.status, carrier: s.carrier || null, driverName: s.driverName || null, truckPlate: s.truckPlate || null, trailerNumber: s.trailerNumber || null,
        sealNumber: s.sealNumber || null, bolNumber: s.bolNumber || null, scheduledFor: s.scheduledFor, shippedWeight: dec(s.shippedWeight), receivedWeight: dec(s.receivedWeight), receivedGradeNote: s.receivedGradeNote || null,
        freightCents: s.freightCents, releasedAt: s.releasedAt, deliveredAt: s.deliveredAt, units: s.units.map((u: any) => ({ tagNumber: u.tagNumber, form: u.form, weight: dec(u.weight) })),
        // The gate pass only exists once the yard has released the load (prepaid or on terms).
        gatePass: released ? { shipmentId: s.id, bolNumber: s.bolNumber || null, sealNumber: s.sealNumber || null, truckPlate: s.truckPlate || null, releasedAt: s.releasedAt } : null,
        invoice: s.invoice ? { id: s.invoice.id, number: s.invoice.number, status: s.invoice.status, totalCents: s.invoice.totalCents, paidCents: s.invoice.paidCents } : null,
        canClaim: ['delivered', 'reconciled'].includes(s.status),
      }
    }),
  }
}

export async function accountSalesOrders(prisma: any, session: any, slug: string) {
  const { account } = await buyer(prisma, session, slug)
  const rows = await prisma.salesOrder.findMany({ where: { accountId: account.id, status: { not: 'draft' } }, include: ORDER_INCLUDE, orderBy: { createdAt: 'desc' }, take: 200 })
  const settings = await businessSettings(prisma)
  return rows.map((o: any) => shapeOrder(o, settings.weightUnit === 'kg' ? 'kg' : 'lb'))
}

export async function accountSalesOrder(prisma: any, session: any, slug: string, id: string) {
  const { account } = await buyer(prisma, session, slug)
  const o = await prisma.salesOrder.findFirst({ where: { id: String(id || ''), accountId: account.id, status: { not: 'draft' } }, include: ORDER_INCLUDE })
  if (!o) notFound('Order')
  const settings = await businessSettings(prisma)
  return shapeOrder(o, settings.weightUnit === 'kg' ? 'kg' : 'lb')
}

// B7 claims --------------------------------------------------------------------------------

export async function accountClaims(prisma: any, session: any, slug: string) {
  const { account } = await buyer(prisma, session, slug, NON_DRIVER)
  const rows = await prisma.claim.findMany({ where: { accountId: account.id }, include: { shipment: { include: { order: { select: { id: true, number: true } } } }, openedBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 200 })
  return rows.map((c: any) => ({
    id: c.id, status: c.status, kind: c.kind, description: c.description, claimedCents: c.claimedCents, creditCents: c.creditCents, decisionReason: c.decisionReason || null, decidedAt: c.decidedAt,
    photoCount: Array.isArray(c.photos) ? c.photos.length : 0, shipmentId: c.shipmentId, shipmentNumber: c.shipment?.number ?? null, orderId: c.shipment?.order?.id || null, orderNumber: c.shipment?.order?.number ?? null,
    openedByName: c.openedBy?.name || null, createdAt: c.createdAt, canWithdraw: c.status === 'open',
  }))
}

// B8 purchase report -----------------------------------------------------------------------

export async function accountPurchaseReport(prisma: any, session: any, slug: string, year: number) {
  const { account } = await buyer(prisma, session, slug, MONEY_ROLES)
  const y = Math.trunc(Number(year))
  if (!(y >= 2000 && y <= 2100)) throw new CommandError('Choose a year.', 'BAD_USER_INPUT')
  const from = new Date(Date.UTC(y, 0, 1))
  const to = new Date(Date.UTC(y + 1, 0, 1))
  const settings: any = await businessSettings(prisma)
  // What the buyer bought is what it was invoiced for: material lines on sale invoices for released loads.
  const lines = await prisma.invoiceLine.findMany({
    where: { kind: 'material', invoice: { accountId: account.id, kind: 'sale', status: { not: 'void' }, shipment: { releasedAt: { gte: from, lt: to } } } },
    include: { invoice: { include: { shipment: { select: { releasedAt: true } } } } },
  })
  const rows = new Map<string, { month: string; materialName: string; weight: Decimal; valueCents: number }>()
  for (const l of lines) {
    const month = new Date(l.invoice.shipment.releasedAt).toISOString().slice(0, 7)
    const key = `${month}|${l.description}`
    const r = rows.get(key) || { month, materialName: l.description, weight: new Decimal(0), valueCents: 0 }
    r.weight = r.weight.plus(String(l.weight ?? 0))
    r.valueCents += l.amountCents
    rows.set(key, r)
  }
  return {
    year: y, weightUnit: settings.weightUnit || 'lb', currencyCode: settings.currencyCode || 'USD',
    rows: [...rows.values()].sort((a, b) => a.month.localeCompare(b.month) || a.materialName.localeCompare(b.materialName)).map((r) => ({ ...r, weight: r.weight.toFixed() })),
  }
}

// N1 to N3 nonprofit -----------------------------------------------------------------------

export async function accountNonprofit(prisma: any, session: any, slug: string) {
  const { account, contact } = await nonprofit(prisma, session, slug)
  const campaigns = await prisma.donationCampaign.findMany({ where: { accountId: account.id }, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] })
  const sums = await prisma.donation.groupBy({ by: ['campaignId'], where: { accountId: account.id, status: { in: ['credited', 'disbursed'] } }, _sum: { amountCents: true, weight: true }, _count: true })
  const byCampaign = new Map(sums.map((s: any) => [s.campaignId, s]))
  const total = await prisma.donation.aggregate({ where: { accountId: account.id, status: { in: ['credited', 'disbursed'] } }, _sum: { amountCents: true } })
  const undisbursed = await prisma.donation.aggregate({ where: { accountId: account.id, status: 'credited' }, _sum: { amountCents: true } })
  return {
    accountId: account.id, slug: account.slug, name: account.name, legalName: account.legalName || null, ein: account.ein || null, summary: account.nonprofitSummary || null, website: account.nonprofitWebsite || null,
    logoId: account.nonprofitLogo_id || null, isPublic: account.isPublicNonprofit, canEdit: contact.role === 'admin',
    raisedCents: total._sum.amountCents || 0, awaitingDisbursementCents: undisbursed._sum.amountCents || 0,
    campaigns: campaigns.map((c: any) => {
      const s: any = byCampaign.get(c.id)
      return {
        id: c.id, name: c.name, slug: c.slug, description: c.description || null, status: c.status, isPublic: c.isPublic, startsOn: c.startsOn, endsOn: c.endsOn, goalWeight: dec(c.goalWeight), goalCents: c.goalCents,
        raisedCents: s?._sum?.amountCents || 0, raisedWeight: dec(s?._sum?.weight || 0), donationCount: s?._count || 0,
      }
    }),
  }
}

export async function accountDonations(prisma: any, session: any, slug: string, input: { campaignId?: string | null; take?: number | null; skip?: number | null } = {}) {
  const { account } = await nonprofit(prisma, session, slug)
  const where: any = { accountId: account.id, status: { in: ['credited', 'disbursed'] }, ...(input.campaignId ? { campaignId: input.campaignId } : {}) }
  const take = Math.min(Math.max(1, Math.trunc(Number(input.take)) || 50), 200)
  const skip = Math.max(0, Math.trunc(Number(input.skip)) || 0)
  const [count, rows] = await Promise.all([
    prisma.donation.count({ where }),
    prisma.donation.findMany({ where, include: { campaign: { select: { name: true } }, seller: { select: { firstName: true, lastName: true } }, ticket: { select: { completedAt: true } } }, orderBy: { createdAt: 'desc' }, take, skip }),
  ])
  return {
    count,
    items: rows.map((d: any) => ({
      id: d.id, date: d.ticket?.completedAt || d.createdAt, kind: d.kind, status: d.status, amountCents: d.amountCents, weight: dec(d.weight), campaignName: d.campaign?.name || null, receiptNumber: d.receiptNumber || null,
      // Donor names only when the donor agreed (§8.5 N3).
      donorName: d.showDonorName && d.seller ? `${d.seller.firstName} ${d.seller.lastName.slice(0, 1)}.`.trim() : null,
      disbursed: d.status === 'disbursed',
    })),
  }
}

// GraphQL ----------------------------------------------------------------------------------

export const buyerTypeDefs = `
  type AccountOfferView { id: ID!, status: String!, listingId: ID, listingTitle: String, materialName: String, yardName: String, weight: String, unit: String!, unitPrice: String, pickupFrom: DateTime, pickupTo: DateTime, message: String, counterUnitPrice: String, counterWeight: String, counterMessage: String, decisionReason: String, expiresAt: DateTime, salesOrderId: ID, contactName: String, createdAt: DateTime!, canAcceptCounter: Boolean!, canWithdraw: Boolean! }
  type BuyerOrderLine { id: ID!, materialName: String!, weight: String, unit: String!, unitPrice: String, shippedWeight: String, tolerancePercent: String }
  type BuyerShipmentUnit { tagNumber: String!, form: String!, weight: String }
  type BuyerGatePass { shipmentId: ID!, bolNumber: String, sealNumber: String, truckPlate: String, releasedAt: DateTime }
  type BuyerShipmentInvoice { id: ID!, number: Int, status: String!, totalCents: Int!, paidCents: Int! }
  type BuyerShipment { id: ID!, number: Int, status: String!, carrier: String, driverName: String, truckPlate: String, trailerNumber: String, sealNumber: String, bolNumber: String, scheduledFor: DateTime, shippedWeight: String, receivedWeight: String, receivedGradeNote: String, freightCents: Int!, releasedAt: DateTime, deliveredAt: DateTime, units: [BuyerShipmentUnit!]!, gatePass: BuyerGatePass, invoice: BuyerShipmentInvoice, canClaim: Boolean! }
  type BuyerOrder { id: ID!, number: Int, status: String!, yardName: String, buyerReference: String, shipTo: String, terms: String, paymentTerms: String!, netDays: Int, weightBasis: String!, shipWindowStart: DateTime, shipWindowEnd: DateTime, cancelReason: String, createdAt: DateTime!, orderedWeight: String!, shippedWeight: String!, valueCents: Int!, lines: [BuyerOrderLine!]!, shipments: [BuyerShipment!]! }
  type AccountClaimView { id: ID!, status: String!, kind: String!, description: String!, claimedCents: Int!, creditCents: Int!, decisionReason: String, decidedAt: DateTime, photoCount: Int!, shipmentId: ID, shipmentNumber: Int, orderId: ID, orderNumber: Int, openedByName: String, createdAt: DateTime!, canWithdraw: Boolean! }
  type PurchaseReportRow { month: String!, materialName: String!, weight: String!, valueCents: Int! }
  type PurchaseReport { year: Int!, weightUnit: String!, currencyCode: String!, rows: [PurchaseReportRow!]! }
  type NonprofitCampaignView { id: ID!, name: String!, slug: String!, description: String, status: String!, isPublic: Boolean!, startsOn: DateTime, endsOn: DateTime, goalWeight: String, goalCents: Int, raisedCents: Int!, raisedWeight: String, donationCount: Int! }
  type NonprofitAccountView { accountId: ID!, slug: String!, name: String!, legalName: String, ein: String, summary: String, website: String, logoId: String, isPublic: Boolean!, canEdit: Boolean!, raisedCents: Int!, awaitingDisbursementCents: Int!, campaigns: [NonprofitCampaignView!]! }
  type NonprofitDonationRow { id: ID!, date: DateTime, kind: String!, status: String!, amountCents: Int!, weight: String, campaignName: String, receiptNumber: String, donorName: String, disbursed: Boolean! }
  type NonprofitDonationPage { count: Int!, items: [NonprofitDonationRow!]! }
`
export const buyerQueryDefs = `
  accountOffers(accountSlug: String!): [AccountOfferView!]!
  accountSalesOrders(accountSlug: String!): [BuyerOrder!]!
  accountSalesOrder(accountSlug: String!, id: ID!): BuyerOrder
  accountClaims(accountSlug: String!): [AccountClaimView!]!
  accountPurchaseReport(accountSlug: String!, year: Int!): PurchaseReport
  accountNonprofit(accountSlug: String!): NonprofitAccountView
  accountDonations(accountSlug: String!, campaignId: ID, take: Int, skip: Int): NonprofitDonationPage
`
export const buyerResolvers = {
  Query: {
    accountOffers: (_: unknown, a: any, c: any) => accountOffers(db(c), c.session, a.accountSlug),
    accountSalesOrders: (_: unknown, a: any, c: any) => accountSalesOrders(db(c), c.session, a.accountSlug),
    accountSalesOrder: (_: unknown, a: any, c: any) => accountSalesOrder(db(c), c.session, a.accountSlug, a.id),
    accountClaims: (_: unknown, a: any, c: any) => accountClaims(db(c), c.session, a.accountSlug),
    accountPurchaseReport: (_: unknown, a: any, c: any) => accountPurchaseReport(db(c), c.session, a.accountSlug, a.year),
    accountNonprofit: (_: unknown, a: any, c: any) => accountNonprofit(db(c), c.session, a.accountSlug),
    accountDonations: (_: unknown, a: any, c: any) => accountDonations(db(c), c.session, a.accountSlug, a),
  },
}
