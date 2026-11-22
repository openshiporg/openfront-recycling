/**
 * Company portal reads (dissertation §8.3) against a real database.
 *   node --import tsx --test tests/storefront-account.integration.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { keystoneContext } from '../features/keystone/context'

const run = randomUUID().slice(0, 6).toUpperCase()
const prisma: any = (keystoneContext as any).prisma
const anon: any = keystoneContext
const DAY = 86_400_000

async function gql(context: any, query: string, variables: any = {}) {
  const res = await context.graphql.raw({ query, variables })
  if (res.errors?.length) throw new Error(res.errors.map((e: any) => `${e.extensions?.code || ''} ${e.message}`).join('; '))
  return JSON.parse(JSON.stringify(res.data))
}
const as = (user: any) => anon.withSession({ itemId: user.id, listKey: 'User', data: { name: user.name, email: user.email, yards: [], role: null } })
const user = (tag: string) => prisma.user.create({ data: { name: `${tag} ${run}`, email: `${tag.toLowerCase()}-${run.toLowerCase()}@portal.example.com`, password: 'not-used-here-123' } })

test('a contact reads only their own account: overview, prices, tickets, containers, statements, invoices, report', async () => {
  const yard = await prisma.yard.create({ data: { name: `Portal Yard ${run}`, code: `P${run.slice(0, 4)}`, slug: `portal-${run.toLowerCase()}`, status: 'active', timezone: 'America/Chicago' } })
  const list = await prisma.priceList.create({ data: { name: `Contract ${run}`, kind: 'contract', isActive: true } })
  const mat = await prisma.material.create({ data: { name: `HMS 1 ${run}`, slug: `hms1-${run.toLowerCase()}`, code: `H1${run}`, defaultUnit: 'gt', isActive: true } })
  await prisma.priceEntry.create({ data: { priceListId: list.id, materialId: mat.id, unit: 'gt', unitPrice: '290.00000', effectiveFrom: new Date(Date.now() - 10 * DAY) } })
  await prisma.priceEntry.create({ data: { priceListId: list.id, materialId: mat.id, unit: 'gt', unitPrice: '305.00000', effectiveFrom: new Date(Date.now() - DAY) } })
  const acct = await prisma.account.create({ data: { name: `Midwest Fab ${run}`, slug: `midwest-fab-${run.toLowerCase()}`, status: 'active', isSupplier: true, priceListId: list.id, paymentTerms: 'settlement' } })
  const otherAcct = await prisma.account.create({ data: { name: `Rival ${run}`, slug: `rival-${run.toLowerCase()}`, status: 'active', isSupplier: true } })
  const admin = await user('Dana')
  const driver = await user('Rico')
  const outsider = await user('Zed')
  await prisma.accountContact.create({ data: { accountId: acct.id, userId: admin.id, role: 'admin', status: 'active' } })
  await prisma.accountContact.create({ data: { accountId: acct.id, userId: driver.id, role: 'driver', status: 'active' } })
  await prisma.accountContact.create({ data: { accountId: otherAcct.id, userId: outsider.id, role: 'admin', status: 'active' } })

  const site = await prisma.serviceSite.create({ data: { accountId: acct.id, name: 'Plant 2', addressLine1: '400 Industrial Pkwy', city: 'Joliet', region: 'IL' } })
  const ctype = await prisma.containerType.create({ data: { name: `30 yd ${run}`, slug: `30yd-${run.toLowerCase()}`, kind: 'roll_off', capacityLabel: '30 yd', freeRentalDays: 7, rentalFeePerDayCents: 500 } })
  await prisma.container.create({ data: { number: `R30-${run}`, typeId: ctype.id, status: 'at_customer', siteId: site.id, accountId: acct.id, placedOn: new Date(Date.now() - 10 * DAY - 3_600_000) } })
  const t = await prisma.scaleTicket.create({ data: { yardId: yard.id, number: 3, direction: 'inbound', status: 'completed', accountId: acct.id, siteId: site.id, paymentMode: 'on_account', lookupCode: `PA${run}`, totalCents: 91500, completedAt: new Date() } })
  await prisma.ticketLine.create({ data: { ticketId: t.id, materialId: mat.id, materialName: mat.name, unit: 'gt', grossWeight: '3', tareWeight: '0', netWeight: '3', payWeight: '3', unitPrice: '305', amountCents: 91500, direction: 'pay_seller' } })
  await prisma.accountCharge.create({ data: { accountId: acct.id, kind: 'haul', description: 'Haul R30', amountCents: 17500, status: 'open', serviceDate: new Date() } })
  const inv = await prisma.invoice.create({ data: { number: Math.floor(Math.random() * 1e9), accountId: acct.id, kind: 'service', status: 'open', subtotalCents: 4000, totalCents: 4000, paidCents: 1000, dueOn: new Date(Date.now() + 30 * DAY) } })
  await prisma.invoiceLine.create({ data: { invoiceId: inv.id, description: 'Dry run', amountCents: 4000, kind: 'fee' } })
  const req = await prisma.serviceRequest.create({ data: { accountId: acct.id, requestedById: admin.id, yardId: yard.id, siteId: site.id, kind: 'swap', status: 'requested', preferredDate: new Date(Date.now() + DAY) } })

  const me = as(admin)
  const slug = acct.slug
  const { myAccounts } = await gql(me, `{ myAccounts { slug role isSupplier } }`)
  assert.deepEqual(myAccounts, [{ slug, role: 'admin', isSupplier: true }])

  const ov = (await gql(me, `query($s: String!) { accountOverview(accountSlug: $s) { role monthWeight monthValueCents openRequests containersOnSite unsettledCents openInvoiceCents account { slug paymentTerms } } }`, { s: slug })).accountOverview
  assert.equal(ov.monthWeight, '3.00')
  assert.equal(ov.monthValueCents, 91500)
  assert.equal(ov.openRequests, 1)
  assert.equal(ov.containersOnSite, 1)
  assert.equal(ov.unsettledCents, 91500 - 17500)
  assert.equal(ov.openInvoiceCents, 3000)

  const prices = (await gql(me, `query($s: String!) { accountPrices(accountSlug: $s) { priceListName items { materialSlug unitPrice } } }`, { s: slug })).accountPrices
  assert.deepEqual(prices.items, [{ materialSlug: mat.slug, unitPrice: '305' }])

  const tickets = (await gql(me, `query($s: String!, $site: ID) { accountTickets(accountSlug: $s, siteId: $site) { count items { id netWeight siteName materials yard { timezone } } } }`, { s: slug, site: site.id })).accountTickets
  assert.equal(tickets.count, 1)
  assert.equal(tickets.items[0].siteName, 'Plant 2')
  const receipt = (await gql(me, `query($s: String!, $id: ID!) { accountTicket(accountSlug: $s, id: $id) { id displayNumber totalCents lines { payWeight } } }`, { s: slug, id: t.id })).accountTicket
  assert.equal(receipt.displayNumber, `${yard.code}-I-000003`)

  const cont = (await gql(me, `query($s: String!) { accountContainers(accountSlug: $s) { number daysOnSite rentalAccruingCents type { freeRentalDays } site { name } } }`, { s: slug })).accountContainers
  assert.equal(cont[0].daysOnSite, 10)
  assert.equal(cont[0].rentalAccruingCents, 3 * 500)

  const stm = await gql(me, `query($s: String!) { accountSettlements(accountSlug: $s) { id } accountCharges(accountSlug: $s, unsettledOnly: true) { kind amountCents containerNumber } accountInvoices(accountSlug: $s) { id paidCents } }`, { s: slug })
  assert.deepEqual(stm.accountCharges, [{ kind: 'haul', amountCents: 17500, containerNumber: null }])
  assert.equal(stm.accountInvoices[0].id, inv.id)
  const invd = (await gql(me, `query($s: String!, $id: ID!) { accountInvoice(accountSlug: $s, id: $id) { lines { description amountCents } payments { id } } }`, { s: slug, id: inv.id })).accountInvoice
  assert.deepEqual(invd.lines, [{ description: 'Dry run', amountCents: 4000 }])

  const reqs = (await gql(me, `query($s: String!, $id: ID!) { accountServiceRequests(accountSlug: $s) { id kind yard { timezone } } accountServiceRequest(accountSlug: $s, id: $id) { id site { addressLine1 } } }`, { s: slug, id: req.id }))
  assert.equal(reqs.accountServiceRequests[0].yard.timezone, 'America/Chicago')
  assert.equal(reqs.accountServiceRequest.site.addressLine1, '400 Industrial Pkwy')

  const report = (await gql(me, `query($s: String!, $y: Int!) { accountDiversionReport(accountSlug: $s, year: $y) { rows { materialName weight valueCents } } }`, { s: slug, y: new Date().getUTCFullYear() })).accountDiversionReport
  assert.deepEqual(report.rows, [{ materialName: mat.name, weight: '3.00', valueCents: 91500 }])

  // Personal requests list does not mix in the company's.
  assert.deepEqual((await gql(me, `{ myServiceRequests { id } }`)).myServiceRequests, [])

  // Driver may not see money; outsider sees nothing; anonymous must sign in.
  await assert.rejects(gql(as(driver), `query($s: String!) { accountInvoices(accountSlug: $s) { id } }`, { s: slug }), /FORBIDDEN/)
  assert.ok((await gql(as(driver), `query($s: String!) { accountContainers(accountSlug: $s) { id } }`, { s: slug })).accountContainers.length === 1)
  const spy = as(outsider)
  await assert.rejects(gql(spy, `query($s: String!) { accountOverview(accountSlug: $s) { role } }`, { s: slug }), /NOT_FOUND Account not found/)
  await assert.rejects(gql(spy, `query($s: String!, $id: ID!) { accountTicket(accountSlug: $s, id: $id) { id } }`, { s: otherAcct.slug, id: t.id }), /NOT_FOUND Ticket not found/)
  await assert.rejects(gql(spy, `query($s: String!, $id: ID!) { accountInvoice(accountSlug: $s, id: $id) { id } }`, { s: otherAcct.slug, id: inv.id }), /NOT_FOUND/)
  await assert.rejects(gql(anon, `query($s: String!) { accountOverview(accountSlug: $s) { role } }`, { s: slug }), /UNAUTHENTICATED/)
})

test.after(async () => { await prisma.$disconnect() })
