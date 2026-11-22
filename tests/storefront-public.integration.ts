/**
 * Public storefront operations (dissertation §8.1) against a real database.
 *   npm run test:integration -- tests/storefront-public.integration.ts
 */
import './db-guard'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { keystoneContext } from '../features/keystone/context'

const run = randomUUID().slice(0, 6).toUpperCase()
const prisma: any = (keystoneContext as any).prisma
const anon: any = keystoneContext

async function gql(context: any, query: string, variables: any = {}) {
  const res = await context.graphql.raw({ query, variables })
  if (res.errors?.length) throw new Error(res.errors.map((e: any) => `${e.extensions?.code || ''} ${e.message}`).join('; '))
  return JSON.parse(JSON.stringify(res.data))
}

test('price board shows only public entries, latest per material; rules summary hides internals', async () => {
  const profile = await prisma.rulesProfile.create({ data: { name: `Rules ${run}`, requireGovernmentId: true, requireThumbprint: true, cashLimitPerTicketCents: 30000, defaultPaymentHoldDays: 3 } })
  const yard = await prisma.yard.create({ data: { name: `East Yard ${run}`, code: `E${run.slice(0, 4)}`, slug: `east-${run.toLowerCase()}`, status: 'active', acceptsPublic: false, payoutMethods: ['check'], rulesProfileId: profile.id } })
  const list = await prisma.priceList.create({ data: { name: `Board ${run}`, kind: 'board', yardId: yard.id, isActive: true } })
  await prisma.yard.update({ where: { id: yard.id }, data: { boardPriceListId: list.id } })
  const cu = await prisma.material.create({ data: { name: `Bare Bright ${run}`, slug: `bb-${run.toLowerCase()}`, code: `BB${run}`, defaultUnit: 'lb', isActive: true, isPublic: true } })
  const cat = await prisma.material.create({ data: { name: `Converters ${run}`, slug: `cat-${run.toLowerCase()}`, code: `CC${run}`, defaultUnit: 'each', isActive: true, isPublic: true } })
  await prisma.materialRestriction.create({ data: { profileId: profile.id, materialId: cat.id, label: 'Catalytic converters', kind: 'proof_of_ownership', requiredDocuments: ['vehicle_title'], forbidCash: true, paymentHoldDays: 5 } })
  await prisma.priceEntry.create({ data: { priceListId: list.id, materialId: cu.id, unit: 'lb', unitPrice: '3.50000', effectiveFrom: new Date(Date.now() - 86_400_000) } })
  await prisma.priceEntry.create({ data: { priceListId: list.id, materialId: cu.id, unit: 'lb', unitPrice: '3.62000', effectiveFrom: new Date(Date.now() - 60_000) } })
  await prisma.priceEntry.create({ data: { priceListId: list.id, materialId: cat.id, unit: 'each', unitPrice: '80.00000', isPublic: false, effectiveFrom: new Date(Date.now() - 60_000) } })

  const { publicPriceBoard } = await gql(anon, `query($y: String) { publicPriceBoard(yardSlug: $y) { yard { slug } publishedAt entries { materialSlug unitPrice } } }`, { y: yard.slug })
  assert.equal(publicPriceBoard.yard.slug, yard.slug)
  assert.deepEqual(publicPriceBoard.entries, [{ materialSlug: cu.slug, unitPrice: '3.62' }], 'only the latest public entry')

  const { publicYardRules } = await gql(anon, `query($y: String) { publicYardRules(yardSlug: $y) { payoutMethods requireThumbprint cashLimitPerTicketCents defaultPaymentHoldDays restrictions { materialSlug forbidCash requiredDocuments paymentHoldDays } } }`, { y: yard.slug })
  assert.deepEqual(publicYardRules.payoutMethods, ['check'])
  assert.equal(publicYardRules.requireThumbprint, true)
  assert.equal(publicYardRules.cashLimitPerTicketCents, 30000)
  assert.deepEqual(publicYardRules.restrictions, [{ materialSlug: cat.slug, forbidCash: true, requiredDocuments: ['vehicle_title'], paymentHoldDays: 5 }])

  const hist = await gql(anon, `query($m: String!, $y: String) { publicPriceHistory(materialSlug: $m, yardSlug: $y) { unitPrice } }`, { m: cu.slug, y: yard.slug })
  assert.deepEqual(hist.publicPriceHistory.map((p: any) => p.unitPrice), ['3.5', '3.62'])

  // The raw RulesProfile is not readable without staff access.
  const raw = await anon.graphql.raw({ query: `{ rulesProfiles { id } }` })
  assert.ok(raw.errors?.length || (raw.data?.rulesProfiles || []).length === 0)

  await assert.rejects(gql(anon, `{ publicYardRules(yardSlug: "no-such-yard-${run}") { yardName } }`), /Yard not found/)
})

test('guest receipt lookup needs the number and the code; never shows ID data', async () => {
  const yard = await prisma.yard.create({ data: { name: `West Yard ${run}`, code: `W${run.slice(0, 4)}`, slug: `west-${run.toLowerCase()}`, status: 'active', acceptsPublic: false } })
  const seller = await prisma.seller.create({ data: { firstName: 'Ana', lastName: `Cole${run}`, status: 'active' } })
  const ticket = await prisma.scaleTicket.create({ data: { yardId: yard.id, number: 41, direction: 'inbound', status: 'completed', sellerId: seller.id, lookupCode: `LK${run}`, totalCents: 1200, completedAt: new Date() } })
  const number = `${yard.code}-I-000041`
  const ok = await gql(anon, `query($n: String, $c: String) { lookupTicketReceipt(displayNumber: $n, lookupCode: $c) { id displayNumber sellerName totalCents } }`, { n: number, c: `lk${run}`.toLowerCase() })
  assert.equal(ok.lookupTicketReceipt.id, ticket.id)
  assert.equal(ok.lookupTicketReceipt.displayNumber, number)
  await assert.rejects(gql(anon, `query($n: String, $c: String) { lookupTicketReceipt(displayNumber: $n, lookupCode: $c) { id } }`, { n: number, c: 'WRONGCODE' }), /not found/)
})

test.after(async () => { await prisma.$disconnect() })
