import { hasFlag } from '../access'
import { CommandError, cleanKey, compareAndSet, lockRow, refuse, requireYard, runCommand, type CommandCtx, type Tx } from '../lib/command'
import { requireAccountRole } from './accounts'
import { createCardSessionTx, reserveRefundTx, runProviderRefund, startProviderCheckout } from './money'

/**
 * Containers, service requests, dispatch jobs, the driver flow and rental (dissertation §4.6, §4.11, §5.6, §5.7).
 */

const DAY = 86_400_000

function feeFor(kind: string, type: any) {
  if (!type) return 0
  if (kind === 'deliver') return type.deliveryFeeCents
  if (['swap', 'pickup', 'remove', 'live_load'].includes(kind)) return type.haulFeeCents
  return 0
}

/** Who may act on a request: staff dispatchers, the account's contacts, or the seller who asked. */
async function requireRequestAccess(tx: Tx, session: any, request: any) {
  if (hasFlag(session, 'canManageDispatch')) return
  if (request.accountId) return void (await requireAccountRole(tx, session, request.accountId, ['admin', 'member'], null))
  if (request.requestedById && request.requestedById === session?.itemId) return
  throw new CommandError('Request not found.', 'NOT_FOUND')
}

// --- Create (C6, P16) ---
type RequestInput = {
  yardId: string; kind: string; accountId?: string | null; siteId?: string | null; containerTypeId?: string | null; containerId?: string | null; materialId?: string | null;
  itemsDescription?: string | null; photos?: string[] | null; preferredDate?: string | null; preferredWindow?: string | null; accessNotes?: string | null;
  address?: { name?: string | null; addressLine1: string; addressLine2?: string | null; city: string; region?: string | null; postalCode?: string | null; contactName?: string | null; contactPhone?: string | null } | null
}
export async function createServiceRequestTx(ctx: CommandCtx, input: RequestInput) {
  const { tx } = ctx
  const yard = await tx.yard.findUnique({ where: { id: input.yardId } })
  if (!yard || yard.status !== 'active') refuse('Choose an open yard.')
  const kinds = ['deliver', 'swap', 'pickup', 'remove', 'live_load', 'public_pickup']
  if (!kinds.includes(input.kind)) refuse('Choose what you need.')
  let account: any = null
  let sellerId: string | null = null
  let siteId = input.siteId || null
  if (input.accountId) {
    await requireAccountRole(tx, ctx.session, input.accountId, ['admin', 'member'], 'canManageDispatch')
    account = await tx.account.findUnique({ where: { id: input.accountId } })
    if (account.status !== 'active') refuse('This account is suspended and cannot request service.')
    if (input.kind === 'public_pickup') refuse('Accounts request a container service, not a public pickup.')
    if (!siteId) refuse('Choose the site.')
    const site = await tx.serviceSite.findUnique({ where: { id: siteId } })
    if (!site || site.accountId !== account.id || !site.isActive) refuse('Choose one of your active sites.')
  } else {
    if (input.kind !== 'public_pickup') refuse('Container service is for commercial accounts. Ask for a pickup instead.')
    if (!String(input.itemsDescription || '').trim()) refuse('Tell us what to pick up.')
    if (!input.address?.addressLine1 || !input.address.city) refuse('Enter the pickup address.')
    const seller = ctx.actorId ? await tx.seller.findFirst({ where: { userId: ctx.actorId } }) : null
    sellerId = seller?.id || null
    const site = await tx.serviceSite.create({ data: { sellerId, name: input.address.name || 'Pickup address', addressLine1: input.address.addressLine1, addressLine2: input.address.addressLine2 || '', city: input.address.city, region: input.address.region || '', postalCode: input.address.postalCode || '', country: 'US', contactName: input.address.contactName || '', contactPhone: input.address.contactPhone || '', isActive: true } })
    siteId = site.id
  }
  let type: any = null
  if (input.containerTypeId) type = await tx.containerType.findUnique({ where: { id: input.containerTypeId } })
  if (['deliver', 'swap'].includes(input.kind) && !type) refuse('Choose the container size.')
  if (['pickup', 'remove', 'swap'].includes(input.kind)) {
    if (!input.containerId) refuse('Choose the container on site.')
    const container = await tx.container.findUnique({ where: { id: input.containerId } })
    if (!container || container.accountId !== account?.id || container.status !== 'at_customer') refuse('That container is not on your site.')
    if (!type) type = await tx.containerType.findUnique({ where: { id: container.typeId } })
  }
  const fee = feeFor(input.kind, type)
  // An account with credit is charged on its settlement; others pay a fee up front by card.
  const chargeToAccount = Boolean(account?.hasCredit)
  const status = fee > 0 && !chargeToAccount ? 'awaiting_payment' : 'requested'
  const number = await ctx.sequence('business', 'service_request')
  const request = await tx.serviceRequest.create({
    data: {
      number, yardId: yard.id, accountId: account?.id || null, sellerId, requestedById: ctx.actorId, siteId, kind: input.kind, containerTypeId: type?.id || null, containerId: input.containerId || null,
      materialId: input.materialId || null, itemsDescription: input.itemsDescription || '', photos: input.photos || [], preferredDate: input.preferredDate ? new Date(input.preferredDate) : null,
      preferredWindow: ['morning', 'afternoon'].includes(String(input.preferredWindow)) ? input.preferredWindow : 'any', accessNotes: input.accessNotes || '', status, feeCents: fee, chargeToAccount,
    },
  })
  await ctx.audit({ eventType: 'service_request.created', aggregateType: 'ServiceRequest', aggregateId: request.id, yardId: yard.id, after: { kind: input.kind, feeCents: fee, status } })
  return request
}

/** Public pickups: the dispatcher quotes; the customer accepts and pays if the fee is above zero. */
export async function quoteServiceRequestTx(ctx: CommandCtx, input: { requestId: string; feeCents: number; note?: string | null }) {
  const request = await lockRow(ctx.tx, 'ServiceRequest', input.requestId)
  if (!request) refuse('Request not found.')
  requireYard(ctx.session, request.yard)
  if (request.kind !== 'public_pickup') refuse('Only a public pickup is quoted.')
  const fee = Math.trunc(Number(input.feeCents))
  if (!Number.isSafeInteger(fee) || fee < 0) refuse('Enter the fee (zero for free).')
  await compareAndSet(ctx.tx, 'serviceRequest', request.id, 'requested', { feeCents: fee, quoteNote: input.note || '', quoteAcceptedAt: null })
  await ctx.audit({ eventType: 'service_request.quoted', aggregateType: 'ServiceRequest', aggregateId: request.id, yardId: request.yard, after: { feeCents: fee } })
  return ctx.tx.serviceRequest.findUnique({ where: { id: request.id } })
}

export async function acceptServiceQuoteTx(ctx: CommandCtx, input: { requestId: string }) {
  const request = await ctx.tx.serviceRequest.findUnique({ where: { id: input.requestId } })
  if (!request) refuse('Request not found.')
  await requireRequestAccess(ctx.tx, ctx.session, request)
  if (request.quoteAcceptedAt) return request
  const status = request.feeCents > 0 ? 'awaiting_payment' : 'requested'
  await compareAndSet(ctx.tx, 'serviceRequest', request.id, 'requested', { quoteAcceptedAt: ctx.now, status })
  await ctx.audit({ eventType: 'service_request.quote_accepted', aggregateType: 'ServiceRequest', aggregateId: request.id, after: { feeCents: request.feeCents } })
  return ctx.tx.serviceRequest.findUnique({ where: { id: request.id } })
}

// --- Triage ---
export async function approveServiceRequestTx(ctx: CommandCtx, input: { requestId: string }) {
  const request = await lockRow(ctx.tx, 'ServiceRequest', input.requestId)
  if (!request) refuse('Request not found.')
  requireYard(ctx.session, request.yard)
  if (request.kind === 'public_pickup' && !request.quoteAcceptedAt) refuse('The customer has not accepted the quote yet.')
  await compareAndSet(ctx.tx, 'serviceRequest', request.id, 'requested', { status: 'approved' }, request.status === 'awaiting_payment' ? 'The fee has not been paid yet.' : `This request is ${request.status}.`)
  await ctx.audit({ eventType: 'service_request.approved', aggregateType: 'ServiceRequest', aggregateId: request.id, yardId: request.yard })
  return ctx.tx.serviceRequest.findUnique({ where: { id: request.id } })
}

/** Decline or cancel; returns the card payments to refund in full after commit. */
async function closeRequestTx(ctx: CommandCtx, request: any, to: 'declined' | 'cancelled', reason: string, from: string[]) {
  const linked = await ctx.tx.dispatchJob.findFirst({ where: { requestId: request.id, status: { not: 'cancelled' } } })
  if (linked) {
    const job = await lockRow(ctx.tx, 'DispatchJob', linked.id)
    if (job && ['en_route', 'on_site', 'completed', 'failed'].includes(job.status)) refuse('The truck is already on its way; ask the yard.')
    if (job) {
      await compareAndSet(ctx.tx, 'dispatchJob', job.id, ['planned', 'assigned'], { status: 'cancelled' })
      if (job.dropContainer) await ctx.tx.container.updateMany({ where: { id: job.dropContainer, status: 'assigned' }, data: { status: 'in_yard' } })
    }
  }
  await compareAndSet(ctx.tx, 'serviceRequest', request.id, from, { status: to, decisionReason: reason }, `This request is ${request.status}.`)
  const payments = await ctx.tx.payment.findMany({ where: { session: { serviceRequestId: request.id }, status: 'succeeded' } })
  const refunds: string[] = []
  for (const p of payments) {
    const room = p.amountCents - p.refundedCents
    if (room <= 0) continue
    const r = await reserveRefundTx(ctx, { paymentId: p.id, amountCents: room, reason: `Request ${request.number} ${to}`, serviceRequestId: request.id }, `request:${request.id}:${p.id}`)
    if (r.status === 'pending') refunds.push(r.id)
  }
  await ctx.audit({ eventType: `service_request.${to}`, aggregateType: 'ServiceRequest', aggregateId: request.id, yardId: request.yard, reason, after: { refunds: refunds.length } })
  return { id: request.id, refunds }
}

export async function declineServiceRequestTx(ctx: CommandCtx, input: { requestId: string; reason: string }) {
  const reason = String(input.reason || '').trim()
  if (reason.length < 3) refuse('Give a reason.')
  const request = await lockRow(ctx.tx, 'ServiceRequest', input.requestId)
  if (!request) refuse('Request not found.')
  requireYard(ctx.session, request.yard)
  return closeRequestTx(ctx, request, 'declined', reason, ['requested', 'awaiting_payment', 'approved'])
}

export async function cancelServiceRequestTx(ctx: CommandCtx, input: { requestId: string; reason?: string | null }) {
  const request = await lockRow(ctx.tx, 'ServiceRequest', input.requestId)
  if (!request) refuse('Request not found.')
  await requireRequestAccess(ctx.tx, ctx.session, { ...request, accountId: request.account, requestedById: request.requestedBy })
  return closeRequestTx(ctx, request, 'cancelled', String(input.reason || '').trim() || 'Cancelled', ['requested', 'awaiting_payment', 'approved', 'scheduled'])
}

// --- Jobs ---
export async function scheduleJobTx(ctx: CommandCtx, input: { requestId?: string | null; shipmentId?: string | null; yardId?: string | null; kind?: string | null; scheduledDate: string; driverId?: string | null; truckId?: string | null; dropContainerId?: string | null; pickContainerId?: string | null; sequence?: number | null }) {
  const { tx } = ctx
  let request: any = null
  let yardId = input.yardId || null
  let kind = input.kind || 'deliver'
  let siteId: string | null = null
  if (input.requestId) {
    request = await lockRow(tx, 'ServiceRequest', input.requestId)
    if (!request) refuse('Request not found.')
    if (await tx.dispatchJob.findFirst({ where: { requestId: request.id, status: { notIn: ['cancelled', 'failed'] } } })) refuse('This request already has a job.')
    yardId = request.yard
    kind = request.kind
    siteId = request.site
  } else if (input.shipmentId) {
    const shipment = await tx.shipment.findUnique({ where: { id: input.shipmentId }, include: { order: true } })
    if (!shipment) refuse('Shipment not found.')
    yardId = shipment.order.yardId
    kind = 'deliver_to_buyer'
  }
  if (!yardId) refuse('Choose the yard.')
  requireYard(ctx.session, yardId)
  const date = new Date(input.scheduledDate)
  if (Number.isNaN(date.getTime())) refuse('Choose the day.')
  const pick = input.pickContainerId || (request && ['pickup', 'remove', 'swap'].includes(kind) ? request.container : null)
  const number = await ctx.sequence('business', 'dispatch_job')
  const job = await tx.dispatchJob.create({
    data: {
      number, yardId, requestId: request?.id || null, shipmentId: input.shipmentId || null, kind, status: 'planned', scheduledDate: date, sequence: Math.trunc(Number(input.sequence || 0)),
      siteId, pickContainerId: pick, dropContainerId: null,
    },
  })
  if (request) await compareAndSet(tx, 'serviceRequest', request.id, 'approved', { status: 'scheduled' }, 'Approve the request first.')
  if (input.driverId || input.truckId || input.dropContainerId) await assignJobInner(ctx, job.id, input)
  await ctx.audit({ eventType: 'job.scheduled', aggregateType: 'DispatchJob', aggregateId: job.id, yardId, after: { kind, date: date.toISOString(), requestId: request?.id } })
  return tx.dispatchJob.findUnique({ where: { id: job.id } })
}

async function assignJobInner(ctx: CommandCtx, jobId: string, input: { driverId?: string | null; truckId?: string | null; dropContainerId?: string | null }) {
  const { tx } = ctx
  const job = await lockRow(tx, 'DispatchJob', jobId)
  if (!job) refuse('Job not found.')
  const data: Record<string, unknown> = {}
  if (input.driverId) {
    const driver = await tx.user.findUnique({ where: { id: input.driverId }, include: { role: true } })
    if (!driver?.role?.canDriveJobs) refuse('Choose a driver.')
    data.driverId = driver.id
  }
  if (input.truckId) {
    const truck = await tx.truck.findUnique({ where: { id: input.truckId } })
    if (!truck?.isActive) refuse('Choose an active truck.')
    data.truckId = truck.id
  }
  if (input.dropContainerId && input.dropContainerId !== job.dropContainer) {
    if (!['deliver', 'swap'].includes(job.kind)) refuse('Only a delivery or swap drops a container.')
    const won = await tx.container.updateMany({ where: { id: input.dropContainerId, status: 'in_yard' }, data: { status: 'assigned' } })
    if (won.count !== 1) refuse('That container is not free in the yard.')
    if (job.dropContainer) await tx.container.updateMany({ where: { id: job.dropContainer, status: 'assigned' }, data: { status: 'in_yard' } })
    data.dropContainerId = input.dropContainerId
  }
  const merged = { driver: data.driverId ?? job.driver, truck: data.truckId ?? job.truck, drop: data.dropContainerId ?? job.dropContainer }
  const ready = merged.driver && merged.truck && (!['deliver', 'swap'].includes(job.kind) || merged.drop)
  if (ready && job.status === 'planned') data.status = 'assigned'
  await compareAndSet(tx, 'dispatchJob', job.id, ['planned', 'assigned'], data, 'This job has started; it cannot be changed.')
}

export async function assignJobTx(ctx: CommandCtx, input: { jobId: string; driverId?: string | null; truckId?: string | null; dropContainerId?: string | null }) {
  const job = await ctx.tx.dispatchJob.findUnique({ where: { id: input.jobId } })
  if (!job) refuse('Job not found.')
  requireYard(ctx.session, job.yardId)
  await assignJobInner(ctx, job.id, input)
  await ctx.audit({ eventType: 'job.assigned', aggregateType: 'DispatchJob', aggregateId: job.id, yardId: job.yardId, after: input })
  return ctx.tx.dispatchJob.findUnique({ where: { id: job.id } })
}

async function lockDriverJob(ctx: CommandCtx, jobId: string) {
  const job = await lockRow(ctx.tx, 'DispatchJob', jobId)
  if (!job) refuse('Job not found.')
  if (!hasFlag(ctx.session, 'canManageDispatch') && job.driver !== ctx.actorId) throw new CommandError('Job not found.', 'NOT_FOUND')
  return job
}

export async function startJobTx(ctx: CommandCtx, input: { jobId: string }) {
  const job = await lockDriverJob(ctx, input.jobId)
  await compareAndSet(ctx.tx, 'dispatchJob', job.id, 'assigned', { status: 'en_route', startedAt: ctx.now }, 'Only an assigned job can start.')
  if (job.dropContainer) await compareAndSet(ctx.tx, 'container', job.dropContainer, 'assigned', { status: 'in_transit' })
  await ctx.audit({ eventType: 'job.started', aggregateType: 'DispatchJob', aggregateId: job.id, yardId: job.yard })
  return ctx.tx.dispatchJob.findUnique({ where: { id: job.id } })
}

export async function arriveJobTx(ctx: CommandCtx, input: { jobId: string }) {
  const job = await lockDriverJob(ctx, input.jobId)
  await compareAndSet(ctx.tx, 'dispatchJob', job.id, 'en_route', { status: 'on_site', arrivedAt: ctx.now }, 'Start the job first.')
  await ctx.audit({ eventType: 'job.arrived', aggregateType: 'DispatchJob', aggregateId: job.id, yardId: job.yard })
  return ctx.tx.dispatchJob.findUnique({ where: { id: job.id } })
}

/** Rental accrual: after the free days, one charge per day up to `through` (exclusive), idempotent per container-day range. */
export async function accrueContainerRental(tx: Tx, containerId: string, through: Date) {
  const container = await tx.container.findUnique({ where: { id: containerId }, include: { type: true } })
  if (!container?.placedOn || !container.accountId || !container.type) return 0
  const perDay = container.type.rentalFeePerDayCents
  if (perDay <= 0) return 0
  const freeUntil = new Date(new Date(container.placedOn).getTime() + container.type.freeRentalDays * DAY)
  const from = container.rentalChargedThrough && new Date(container.rentalChargedThrough) > freeUntil ? new Date(container.rentalChargedThrough) : freeUntil
  const days = Math.floor((through.getTime() - from.getTime()) / DAY)
  if (days <= 0) return 0
  const until = new Date(from.getTime() + days * DAY)
  const won = await tx.container.updateMany({ where: { id: container.id, rentalChargedThrough: container.rentalChargedThrough }, data: { rentalChargedThrough: until } })
  if (won.count !== 1) return 0
  await tx.accountCharge.create({ data: { accountId: container.accountId, kind: 'rental', description: `Container ${container.number} rental, ${days} day${days === 1 ? '' : 's'}`, amountCents: perDay * days, containerId: container.id, serviceDate: until, referenceKey: `rental:${container.id}:${until.toISOString()}`, status: 'open' } })
  return days
}

export async function completeJobTx(ctx: CommandCtx, input: { jobId: string; dropContainerNumber?: string | null; pickContainerNumber?: string | null; photos?: string[] | null; signedName?: string | null; driverNotes?: string | null }) {
  const { tx, now } = ctx
  const job = await lockDriverJob(ctx, input.jobId)
  if (job.status !== 'on_site') refuse('Arrive on site first.')
  const site = job.site ? await tx.serviceSite.findUnique({ where: { id: job.site } }) : null
  const request = job.request ? await tx.serviceRequest.findUnique({ where: { id: job.request } }) : null
  if (job.dropContainer) {
    const drop = await tx.container.findUnique({ where: { id: job.dropContainer } })
    if (input.dropContainerNumber && input.dropContainerNumber.trim() !== drop.number) refuse(`The container dropped should be ${drop.number}.`)
    await compareAndSet(tx, 'container', drop.id, 'in_transit', { status: 'at_customer', siteId: site?.id || null, accountId: site?.accountId || request?.accountId || null, placedOn: now, rentalChargedThrough: null })
  }
  if (job.pickContainer) {
    const pick = await tx.container.findUnique({ where: { id: job.pickContainer } })
    if (input.pickContainerNumber && input.pickContainerNumber.trim() !== pick.number) refuse(`The container picked up should be ${pick.number}.`)
    await accrueContainerRental(tx, pick.id, now)
    await compareAndSet(tx, 'container', pick.id, 'at_customer', { status: 'in_transit' }, `Container ${pick.number} is not at the customer.`)
  }
  await compareAndSet(tx, 'dispatchJob', job.id, 'on_site', { status: 'completed', completedAt: now, photos: input.photos || [], signedName: input.signedName || '', driverNotes: input.driverNotes || '' })
  if (request) {
    await compareAndSet(tx, 'serviceRequest', request.id, 'scheduled', { status: 'completed' })
    // Account fees land on the next settlement; up-front card fees were already paid.
    if (request.chargeToAccount && request.feeCents > 0 && request.accountId) {
      await tx.accountCharge.create({ data: { accountId: request.accountId, kind: request.kind === 'deliver' ? 'delivery' : 'haul', description: `Request ${request.number}: ${request.kind.replace('_', ' ')}`, amountCents: request.feeCents, jobId: job.id, containerId: job.dropContainer || job.pickContainer, serviceDate: now, referenceKey: `job:${job.id}:fee`, status: 'open' } })
    }
  }
  await ctx.audit({ eventType: 'job.completed', aggregateType: 'DispatchJob', aggregateId: job.id, yardId: job.yard, after: { drop: job.dropContainer, pick: job.pickContainer } })
  return tx.dispatchJob.findUnique({ where: { id: job.id } })
}

export async function failJobTx(ctx: CommandCtx, input: { jobId: string; reason: string; chargeDryRun?: boolean | null }) {
  const { tx } = ctx
  const job = await lockDriverJob(ctx, input.jobId)
  const reason = String(input.reason || '').trim()
  if (reason.length < 3) refuse('Say why the job failed.')
  await compareAndSet(tx, 'dispatchJob', job.id, ['en_route', 'on_site'], { status: 'failed', failureReason: reason, completedAt: ctx.now }, 'Only a job on the road can fail.')
  if (job.dropContainer) await tx.container.updateMany({ where: { id: job.dropContainer, status: 'in_transit' }, data: { status: 'in_yard' } })
  const request = job.request ? await tx.serviceRequest.findUnique({ where: { id: job.request }, include: { containerType: true } }) : null
  if (request) await compareAndSet(tx, 'serviceRequest', request.id, 'scheduled', { status: 'approved' })
  if (input.chargeDryRun && request?.accountId && request.containerType?.dryRunFeeCents) {
    await tx.accountCharge.create({ data: { accountId: request.accountId, kind: 'dry_run', description: `Dry run on request ${request.number}: ${reason}`, amountCents: request.containerType.dryRunFeeCents, jobId: job.id, serviceDate: ctx.now, referenceKey: `job:${job.id}:dry_run`, status: 'open' } })
  }
  await ctx.audit({ eventType: 'job.failed', aggregateType: 'DispatchJob', aggregateId: job.id, yardId: job.yard, reason })
  return tx.dispatchJob.findUnique({ where: { id: job.id } })
}

export async function cancelJobTx(ctx: CommandCtx, input: { jobId: string; reason: string }) {
  const job = await lockRow(ctx.tx, 'DispatchJob', input.jobId)
  if (!job) refuse('Job not found.')
  requireYard(ctx.session, job.yard)
  await compareAndSet(ctx.tx, 'dispatchJob', job.id, ['planned', 'assigned'], { status: 'cancelled', failureReason: input.reason || '' }, 'A job on the road cannot be cancelled; mark it failed.')
  if (job.dropContainer) await ctx.tx.container.updateMany({ where: { id: job.dropContainer, status: 'assigned' }, data: { status: 'in_yard' } })
  if (job.request) await ctx.tx.serviceRequest.updateMany({ where: { id: job.request, status: 'scheduled' }, data: { status: 'approved' } })
  await ctx.audit({ eventType: 'job.cancelled', aggregateType: 'DispatchJob', aggregateId: job.id, yardId: job.yard, reason: input.reason })
  return ctx.tx.dispatchJob.findUnique({ where: { id: job.id } })
}

// --- Containers ---
export async function setContainerStatusTx(ctx: CommandCtx, input: { containerId: string; status: 'in_yard' | 'maintenance' | 'retired'; note?: string | null }) {
  const from: Record<string, string[]> = { maintenance: ['in_yard'], in_yard: ['maintenance', 'in_transit'], retired: ['in_yard', 'maintenance'] }
  if (!from[input.status]) refuse('Choose in yard, maintenance or retired.')
  const container = await ctx.tx.container.findUnique({ where: { id: input.containerId } })
  if (!container) refuse('Container not found.')
  requireYard(ctx.session, container.homeYardId)
  const extra = input.status === 'in_yard' ? { siteId: null, accountId: null, placedOn: null } : {}
  await compareAndSet(ctx.tx, 'container', container.id, from[input.status], { status: input.status, ...extra }, `A container that is ${container.status} cannot become ${input.status}.`)
  await ctx.audit({ eventType: `container.${input.status}`, aggregateType: 'Container', aggregateId: container.id, before: { status: container.status }, reason: input.note || undefined })
  return ctx.tx.container.findUnique({ where: { id: container.id } })
}

/** Accrue rental on every container at a customer up to now. Safe to run any number of times. */
export async function accrueRentalsTx(ctx: CommandCtx, input: { accountId?: string | null }) {
  const containers = await ctx.tx.container.findMany({ where: { status: 'at_customer', ...(input.accountId ? { accountId: input.accountId } : {}) }, select: { id: true } })
  let days = 0
  for (const c of containers) days += await accrueContainerRental(ctx.tx, c.id, ctx.now)
  return { days }
}

// ---------------------------------------------------------------------------------------------

export const dispatchTypeDefs = `
  input PickupAddressInput { name: String, addressLine1: String!, addressLine2: String, city: String!, region: String, postalCode: String, contactName: String, contactPhone: String }
  type RentalAccrual { days: Int! }
`
export const dispatchMutationDefs = `
  createServiceRequest(yardId: ID!, kind: String!, accountId: ID, siteId: ID, containerTypeId: ID, containerId: ID, materialId: ID, itemsDescription: String, photos: [String!], preferredDate: String, preferredWindow: String, accessNotes: String, address: PickupAddressInput, idempotencyKey: String): ServiceRequest
  quoteServiceRequest(requestId: ID!, feeCents: Int!, note: String): ServiceRequest
  acceptServiceQuote(requestId: ID!): ServiceRequest
  payServiceRequestByCard(requestId: ID!, returnPath: String, idempotencyKey: String!): CardCheckout
  approveServiceRequest(requestId: ID!): ServiceRequest
  declineServiceRequest(requestId: ID!, reason: String!): ServiceRequest
  cancelServiceRequest(requestId: ID!, reason: String): ServiceRequest
  scheduleDispatchJob(requestId: ID, shipmentId: ID, yardId: ID, kind: String, scheduledDate: String!, driverId: ID, truckId: ID, dropContainerId: ID, pickContainerId: ID, sequence: Int, idempotencyKey: String): DispatchJob
  assignDispatchJob(jobId: ID!, driverId: ID, truckId: ID, dropContainerId: ID): DispatchJob
  startDispatchJob(jobId: ID!): DispatchJob
  arriveDispatchJob(jobId: ID!): DispatchJob
  completeDispatchJob(jobId: ID!, dropContainerNumber: String, pickContainerNumber: String, photos: [String!], signedName: String, driverNotes: String): DispatchJob
  failDispatchJob(jobId: ID!, reason: String!, chargeDryRun: Boolean): DispatchJob
  cancelDispatchJob(jobId: ID!, reason: String!): DispatchJob
  setContainerStatus(containerId: ID!, status: String!, note: String): Container
  accrueContainerRentals(accountId: ID): RentalAccrual
`

const D = 'canManageDispatch' as const
const staffOne = (c: any, list: string) => (r: any) => (r?.id ? c.db[list].findOne({ where: { id: r.id } }) : null)
const sudoOne = (c: any, list: string) => (r: any) => (r?.id ? c.sudo().db[list].findOne({ where: { id: r.id } }) : null)
async function refundAfter(c: any, r: any) {
  for (const id of r?.refunds || []) await runProviderRefund(c, id)
  return r
}
export const dispatchResolvers = {
  Mutation: {
    createServiceRequest: (_: unknown, a: any, c: any) => runCommand(c, { name: 'createServiceRequest', input: a, idempotencyKey: cleanKey(a.idempotencyKey), requireSignIn: true }, (ctx) => createServiceRequestTx(ctx, a)).then(sudoOne(c, 'ServiceRequest')),
    quoteServiceRequest: (_: unknown, a: any, c: any) => runCommand(c, { name: 'quoteServiceRequest', input: a, permission: D }, (ctx) => quoteServiceRequestTx(ctx, a)).then(staffOne(c, 'ServiceRequest')),
    acceptServiceQuote: (_: unknown, a: any, c: any) => runCommand(c, { name: 'acceptServiceQuote', input: a, requireSignIn: true }, (ctx) => acceptServiceQuoteTx(ctx, a)).then(sudoOne(c, 'ServiceRequest')),
    payServiceRequestByCard: async (_: unknown, a: any, c: any) => {
      const request = await c.sudo().prisma.serviceRequest.findUnique({ where: { id: a.requestId } })
      if (!request) throw new CommandError('Request not found.', 'NOT_FOUND')
      await requireRequestAccess(c.sudo().prisma, c.session, request)
      const created: any = await runCommand(c, { name: 'payServiceRequestByCard', input: { requestId: a.requestId }, idempotencyKey: cleanKey(a.idempotencyKey), requireSignIn: true }, (ctx) => createCardSessionTx(ctx, { serviceRequestId: a.requestId }, String(cleanKey(a.idempotencyKey))))
      const returnPath = typeof a.returnPath === 'string' && a.returnPath.startsWith('/') && !a.returnPath.startsWith('//') ? a.returnPath : `/account/pickups/${a.requestId}`
      const checkout = await startProviderCheckout(c.sudo().prisma, created.session.id, { description: created.description, payerEmail: created.payerEmail, returnPath })
      return { paymentSessionId: checkout.sessionId, url: checkout.url }
    },
    approveServiceRequest: (_: unknown, a: any, c: any) => runCommand(c, { name: 'approveServiceRequest', input: a, permission: D }, (ctx) => approveServiceRequestTx(ctx, a)).then(staffOne(c, 'ServiceRequest')),
    declineServiceRequest: (_: unknown, a: any, c: any) => runCommand(c, { name: 'declineServiceRequest', input: a, permission: D }, (ctx) => declineServiceRequestTx(ctx, a)).then((r) => refundAfter(c, r)).then(staffOne(c, 'ServiceRequest')),
    cancelServiceRequest: (_: unknown, a: any, c: any) => runCommand(c, { name: 'cancelServiceRequest', input: a, requireSignIn: true }, (ctx) => cancelServiceRequestTx(ctx, a)).then((r) => refundAfter(c, r)).then(sudoOne(c, 'ServiceRequest')),
    scheduleDispatchJob: (_: unknown, a: any, c: any) => runCommand(c, { name: 'scheduleDispatchJob', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: D }, (ctx) => scheduleJobTx(ctx, a)).then(staffOne(c, 'DispatchJob')),
    assignDispatchJob: (_: unknown, a: any, c: any) => runCommand(c, { name: 'assignDispatchJob', input: a, permission: D }, (ctx) => assignJobTx(ctx, a)).then(staffOne(c, 'DispatchJob')),
    startDispatchJob: (_: unknown, a: any, c: any) => runCommand(c, { name: 'startDispatchJob', input: a, permission: [D, 'canDriveJobs'] }, (ctx) => startJobTx(ctx, a)).then(staffOne(c, 'DispatchJob')),
    arriveDispatchJob: (_: unknown, a: any, c: any) => runCommand(c, { name: 'arriveDispatchJob', input: a, permission: [D, 'canDriveJobs'] }, (ctx) => arriveJobTx(ctx, a)).then(staffOne(c, 'DispatchJob')),
    completeDispatchJob: (_: unknown, a: any, c: any) => runCommand(c, { name: 'completeDispatchJob', input: a, permission: [D, 'canDriveJobs'] }, (ctx) => completeJobTx(ctx, a)).then(staffOne(c, 'DispatchJob')),
    failDispatchJob: (_: unknown, a: any, c: any) => runCommand(c, { name: 'failDispatchJob', input: a, permission: [D, 'canDriveJobs'] }, (ctx) => failJobTx(ctx, a)).then(staffOne(c, 'DispatchJob')),
    cancelDispatchJob: (_: unknown, a: any, c: any) => runCommand(c, { name: 'cancelDispatchJob', input: a, permission: D }, (ctx) => cancelJobTx(ctx, a)).then(staffOne(c, 'DispatchJob')),
    setContainerStatus: (_: unknown, a: any, c: any) => runCommand(c, { name: 'setContainerStatus', input: a, permission: D }, (ctx) => setContainerStatusTx(ctx, a)).then(staffOne(c, 'Container')),
    accrueContainerRentals: (_: unknown, a: any, c: any) => runCommand(c, { name: 'accrueContainerRentals', input: a, permission: [D, 'canManageFinance'] }, (ctx) => accrueRentalsTx(ctx, a)),
  },
}
