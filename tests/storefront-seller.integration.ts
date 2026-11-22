/**
 * Signed-in seller storefront operations (dissertation §8.2) against a real database.
 *   node --import tsx --test tests/storefront-seller.integration.ts
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
const isoDay = (d: Date) => d.toISOString().slice(0, 10)

async function register(tag: string) {
  const email = `${tag.toLowerCase()}-${run.toLowerCase()}@sellers.example.com`
  const { registerCustomer } = await gql(anon, `mutation($n: String!, $e: String!, $p: String!) { registerCustomer(name: $n, email: $e, password: $p) { id email } }`, { n: `${tag} Rivera`, e: email, p: 'scrap-metal-2026' })
  return prisma.user.findUnique({ where: { id: registerCustomer.id } })
}

test('register, sign in, profile, ID, vehicle, book and cancel a visit', async () => {
  const user = await register('Maria')
  assert.equal(user.roleId, null, 'customers get no staff role')
  await assert.rejects(gql(anon, `mutation { registerCustomer(name: "Dup", email: "${user.email.toUpperCase()}", password: "scrap-metal-2026") { id } }`), /already uses this email/)

  // Sign-in: the stored hash verifies. (Outside HTTP there is no response to set the cookie on, so the
  // success branch reports "Failed to start session"; a wrong password reports the normal failure.)
  const signIn = (p: string) => anon.graphql.raw({ query: `mutation($e: String!, $p: String!) { authenticateUserWithPassword(email: $e, password: $p) { ... on UserAuthenticationWithPasswordSuccess { item { id } } ... on UserAuthenticationWithPasswordFailure { message } } }`, variables: { e: user.email, p } })
  const good: any = await signIn('scrap-metal-2026')
  const bad: any = await signIn('wrong-password-1')
  assert.match(bad.data.authenticateUserWithPassword.message, /Authentication failed/)
  assert.ok(good.data.authenticateUserWithPassword.item?.id === user.id || /start session/.test(good.data.authenticateUserWithPassword.message), JSON.stringify(good))

  const me = as(user)
  const empty = await gql(me, `{ mySellerOverview { seller { id } identityOnFile vehicleCount currencyCode weightUnit } myVehicles { id } myVisits { id } myTickets { count items { id } } myPayouts { items { id } } }`)
  assert.equal(empty.mySellerOverview.seller, null)
  assert.equal(empty.myTickets.count, 0)

  await assert.rejects(gql(me, `mutation { upsertMyVehicle(data: { plate: "ABC123" }) { id } }`), /profile first/)
  await assert.rejects(gql(me, `mutation { upsertMySellerProfile(data: { firstName: "Maria", lastName: "Rivera" }) { id } }`), /date of birth/)
  const { upsertMySellerProfile: seller } = await gql(me, `mutation { upsertMySellerProfile(data: { firstName: "Maria", lastName: "Rivera${run}", dateOfBirth: "1984-03-09", phone: "555-0101", city: "Dayton", preferredPayout: "check" }) { id firstName lastName dateOfBirth preferredPayout status idVerification } }`)
  assert.equal(seller.dateOfBirth, '1984-03-09')
  assert.equal(seller.preferredPayout, 'check')
  assert.equal(seller.idVerification, 'unverified')

  const profile = await prisma.rulesProfile.create({ data: { name: `Rules S${run}`, requireGovernmentId: true } })
  const yard = await prisma.yard.create({ data: { name: `North Yard ${run}`, code: `N${run.slice(0, 4)}`, slug: `north-${run.toLowerCase()}`, status: 'active', acceptsPublic: true, timezone: 'America/New_York', rulesProfileId: profile.id } })
  const mat = await prisma.material.create({ data: { name: `#1 Copper ${run}`, slug: `cu1-${run.toLowerCase()}`, code: `C1${run}`, defaultUnit: 'lb', isActive: true, isPublic: true } })
  const tomorrow = isoDay(new Date(Date.now() + DAY))
  const visitQ = `mutation($d: CreateMyVisitInput!, $k: String) { createMyVisit(data: $d, idempotencyKey: $k) { id code status plannedDate expiresAt yard { slug timezone } vehicle { plate } expectedItems } }`
  await assert.rejects(gql(me, visitQ, { d: { yardSlug: yard.slug, plannedDate: tomorrow } }), /needs a government ID/)

  const { submitMyIdentityDocument: doc } = await gql(me, `mutation($d: MyIdentityDocumentInput!) { submitMyIdentityDocument(data: $d) { id last4 isCurrent verified } }`, { d: { kind: 'drivers_license', number: 'D123-4567-8901', issuer: 'OH', expiresOn: isoDay(new Date(Date.now() + 400 * DAY)) } })
  assert.equal(doc.last4, '8901')
  await assert.rejects(gql(me, `mutation { submitMyIdentityDocument(data: { kind: "drivers_license", number: "X99999", expiresOn: "2020-01-01" }) { id } }`), /expired/)
  const idStatus = await gql(me, `{ myIdentityStatus { status documents { last4 isCurrent verified } } }`)
  assert.equal(idStatus.myIdentityStatus.status, 'on_file')
  assert.equal(JSON.stringify(idStatus).includes('D123'), false, 'the full ID number is never returned')

  const { upsertMyVehicle: truck } = await gql(me, `mutation { upsertMyVehicle(data: { plate: "jkl 2231", plateRegion: "oh", make: "Ford", model: "F-150", kind: "pickup" }) { id plate plateRegion kind } }`)
  assert.equal(truck.plate, 'JKL2231')

  const key = `visit-${run}`
  const vars = { d: { yardSlug: yard.slug, plannedDate: tomorrow, vehicleId: truck.id, expectedItems: [{ materialId: mat.id, estimatedWeight: '120' }] }, k: key }
  const { createMyVisit: visit } = await gql(me, visitQ, vars)
  assert.equal(visit.status, 'booked')
  assert.equal(visit.plannedDate, tomorrow)
  assert.equal(visit.vehicle.plate, 'JKL2231')
  assert.equal(visit.expectedItems[0].estimatedWeight, '120')
  const again = await gql(me, visitQ, vars)
  assert.equal(again.createMyVisit.id, visit.id, 'same key returns the same visit')
  await assert.rejects(gql(me, visitQ, { d: { yardSlug: yard.slug, plannedDate: '2020-01-01' } }), /today or a later day/)

  // A second customer sees none of it.
  const other = as(await register('Omar'))
  await assert.rejects(gql(other, `query($id: ID!) { myVisit(id: $id) { id } }`, { id: visit.id }), /not found/)
  await assert.rejects(gql(other, `query($id: ID!) { cancelMyVisit(id: $id) { id } }`.replace('query', 'mutation'), { id: visit.id }), /not found|profile first/)
  await assert.rejects(gql(other, `mutation($id: ID!) { removeMyVehicle(id: $id) { id } }`, { id: truck.id }), /not found|profile first/)
  await assert.rejects(gql(anon, `{ mySellerOverview { lifetimePaidCents } }`), /Sign in/)

  const overview = await gql(me, `{ mySellerOverview { seller { id } identityOnFile vehicleCount nextVisit { id code } } }`)
  assert.equal(overview.mySellerOverview.identityOnFile, true)
  assert.equal(overview.mySellerOverview.vehicleCount, 1)
  assert.equal(overview.mySellerOverview.nextVisit.id, visit.id)

  const { cancelMyVisit } = await gql(me, `mutation($id: ID!) { cancelMyVisit(id: $id) { id status } }`, { id: visit.id })
  assert.equal(cancelMyVisit.status, 'cancelled')
  await assert.rejects(gql(me, `mutation($id: ID!) { cancelMyVisit(id: $id) { id } }`, { id: visit.id }), /cancelled/)

  const { removeMyVehicle } = await gql(me, `mutation($id: ID!) { removeMyVehicle(id: $id) { id } }`, { id: truck.id })
  assert.equal(removeMyVehicle.id, truck.id)
  assert.equal((await gql(me, `{ myVehicles { id } }`)).myVehicles.length, 0)
})

test('tickets, payouts and receipt belong only to their seller', async () => {
  const user = await register('Lena')
  const me = as(user)
  const { upsertMySellerProfile: seller } = await gql(me, `mutation { upsertMySellerProfile(data: { firstName: "Lena", lastName: "Park${run}", dateOfBirth: "1979-11-02" }) { id } }`)
  const yard = await prisma.yard.create({ data: { name: `South Yard ${run}`, code: `S${run.slice(0, 4)}`, slug: `south-${run.toLowerCase()}`, status: 'active', acceptsPublic: true } })
  const t1 = await prisma.scaleTicket.create({ data: { yardId: yard.id, number: 7, direction: 'inbound', status: 'completed', sellerId: seller.id, lookupCode: `L7${run}`, totalCents: 18450, completedAt: new Date() } })
  await prisma.ticketLine.create({ data: { ticketId: t1.id, materialName: 'Shred', unit: 'lb', grossWeight: '1200', tareWeight: '200', netWeight: '1000', payWeight: '1000', unitPrice: '0.18450', amountCents: 18450, direction: 'pay_seller' } })
  await prisma.payout.create({ data: { ticketId: t1.id, sellerId: seller.id, amountCents: 18450, status: 'held', allowedMethods: ['check'], releaseAt: new Date(Date.now() - 60_000) } })
  const t2 = await prisma.scaleTicket.create({ data: { yardId: yard.id, number: 8, direction: 'inbound', status: 'completed', sellerId: seller.id, lookupCode: `L8${run}`, totalCents: -2500, completedAt: new Date() } })
  await prisma.invoice.create({ data: { number: Math.floor(Math.random() * 1e9), sellerId: seller.id, ticketId: t2.id, kind: 'fee_ticket', status: 'open', subtotalCents: 2500, totalCents: 2500, dueOn: new Date() } })

  const list = await gql(me, `{ myTickets(take: 10) { count currencyCode items { id displayNumber status totalCents payoutStatus yard { name } } } }`)
  assert.equal(list.myTickets.count, 2)
  const byId = Object.fromEntries(list.myTickets.items.map((i: any) => [i.id, i]))
  assert.equal(byId[t1.id].displayNumber, `${yard.code}-I-000007`)
  assert.equal(byId[t1.id].payoutStatus, 'ready', 'a hold past its release date reads as ready')
  assert.equal(byId[t2.id].payoutStatus, 'amount_due')

  const { myTicket } = await gql(me, `query($id: ID!) { myTicket(id: $id) { id lookupCode amountDueCents invoiceId lines { payWeight } payouts { status } } }`, { id: t2.id })
  assert.equal(myTicket.amountDueCents, 2500)
  assert.ok(myTicket.invoiceId)

  const pay = await gql(me, `{ myPayouts { currencyCode items { amountCents status allowedMethods ticket { displayNumber } } } }`)
  assert.equal(pay.myPayouts.items.length, 1)
  assert.equal(pay.myPayouts.items[0].status, 'ready')

  const overview = await gql(me, `{ mySellerOverview { lifetimeWeight pendingCents heldCents ticketCount } }`)
  assert.equal(overview.mySellerOverview.lifetimeWeight, '1000')
  assert.equal(overview.mySellerOverview.pendingCents, 18450)
  assert.equal(overview.mySellerOverview.heldCents, 0)

  const year = await gql(me, `query($y: Int!) { mySellerYearSummary(year: $y) { ticketCount totalWeight csv } }`, { y: new Date().getUTCFullYear() })
  assert.equal(year.mySellerYearSummary.ticketCount, 2)
  assert.match(year.mySellerYearSummary.csv, /"Shred","lb","1000.00"/)

  const other = as(await register('Theo'))
  await assert.rejects(gql(other, `query($id: ID!) { myTicket(id: $id) { id } }`, { id: t1.id }), /not found/)
  assert.equal((await gql(other, `{ myTickets { count } }`)).myTickets.count, 0)
  assert.deepEqual((await gql(other, `{ myAccounts { id } myApplications { id } myServiceRequests { id } }`)), { myAccounts: [], myApplications: [], myServiceRequests: [] })
})

test.after(async () => { await prisma.$disconnect() })
