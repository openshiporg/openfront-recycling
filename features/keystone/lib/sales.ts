import { Decimal } from 'decimal.js'
import { compareAndSet, lockRow, refuse, type CommandCtx, type Tx } from './command'
import { postMovement } from './inventory'
import { roundCents, unitFactor } from '../../recycling/ticketMath'

/**
 * Outbound side of the scale (dissertation §4.7 steps 5–6, §5.8): an outbound ticket loads a
 * shipment; on completion the weights are final, inventory ships, units move to `shipped`, and the
 * invoice is issued. Net-terms loads release at once; prepay loads wait for the invoice to be paid.
 */

export async function startShipmentLoading(ctx: CommandCtx, shipmentId: string) {
  const shipment = await lockRow(ctx.tx, 'Shipment', shipmentId)
  if (!shipment) refuse('Shipment not found.')
  if (shipment.status !== 'scheduled') refuse(`This shipment is ${shipment.status}; only a scheduled shipment can start loading.`)
  await compareAndSet(ctx.tx, 'shipment', shipmentId, 'scheduled', { status: 'loading' })
  const order = await ctx.tx.salesOrder.findUnique({ where: { id: shipment.order } })
  if (!order || !['confirmed', 'in_fulfilment'].includes(order.status)) refuse('The sales order is not confirmed.')
  return { shipment, order }
}

/** Unit price for an outbound line comes from the sales order, never the buy board. */
export async function orderLinePrice(tx: Tx, shipmentId: string, materialId: string) {
  const shipment = await tx.shipment.findUnique({ where: { id: shipmentId }, include: { order: { include: { lines: true } } } })
  const line = shipment?.order?.lines.find((l: any) => l.materialId === materialId)
  if (!line || line.unitPrice === null) return null
  return { unitPrice: new Decimal(String(line.unitPrice)).toFixed(5), unit: line.unit, orderLineId: line.id }
}

export function withinTolerance(shipped: Decimal, ordered: Decimal, tolerancePercent: Decimal) {
  return shipped.gte(ordered.times(new Decimal(100).minus(tolerancePercent)).div(100))
}

export async function loadShipmentFromTicket(ctx: CommandCtx, ticket: any, totals: { totalCents: number }) {
  const { tx, now } = ctx
  if (!ticket.shipmentId) refuse('An outbound ticket must be for a shipment.')
  const shipment = await lockRow(tx, 'Shipment', ticket.shipmentId)
  if (!shipment || shipment.status !== 'loading') refuse('The shipment is not loading.')
  const order = await tx.salesOrder.findUnique({ where: { id: shipment.order }, include: { lines: true, account: true } })
  if (!order) refuse('Sales order not found.')
  const settings = (await tx.businessSettings.findFirst()) || { weightUnit: 'lb' }
  const base = settings.weightUnit === 'kg' ? 'kg' : 'lb'

  const units = await tx.inventoryUnit.findMany({ where: { shipmentId: shipment.id } })
  const byMaterial = new Map<string, Decimal>()
  for (const line of ticket.lines) byMaterial.set(line.materialId, (byMaterial.get(line.materialId) || new Decimal(0)).plus(String(line.payWeight)))
  for (const unit of units) if (!byMaterial.has(unit.materialId)) byMaterial.set(unit.materialId, new Decimal(0))
  for (const unit of units) {
    if (!ticket.lines.some((l: any) => l.materialId === unit.materialId)) byMaterial.set(unit.materialId, byMaterial.get(unit.materialId)!.plus(String(unit.weight)))
  }
  if (!byMaterial.size) refuse('Nothing was loaded.')

  const invoiceLines: any[] = []
  let shippedTotal = new Decimal(0)
  for (const [materialId, weight] of byMaterial) {
    const orderLine = order.lines.find((l: any) => l.materialId === materialId)
    if (!orderLine) refuse('A loaded material is not on the sales order.')
    shippedTotal = shippedTotal.plus(weight)
    await postMovement(tx, { yardId: ticket.yardId, materialId, kind: 'ship', weightDelta: weight.negated(), referenceKey: `shipment:${shipment.id}:material:${materialId}:ship`, ticketId: ticket.id, actorId: ctx.actorId, reason: `Shipment ${shipment.number}` })
    const release = Decimal.min(new Decimal(String(orderLine.reservedWeight)), weight)
    if (release.gt(0)) await postMovement(tx, { yardId: ticket.yardId, materialId, kind: 'release', weightDelta: release.negated(), bucket: 'reserved', referenceKey: `shipment:${shipment.id}:material:${materialId}:unreserve`, ticketId: ticket.id, actorId: ctx.actorId })
    await tx.salesOrderLine.update({ where: { id: orderLine.id }, data: { shippedWeight: new Decimal(String(orderLine.shippedWeight)).plus(weight).toFixed(2), reservedWeight: new Decimal(String(orderLine.reservedWeight)).minus(release).toFixed(2) } })
    const amountCents = roundCents(weight.times(String(orderLine.unitPrice ?? 0)).div(unitFactor(orderLine.unit, base)).times(100))
    invoiceLines.push({ description: orderLine.materialName, materialId, weight: weight.toFixed(2), unit: orderLine.unit, unitPrice: String(orderLine.unitPrice ?? 0), amountCents, kind: 'material' })
  }
  for (const unit of units) {
    const won = await tx.inventoryUnit.updateMany({ where: { id: unit.id, status: 'allocated', shipmentId: shipment.id }, data: { status: 'shipped' } })
    if (won.count !== 1) refuse(`Unit ${unit.tagNumber} is no longer allocated to this shipment.`)
  }
  if (shipment.freightCents) invoiceLines.push({ description: 'Freight', amountCents: shipment.freightCents, kind: 'freight' })

  const subtotal = invoiceLines.reduce((s, l) => s + l.amountCents, 0)
  const number = await ctx.sequence('business', 'invoice')
  const invoice = await tx.invoice.create({
    data: {
      number, accountId: order.accountId, kind: 'sale', status: subtotal > 0 ? 'open' : 'paid', subtotalCents: subtotal, taxCents: 0, totalCents: subtotal,
      dueOn: order.paymentTerms === 'prepay' ? now : new Date(now.getTime() + Number(order.netDays || 0) * 86_400_000), shipmentId: shipment.id,
      lines: { create: invoiceLines },
    },
  })
  const release = order.paymentTerms !== 'prepay' || subtotal <= 0
  await compareAndSet(tx, 'shipment', shipment.id, 'loading', {
    status: release ? 'released' : 'loaded', shippedWeight: shippedTotal.toFixed(2), invoiceId: invoice.id, releasedAt: release ? now : null,
    lines: [...byMaterial].map(([materialId, weight]) => ({ materialId, weight: weight.toFixed(2) })),
  })
  if (order.status === 'confirmed') await compareAndSet(tx, 'salesOrder', order.id, 'confirmed', { status: 'in_fulfilment' })
  await maybeFulfilOrder(tx, order.id)
  await ctx.audit({ eventType: 'shipment.loaded', aggregateType: 'Shipment', aggregateId: shipment.id, after: { shippedWeight: shippedTotal.toFixed(2), invoiceId: invoice.id, released: release, totalCents: totals.totalCents } })
  return { invoiceId: invoice.id }
}

export async function maybeFulfilOrder(tx: Tx, orderId: string) {
  const order = await tx.salesOrder.findUnique({ where: { id: orderId }, include: { lines: true } })
  if (!order || order.status !== 'in_fulfilment') return false
  const done = order.lines.every((l: any) => withinTolerance(new Decimal(String(l.shippedWeight)), new Decimal(String(l.weight)), new Decimal(String(l.tolerancePercent ?? 5))))
  if (!done) return false
  const won = await tx.salesOrder.updateMany({ where: { id: orderId, status: 'in_fulfilment' }, data: { status: 'fulfilled' } })
  return won.count === 1
}

/** §4.7 step 10: closes when every shipment is invoiced and paid and no claim is open. */
export async function maybeCloseOrder(tx: Tx, orderId: string) {
  const order = await tx.salesOrder.findUnique({ where: { id: orderId }, include: { shipments: { include: { invoice: true } } } })
  if (!order || order.status !== 'fulfilled') return false
  const live = order.shipments.filter((s: any) => s.status !== 'cancelled')
  if (!live.length || live.some((s: any) => !s.invoice || s.invoice.status !== 'paid')) return false
  const openClaim = await tx.claim.findFirst({ where: { shipmentId: { in: live.map((s: any) => s.id) }, status: 'open' } })
  if (openClaim) return false
  const won = await tx.salesOrder.updateMany({ where: { id: orderId, status: 'fulfilled' }, data: { status: 'closed' } })
  return won.count === 1
}

/** Called when an invoice becomes paid: a prepay load is released, the order may close. */
export async function afterSaleInvoicePaid(tx: Tx, invoice: any, now = new Date()) {
  if (!invoice.shipmentId) return
  await tx.shipment.updateMany({ where: { id: invoice.shipmentId, status: 'loaded' }, data: { status: 'released', releasedAt: now } })
  const shipment = await tx.shipment.findUnique({ where: { id: invoice.shipmentId } })
  if (shipment?.orderId) await maybeCloseOrder(tx, shipment.orderId)
}
