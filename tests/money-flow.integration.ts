/**
 * Payouts, cash drawer, fee tickets, settlements and webhooks against a real database.
 *   node --import tsx --test tests/money-flow.integration.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { keystoneContext } from '../features/keystone/context'
import { ROLE_FLAGS } from '../features/keystone/access'
import { RULE_TEMPLATES } from '../features/recycling/compliance'
import { processPaymentWebhook } from '../features/keystone/commands/money'

const run = randomUUID().slice(0, 6).toUpperCase()
const prisma: any = (keystoneContext as any).prisma
const CHECK = String(Date.now()).slice(-7)
const ALL = Object.fromEntries(ROLE_FLAGS.map((f) => [f, true]))

async function staff(flags: Record<string, boolean>, yardIds: string[]) {
  const role = await prisma.role.create({ data: { name: `Yard role ${run} ${randomUUID().slice(0, 8)}`, ...flags } })
  const user = await prisma.user.create({ data: { name: `Cashier ${run}`, email: `cashier-${randomUUID()}@yard.example.com`, password: 'x'.repeat(60), roleId: role.id } })
  return keystoneContext.withSession({ itemId: user.id, listKey: 'User', data: { name: user.name, email: user.email, yards: yardIds.map((id) => ({ id })), role: { id: role.id, name: role.name, ...flags } } })
}
async function gql(context: any, query: string, variables: any = {}) {
  const res = await context.graphql.raw({ query, variables })
  if (res.errors?.length) throw new Error(res.errors.map((e: any) => e.message).join('; '))
  return res.data
}

async function yardWith(opts: { profile?: any; restrictions?: any[] } = {}) {
  const code = randomUUID().slice(0, 4).toUpperCase()
  let rulesProfileId: string | null = null
  if (opts.profile) {
    const profile = await prisma.rulesProfile.create({ data: { name: `Rules ${code}`, ...opts.profile } })
    rulesProfileId = profile.id
  }
  const yard = await prisma.yard.create({ data: { name: `Yard ${code}`, code, slug: `yard-${code.toLowerCase()}-${run.toLowerCase()}`, status: 'active', payoutMethods: ['cash', 'check', 'transfer'], rulesProfileId } })
  const list = await prisma.priceList.create({ data: { name: `Board ${code}`, kind: 'board', yardId: yard.id, isActive: true } })
  await prisma.yard.update({ where: { id: yard.id }, data: { boardPriceListId: list.id } })
  return { yard, list }
}
async function material(listId: string, name: string, price: string, extra: any = {}) {
  const code = `${name.replace(/\W/g, '').slice(0, 6).toUpperCase()}${randomUUID().slice(0, 4)}`
  const m = await prisma.material.create({ data: { name: `${name} ${run}`, slug: code.toLowerCase(), code, defaultUnit: 'lb', direction: 'pay_seller', isActive: true, ...extra } })
  await prisma.priceEntry.create({ data: { priceListId: listId, materialId: m.id, unit: m.defaultUnit, unitPrice: price, effectiveFrom: new Date(Date.now() - 60_000) } })
  return m
}
async function seller() {
  const s = await prisma.seller.create({ data: { firstName: 'Lee', lastName: `Park${randomUUID().slice(0, 4)}`, searchName: 'lee park', dateOfBirth: new Date('1979-01-12'), status: 'active' } })
  await prisma.identityDocument.create({ data: { sellerId: s.id, number: `X${randomUUID().slice(0, 8)}`, numberNormalized: randomUUID(), expiresOn: new Date(Date.now() + 9e10), frontImage_id: 'id', frontImage_extension: 'jpg', thumbprintImage_id: 'tp', thumbprintImage_extension: 'jpg', isCurrent: true } })
  return s
}
async function completedTicket(ctx: any, yardId: string, sellerId: string, lines: Array<{ materialId: string; gross: string }>) {
  const { openTicket } = await gql(ctx, `mutation($d: OpenTicketInput!) { openTicket(data: $d) { id } }`, { d: { yardId, sellerId, vehiclePlate: 'TRK42' } })
  for (const l of lines) await gql(ctx, `mutation($d: TicketLineInput!) { addTicketLine(data: $d) { id } }`, { d: { ticketId: openTicket.id, materialId: l.materialId, grossWeight: l.gross, tareWeight: '0' } })
  for (const kind of ['material_photo', 'signature', 'seller_photo']) await prisma.ticketAttachment.create({ data: { ticketId: openTicket.id, kind, image_id: kind, image_extension: 'jpg' } })
  await gql(ctx, `mutation($t: ID!) { completeTicket(ticketId: $t) { id } }`, { t: openTicket.id })
  return openTicket.id as string
}

test('cash payout: drawer balance, exactly once under a race, variance approval', async () => {
  const { yard, list } = await yardWith()
  const copper = await material(list.id, 'Bare Bright', '4.00')
  const s = await seller()
  const owner = await staff(ALL, [yard.id])
  const cashier = await staff({ canAccessDashboard: true, canPaySellers: true, canManageTickets: true }, [yard.id])
  const drawer = await prisma.cashDrawer.create({ data: { yardId: yard.id, name: `Front ${run}`, isActive: true } })

  const ticketId = await completedTicket(owner, yard.id, s.id, [{ materialId: copper.id, gross: '100' }])
  const payout = await prisma.payout.findFirst({ where: { ticketId } })
  assert.equal(payout.amountCents, 40000)

  const { openDrawerSession } = await gql(cashier, `mutation($d: ID!) { openDrawerSession(drawerId: $d, openingFloatCents: 30000) { id expectedCents } }`, { d: drawer.id })
  await assert.rejects(gql(cashier, `mutation($p: ID!, $s: ID!) { payPayout(payoutId: $p, method: "cash", drawerSessionId: $s) { id } }`, { p: payout.id, s: openDrawerSession.id }), /drawer holds 300.00/)
  await gql(cashier, `mutation($s: ID!) { moveDrawerCash(sessionId: $s, kind: "add", amountCents: 50000, idempotencyKey: "safe-1") { id } }`, { s: openDrawerSession.id })

  const pay = (key: string) => gql(cashier, `mutation($p: ID!, $s: ID!, $k: String) { payPayout(payoutId: $p, method: "cash", drawerSessionId: $s, idempotencyKey: $k) { status } }`, { p: payout.id, s: openDrawerSession.id, k: key })
  const results = await Promise.allSettled([pay('a'), pay('b')])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1, 'only one of two concurrent pays wins')
  const session = await prisma.cashDrawerSession.findUnique({ where: { id: openDrawerSession.id } })
  assert.equal(session.expectedCents, 30000 + 50000 - 40000)
  assert.equal((await prisma.scaleTicket.findUnique({ where: { id: ticketId } })).status, 'settled')

  const counted = await gql(cashier, `mutation($s: ID!) { countDrawer(sessionId: $s, countedCents: 39900) { status varianceCents } }`, { s: openDrawerSession.id })
  assert.deepEqual({ ...counted.countDrawer }, { status: 'counting', varianceCents: -100 })
  await assert.rejects(gql(cashier, `mutation($s: ID!) { approveDrawerClose(sessionId: $s, note: "short a dollar") { status } }`, { s: openDrawerSession.id }), /permission/)
  const closed = await gql(owner, `mutation($s: ID!) { approveDrawerClose(sessionId: $s, note: "short a dollar") { status } }`, { s: openDrawerSession.id })
  assert.equal(closed.approveDrawerClose.status, 'closed')
})

test('Ohio-style split: restricted line held for days, no cash; Florida nickel rounding and cash limit', async () => {
  const ohio = RULE_TEMPLATES.ohio as any
  const { yard, list } = await yardWith({ profile: { ...ohio.profile, region: 'OH', template: 'ohio' } })
  const profile = (await prisma.yard.findUnique({ where: { id: yard.id } })).rulesProfileId
  const wire = await material(list.id, 'Insulated Wire', '1.25')
  const steel = await material(list.id, 'Light Iron', '0.07')
  await prisma.materialRestriction.create({ data: { profileId: profile, materialId: wire.id, label: 'Restricted wire', kind: 'payment_rule', forbidCash: true, paymentHoldDays: 2, requiredDocuments: [] } })
  const owner = await staff(ALL, [yard.id])
  const s = await seller()
  const ticketId = await completedTicket(owner, yard.id, s.id, [{ materialId: wire.id, gross: '20' }, { materialId: steel.id, gross: '300' }])
  const payouts = await prisma.payout.findMany({ where: { ticketId }, orderBy: { amountCents: 'asc' } })
  assert.equal(payouts.length, 2)
  const held = payouts.find((p: any) => p.status === 'held')
  assert.ok(held, 'restricted wire payout is held')
  assert.equal(held.amountCents, 2500)
  assert.ok(!held.allowedMethods.includes('cash'))
  await assert.rejects(gql(owner, `mutation($p: ID!, $c: String) { payPayout(payoutId: $p, method: "check", checkNumber: $c) { id } }`, { p: held.id, c: CHECK }), /held until/)
  const ready = payouts.find((p: any) => p.status === 'ready')
  assert.equal(ready.amountCents, 2100)
  const paid = await gql(owner, `mutation($p: ID!, $c: String) { payPayout(payoutId: $p, method: "check", checkNumber: $c) { status checkNumber } }`, { p: ready.id, c: CHECK })
  assert.equal(paid.payPayout.status, 'paid')
  // The same check number on the same bank account is refused.
  const other = await completedTicket(owner, yard.id, s.id, [{ materialId: steel.id, gross: '100' }])
  const p2 = await prisma.payout.findFirst({ where: { ticketId: other } })
  await assert.rejects(gql(owner, `mutation($p: ID!, $c: String) { payPayout(payoutId: $p, method: "check", checkNumber: $c) { id } }`, { p: p2.id, c: CHECK }), /already used/)

  const fl = RULE_TEMPLATES.florida as any
  const florida = await yardWith({ profile: { ...fl.profile, region: 'FL', template: 'florida' } })
  const brass = await material(florida.list.id, 'Red Brass', '2.13')
  const flOwner = await staff(ALL, [florida.yard.id])
  const drawer = await prisma.cashDrawer.create({ data: { yardId: florida.yard.id, name: `FL ${run}`, isActive: true } })
  const { openDrawerSession } = await gql(flOwner, `mutation($d: ID!) { openDrawerSession(drawerId: $d, openingFloatCents: 500000) { id } }`, { d: drawer.id })
  const t = await completedTicket(flOwner, florida.yard.id, s.id, [{ materialId: brass.id, gross: '1' }])
  const small = await prisma.payout.findFirst({ where: { ticketId: t } })
  assert.equal(small.amountCents, 213)
  await gql(flOwner, `mutation($p: ID!, $s: ID!) { payPayout(payoutId: $p, method: "cash", drawerSessionId: $s) { id } }`, { p: small.id, s: openDrawerSession.id })
  const ev = await prisma.cashDrawerEvent.findFirst({ where: { payoutId: small.id } })
  assert.equal(ev.amountCents, 215, 'cash rounds up to the nickel')
  const big = await completedTicket(flOwner, florida.yard.id, s.id, [{ materialId: brass.id, gross: '600' }])
  const bigPayout = await prisma.payout.findFirst({ where: { ticketId: big } })
  await assert.rejects(gql(flOwner, `mutation($p: ID!, $s: ID!) { payPayout(payoutId: $p, method: "cash", drawerSessionId: $s) { id } }`, { p: bigPayout.id, s: openDrawerSession.id }), /Cash over 1000.00/)
})

test('fee ticket makes an invoice; cash collection settles it', async () => {
  const { yard, list } = await yardWith()
  const tires = await material(list.id, 'Tires', '3.00', { direction: 'charge_customer', defaultUnit: 'each' })
  const owner = await staff(ALL, [yard.id])
  const s = await seller()
  const { openTicket } = await gql(owner, `mutation($d: OpenTicketInput!) { openTicket(data: $d) { id } }`, { d: { yardId: yard.id, sellerId: s.id, vehiclePlate: 'T1' } })
  await gql(owner, `mutation($d: TicketLineInput!) { addTicketLine(data: $d) { amountCents } }`, { d: { ticketId: openTicket.id, materialId: tires.id, grossWeight: '80', tareWeight: '0', quantity: 4 } })
  for (const kind of ['material_photo', 'signature']) await prisma.ticketAttachment.create({ data: { ticketId: openTicket.id, kind, image_id: kind, image_extension: 'jpg' } })
  const done = await gql(owner, `mutation($t: ID!) { completeTicket(ticketId: $t) { totalCents status } }`, { t: openTicket.id })
  assert.equal(done.completeTicket.totalCents, -1200)
  const invoice = await prisma.invoice.findFirst({ where: { ticketId: openTicket.id } })
  assert.equal(invoice.totalCents, 1200)
  const drawer = await prisma.cashDrawer.create({ data: { yardId: yard.id, name: `Fees ${run}`, isActive: true } })
  const { openDrawerSession } = await gql(owner, `mutation($d: ID!) { openDrawerSession(drawerId: $d, openingFloatCents: 0) { id } }`, { d: drawer.id })
  await gql(owner, `mutation($i: ID!, $s: ID!) { recordInvoicePayment(invoiceId: $i, method: "cash", amountCents: 1200, drawerSessionId: $s, idempotencyKey: "fee-1") { id } }`, { i: invoice.id, s: openDrawerSession.id })
  assert.equal((await prisma.invoice.findUnique({ where: { id: invoice.id } })).status, 'paid')
  assert.equal((await prisma.scaleTicket.findUnique({ where: { id: openTicket.id } })).status, 'settled')
  assert.equal((await prisma.cashDrawerSession.findUnique({ where: { id: openDrawerSession.id } })).expectedCents, 1200)
})

test('settlement: positive net makes a payout, a ticket cannot join two settlements', async () => {
  const { yard, list } = await yardWith()
  const alu = await material(list.id, 'Aluminium Cans', '0.60')
  const owner = await staff(ALL, [yard.id])
  const account = await prisma.account.create({ data: { name: `Kessler Fabrication ${run}`, slug: `kessler-${randomUUID().slice(0, 6)}`, status: 'active', paymentTerms: 'on_account', isSupplier: true } })
  const { openTicket } = await gql(owner, `mutation($d: OpenTicketInput!) { openTicket(data: $d) { id paymentMode } }`, { d: { yardId: yard.id, accountId: account.id, vehiclePlate: 'KF1' } })
  assert.equal(openTicket.paymentMode, 'on_account')
  await gql(owner, `mutation($d: TicketLineInput!) { addTicketLine(data: $d) { id } }`, { d: { ticketId: openTicket.id, materialId: alu.id, grossWeight: '1000', tareWeight: '0' } })
  await prisma.ticketAttachment.create({ data: { ticketId: openTicket.id, kind: 'material_photo', image_id: 'm', image_extension: 'jpg' } })
  await gql(owner, `mutation($t: ID!) { completeTicket(ticketId: $t) { id } }`, { t: openTicket.id })
  assert.equal(await prisma.payout.count({ where: { ticketId: openTicket.id } }), 0, 'on-account tickets pay through the settlement')
  await prisma.accountCharge.create({ data: { accountId: account.id, kind: 'rental', description: 'Roll-off rental', amountCents: 7500, status: 'open' } })
  const period = { a: account.id, s: new Date(Date.now() - 86_400_000).toISOString(), e: new Date(Date.now() + 86_400_000).toISOString() }
  const built = await gql(owner, `mutation($a: ID!, $s: String!, $e: String!) { buildSettlement(accountId: $a, periodStart: $s, periodEnd: $e) { id netCents } }`, period)
  assert.equal(built.buildSettlement.netCents, 60000 - 7500)
  await assert.rejects(gql(owner, `mutation($a: ID!, $s: String!, $e: String!) { buildSettlement(accountId: $a, periodStart: $s, periodEnd: $e) { id } }`, period), /Nothing is due/)
  await gql(owner, `mutation($s: ID!) { approveSettlement(settlementId: $s) { status } }`, { s: built.buildSettlement.id })
  const settlement = await prisma.settlement.findUnique({ where: { id: built.buildSettlement.id }, include: { payout: true } })
  assert.equal(settlement.payout.amountCents, 52500)
  await gql(owner, `mutation($p: ID!) { payPayout(payoutId: $p, method: "transfer", transferReference: "ACH 99812") { status } }`, { p: settlement.payout.id })
  assert.equal((await prisma.settlement.findUnique({ where: { id: settlement.id } })).status, 'paid')
  assert.equal((await prisma.scaleTicket.findUnique({ where: { id: openTicket.id } })).status, 'settled')
})

test('payment webhook: a forged signature is refused; a duplicate event is processed once', async () => {
  const secret = `whsec_${randomUUID()}`
  process.env.STRIPE_WEBHOOK_SECRET = secret
  if (!(await prisma.paymentProvider.findFirst({ where: { code: 'pp_stripe' } }))) await prisma.paymentProvider.create({ data: { name: 'Stripe', code: 'pp_stripe', isInstalled: true } })
  const body = JSON.stringify({ id: `evt_${run}`, type: 'checkout.session.completed', data: { object: { object: 'checkout.session', id: `cs_${run}`, metadata: {} } } })
  const raw = new TextEncoder().encode(body)
  const t = Math.floor(Date.now() / 1000)
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')
  const forged = await processPaymentWebhook(keystoneContext, { providerCode: 'stripe', rawBody: raw, headers: { 'stripe-signature': `t=${t},v1=${'0'.repeat(64)}` } })
  assert.equal(forged.status, 400)
  const first = await processPaymentWebhook(keystoneContext, { providerCode: 'stripe', rawBody: raw, headers: { 'stripe-signature': `t=${t},v1=${sig}` } })
  const second = await processPaymentWebhook(keystoneContext, { providerCode: 'stripe', rawBody: raw, headers: { 'stripe-signature': `t=${t},v1=${sig}` } })
  assert.equal(first.ok, true)
  assert.equal((first as any).replayed, false)
  assert.equal((second as any).replayed, true)
  assert.equal(await prisma.paymentWebhookEvent.count({ where: { providerEventId: `pp_stripe:evt_${run}` } }), 1)
})

test.after(async () => { await prisma.$disconnect() })
