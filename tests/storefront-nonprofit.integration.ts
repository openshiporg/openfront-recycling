/**
 * Nonprofit portal (dissertation §8.5 N1 to N3) against a real database: profile, campaign, and the
 * donation a seller makes from a completed ticket, with the donor name hidden unless they agreed.
 *   npm run test:integration -- tests/storefront-nonprofit.integration.ts
 */
import './db-guard'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { keystoneContext } from '../features/keystone/context'
import { ROLE_FLAGS } from '../features/keystone/access'

const run = randomUUID().slice(0, 6).toUpperCase()
const prisma: any = (keystoneContext as any).prisma

async function session(flags: Record<string, boolean> | null, yardIds: string[]) {
  const role = flags ? await prisma.role.create({ data: { name: `NP ${run} ${randomUUID().slice(0, 6)}`, ...flags } }) : null
  const user = await prisma.user.create({ data: { name: `Volunteer ${run}`, email: `np-${randomUUID().slice(0, 8)}@charity.example.org`, password: 'x'.repeat(60), roleId: role?.id ?? null } })
  const ctx = keystoneContext.withSession({ itemId: user.id, listKey: 'User', data: { name: user.name, email: user.email, yards: yardIds.map((id) => ({ id })), role: role ? { id: role.id, name: role.name, ...flags } : null } })
  return { user, ctx }
}
async function gql(context: any, query: string, variables: any = {}) {
  const res = await context.graphql.raw({ query, variables })
  if (res.errors?.length) throw new Error(res.errors.map((e: any) => `${e.extensions?.code || ''} ${e.message}`).join('; '))
  return JSON.parse(JSON.stringify(res.data))
}

test('nonprofit contact edits the profile, runs a campaign and sees credited donations', async () => {
  const yard = await prisma.yard.create({ data: { name: `NP Yard ${run}`, code: `N${run.slice(0, 4)}`, slug: `np-${run.toLowerCase()}`, status: 'active', payoutMethods: ['cash', 'check'] } })
  const list = await prisma.priceList.create({ data: { name: `Board ${run}`, kind: 'board', yardId: yard.id, isActive: true } })
  await prisma.yard.update({ where: { id: yard.id }, data: { boardPriceListId: list.id } })
  const cans = await prisma.material.create({ data: { name: `Aluminum Cans ${run}`, slug: `cans-${run.toLowerCase()}`, code: `AC${run}`, defaultUnit: 'lb', isActive: true } })
  await prisma.priceEntry.create({ data: { priceListId: list.id, materialId: cans.id, unit: 'lb', unitPrice: '0.60000', effectiveFrom: new Date(Date.now() - 60_000) } })
  const np = await prisma.account.create({ data: { name: `Hilltop Food Pantry ${run}`, slug: `hilltop-${run.toLowerCase()}`, status: 'active', isNonprofit: true, ein: '31-1234567' } })
  const { user: admin, ctx: npAdmin } = await session(null, [])
  await prisma.accountContact.create({ data: { accountId: np.id, userId: admin.id, role: 'admin', status: 'active' } })
  const { ctx: stranger } = await session(null, [])
  const { ctx: staff } = await session(Object.fromEntries(ROLE_FLAGS.map((f) => [f, true])), [yard.id])
  const slug = { s: np.slug }

  await gql(npAdmin, `mutation($a: ID!) { updateNonprofitProfile(accountId: $a, nonprofitSummary: "Groceries for 400 families a week on the Hilltop.", nonprofitWebsite: "https://hilltoppantry.org", isPublicNonprofit: true) { id } }`, { a: np.id })
  const camp = (await gql(npAdmin, `mutation($a: ID!) { upsertCampaign(accountId: $a, name: "Cans for the Winter Pantry", goalCents: 50000, isPublic: true, status: "active") { id } }`, { a: np.id })).upsertCampaign

  // A seller gives half of a 100 lb can load (100 × 0.60 = $60, so $30) to the campaign.
  const seller = await prisma.seller.create({ data: { firstName: 'Ruth', lastName: `Aldana${run}`, searchName: `ruth aldana${run.toLowerCase()}`, dateOfBirth: new Date('1962-03-09'), status: 'active' } })
  await prisma.identityDocument.create({ data: { sellerId: seller.id, kind: 'drivers_license', number: `RA${run}`, numberNormalized: `RA${run}`, expiresOn: new Date(Date.now() + 200 * 86_400_000), frontImage_id: `id-${run}`, frontImage_extension: 'jpg', isCurrent: true } })
  const t = (await gql(staff, `mutation($d: OpenTicketInput!) { openTicket(data: $d) { id } }`, { d: { yardId: yard.id, sellerId: seller.id, vehiclePlate: "HTP 4410", donatePercent: 50, campaignId: camp.id } })).openTicket
  await gql(staff, `mutation($d: TicketLineInput!) { addTicketLine(data: $d) { id } }`, { d: { ticketId: t.id, materialId: cans.id, grossWeight: '100', tareWeight: '0' } })
  for (const kind of ['material_photo', 'signature']) await prisma.ticketAttachment.create({ data: { ticketId: t.id, kind, image_id: `${kind}-${run}`, image_extension: 'jpg', image_filesize: 1000 } })
  await gql(staff, `mutation($t: ID!) { completeTicket(ticketId: $t) { id } }`, { t: t.id })

  const view = (await gql(npAdmin, `query($s: String!) { accountNonprofit(accountSlug: $s) { summary website isPublic canEdit raisedCents awaitingDisbursementCents campaigns { id raisedCents donationCount } } }`, slug)).accountNonprofit
  assert.equal(view.website, 'https://hilltoppantry.org')
  assert.equal(view.canEdit, true)
  assert.equal(view.raisedCents, 3000)
  assert.equal(view.awaitingDisbursementCents, 3000)
  assert.deepEqual(view.campaigns.map((c: any) => [c.id, c.raisedCents, c.donationCount]), [[camp.id, 3000, 1]])

  const page = (await gql(npAdmin, `query($s: String!) { accountDonations(accountSlug: $s) { count items { amountCents weight campaignName donorName } } }`, slug)).accountDonations
  assert.equal(page.count, 1)
  assert.deepEqual([page.items[0].amountCents, page.items[0].weight, page.items[0].donorName], [3000, '100', null], 'donor name hidden without consent')
  await prisma.donation.updateMany({ where: { ticketId: t.id }, data: { showDonorName: true } })
  const named = (await gql(npAdmin, `query($s: String!) { accountDonations(accountSlug: $s) { items { donorName } } }`, slug)).accountDonations
  assert.equal(named.items[0].donorName, `Ruth A.`)

  await assert.rejects(gql(stranger, `query($s: String!) { accountNonprofit(accountSlug: $s) { name } }`, slug), /not found/i)
  await assert.rejects(gql(stranger, `query($s: String!) { accountDonations(accountSlug: $s) { count } }`, slug), /not found/i)
})

test.after(async () => { await prisma.$disconnect() })
