/**
 * Scale ticket flow against a real database (DATABASE_URL). Run:
 *   npm run test:integration -- tests/ticket-flow.integration.ts
 */
import './db-guard'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { keystoneContext } from '../features/keystone/context'
import { ROLE_FLAGS } from '../features/keystone/access'

const run = randomUUID().slice(0, 6).toUpperCase()
const prisma: any = (keystoneContext as any).prisma

async function staffContext(flags: Partial<Record<string, boolean>>, yardIds: string[]) {
  const role = await prisma.role.create({ data: { name: `Yard role ${run} ${randomUUID().slice(0, 8)}`, ...flags } })
  const user = await prisma.user.create({ data: { name: `Scale Operator ${run}`, email: `operator-${run}-${role.id}@yard.example.com`, password: 'x'.repeat(60), roleId: role.id } })
  return keystoneContext.withSession({ itemId: user.id, listKey: 'User', data: { name: user.name, email: user.email, yards: yardIds.map((id) => ({ id })), role: { id: role.id, name: role.name, ...flags } } })
}

async function gql(context: any, query: string, variables: any = {}) {
  const res = await context.graphql.raw({ query, variables })
  if (res.errors?.length) throw new Error(res.errors.map((e: any) => `${e.extensions?.code || ''} ${e.message}`).join('; '))
  return res.data
}

test('inbound ticket: open → weigh → grade → complete → payout; void reverses', async () => {
  const yard = await prisma.yard.create({ data: { name: `North Yard ${run}`, code: `N${run.slice(0, 3)}`, slug: `north-${run.toLowerCase()}`, status: 'active', payoutMethods: ['cash', 'check', 'transfer'] } })
  const list = await prisma.priceList.create({ data: { name: `Board ${run}`, kind: 'board', yardId: yard.id, isActive: true } })
  await prisma.yard.update({ where: { id: yard.id }, data: { boardPriceListId: list.id } })
  const copper = await prisma.material.create({ data: { name: `#1 Copper ${run}`, slug: `copper-${run.toLowerCase()}`, code: `CU1${run}`, defaultUnit: 'lb', direction: 'pay_seller', isActive: true } })
  const brass = await prisma.material.create({ data: { name: `Yellow Brass ${run}`, slug: `brass-${run.toLowerCase()}`, code: `BR${run}`, defaultUnit: 'lb', direction: 'pay_seller', isActive: true } })
  await prisma.priceEntry.create({ data: { priceListId: list.id, materialId: copper.id, unit: 'lb', unitPrice: '3.40000', effectiveFrom: new Date(Date.now() - 60_000) } })
  await prisma.priceEntry.create({ data: { priceListId: list.id, materialId: brass.id, unit: 'lb', unitPrice: '2.10000', effectiveFrom: new Date(Date.now() - 60_000) } })
  const seller = await prisma.seller.create({ data: { firstName: 'Dana', lastName: `Ruiz${run}`, searchName: `dana ruiz${run.toLowerCase()}`, dateOfBirth: new Date('1985-04-02'), status: 'active' } })
  await prisma.identityDocument.create({ data: { sellerId: seller.id, kind: 'drivers_license', number: `D${run}77`, numberNormalized: `D${run}77`, expiresOn: new Date(Date.now() + 365 * 86_400_000), frontImage_id: `id-${run}`, frontImage_extension: 'jpg', isCurrent: true } })

  const owner = await staffContext(Object.fromEntries(ROLE_FLAGS.map((f) => [f, true])), [yard.id])
  const clerk = await staffContext({ canAccessDashboard: true, canManageTickets: true }, [yard.id])

  const open = await gql(owner, `mutation($d: OpenTicketInput!, $k: String) { openTicket(data: $d, idempotencyKey: $k) { id status number } }`, { d: { yardId: yard.id, sellerId: seller.id, vehiclePlate: 'abc 123' }, k: `open-${run}` })
  const ticketId = open.openTicket.id
  assert.equal(open.openTicket.status, 'open')
  const again = await gql(owner, `mutation($d: OpenTicketInput!, $k: String) { openTicket(data: $d, idempotencyKey: $k) { id } }`, { d: { yardId: yard.id, sellerId: seller.id, vehiclePlate: 'abc 123' }, k: `open-${run}` })
  assert.equal(again.openTicket.id, ticketId, 'same idempotency key returns the same ticket')

  const line = await gql(clerk, `mutation($d: TicketLineInput!) { addTicketLine(data: $d) { id netWeight payWeight amountCents priceSource } }`, { d: { ticketId, materialId: copper.id, grossWeight: '152.5', tareWeight: '12.5' } })
  assert.equal(line.addTicketLine.amountCents, 47600) // 140 lb × 3.40
  await assert.rejects(gql(clerk, `mutation($d: TicketLineInput!) { addTicketLine(data: $d) { id } }`, { d: { ticketId, materialId: brass.id, grossWeight: '50', tareWeight: '0', unitPrice: '9', overrideReason: 'friend' } }), /price override permission/)
  const graded = await gql(owner, `mutation($d: GradeTicketLineInput!) { gradeTicketLine(data: $d) { payWeight amountCents } }`, { d: { lineId: line.addTicketLine.id, deductionWeight: '5', deductionReason: 'insulation' } })
  assert.equal(graded.gradeTicketLine.amountCents, 45900) // 135 × 3.40
  await gql(owner, `mutation($d: TicketLineInput!) { addTicketLine(data: $d) { id } }`, { d: { ticketId, materialId: brass.id, grossWeight: '40', tareWeight: '0' } })

  // Compliance blocks completion until photos and signature are attached.
  await assert.rejects(gql(owner, `mutation($t: ID!) { completeTicket(ticketId: $t) { id } }`, { t: ticketId }), /cannot be completed/)
  for (const kind of ['material_photo', 'signature']) {
    await prisma.ticketAttachment.create({ data: { ticketId, kind, image_id: `${kind}-${run}`, image_extension: "jpg", image_filesize: 1000 } })
  }
  const done = await gql(owner, `mutation($t: ID!) { completeTicket(ticketId: $t, idempotencyKey: "c1") { status totalCents } }`, { t: ticketId })
  assert.equal(done.completeTicket.status, 'completed')
  assert.equal(done.completeTicket.totalCents, 45900 + 8400)

  const payouts = await prisma.payout.findMany({ where: { ticketId } })
  assert.equal(payouts.length, 1)
  assert.equal(payouts[0].amountCents, 54300)
  assert.equal(payouts[0].status, 'ready')
  const balance = await prisma.inventoryBalance.findFirst({ where: { yardId: yard.id, materialId: copper.id } })
  assert.equal(String(balance.onHandWeight), '135')
  assert.equal(balance.totalCostCents, 45900)

  await assert.rejects(gql(clerk, `mutation($t: ID!) { voidTicket(ticketId: $t, reason: "wrong seller") { id } }`, { t: ticketId }), /manager/)
  const voided = await gql(owner, `mutation($t: ID!) { voidTicket(ticketId: $t, reason: "wrong seller") { status } }`, { t: ticketId })
  assert.equal(voided.voidTicket.status, 'voided')
  const after = await prisma.inventoryBalance.findFirst({ where: { yardId: yard.id, materialId: copper.id } })
  assert.equal(String(after.onHandWeight), '0')
  assert.equal(after.totalCostCents, 0)
  assert.equal((await prisma.payout.findFirst({ where: { ticketId } })).status, 'cancelled')
  const audit = await prisma.auditEvent.findMany({ where: { aggregateId: ticketId } })
  assert.ok(audit.some((a: any) => a.eventType === 'ticket.voided'))
})

test('a staff member outside the yard cannot open a ticket there', async () => {
  const yard = await prisma.yard.create({ data: { name: `South Yard ${run}`, code: `S${run.slice(0, 3)}`, slug: `south-${run.toLowerCase()}`, status: 'active' } })
  const clerk = await staffContext({ canAccessDashboard: true, canManageTickets: true }, [])
  await assert.rejects(gql(clerk, `mutation($d: OpenTicketInput!) { openTicket(data: $d) { id } }`, { d: { yardId: yard.id, accountId: null } }), /yard/i)
})

test.after(async () => { await prisma.$disconnect() })
