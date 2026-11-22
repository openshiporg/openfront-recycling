/**
 * Inventory, processing, transfers, holds, and the full mill sale (listing → offer → order →
 * outbound ticket → invoice → payment → delivery → claim) against a real database.
 */
import './db-guard'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { keystoneContext } from '../features/keystone/context'
import { ROLE_FLAGS } from '../features/keystone/access'

const run = randomUUID().slice(0, 6).toUpperCase()
const prisma: any = (keystoneContext as any).prisma
const ALL = Object.fromEntries(ROLE_FLAGS.map((f) => [f, true]))

async function userSession(flags: Record<string, boolean> | null, yardIds: string[]) {
  const role = flags ? await prisma.role.create({ data: { name: `Sales role ${run} ${randomUUID().slice(0, 8)}`, ...flags } }) : null
  const user = await prisma.user.create({ data: { name: `Trader ${run}`, email: `u-${randomUUID()}@mill.example.com`, password: 'x'.repeat(60), roleId: role?.id ?? null } })
  return { user, ctx: keystoneContext.withSession({ itemId: user.id, listKey: 'User', data: { name: user.name, email: user.email, yards: yardIds.map((id) => ({ id })), role: role ? { id: role.id, name: role.name, ...flags } : null } }) }
}
async function gql(context: any, query: string, variables: any = {}) {
  const res = await context.graphql.raw({ query, variables })
  if (res.errors?.length) throw new Error(res.errors.map((e: any) => e.message).join('; '))
  return res.data
}
async function yard() {
  const code = randomUUID().slice(0, 4).toUpperCase()
  return prisma.yard.create({ data: { name: `Yard ${code}`, code, slug: `yard-${code.toLowerCase()}-${run.toLowerCase()}`, status: 'active', payoutMethods: ['cash', 'check'] } })
}
async function material(name: string) {
  const code = `${name.replace(/\W/g, '').slice(0, 6).toUpperCase()}${randomUUID().slice(0, 4)}`
  return prisma.material.create({ data: { name: `${name} ${run}`, slug: code.toLowerCase(), code, defaultUnit: 'lb', direction: 'pay_seller', isActive: true } })
}
async function stock(ctx: any, yardId: string, materialId: string, weight: string) {
  await gql(ctx, `mutation($y: ID!, $m: ID!, $w: String!, $k: String!) { adjustInventory(yardId: $y, materialId: $m, weightDelta: $w, reason: "Opening count", idempotencyKey: $k) { id } }`, { y: yardId, m: materialId, w: weight, k: randomUUID() })
  // Opening counts arrive at zero cost; give the balance a real cost for the cost-flow checks.
  await prisma.inventoryBalance.updateMany({ where: { yardId, materialId }, data: { totalCostCents: Math.round(Number(weight) * 300) } })
}
const bal = (yardId: string, materialId: string) => prisma.inventoryBalance.findFirst({ where: { yardId, materialId } })

test('processing run spreads cost by weight; transfer receives the weighed amount; tagged unit cannot be used twice', async () => {
  const a = await yard(), b = await yard()
  const { ctx } = await userSession(ALL, [a.id, b.id])
  const wire = await material('Insulated wire'), bright = await material('Bare bright')
  await stock(ctx, a.id, wire.id, '1000')

  const { postProcessingRun } = await gql(ctx, `mutation($y: ID!, $i: [RunLineInput!]!, $o: [RunLineInput!]!) { postProcessingRun(yardId: $y, kind: "strip", inputs: $i, outputs: $o, processingCostCents: 5000) { id lossWeight } }`,
    { y: a.id, i: [{ materialId: wire.id, weight: '1000' }], o: [{ materialId: bright.id, weight: '620', makeUnit: true, form: 'gaylord' }] })
  assert.equal(Number(postProcessingRun.lossWeight), 380)
  const brightBal = await bal(a.id, bright.id)
  assert.equal(Number(brightBal.onHandWeight), 620)
  assert.equal(brightBal.totalCostCents, 300000 + 5000)
  assert.equal(Number((await bal(a.id, wire.id)).onHandWeight), 0)

  const unit = await prisma.inventoryUnit.findFirst({ where: { createdFromRunId: postProcessingRun.id } })
  const send = `mutation($f: ID!, $t: ID!, $u: [ID!]) { sendYardTransfer(fromYardId: $f, toYardId: $t, unitIds: $u) { id status } }`
  const { sendYardTransfer } = await gql(ctx, send, { f: a.id, t: b.id, u: [unit.id] })
  assert.equal(sendYardTransfer.status, 'in_transit')
  await assert.rejects(gql(ctx, send, { f: a.id, t: b.id, u: [unit.id] }), /no longer available/)

  const { receiveYardTransfer } = await gql(ctx, `mutation($t: ID!, $r: [WeightLineInput!]) { receiveYardTransfer(transferId: $t, received: $r) { status } }`, { t: sendYardTransfer.id, r: [{ materialId: bright.id, weight: '615' }] })
  assert.equal(receiveYardTransfer.status, 'received')
  const at = await bal(b.id, bright.id)
  assert.equal(Number(at.onHandWeight), 615)
  assert.equal(at.totalCostCents, 305000)
  assert.equal((await prisma.inventoryUnit.findUnique({ where: { id: unit.id } })).yardId, b.id)
})

test('negative-stock rule brings the balance to zero and flags it for review', async () => {
  const a = await yard()
  const { ctx } = await userSession(ALL, [a.id])
  const hms = await material('HMS 1'), shred = await material('Shred')
  await stock(ctx, a.id, hms.id, '100')
  await gql(ctx, `mutation($y: ID!, $f: ID!, $t: ID!) { regradeInventory(yardId: $y, fromMaterialId: $f, toMaterialId: $t, weight: "150", reason: "Graded down", idempotencyKey: "${randomUUID()}") { id } }`, { y: a.id, f: hms.id, t: shred.id })
  assert.equal(Number((await bal(a.id, hms.id)).onHandWeight), 0)
  const flagged = await prisma.inventoryMovement.findFirst({ where: { yardId: a.id, materialId: hms.id, needsReview: true } })
  assert.equal(Number(flagged.weightDelta), 50)
  assert.equal(Number((await bal(a.id, shred.id)).onHandWeight), 150)
})

test('mill sale: buy now, reserve, outbound ticket, prepay release on payment, received-weight adjustment, claim credit', async () => {
  const a = await yard()
  const { ctx: trader } = await userSession(ALL, [a.id])
  const copper = await material('Copper 2')
  await stock(trader, a.id, copper.id, '20000')

  const account = await prisma.account.create({ data: { name: `Mill ${run}`, slug: `mill-${run.toLowerCase()}-${randomUUID().slice(0, 4)}`, status: 'active', isBuyer: true, paymentTerms: 'prepay', weightBasis: 'received' } })
  const { user: buyerUser, ctx: buyer } = await userSession(null, [])
  await prisma.accountContact.create({ data: { accountId: account.id, userId: buyerUser.id, role: 'admin', status: 'active' } })
  const { ctx: stranger } = await userSession(null, [])

  const listing = await prisma.listing.create({ data: { yardId: a.id, title: `Copper 2 load ${run}`, materialId: copper.id, form: 'loose', estimatedWeight: '10000', availableWeight: '0', askUnitPrice: '3.10000', unit: 'lb', allowOffers: true, buyNow: true, minimumWeight: '1000', status: 'draft' } })
  await gql(trader, `mutation($l: ID!) { setListingStatus(listingId: $l, status: "open") { status availableWeight } }`, { l: listing.id })

  const offer = `mutation($l: ID!, $a: ID!, $w: String!) { submitOffer(listingId: $l, accountId: $a, weight: $w, buyNow: true) { id status } }`
  await assert.rejects(gql(stranger, offer, { l: listing.id, a: account.id, w: '8000' }), /not found/i)
  await assert.rejects(gql(buyer, offer, { l: listing.id, a: account.id, w: '12000' }), /available/)
  const { submitOffer } = await gql(buyer, offer, { l: listing.id, a: account.id, w: '8000' })
  assert.equal(submitOffer.status, 'accepted')
  const orderId = (await prisma.offer.findUnique({ where: { id: submitOffer.id } })).salesOrderId
  assert.equal((await prisma.salesOrder.findUnique({ where: { id: orderId } })).status, 'confirmed')
  assert.equal(Number((await bal(a.id, copper.id)).reservedWeight), 8000)
  assert.equal(Number((await prisma.listing.findUnique({ where: { id: listing.id } })).availableWeight), 2000)

  const { scheduleShipment } = await gql(trader, `mutation($o: ID!) { scheduleShipment(orderId: $o, carrier: "Ridge Freight", truckPlate: "MILL7", sealNumber: "S-88") { id bolNumber } }`, { o: orderId })
  assert.match(scheduleShipment.bolNumber, /^BOL-/)

  const { openTicket } = await gql(trader, `mutation($d: OpenTicketInput!) { openTicket(data: $d) { id paymentMode } }`, { d: { yardId: a.id, direction: 'outbound', shipmentId: scheduleShipment.id, vehiclePlate: 'MILL7' } })
  assert.equal(openTicket.paymentMode, 'customer_pays')
  await gql(trader, `mutation($d: TicketLineInput!) { addTicketLine(data: $d) { id unitPrice amountCents } }`, { d: { ticketId: openTicket.id, materialId: copper.id, grossWeight: '40000', tareWeight: '32000' } })
  await prisma.ticketAttachment.create({ data: { ticketId: openTicket.id, kind: 'material_photo', image_id: 'load', image_extension: 'jpg' } })
  await gql(trader, `mutation($t: ID!) { completeTicket(ticketId: $t) { id status } }`, { t: openTicket.id })

  let shipment = await prisma.shipment.findUnique({ where: { id: scheduleShipment.id }, include: { invoice: true } })
  assert.equal(shipment.status, 'loaded')
  assert.equal(shipment.invoice.totalCents, 2480000)
  const b1 = await bal(a.id, copper.id)
  assert.equal(Number(b1.onHandWeight), 12000)
  assert.equal(Number(b1.reservedWeight), 0)

  await gql(trader, `mutation($i: ID!, $k: String!) { recordInvoicePayment(invoiceId: $i, method: "wire", amountCents: 2480000, reference: "FED-${run}", idempotencyKey: $k) { id } }`, { i: shipment.invoiceId, k: randomUUID() })
  shipment = await prisma.shipment.findUnique({ where: { id: scheduleShipment.id }, include: { invoice: true } })
  assert.equal(shipment.status, 'released')
  assert.equal(shipment.invoice.status, 'paid')

  // The mill weighs 7,950 lb: a 50 lb short-weight credit exceeds the unpaid balance, so it is refused.
  await assert.rejects(gql(trader, `mutation($s: ID!) { recordShipmentDelivery(shipmentId: $s, receivedWeight: "7950") { status } }`, { s: shipment.id }), /claim and refund/)
  const { recordShipmentDelivery } = await gql(trader, `mutation($s: ID!) { recordShipmentDelivery(shipmentId: $s, receivedWeight: "8000", gradeNote: "Clean") { status } }`, { s: shipment.id })
  assert.equal(recordShipmentDelivery.status, 'reconciled')
  assert.equal((await prisma.salesOrder.findUnique({ where: { id: orderId } })).status, 'closed')

  const { fileClaim } = await gql(buyer, `mutation($s: ID!) { fileClaim(shipmentId: $s, kind: "contamination", description: "Insulation in two spots", claimedCents: 15000) { id status } }`, { s: shipment.id })
  assert.equal(fileClaim.status, 'open')
  const rejected = gql(trader, `mutation($c: ID!) { decideClaim(claimId: $c, decision: "reject") { status } }`, { c: fileClaim.id })
  await assert.rejects(rejected, /reason/)

  // §8.4 buyer portal reads for the same records.
  const slug = { s: account.slug }
  const offers = (await gql(buyer, `query($s: String!) { accountOffers(accountSlug: $s) { id status salesOrderId canWithdraw } }`, slug)).accountOffers
  assert.deepEqual(offers.map((o: any) => [o.id, o.status, o.salesOrderId, o.canWithdraw]), [[submitOffer.id, 'accepted', orderId, false]])
  const orders = (await gql(buyer, `query($s: String!) { accountSalesOrders(accountSlug: $s) { id status orderedWeight shippedWeight } }`, slug)).accountSalesOrders
  assert.deepEqual([orders[0].id, orders[0].status, orders[0].orderedWeight, orders[0].shippedWeight], [orderId, 'closed', '8000', '8000'])
  const order = (await gql(buyer, `query($s: String!, $id: ID!) { accountSalesOrder(accountSlug: $s, id: $id) { shipments { bolNumber sealNumber receivedWeight gatePass { bolNumber } invoice { status } canClaim } } }`, { ...slug, id: orderId })).accountSalesOrder
  assert.equal(order.shipments[0].sealNumber, 'S-88')
  assert.equal(order.shipments[0].gatePass.bolNumber, scheduleShipment.bolNumber)
  assert.equal(order.shipments[0].invoice.status, 'paid')
  assert.equal(order.shipments[0].canClaim, true)
  const claims = (await gql(buyer, `query($s: String!) { accountClaims(accountSlug: $s) { id status claimedCents canWithdraw } }`, slug)).accountClaims
  assert.deepEqual(claims.map((c: any) => [c.id, c.status, c.claimedCents, c.canWithdraw]), [[fileClaim.id, 'open', 15000, true]])
  const report = (await gql(buyer, `query($s: String!, $y: Int!) { accountPurchaseReport(accountSlug: $s, year: $y) { rows { materialName weight valueCents } } }`, { ...slug, y: new Date().getUTCFullYear() })).accountPurchaseReport
  assert.deepEqual(report.rows.map((r: any) => [r.materialName, r.weight, r.valueCents]), [[copper.name, '8000', 2480000]])
  await assert.rejects(gql(stranger, `query($s: String!) { accountSalesOrders(accountSlug: $s) { id } }`, slug), /not found/i)
  await assert.rejects(gql(stranger, `query($s: String!, $id: ID!) { accountSalesOrder(accountSlug: $s, id: $id) { id } }`, { ...slug, id: orderId }), /not found/i)
})
