import { Decimal } from 'decimal.js'
import { createHash } from 'node:crypto'
import { hasFlag } from '../access'
import { CommandError, cleanKey, compareAndSet, lockRow, refuse, requireYard, runCommand, type CommandCtx, type Tx } from '../lib/command'
import { businessSettings, currentIdentity, doNotBuyMatch, maybeSettleTicket, randomCode, yardRules } from '../lib/domain'
import { postMovement } from '../lib/inventory'
import { resolvePrice } from '../lib/pricing'
import { computeLine, computeTicketTotals, dec, sequentialLineWeights, TicketMathError, type WeightUnitBase } from '../../recycling/ticketMath'
import { blockingItems, restrictionsForLine, screenSeller, splitPayouts, validateTicketCompliance } from '../../recycling/compliance'
import { loadShipmentFromTicket, orderLinePrice, startShipmentLoading } from '../lib/sales'

/**
 * Scale ticket commands (dissertation §4.1, §5.1). Every status change is a compare-and-set inside
 * one transaction, with an audit event and an idempotency receipt.
 */

const TICKET_USERS = ['canManageTickets', 'canGradeTickets'] as const
const MANAGER = 'canApproveVariances' as const

async function lockOpenTicket(tx: Tx, ctx: CommandCtx, ticketId: string) {
  const row = await lockRow(tx, 'ScaleTicket', ticketId)
  if (!row) refuse('Ticket not found.')
  requireYard(ctx.session, row.yard)
  if (row.status !== 'open') refuse('This ticket is not open. Lines, weights and prices change only while a ticket is open.')
  return row
}

function asDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) refuse('A date is not valid.')
  return date
}

function mathGuard<T>(fn: () => T): T {
  try {
    return fn()
  } catch (error) {
    if (error instanceof TicketMathError) refuse(error.message)
    throw error
  }
}

/** End of the planned day plus one (§4.2 step 5), in UTC. */
export function visitExpiresAt(plannedDate: Date) {
  const day = new Date(Date.UTC(plannedDate.getUTCFullYear(), plannedDate.getUTCMonth(), plannedDate.getUTCDate()))
  return new Date(day.getTime() + 2 * 86_400_000)
}

// ---------------------------------------------------------------------------------------------
// Open
// ---------------------------------------------------------------------------------------------

export type OpenTicketInput = {
  yardId: string
  direction?: 'inbound' | 'outbound'
  sellerId?: string | null
  accountId?: string | null
  siteId?: string | null
  vehicleId?: string | null
  vehiclePlate?: string | null
  vehiclePlateRegion?: string | null
  vehicleDescription?: string | null
  visitCode?: string | null
  jobId?: string | null
  containerId?: string | null
  shipmentId?: string | null
  paymentMode?: string | null
  donatePercent?: number | null
  nonprofitId?: string | null
  campaignId?: string | null
  overrideReason?: string | null
  notes?: string | null
}

export async function openTicketTx(ctx: CommandCtx, input: OpenTicketInput) {
  const { tx } = ctx
  requireYard(ctx.session, input.yardId)
  const yard = await tx.yard.findUnique({ where: { id: input.yardId } })
  if (!yard || yard.status !== 'active') refuse('This yard is not active.')
  const direction = input.direction === 'outbound' ? 'outbound' : 'inbound'

  let sellerId = input.sellerId || null
  let vehicleId = input.vehicleId || null
  let donatePercent = Math.max(0, Math.min(100, Math.trunc(Number(input.donatePercent || 0))))
  let nonprofitId = input.nonprofitId || null
  let campaignId = input.campaignId || null
  let visitId: string | null = null

  if (input.visitCode) {
    const visit = await tx.visit.findUnique({ where: { code: String(input.visitCode).trim().toUpperCase() } })
    if (!visit) refuse('No visit has that code.')
    if (visit.yardId !== input.yardId) refuse('That visit is booked at another yard.')
    if (visit.status !== 'booked') refuse(`That visit is ${visit.status}.`)
    if (visitExpiresAt(visit.plannedDate).getTime() <= ctx.now.getTime()) {
      await tx.visit.updateMany({ where: { id: visit.id, status: 'booked' }, data: { status: 'expired' } })
      refuse('That visit has expired.')
    }
    await compareAndSet(tx, 'visit', visit.id, 'booked', { status: 'arrived' }, 'That visit was already used.')
    visitId = visit.id
    sellerId = sellerId || visit.sellerId
    vehicleId = vehicleId || visit.vehicleId
    if (!input.donatePercent && visit.donatePercent) donatePercent = visit.donatePercent
    nonprofitId = nonprofitId || visit.nonprofitId
    campaignId = campaignId || visit.campaignId
  }

  let paymentMode = input.paymentMode || 'pay_now'
  let account: any = null
  if (input.accountId) {
    account = await tx.account.findUnique({ where: { id: input.accountId } })
    if (!account) refuse('Account not found.')
    if (account.status !== 'active') refuse('This account is suspended and cannot open tickets.')
    if (!input.paymentMode) paymentMode = account.paymentTerms === 'on_account' ? 'on_account' : 'pay_now'
  }
  if (!['pay_now', 'on_account', 'donation_only', 'customer_pays'].includes(paymentMode)) refuse('Payment mode is not valid.')
  if (paymentMode === 'on_account' && !account) refuse('Only a commercial account can be put on account.')

  let vehicle: any = null
  if (vehicleId) {
    vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } })
    if (!vehicle || vehicle.isRemoved) refuse('Vehicle not found.')
  }
  const plate = String(input.vehiclePlate ?? vehicle?.plate ?? '').replace(/\s+/g, '').toUpperCase()

  let screening: any[] = []
  if (direction === 'inbound' && !account) {
    if (!sellerId) refuse('Find or add the seller first.')
    const seller = await tx.seller.findUnique({ where: { id: sellerId } })
    if (!seller) refuse('Seller not found.')
    const identity = await currentIdentity(tx, seller.id)
    const listMatch = await doNotBuyMatch(tx, { sellerId: seller.id, firstName: seller.firstName, lastName: seller.lastName, dateOfBirth: seller.dateOfBirth, idNumbers: identity ? [identity.number] : [], plate }, ctx.now)
    const { profile } = await yardRules(tx, input.yardId)
    screening = screenSeller({
      seller: { status: seller.status, dateOfBirth: seller.dateOfBirth, doNotBuyMatch: Boolean(listMatch) },
      identity: identity ? { expiresOn: identity.expiresOn, hasFrontImage: Boolean(identity.frontImage_id) } : null,
      profile, isCommercial: false, now: ctx.now,
    })
    const blocking = screening.filter((item) => !item.overridable)
    if (blocking.length) throw new CommandError(blocking.map((b) => b.message).join(' '), 'SCREENING_BLOCKED', { items: blocking })
    if (screening.length) {
      if (!input.overrideReason || input.overrideReason.trim().length < 3 || !hasFlag(ctx.session, MANAGER)) {
        throw new CommandError(`${screening.map((s) => s.message).join(' ')} A manager may override with a written reason.`, 'SCREENING_NEEDS_OVERRIDE', { items: screening })
      }
    }
  }

  if (nonprofitId) {
    const np = await tx.account.findUnique({ where: { id: nonprofitId } })
    if (!np?.isNonprofit || np.status !== 'active') refuse('Donations go only to an active partner nonprofit.')
  }
  if (campaignId) {
    const campaign = await tx.donationCampaign.findUnique({ where: { id: campaignId } })
    if (!campaign || campaign.status !== 'active') refuse('That campaign is not active.')
    nonprofitId = nonprofitId || campaign.accountId
  }
  if (donatePercent > 0 && !nonprofitId) {
    const settings = await businessSettings(tx)
    if (!settings.isNonprofit) refuse('Choose the nonprofit or campaign that receives the donation.')
  }

  if (direction === 'outbound') {
    if (!input.shipmentId) refuse('An outbound ticket is opened for a shipment.')
    const { order } = await startShipmentLoading(ctx, input.shipmentId)
    if (order.yardId !== input.yardId) refuse('That shipment ships from another yard.')
    account = await tx.account.findUnique({ where: { id: order.accountId } })
    paymentMode = 'customer_pays'
  }

  const number = await ctx.sequence(`yard:${input.yardId}`, `${direction}_ticket`, input.yardId)
  const ticket = await tx.scaleTicket.create({
    data: {
      yardId: input.yardId, direction, number, status: 'open', sellerId, accountId: account?.id || null, siteId: input.siteId || null,
      vehicleId, vehiclePlate: plate, vehiclePlateRegion: String(input.vehiclePlateRegion ?? vehicle?.plateRegion ?? ''),
      vehicleDescription: String(input.vehicleDescription ?? (vehicle ? [vehicle.color, vehicle.make, vehicle.model].filter(Boolean).join(' ') : '')),
      visitId, jobId: input.jobId || null, containerId: input.containerId || null, shipmentId: input.shipmentId || null,
      paymentMode, donatePercent, nonprofitId, campaignId, lookupCode: randomCode(8),
      overrideReason: screening.length ? String(input.overrideReason) : '', overrideById: screening.length ? ctx.actorId : null,
      openedById: ctx.actorId, notes: input.notes || '', fees: [],
    },
  })
  await ctx.audit({ eventType: 'ticket.opened', aggregateType: 'ScaleTicket', aggregateId: ticket.id, yardId: input.yardId, after: { number, direction, sellerId, accountId: account?.id || null }, reason: screening.length ? `Screening override: ${input.overrideReason}` : undefined })
  if (screening.length) await ctx.audit({ eventType: 'ticket.screening_override', aggregateType: 'ScaleTicket', aggregateId: ticket.id, yardId: input.yardId, after: { items: screening }, reason: String(input.overrideReason) })
  return ticket
}

// ---------------------------------------------------------------------------------------------
// Lines and weighing
// ---------------------------------------------------------------------------------------------

export type LineInput = {
  ticketId: string
  materialId: string
  grossWeight?: string | number | null
  tareWeight?: string | number | null
  quantity?: number | null
  deductionWeight?: string | number | null
  deductionPercent?: string | number | null
  deductionReason?: string | null
  unitPrice?: string | number | null
  overrideReason?: string | null
  documents?: string[] | null
  direction?: 'pay_seller' | 'charge_customer' | null
  scaleId?: string | null
  grossFromScale?: boolean | null
  tareFromScale?: boolean | null
}

async function readStableScale(tx: Tx, scaleId: string, yardId: string, now: Date) {
  const scale = await tx.scale.findUnique({ where: { id: scaleId } })
  if (!scale || scale.yardId !== yardId || !scale.isActive) refuse('That scale is not at this yard.')
  if (!scale.lastReadingAt || !scale.lastReadingStable || now.getTime() - new Date(scale.lastReadingAt).getTime() > 10_000 || scale.lastReadingWeight === null) {
    refuse('The scale has no stable reading from the last 10 seconds. Type the weight instead.')
  }
  return { scale, weight: new Decimal(String(scale.lastReadingWeight)) }
}

async function priceLine(ctx: CommandCtx, ticket: any, material: any, input: { unitPrice?: string | number | null; overrideReason?: string | null }) {
  if (input.unitPrice !== undefined && input.unitPrice !== null && input.unitPrice !== '') {
    if (!hasFlag(ctx.session, 'canOverridePrices')) refuse('Changing a price needs the price override permission.')
    if (!input.overrideReason || input.overrideReason.trim().length < 3) refuse('Give a reason for the price override.')
    const price = dec(input.unitPrice)
    if (price.isNegative()) refuse('A unit price cannot be negative.')
    return { unitPrice: price.toFixed(5), unit: material.defaultUnit, source: 'override', priceEntryId: null, overrideById: ctx.actorId, overrideReason: input.overrideReason.trim() }
  }
  if (ticket.direction === 'outbound') {
    if (!ticket.shipment) refuse('An outbound ticket must be for a shipment.')
    const sale = await orderLinePrice(ctx.tx, ticket.shipment, material.id)
    if (!sale) refuse('This material is not on the sales order for the shipment.')
    return { unitPrice: sale.unitPrice, unit: sale.unit, source: 'price_list', priceEntryId: null, overrideById: null, overrideReason: '' }
  }
  const snap = await resolvePrice(ctx.tx, { yardId: ticket.yard, materialId: material.id, accountId: ticket.account, sellerId: ticket.seller, at: ctx.now })
  if (!snap) return { unitPrice: null, unit: material.defaultUnit, source: null, priceEntryId: null, overrideById: null, overrideReason: '' }
  return { unitPrice: new Decimal(snap.unitPrice).toFixed(5), unit: snap.unit, source: snap.source, priceEntryId: snap.priceEntryId, overrideById: null, overrideReason: '' }
}

function lineDirection(ticket: any, material: any, requested?: string | null) {
  if (ticket.isAdjustment && (requested === 'pay_seller' || requested === 'charge_customer')) return requested
  return material.direction === 'charge_customer' ? 'charge_customer' : 'pay_seller'
}

export async function addTicketLineTx(ctx: CommandCtx, input: LineInput) {
  const { tx } = ctx
  const ticket = await lockOpenTicket(tx, ctx, input.ticketId)
  const material = await tx.material.findUnique({ where: { id: input.materialId } })
  if (!material || !material.isActive) refuse('Material not found.')
  const settings = await businessSettings(tx)
  const base = (settings.weightUnit === 'kg' ? 'kg' : 'lb') as WeightUnitBase

  let gross = input.grossWeight
  let tare = input.tareWeight
  const events: Array<{ kind: string; weight: string; method: string; scaleId: string | null }> = []
  if (input.grossFromScale || input.tareFromScale) {
    if (!input.scaleId) refuse('Pick the scale to read.')
    const reading = await readStableScale(tx, input.scaleId, ticket.yard, ctx.now)
    if (input.grossFromScale) gross = reading.weight.toFixed(2)
    else tare = reading.weight.toFixed(2)
  }
  if (input.tareWeight === undefined && !input.tareFromScale && material.standardContainerTare !== null && material.standardContainerTare !== undefined) tare = String(material.standardContainerTare)
  if (gross !== null && gross !== undefined && gross !== '') events.push({ kind: 'gross', weight: dec(gross).toFixed(2), method: input.grossFromScale ? 'scale' : 'manual', scaleId: input.scaleId || null })
  if (tare !== null && tare !== undefined && tare !== '') events.push({ kind: 'tare', weight: dec(tare).toFixed(2), method: input.tareFromScale ? 'scale' : 'manual', scaleId: input.scaleId || null })

  const price = await priceLine(ctx, ticket, material, input)
  const direction = lineDirection(ticket, material, input.direction)
  const unit = price.unit || material.defaultUnit
  const math = mathGuard(() => computeLine({ grossWeight: gross, tareWeight: tare, deductionWeight: input.deductionWeight, deductionPercent: input.deductionPercent, quantity: input.quantity, unit, unitPrice: price.unitPrice ?? 0, direction }, base))
  const count = await tx.ticketLine.count({ where: { ticketId: ticket.id } })
  const line = await tx.ticketLine.create({
    data: {
      ticketId: ticket.id, sortOrder: count + 1, materialId: material.id, materialName: material.name, direction,
      grossWeight: dec(gross).toFixed(2), tareWeight: dec(tare).toFixed(2), netWeight: math.netWeight.toFixed(2),
      deductionWeight: input.deductionWeight === undefined || input.deductionWeight === null || input.deductionWeight === '' ? null : dec(input.deductionWeight).toFixed(2),
      deductionPercent: input.deductionPercent === undefined || input.deductionPercent === null || input.deductionPercent === '' ? null : dec(input.deductionPercent).toFixed(2),
      deductionReason: input.deductionReason || null, payWeight: math.payWeight.toFixed(2), quantity: input.quantity ?? null, unit,
      unitPrice: price.unitPrice, priceSource: price.source, priceEntryId: price.priceEntryId, overrideById: price.overrideById, overrideReason: price.overrideReason,
      amountCents: price.unitPrice === null ? 0 : math.signedAmountCents, documents: input.documents || [],
    },
  })
  for (const event of events) {
    await tx.weighEvent.create({ data: { ticketId: ticket.id, lineId: line.id, scaleId: event.scaleId, kind: event.kind, weight: event.weight, captureMethod: event.method, capturedById: ctx.actorId, capturedAt: ctx.now } })
  }
  if (price.source === 'override') await ctx.audit({ eventType: 'ticket.price_override', aggregateType: 'TicketLine', aggregateId: line.id, yardId: ticket.yard, after: { unitPrice: price.unitPrice }, reason: price.overrideReason })
  await recomputeOpenTotals(tx, ticket.id, base)
  return line
}

/** Truck-scale mode (§4.1 step 4): W0 full, then a weight after each unload. */
export async function recordTruckWeightTx(ctx: CommandCtx, input: { ticketId: string; weight?: string | number | null; scaleId?: string | null; fromScale?: boolean | null; materialId?: string | null; deductionWeight?: string | number | null; deductionPercent?: string | number | null; deductionReason?: string | null; documents?: string[] | null }) {
  const { tx } = ctx
  const ticket = await lockOpenTicket(tx, ctx, input.ticketId)
  let weight: Decimal
  let method = 'manual'
  if (input.fromScale) {
    if (!input.scaleId) refuse('Pick the scale to read.')
    weight = (await readStableScale(tx, input.scaleId, ticket.yard, ctx.now)).weight
    method = 'scale'
  } else {
    if (input.weight === undefined || input.weight === null || input.weight === '') refuse('Enter the weight.')
    weight = dec(input.weight)
  }
  if (!weight.gt(0)) refuse('A truck weight must be above zero.')
  const previous = await tx.weighEvent.findFirst({ where: { ticketId: ticket.id, kind: 'sequential' }, orderBy: [{ capturedAt: 'desc' }, { createdAt: 'desc' }] })
  if (input.materialId && !previous) refuse('Weigh the full truck first, then unload.')
  if (input.materialId && previous) mathGuard(() => sequentialLineWeights([String(previous.weight), weight.toFixed(2)]))
  const event = await tx.weighEvent.create({ data: { ticketId: ticket.id, scaleId: input.scaleId || null, kind: 'sequential', weight: weight.toFixed(2), captureMethod: method, capturedById: ctx.actorId, capturedAt: ctx.now } })
  if (!input.materialId) return { weighEventId: event.id, lineId: null }
  const line = await addTicketLineTx(ctx, {
    ticketId: ticket.id, materialId: input.materialId, grossWeight: String(previous!.weight), tareWeight: weight.toFixed(2),
    deductionWeight: input.deductionWeight, deductionPercent: input.deductionPercent, deductionReason: input.deductionReason, documents: input.documents,
  })
  return { weighEventId: event.id, lineId: line.id }
}

export async function gradeTicketLineTx(ctx: CommandCtx, input: { lineId: string; materialId?: string | null; deductionWeight?: string | number | null; deductionPercent?: string | number | null; deductionReason?: string | null; unitPrice?: string | number | null; overrideReason?: string | null; documents?: string[] | null; reprice?: boolean | null; quantity?: number | null }) {
  const { tx } = ctx
  const line = await tx.ticketLine.findUnique({ where: { id: input.lineId } })
  if (!line) refuse('Line not found.')
  const ticket = await lockOpenTicket(tx, ctx, line.ticketId)
  const settings = await businessSettings(tx)
  const base = (settings.weightUnit === 'kg' ? 'kg' : 'lb') as WeightUnitBase
  const materialChanged = Boolean(input.materialId && input.materialId !== line.materialId)
  const material = await tx.material.findUnique({ where: { id: input.materialId || line.materialId } })
  if (!material || !material.isActive) refuse('Material not found.')

  let price = { unitPrice: line.unitPrice === null ? null : String(line.unitPrice), unit: line.unit, source: line.priceSource, priceEntryId: line.priceEntryId, overrideById: line.overrideById, overrideReason: line.overrideReason }
  if (materialChanged || input.reprice || (input.unitPrice !== undefined && input.unitPrice !== null && input.unitPrice !== '')) {
    if (input.reprice && !materialChanged && !input.unitPrice && !hasFlag(ctx.session, 'canOverridePrices')) refuse('Repricing an open ticket needs the price override permission.')
    price = await priceLine(ctx, ticket, material, input) as any
  }
  const has = (v: unknown) => v !== undefined
  const deductionWeight = has(input.deductionWeight) ? input.deductionWeight : line.deductionWeight === null ? null : String(line.deductionWeight)
  const deductionPercent = has(input.deductionPercent) ? input.deductionPercent : line.deductionPercent === null ? null : String(line.deductionPercent)
  const quantity = has(input.quantity) ? input.quantity : line.quantity
  const direction = lineDirection(ticket, material, line.direction)
  const math = mathGuard(() => computeLine({ grossWeight: String(line.grossWeight), tareWeight: String(line.tareWeight), deductionWeight: has(input.deductionWeight) && input.deductionWeight !== null ? deductionWeight : has(input.deductionPercent) ? null : deductionWeight, deductionPercent, quantity, unit: price.unit, unitPrice: price.unitPrice ?? 0, direction }, base))
  const before = { materialId: line.materialId, unitPrice: line.unitPrice === null ? null : String(line.unitPrice), deductionWeight: line.deductionWeight === null ? null : String(line.deductionWeight), deductionPercent: line.deductionPercent === null ? null : String(line.deductionPercent) }
  const updated = await tx.ticketLine.update({
    where: { id: line.id },
    data: {
      materialId: material.id, materialName: material.name, direction,
      deductionWeight: has(input.deductionWeight) && input.deductionWeight !== null && input.deductionWeight !== '' ? dec(input.deductionWeight).toFixed(2) : has(input.deductionPercent) ? null : line.deductionWeight,
      deductionPercent: deductionPercent === null || deductionPercent === undefined || deductionPercent === '' ? null : dec(deductionPercent).toFixed(2),
      deductionReason: has(input.deductionReason) ? input.deductionReason || null : line.deductionReason,
      netWeight: math.netWeight.toFixed(2), payWeight: math.payWeight.toFixed(2), quantity: quantity ?? null, unit: price.unit,
      unitPrice: price.unitPrice, priceSource: price.source, priceEntryId: price.priceEntryId, overrideById: price.overrideById, overrideReason: price.overrideReason || '',
      amountCents: price.unitPrice === null ? 0 : math.signedAmountCents, documents: input.documents ?? line.documents ?? [],
    },
  })
  await ctx.audit({ eventType: price.source === 'override' && price.overrideReason !== line.overrideReason ? 'ticket.price_override' : 'ticket.line_graded', aggregateType: 'TicketLine', aggregateId: line.id, yardId: ticket.yard, before, after: { materialId: material.id, unitPrice: price.unitPrice, deductionWeight: updated.deductionWeight === null ? null : String(updated.deductionWeight), deductionPercent: updated.deductionPercent === null ? null : String(updated.deductionPercent) }, reason: price.overrideReason || undefined })
  await recomputeOpenTotals(tx, ticket.id, base)
  return updated
}

/** A grader splits off part of a line as another material (§4.1 step 5). */
export async function splitTicketLineTx(ctx: CommandCtx, input: { lineId: string; weight: string | number; materialId: string }) {
  const { tx } = ctx
  const line = await tx.ticketLine.findUnique({ where: { id: input.lineId } })
  if (!line) refuse('Line not found.')
  const ticket = await lockOpenTicket(tx, ctx, line.ticketId)
  const take = dec(input.weight)
  const net = new Decimal(String(line.netWeight))
  if (!take.gt(0) || !take.lt(net)) refuse('The split weight must be above zero and less than the net weight of the line.')
  const settings = await businessSettings(tx)
  const base = (settings.weightUnit === 'kg' ? 'kg' : 'lb') as WeightUnitBase
  // The original keeps its gross; its tare rises by the split weight. The new line has gross = split, tare 0.
  const newTare = new Decimal(String(line.tareWeight)).plus(take)
  const math = mathGuard(() => computeLine({ grossWeight: String(line.grossWeight), tareWeight: newTare, deductionWeight: line.deductionWeight === null ? null : Decimal.min(String(line.deductionWeight), net.minus(take)), deductionPercent: line.deductionPercent === null ? null : String(line.deductionPercent), unit: line.unit, unitPrice: line.unitPrice === null ? 0 : String(line.unitPrice), direction: line.direction }, base))
  await tx.ticketLine.update({ where: { id: line.id }, data: { tareWeight: newTare.toFixed(2), netWeight: math.netWeight.toFixed(2), payWeight: math.payWeight.toFixed(2), amountCents: line.unitPrice === null ? 0 : math.signedAmountCents, ...(line.deductionWeight !== null ? { deductionWeight: Decimal.min(String(line.deductionWeight), net.minus(take)).toFixed(2) } : {}) } })
  const created = await addTicketLineTx(ctx, { ticketId: ticket.id, materialId: input.materialId, grossWeight: take.toFixed(2), tareWeight: '0' })
  await ctx.audit({ eventType: 'ticket.line_split', aggregateType: 'TicketLine', aggregateId: line.id, yardId: ticket.yard, after: { newLineId: created.id, weight: take.toFixed(2) } })
  return created
}

export async function removeTicketLineTx(ctx: CommandCtx, input: { lineId: string; reason?: string | null }) {
  const { tx } = ctx
  const line = await tx.ticketLine.findUnique({ where: { id: input.lineId } })
  if (!line) refuse('Line not found.')
  const ticket = await lockOpenTicket(tx, ctx, line.ticketId)
  // Weigh events stay on the ticket; the database lets only their line link be cleared (append-only otherwise).
  await tx.ticketLine.delete({ where: { id: line.id } })
  await ctx.audit({ eventType: 'ticket.line_removed', aggregateType: 'TicketLine', aggregateId: line.id, yardId: ticket.yard, before: { materialId: line.materialId, payWeight: String(line.payWeight), amountCents: line.amountCents }, reason: input.reason || undefined })
  const settings = await businessSettings(tx)
  await recomputeOpenTotals(tx, ticket.id, settings.weightUnit === 'kg' ? 'kg' : 'lb')
  return { id: ticket.id }
}

export async function updateTicketDetailsTx(ctx: CommandCtx, input: { ticketId: string; vehiclePlate?: string | null; vehiclePlateRegion?: string | null; vehicleDescription?: string | null; vehicleId?: string | null; donatePercent?: number | null; nonprofitId?: string | null; campaignId?: string | null; paymentMode?: string | null; fees?: Array<{ label: string; amountCents: number }> | null; notes?: string | null; siteId?: string | null; containerId?: string | null; jobId?: string | null }) {
  const { tx } = ctx
  const ticket = await lockOpenTicket(tx, ctx, input.ticketId)
  const data: Record<string, unknown> = {}
  if (input.vehiclePlate !== undefined) data.vehiclePlate = String(input.vehiclePlate || '').replace(/\s+/g, '').toUpperCase()
  if (input.vehiclePlateRegion !== undefined) data.vehiclePlateRegion = input.vehiclePlateRegion || ''
  if (input.vehicleDescription !== undefined) data.vehicleDescription = input.vehicleDescription || ''
  if (input.vehicleId !== undefined) data.vehicleId = input.vehicleId || null
  if (input.siteId !== undefined) data.siteId = input.siteId || null
  if (input.containerId !== undefined) data.containerId = input.containerId || null
  if (input.jobId !== undefined) data.jobId = input.jobId || null
  if (input.notes !== undefined) data.notes = input.notes || ''
  if (input.donatePercent !== undefined) {
    const pct = Math.trunc(Number(input.donatePercent || 0))
    if (pct < 0 || pct > 100) refuse('Donation percent must be between 0 and 100.')
    data.donatePercent = pct
  }
  if (input.campaignId !== undefined) {
    data.campaignId = input.campaignId || null
    if (input.campaignId) {
      const campaign = await tx.donationCampaign.findUnique({ where: { id: input.campaignId } })
      if (!campaign || campaign.status !== 'active') refuse('That campaign is not active.')
      data.nonprofitId = campaign.accountId
    }
  }
  if (input.nonprofitId !== undefined && input.campaignId === undefined) {
    if (input.nonprofitId) {
      const np = await tx.account.findUnique({ where: { id: input.nonprofitId } })
      if (!np?.isNonprofit || np.status !== 'active') refuse('Donations go only to an active partner nonprofit.')
    }
    data.nonprofitId = input.nonprofitId || null
  }
  if (input.paymentMode !== undefined && input.paymentMode) {
    if (!['pay_now', 'on_account', 'donation_only', 'customer_pays'].includes(input.paymentMode)) refuse('Payment mode is not valid.')
    if (input.paymentMode === 'on_account' && !ticket.account) refuse('Only a commercial account can be put on account.')
    data.paymentMode = input.paymentMode
  }
  if (input.fees !== undefined) {
    const fees = (input.fees || []).map((fee) => ({ label: String(fee.label || '').slice(0, 120), amountCents: Math.trunc(Number(fee.amountCents)) }))
    if (fees.some((fee) => !fee.label || !Number.isSafeInteger(fee.amountCents))) refuse('Each fee needs a label and an amount in cents.')
    data.fees = fees
  }
  const updated = await tx.scaleTicket.update({ where: { id: ticket.id }, data })
  const settings = await businessSettings(tx)
  await recomputeOpenTotals(tx, ticket.id, settings.weightUnit === 'kg' ? 'kg' : 'lb')
  return updated
}

async function recomputeOpenTotals(tx: Tx, ticketId: string, _base: WeightUnitBase) {
  const ticket = await tx.scaleTicket.findUnique({ where: { id: ticketId }, include: { lines: true, yard: true } })
  const totals = computeTicketTotals(ticket.lines.map((l: any) => ({ signedAmountCents: l.amountCents })), Array.isArray(ticket.fees) ? ticket.fees : [], String(ticket.yard?.feeTaxRatePercent ?? 0))
  await tx.scaleTicket.update({ where: { id: ticketId }, data: totals })
  return totals
}

// ---------------------------------------------------------------------------------------------
// Complete
// ---------------------------------------------------------------------------------------------

export async function ticketComplianceChecklist(tx: Tx, ticketId: string, now = new Date()) {
  const ticket = await tx.scaleTicket.findUnique({ where: { id: ticketId }, include: { lines: { include: { material: true } }, attachments: true, seller: true } })
  if (!ticket) refuse('Ticket not found.')
  const { profile, restrictions } = await yardRules(tx, ticket.yardId)
  const identity = ticket.sellerId ? await currentIdentity(tx, ticket.sellerId) : null
  const listMatch = ticket.seller ? await doNotBuyMatch(tx, { sellerId: ticket.sellerId, firstName: ticket.seller.firstName, lastName: ticket.seller.lastName, dateOfBirth: ticket.seller.dateOfBirth, idNumbers: identity ? [identity.number] : [], plate: ticket.vehiclePlate }, now) : null
  const items = validateTicketCompliance({
    direction: ticket.direction,
    isCommercial: Boolean(ticket.accountId),
    isAdjustment: ticket.isAdjustment,
    now,
    seller: ticket.seller ? { status: ticket.seller.status, dateOfBirth: ticket.seller.dateOfBirth, doNotBuyMatch: Boolean(listMatch) } : null,
    identity: identity ? { expiresOn: identity.expiresOn, hasFrontImage: Boolean(identity.frontImage_id), hasThumbprint: Boolean(identity.thumbprintImage_id) } : null,
    vehiclePlate: ticket.vehiclePlate,
    attachments: ticket.attachments.map((a: any) => ({ kind: a.kind, lineId: a.lineId })),
    lines: ticket.lines.map((l: any) => ({ id: l.id, materialId: l.materialId, categoryId: l.material?.categoryId, materialName: l.materialName, hasPrice: l.unitPrice !== null, documents: Array.isArray(l.documents) ? l.documents : [] })),
  }, profile, restrictions)
  return { ticket, profile, restrictions, items, identity }
}

export async function completeTicketTx(ctx: CommandCtx, input: { ticketId: string; overrideReason?: string | null }) {
  const { tx, now } = ctx
  const row = await lockOpenTicket(tx, ctx, input.ticketId)
  const settings = await businessSettings(tx)
  const base = (settings.weightUnit === 'kg' ? 'kg' : 'lb') as WeightUnitBase
  const { ticket, profile, restrictions, items } = await ticketComplianceChecklist(tx, row.id, now)

  // Recompute every line from its stored weights and price snapshot; the server is the source of truth.
  for (const line of ticket.lines) {
    if (line.unitPrice === null) continue
    const math = mathGuard(() => computeLine({ grossWeight: String(line.grossWeight), tareWeight: String(line.tareWeight), deductionWeight: line.deductionWeight === null ? null : String(line.deductionWeight), deductionPercent: line.deductionPercent === null ? null : String(line.deductionPercent), quantity: line.quantity, unit: line.unit, unitPrice: String(line.unitPrice), direction: line.direction }, base))
    if (math.signedAmountCents !== line.amountCents) await tx.ticketLine.update({ where: { id: line.id }, data: { amountCents: math.signedAmountCents, payWeight: math.payWeight.toFixed(2), netWeight: math.netWeight.toFixed(2) } })
    line.amountCents = math.signedAmountCents
    line.payWeight = math.payWeight.toFixed(2)
  }

  const override = input.overrideReason ? { reason: input.overrideReason } : null
  if (override && !hasFlag(ctx.session, MANAGER)) refuse('Only a manager may override a compliance item.')
  const blocking = blockingItems(items, override)
  if (blocking.length) throw new CommandError(`The ticket cannot be completed yet: ${blocking.map((i) => i.message).join(' ')}`, 'COMPLIANCE_INCOMPLETE', { items: blocking })
  const overridden = override ? items.filter((i) => i.overridable) : []

  const totals = computeTicketTotals(ticket.lines.map((l: any) => ({ signedAmountCents: l.amountCents })), Array.isArray(ticket.fees) ? ticket.fees : [], String((await tx.yard.findUnique({ where: { id: ticket.yardId } }))?.feeTaxRatePercent ?? 0))

  if (ticket.direction === 'outbound') {
    await loadShipmentFromTicket(ctx, ticket, totals)
  } else {
    await postInboundEffects(ctx, ticket, totals, profile, restrictions, settings)
  }

  await compareAndSet(tx, 'scaleTicket', ticket.id, 'open', {
    status: 'completed', ...totals, completedById: ctx.actorId, completedAt: now,
    complianceSnapshot: { checkedAt: now.toISOString(), items, overridden: overridden.map((i) => i.code), profile },
    ...(overridden.length ? { overrideReason: String(input.overrideReason), overrideById: ctx.actorId } : {}),
  }, 'This ticket was already completed.')

  if (ticket.containerId) await tx.container.updateMany({ where: { id: ticket.containerId, status: 'in_transit' }, data: { status: 'in_yard', siteId: null, accountId: null, placedOn: null } })

  await ctx.audit({ eventType: 'ticket.completed', aggregateType: 'ScaleTicket', aggregateId: ticket.id, yardId: ticket.yardId, after: { ...totals, lines: ticket.lines.length }, reason: overridden.length ? `Compliance override: ${input.overrideReason}` : undefined })
  // A zero total (or a fully donated one) settles at once (§5.1).
  await maybeSettleTicket(tx, ticket.id, now)
  return tx.scaleTicket.findUnique({ where: { id: ticket.id } })
}

async function postInboundEffects(ctx: CommandCtx, ticket: any, totals: ReturnType<typeof computeTicketTotals>, profile: any, restrictions: any[], settings: any) {
  const { tx, now } = ctx
  // Inventory per line, at the price paid (cost) — §4.5.
  for (const line of ticket.lines) {
    const weight = new Decimal(String(line.payWeight))
    if (weight.isZero()) continue
    // Adjustment tickets carry signed lines: pay_seller adds weight and cost, charge_customer takes them back.
    const sign = ticket.isAdjustment && line.direction === 'charge_customer' ? -1 : 1
    const costDeltaCents = ticket.isAdjustment ? sign * Math.abs(line.amountCents) : Math.max(0, line.amountCents)
    await postMovement(tx, {
      yardId: ticket.yardId, materialId: line.materialId, kind: 'receive', weightDelta: weight.times(sign), costDeltaCents,
      referenceKey: `ticket:${ticket.id}:line:${line.id}:receive`, ticketId: ticket.id, ticketLineId: line.id, actorId: ctx.actorId, allowNegative: false,
    })
    // Material hold ("tag and hold").
    const lineRestrictions = restrictionsForLine({ materialId: line.materialId, categoryId: line.material?.categoryId }, restrictions)
    const holdDays = Math.max(Number(profile.defaultMaterialHoldDays || 0), ...lineRestrictions.map((r: any) => Number(r.materialHoldDays || 0)))
    if (holdDays > 0 && sign > 0) {
      const tag = await tx.holdTag.create({ data: { ticketId: ticket.id, lineId: line.id, yardId: ticket.yardId, materialId: line.materialId, weight: weight.toFixed(2), kind: 'material', status: 'held', releaseAt: new Date(now.getTime() + holdDays * 86_400_000) } })
      await postMovement(tx, { yardId: ticket.yardId, materialId: line.materialId, kind: 'hold', weightDelta: weight, bucket: 'held', referenceKey: `hold:${tag.id}:place`, ticketId: ticket.id, ticketLineId: line.id, actorId: ctx.actorId })
    }
  }

  // Donation (§4.8): a share of a positive total goes to the nonprofit.
  let donationCents = 0
  if (ticket.donatePercent > 0 && totals.totalCents > 0) {
    donationCents = new Decimal(totals.totalCents).times(ticket.donatePercent).div(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
  }
  const goodsDonation = settings.isNonprofit && (ticket.paymentMode === 'donation_only' || (ticket.donatePercent === 100 && !ticket.nonprofitId))
  if (donationCents > 0 || goodsDonation) {
    const receiptNo = await ctx.sequence('business', 'donation_receipt')
    const receiptNumber = `D-${now.getUTCFullYear()}-${String(receiptNo).padStart(6, '0')}`
    await tx.donation.create({
      data: {
        ticketId: ticket.id, sellerId: ticket.sellerId, accountId: goodsDonation ? null : ticket.nonprofitId, campaignId: ticket.campaignId,
        amountCents: goodsDonation ? 0 : donationCents,
        weight: ticket.lines.reduce((s: Decimal, l: any) => s.plus(String(l.payWeight)), new Decimal(0)).toFixed(2),
        itemsSummary: ticket.lines.map((l: any) => ({ material: l.materialName, weight: String(l.payWeight), unit: settings.weightUnit })),
        kind: goodsDonation ? 'goods_donation' : 'payout_donation', status: 'credited', receiptNumber, receiptIssuedAt: now, goodsOrServicesProvided: false,
      },
    })
    if (goodsDonation) donationCents = Math.max(0, totals.totalCents)
  }

  // Money (§4.1 steps 7–8, §4.9.3).
  if (ticket.paymentMode === 'on_account') return
  if (totals.totalCents < 0) {
    const number = await ctx.sequence('business', 'invoice')
    await tx.invoice.create({
      data: {
        number, sellerId: ticket.sellerId, accountId: ticket.accountId, ticketId: ticket.id, kind: 'fee_ticket', status: 'open',
        subtotalCents: -totals.totalCents - totals.taxCents, taxCents: totals.taxCents, totalCents: -totals.totalCents, dueOn: now,
        lines: { create: [
          ...ticket.lines.filter((l: any) => l.amountCents < 0).map((l: any) => ({ description: l.materialName, materialId: l.materialId, weight: String(l.payWeight), unit: l.unit, unitPrice: String(l.unitPrice), amountCents: -l.amountCents, kind: 'fee' })),
          ...ticket.lines.filter((l: any) => l.amountCents > 0).map((l: any) => ({ description: `Less ${l.materialName}`, materialId: l.materialId, weight: String(l.payWeight), unit: l.unit, unitPrice: String(l.unitPrice), amountCents: -l.amountCents, kind: 'credit' })),
          ...(Array.isArray(ticket.fees) ? ticket.fees : []).filter((f: any) => f.amountCents !== 0).map((f: any) => ({ description: f.label, amountCents: -f.amountCents, kind: 'fee' })),
          ...(totals.taxCents ? [{ description: 'Tax on fees', amountCents: totals.taxCents, kind: 'fee' }] : []),
        ] },
      },
    })
    return
  }
  const payable = totals.totalCents - donationCents
  if (payable <= 0 || ticket.paymentMode === 'donation_only') return
  const yard = await tx.yard.findUnique({ where: { id: ticket.yardId } })
  const groups = splitPayouts({
    lines: ticket.lines.map((l: any) => ({ id: l.id, signedAmountCents: l.amountCents, materialId: l.materialId, categoryId: l.material?.categoryId })),
    restrictions, yardMethods: Array.isArray(yard?.payoutMethods) ? yard.payoutMethods : ['cash', 'check', 'transfer'], profile, completedAt: now,
    extraCents: totals.feeTotalCents - totals.taxCents - donationCents,
  })
  const seller = ticket.sellerId ? await tx.seller.findUnique({ where: { id: ticket.sellerId } }) : null
  for (const group of groups) {
    const held = Boolean(group.releaseAt && group.releaseAt.getTime() > now.getTime())
    const payout = await tx.payout.create({
      data: {
        ticketId: ticket.id, sellerId: ticket.sellerId, accountId: ticket.accountId, amountCents: group.amountCents, status: held ? 'held' : 'ready',
        allowedMethods: group.allowedMethods, releaseAt: group.releaseAt,
        mailToAddress: group.mailCheckOnly && seller ? [seller.addressLine1, seller.addressLine2, seller.city, seller.region, seller.postalCode].filter(Boolean).join(', ') : '',
        lines: { connect: group.lineIds.map((id) => ({ id })) },
      },
    })
    await ctx.audit({ eventType: 'payout.created', aggregateType: 'Payout', aggregateId: payout.id, yardId: ticket.yardId, after: { amountCents: group.amountCents, status: payout.status, allowedMethods: group.allowedMethods, releaseAt: group.releaseAt } })
  }
}

// ---------------------------------------------------------------------------------------------
// Void and adjustment
// ---------------------------------------------------------------------------------------------

export async function voidTicketTx(ctx: CommandCtx, input: { ticketId: string; reason: string }) {
  const { tx, now } = ctx
  const reason = String(input.reason || '').trim()
  if (reason.length < 3) refuse('Give a reason for the void.')
  const row = await lockRow(tx, 'ScaleTicket', input.ticketId)
  if (!row) refuse('Ticket not found.')
  requireYard(ctx.session, row.yard)

  if (row.status === 'open') {
    if (!hasFlag(ctx.session, 'canManageTickets') && !hasFlag(ctx.session, 'canVoidTickets')) refuse('You cannot void tickets.')
    await compareAndSet(tx, 'scaleTicket', row.id, 'open', { status: 'voided', voidReason: reason, voidedById: ctx.actorId, voidedAt: now })
    if (row.visit) await tx.visit.updateMany({ where: { id: row.visit, status: 'arrived' }, data: { status: 'booked' } })
    await ctx.audit({ eventType: 'ticket.voided', aggregateType: 'ScaleTicket', aggregateId: row.id, yardId: row.yard, before: { status: 'open' }, after: { status: 'voided' }, reason })
    return tx.scaleTicket.findUnique({ where: { id: row.id } })
  }
  if (row.status !== 'completed') refuse(row.status === 'settled' ? 'A settled ticket never changes. Issue an adjustment ticket.' : 'This ticket is already void.')
  if (!hasFlag(ctx.session, 'canVoidTickets')) refuse('Only a manager may void a completed ticket.')
  if (row.direction === 'outbound') refuse('An outbound ticket with a loaded shipment cannot be voided; cancel or adjust the shipment instead.')

  const payouts = await tx.payout.findMany({ where: { ticketId: row.id } })
  if (payouts.some((p: any) => p.status === 'paid' || p.status === 'returned')) refuse('A payout on this ticket is paid. Issue an adjustment ticket instead.')
  if (row.settlement) {
    const settlement = await tx.settlement.findUnique({ where: { id: row.settlement } })
    if (settlement && settlement.status !== 'draft' && settlement.status !== 'void') refuse('This ticket is on an approved settlement.')
  }
  const invoice = await tx.invoice.findFirst({ where: { ticketId: row.id, kind: 'fee_ticket', status: { not: 'void' } } })
  if (invoice && invoice.paidCents > 0) refuse('A fee on this ticket has been paid. Issue an adjustment ticket instead.')
  if (row.collectedCents > 0) refuse('Cash was collected on this ticket. Issue an adjustment ticket instead.')

  // Reverse inventory exactly, at the cost each movement added.
  const movements = await tx.inventoryMovement.findMany({ where: { ticketId: row.id, kind: { in: ['receive', 'hold'] } } })
  for (const movement of movements.filter((m: any) => m.kind === 'receive')) {
    await postMovement(tx, { yardId: movement.yardId, materialId: movement.materialId, kind: 'reverse', weightDelta: new Decimal(String(movement.weightDelta)).negated(), costDeltaCents: -movement.costDeltaCents, referenceKey: `${movement.referenceKey}:reverse`, ticketId: row.id, ticketLineId: movement.ticketLineId, actorId: ctx.actorId, reason })
  }
  const tags = await tx.holdTag.findMany({ where: { ticketId: row.id, status: { in: ['held', 'police_hold'] } } })
  for (const tag of tags) {
    await compareAndSet(tx, 'holdTag', tag.id, ['held', 'police_hold'], { status: 'cancelled', releasedAt: now, releasedById: ctx.actorId, releaseReason: `Ticket voided: ${reason}` })
    await postMovement(tx, { yardId: tag.yardId, materialId: tag.materialId, kind: 'release', weightDelta: new Decimal(String(tag.weight)).negated(), bucket: 'held', referenceKey: `hold:${tag.id}:release`, ticketId: row.id, actorId: ctx.actorId, reason })
  }
  for (const payout of payouts.filter((p: any) => p.status === 'ready' || p.status === 'held' || p.status === 'pending')) {
    await compareAndSet(tx, 'payout', payout.id, ['ready', 'held', 'pending'], { status: 'cancelled', cancelReason: `Ticket voided: ${reason}` }, 'A payout on this ticket changed while voiding. Try again.')
  }
  await tx.donation.updateMany({ where: { ticketId: row.id, status: { in: ['pledged', 'credited'] } }, data: { status: 'cancelled' } })
  if (invoice) await compareAndSet(tx, 'invoice', invoice.id, ['open'], { status: 'void', voidReason: `Ticket voided: ${reason}` })
  if (row.settlement) await tx.scaleTicket.update({ where: { id: row.id }, data: { settlementId: null } })
  await compareAndSet(tx, 'scaleTicket', row.id, 'completed', { status: 'voided', voidReason: reason, voidedById: ctx.actorId, voidedAt: now })
  await ctx.audit({ eventType: 'ticket.voided', aggregateType: 'ScaleTicket', aggregateId: row.id, yardId: row.yard, before: { status: 'completed', totalCents: row.totalCents }, after: { status: 'voided', reversedMovements: movements.length, cancelledPayouts: payouts.length }, reason })
  return tx.scaleTicket.findUnique({ where: { id: row.id } })
}

/** §4.1 "Correct after payment": a linked adjustment ticket with signed lines. */
export async function createAdjustmentTicketTx(ctx: CommandCtx, input: { ticketId: string; reason: string }) {
  const { tx } = ctx
  if (!hasFlag(ctx.session, MANAGER)) refuse('Only a manager may issue an adjustment ticket.')
  const reason = String(input.reason || '').trim()
  if (reason.length < 3) refuse('Give a reason for the adjustment.')
  const original = await tx.scaleTicket.findUnique({ where: { id: input.ticketId } })
  if (!original) refuse('Ticket not found.')
  requireYard(ctx.session, original.yardId)
  if (!['completed', 'settled'].includes(original.status)) refuse('Only a completed or settled ticket can be adjusted.')
  if (original.isAdjustment) refuse('Adjust the original ticket, not an adjustment.')
  const number = await ctx.sequence(`yard:${original.yardId}`, `${original.direction}_ticket`, original.yardId)
  const ticket = await tx.scaleTicket.create({
    data: {
      yardId: original.yardId, direction: original.direction, number, status: 'open', sellerId: original.sellerId, accountId: original.accountId, siteId: original.siteId,
      vehiclePlate: original.vehiclePlate, vehiclePlateRegion: original.vehiclePlateRegion, vehicleDescription: original.vehicleDescription,
      adjustsId: original.id, isAdjustment: true, paymentMode: original.paymentMode === 'on_account' ? 'on_account' : 'pay_now', lookupCode: randomCode(8),
      openedById: ctx.actorId, notes: reason, fees: [],
    },
  })
  await ctx.audit({ eventType: 'ticket.adjustment_opened', aggregateType: 'ScaleTicket', aggregateId: ticket.id, yardId: original.yardId, after: { adjusts: original.id, number }, reason })
  return ticket
}

// ---------------------------------------------------------------------------------------------
// Scale readings (§10): POST /api/scale-readings with a per-scale key.
// ---------------------------------------------------------------------------------------------

export function hashScaleKey(key: string) {
  return createHash('sha256').update(`recycling-scale:${key}`).digest('hex')
}

export async function issueScaleKeyTx(ctx: CommandCtx, input: { scaleId: string }) {
  const scale = await ctx.tx.scale.findUnique({ where: { id: input.scaleId } })
  if (!scale) refuse('Scale not found.')
  requireYard(ctx.session, scale.yardId)
  const key = `sk_${randomCode(32)}`
  await ctx.tx.scale.update({ where: { id: scale.id }, data: { apiKeyHash: hashScaleKey(key) } })
  await ctx.audit({ eventType: 'scale.key_issued', aggregateType: 'Scale', aggregateId: scale.id, yardId: scale.yardId })
  return { id: scale.id, key }
}

export async function recordScaleReading(prisma: any, key: string, input: { weight: unknown; stable?: unknown }) {
  if (!key) throw new CommandError('Missing scale key.', 'UNAUTHENTICATED')
  const scale = await prisma.scale.findUnique({ where: { apiKeyHash: hashScaleKey(key) } })
  if (!scale || !scale.isActive) throw new CommandError('Unknown scale key.', 'UNAUTHENTICATED')
  const weight = dec(input.weight as any)
  if (weight.isNegative() || !weight.isFinite()) throw new CommandError('Weight is not valid.')
  const now = new Date()
  await prisma.scale.update({ where: { id: scale.id }, data: { lastReadingWeight: weight.toFixed(2), lastReadingAt: now, lastReadingStable: input.stable !== false } })
  return { scaleId: scale.id, weight: weight.toFixed(2), stable: input.stable !== false, at: now.toISOString() }
}

// ---------------------------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------------------------

const refetch = (context: any, id: string) => context.db.ScaleTicket.findOne({ where: { id } })

export const ticketTypeDefs = `
  input TicketFeeInput { label: String!, amountCents: Int! }
  input OpenTicketInput {
    yardId: ID!, direction: String, sellerId: ID, accountId: ID, siteId: ID, vehicleId: ID, vehiclePlate: String, vehiclePlateRegion: String,
    vehicleDescription: String, visitCode: String, jobId: ID, containerId: ID, shipmentId: ID, paymentMode: String, donatePercent: Int,
    nonprofitId: ID, campaignId: ID, overrideReason: String, notes: String
  }
  input TicketLineInput {
    ticketId: ID!, materialId: ID!, grossWeight: String, tareWeight: String, quantity: Int, deductionWeight: String, deductionPercent: String,
    deductionReason: String, unitPrice: String, overrideReason: String, documents: [String!], direction: String, scaleId: ID,
    grossFromScale: Boolean, tareFromScale: Boolean
  }
  input GradeTicketLineInput {
    lineId: ID!, materialId: ID, deductionWeight: String, deductionPercent: String, deductionReason: String, unitPrice: String,
    overrideReason: String, documents: [String!], reprice: Boolean, quantity: Int
  }
  input TruckWeightInput {
    ticketId: ID!, weight: String, scaleId: ID, fromScale: Boolean, materialId: ID, deductionWeight: String, deductionPercent: String,
    deductionReason: String, documents: [String!]
  }
  input TicketDetailsInput {
    ticketId: ID!, vehiclePlate: String, vehiclePlateRegion: String, vehicleDescription: String, vehicleId: ID, donatePercent: Int,
    nonprofitId: ID, campaignId: ID, paymentMode: String, fees: [TicketFeeInput!], notes: String, siteId: ID, containerId: ID, jobId: ID
  }
  type TruckWeightResult { weighEventId: ID!, line: TicketLine }
  type ScaleKeyResult { id: ID!, key: String! }
  type ComplianceItem { code: String!, message: String!, lineId: ID, overridable: Boolean! }
`

export const ticketMutationDefs = `
  openTicket(data: OpenTicketInput!, idempotencyKey: String): ScaleTicket
  addTicketLine(data: TicketLineInput!, idempotencyKey: String): TicketLine
  recordTruckWeight(data: TruckWeightInput!, idempotencyKey: String): TruckWeightResult
  gradeTicketLine(data: GradeTicketLineInput!, idempotencyKey: String): TicketLine
  splitTicketLine(lineId: ID!, weight: String!, materialId: ID!, idempotencyKey: String): TicketLine
  removeTicketLine(lineId: ID!, reason: String, idempotencyKey: String): ScaleTicket
  updateTicketDetails(data: TicketDetailsInput!, idempotencyKey: String): ScaleTicket
  completeTicket(ticketId: ID!, overrideReason: String, idempotencyKey: String): ScaleTicket
  voidTicket(ticketId: ID!, reason: String!, idempotencyKey: String): ScaleTicket
  createAdjustmentTicket(ticketId: ID!, reason: String!, idempotencyKey: String): ScaleTicket
  issueScaleKey(scaleId: ID!): ScaleKeyResult
`

export const ticketQueryDefs = `
  ticketComplianceChecklist(ticketId: ID!): [ComplianceItem!]
`

export const ticketResolvers = {
  Mutation: {
    openTicket: async (_: unknown, { data, idempotencyKey }: any, context: any) => {
      const r = await runCommand(context, { name: 'openTicket', input: data, idempotencyKey: cleanKey(idempotencyKey), permission: 'canManageTickets', aggregateType: 'ScaleTicket' }, (ctx) => openTicketTx(ctx, data))
      return refetch(context, (r as any).id)
    },
    addTicketLine: async (_: unknown, { data, idempotencyKey }: any, context: any) => {
      const r = await runCommand(context, { name: 'addTicketLine', input: data, idempotencyKey: cleanKey(idempotencyKey), permission: [...TICKET_USERS], aggregateType: 'TicketLine' }, (ctx) => addTicketLineTx(ctx, data))
      return context.db.TicketLine.findOne({ where: { id: (r as any).id } })
    },
    recordTruckWeight: async (_: unknown, { data, idempotencyKey }: any, context: any) => {
      const r: any = await runCommand(context, { name: 'recordTruckWeight', input: data, idempotencyKey: cleanKey(idempotencyKey), permission: [...TICKET_USERS] }, (ctx) => recordTruckWeightTx(ctx, data))
      return { weighEventId: r.weighEventId, line: r.lineId ? await context.db.TicketLine.findOne({ where: { id: r.lineId } }) : null }
    },
    gradeTicketLine: async (_: unknown, { data, idempotencyKey }: any, context: any) => {
      const r = await runCommand(context, { name: 'gradeTicketLine', input: data, idempotencyKey: cleanKey(idempotencyKey), permission: [...TICKET_USERS], aggregateType: 'TicketLine' }, (ctx) => gradeTicketLineTx(ctx, data))
      return context.db.TicketLine.findOne({ where: { id: (r as any).id } })
    },
    splitTicketLine: async (_: unknown, args: any, context: any) => {
      const r = await runCommand(context, { name: 'splitTicketLine', input: { lineId: args.lineId, weight: args.weight, materialId: args.materialId }, idempotencyKey: cleanKey(args.idempotencyKey), permission: [...TICKET_USERS] }, (ctx) => splitTicketLineTx(ctx, args))
      return context.db.TicketLine.findOne({ where: { id: (r as any).id } })
    },
    removeTicketLine: async (_: unknown, args: any, context: any) => {
      const r = await runCommand(context, { name: 'removeTicketLine', input: { lineId: args.lineId, reason: args.reason }, idempotencyKey: cleanKey(args.idempotencyKey), permission: [...TICKET_USERS] }, (ctx) => removeTicketLineTx(ctx, args))
      return refetch(context, (r as any).id)
    },
    updateTicketDetails: async (_: unknown, { data, idempotencyKey }: any, context: any) => {
      const r = await runCommand(context, { name: 'updateTicketDetails', input: data, idempotencyKey: cleanKey(idempotencyKey), permission: [...TICKET_USERS] }, (ctx) => updateTicketDetailsTx(ctx, data))
      return refetch(context, (r as any).id)
    },
    completeTicket: async (_: unknown, args: any, context: any) => {
      const r = await runCommand(context, { name: 'completeTicket', input: { ticketId: args.ticketId, overrideReason: args.overrideReason }, idempotencyKey: cleanKey(args.idempotencyKey), permission: [...TICKET_USERS], aggregateType: 'ScaleTicket' }, (ctx) => completeTicketTx(ctx, args))
      return refetch(context, (r as any).id)
    },
    voidTicket: async (_: unknown, args: any, context: any) => {
      const r = await runCommand(context, { name: 'voidTicket', input: { ticketId: args.ticketId, reason: args.reason }, idempotencyKey: cleanKey(args.idempotencyKey), permission: ['canManageTickets', 'canVoidTickets'], aggregateType: 'ScaleTicket' }, (ctx) => voidTicketTx(ctx, args))
      return refetch(context, (r as any).id)
    },
    createAdjustmentTicket: async (_: unknown, args: any, context: any) => {
      const r = await runCommand(context, { name: 'createAdjustmentTicket', input: { ticketId: args.ticketId, reason: args.reason }, idempotencyKey: cleanKey(args.idempotencyKey), permission: MANAGER, aggregateType: 'ScaleTicket' }, (ctx) => createAdjustmentTicketTx(ctx, args))
      return refetch(context, (r as any).id)
    },
    issueScaleKey: async (_: unknown, args: any, context: any) =>
      runCommand(context, { name: 'issueScaleKey', input: args, permission: 'canManageSettings' }, (ctx) => issueScaleKeyTx(ctx, args)),
  },
  Query: {
    ticketComplianceChecklist: async (_: unknown, { ticketId }: any, context: any) => {
      if (!hasFlag(context.session, 'canAccessDashboard')) throw new CommandError('Staff only.', 'FORBIDDEN')
      const ticket = await context.sudo().prisma.scaleTicket.findUnique({ where: { id: ticketId } })
      if (!ticket) refuse('Ticket not found.')
      requireYard(context.session, ticket.yardId)
      const { items } = await ticketComplianceChecklist(context.sudo().prisma, ticketId)
      return items
    },
  },
}

export { asDate }
