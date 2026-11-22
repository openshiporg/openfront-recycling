/**
 * Onboarding (dissertation §11) and publishPrices (§4.4) against a real database.
 *   node --import tsx --test tests/onboarding.integration.ts
 *
 * Runs on the shared scratch database, so it checks what onboarding guarantees (everything exists, a
 * second run adds nothing) rather than exact row counts other tests may also touch.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { keystoneContext } from '../features/keystone/context'
import { ROLE_FLAGS } from '../features/keystone/access'
import { SCRAP_MATERIALS } from '../features/recycling/templates'

const run = randomUUID().slice(0, 6).toUpperCase()
const prisma: any = (keystoneContext as any).prisma
const anon: any = keystoneContext

async function gql(context: any, query: string, variables: any = {}) {
  const res = await context.graphql.raw({ query, variables })
  if (res.errors?.length) throw new Error(res.errors.map((e: any) => `${e.extensions?.code || ''} ${e.message}`).join('; '))
  return JSON.parse(JSON.stringify(res.data))
}
async function staff(flags: Record<string, boolean>) {
  const role = await prisma.role.create({ data: { name: `Onb ${run} ${randomUUID().slice(0, 6)}`, ...flags } })
  const user = await prisma.user.create({ data: { name: `Staff ${run}`, email: `onb-${randomUUID().slice(0, 8)}@yard.example.com`, password: 'not-used-here-123', roleId: role.id } })
  return anon.withSession({ itemId: user.id, listKey: 'User', data: { name: user.name, email: user.email, yards: [], role: { id: role.id, name: role.name, ...flags } } })
}

test('publishPrices closes the open entry and keeps history', async () => {
  const pricer = await staff({ canAccessDashboard: true, canManagePricing: true })
  const list = await prisma.priceList.create({ data: { name: `Board P${run}`, kind: 'board', isActive: true } })
  const mat = await prisma.material.create({ data: { name: `Tubing ${run}`, slug: `tubing-${run.toLowerCase()}`, code: `TB${run}`, defaultUnit: 'lb', isActive: true } })
  const q = `mutation($l: ID!, $e: [PublishPriceInput!]!) { publishPrices(priceListId: $l, entries: $e) { count } }`
  await gql(pricer, q, { l: list.id, e: [{ materialId: mat.id, unitPrice: '3.80' }] })
  await gql(pricer, q, { l: list.id, e: [{ materialId: mat.id, unitPrice: '3.92', unitPriceHigh: '4.00' }] })
  const rows = await prisma.priceEntry.findMany({ where: { priceListId: list.id }, orderBy: { createdAt: 'asc' } })
  assert.equal(rows.length, 2)
  assert.ok(rows[0].effectiveTo, 'first entry closed')
  assert.equal(rows[1].effectiveTo, null)
  await assert.rejects(gql(pricer, q, { l: list.id, e: [{ materialId: mat.id, unitPrice: '5', unitPriceHigh: '4' }] }), /below the low price/)
  const clerk = await staff({ canAccessDashboard: true, canManageTickets: true })
  await assert.rejects(gql(clerk, q, { l: list.id, e: [{ materialId: mat.id, unitPrice: '1' }] }), /permission/)
})

test('runOnboarding sets up a working scrap yard; a second run adds nothing', async () => {
  const owner = await staff(Object.fromEntries(ROLE_FLAGS.map((f) => [f, true])))
  const code = `Y${run.slice(0, 5)}`
  const data = {
    template: 'scrap_yard', rulesTemplate: 'ohio',
    business: { name: 'Riverside Metals', weightUnit: 'lb', currencyCode: 'USD', timezone: 'America/New_York', supportPhone: '(614) 555-0142' },
    yard: { name: `Riverside Metals ${run}`, code, addressLine1: '1840 Joyce Ave', city: 'Columbus', region: 'OH', postalCode: '43219', payoutMethods: ['cash', 'check'] },
  }
  const q = `mutation($d: RunOnboardingInput!) { runOnboarding(data: $d) { id yardSlug materials pricesPublished roles containers } }`
  const first = (await gql(owner, q, { d: data })).runOnboarding
  assert.equal(first.materials, SCRAP_MATERIALS.length)
  assert.equal(first.roles, 10)
  const entriesAfterFirst = await prisma.priceEntry.count()
  const second = (await gql(owner, q, { d: data })).runOnboarding
  assert.equal(second.id, first.id)
  assert.equal(second.pricesPublished, 0, 'prices are not republished')
  assert.equal(await prisma.priceEntry.count(), entriesAfterFirst)

  const board = (await gql(anon, `query($y: String) { publicPriceBoard(yardSlug: $y) { entries { materialName unit unitPrice } } }`, { y: first.yardSlug })).publicPriceBoard
  const bb = board.entries.find((e: any) => e.materialName === 'Bare Bright Copper')
  assert.equal(bb.unitPrice, '4.1')
  assert.ok(!board.entries.some((e: any) => e.materialName === 'Catalytic Converters'), 'converters are priced at the counter, not on the board')
  const rules = (await gql(anon, `query($y: String) { publicYardRules(yardSlug: $y) { requireSellerPhoto restrictions { materialName forbidCash } } }`, { y: first.yardSlug })).publicYardRules
  assert.equal(rules.requireSellerPhoto, true)
  assert.ok(rules.restrictions.some((r: any) => r.materialName === 'Catalytic Converters' && r.forbidCash))
  const biz = (await gql(anon, `{ publicBusiness { name supportPhone } }`)).publicBusiness
  assert.equal(biz.name, 'Riverside Metals')

  const words = JSON.stringify(await prisma.material.findMany({ where: { code: { in: SCRAP_MATERIALS.map((m) => m.code) } }, select: { name: true, description: true, preparationTips: true } }))
  assert.doesNotMatch(words, /\b(demo|sample|test|mock|sandbox)\b/i)
})

test.after(async () => { await prisma.$disconnect() })
