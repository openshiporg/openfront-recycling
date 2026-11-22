import { Decimal } from 'decimal.js'
import { CommandError, cleanKey, compareAndSet, refuse, runCommand, type CommandCtx, type Tx } from '../lib/command'
import { businessSettings, currentIdentity, normalizeName, randomCode, refreshDuePayouts, yardRules } from '../lib/domain'
import { formatTicketNumber } from '../models/tickets'
import { toCsv } from '../../recycling/csv'
import { visitExpiresAt } from './tickets'
import { donationReceipt } from './nonprofits'
import { ticketReceipt } from './storefront-public'

/**
 * Signed-in seller operations (dissertation §8.2). Every operation finds the Seller whose `user` is the
 * session user and reads or writes only that seller's rows; anything else answers NOT_FOUND, so a
 * seller cannot learn whether another seller's record exists (§7.3).
 */

const db = (c: any) => c.sudo().prisma
const DAY = 86_400_000
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PAYOUT_METHODS = ['cash', 'check', 'transfer']
const VEHICLE_KINDS = ['car', 'pickup', 'box_truck', 'trailer', 'roll_off', 'semi', 'other']
const ID_KINDS = ['drivers_license', 'state_id', 'passport', 'military_id', 'other']
const notFound = (what: string): never => { throw new CommandError(`${what} not found.`, 'NOT_FOUND') }
const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

function requireUser(c: any): string {
  const id = c.session?.itemId
  if (!id) throw new CommandError('Sign in first.', 'UNAUTHENTICATED')
  return id
}

export async function sellerForUser(tx: Tx, userId: string) {
  return tx.seller.findFirst({ where: { userId } })
}

async function requireSeller(tx: Tx, userId: string | null) {
  if (!userId) throw new CommandError('Sign in first.', 'UNAUTHENTICATED')
  const seller = await sellerForUser(tx, userId)
  if (!seller) refuse('Add your name and date of birth on your profile first.')
  return seller
}

/** A date-only string (YYYY-MM-DD) at UTC midnight; dates with times keep their day. */
function dayOf(value: string) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) refuse('Enter the date as YYYY-MM-DD.')
  const d = new Date(Date.UTC(Number(m![1]), Number(m![2]) - 1, Number(m![3])))
  if (Number.isNaN(d.getTime())) refuse('Enter a real date.')
  return d
}

/** Today's date in a time zone, at UTC midnight. */
function todayIn(timezone: string | null | undefined, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
    return dayOf(parts)
  } catch {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  }
}

// ---------------------------------------------------------------------------------------------
// P18 registerCustomer
// ---------------------------------------------------------------------------------------------

/** A customer login with no staff role. The password is hashed by Keystone's password field. */
export async function registerCustomer(c: any, input: { name: string; email: string; phone?: string | null; password: string }) {
  const name = text(input.name, 120)
  const email = text(input.email, 254).toLowerCase()
  const phone = text(input.phone, 40)
  const password = String(input.password || '')
  if (name.length < 2) refuse('Enter your full name.')
  if (!EMAIL.test(email)) refuse('Enter a valid email address.')
  if (password.length < 10) refuse('Choose a password of at least 10 characters.')
  if (password.length > 200) refuse('Choose a shorter password.')
  const prisma = db(c)
  if (await prisma.user.findFirst({ where: { email } })) refuse('An account already uses this email. Sign in, or reset your password.')
  try {
    const user = await c.sudo().db.User.createOne({ data: { name, email, phone, password } })
    await prisma.auditEvent.create({ data: { eventKey: `registerCustomer:${user.id}`, eventType: 'customer.registered', aggregateType: 'User', aggregateId: user.id, actorId: user.id, reason: '', occurredAt: new Date() } })
    return { id: user.id, name: user.name, email: user.email }
  } catch (error: any) {
    if (/unique/i.test(String(error?.message || '')) || error?.code === 'P2002') refuse('An account already uses this email. Sign in, or reset your password.')
    throw error
  }
}

// ---------------------------------------------------------------------------------------------
// S2 profile
// ---------------------------------------------------------------------------------------------

type ProfileInput = {
  firstName: string; lastName: string; dateOfBirth?: string | null; phone?: string | null; email?: string | null; addressLine1?: string | null; addressLine2?: string | null;
  city?: string | null; region?: string | null; postalCode?: string | null; preferredPayout?: string | null; defaultNonprofitId?: string | null
}

export async function upsertMySellerProfileTx(ctx: CommandCtx, input: ProfileInput) {
  const { tx } = ctx
  const firstName = text(input.firstName, 80)
  const lastName = text(input.lastName, 80)
  if (!firstName || !lastName) refuse('Enter your first and last name as they appear on your ID.')
  let dateOfBirth: Date | null = null
  if (input.dateOfBirth) {
    dateOfBirth = dayOf(input.dateOfBirth)
    const age = (ctx.now.getTime() - dateOfBirth.getTime()) / (365.25 * DAY)
    if (age < 0 || age > 120) refuse('Enter your real date of birth.')
  }
  const preferredPayout = input.preferredPayout || 'cash'
  if (!PAYOUT_METHODS.includes(preferredPayout)) refuse('Choose cash, check or transfer.')
  const email = text(input.email, 254).toLowerCase()
  if (email && !EMAIL.test(email)) refuse('Enter a valid email address.')
  let defaultNonprofitId: string | null | undefined = undefined
  if (input.defaultNonprofitId !== undefined) {
    defaultNonprofitId = input.defaultNonprofitId || null
    if (defaultNonprofitId) {
      const np = await tx.account.findUnique({ where: { id: defaultNonprofitId } })
      if (!np?.isNonprofit || !np.isPublicNonprofit || np.status !== 'active') refuse('Choose one of the partner nonprofits.')
    }
  }
  const data: Record<string, unknown> = {
    firstName, lastName, searchName: normalizeName(firstName, lastName), phone: text(input.phone, 40), email, addressLine1: text(input.addressLine1), addressLine2: text(input.addressLine2),
    city: text(input.city, 100), region: text(input.region, 100), postalCode: text(input.postalCode, 20), preferredPayout,
  }
  if (dateOfBirth) data.dateOfBirth = dateOfBirth
  if (defaultNonprofitId !== undefined) data.defaultNonprofitId = defaultNonprofitId

  const existing = await sellerForUser(tx, ctx.actorId!)
  if (!existing) {
    if (!dateOfBirth) refuse('Enter your date of birth. Yards must check sellers are old enough.')
    const seller = await tx.seller.create({ data: { ...data, userId: ctx.actorId, status: 'active', idVerification: 'unverified' } })
    await ctx.audit({ eventType: 'seller.registered', aggregateType: 'Seller', aggregateId: seller.id, after: { firstName, lastName } })
    return seller
  }
  // Once staff have checked the physical ID, the name and date of birth are the ID's; only staff change them.
  if (existing.idVerification === 'verified') {
    const sameDob = !dateOfBirth || !existing.dateOfBirth || new Date(existing.dateOfBirth).getTime() === dateOfBirth.getTime()
    if (existing.firstName !== firstName || existing.lastName !== lastName || !sameDob) refuse('The yard has checked your ID, so your name and date of birth are locked. Ask the yard to change them.')
  }
  await tx.seller.update({ where: { id: existing.id }, data })
  await ctx.audit({ eventType: 'seller.profile_updated', aggregateType: 'Seller', aggregateId: existing.id })
  return tx.seller.findUnique({ where: { id: existing.id } })
}

function shapeSeller(s: any) {
  if (!s) return null
  return {
    id: s.id, firstName: s.firstName, lastName: s.lastName, status: s.status, idVerification: s.idVerification, preferredPayout: s.preferredPayout, phone: s.phone || null, email: s.email || null,
    dateOfBirth: s.dateOfBirth ? new Date(s.dateOfBirth).toISOString().slice(0, 10) : null, addressLine1: s.addressLine1 || null, addressLine2: s.addressLine2 || null, city: s.city || null,
    region: s.region || null, postalCode: s.postalCode || null, defaultNonprofitId: s.defaultNonprofitId || null,
  }
}

// ---------------------------------------------------------------------------------------------
// S3 identity
// ---------------------------------------------------------------------------------------------

/** Mark earlier documents not current and send the seller back to unverified (staff check the new card). */
async function afterIdentitySubmitted(ctx: CommandCtx, sellerId: string, docId: string) {
  const doc = await ctx.tx.identityDocument.findUnique({ where: { id: docId } })
  if (!doc || doc.sellerId !== sellerId) refuse('ID not found.')
  await ctx.tx.identityDocument.updateMany({ where: { sellerId, id: { not: docId }, isCurrent: true }, data: { isCurrent: false } })
  await ctx.tx.seller.update({ where: { id: sellerId }, data: { idVerification: 'unverified' } })
  await ctx.audit({ eventType: 'seller.id_submitted', aggregateType: 'IdentityDocument', aggregateId: docId, after: { kind: doc.kind, expiresOn: doc.expiresOn } })
  return { id: docId }
}

export async function submitMyIdentityDocument(c: any, input: { kind: string; number: string; issuer?: string | null; expiresOn: string; frontImage?: any; backImage?: any }) {
  const userId = requireUser(c)
  const seller = await requireSeller(db(c), userId)
  const kind = input.kind || 'drivers_license'
  if (!ID_KINDS.includes(kind)) refuse('Choose the kind of ID.')
  const number = text(input.number, 40)
  if (number.replace(/[^a-z0-9]/gi, '').length < 4) refuse('Enter the ID number.')
  if (!input.expiresOn) refuse('Enter the expiry date printed on the ID.')
  const expiresOn = dayOf(input.expiresOn)
  if (expiresOn.getTime() < todayIn(null).getTime()) refuse('This ID has expired. Yards cannot buy from an expired ID; add a current one.')
  const recent = await db(c).identityDocument.count({ where: { sellerId: seller.id, createdAt: { gt: new Date(Date.now() - DAY) } } })
  if (recent >= 5) refuse('You have added several IDs today. Ask the yard for help.')
  const data: Record<string, unknown> = { seller: { connect: { id: seller.id } }, kind, number, issuer: text(input.issuer, 80), expiresOn, isCurrent: true }
  if (input.frontImage?.upload) data.frontImage = { upload: input.frontImage.upload }
  if (input.backImage?.upload) data.backImage = { upload: input.backImage.upload }
  // The images go through Keystone's image field (storage config), then the command flips the old documents.
  const doc = await c.sudo().db.IdentityDocument.createOne({ data })
  await runCommand(c, { name: 'submitMyIdentityDocument', input: { docId: doc.id }, requireSignIn: true }, (ctx) => afterIdentitySubmitted(ctx, seller.id, doc.id))
  return { id: doc.id, kind, issuer: data.issuer, last4: number.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase(), expiresOn, isCurrent: true, verified: false }
}

export async function myIdentityStatus(prisma: any, userId: string, now = new Date()) {
  const seller = await sellerForUser(prisma, userId)
  if (!seller) return { status: 'missing', documents: [] as any[] }
  const docs = await prisma.identityDocument.findMany({ where: { sellerId: seller.id }, orderBy: [{ isCurrent: 'desc' }, { createdAt: 'desc' }], take: 20 })
  const current = docs.find((d: any) => d.isCurrent)
  const expired = current?.expiresOn && new Date(current.expiresOn) < now
  const status = !current ? 'missing' : expired ? 'expired' : seller.idVerification === 'verified' ? 'verified' : 'on_file'
  return {
    status,
    documents: docs.map((d: any) => ({
      id: d.id, kind: d.kind, issuer: d.issuer || null, last4: String(d.numberNormalized || d.number || '').slice(-4) || null, expiresOn: d.expiresOn, isCurrent: d.isCurrent,
      verified: Boolean(d.verifiedAt), expired: Boolean(d.expiresOn && new Date(d.expiresOn) < now), hasFrontImage: Boolean(d.frontImage_id), hasBackImage: Boolean(d.backImage_id),
    })),
  }
}

// ---------------------------------------------------------------------------------------------
// S4 vehicles
// ---------------------------------------------------------------------------------------------

type VehicleInput = { plate: string; plateRegion?: string | null; make?: string | null; model?: string | null; color?: string | null; kind?: string | null }

export async function upsertMyVehicleTx(ctx: CommandCtx, id: string | null | undefined, input: VehicleInput) {
  const seller = await requireSeller(ctx.tx, ctx.actorId)
  const plate = text(input.plate, 16).replace(/\s+/g, '').toUpperCase()
  if (plate.length < 2) refuse('Enter the licence plate.')
  const kind = input.kind || 'pickup'
  if (!VEHICLE_KINDS.includes(kind)) refuse('Choose the kind of vehicle.')
  const data = { plate, plateRegion: text(input.plateRegion, 40).toUpperCase(), make: text(input.make, 60), model: text(input.model, 60), color: text(input.color, 40), kind }
  if (id) {
    const v = await ctx.tx.vehicle.findUnique({ where: { id } })
    if (!v || v.sellerId !== seller.id || v.isRemoved) notFound('Vehicle')
    await ctx.tx.vehicle.update({ where: { id }, data })
    await ctx.audit({ eventType: 'vehicle.updated', aggregateType: 'Vehicle', aggregateId: id, after: data })
    return ctx.tx.vehicle.findUnique({ where: { id } })
  }
  const dup = await ctx.tx.vehicle.findFirst({ where: { sellerId: seller.id, plate, isRemoved: false } })
  if (dup) refuse('This vehicle is already on your account.')
  const count = await ctx.tx.vehicle.count({ where: { sellerId: seller.id, isRemoved: false } })
  if (count >= 20) refuse('You have 20 vehicles on file. Remove one first.')
  const v = await ctx.tx.vehicle.create({ data: { ...data, sellerId: seller.id } })
  await ctx.audit({ eventType: 'vehicle.added', aggregateType: 'Vehicle', aggregateId: v.id, after: data })
  return v
}

/** Removed vehicles stay on old tickets; they just leave the seller's list. */
export async function removeMyVehicleTx(ctx: CommandCtx, id: string) {
  const seller = await requireSeller(ctx.tx, ctx.actorId)
  const v = await ctx.tx.vehicle.findUnique({ where: { id } })
  if (!v || v.sellerId !== seller.id || v.isRemoved) notFound('Vehicle')
  await ctx.tx.vehicle.update({ where: { id }, data: { isRemoved: true } })
  await ctx.tx.visit.updateMany({ where: { vehicleId: id, status: 'booked' }, data: { vehicleId: null } })
  await ctx.audit({ eventType: 'vehicle.removed', aggregateType: 'Vehicle', aggregateId: id })
  return { ...v, isRemoved: true }
}

const shapeVehicle = (v: any) => (v ? { id: v.id, plate: v.plate || null, plateRegion: v.plateRegion || null, make: v.make || null, model: v.model || null, color: v.color || null, kind: v.kind } : null)

// ---------------------------------------------------------------------------------------------
// S5, S6 visits
// ---------------------------------------------------------------------------------------------

type VisitInput = {
  yardSlug: string; plannedDate: string; vehicleId?: string | null; expectedItems?: Array<{ materialId: string; estimatedWeight?: string | null }> | null;
  donatePercent?: number | null; nonprofitId?: string | null; campaignId?: string | null
}

export async function createMyVisitTx(ctx: CommandCtx, input: VisitInput) {
  const { tx } = ctx
  const seller = await requireSeller(tx, ctx.actorId)
  if (seller.status === 'do_not_buy') refuse('The yard cannot book a visit for you online. Please call the yard.')
  const yard = await tx.yard.findFirst({ where: { OR: [{ slug: String(input.yardSlug || '') }, { id: String(input.yardSlug || '') }], status: 'active' } })
  if (!yard) refuse('Choose a yard.')
  if (!yard.acceptsPublic) refuse('This yard does not buy from the public.')
  const planned = dayOf(input.plannedDate)
  const today = todayIn(yard.timezone, ctx.now)
  if (planned.getTime() < today.getTime()) refuse('Choose today or a later day.')
  if (planned.getTime() > today.getTime() + 30 * DAY) refuse('Choose a day within the next 30 days.')
  const closure = await tx.yardClosure.findFirst({ where: { yardId: yard.id, isPartial: false, date: { gte: planned, lt: new Date(planned.getTime() + DAY) } } })
  if (closure) refuse(`The yard is closed that day${closure.reason ? ` (${closure.reason})` : ''}. Choose another day.`)

  // ID: the yard's rules say whether one is needed; a current, unexpired ID must be on file.
  const { profile } = await yardRules(tx, yard.id)
  if (profile.requireGovernmentId) {
    const id = await currentIdentity(tx, seller.id)
    if (!id) refuse('This yard needs a government ID. Add your ID on the Identity page first.')
    if (id.expiresOn && new Date(id.expiresOn) < ctx.now) refuse('Your ID on file has expired. Add a current ID first.')
  }
  let vehicleId: string | null = input.vehicleId || null
  if (vehicleId) {
    const v = await tx.vehicle.findUnique({ where: { id: vehicleId } })
    if (!v || v.sellerId !== seller.id || v.isRemoved) refuse('Choose one of your vehicles.')
  } else if (profile.requireVehiclePlate) {
    const any = await tx.vehicle.count({ where: { sellerId: seller.id, isRemoved: false } })
    if (!any) refuse('This yard records the vehicle plate. Add your vehicle first.')
  }
  const items = Array.isArray(input.expectedItems) ? input.expectedItems.slice(0, 40) : []
  const expected: any[] = []
  if (items.length) {
    const ids = [...new Set(items.map((i) => String(i.materialId || '')))].filter(Boolean)
    const materials = await tx.material.findMany({ where: { id: { in: ids }, isActive: true, isPublic: true } })
    const byId = new Map(materials.map((m: any) => [m.id, m]))
    for (const item of items) {
      const m: any = byId.get(String(item.materialId))
      if (!m) refuse('One of the materials is not bought here.')
      let w: string | null = null
      if (item.estimatedWeight !== null && item.estimatedWeight !== undefined && String(item.estimatedWeight).trim() !== '') {
        const d = new Decimal(String(item.estimatedWeight).trim())
        if (!d.isFinite() || d.lte(0) || d.gt(1_000_000)) refuse('Enter a rough weight above zero.')
        w = d.toDecimalPlaces(2).toString()
      }
      expected.push({ materialId: m.id, materialName: m.name, unit: m.defaultUnit, estimatedWeight: w })
    }
  }
  // Donation choice (§4.8). A campaign names its nonprofit.
  const donatePercent = Math.trunc(Number(input.donatePercent || 0))
  if (donatePercent < 0 || donatePercent > 100) refuse('Choose a donation share from 0 to 100 percent.')
  let nonprofitId: string | null = null
  let campaignId: string | null = null
  if (donatePercent > 0) {
    if (input.campaignId) {
      const camp = await tx.donationCampaign.findUnique({ where: { id: input.campaignId } })
      if (!camp || !camp.isPublic || camp.status !== 'active' || (camp.endsOn && new Date(camp.endsOn) <= ctx.now)) refuse('That campaign is not running.')
      campaignId = camp.id
      nonprofitId = camp.accountId
    } else nonprofitId = input.nonprofitId || seller.defaultNonprofitId || null
    if (nonprofitId) {
      const np = await tx.account.findUnique({ where: { id: nonprofitId } })
      if (!np?.isNonprofit || !np.isPublicNonprofit || np.status !== 'active') refuse('Choose one of the partner nonprofits.')
    } else {
      const settings: any = await businessSettings(tx)
      if (!settings.isNonprofit) refuse('Choose the nonprofit or campaign that receives your donation.')
    }
  }
  const open = await tx.visit.count({ where: { sellerId: seller.id, status: 'booked', plannedDate: { gte: today } } })
  if (open >= 5) refuse('You already have 5 visits booked. Cancel one first.')

  let code = ''
  for (let i = 0; i < 6 && !code; i++) {
    const c = randomCode(6)
    if (!(await tx.visit.findUnique({ where: { code: c } }))) code = c
  }
  if (!code) refuse('Please try again.')
  const visit = await tx.visit.create({ data: { sellerId: seller.id, yardId: yard.id, plannedDate: planned, vehicleId, expectedItems: expected, donatePercent, nonprofitId, campaignId, code, status: 'booked' } })
  await ctx.audit({ eventType: 'visit.booked', aggregateType: 'Visit', aggregateId: visit.id, yardId: yard.id, after: { plannedDate: planned, items: expected.length, donatePercent } })
  return visit
}

export async function cancelMyVisitTx(ctx: CommandCtx, id: string) {
  const seller = await requireSeller(ctx.tx, ctx.actorId)
  const v = await ctx.tx.visit.findUnique({ where: { id } })
  if (!v || v.sellerId !== seller.id) notFound('Visit')
  if (v.status === 'booked' && visitExpiresAt(v.plannedDate) <= ctx.now) {
    await ctx.tx.visit.updateMany({ where: { id, status: 'booked' }, data: { status: 'expired' } })
    refuse('This visit has already expired.')
  }
  await compareAndSet(ctx.tx, 'visit', id, 'booked', { status: 'cancelled' }, v.status === 'arrived' ? 'You have already checked in with this visit.' : `This visit is ${v.status}.`)
  await ctx.audit({ eventType: 'visit.cancelled', aggregateType: 'Visit', aggregateId: id, yardId: v.yardId })
  return ctx.tx.visit.findUnique({ where: { id } })
}

/** A booked visit past its day plus one reads as expired (§5.12, time comparison at read). */
async function shapeVisit(prisma: any, v: any, now = new Date()) {
  if (!v) return null
  const expiresAt = visitExpiresAt(new Date(v.plannedDate))
  let status = v.status
  if (status === 'booked' && expiresAt <= now) {
    await prisma.visit.updateMany({ where: { id: v.id, status: 'booked' }, data: { status: 'expired' } })
    status = 'expired'
  }
  const yard = v.yard || (v.yardId ? await prisma.yard.findUnique({ where: { id: v.yardId } }) : null)
  const vehicle = v.vehicle || (v.vehicleId ? await prisma.vehicle.findUnique({ where: { id: v.vehicleId } }) : null)
  const nonprofit = v.nonprofitId ? await prisma.account.findUnique({ where: { id: v.nonprofitId }, select: { name: true } }) : null
  const campaign = v.campaignId ? await prisma.donationCampaign.findUnique({ where: { id: v.campaignId }, select: { name: true } }) : null
  const ticket = await prisma.scaleTicket.findFirst({ where: { visitId: v.id }, select: { id: true } })
  return {
    id: v.id, code: v.code, status, plannedDate: new Date(v.plannedDate).toISOString().slice(0, 10), expiresAt, donatePercent: v.donatePercent || 0,
    nonprofitName: nonprofit?.name || null, campaignName: campaign?.name || null, ticketId: ticket?.id || null, createdAt: v.createdAt,
    yard: yard ? { id: yard.id, name: yard.name, slug: yard.slug, timezone: yard.timezone || null, addressLine1: yard.addressLine1 || null, city: yard.city || null, region: yard.region || null, phone: yard.phone || null } : null,
    vehicle: vehicle ? { id: vehicle.id, plate: vehicle.plate || null, make: vehicle.make || null, model: vehicle.model || null } : null,
    expectedItems: Array.isArray(v.expectedItems) ? v.expectedItems : [],
  }
}

export async function myVisits(prisma: any, userId: string, now = new Date()) {
  const seller = await sellerForUser(prisma, userId)
  if (!seller) return []
  const rows = await prisma.visit.findMany({ where: { sellerId: seller.id }, include: { yard: true, vehicle: true }, orderBy: [{ plannedDate: 'desc' }, { createdAt: 'desc' }], take: 100 })
  return Promise.all(rows.map((v: any) => shapeVisit(prisma, v, now)))
}

export async function myVisit(prisma: any, userId: string, id: string, now = new Date()) {
  const seller = await sellerForUser(prisma, userId)
  const v = seller ? await prisma.visit.findUnique({ where: { id }, include: { yard: true, vehicle: true } }) : null
  if (!v || v.sellerId !== seller.id) notFound('Visit')
  return shapeVisit(prisma, v, now)
}

// ---------------------------------------------------------------------------------------------
// S7 to S12 tickets and payouts
// ---------------------------------------------------------------------------------------------

function effectivePayoutStatus(p: any, now: Date) {
  return p.status === 'held' && p.releaseAt && new Date(p.releaseAt) <= now ? 'ready' : p.status
}

/** One word for the ticket's money: what the seller most needs to know. */
function payoutSummary(ticket: any, now: Date) {
  if (ticket.totalCents < 0) {
    const inv = (ticket.invoices || [])[0]
    if (!inv) return null
    return inv.status === 'paid' ? 'paid' : 'amount_due'
  }
  const live = (ticket.payouts || []).filter((p: any) => p.status !== 'cancelled').map((p: any) => effectivePayoutStatus(p, now))
  if (!live.length) return ticket.paymentMode === 'on_account' ? 'on_account' : null
  for (const s of ['returned', 'held', 'ready', 'pending']) if (live.includes(s)) return s
  return 'paid'
}

export async function myTickets(prisma: any, userId: string, args: { status?: string | null; from?: string | null; to?: string | null; take?: number | null; skip?: number | null }, now = new Date()) {
  const settings: any = await businessSettings(prisma)
  const seller = await sellerForUser(prisma, userId)
  if (!seller) return { count: 0, currencyCode: settings.currencyCode || 'USD', items: [] }
  await refreshDuePayouts(prisma, now)
  const where: any = { sellerId: seller.id, direction: 'inbound' }
  if (args.status) {
    if (!['open', 'completed', 'settled', 'voided'].includes(args.status)) refuse('Choose open, completed, settled or voided.')
    where.status = args.status
  }
  if (args.from || args.to) {
    where.createdAt = {}
    if (args.from) where.createdAt.gte = dayOf(args.from)
    if (args.to) where.createdAt.lt = new Date(dayOf(args.to).getTime() + DAY)
  }
  const take = Math.min(100, Math.max(1, Math.trunc(Number(args.take ?? 20))))
  const skip = Math.max(0, Math.trunc(Number(args.skip ?? 0)))
  const [count, rows] = await Promise.all([
    prisma.scaleTicket.count({ where }),
    prisma.scaleTicket.findMany({ where, include: { yard: true, payouts: true }, orderBy: [{ createdAt: 'desc' }], take, skip }),
  ])
  const invoices = await prisma.invoice.findMany({ where: { ticketId: { in: rows.map((r: any) => r.id) }, kind: 'fee_ticket', status: { not: 'void' } } })
  return {
    count, currencyCode: settings.currencyCode || 'USD',
    items: rows.map((t: any) => ({
      id: t.id, displayNumber: formatTicketNumber(t.yard.code, t.direction, t.number), status: t.status, completedAt: t.completedAt, createdAt: t.createdAt, totalCents: t.totalCents,
      isAdjustment: t.isAdjustment, payoutStatus: payoutSummary({ ...t, invoices: invoices.filter((i: any) => i.ticketId === t.id) }, now), yard: { name: t.yard.name, timezone: t.yard.timezone || null },
    })),
  }
}

/** S8, S9, S11, S12: the receipt with the lookup code, the fee still due and the invoice to pay it. */
export async function myTicket(prisma: any, userId: string, id: string, now = new Date()) {
  const seller = await sellerForUser(prisma, userId)
  const t = seller ? await prisma.scaleTicket.findUnique({ where: { id } }) : null
  if (!t || t.sellerId !== seller.id) notFound('Ticket')
  await refreshDuePayouts(prisma, now, { ticketId: t.id })
  const receipt: any = await ticketReceipt(prisma, t.id)
  const invoice = t.totalCents < 0 ? await prisma.invoice.findFirst({ where: { ticketId: t.id, kind: 'fee_ticket', status: { not: 'void' } } }) : null
  return {
    ...receipt, lookupCode: t.lookupCode, adjustsId: t.adjustsId || null,
    invoiceId: invoice?.id || null, amountDueCents: invoice ? Math.max(0, invoice.totalCents - invoice.paidCents) : null,
  }
}

export async function myPayouts(prisma: any, userId: string, now = new Date()) {
  const settings: any = await businessSettings(prisma)
  const seller = await sellerForUser(prisma, userId)
  if (!seller) return { currencyCode: settings.currencyCode || 'USD', items: [] }
  await refreshDuePayouts(prisma, now)
  const rows = await prisma.payout.findMany({ where: { sellerId: seller.id }, include: { ticket: { include: { yard: true } } }, orderBy: [{ createdAt: 'desc' }], take: 200 })
  return {
    currencyCode: settings.currencyCode || 'USD',
    items: rows.map((p: any) => ({
      id: p.id, amountCents: p.amountCents, status: p.status, method: p.method || null, allowedMethods: Array.isArray(p.allowedMethods) ? p.allowedMethods : [], checkNumber: p.checkNumber || null,
      releaseAt: p.releaseAt, paidAt: p.paidAt, returnReason: p.returnReason || null, replacesId: p.replacesId || null, createdAt: p.createdAt,
      ticket: p.ticket ? { id: p.ticket.id, displayNumber: formatTicketNumber(p.ticket.yard.code, p.ticket.direction, p.ticket.number) } : null,
      yard: p.ticket?.yard ? { name: p.ticket.yard.name, timezone: p.ticket.yard.timezone || null } : null,
    })),
  }
}

// ---------------------------------------------------------------------------------------------
// S1 overview
// ---------------------------------------------------------------------------------------------

export async function mySellerOverview(prisma: any, userId: string, now = new Date()) {
  const settings: any = await businessSettings(prisma)
  const base = { currencyCode: settings.currencyCode || 'USD', weightUnit: settings.weightUnit || 'lb' }
  const seller = await sellerForUser(prisma, userId)
  if (!seller) return { seller: null, lifetimeWeight: '0', lifetimePaidCents: 0, pendingCents: 0, heldCents: 0, identityOnFile: false, vehicleCount: 0, nextVisit: null, ticketCount: 0, ...base }
  await refreshDuePayouts(prisma, now)
  const [weight, paid, ready, held, id, vehicles, tickets] = await Promise.all([
    prisma.ticketLine.aggregate({ where: { direction: 'pay_seller', ticket: { sellerId: seller.id, direction: 'inbound', status: { in: ['completed', 'settled'] } } }, _sum: { payWeight: true } }),
    prisma.payout.aggregate({ where: { sellerId: seller.id, status: 'paid' }, _sum: { amountCents: true } }),
    prisma.payout.aggregate({ where: { sellerId: seller.id, status: { in: ['ready', 'pending'] } }, _sum: { amountCents: true } }),
    prisma.payout.aggregate({ where: { sellerId: seller.id, status: 'held' }, _sum: { amountCents: true } }),
    currentIdentity(prisma, seller.id),
    prisma.vehicle.count({ where: { sellerId: seller.id, isRemoved: false } }),
    prisma.scaleTicket.count({ where: { sellerId: seller.id, direction: 'inbound', status: { not: 'voided' } } }),
  ])
  const upcoming = await prisma.visit.findMany({ where: { sellerId: seller.id, status: 'booked' }, include: { yard: true, vehicle: true }, orderBy: [{ plannedDate: 'asc' }], take: 10 })
  let nextVisit = null
  for (const v of upcoming) {
    const shaped: any = await shapeVisit(prisma, v, now)
    if (shaped.status === 'booked') { nextVisit = shaped; break }
  }
  return {
    seller: shapeSeller(seller), lifetimeWeight: String(weight._sum.payWeight || '0'), lifetimePaidCents: paid._sum.amountCents || 0, pendingCents: ready._sum.amountCents || 0,
    heldCents: held._sum.amountCents || 0, identityOnFile: Boolean(id && (!id.expiresOn || new Date(id.expiresOn) >= now)), vehicleCount: vehicles, ticketCount: tickets, nextVisit, ...base,
  }
}

// ---------------------------------------------------------------------------------------------
// S13 donations, S15 statements, S16 applications, S14 pickups
// ---------------------------------------------------------------------------------------------

export async function myDonations(prisma: any, userId: string, year?: number | null) {
  const seller = await sellerForUser(prisma, userId)
  if (!seller) return []
  const where: any = { sellerId: seller.id }
  if (year) where.createdAt = { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) }
  const rows = await prisma.donation.findMany({ where, include: { account: true, campaign: true, ticket: { include: { yard: true } } }, orderBy: [{ createdAt: 'desc' }], take: 500 })
  return rows.map((d: any) => ({
    id: d.id, receiptNumber: d.receiptNumber || null, status: d.status, kind: d.kind, amountCents: d.kind === 'goods_donation' ? null : d.amountCents, weight: String(d.weight || '0'),
    nonprofitName: d.account?.name || null, campaignName: d.campaign?.name || null, date: d.ticket?.completedAt || d.createdAt,
    ticket: d.ticket ? { id: d.ticket.id, displayNumber: formatTicketNumber(d.ticket.yard.code, d.ticket.direction, d.ticket.number) } : null,
  }))
}

export async function mySellerYearSummary(prisma: any, userId: string, year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) refuse('Choose a year.')
  const settings: any = await businessSettings(prisma)
  const seller = await sellerForUser(prisma, userId)
  const empty = { year, currencyCode: settings.currencyCode || 'USD', weightUnit: settings.weightUnit || 'lb', ticketCount: 0, totalWeight: '0', totalCents: 0, paidCents: 0, donatedCents: 0, materials: [] as any[], csv: '' }
  if (!seller) return { ...empty, csv: toCsv(['Material', 'Weight', 'Unit', 'Amount'], []) }
  const start = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year + 1, 0, 1))
  const tickets = await prisma.scaleTicket.findMany({ where: { sellerId: seller.id, direction: 'inbound', status: { in: ['completed', 'settled'] }, completedAt: { gte: start, lt: end } }, include: { lines: true } })
  const byMaterial = new Map<string, { materialName: string; unit: string; weight: Decimal; quantity: number; amountCents: number }>()
  let totalWeight = new Decimal(0)
  let totalCents = 0
  for (const t of tickets) {
    totalCents += t.totalCents
    for (const l of t.lines) {
      const key = `${l.materialName}|${l.unit}`
      const row = byMaterial.get(key) || { materialName: l.materialName, unit: l.unit, weight: new Decimal(0), quantity: 0, amountCents: 0 }
      row.weight = row.weight.plus(String(l.payWeight || '0'))
      row.quantity += l.quantity || 0
      row.amountCents += l.amountCents
      byMaterial.set(key, row)
      totalWeight = totalWeight.plus(String(l.payWeight || '0'))
    }
  }
  const [paid, donated] = await Promise.all([
    prisma.payout.aggregate({ where: { sellerId: seller.id, status: 'paid', paidAt: { gte: start, lt: end } }, _sum: { amountCents: true } }),
    prisma.donation.aggregate({ where: { sellerId: seller.id, status: { in: ['credited', 'disbursed'] }, createdAt: { gte: start, lt: end } }, _sum: { amountCents: true } }),
  ])
  const materials = [...byMaterial.values()].sort((a, b) => a.materialName.localeCompare(b.materialName)).map((m) => ({ materialName: m.materialName, unit: m.unit, weight: m.weight.toFixed(2), quantity: m.quantity, amountCents: m.amountCents }))
  const csv = toCsv(['Material', 'Unit', 'Weight', 'Quantity', `Amount (${settings.currencyCode || 'USD'})`], materials.map((m) => [m.materialName, m.unit, m.weight, m.quantity, (m.amountCents / 100).toFixed(2)]))
  return { ...empty, ticketCount: tickets.length, totalWeight: totalWeight.toFixed(2), totalCents, paidCents: paid._sum.amountCents || 0, donatedCents: donated._sum.amountCents || 0, materials, csv }
}

export async function myApplications(prisma: any, userId: string) {
  const rows = await prisma.accountApplication.findMany({ where: { applicantId: userId }, include: { account: true }, orderBy: [{ createdAt: 'desc' }], take: 100 })
  return rows.map((a: any) => ({ id: a.id, kind: a.kind, businessName: a.businessName, status: a.status, decisionReason: a.decisionReason || null, decidedAt: a.decidedAt, createdAt: a.createdAt, accountSlug: a.status === 'approved' ? a.account?.slug || null : null }))
}

function shapeRequest(r: any) {
  return {
    id: r.id, number: r.number, kind: r.kind, status: r.status, feeCents: r.feeCents, quoteNote: r.quoteNote || null, quoteAcceptedAt: r.quoteAcceptedAt, decisionReason: r.decisionReason || null,
    preferredDate: r.preferredDate, preferredWindow: r.preferredWindow, itemsDescription: r.itemsDescription || null, accessNotes: r.accessNotes || null, photos: Array.isArray(r.photos) ? r.photos : [], createdAt: r.createdAt,
    chargeToAccount: Boolean(r.chargeToAccount), canPay: r.status === 'awaiting_payment' && r.feeCents > 0, canAcceptQuote: r.kind === 'public_pickup' && r.status === 'requested' && !r.quoteAcceptedAt && r.quoteNote !== null && r.updatedAt > r.createdAt,
    canCancel: ['requested', 'awaiting_payment', 'approved', 'scheduled'].includes(r.status) && !['en_route', 'on_site', 'completed', 'failed'].includes(r.job?.status),
    yard: r.yard ? { id: r.yard.id, name: r.yard.name, phone: r.yard.phone || null } : null,
    site: r.site ? { id: r.site.id, name: r.site.name, addressLine1: r.site.addressLine1, addressLine2: r.site.addressLine2 || null, city: r.site.city, region: r.site.region || null, postalCode: r.site.postalCode || null } : null,
    containerTypeName: r.containerType?.name || null, containerNumber: r.container?.number || null,
    job: r.job ? { scheduledDate: r.job.scheduledDate, status: r.job.status, driverNotes: r.job.driverNotes || null, completedAt: r.job.completedAt, failureReason: r.job.failureReason || null, photos: Array.isArray(r.job.photos) ? r.job.photos : [] } : null,
  }
}
const REQUEST_INCLUDE = { yard: true, site: true, job: true, containerType: true, container: true }

/** S14: the signed-in user's own requests that are not on a company account (those are under C7). */
export async function myServiceRequests(prisma: any, userId: string) {
  const rows = await prisma.serviceRequest.findMany({ where: { requestedById: userId, accountId: null }, include: REQUEST_INCLUDE, orderBy: [{ createdAt: 'desc' }], take: 100 })
  return rows.map(shapeRequest)
}
export async function myServiceRequest(prisma: any, userId: string, id: string) {
  const r = await prisma.serviceRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE })
  if (!r || r.requestedById !== userId || r.accountId) notFound('Request')
  return shapeRequest(r)
}
export { shapeRequest, REQUEST_INCLUDE }

/** Account switcher (§8.3): every account where the user is an active contact. */
export async function myAccounts(prisma: any, userId: string) {
  const rows = await prisma.accountContact.findMany({ where: { userId, status: 'active', account: { status: { in: ['active', 'suspended'] } } }, include: { account: true }, orderBy: [{ createdAt: 'asc' }] })
  return rows.map((c: any) => ({ id: c.account.id, slug: c.account.slug, name: c.account.name, status: c.account.status, role: c.role, isSupplier: c.account.isSupplier, isBuyer: c.account.isBuyer, isNonprofit: c.account.isNonprofit }))
}

// ---------------------------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------------------------

export const sellerTypeDefs = `
  type RegisteredCustomer { id: ID!, name: String!, email: String! }
  type MySeller { id: ID!, firstName: String!, lastName: String!, status: String!, idVerification: String!, preferredPayout: String, phone: String, email: String, dateOfBirth: String, addressLine1: String, addressLine2: String, city: String, region: String, postalCode: String, defaultNonprofitId: ID }
  input MySellerProfileInput { firstName: String!, lastName: String!, dateOfBirth: String, phone: String, email: String, addressLine1: String, addressLine2: String, city: String, region: String, postalCode: String, preferredPayout: String, defaultNonprofitId: ID }
  input MyIdentityDocumentInput { kind: String!, number: String!, issuer: String, expiresOn: String!, frontImage: ImageFieldInput, backImage: ImageFieldInput }
  type MyIdentityDocument { id: ID!, kind: String!, issuer: String, last4: String, expiresOn: DateTime, isCurrent: Boolean!, verified: Boolean!, expired: Boolean, hasFrontImage: Boolean, hasBackImage: Boolean }
  type MyIdentityStatus { status: String!, documents: [MyIdentityDocument!]! }
  input MyVehicleInput { plate: String!, plateRegion: String, make: String, model: String, color: String, kind: String }
  type MyVehicle { id: ID!, plate: String, plateRegion: String, make: String, model: String, color: String, kind: String! }
  input ExpectedItemInput { materialId: ID!, estimatedWeight: String }
  input CreateMyVisitInput { yardSlug: String!, plannedDate: String!, vehicleId: ID, expectedItems: [ExpectedItemInput!], donatePercent: Int, nonprofitId: ID, campaignId: ID }
  type MyVisitYard { id: ID!, name: String!, slug: String!, timezone: String, addressLine1: String, city: String, region: String, phone: String }
  type MyVisitVehicle { id: ID!, plate: String, make: String, model: String }
  type MyVisit { id: ID!, code: String!, status: String!, plannedDate: String!, expiresAt: DateTime!, donatePercent: Int!, nonprofitName: String, campaignName: String, ticketId: ID, createdAt: DateTime, yard: MyVisitYard, vehicle: MyVisitVehicle, expectedItems: JSON }
  type MyTicketYard { name: String!, timezone: String }
  type MyTicketSummary { id: ID!, displayNumber: String!, status: String!, completedAt: DateTime, createdAt: DateTime, totalCents: Int!, isAdjustment: Boolean!, payoutStatus: String, yard: MyTicketYard }
  type MyTicketPage { count: Int!, currencyCode: String!, items: [MyTicketSummary!]! }
  type TicketRef { id: ID!, displayNumber: String! }
  type MyPayout { id: ID!, amountCents: Int!, status: String!, method: String, allowedMethods: [String!]!, checkNumber: String, releaseAt: DateTime, paidAt: DateTime, returnReason: String, replacesId: ID, createdAt: DateTime, ticket: TicketRef, yard: MyTicketYard }
  type MyPayoutPage { currencyCode: String!, items: [MyPayout!]! }
  type MySellerOverview { seller: MySeller, lifetimeWeight: String!, lifetimePaidCents: Int!, pendingCents: Int!, heldCents: Int!, identityOnFile: Boolean!, vehicleCount: Int!, ticketCount: Int!, nextVisit: MyVisit, currencyCode: String!, weightUnit: String! }
  type MyDonation { id: ID!, receiptNumber: String, status: String!, kind: String!, amountCents: Int, weight: String!, nonprofitName: String, campaignName: String, date: DateTime, ticket: TicketRef }
  type YearMaterialTotal { materialName: String!, unit: String!, weight: String!, quantity: Int!, amountCents: Int! }
  type SellerYearSummary { year: Int!, currencyCode: String!, weightUnit: String!, ticketCount: Int!, totalWeight: String!, totalCents: Int!, paidCents: Int!, donatedCents: Int!, materials: [YearMaterialTotal!]!, csv: String! }
  type MyApplication { id: ID!, kind: String!, businessName: String!, status: String!, decisionReason: String, decidedAt: DateTime, createdAt: DateTime, accountSlug: String }
  type RequestYard { id: ID!, name: String!, phone: String }
  type RequestSite { id: ID!, name: String, addressLine1: String, addressLine2: String, city: String, region: String, postalCode: String }
  type RequestJob { scheduledDate: DateTime, status: String!, driverNotes: String, completedAt: DateTime, failureReason: String, photos: JSON }
  type MyServiceRequest {
    id: ID!, number: Int, kind: String!, status: String!, feeCents: Int!, quoteNote: String, quoteAcceptedAt: DateTime, decisionReason: String, preferredDate: DateTime, preferredWindow: String,
    itemsDescription: String, accessNotes: String, photos: JSON, createdAt: DateTime, chargeToAccount: Boolean!, canPay: Boolean!, canAcceptQuote: Boolean!, canCancel: Boolean!,
    yard: RequestYard, site: RequestSite, containerTypeName: String, containerNumber: String, job: RequestJob
  }
  type MyAccount { id: ID!, slug: String!, name: String!, status: String!, role: String!, isSupplier: Boolean!, isBuyer: Boolean!, isNonprofit: Boolean! }
`

export const sellerQueryDefs = `
  mySellerOverview: MySellerOverview
  myIdentityStatus: MyIdentityStatus
  myVehicles: [MyVehicle!]!
  myVisits: [MyVisit!]!
  myVisit(id: ID!): MyVisit
  myTickets(status: String, from: String, to: String, take: Int, skip: Int): MyTicketPage!
  myTicket(id: ID!): TicketReceipt
  myPayouts: MyPayoutPage!
  myDonations(year: Int): [MyDonation!]!
  mySellerYearSummary(year: Int!): SellerYearSummary!
  myApplications: [MyApplication!]!
  myServiceRequests: [MyServiceRequest!]!
  myServiceRequest(id: ID!): MyServiceRequest
  myAccounts: [MyAccount!]!
`

export const sellerMutationDefs = `
  registerCustomer(name: String!, email: String!, phone: String, password: String!): RegisteredCustomer
  upsertMySellerProfile(data: MySellerProfileInput!): MySeller
  submitMyIdentityDocument(data: MyIdentityDocumentInput!): MyIdentityDocument
  upsertMyVehicle(id: ID, data: MyVehicleInput!): MyVehicle
  removeMyVehicle(id: ID!): MyVehicle
  createMyVisit(data: CreateMyVisitInput!, idempotencyKey: String): MyVisit
  cancelMyVisit(id: ID!): MyVisit
`

const signedIn = (c: any) => requireUser(c)

export const sellerResolvers = {
  Query: {
    mySellerOverview: (_: unknown, _a: any, c: any) => mySellerOverview(db(c), signedIn(c)),
    myIdentityStatus: (_: unknown, _a: any, c: any) => myIdentityStatus(db(c), signedIn(c)),
    myVehicles: async (_: unknown, _a: any, c: any) => {
      const seller = await sellerForUser(db(c), signedIn(c))
      if (!seller) return []
      const rows = await db(c).vehicle.findMany({ where: { sellerId: seller.id, isRemoved: false }, orderBy: [{ createdAt: 'asc' }] })
      return rows.map(shapeVehicle)
    },
    myVisits: (_: unknown, _a: any, c: any) => myVisits(db(c), signedIn(c)),
    myVisit: (_: unknown, a: any, c: any) => myVisit(db(c), signedIn(c), a.id),
    myTickets: (_: unknown, a: any, c: any) => myTickets(db(c), signedIn(c), a),
    myTicket: (_: unknown, a: any, c: any) => myTicket(db(c), signedIn(c), a.id),
    myPayouts: (_: unknown, _a: any, c: any) => myPayouts(db(c), signedIn(c)),
    myDonations: (_: unknown, a: any, c: any) => myDonations(db(c), signedIn(c), a.year ?? null),
    mySellerYearSummary: (_: unknown, a: any, c: any) => mySellerYearSummary(db(c), signedIn(c), a.year),
    myApplications: (_: unknown, _a: any, c: any) => myApplications(db(c), signedIn(c)),
    myServiceRequests: (_: unknown, _a: any, c: any) => myServiceRequests(db(c), signedIn(c)),
    myServiceRequest: (_: unknown, a: any, c: any) => myServiceRequest(db(c), signedIn(c), a.id),
    myAccounts: (_: unknown, _a: any, c: any) => myAccounts(db(c), signedIn(c)),
  },
  Mutation: {
    registerCustomer: (_: unknown, a: any, c: any) => registerCustomer(c, a),
    upsertMySellerProfile: (_: unknown, a: any, c: any) =>
      runCommand(c, { name: 'upsertMySellerProfile', input: a.data, requireSignIn: true }, (ctx) => upsertMySellerProfileTx(ctx, a.data)).then((s: any) => db(c).seller.findUnique({ where: { id: s.id } })).then(shapeSeller),
    submitMyIdentityDocument: (_: unknown, a: any, c: any) => submitMyIdentityDocument(c, a.data),
    upsertMyVehicle: (_: unknown, a: any, c: any) => runCommand(c, { name: 'upsertMyVehicle', input: a, requireSignIn: true }, (ctx) => upsertMyVehicleTx(ctx, a.id, a.data)).then(shapeVehicle),
    removeMyVehicle: (_: unknown, a: any, c: any) => runCommand(c, { name: 'removeMyVehicle', input: a, requireSignIn: true }, (ctx) => removeMyVehicleTx(ctx, a.id)).then(shapeVehicle),
    createMyVisit: async (_: unknown, a: any, c: any) => {
      const v: any = await runCommand(c, { name: 'createMyVisit', input: a.data, idempotencyKey: cleanKey(a.idempotencyKey), requireSignIn: true, aggregateType: 'Visit' }, (ctx) => createMyVisitTx(ctx, a.data))
      return myVisit(db(c), signedIn(c), v.id)
    },
    cancelMyVisit: async (_: unknown, a: any, c: any) => {
      await runCommand(c, { name: 'cancelMyVisit', input: a, requireSignIn: true }, (ctx) => cancelMyVisitTx(ctx, a.id))
      return myVisit(db(c), signedIn(c), a.id)
    },
  },
}

export { donationReceipt }
