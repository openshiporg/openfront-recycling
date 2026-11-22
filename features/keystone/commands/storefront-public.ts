import { hasFlag, isStaff } from '../access'
import { CommandError } from '../lib/command'
import { businessSettings, yardRules } from '../lib/domain'
import { currentEntry } from '../lib/pricing'
import { donationReceipt } from './nonprofits'

/**
 * Public storefront operations (dissertation §8.1). Each reads through sudo and returns only
 * public fields; nothing here exposes sellers, IDs, cost or the do-not-buy list.
 */

const db = (c: any) => c.sudo().prisma

async function yardBySlugOrId(prisma: any, yard: string | null | undefined) {
  if (yard) {
    const y = await prisma.yard.findFirst({ where: { OR: [{ slug: yard }, { id: yard }], status: 'active' } })
    if (!y) throw new CommandError('Yard not found.', 'NOT_FOUND')
    return y
  }
  const first = await prisma.yard.findFirst({ where: { status: 'active', acceptsPublic: true }, orderBy: { name: 'asc' } })
  if (!first) throw new CommandError('No yard is open to the public yet.', 'NOT_FOUND')
  return first
}

/** P3, P4, P7, P9: current public board prices for one yard. */
export async function publicPriceBoard(prisma: any, yardKey: string | null | undefined, now = new Date()) {
  const yard = await yardBySlugOrId(prisma, yardKey)
  const settings: any = await businessSettings(prisma)
  const base = { currencyCode: settings.currencyCode || 'USD', weightUnit: settings.weightUnit || 'lb' }
  if (!yard.boardPriceListId) return { yard, publishedAt: null, items: [] as any[], entries: [] as any[], ...base }
  const entries = await prisma.priceEntry.findMany({
    where: { priceListId: yard.boardPriceListId, isPublic: true, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }], material: { isActive: true, isPublic: true } },
    include: { material: { include: { category: true } } },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
  })
  const seen = new Set<string>()
  const items: any[] = []
  let publishedAt: Date | null = null
  for (const e of entries) {
    if (seen.has(e.materialId)) continue
    seen.add(e.materialId)
    if (!publishedAt || e.effectiveFrom > publishedAt) publishedAt = e.effectiveFrom
    items.push({
      materialId: e.materialId, materialName: e.material.name, materialSlug: e.material.slug, specName: e.material.specName, categoryName: e.material.category?.name || '',
      categorySlug: e.material.category?.slug || '', categorySortOrder: e.material.category?.sortOrder ?? 0, sortOrder: e.material.sortOrder ?? 0, imageUrl: null as string | null,
      direction: e.material.direction, unit: e.unit, unitPrice: String(e.unitPrice), unitPriceHigh: e.unitPriceHigh === null ? null : String(e.unitPriceHigh), effectiveFrom: e.effectiveFrom,
      minimumWeight: e.material.minimumWeight === null ? null : String(e.material.minimumWeight),
    })
  }
  items.sort((a, b) => a.categorySortOrder - b.categorySortOrder || a.sortOrder - b.sortOrder || a.materialName.localeCompare(b.materialName))
  return { yard, publishedAt, items, entries: items, ...base }
}

/** P2, P8: what the yard asks of a seller. */
export async function publicYardRules(prisma: any, yardKey: string | null | undefined) {
  const yard = await yardBySlugOrId(prisma, yardKey)
  const { profile, restrictions } = await yardRules(prisma, yard.id)
  const p: any = profile
  const materials = new Map<string, { name: string; slug: string }>()
  const categories = new Map<string, string>()
  const ids = restrictions.map((r: any) => r.materialId).filter(Boolean)
  const catIds = restrictions.map((r: any) => r.categoryId).filter(Boolean)
  if (ids.length) for (const m of await prisma.material.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, slug: true } })) materials.set(m.id, m)
  if (catIds.length) for (const c of await prisma.materialCategory.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } })) categories.set(c.id, c.name)
  return {
    yardId: yard.id, yardName: yard.name, payoutMethods: Array.isArray(yard.payoutMethods) ? yard.payoutMethods : [],
    requireGovernmentId: p.requireGovernmentId, requireIdPhoto: p.requireIdPhoto, requireSellerPhoto: p.requireSellerPhoto, requireMaterialPhoto: p.requireMaterialPhoto,
    requireVehiclePlate: p.requireVehiclePlate, requireSignature: p.requireSignature, requireThumbprint: p.requireThumbprint, minimumSellerAge: p.minimumSellerAge,
    cashLimitPerTicketCents: p.cashLimitPerTicketCents ?? null, cashLimitPerDayCents: p.cashLimitPerDayCents ?? null, cashRounding: p.cashRounding || 'none',
    defaultPaymentHoldDays: p.defaultPaymentHoldDays || 0, defaultMaterialHoldDays: p.defaultMaterialHoldDays || 0, ownershipStatement: p.ownershipStatement || '',
    restrictions: restrictions.map((r: any) => ({
      label: r.label, kind: r.kind, materialName: r.materialId ? materials.get(r.materialId)?.name || null : null, materialSlug: r.materialId ? materials.get(r.materialId)?.slug || null : null,
      categoryName: r.categoryId ? categories.get(r.categoryId) || null : null, allowedMethods: r.allowedMethods || null, requiredDocuments: r.requiredDocuments || [], forbidCash: Boolean(r.forbidCash),
      paymentHoldDays: r.paymentHoldDays ?? null, materialHoldDays: r.materialHoldDays ?? null, mailCheckOnly: Boolean(r.mailCheckOnly), publicNote: r.publicNote || '',
    })),
  }
}

/** P6: one material with prices at every public yard and its restriction notes. */
export async function publicMaterial(prisma: any, slug: string, now = new Date()) {
  const material = await prisma.material.findFirst({ where: { slug, isActive: true, isPublic: true }, include: { category: true } })
  if (!material) throw new CommandError('Material not found.', 'NOT_FOUND')
  const yards = await prisma.yard.findMany({ where: { status: 'active', acceptsPublic: true }, include: { rulesProfile: { include: { restrictions: true } } }, orderBy: { name: 'asc' } })
  const prices: any[] = []
  const notes: any[] = []
  for (const y of yards) {
    const e = await currentEntry(prisma, y.boardPriceListId, material.id, now)
    if (e?.isPublic) prices.push({ yardId: y.id, yardName: y.name, yardSlug: y.slug, unit: e.unit, unitPrice: String(e.unitPrice), unitPriceHigh: e.unitPriceHigh === null ? null : String(e.unitPriceHigh), effectiveFrom: e.effectiveFrom })
    for (const r of y.rulesProfile?.restrictions || []) {
      if (r.materialId === material.id || (r.categoryId && r.categoryId === material.categoryId)) notes.push({ yardName: y.name, label: r.label, kind: r.kind, requiredDocuments: Array.isArray(r.requiredDocuments) ? r.requiredDocuments : [], forbidCash: r.forbidCash, publicNote: r.publicNote })
    }
  }
  return {
    id: material.id, name: material.name, slug: material.slug, specName: material.specName, description: material.description, preparationTips: material.preparationTips,
    categoryName: material.category?.name || '', defaultUnit: material.defaultUnit, direction: material.direction, minimumWeight: material.minimumWeight === null ? null : String(material.minimumWeight),
    imageId: material.image_id, prices, restrictions: notes,
  }
}

/** P6: 90-day daily price history on one yard's board. */
export async function publicPriceHistory(prisma: any, input: { materialSlug: string; yard?: string | null; days?: number | null }, now = new Date()) {
  const yard = await yardBySlugOrId(prisma, input.yard)
  const material = await prisma.material.findFirst({ where: { slug: input.materialSlug, isActive: true, isPublic: true } })
  if (!material || !yard.boardPriceListId) return []
  const days = Math.min(365, Math.max(7, Math.trunc(Number(input.days || 90))))
  const since = new Date(now.getTime() - days * 86_400_000)
  const entries = await prisma.priceEntry.findMany({ where: { priceListId: yard.boardPriceListId, materialId: material.id, isPublic: true, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: since } }] }, orderBy: { effectiveFrom: 'asc' } })
  return entries.map((e: any) => ({ effectiveFrom: e.effectiveFrom, effectiveTo: e.effectiveTo, unit: e.unit, unitPrice: String(e.unitPrice), unitPriceHigh: e.unitPriceHigh === null ? null : String(e.unitPriceHigh) }))
}

/** P14, B1: listings by the market visibility setting; approved buyer contacts always see prices. */
async function viewerIsBuyer(prisma: any, session: any) {
  if (hasFlag(session, 'canManageSales')) return true
  if (!session?.itemId) return false
  return Boolean(await prisma.accountContact.findFirst({ where: { userId: session.itemId, status: 'active', account: { isBuyer: true, status: 'active' } } }))
}
function shapeListing(l: any, showPrice: boolean) {
  return {
    id: l.id, title: l.title, description: l.description, form: l.form, materialName: l.material?.name || '', materialSlug: l.material?.slug || '', yardName: l.yard?.name || '',
    photos: Array.isArray(l.photos) ? l.photos : [], availableWeight: String(l.availableWeight), minimumWeight: l.minimumWeight === null ? null : String(l.minimumWeight), unit: l.unit,
    terms: l.terms, closesAt: l.closesAt, allowOffers: l.allowOffers, buyNow: l.buyNow, askUnitPrice: showPrice && l.askUnitPrice !== null ? String(l.askUnitPrice) : null,
    unitCount: (l.units || []).length, units: showPrice ? (l.units || []).map((u: any) => ({ tagNumber: u.tagNumber, form: u.form, weight: String(u.weight) })) : [],
  }
}
export async function marketListings(prisma: any, session: any, now = new Date()) {
  const settings: any = await businessSettings(prisma)
  const buyer = await viewerIsBuyer(prisma, session)
  if (!buyer && settings.marketVisibility === 'buyers_only') return { canSeePrices: false, visible: false, listings: [] as any[] }
  const showPrice = buyer || settings.marketVisibility === 'public'
  const listings = await prisma.listing.findMany({ where: { status: 'open', OR: [{ closesAt: null }, { closesAt: { gt: now } }] }, include: { material: true, yard: true, units: { where: { status: 'available' } } }, orderBy: { createdAt: 'desc' }, take: 200 })
  return { canSeePrices: showPrice, visible: true, listings: listings.map((l: any) => shapeListing(l, showPrice)) }
}
export async function marketListing(prisma: any, session: any, id: string, now = new Date()) {
  const settings: any = await businessSettings(prisma)
  const buyer = await viewerIsBuyer(prisma, session)
  if (!buyer && settings.marketVisibility === 'buyers_only') throw new CommandError('Listing not found.', 'NOT_FOUND')
  const l = await prisma.listing.findUnique({ where: { id }, include: { material: true, yard: true, units: { where: { status: 'available' } } } })
  if (!l || l.status === 'draft' || (l.closesAt && l.closesAt <= now && l.status === 'open')) throw new CommandError('Listing not found.', 'NOT_FOUND')
  return { ...shapeListing(l, buyer || settings.marketVisibility === 'public'), status: l.status, canOffer: buyer && l.status === 'open' }
}

/** P15 */
export async function publicNonprofits(prisma: any, now = new Date()) {
  const accounts = await prisma.account.findMany({ where: { isNonprofit: true, isPublicNonprofit: true, status: 'active' }, orderBy: { name: 'asc' } })
  const campaigns = await prisma.donationCampaign.findMany({ where: { accountId: { in: accounts.map((a: any) => a.id) }, isPublic: true, status: 'active', OR: [{ endsOn: null }, { endsOn: { gt: now } }] } })
  return accounts.map((a: any) => ({ id: a.id, name: a.name, slug: a.slug, legalName: a.legalName, ein: a.ein, summary: a.nonprofitSummary, website: a.nonprofitWebsite, logoId: a.nonprofitLogo_id, campaigns: campaigns.filter((c: any) => c.accountId === a.id).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug })) }))
}
export async function publicCampaign(prisma: any, slug: string) {
  const c = await prisma.donationCampaign.findFirst({ where: { slug, isPublic: true, status: { in: ['active', 'ended'] } }, include: { account: true } })
  if (!c || !c.account?.isNonprofit) throw new CommandError('Campaign not found.', 'NOT_FOUND')
  const sums = await prisma.donation.aggregate({ where: { campaignId: c.id, status: { in: ['credited', 'disbursed'] } }, _sum: { amountCents: true, weight: true } })
  const donors = await prisma.donation.groupBy({ by: ['sellerId'], where: { campaignId: c.id, status: { in: ['credited', 'disbursed'] } } })
  return {
    id: c.id, name: c.name, slug: c.slug, description: c.description, imageId: c.image_id, status: c.status, startsOn: c.startsOn, endsOn: c.endsOn,
    goalWeight: c.goalWeight === null ? null : String(c.goalWeight), goalCents: c.goalCents, raisedCents: sums._sum.amountCents || 0, raisedWeight: String(sums._sum.weight || '0'), donorCount: donors.length,
    nonprofitName: c.account.name, nonprofitSlug: c.account.slug, nonprofitEin: c.account.ein,
  }
}

/** P17: ticket receipt by the printed number and lookup code (no sign-in; no ID data). */
export async function lookupTicketReceipt(prisma: any, input: { ticketNumber?: string; code?: string; displayNumber?: string; lookupCode?: string }) {
  const match = String(input.displayNumber || input.ticketNumber || '').trim().toUpperCase().match(/^([A-Z0-9]+)-(I|O)-0*(\d+)$/)
  const code = String(input.lookupCode || input.code || '').trim().toUpperCase()
  if (!match || code.length < 6) throw new CommandError('Ticket not found.', 'NOT_FOUND')
  const yard = await prisma.yard.findFirst({ where: { code: match[1] } })
  if (!yard) throw new CommandError('Ticket not found.', 'NOT_FOUND')
  const ticket = await prisma.scaleTicket.findFirst({ where: { yardId: yard.id, direction: match[2] === 'I' ? 'inbound' : 'outbound', number: Number(match[3]), lookupCode: code } })
  if (!ticket) throw new CommandError('Ticket not found.', 'NOT_FOUND')
  return ticketReceipt(prisma, ticket.id)
}

/** Shared receipt shape for P17, S8, S9, C3. Never includes ID numbers or images of the seller. */
export async function ticketReceipt(prisma: any, ticketId: string) {
  const t = await prisma.scaleTicket.findUnique({
    where: { id: ticketId },
    include: { yard: true, seller: true, account: true, lines: { orderBy: { sortOrder: 'asc' } }, payouts: { orderBy: { createdAt: 'asc' } }, holdTags: true, adjustments: { select: { id: true, number: true, status: true, totalCents: true } }, adjusts: { select: { id: true, number: true } }, attachments: { where: { kind: { in: ['material_photo'] } } } },
  })
  if (!t) return null
  const now = new Date()
  const settings: any = await businessSettings(prisma)
  const num = (n: number, dir: string) => `${t.yard.code}-${dir === 'outbound' ? 'O' : 'I'}-${String(n).padStart(6, '0')}`
  return {
    id: t.id, displayNumber: num(t.number, t.direction), direction: t.direction, status: t.status, yardName: t.yard.name, yardAddress: [t.yard.addressLine1, t.yard.city, t.yard.region].filter(Boolean).join(', '),
    sellerName: t.seller ? `${t.seller.firstName} ${t.seller.lastName}` : null, accountName: t.account?.name || null, vehiclePlate: t.vehiclePlate, completedAt: t.completedAt, createdAt: t.createdAt,
    businessName: settings.name || '', weightUnit: settings.weightUnit || 'lb', paymentMode: t.paymentMode, donatePercent: t.donatePercent,
    lines: t.lines.map((l: any) => ({ id: l.id, materialName: l.materialName, grossWeight: String(l.grossWeight), tareWeight: String(l.tareWeight), netWeight: String(l.netWeight), deductionWeight: String(l.deductionWeight), deductionPercent: String(l.deductionPercent), deductionReason: l.deductionReason, payWeight: String(l.payWeight), quantity: l.quantity, unit: l.unit, unitPrice: String(l.unitPrice), amountCents: l.amountCents, direction: l.direction })),
    fees: (Array.isArray(t.fees) ? t.fees : []).map((f: any) => ({ label: f.label, amountCents: f.amountCents })),
    materialTotalCents: t.materialTotalCents, feeTotalCents: t.feeTotalCents, taxCents: t.taxCents, totalCents: t.totalCents,
    payouts: t.payouts.map((p: any) => ({ id: p.id, amountCents: p.amountCents, status: p.status === 'held' && p.releaseAt && new Date(p.releaseAt) <= now ? 'ready' : p.status, method: p.method, allowedMethods: p.allowedMethods || [], releaseAt: p.releaseAt, checkNumber: p.checkNumber, paidAt: p.paidAt, returnReason: p.returnReason })),
    holds: t.holdTags.filter((h: any) => h.status !== 'cancelled').map((h: any) => ({ id: h.id, status: h.status === 'police_hold' ? 'held' : h.status, releaseAt: h.status === 'police_hold' ? null : h.releaseAt, weight: String(h.weight) })),
    adjustments: t.adjustments.map((a: any) => ({ id: a.id, displayNumber: num(a.number, 'inbound'), status: a.status, totalCents: a.totalCents })),
    adjustsDisplayNumber: t.adjusts ? num(t.adjusts.number, 'inbound') : null, photoIds: t.attachments.map((a: any) => a.image_id).filter(Boolean),
  }
}

export const publicTypeDefs = `
  type PublicYardSummary { id: ID!, name: String!, slug: String!, code: String!, addressLine1: String, city: String, region: String, timezone: String }
  type PublicPriceItem { materialId: ID!, materialName: String!, materialSlug: String!, specName: String, categoryName: String, categorySlug: String, categorySortOrder: Int, imageUrl: String, direction: String!, unit: String!, unitPrice: String!, unitPriceHigh: String, effectiveFrom: DateTime, minimumWeight: String }
  type PublicPriceBoard { yard: PublicYardSummary!, publishedAt: DateTime, currencyCode: String!, weightUnit: String!, items: [PublicPriceItem!]!, entries: [PublicPriceItem!]! }
  type PublicRestriction { label: String, kind: String!, materialName: String, materialSlug: String, categoryName: String, allowedMethods: [String!], requiredDocuments: [String!]!, forbidCash: Boolean!, paymentHoldDays: Int, materialHoldDays: Int, mailCheckOnly: Boolean!, publicNote: String }
  type PublicYardRules {
    yardId: ID!, yardName: String!, payoutMethods: [String!]!, requireGovernmentId: Boolean!, requireIdPhoto: Boolean!, requireSellerPhoto: Boolean!, requireMaterialPhoto: Boolean!,
    requireVehiclePlate: Boolean!, requireSignature: Boolean!, requireThumbprint: Boolean!, minimumSellerAge: Int!, cashLimitPerTicketCents: Int, cashLimitPerDayCents: Int, cashRounding: String!,
    defaultPaymentHoldDays: Int!, defaultMaterialHoldDays: Int!, ownershipStatement: String, restrictions: [PublicRestriction!]!
  }
  type PublicMaterialPrice { yardId: ID!, yardName: String!, yardSlug: String!, unit: String!, unitPrice: String!, unitPriceHigh: String, effectiveFrom: DateTime }
  type PublicMaterialRestriction { yardName: String!, label: String, kind: String!, requiredDocuments: [String!]!, forbidCash: Boolean!, publicNote: String }
  type PublicMaterial { id: ID!, name: String!, slug: String!, specName: String, description: String, preparationTips: String, categoryName: String, defaultUnit: String!, direction: String!, minimumWeight: String, imageId: String, prices: [PublicMaterialPrice!]!, restrictions: [PublicMaterialRestriction!]! }
  type PublicPricePoint { effectiveFrom: DateTime!, effectiveTo: DateTime, unit: String!, unitPrice: String!, unitPriceHigh: String }
  type MarketUnit { tagNumber: String!, form: String!, weight: String! }
  type MarketListing { id: ID!, title: String!, description: String, form: String!, materialName: String!, materialSlug: String, yardName: String, photos: JSON, availableWeight: String!, minimumWeight: String, unit: String!, terms: String!, closesAt: DateTime, allowOffers: Boolean!, buyNow: Boolean!, askUnitPrice: String, unitCount: Int!, units: [MarketUnit!]!, status: String, canOffer: Boolean }
  type MarketListingsResult { visible: Boolean!, canSeePrices: Boolean!, listings: [MarketListing!]! }
  type PublicCampaignRef { id: ID!, name: String!, slug: String! }
  type PublicNonprofit { id: ID!, name: String!, slug: String!, legalName: String, ein: String, summary: String, website: String, logoId: String, campaigns: [PublicCampaignRef!]! }
  type PublicCampaign { id: ID!, name: String!, slug: String!, description: String, imageId: String, status: String!, startsOn: DateTime, endsOn: DateTime, goalWeight: String, goalCents: Int, raisedCents: Int!, raisedWeight: String!, donorCount: Int!, nonprofitName: String!, nonprofitSlug: String!, nonprofitEin: String }
  type ReceiptLine { id: ID!, materialName: String!, grossWeight: String!, tareWeight: String!, netWeight: String!, deductionWeight: String!, deductionPercent: String!, deductionReason: String, payWeight: String!, quantity: Int, unit: String!, unitPrice: String!, amountCents: Int!, direction: String! }
  type ReceiptFee { label: String!, amountCents: Int! }
  type ReceiptPayout { id: ID!, amountCents: Int!, status: String!, method: String, allowedMethods: [String!]!, releaseAt: DateTime, checkNumber: String, paidAt: DateTime, returnReason: String }
  type ReceiptHold { id: ID!, status: String!, releaseAt: DateTime, weight: String! }
  type ReceiptAdjustment { id: ID!, displayNumber: String!, status: String!, totalCents: Int! }
  type TicketReceipt {
    id: ID!, displayNumber: String!, direction: String!, status: String!, yardName: String!, yardAddress: String, sellerName: String, accountName: String, vehiclePlate: String, completedAt: DateTime, createdAt: DateTime,
    businessName: String, weightUnit: String!, paymentMode: String!, donatePercent: Int, lines: [ReceiptLine!]!, fees: [ReceiptFee!]!, materialTotalCents: Int!, feeTotalCents: Int!, taxCents: Int!, totalCents: Int!,
    payouts: [ReceiptPayout!]!, holds: [ReceiptHold!]!, adjustments: [ReceiptAdjustment!]!, adjustsDisplayNumber: String, photoIds: [String!]!
  }
  type PublicBusiness { logoUrl: String, timezone: String!, name: String!, legalName: String, about: String, supportEmail: String, supportPhone: String, isNonprofit: Boolean!, ein: String, weightUnit: String!, currencyCode: String!, marketVisibility: String! }
`
export const publicQueryDefs = `
  publicPriceBoard(yardSlug: String, yard: String): PublicPriceBoard
  publicYardRules(yardSlug: String, yard: String): PublicYardRules
  publicMaterial(slug: String!): PublicMaterial
  publicPriceHistory(materialSlug: String!, yardSlug: String, yard: String, days: Int): [PublicPricePoint!]!
  marketListings: MarketListingsResult!
  marketListing(id: ID!): MarketListing
  publicNonprofits: [PublicNonprofit!]!
  publicCampaign(slug: String!): PublicCampaign
  lookupTicketReceipt(displayNumber: String, lookupCode: String, ticketNumber: String, code: String): TicketReceipt
  publicBusiness: PublicBusiness!
  myDonationReceipt(donationId: ID!): DonationReceipt
`

export const publicResolvers = {
  Query: {
    publicPriceBoard: async (_: unknown, a: any, c: any) => {
      const board = await publicPriceBoard(db(c), a.yardSlug ?? a.yard)
      const ids = board.items.map((i: any) => i.materialId)
      if (ids.length) {
        const rows = await c.sudo().query.Material.findMany({ where: { id: { in: ids } }, query: 'id image { url }' })
        const urls = new Map(rows.map((r: any) => [r.id, r.image?.url || null]))
        for (const i of board.items) i.imageUrl = urls.get(i.materialId) || null
      }
      return board
    },
    publicYardRules: (_: unknown, a: any, c: any) => publicYardRules(db(c), a.yardSlug ?? a.yard),
    publicMaterial: (_: unknown, a: any, c: any) => publicMaterial(db(c), a.slug),
    publicPriceHistory: (_: unknown, a: any, c: any) => publicPriceHistory(db(c), { ...a, yard: a.yardSlug ?? a.yard }),
    marketListings: (_: unknown, _a: any, c: any) => marketListings(db(c), c.session),
    marketListing: (_: unknown, a: any, c: any) => marketListing(db(c), c.session, a.id),
    publicNonprofits: (_: unknown, _a: any, c: any) => publicNonprofits(db(c)),
    publicCampaign: (_: unknown, a: any, c: any) => publicCampaign(db(c), a.slug),
    lookupTicketReceipt: (_: unknown, a: any, c: any) => lookupTicketReceipt(db(c), a),
    publicBusiness: async (_: unknown, _a: any, c: any) => {
      const s: any = await businessSettings(db(c))
      const withLogo: any = s.id ? await c.sudo().query.BusinessSettings.findOne({ where: { id: s.id }, query: 'logo { url }' }).catch(() => null) : null
      return { logoUrl: withLogo?.logo?.url || null, timezone: s.timezone || 'America/New_York', name: s.name || '', legalName: s.legalName || '', about: s.about || '', supportEmail: s.supportEmail || '', supportPhone: s.supportPhone || '', isNonprofit: Boolean(s.isNonprofit), ein: s.isNonprofit ? s.ein || '' : '', weightUnit: s.weightUnit || 'lb', currencyCode: s.currencyCode || 'USD', marketVisibility: s.marketVisibility || 'public_without_prices' }
    },
    myDonationReceipt: async (_: unknown, a: any, c: any) => {
      if (!c.session?.itemId) throw new CommandError('Sign in first.', 'UNAUTHENTICATED')
      const prisma = db(c)
      const d = await prisma.donation.findUnique({ where: { id: a.donationId }, include: { seller: true } })
      const staff = isStaff(c.session) && (hasFlag(c.session, 'canManageAccounts') || hasFlag(c.session, 'canManageFinance'))
      if (!d || (!staff && d.seller?.userId !== c.session.itemId)) throw new CommandError('Donation not found.', 'NOT_FOUND')
      return donationReceipt(prisma, d.id)
    },
  },
}

