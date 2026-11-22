import { Decimal } from 'decimal.js'
import { hasFlag } from '../access'
import { CommandError, cleanKey, compareAndSet, lockRow, refuse, runCommand, type CommandCtx, type Tx } from '../lib/command'
import { postMovement } from '../lib/inventory'
import { maybeCloseOrder, maybeFulfilOrder } from '../lib/sales'
import { businessSettings } from '../lib/domain'
import { dec, roundCents, unitFactor } from '../../recycling/ticketMath'

/**
 * Selling to mills, brokers and buyers (dissertation §4.7, §5.8, §5.9 claims).
 * Listing weight is taken under a row lock; order confirmation reserves the bulk weight.
 */

const TRADER = 'canManageSales' as const

/** A buyer contact acting for an active buyer account. Staff traders may act for any buyer. */
export async function buyerAccountFor(tx: Tx, session: any, accountId: string) {
  const account = await tx.account.findUnique({ where: { id: accountId } })
  if (!account || !account.isBuyer) refuse('This is not an approved buyer account.')
  if (hasFlag(session, TRADER)) return account
  if (!session?.itemId) throw new CommandError('Sign in first.', 'UNAUTHENTICATED')
  const contact = await tx.accountContact.findFirst({ where: { accountId, userId: session.itemId, status: 'active' } })
  if (!contact) throw new CommandError('Account not found.', 'NOT_FOUND')
  if (account.status !== 'active') refuse('This account is suspended and cannot make offers.')
  return account
}

function closedByDate(listing: any, now: Date) {
  return listing.closesAt && new Date(listing.closesAt) <= now
}

// --- Listings ---
export async function setListingStatusTx(ctx: CommandCtx, input: { listingId: string; status: 'open' | 'paused' | 'closed' }) {
  const listing = await lockRow(ctx.tx, 'Listing', input.listingId)
  if (!listing) refuse('Listing not found.')
  const from: Record<string, string[]> = { open: ['draft', 'paused'], paused: ['open'], closed: ['open', 'paused', 'draft', 'sold_out'] }
  if (!from[input.status]) refuse('Choose open, paused or closed.')
  const data: Record<string, unknown> = { status: input.status }
  if (input.status === 'open' && listing.status === 'draft') {
    const est = listing.estimatedWeight === null ? null : new Decimal(String(listing.estimatedWeight))
    const units = await ctx.tx.inventoryUnit.aggregate({ where: { listingId: listing.id, status: 'available' }, _sum: { weight: true } })
    const weight = units._sum.weight ? new Decimal(String(units._sum.weight)) : est
    if (!weight || !weight.gt(0)) refuse('Give the listing an estimated weight or attach tagged units.')
    data.availableWeight = weight.toFixed(2)
  }
  await compareAndSet(ctx.tx, 'listing', listing.id, from[input.status], data, `A ${listing.status} listing cannot become ${input.status}.`)
  await ctx.audit({ eventType: `listing.${input.status}`, aggregateType: 'Listing', aggregateId: listing.id, before: { status: listing.status } })
  return ctx.tx.listing.findUnique({ where: { id: listing.id } })
}

// --- Offers ---
export async function submitOfferTx(ctx: CommandCtx, input: { listingId: string; accountId: string; weight: string; unitPrice?: string | null; pickupFrom?: string | null; pickupTo?: string | null; message?: string | null; buyNow?: boolean | null }) {
  const { tx, now } = ctx
  const account = await buyerAccountFor(tx, ctx.session, input.accountId)
  const listing = await lockRow(tx, 'Listing', input.listingId)
  if (!listing || listing.status !== 'open' || closedByDate(listing, now)) refuse('This listing is not open.')
  const weight = dec(input.weight)
  if (!weight.gt(0)) refuse('Enter the weight you want.')
  if (listing.minimumWeight !== null && weight.lt(String(listing.minimumWeight))) refuse(`The minimum is ${listing.minimumWeight}.`)
  if (weight.gt(String(listing.availableWeight))) refuse(`Only ${listing.availableWeight} is available.`)
  let price: Decimal
  if (input.buyNow) {
    if (!listing.buyNow || listing.askUnitPrice === null) refuse('This listing has no buy-now price.')
    price = new Decimal(String(listing.askUnitPrice))
  } else {
    if (!listing.allowOffers) refuse('This listing does not take offers.')
    if (input.unitPrice === undefined || input.unitPrice === null || input.unitPrice === '') refuse('Enter your price.')
    price = dec(input.unitPrice)
    if (!price.gt(0)) refuse('Enter a price above zero.')
  }
  const offer = await tx.offer.create({
    data: {
      listingId: listing.id, accountId: account.id, contactId: ctx.actorId, weight: weight.toFixed(2), unitPrice: price.toFixed(5), unit: listing.unit,
      pickupFrom: input.pickupFrom ? new Date(input.pickupFrom) : null, pickupTo: input.pickupTo ? new Date(input.pickupTo) : null,
      message: input.message || '', status: 'submitted', expiresAt: new Date(now.getTime() + 7 * 86_400_000),
    },
  })
  await ctx.audit({ eventType: 'offer.submitted', aggregateType: 'Offer', aggregateId: offer.id, after: { weight: weight.toFixed(2), unitPrice: price.toFixed(5), buyNow: Boolean(input.buyNow) } })
  if (input.buyNow) return acceptOfferInner(ctx, offer.id, null)
  return offer
}

async function acceptOfferInner(ctx: CommandCtx, offerId: string, expected: string | null) {
  const { tx, now } = ctx
  const offer = await lockRow(tx, 'Offer', offerId)
  if (!offer) refuse('Offer not found.')
  if (offer.expiresAt && new Date(offer.expiresAt) <= now && ['submitted', 'countered'].includes(offer.status)) {
    await tx.offer.updateMany({ where: { id: offer.id, status: offer.status }, data: { status: 'expired' } })
    refuse('This offer has expired.')
  }
  const fromStatus = expected || offer.status
  if (!['submitted', 'countered'].includes(fromStatus) || offer.status !== fromStatus) refuse(`This offer is ${offer.status}.`)
  const listing = await lockRow(tx, 'Listing', offer.listing)
  if (!listing || listing.status !== 'open') refuse('The listing is no longer open.')
  const useCounter = offer.status === 'countered'
  const weight = new Decimal(String(useCounter && offer.counterWeight !== null ? offer.counterWeight : offer.weight))
  const price = new Decimal(String(useCounter && offer.counterUnitPrice !== null ? offer.counterUnitPrice : offer.unitPrice))
  const availableWeight = new Decimal(String(listing.availableWeight))
  if (weight.gt(availableWeight)) refuse(`Only ${availableWeight.toFixed(2)} is left on this listing.`)
  const remaining = availableWeight.minus(weight)
  await tx.listing.update({ where: { id: listing.id }, data: { availableWeight: remaining.toFixed(2), ...(remaining.isZero() ? { status: 'sold_out' } : {}) } })
  const account = await tx.account.findUnique({ where: { id: offer.account } })
  const material = await tx.material.findUnique({ where: { id: listing.material } })
  const number = await ctx.sequence('business', 'sales_order')
  const order = await tx.salesOrder.create({
    data: {
      number, yardId: listing.yard, accountId: account.id, status: 'draft', terms: listing.terms, paymentTerms: account.paymentTerms === 'prepay' ? 'prepay' : 'net', netDays: account.netDays,
      weightBasis: account.weightBasis, shipWindowStart: offer.pickupFrom, shipWindowEnd: offer.pickupTo, notes: offer.message || '',
      lines: { create: [{ materialId: listing.material, materialName: material?.name || listing.title, weight: weight.toFixed(2), unit: listing.unit, unitPrice: price.toFixed(5), listingId: listing.id }] },
    },
  })
  await compareAndSet(tx, 'offer', offer.id, fromStatus, { status: 'accepted', decidedById: ctx.actorId, salesOrderId: order.id })
  await confirmOrderInner(ctx, order.id)
  await ctx.audit({ eventType: 'offer.accepted', aggregateType: 'Offer', aggregateId: offer.id, after: { salesOrderId: order.id, weight: weight.toFixed(2), unitPrice: price.toFixed(5) } })
  return tx.offer.findUnique({ where: { id: offer.id } })
}

export async function decideOfferTx(ctx: CommandCtx, input: { offerId: string; decision: 'accept' | 'decline' | 'counter'; reason?: string | null; counterUnitPrice?: string | null; counterWeight?: string | null; counterMessage?: string | null }) {
  const offer = await ctx.tx.offer.findUnique({ where: { id: input.offerId } })
  if (!offer) refuse('Offer not found.')
  if (input.decision === 'accept') return acceptOfferInner(ctx, offer.id, 'submitted')
  if (input.decision === 'decline') {
    const reason = String(input.reason || '').trim()
    if (reason.length < 3) refuse('Give the buyer a reason.')
    await compareAndSet(ctx.tx, 'offer', offer.id, 'submitted', { status: 'declined', decisionReason: reason, decidedById: ctx.actorId })
  } else if (input.decision === 'counter') {
    if (!input.counterUnitPrice && !input.counterWeight) refuse('Counter with a price or a weight.')
    await compareAndSet(ctx.tx, 'offer', offer.id, 'submitted', {
      status: 'countered', decidedById: ctx.actorId, counterMessage: input.counterMessage || '',
      counterUnitPrice: input.counterUnitPrice ? dec(input.counterUnitPrice).toFixed(5) : offer.unitPrice,
      counterWeight: input.counterWeight ? dec(input.counterWeight).toFixed(2) : offer.weight,
      expiresAt: new Date(ctx.now.getTime() + 7 * 86_400_000),
    })
  } else refuse('Choose accept, counter or decline.')
  await ctx.audit({ eventType: `offer.${input.decision}`, aggregateType: 'Offer', aggregateId: offer.id, reason: input.reason || undefined })
  return ctx.tx.offer.findUnique({ where: { id: offer.id } })
}

export async function respondToOfferTx(ctx: CommandCtx, input: { offerId: string; response: 'accept' | 'decline' | 'withdraw' }) {
  const offer = await ctx.tx.offer.findUnique({ where: { id: input.offerId } })
  if (!offer) refuse('Offer not found.')
  await buyerAccountFor(ctx.tx, ctx.session, offer.accountId)
  if (input.response === 'accept') {
    if (offer.status !== 'countered') refuse('Only a counter offer can be accepted by the buyer.')
    return acceptOfferInner(ctx, offer.id, 'countered')
  }
  if (input.response === 'decline') await compareAndSet(ctx.tx, 'offer', offer.id, 'countered', { status: 'declined', decisionReason: 'Buyer declined the counter' })
  else if (input.response === 'withdraw') await compareAndSet(ctx.tx, 'offer', offer.id, ['submitted', 'countered'], { status: 'withdrawn' }, 'This offer can no longer be withdrawn.')
  else refuse('Choose accept, decline or withdraw.')
  await ctx.audit({ eventType: `offer.buyer_${input.response}`, aggregateType: 'Offer', aggregateId: offer.id })
  return ctx.tx.offer.findUnique({ where: { id: offer.id } })
}

// --- Sales orders ---
export async function createSalesOrderTx(ctx: CommandCtx, input: { yardId: string; accountId: string; lines: Array<{ materialId: string; weight: string; unitPrice: string; unit?: string | null; tolerancePercent?: string | null }>; shipTo?: string | null; buyerReference?: string | null; shipWindowStart?: string | null; shipWindowEnd?: string | null; confirm?: boolean | null }) {
  const account = await ctx.tx.account.findUnique({ where: { id: input.accountId } })
  if (!account?.isBuyer) refuse('Choose a buyer account.')
  if (!input.lines?.length) refuse('Add at least one material.')
  const lines = []
  for (const l of input.lines) {
    const material = await ctx.tx.material.findUnique({ where: { id: l.materialId } })
    if (!material) refuse('Material not found.')
    const w = dec(l.weight)
    if (!w.gt(0)) refuse('Each weight must be above zero.')
    lines.push({ materialId: material.id, materialName: material.name, weight: w.toFixed(2), unit: l.unit || material.defaultUnit, unitPrice: dec(l.unitPrice).toFixed(5), tolerancePercent: l.tolerancePercent ? dec(l.tolerancePercent).toFixed(2) : '5' })
  }
  const number = await ctx.sequence('business', 'sales_order')
  const order = await ctx.tx.salesOrder.create({
    data: {
      number, yardId: input.yardId, accountId: account.id, status: 'draft', paymentTerms: account.paymentTerms === 'prepay' ? 'prepay' : 'net', netDays: account.netDays, weightBasis: account.weightBasis,
      shipTo: input.shipTo || '', buyerReference: input.buyerReference || '', shipWindowStart: input.shipWindowStart ? new Date(input.shipWindowStart) : null, shipWindowEnd: input.shipWindowEnd ? new Date(input.shipWindowEnd) : null,
      lines: { create: lines },
    },
  })
  await ctx.audit({ eventType: 'order.created', aggregateType: 'SalesOrder', aggregateId: order.id, after: { number, lines: lines.length } })
  if (input.confirm) await confirmOrderInner(ctx, order.id)
  return order
}

async function confirmOrderInner(ctx: CommandCtx, orderId: string) {
  const order = await lockRow(ctx.tx, 'SalesOrder', orderId)
  if (!order || order.status !== 'draft') refuse('Only a draft order can be confirmed.')
  const lines = await ctx.tx.salesOrderLine.findMany({ where: { orderId } })
  for (const line of lines) {
    const weight = new Decimal(String(line.weight))
    // Reservation follows the negative-stock rule: an order may promise more than is on hand now.
    await postMovement(ctx.tx, { yardId: order.yard, materialId: line.materialId, kind: 'hold', weightDelta: weight, bucket: 'reserved', referenceKey: `order:${orderId}:line:${line.id}:reserve`, actorId: ctx.actorId, reason: `Order ${order.number}` })
    await ctx.tx.salesOrderLine.update({ where: { id: line.id }, data: { reservedWeight: weight.toFixed(2) } })
  }
  await compareAndSet(ctx.tx, 'salesOrder', orderId, 'draft', { status: 'confirmed' })
  await ctx.audit({ eventType: 'order.confirmed', aggregateType: 'SalesOrder', aggregateId: orderId })
}

export async function confirmSalesOrderTx(ctx: CommandCtx, input: { orderId: string }) {
  await confirmOrderInner(ctx, input.orderId)
  return ctx.tx.salesOrder.findUnique({ where: { id: input.orderId } })
}

export async function cancelSalesOrderTx(ctx: CommandCtx, input: { orderId: string; reason: string }) {
  const reason = String(input.reason || '').trim()
  if (reason.length < 3) refuse('Give a reason.')
  const order = await lockRow(ctx.tx, 'SalesOrder', input.orderId)
  if (!order) refuse('Order not found.')
  const lines = await ctx.tx.salesOrderLine.findMany({ where: { orderId: order.id } })
  for (const line of lines) {
    const reserved = new Decimal(String(line.reservedWeight))
    if (reserved.gt(0)) await postMovement(ctx.tx, { yardId: order.yard, materialId: line.materialId, kind: 'release', weightDelta: reserved.negated(), bucket: 'reserved', referenceKey: `order:${order.id}:line:${line.id}:cancel`, actorId: ctx.actorId, reason })
    await ctx.tx.salesOrderLine.update({ where: { id: line.id }, data: { reservedWeight: '0' } })
    if (line.listingId) await ctx.tx.$executeRawUnsafe(`UPDATE "Listing" SET "availableWeight" = "availableWeight" + $1::numeric, "status" = CASE WHEN "status" = 'sold_out' THEN 'open' ELSE "status" END WHERE "id" = $2`, String(line.weight), line.listingId)
  }
  await ctx.tx.shipment.updateMany({ where: { orderId: order.id, status: 'scheduled' }, data: { status: 'cancelled' } })
  await ctx.tx.inventoryUnit.updateMany({ where: { shipment: { orderId: order.id }, status: 'allocated' }, data: { status: 'available', shipmentId: null } })
  await compareAndSet(ctx.tx, 'salesOrder', order.id, ['draft', 'confirmed'], { status: 'cancelled', cancelReason: reason }, 'An order with a loaded shipment cannot be cancelled.')
  await ctx.audit({ eventType: 'order.cancelled', aggregateType: 'SalesOrder', aggregateId: order.id, reason })
  return ctx.tx.salesOrder.findUnique({ where: { id: order.id } })
}

export async function markOrderFulfilledTx(ctx: CommandCtx, input: { orderId: string }) {
  const won = await ctx.tx.salesOrder.updateMany({ where: { id: input.orderId, status: 'in_fulfilment' }, data: { status: 'fulfilled' } })
  if (won.count !== 1) refuse('Only an order in fulfilment can be marked fulfilled.')
  await maybeCloseOrder(ctx.tx, input.orderId)
  await ctx.audit({ eventType: 'order.fulfilled', aggregateType: 'SalesOrder', aggregateId: input.orderId })
  return ctx.tx.salesOrder.findUnique({ where: { id: input.orderId } })
}

// --- Shipments ---
export async function scheduleShipmentTx(ctx: CommandCtx, input: { orderId: string; carrier?: string | null; driverName?: string | null; truckPlate?: string | null; trailerNumber?: string | null; sealNumber?: string | null; scheduledFor?: string | null; freightCents?: number | null; unitIds?: string[] | null }) {
  const order = await ctx.tx.salesOrder.findUnique({ where: { id: input.orderId } })
  if (!order || !['confirmed', 'in_fulfilment'].includes(order.status)) refuse('Confirm the order first.')
  const number = await ctx.sequence('business', 'shipment')
  const shipment = await ctx.tx.shipment.create({
    data: {
      orderId: order.id, number, status: 'scheduled', carrier: input.carrier || '', driverName: input.driverName || '', truckPlate: input.truckPlate || '',
      trailerNumber: input.trailerNumber || '', sealNumber: input.sealNumber || '', bolNumber: `BOL-${String(number).padStart(6, '0')}`,
      scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null, freightCents: Math.max(0, Math.trunc(Number(input.freightCents || 0))), shippedWeight: '0',
    },
  })
  for (const unitId of input.unitIds || []) {
    const won = await ctx.tx.inventoryUnit.updateMany({ where: { id: unitId, status: 'available', yardId: order.yardId }, data: { status: 'allocated', shipmentId: shipment.id } })
    if (won.count !== 1) refuse('A unit is no longer available.')
  }
  await ctx.audit({ eventType: 'shipment.scheduled', aggregateType: 'Shipment', aggregateId: shipment.id, after: { number, units: input.unitIds?.length || 0 } })
  return shipment
}

export async function cancelShipmentTx(ctx: CommandCtx, input: { shipmentId: string; reason: string }) {
  const shipment = await lockRow(ctx.tx, 'Shipment', input.shipmentId)
  if (!shipment) refuse('Shipment not found.')
  if (shipment.status === 'loading') {
    const open = await ctx.tx.scaleTicket.findFirst({ where: { shipmentId: shipment.id, status: 'open' } })
    if (open) refuse('Void the open outbound ticket first.')
  }
  await compareAndSet(ctx.tx, 'shipment', shipment.id, ['scheduled', 'loading'], { status: 'cancelled' }, 'A loaded shipment cannot be cancelled.')
  await ctx.tx.inventoryUnit.updateMany({ where: { shipmentId: shipment.id, status: 'allocated' }, data: { status: 'available', shipmentId: null } })
  await ctx.audit({ eventType: 'shipment.cancelled', aggregateType: 'Shipment', aggregateId: shipment.id, reason: input.reason })
  return ctx.tx.shipment.findUnique({ where: { id: shipment.id } })
}

/** §4.7 step 8: received weight and grade; on a `received` basis the difference becomes an invoice line. */
export async function recordDeliveryTx(ctx: CommandCtx, input: { shipmentId: string; receivedWeight?: string | null; gradeNote?: string | null }) {
  const { tx } = ctx
  const shipment = await lockRow(tx, 'Shipment', input.shipmentId)
  if (!shipment) refuse('Shipment not found.')
  if (!['released', 'loaded'].includes(shipment.status)) refuse('Only a released shipment can be delivered.')
  const order = await tx.salesOrder.findUnique({ where: { id: shipment.order }, include: { lines: true } })
  const received = input.receivedWeight ? dec(input.receivedWeight) : new Decimal(String(shipment.shippedWeight))
  await compareAndSet(tx, 'shipment', shipment.id, ['released', 'loaded'], { status: 'delivered', receivedWeight: received.toFixed(2), receivedGradeNote: input.gradeNote || '', deliveredAt: ctx.now })
  const diff = received.minus(String(shipment.shippedWeight))
  let adjustmentCents = 0
  if (order.weightBasis === 'received' && !diff.isZero() && shipment.invoice) {
    const settings = await businessSettings(tx)
    const base = settings.weightUnit === 'kg' ? 'kg' : 'lb'
    // Spread by shipped weight across order lines; single-material loads are the common case.
    const shipped: Array<{ materialId: string; weight: string }> = Array.isArray(shipment.lines) ? shipment.lines : []
    const total = new Decimal(String(shipment.shippedWeight))
    const invoice = await lockRow(tx, 'Invoice', shipment.invoice)
    for (const s of shipped) {
      const line = order.lines.find((l: any) => l.materialId === s.materialId)
      if (!line || total.isZero()) continue
      const share = diff.times(s.weight).div(total)
      const cents = roundCents(share.times(String(line.unitPrice ?? 0)).div(unitFactor(line.unit, base)).times(100))
      if (cents === 0) continue
      adjustmentCents += cents
      await tx.invoiceLine.create({ data: { invoiceId: invoice.id, description: `Received weight adjustment, ${line.materialName}`, materialId: line.materialId, weight: share.toFixed(2), unit: line.unit, unitPrice: String(line.unitPrice ?? 0), amountCents: cents, kind: 'adjustment' } })
    }
    if (adjustmentCents) {
      const total2 = invoice.totalCents + adjustmentCents
      if (total2 < invoice.paidCents) refuse('The adjustment is more than the unpaid balance; record a claim and refund instead.')
      await tx.invoice.update({ where: { id: invoice.id }, data: { subtotalCents: invoice.subtotalCents + adjustmentCents, totalCents: total2, status: total2 === invoice.paidCents ? 'paid' : invoice.paidCents > 0 ? 'partially_paid' : invoice.status === 'paid' ? 'partially_paid' : invoice.status } })
    }
  }
  await compareAndSet(tx, 'shipment', shipment.id, 'delivered', { status: 'reconciled' })
  await maybeFulfilOrder(tx, order.id)
  await maybeCloseOrder(tx, order.id)
  await ctx.audit({ eventType: 'shipment.delivered', aggregateType: 'Shipment', aggregateId: shipment.id, after: { receivedWeight: received.toFixed(2), adjustmentCents } })
  return tx.shipment.findUnique({ where: { id: shipment.id } })
}

// --- Claims ---
export async function fileClaimTx(ctx: CommandCtx, input: { shipmentId: string; kind: string; description: string; claimedCents: number; photos?: string[] | null }) {
  const shipment = await ctx.tx.shipment.findUnique({ where: { id: input.shipmentId }, include: { order: true } })
  if (!shipment?.order) refuse('Shipment not found.')
  await buyerAccountFor(ctx.tx, ctx.session, shipment.order.accountId)
  if (!['released', 'delivered', 'reconciled'].includes(shipment.status)) refuse('A claim is filed on a shipped load.')
  const amount = Math.trunc(Number(input.claimedCents))
  if (!Number.isSafeInteger(amount) || amount <= 0) refuse('Enter the amount claimed.')
  const claim = await ctx.tx.claim.create({ data: { shipmentId: shipment.id, accountId: shipment.order.accountId, openedById: ctx.actorId, kind: input.kind || 'other', description: String(input.description || ''), photos: input.photos || [], claimedCents: amount, status: 'open' } })
  await ctx.audit({ eventType: 'claim.filed', aggregateType: 'Claim', aggregateId: claim.id, after: { amount } })
  return claim
}

export async function decideClaimTx(ctx: CommandCtx, input: { claimId: string; decision: 'accept' | 'reject'; creditCents?: number | null; reason?: string | null }) {
  const { tx } = ctx
  const claim = await lockRow(tx, 'Claim', input.claimId)
  if (!claim) refuse('Claim not found.')
  if (claim.status !== 'open') refuse(`This claim is ${claim.status}.`)
  const reason = String(input.reason || '').trim()
  if (input.decision === 'reject') {
    if (reason.length < 3) refuse('Give the buyer a reason.')
    await compareAndSet(tx, 'claim', claim.id, 'open', { status: 'rejected', decisionReason: reason, decidedById: ctx.actorId, decidedAt: ctx.now })
    await ctx.audit({ eventType: 'claim.rejected', aggregateType: 'Claim', aggregateId: claim.id, reason })
    return { claim: await tx.claim.findUnique({ where: { id: claim.id } }), refund: null as null | { paymentId: string; amountCents: number } }
  }
  const credit = Math.trunc(Number(input.creditCents ?? claim.claimedCents))
  if (!Number.isSafeInteger(credit) || credit <= 0) refuse('Enter the credit amount.')
  const shipment = await tx.shipment.findUnique({ where: { id: claim.shipment } })
  const invoice = shipment?.invoiceId ? await lockRow(tx, 'Invoice', shipment.invoiceId) : null
  if (!invoice) refuse('This shipment has no invoice to credit.')
  const unpaid = invoice.totalCents - invoice.paidCents
  const creditOnInvoice = Math.min(credit, Math.max(0, unpaid))
  const refundCents = credit - creditOnInvoice
  if (creditOnInvoice > 0) {
    await tx.invoiceLine.create({ data: { invoiceId: invoice.id, description: `Claim credit (${claim.kind})`, amountCents: -creditOnInvoice, kind: 'credit', claimId: claim.id } })
    const total = invoice.totalCents - creditOnInvoice
    await tx.invoice.update({ where: { id: invoice.id }, data: { subtotalCents: invoice.subtotalCents - creditOnInvoice, totalCents: total, status: invoice.paidCents >= total ? 'paid' : invoice.status } })
  }
  let refund: null | { paymentId: string; amountCents: number } = null
  if (refundCents > 0) {
    const payment = await tx.payment.findFirst({ where: { invoiceId: invoice.id, status: 'succeeded' }, orderBy: { amountCents: 'desc' } })
    if (!payment) refuse('Nothing was paid on this invoice to refund.')
    refund = { paymentId: payment.id, amountCents: refundCents }
  }
  await compareAndSet(tx, 'claim', claim.id, 'open', { status: 'accepted', creditCents: credit, decisionReason: reason, decidedById: ctx.actorId, decidedAt: ctx.now })
  await ctx.audit({ eventType: 'claim.accepted', aggregateType: 'Claim', aggregateId: claim.id, after: { creditOnInvoice, refundCents } })
  if (shipment?.orderId) await maybeCloseOrder(tx, shipment.orderId)
  return { claim: await tx.claim.findUnique({ where: { id: claim.id } }), refund }
}

export async function withdrawClaimTx(ctx: CommandCtx, input: { claimId: string }) {
  const claim = await ctx.tx.claim.findUnique({ where: { id: input.claimId } })
  if (!claim) refuse('Claim not found.')
  await buyerAccountFor(ctx.tx, ctx.session, claim.accountId)
  await compareAndSet(ctx.tx, 'claim', claim.id, 'open', { status: 'withdrawn' })
  return ctx.tx.claim.findUnique({ where: { id: claim.id } })
}

// ---------------------------------------------------------------------------------------------

export const salesTypeDefs = `
  input SalesOrderLineInput { materialId: ID!, weight: String!, unitPrice: String!, unit: String, tolerancePercent: String }
`
export const salesMutationDefs = `
  setListingStatus(listingId: ID!, status: String!, idempotencyKey: String): Listing
  submitOffer(listingId: ID!, accountId: ID!, weight: String!, unitPrice: String, pickupFrom: String, pickupTo: String, message: String, buyNow: Boolean, idempotencyKey: String): Offer
  decideOffer(offerId: ID!, decision: String!, reason: String, counterUnitPrice: String, counterWeight: String, counterMessage: String, idempotencyKey: String): Offer
  respondToOffer(offerId: ID!, response: String!, idempotencyKey: String): Offer
  createSalesOrder(yardId: ID!, accountId: ID!, lines: [SalesOrderLineInput!]!, shipTo: String, buyerReference: String, shipWindowStart: String, shipWindowEnd: String, confirm: Boolean, idempotencyKey: String): SalesOrder
  confirmSalesOrder(orderId: ID!, idempotencyKey: String): SalesOrder
  cancelSalesOrder(orderId: ID!, reason: String!, idempotencyKey: String): SalesOrder
  markSalesOrderFulfilled(orderId: ID!, idempotencyKey: String): SalesOrder
  scheduleShipment(orderId: ID!, carrier: String, driverName: String, truckPlate: String, trailerNumber: String, sealNumber: String, scheduledFor: String, freightCents: Int, unitIds: [ID!], idempotencyKey: String): Shipment
  cancelShipment(shipmentId: ID!, reason: String!, idempotencyKey: String): Shipment
  recordShipmentDelivery(shipmentId: ID!, receivedWeight: String, gradeNote: String, idempotencyKey: String): Shipment
  fileClaim(shipmentId: ID!, kind: String!, description: String!, claimedCents: Int!, photos: [String!], idempotencyKey: String): Claim
  decideClaim(claimId: ID!, decision: String!, creditCents: Int, reason: String, idempotencyKey: String): Claim
  withdrawClaim(claimId: ID!, idempotencyKey: String): Claim
`

const one = (c: any, list: string) => (r: any) => (r?.id ? c.sudo().db[list].findOne({ where: { id: r.id } }) : null)
const staffOne = (c: any, list: string) => (r: any) => (r?.id ? c.db[list].findOne({ where: { id: r.id } }) : null)
export const salesResolvers = {
  Mutation: {
    setListingStatus: (_: unknown, a: any, c: any) => runCommand(c, { name: 'setListingStatus', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: TRADER }, (ctx) => setListingStatusTx(ctx, a)).then(staffOne(c, 'Listing')),
    // Buyer commands prove account membership inside the command, then return through sudo.
    submitOffer: (_: unknown, a: any, c: any) => runCommand(c, { name: 'submitOffer', input: a, idempotencyKey: cleanKey(a.idempotencyKey), requireSignIn: true }, (ctx) => submitOfferTx(ctx, a)).then(one(c, 'Offer')),
    decideOffer: (_: unknown, a: any, c: any) => runCommand(c, { name: 'decideOffer', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: TRADER }, (ctx) => decideOfferTx(ctx, a)).then(staffOne(c, 'Offer')),
    respondToOffer: (_: unknown, a: any, c: any) => runCommand(c, { name: 'respondToOffer', input: a, idempotencyKey: cleanKey(a.idempotencyKey), requireSignIn: true }, (ctx) => respondToOfferTx(ctx, a)).then(one(c, 'Offer')),
    createSalesOrder: (_: unknown, a: any, c: any) => runCommand(c, { name: 'createSalesOrder', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: TRADER }, (ctx) => createSalesOrderTx(ctx, a)).then(staffOne(c, 'SalesOrder')),
    confirmSalesOrder: (_: unknown, a: any, c: any) => runCommand(c, { name: 'confirmSalesOrder', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: TRADER }, (ctx) => confirmSalesOrderTx(ctx, a)).then(staffOne(c, 'SalesOrder')),
    cancelSalesOrder: (_: unknown, a: any, c: any) => runCommand(c, { name: 'cancelSalesOrder', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: TRADER }, (ctx) => cancelSalesOrderTx(ctx, a)).then(staffOne(c, 'SalesOrder')),
    markSalesOrderFulfilled: (_: unknown, a: any, c: any) => runCommand(c, { name: 'markSalesOrderFulfilled', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: TRADER }, (ctx) => markOrderFulfilledTx(ctx, a)).then(staffOne(c, 'SalesOrder')),
    scheduleShipment: (_: unknown, a: any, c: any) => runCommand(c, { name: 'scheduleShipment', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: [TRADER, 'canManageDispatch'] }, (ctx) => scheduleShipmentTx(ctx, a)).then(staffOne(c, 'Shipment')),
    cancelShipment: (_: unknown, a: any, c: any) => runCommand(c, { name: 'cancelShipment', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: TRADER }, (ctx) => cancelShipmentTx(ctx, a)).then(staffOne(c, 'Shipment')),
    recordShipmentDelivery: (_: unknown, a: any, c: any) => runCommand(c, { name: 'recordShipmentDelivery', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: TRADER }, (ctx) => recordDeliveryTx(ctx, a)).then(staffOne(c, 'Shipment')),
    fileClaim: (_: unknown, a: any, c: any) => runCommand(c, { name: 'fileClaim', input: a, idempotencyKey: cleanKey(a.idempotencyKey), requireSignIn: true }, (ctx) => fileClaimTx(ctx, a)).then(one(c, 'Claim')),
    decideClaim: async (_: unknown, a: any, c: any) => {
      const r: any = await runCommand(c, { name: 'decideClaim', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: TRADER }, (ctx) => decideClaimTx(ctx, a))
      if (r.refund) {
        const { reserveRefundTx, runProviderRefund } = await import('./money')
        const refund: any = await runCommand(c.sudo(), { name: 'claimRefund', input: { claimId: r.claim.id }, idempotencyKey: `claim:${r.claim.id}` }, (ctx) => reserveRefundTx(ctx, { paymentId: r.refund.paymentId, amountCents: r.refund.amountCents, reason: `Claim ${r.claim.id}`, claimId: r.claim.id }, `claim:${r.claim.id}`))
        if (refund.status === 'pending') await runProviderRefund(c, refund.id)
      }
      return c.db.Claim.findOne({ where: { id: r.claim.id } })
    },
    withdrawClaim: (_: unknown, a: any, c: any) => runCommand(c, { name: 'withdrawClaim', input: a, idempotencyKey: cleanKey(a.idempotencyKey), requireSignIn: true }, (ctx) => withdrawClaimTx(ctx, a)).then(one(c, 'Claim')),
  },
}
