import { randomBytes } from 'node:crypto'
import { Decimal } from 'decimal.js'
import type { RestrictionInput, RulesProfileInput } from '../../recycling/compliance'
import { refuse, type Tx } from './command'
import { postMovement } from './inventory'

/** Shared lookups used by several commands. */

export function randomCode(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(length)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

export function normalizeId(value: string | null | undefined) {
  return String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase()
}

export function normalizeName(first: string | null | undefined, last: string | null | undefined) {
  return `${first || ''} ${last || ''}`.trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function businessSettings(tx: Tx) {
  return (await tx.businessSettings.findFirst()) || { weightUnit: 'lb', currencyCode: 'USD', timezone: 'America/New_York', isNonprofit: false, name: '', legalName: '', ein: '' }
}

const GENERAL_PROFILE: RulesProfileInput = {
  requireGovernmentId: true, requireIdPhoto: true, requireSellerPhoto: false, requireMaterialPhoto: true, requireVehiclePlate: true,
  requireSignature: true, requireThumbprint: false, minimumSellerAge: 18, cashLimitPerTicketCents: null, cashLimitPerDayCents: null,
  cashRounding: 'none', defaultPaymentHoldDays: 0, defaultMaterialHoldDays: 0,
}

/** A yard with no rules profile uses the General template values, never "no rules". */
export async function yardRules(tx: Tx, yardId: string): Promise<{ profile: RulesProfileInput & { id?: string; allowEarlyRelease?: boolean }; restrictions: RestrictionInput[] }> {
  const yard = await tx.yard.findUnique({ where: { id: yardId }, include: { rulesProfile: { include: { restrictions: true } } } })
  if (!yard) refuse('Yard not found.')
  const profile = yard.rulesProfile
  if (!profile) return { profile: GENERAL_PROFILE, restrictions: [] }
  return {
    profile,
    restrictions: profile.restrictions.map((r: any) => ({
      ...r,
      requiredDocuments: Array.isArray(r.requiredDocuments) ? r.requiredDocuments : [],
      allowedMethods: Array.isArray(r.allowedMethods) && r.allowedMethods.length ? r.allowedMethods : null,
    })),
  }
}

export async function doNotBuyMatch(tx: Tx, input: { sellerId?: string | null; firstName?: string; lastName?: string; dateOfBirth?: Date | null; idNumbers?: string[]; plate?: string | null }, now = new Date()) {
  const or: any[] = []
  if (input.sellerId) or.push({ sellerId: input.sellerId })
  const name = normalizeName(input.firstName, input.lastName)
  if (name && input.dateOfBirth) {
    const day = new Date(input.dateOfBirth)
    const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()))
    or.push({ nameNormalized: name, dateOfBirth: { gte: start, lt: new Date(start.getTime() + 86_400_000) } })
  }
  for (const id of (input.idNumbers || []).map(normalizeId).filter(Boolean)) or.push({ idNumberNormalized: id })
  const plate = normalizeId(input.plate)
  if (plate) or.push({ plateNormalized: plate })
  if (!or.length) return null
  return tx.doNotBuyEntry.findFirst({ where: { isActive: true, OR: or, AND: [{ OR: [{ expiresOn: null }, { expiresOn: { gt: now } }] }] } })
}

export async function currentIdentity(tx: Tx, sellerId: string) {
  return tx.identityDocument.findFirst({ where: { sellerId, isCurrent: true }, orderBy: [{ expiresOn: 'desc' }, { createdAt: 'desc' }] })
}

/** §5.2: a held payout becomes ready by time comparison when read; never while a police hold is on the ticket. */
export async function refreshDuePayouts(tx: Tx, now = new Date(), where: { ticketId?: string; payoutId?: string } = {}) {
  const params: any[] = [now]
  let filter = ''
  if (where.ticketId) { params.push(where.ticketId); filter += ` AND p."ticket" = $${params.length}` }
  if (where.payoutId) { params.push(where.payoutId); filter += ` AND p."id" = $${params.length}` }
  await tx.$executeRawUnsafe(
    `UPDATE "Payout" p SET "status" = 'ready', "updatedAt" = NOW()
     WHERE p."status" = 'held' AND p."releaseAt" IS NOT NULL AND p."releaseAt" <= $1 ${filter}
       AND NOT EXISTS (SELECT 1 FROM "HoldTag" h WHERE h."ticket" = p."ticket" AND h."status" = 'police_hold')`,
    ...params
  )
}

export async function hasPoliceHold(tx: Tx, ticketId: string | null | undefined) {
  if (!ticketId) return false
  return Boolean(await tx.holdTag.findFirst({ where: { ticketId, status: 'police_hold' } }))
}

/** §5.3: a material hold releases by time comparison when read or acted on. */
export async function releaseDueHoldTags(tx: Tx, now = new Date(), where: { yardId?: string; ticketId?: string } = {}) {
  const due = await tx.holdTag.findMany({ where: { status: 'held', releaseAt: { lte: now }, ...(where.yardId ? { yardId: where.yardId } : {}), ...(where.ticketId ? { ticketId: where.ticketId } : {}) } })
  for (const tag of due) {
    const won = await tx.holdTag.updateMany({ where: { id: tag.id, status: 'held' }, data: { status: 'released', releasedAt: now, releaseReason: 'Hold period ended' } })
    if (won.count !== 1) continue
    if (tag.yardId && tag.materialId) {
      await postMovement(tx, { yardId: tag.yardId, materialId: tag.materialId, kind: 'release', weightDelta: new Decimal(String(tag.weight)).negated(), bucket: 'held', referenceKey: `hold:${tag.id}:release`, ticketId: tag.ticketId, reason: 'Hold period ended' })
    }
  }
  return due.length
}

/** §5.1 completed → settled: every payout paid, or on a paid settlement, or the receivable is paid, or the total is zero. */
export async function maybeSettleTicket(tx: Tx, ticketId: string, now = new Date()) {
  const ticket = await tx.scaleTicket.findUnique({ where: { id: ticketId }, include: { payouts: true, settlement: true } })
  if (!ticket || ticket.status !== 'completed') return false
  let settled = false
  if (ticket.paymentMode === 'on_account') settled = ticket.settlement?.status === 'paid'
  else if (ticket.totalCents < 0) {
    const invoice = await tx.invoice.findFirst({ where: { ticketId, kind: 'fee_ticket', status: { not: 'void' } } })
    settled = invoice?.status === 'paid' || ticket.collectedCents >= -ticket.totalCents
  } else {
    const live = ticket.payouts.filter((p: any) => p.status !== 'cancelled' && p.status !== 'returned')
    settled = live.every((p: any) => p.status === 'paid')
  }
  if (!settled) return false
  const won = await tx.scaleTicket.updateMany({ where: { id: ticketId, status: 'completed' }, data: { status: 'settled', settledAt: now } })
  return won.count === 1
}
