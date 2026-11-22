/**
 * Accounts and applications, service requests, dispatch jobs, containers and rental against a real database.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { keystoneContext } from '../features/keystone/context'
import { ROLE_FLAGS } from '../features/keystone/access'

const run = randomUUID().slice(0, 6).toUpperCase()
const prisma: any = (keystoneContext as any).prisma
const ALL = Object.fromEntries(ROLE_FLAGS.map((f) => [f, true]))

async function userSession(flags: Record<string, boolean> | null, yardIds: string[] = []) {
  const role = flags ? await prisma.role.create({ data: { name: `Dispatch role ${run} ${randomUUID().slice(0, 8)}`, ...flags } }) : null
  const user = await prisma.user.create({ data: { name: `Person ${run}`, email: `p-${randomUUID()}@haul.example.com`, password: 'x'.repeat(60), roleId: role?.id ?? null } })
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

test('application approval creates the account and admin contact; suspended accounts cannot request service', async () => {
  const y = await yard()
  const { ctx: trader } = await userSession(ALL, [y.id])
  const { user: applicant, ctx: customer } = await userSession(null)
  const { submitAccountApplication } = await gql(customer, `mutation { submitAccountApplication(kind: "supplier", businessName: "Hillcrest Fabrication ${run}", city: "Dayton", region: "OH", email: "ap@hillcrest.example.com") { id status } }`)
  assert.equal(submitAccountApplication.status, 'submitted')
  const { decideAccountApplication } = await gql(trader, `mutation($a: ID!) { decideAccountApplication(applicationId: $a, decision: "approve", paymentTerms: "on_account", hasCredit: true) { status account { id slug accountNumber } } }`, { a: submitAccountApplication.id })
  assert.equal(decideAccountApplication.status, 'approved')
  const accountId = decideAccountApplication.account.id
  const contact = await prisma.accountContact.findFirst({ where: { accountId, userId: applicant.id } })
  assert.equal(contact.role, 'admin')

  const { upsertAccountSite } = await gql(customer, `mutation($a: ID!) { upsertAccountSite(accountId: $a, name: "Plant 2", addressLine1: "400 Mill Rd", city: "Dayton") { id } }`, { a: accountId })
  const { ctx: other } = await userSession(null)
  await assert.rejects(gql(other, `mutation($a: ID!) { upsertAccountSite(accountId: $a, name: "X", addressLine1: "1 A St", city: "Dayton") { id } }`, { a: accountId }), /not found/i)

  await gql(trader, `mutation($a: ID!) { setAccountStatus(accountId: $a, status: "suspended", reason: "Unpaid balance") { status } }`, { a: accountId })
  const type = await prisma.containerType.create({ data: { name: `30 yd roll-off ${run}`, slug: `ro30-${randomUUID().slice(0, 6)}`, kind: 'roll_off', deliveryFeeCents: 15000, haulFeeCents: 25000, rentalFeePerDayCents: 500, freeRentalDays: 7, dryRunFeeCents: 9000 } })
  await assert.rejects(gql(customer, `mutation($y: ID!, $a: ID!, $s: ID!, $t: ID!) { createServiceRequest(yardId: $y, kind: "deliver", accountId: $a, siteId: $s, containerTypeId: $t) { id } }`, { y: y.id, a: accountId, s: upsertAccountSite.id, t: type.id }), /suspended/)
})

test('container delivery: credit account, job lifecycle moves the container, rental after free days, pickup returns it', async () => {
  const y = await yard()
  const { ctx: dispatcher } = await userSession(ALL, [y.id])
  const { user: driverUser, ctx: driver } = await userSession({ canAccessDashboard: true, canDriveJobs: true }, [y.id])
  const { user: contactUser, ctx: customer } = await userSession(null)
  const account = await prisma.account.create({ data: { name: `Allied Steel ${run}`, slug: `allied-${randomUUID().slice(0, 6)}`, status: 'active', isSupplier: true, hasCredit: true, paymentTerms: 'on_account' } })
  await prisma.accountContact.create({ data: { accountId: account.id, userId: contactUser.id, role: 'member', status: 'active' } })
  const site = await prisma.serviceSite.create({ data: { accountId: account.id, name: 'Main plant', addressLine1: '12 Forge Ave', city: 'Akron', isActive: true } })
  const type = await prisma.containerType.create({ data: { name: `20 yd roll-off ${run}`, slug: `ro20-${randomUUID().slice(0, 6)}`, kind: 'roll_off', deliveryFeeCents: 12000, haulFeeCents: 20000, rentalFeePerDayCents: 400, freeRentalDays: 5, dryRunFeeCents: 7500 } })
  const box = await prisma.container.create({ data: { number: `RO-${run}-1`, typeId: type.id, homeYardId: y.id, status: 'in_yard' } })
  const truck = await prisma.truck.create({ data: { name: `Truck ${run}`, plate: 'RO1', kind: 'roll_off', yardId: y.id, isActive: true } })

  const { createServiceRequest } = await gql(customer, `mutation($y: ID!, $a: ID!, $s: ID!, $t: ID!) { createServiceRequest(yardId: $y, kind: "deliver", accountId: $a, siteId: $s, containerTypeId: $t) { id status feeCents } }`, { y: y.id, a: account.id, s: site.id, t: type.id })
  assert.equal(createServiceRequest.status, 'requested')
  assert.equal(createServiceRequest.feeCents, 12000)
  await gql(dispatcher, `mutation($r: ID!) { approveServiceRequest(requestId: $r) { status } }`, { r: createServiceRequest.id })
  const { scheduleDispatchJob: job } = await gql(dispatcher, `mutation($r: ID!, $d: ID!, $t: ID!, $c: ID!) { scheduleDispatchJob(requestId: $r, scheduledDate: "${new Date().toISOString()}", driverId: $d, truckId: $t, dropContainerId: $c) { id status } }`, { r: createServiceRequest.id, d: driverUser.id, t: truck.id, c: box.id })
  assert.equal(job.status, 'assigned')
  assert.equal((await prisma.container.findUnique({ where: { id: box.id } })).status, 'assigned')

  // A second job cannot take the same container.
  const r2 = await prisma.serviceRequest.create({ data: { number: 900000000 + Math.floor(Math.random() * 99999999), yardId: y.id, accountId: account.id, siteId: site.id, kind: 'deliver', containerTypeId: type.id, status: 'approved' } })
  await assert.rejects(gql(dispatcher, `mutation($r: ID!, $c: ID!) { scheduleDispatchJob(requestId: $r, scheduledDate: "${new Date().toISOString()}", dropContainerId: $c) { id } }`, { r: r2.id, c: box.id }), /not free/)

  await gql(driver, `mutation($j: ID!) { startDispatchJob(jobId: $j) { status } }`, { j: job.id })
  assert.equal((await prisma.container.findUnique({ where: { id: box.id } })).status, 'in_transit')
  await gql(driver, `mutation($j: ID!) { arriveDispatchJob(jobId: $j) { status } }`, { j: job.id })
  await assert.rejects(gql(driver, `mutation($j: ID!) { completeDispatchJob(jobId: $j, dropContainerNumber: "WRONG") { status } }`, { j: job.id }), /should be/)
  await gql(driver, `mutation($j: ID!, $n: String) { completeDispatchJob(jobId: $j, dropContainerNumber: $n, signedName: "R. Ortiz") { status } }`, { j: job.id, n: box.number })
  let c = await prisma.container.findUnique({ where: { id: box.id } })
  assert.equal(c.status, 'at_customer')
  assert.equal(c.siteId, site.id)
  assert.equal((await prisma.serviceRequest.findUnique({ where: { id: createServiceRequest.id } })).status, 'completed')
  const fee = await prisma.accountCharge.findFirst({ where: { jobId: job.id, kind: 'delivery' } })
  assert.equal(fee.amountCents, 12000)

  // Ten days on site: five free, five charged; accruing twice charges once.
  await prisma.container.update({ where: { id: box.id }, data: { placedOn: new Date(Date.now() - 10 * 86_400_000 - 3_600_000) } })
  await gql(dispatcher, `mutation($a: ID!) { accrueContainerRentals(accountId: $a) { days } }`, { a: account.id })
  const again = await gql(dispatcher, `mutation($a: ID!) { accrueContainerRentals(accountId: $a) { days } }`, { a: account.id })
  assert.equal(again.accrueContainerRentals.days, 0)
  const rentals = await prisma.accountCharge.findMany({ where: { containerId: box.id, kind: 'rental' } })
  assert.equal(rentals.length, 1)
  assert.equal(rentals[0].amountCents, 2000)

  // Pickup brings it back; the inbound ticket closing returns it to the yard.
  const { createServiceRequest: pickup } = await gql(customer, `mutation($y: ID!, $a: ID!, $s: ID!, $c: ID!) { createServiceRequest(yardId: $y, kind: "pickup", accountId: $a, siteId: $s, containerId: $c) { id feeCents } }`, { y: y.id, a: account.id, s: site.id, c: box.id })
  assert.equal(pickup.feeCents, 20000)
  await gql(dispatcher, `mutation($r: ID!) { approveServiceRequest(requestId: $r) { status } }`, { r: pickup.id })
  const { scheduleDispatchJob: pj } = await gql(dispatcher, `mutation($r: ID!, $d: ID!, $t: ID!) { scheduleDispatchJob(requestId: $r, scheduledDate: "${new Date().toISOString()}", driverId: $d, truckId: $t) { id status } }`, { r: pickup.id, d: driverUser.id, t: truck.id })
  assert.equal(pj.status, 'assigned')
  for (const m of ['startDispatchJob', 'arriveDispatchJob']) await gql(driver, `mutation($j: ID!) { ${m}(jobId: $j) { status } }`, { j: pj.id })
  await gql(driver, `mutation($j: ID!) { completeDispatchJob(jobId: $j) { status } }`, { j: pj.id })
  c = await prisma.container.findUnique({ where: { id: box.id } })
  assert.equal(c.status, 'in_transit')
  await gql(dispatcher, `mutation($c: ID!) { setContainerStatus(containerId: $c, status: "in_yard") { status } }`, { c: box.id })
  assert.equal((await prisma.container.findUnique({ where: { id: box.id } })).accountId, null)
})

test('public pickup: quote, accept, pay; decline refunds the payment in full', async () => {
  const y = await yard()
  const { ctx: dispatcher } = await userSession(ALL, [y.id])
  const { ctx: resident } = await userSession(null)
  const { createServiceRequest } = await gql(resident, `mutation($y: ID!) { createServiceRequest(yardId: $y, kind: "public_pickup", itemsDescription: "Two washers and a dryer", address: { addressLine1: "88 Elm St", city: "Kent" }) { id status } }`, { y: y.id })
  assert.equal(createServiceRequest.status, 'requested')
  await assert.rejects(gql(dispatcher, `mutation($r: ID!) { approveServiceRequest(requestId: $r) { status } }`, { r: createServiceRequest.id }), /accepted the quote/)
  await gql(dispatcher, `mutation($r: ID!) { quoteServiceRequest(requestId: $r, feeCents: 4500, note: "Curbside") { feeCents } }`, { r: createServiceRequest.id })
  const { acceptServiceQuote } = await gql(resident, `mutation($r: ID!) { acceptServiceQuote(requestId: $r) { status } }`, { r: createServiceRequest.id })
  assert.equal(acceptServiceQuote.status, 'awaiting_payment')

  // The fee was settled by a recorded check payment on the request session; decline must return it in full.
  const provider = await prisma.paymentProvider.upsert({ where: { code: 'pp_stripe' }, update: {}, create: { name: 'Stripe', code: 'pp_stripe', isInstalled: true } })
  const session = await prisma.paymentSession.create({ data: { providerId: provider.id, serviceRequestId: createServiceRequest.id, amountCents: 4500, currencyCode: 'USD', status: 'captured', capturedCents: 4500 } })
  const payment = await prisma.payment.create({ data: { sessionId: session.id, method: 'check', amountCents: 4500, reference: `CHK-${run}`, referenceKey: `pickup:${run}`, status: 'succeeded' } })
  await prisma.serviceRequest.update({ where: { id: createServiceRequest.id }, data: { status: 'requested' } })

  await gql(dispatcher, `mutation($r: ID!) { declineServiceRequest(requestId: $r, reason: "Outside our area") { status } }`, { r: createServiceRequest.id })
  const p = await prisma.payment.findUnique({ where: { id: payment.id } })
  assert.equal(p.refundedCents, 4500)
  const refunds = await prisma.refund.findMany({ where: { serviceRequestId: createServiceRequest.id } })
  assert.equal(refunds.length, 1)
  assert.equal(refunds[0].status, 'succeeded')
})
