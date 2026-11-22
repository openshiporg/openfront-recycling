import { createHash } from 'node:crypto'
import { hasFlag } from '../access'
import { CommandError, cleanKey, compareAndSet, lockRow, refuse, requireYard, runCommand, type CommandCtx, type Tx } from '../lib/command'
import { businessSettings, hasPoliceHold, maybeSettleTicket, refreshDuePayouts, yardRules } from '../lib/domain'
import { afterSaleInvoicePaid } from '../lib/sales'
import { roundCashUpToNickel } from '../../recycling/ticketMath'
import { getPaymentProviderRegistration, paymentAdapter } from '../../integrations/payment'
import { paymentWebhookPayloadHash } from '../lib/paymentWebhookSecurity'

/**
 * Money commands (dissertation §4.10, §5.2, §5.9, §5.10, §10). Payouts and the drawer are new;
 * payment sessions, webhook dedupe and refunds are adapted from Barbershop.
 */

const hashKey = (value: string) => createHash('sha256').update(value).digest('hex')

// ---------------------------------------------------------------------------------------------
// Cash drawer (§4.10, §5.11)
// ---------------------------------------------------------------------------------------------

export async function drawerExpectedCents(tx: Tx, sessionId: string) {
  const events = await tx.cashDrawerEvent.findMany({ where: { sessionId }, select: { kind: true, amountCents: true } })
  return events.reduce((sum: number, e: any) => sum + (e.kind === 'payout' || e.kind === 'drop' ? -e.amountCents : e.amountCents), 0)
}

async function lockOpenDrawerSession(ctx: CommandCtx, sessionId: string, { mine = true } = {}) {
  const row = await lockRow(ctx.tx, 'CashDrawerSession', sessionId)
  if (!row) refuse('Drawer session not found.')
  if (row.status !== 'open') refuse('This drawer session is not open.')
  if (mine && row.cashier !== ctx.actorId && !hasFlag(ctx.session, 'canManageCashDrawers')) refuse('This is another cashier’s drawer.')
  const drawer = await ctx.tx.cashDrawer.findUnique({ where: { id: row.drawer } })
  requireYard(ctx.session, drawer?.yardId)
  return { row, drawer }
}

async function drawerEvent(ctx: CommandCtx, sessionId: string, kind: string, amountCents: number, referenceKey: string, extra: Record<string, unknown> = {}) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) refuse('The amount must be above zero.')
  await ctx.tx.cashDrawerEvent.create({ data: { sessionId, kind, amountCents, referenceKey, createdById: ctx.actorId, note: '', ...extra } })
  const expected = await drawerExpectedCents(ctx.tx, sessionId)
  await ctx.tx.cashDrawerSession.update({ where: { id: sessionId }, data: { expectedCents: expected } })
  return expected
}

export async function openDrawerSessionTx(ctx: CommandCtx, input: { drawerId: string; openingFloatCents: number }) {
  const drawer = await ctx.tx.cashDrawer.findUnique({ where: { id: input.drawerId } })
  if (!drawer || !drawer.isActive) refuse('Drawer not found.')
  requireYard(ctx.session, drawer.yardId)
  const float = Math.trunc(Number(input.openingFloatCents))
  if (!Number.isSafeInteger(float) || float < 0) refuse('Count the opening float.')
  // Partial unique indexes (one open session per drawer and per cashier) settle races; check first for a clear message.
  if (await ctx.tx.cashDrawerSession.findFirst({ where: { drawerId: drawer.id, status: { in: ['open', 'counting'] } } })) refuse('This drawer already has an open session.')
  if (await ctx.tx.cashDrawerSession.findFirst({ where: { cashierId: ctx.actorId, status: { in: ['open', 'counting'] } } })) refuse('You already have a drawer open.')
  const session = await ctx.tx.cashDrawerSession.create({ data: { drawerId: drawer.id, cashierId: ctx.actorId, status: 'open', openingFloatCents: float, expectedCents: float, openedAt: ctx.now } })
  if (float > 0) await ctx.tx.cashDrawerEvent.create({ data: { sessionId: session.id, kind: 'open', amountCents: float, referenceKey: `drawer:${session.id}:open`, createdById: ctx.actorId, note: 'Opening float' } })
  await ctx.audit({ eventType: 'drawer.opened', aggregateType: 'CashDrawerSession', aggregateId: session.id, yardId: drawer.yardId, after: { openingFloatCents: float } })
  return session
}

export async function moveDrawerCashTx(ctx: CommandCtx, input: { sessionId: string; kind: 'add' | 'drop'; amountCents: number; note?: string | null }, key: string) {
  if (input.kind !== 'add' && input.kind !== 'drop') refuse('Choose add or drop.')
  const { row, drawer } = await lockOpenDrawerSession(ctx, input.sessionId)
  const amount = Math.trunc(Number(input.amountCents))
  if (input.kind === 'drop' && amount > row.expectedCents) refuse('You cannot drop more cash than the drawer holds.')
  const expected = await drawerEvent(ctx, row.id, input.kind, amount, `drawer:${row.id}:${input.kind}:${key}`, { note: input.note || '' })
  await ctx.audit({ eventType: `drawer.${input.kind}`, aggregateType: 'CashDrawerSession', aggregateId: row.id, yardId: drawer.yardId, after: { amountCents: amount, expectedCents: expected } })
  return ctx.tx.cashDrawerSession.findUnique({ where: { id: row.id } })
}

export async function countDrawerTx(ctx: CommandCtx, input: { sessionId: string; countedCents: number }) {
  const { row, drawer } = await lockOpenDrawerSession(ctx, input.sessionId)
  const counted = Math.trunc(Number(input.countedCents))
  if (!Number.isSafeInteger(counted) || counted < 0) refuse('Enter the counted cash.')
  const expected = await drawerExpectedCents(ctx.tx, row.id)
  const variance = counted - expected
  const closes = variance === 0
  await compareAndSet(ctx.tx, 'cashDrawerSession', row.id, 'open', { status: closes ? 'closed' : 'counting', countedCents: counted, varianceCents: variance, expectedCents: expected, ...(closes ? { closedAt: ctx.now } : {}) })
  await ctx.audit({ eventType: closes ? 'drawer.closed' : 'drawer.counted', aggregateType: 'CashDrawerSession', aggregateId: row.id, yardId: drawer.yardId, after: { countedCents: counted, expectedCents: expected, varianceCents: variance } })
  return ctx.tx.cashDrawerSession.findUnique({ where: { id: row.id } })
}

export async function approveDrawerCloseTx(ctx: CommandCtx, input: { sessionId: string; note: string }) {
  const row = await lockRow(ctx.tx, 'CashDrawerSession', input.sessionId)
  if (!row) refuse('Drawer session not found.')
  const drawer = await ctx.tx.cashDrawer.findUnique({ where: { id: row.drawer } })
  requireYard(ctx.session, drawer?.yardId)
  if (row.status !== 'counting') refuse('Only a counted drawer with a variance waits for approval.')
  const note = String(input.note || '').trim()
  if (note.length < 3) refuse('Write a note explaining the variance.')
  if (row.cashier === ctx.actorId && !hasFlag(ctx.session, 'canManageSettings')) refuse('Another manager must approve your own drawer variance.')
  await compareAndSet(ctx.tx, 'cashDrawerSession', row.id, 'counting', { status: 'closed', closedAt: ctx.now, approvedById: ctx.actorId, approvalNote: note })
  await ctx.audit({ eventType: 'drawer.variance_approved', aggregateType: 'CashDrawerSession', aggregateId: row.id, yardId: drawer?.yardId, after: { varianceCents: row.varianceCents }, reason: note })
  return ctx.tx.cashDrawerSession.findUnique({ where: { id: row.id } })
}

/** Reopen a counted drawer so the cashier can recount (same session). */
export async function recountDrawerTx(ctx: CommandCtx, input: { sessionId: string }) {
  const row = await lockRow(ctx.tx, 'CashDrawerSession', input.sessionId)
  if (!row || row.status !== 'counting') refuse('Only a counted drawer can be recounted.')
  if (row.cashier !== ctx.actorId && !hasFlag(ctx.session, 'canManageCashDrawers')) refuse('This is another cashier’s drawer.')
  await compareAndSet(ctx.tx, 'cashDrawerSession', row.id, 'counting', { status: 'open', countedCents: null, varianceCents: null })
  return ctx.tx.cashDrawerSession.findUnique({ where: { id: row.id } })
}

// ---------------------------------------------------------------------------------------------
// Payouts (§5.2)
// ---------------------------------------------------------------------------------------------

async function cashPaidToday(tx: Tx, payout: any, now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const where: any = { status: 'paid', method: 'cash', paidAt: { gte: start }, id: { not: payout.id } }
  if (payout.sellerId) where.sellerId = payout.sellerId
  else if (payout.accountId) where.accountId = payout.accountId
  else return 0
  const agg = await tx.payout.aggregate({ where, _sum: { amountCents: true } })
  return agg._sum.amountCents || 0
}

export type PayPayoutInput = { payoutId: string; method: 'cash' | 'check' | 'transfer'; drawerSessionId?: string | null; checkNumber?: string | null; bankAccountLabel?: string | null; transferReference?: string | null }

export async function payPayoutTx(ctx: CommandCtx, input: PayPayoutInput) {
  const { tx, now } = ctx
  await refreshDuePayouts(tx, now, { payoutId: input.payoutId })
  const payout = await lockRow(tx, 'Payout', input.payoutId)
  if (!payout) refuse('Payout not found.')
  const ticket = payout.ticket ? await tx.scaleTicket.findUnique({ where: { id: payout.ticket } }) : null
  const yardId = ticket?.yardId || null
  if (yardId) requireYard(ctx.session, yardId)
  if (payout.status === 'paid') refuse('This payout is already paid.')
  if (payout.status === 'held') {
    if (await hasPoliceHold(tx, payout.ticket)) refuse('A police hold is on this ticket. The payout cannot be paid.')
    refuse(`This payout is held until ${new Date(payout.releaseAt).toISOString()}.`)
  }
  if (payout.status !== 'ready') refuse(`This payout is ${payout.status}.`)
  if (await hasPoliceHold(tx, payout.ticket)) refuse('A police hold is on this ticket. The payout cannot be paid.')
  const allowed: string[] = Array.isArray(payout.allowedMethods) && payout.allowedMethods.length ? payout.allowedMethods : ['cash', 'check', 'transfer']
  if (!allowed.includes(input.method)) refuse(`This payout can be paid only by ${allowed.join(' or ')}.`)

  const data: Record<string, unknown> = { status: 'paid', method: input.method, paidById: ctx.actorId, paidAt: now }
  let cashCents = payout.amountCents
  if (input.method === 'cash') {
    if (!input.drawerSessionId) refuse('Open your drawer to pay cash.')
    const { row } = await lockOpenDrawerSession(ctx, input.drawerSessionId)
    const { profile } = yardId ? await yardRules(tx, yardId) : { profile: {} as any }
    if (profile.cashRounding === 'nickel_up') cashCents = roundCashUpToNickel(payout.amountCents)
    if (profile.cashLimitPerTicketCents && cashCents > profile.cashLimitPerTicketCents) refuse(`Cash over ${(profile.cashLimitPerTicketCents / 100).toFixed(2)} per ticket is not allowed here. Pay by check or transfer.`)
    if (profile.cashLimitPerDayCents && (await cashPaidToday(tx, payout, now)) + cashCents > profile.cashLimitPerDayCents) refuse('This seller has reached today’s cash limit. Pay by check or transfer.')
    const expected = await drawerExpectedCents(tx, row.id)
    if (cashCents > expected) refuse(`The drawer holds ${(expected / 100).toFixed(2)}; add cash from the safe or pay by check.`)
    data.drawerSessionId = row.id
  } else if (input.method === 'check') {
    const checkNumber = String(input.checkNumber || '').trim()
    if (!checkNumber) refuse('Enter the check number.')
    data.checkNumber = checkNumber
    data.bankAccountLabel = String(input.bankAccountLabel || 'Operating').trim()
    const used = await tx.payout.findFirst({ where: { checkNumber, bankAccountLabel: data.bankAccountLabel, id: { not: payout.id } } })
    if (used) refuse(`Check ${checkNumber} on ${data.bankAccountLabel} is already used.`)
  } else {
    const reference = String(input.transferReference || '').trim()
    if (!reference) refuse('Enter the bank transfer reference.')
    data.transferReference = reference
  }

  await compareAndSet(tx, 'payout', payout.id, 'ready', data, 'This payout was just paid by someone else.')
  if (input.method === 'cash') {
    await drawerEvent(ctx, String(data.drawerSessionId), 'payout', cashCents, `payout:${payout.id}`, { payoutId: payout.id, ticketId: payout.ticket, note: cashCents !== payout.amountCents ? `Rounded up from ${payout.amountCents} cents` : '' })
  }
  await ctx.audit({ eventType: 'payout.paid', aggregateType: 'Payout', aggregateId: payout.id, yardId, after: { method: input.method, amountCents: payout.amountCents, cashCents: input.method === 'cash' ? cashCents : undefined, checkNumber: data.checkNumber, transferReference: data.transferReference } })
  if (payout.ticket) await maybeSettleTicket(tx, payout.ticket, now)
  if (payout.settlement) await settleIfPaid(ctx, payout.settlement)
  return tx.payout.findUnique({ where: { id: payout.id } })
}

export async function returnPayoutTx(ctx: CommandCtx, input: { payoutId: string; reason: string }) {
  const reason = String(input.reason || '').trim()
  if (reason.length < 3) refuse('Give the reason the payment came back.')
  const payout = await lockRow(ctx.tx, 'Payout', input.payoutId)
  if (!payout) refuse('Payout not found.')
  if (payout.status !== 'paid') refuse('Only a paid payout can be returned.')
  if (payout.method === 'cash') refuse('A cash payout cannot be returned; record cash received with an adjustment ticket.')
  await compareAndSet(ctx.tx, 'payout', payout.id, 'paid', { status: 'returned', returnReason: reason })
  const replacement = await ctx.tx.payout.create({
    data: {
      ticketId: payout.ticket, settlementId: payout.settlement, sellerId: payout.seller, accountId: payout.account, amountCents: payout.amountCents, status: 'ready',
      allowedMethods: payout.allowedMethods, mailToAddress: payout.mailToAddress, replacesId: payout.id,
    },
  })
  const lines = await ctx.tx.ticketLine.findMany({ where: { payouts: { some: { id: payout.id } } }, select: { id: true } })
  if (lines.length) await ctx.tx.payout.update({ where: { id: replacement.id }, data: { lines: { connect: lines } } })
  await ctx.audit({ eventType: 'payout.returned', aggregateType: 'Payout', aggregateId: payout.id, after: { replacementId: replacement.id }, reason })
  return replacement
}

export async function cancelPayoutTx(ctx: CommandCtx, input: { payoutId: string; reason: string }) {
  const reason = String(input.reason || '').trim()
  if (reason.length < 3) refuse('Give a reason.')
  const payout = await lockRow(ctx.tx, 'Payout', input.payoutId)
  if (!payout) refuse('Payout not found.')
  await compareAndSet(ctx.tx, 'payout', payout.id, ['ready', 'held', 'pending'], { status: 'cancelled', cancelReason: reason }, 'Only an unpaid payout can be cancelled.')
  await ctx.audit({ eventType: 'payout.cancelled', aggregateType: 'Payout', aggregateId: payout.id, reason })
  return ctx.tx.payout.findUnique({ where: { id: payout.id } })
}

// ---------------------------------------------------------------------------------------------
// Invoices and money in (§5.9)
// ---------------------------------------------------------------------------------------------

async function applyPaymentToInvoice(ctx: CommandCtx, invoiceId: string, amountCents: number) {
  const invoice = await lockRow(ctx.tx, 'Invoice', invoiceId)
  if (!invoice) refuse('Invoice not found.')
  if (invoice.status === 'void') refuse('This invoice is void.')
  if (invoice.status === 'paid') refuse('This invoice is already paid.')
  const balance = invoice.totalCents - invoice.paidCents
  if (amountCents > balance) refuse(`The balance due is ${(balance / 100).toFixed(2)}.`)
  const paid = invoice.paidCents + amountCents
  const status = paid >= invoice.totalCents ? 'paid' : 'partially_paid'
  await compareAndSet(ctx.tx, 'invoice', invoice.id, ['open', 'partially_paid'], { paidCents: paid, status })
  if (status === 'paid') await afterInvoicePaid(ctx, { ...invoice, id: invoice.id, status, paidCents: paid })
  return status
}

async function afterInvoicePaid(ctx: CommandCtx, invoice: any) {
  const full = await ctx.tx.invoice.findUnique({ where: { id: invoice.id } })
  if (full.kind === 'sale') await afterSaleInvoicePaid(ctx.tx, full, ctx.now)
  if (full.ticketId) await maybeSettleTicket(ctx.tx, full.ticketId, ctx.now)
  if (full.settlementId) await settleIfPaid(ctx, full.settlementId)
  if (full.kind === 'service' || full.serviceRequestId) {
    const request = await ctx.tx.serviceRequest.findFirst({ where: { OR: [{ invoiceId: full.id }, ...(full.serviceRequestId ? [{ id: full.serviceRequestId }] : [])] } })
    if (request?.status === 'awaiting_payment') await ctx.tx.serviceRequest.updateMany({ where: { id: request.id, status: 'awaiting_payment' }, data: { status: 'requested' } })
  }
  await ctx.tx.accountCharge.updateMany({ where: { invoiceLine: { invoiceId: full.id }, status: 'invoiced' }, data: { status: 'settled' } })
}

export async function recordInvoicePaymentTx(ctx: CommandCtx, input: { invoiceId: string; method: 'wire' | 'ach' | 'check' | 'cash'; amountCents: number; reference: string; drawerSessionId?: string | null; receivedAt?: string | null }, key: string) {
  const amount = Math.trunc(Number(input.amountCents))
  if (!Number.isSafeInteger(amount) || amount <= 0) refuse('The amount must be above zero.')
  if (!['wire', 'ach', 'check', 'cash'].includes(input.method)) refuse('Choose wire, ACH, check or cash.')
  const reference = String(input.reference || '').trim()
  if (input.method !== 'cash' && !reference) refuse('Enter the payment reference (wire, ACH or check number).')
  const status = await applyPaymentToInvoice(ctx, input.invoiceId, amount)
  const payment = await ctx.tx.payment.create({
    data: { invoiceId: input.invoiceId, method: input.method, amountCents: amount, reference, referenceKey: `manual:${input.method}:${reference || key}:${input.invoiceId}`, receivedAt: input.receivedAt ? new Date(input.receivedAt) : ctx.now, recordedById: ctx.actorId, status: 'succeeded' },
  }).catch((error: any) => {
    if (error?.code === 'P2002') refuse('This payment reference is already recorded on this invoice.')
    throw error
  })
  if (input.method === 'cash') {
    if (!input.drawerSessionId) refuse('Open your drawer to take cash.')
    const { row } = await lockOpenDrawerSession(ctx, input.drawerSessionId)
    const invoice = await ctx.tx.invoice.findUnique({ where: { id: input.invoiceId } })
    await drawerEvent(ctx, row.id, 'collect', amount, `payment:${payment.id}`, { ticketId: invoice.ticketId, note: `Invoice ${invoice.number}` })
    if (invoice.ticketId) {
      await ctx.tx.$executeRawUnsafe(`UPDATE "ScaleTicket" SET "collectedCents" = "collectedCents" + $1 WHERE "id" = $2`, amount, invoice.ticketId)
      await maybeSettleTicket(ctx.tx, invoice.ticketId, ctx.now)
    }
  }
  await ctx.audit({ eventType: 'invoice.payment_recorded', aggregateType: 'Invoice', aggregateId: input.invoiceId, after: { paymentId: payment.id, method: input.method, amountCents: amount, reference, status } })
  return payment
}

export async function voidInvoiceTx(ctx: CommandCtx, input: { invoiceId: string; reason: string }) {
  const reason = String(input.reason || '').trim()
  if (reason.length < 3) refuse('Give a reason.')
  const invoice = await lockRow(ctx.tx, 'Invoice', input.invoiceId)
  if (!invoice) refuse('Invoice not found.')
  if (invoice.paidCents > 0) refuse('Money was received on this invoice; refund it first.')
  await compareAndSet(ctx.tx, 'invoice', invoice.id, 'open', { status: 'void', voidReason: reason }, 'Only an open invoice can be voided.')
  await ctx.tx.accountCharge.updateMany({ where: { invoiceLine: { invoiceId: invoice.id }, status: 'invoiced' }, data: { status: 'open', invoiceLineId: null } })
  await ctx.audit({ eventType: 'invoice.voided', aggregateType: 'Invoice', aggregateId: invoice.id, reason })
  return ctx.tx.invoice.findUnique({ where: { id: invoice.id } })
}

/** Invoice the open account charges of one account (rentals, hauls, dry runs). */
export async function invoiceAccountChargesTx(ctx: CommandCtx, input: { accountId: string; netDays?: number | null }) {
  const account = await ctx.tx.account.findUnique({ where: { id: input.accountId } })
  if (!account) refuse('Account not found.')
  const charges = await ctx.tx.accountCharge.findMany({ where: { accountId: account.id, status: 'open', settlementId: null } })
  if (!charges.length) refuse('This account has no open charges.')
  const total = charges.reduce((s: number, c: any) => s + c.amountCents, 0)
  if (total <= 0) refuse('The open charges do not add up to an amount due.')
  const number = await ctx.sequence('business', 'invoice')
  const invoice = await ctx.tx.invoice.create({ data: { number, accountId: account.id, kind: 'service', status: 'open', subtotalCents: total, taxCents: 0, totalCents: total, dueOn: new Date(ctx.now.getTime() + Number(input.netDays ?? account.netDays ?? 30) * 86_400_000) } })
  for (const charge of charges) {
    const line = await ctx.tx.invoiceLine.create({ data: { invoiceId: invoice.id, description: charge.description || charge.kind, amountCents: charge.amountCents, kind: 'fee' } })
    const won = await ctx.tx.accountCharge.updateMany({ where: { id: charge.id, status: 'open' }, data: { status: 'invoiced', invoiceLineId: line.id } })
    if (won.count !== 1) refuse('A charge changed while invoicing. Try again.')
  }
  await ctx.audit({ eventType: 'invoice.issued', aggregateType: 'Invoice', aggregateId: invoice.id, after: { totalCents: total, charges: charges.length } })
  return invoice
}

// ---------------------------------------------------------------------------------------------
// Card payments through a provider (adapted from Barbershop's payment sessions)
// ---------------------------------------------------------------------------------------------

export function publicBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 'http://localhost:3000')).replace(/\/$/, '')
}

export async function activeCardProvider(tx: Tx) {
  const provider = await tx.paymentProvider.findFirst({ where: { code: 'pp_stripe', isInstalled: true } })
  if (!provider) refuse('Card payments are not switched on. Install the Stripe provider in Settings → Payments.')
  return provider
}

type SessionTarget = { invoiceId?: string | null; serviceRequestId?: string | null }

/** Creates the local pending session in a transaction; the provider call runs after commit. */
export async function createCardSessionTx(ctx: CommandCtx, target: SessionTarget, key: string) {
  const { tx } = ctx
  let amountCents = 0
  let description = ''
  let payerEmail = ''
  if (target.invoiceId) {
    const invoice = await lockRow(tx, 'Invoice', target.invoiceId)
    if (!invoice || !['open', 'partially_paid'].includes(invoice.status)) refuse('This invoice is not open.')
    amountCents = invoice.totalCents - invoice.paidCents
    description = `Invoice ${invoice.number}`
  } else if (target.serviceRequestId) {
    const request = await lockRow(tx, 'ServiceRequest', target.serviceRequestId)
    if (!request || request.status !== 'awaiting_payment') refuse('This request has nothing to pay.')
    amountCents = request.feeCents
    description = `Service request ${request.number}`
  } else refuse('Choose what to pay.')
  if (amountCents <= 0) refuse('Nothing is due.')
  const existing = await tx.paymentSession.findFirst({ where: { ...(target.invoiceId ? { invoiceId: target.invoiceId } : { serviceRequestId: target.serviceRequestId }), status: 'pending', amountCents, expiresAt: { gt: ctx.now } } })
  if (existing?.providerPaymentId) return { session: existing, reuse: true, description, payerEmail }
  const provider = await activeCardProvider(tx)
  const settings = await businessSettings(tx)
  const session = existing || await tx.paymentSession.create({
    data: {
      providerId: provider.id, invoiceId: target.invoiceId || null, serviceRequestId: target.serviceRequestId || null, payerId: ctx.actorId,
      amountCents, currencyCode: settings.currencyCode || 'USD', status: 'pending', idempotencyKeyHash: hashKey(`card-session:${key}`), expiresAt: new Date(ctx.now.getTime() + 23 * 3_600_000),
    },
  })
  if (ctx.actorId) payerEmail = (await tx.user.findUnique({ where: { id: ctx.actorId } }))?.email || ''
  return { session, reuse: false, description, payerEmail }
}

export async function startProviderCheckout(prisma: any, sessionId: string, input: { description: string; payerEmail: string; returnPath: string }) {
  const session = await prisma.paymentSession.findUnique({ where: { id: sessionId }, include: { provider: true } })
  if (session.providerPaymentId) {
    const meta = (session.metadata || {}) as any
    return { sessionId, url: meta.url || null }
  }
  const { adapter } = await paymentAdapter(session.provider.code)
  const base = publicBaseUrl()
  const sep = input.returnPath.includes('?') ? '&' : '?'
  const result: any = await adapter.createPaymentFunction({
    provider: { code: session.provider.code }, amount: session.amountCents, currency: session.currencyCode, description: input.description, customerEmail: input.payerEmail,
    idempotencyKey: `recycling-session-${session.id}`, metadata: { paymentSessionId: session.id },
    successUrl: `${base}${input.returnPath}${sep}payment=${session.id}`, cancelUrl: `${base}${input.returnPath}${sep}payment=${session.id}&cancelled=1`,
  })
  await prisma.paymentSession.updateMany({ where: { id: session.id, providerPaymentId: null }, data: { providerPaymentId: result.id, metadata: { url: result.url } } })
  return { sessionId, url: result.url as string | null }
}

const SESSION_FORWARD: Record<string, string[]> = {
  pending: ['captured', 'failed', 'cancelled', 'expired'],
  requires_action: ['captured', 'failed', 'cancelled', 'expired'],
  authorized: ['captured', 'failed', 'cancelled'],
}

/** Reconcile-on-return and webhook both land here. Capture is idempotent on the session id. */
export async function reconcileCardSession(context: any, sessionId: string) {
  const prisma = context.sudo().prisma
  const session = await prisma.paymentSession.findUnique({ where: { id: sessionId }, include: { provider: true } })
  if (!session) throw new CommandError('Payment not found.', 'NOT_FOUND')
  const registration = getPaymentProviderRegistration(session.provider?.code || '')
  if (!registration || registration.settlement !== 'processor' || !session.providerPaymentId) return session
  if (!['pending', 'requires_action', 'authorized'].includes(session.status)) return session
  const { adapter } = await paymentAdapter(session.provider.code)
  const remote: any = await adapter.getPaymentStatusFunction({ provider: { code: session.provider.code }, paymentId: session.providerPaymentId })
  const observed = String(remote.status || '')
  if (remote.amount != null && Number(remote.amount) !== session.amountCents) throw new CommandError('The provider reported a different amount. Review this payment with the provider.')
  const next = observed === 'expired' ? 'cancelled' : observed === 'refunded' || observed === 'partially_refunded' ? 'captured' : observed
  if (!SESSION_FORWARD[session.status]?.includes(next)) return session
  return runCommand(context.sudo(), { name: 'captureCardSession', input: { sessionId }, idempotencyKey: `${sessionId}:${next}` }, async (ctx) => {
    const row = await lockRow(ctx.tx, 'PaymentSession', sessionId)
    if (!SESSION_FORWARD[row.status]?.includes(next)) return ctx.tx.paymentSession.findUnique({ where: { id: sessionId } })
    if (next !== 'captured') {
      await compareAndSet(ctx.tx, 'paymentSession', sessionId, row.status, { status: next })
      return ctx.tx.paymentSession.findUnique({ where: { id: sessionId } })
    }
    await compareAndSet(ctx.tx, 'paymentSession', sessionId, row.status, { status: 'captured', capturedAt: ctx.now, capturedCents: row.amountCents })
    const payment = await ctx.tx.payment.create({ data: { invoiceId: row.invoice, sessionId, method: 'card', amountCents: row.amountCents, reference: row.providerPaymentId, referenceKey: `card:${row.providerPaymentId}`, receivedAt: ctx.now, status: 'succeeded' } })
    if (row.invoice) {
      const invoice = await lockRow(ctx.tx, 'Invoice', row.invoice)
      const room = invoice.totalCents - invoice.paidCents
      if (invoice.status === 'void' || room < row.amountCents) {
        // Money arrived for something no longer due: keep it recorded and flag for a refund.
        await ctx.audit({ eventType: 'payment.overpaid', aggregateType: 'PaymentSession', aggregateId: sessionId, after: { invoiceId: row.invoice, amountCents: row.amountCents, balanceCents: room }, reason: 'Card payment captured after the invoice was settled or voided; refund it.' })
      } else {
        await applyPaymentToInvoice(ctx, row.invoice, row.amountCents)
      }
    }
    if (row.serviceRequest) {
      await ctx.tx.serviceRequest.updateMany({ where: { id: row.serviceRequest, status: 'awaiting_payment' }, data: { status: 'requested' } })
    }
    await ctx.audit({ eventType: 'payment.captured', aggregateType: 'PaymentSession', aggregateId: sessionId, after: { paymentId: payment.id, amountCents: row.amountCents } })
    return ctx.tx.paymentSession.findUnique({ where: { id: sessionId } })
  })
}

/** POST /api/payment-webhooks/[providerCode] (adapted from Barbershop; Stripe's own signature scheme). */
export async function processPaymentWebhook(context: any, input: { providerCode: string; rawBody: Uint8Array; headers: Record<string, string> }) {
  const prisma = context.sudo().prisma
  const code = input.providerCode.startsWith('pp_') ? input.providerCode : `pp_${input.providerCode}`
  const registration = getPaymentProviderRegistration(code)
  if (!registration?.webhook) return { ok: false, status: 404, error: 'Unknown provider.' }
  const provider = await prisma.paymentProvider.findFirst({ where: { code, isInstalled: true } })
  if (!provider) return { ok: false, status: 404, error: 'Provider is not installed.' }
  let rawText: string
  let event: any
  try {
    rawText = new TextDecoder('utf-8', { fatal: true }).decode(input.rawBody)
    event = JSON.parse(rawText)
  } catch {
    return { ok: false, status: 400, error: 'Body is not JSON.' }
  }
  const { adapter } = await paymentAdapter(code)
  const verdict: any = await adapter.handleWebhookFunction({ provider: { code }, event, headers: input.headers, rawBody: rawText })
  if (!verdict?.isValid) return { ok: false, status: 400, error: 'Signature is invalid.' }
  const eventId = String(event?.id || '')
  if (!eventId) return { ok: false, status: 400, error: 'Missing event id.' }
  const payloadHash = paymentWebhookPayloadHash(input.rawBody)
  const existing = await prisma.paymentWebhookEvent.findUnique({ where: { providerEventId: `${code}:${eventId}` } })
  if (existing) return { ok: existing.payloadHash === payloadHash, status: existing.payloadHash === payloadHash ? 200 : 409, replayed: true }

  // Find the local session; the event is a hint and the status is read back from the provider.
  let sessionId = String(verdict.metadata?.paymentSessionId || '')
  if (!sessionId && verdict.checkoutSessionId) sessionId = (await prisma.paymentSession.findFirst({ where: { providerPaymentId: verdict.checkoutSessionId } }))?.id || ''
  let result: any = { ignored: true }
  if (sessionId) {
    const session = await reconcileCardSession(context, sessionId)
    result = { paymentSessionId: sessionId, status: session?.status }
  }
  try {
    await prisma.paymentWebhookEvent.create({ data: { provider: code, providerEventId: `${code}:${eventId}`, type: String(event?.type || ''), payloadHash, processedAt: new Date(), result } })
  } catch (error: any) {
    if (error?.code !== 'P2002') throw error
    return { ok: true, status: 200, replayed: true }
  }
  return { ok: true, status: 200, replayed: false, result }
}

// ---------------------------------------------------------------------------------------------
// Refunds (§5.9): never more than captured less already refunded, under a row lock.
// ---------------------------------------------------------------------------------------------

export async function reserveRefundTx(ctx: CommandCtx, input: { paymentId: string; amountCents: number; reason: string; claimId?: string | null; serviceRequestId?: string | null }, key: string) {
  const amount = Math.trunc(Number(input.amountCents))
  if (!Number.isSafeInteger(amount) || amount <= 0) refuse('The refund must be above zero.')
  const reason = String(input.reason || '').trim()
  if (reason.length < 3) refuse('Give a reason for the refund.')
  const payment = await lockRow(ctx.tx, 'Payment', input.paymentId)
  if (!payment || payment.status !== 'succeeded') refuse('Payment not found.')
  const pending = await ctx.tx.refund.aggregate({ where: { paymentId: payment.id, status: 'pending' }, _sum: { amountCents: true } })
  const room = payment.amountCents - payment.refundedCents - (pending._sum.amountCents || 0)
  if (amount > room) refuse(`At most ${(room / 100).toFixed(2)} can be refunded on this payment.`)
  const refund = await ctx.tx.refund.create({ data: { paymentId: payment.id, sessionId: payment.session, amountCents: amount, reason, status: 'pending', claimId: input.claimId || null, serviceRequestId: input.serviceRequestId || null, createdById: ctx.actorId, idempotencyKeyHash: hashKey(`refund:${key}`) } })
  if (payment.method !== 'card') {
    // Money paid by wire, ACH, check or cash is returned by the yard itself; the refund records it.
    await finishRefund(ctx, refund.id, { ok: true, providerRefundId: null })
  }
  await ctx.audit({ eventType: 'refund.created', aggregateType: 'Refund', aggregateId: refund.id, after: { paymentId: payment.id, amountCents: amount, method: payment.method }, reason })
  return ctx.tx.refund.findUnique({ where: { id: refund.id } })
}

export async function finishRefund(ctx: CommandCtx, refundId: string, outcome: { ok: boolean; providerRefundId: string | null; failureMessage?: string }) {
  const refund = await lockRow(ctx.tx, 'Refund', refundId)
  if (!refund || refund.status !== 'pending') return
  if (!outcome.ok) {
    await compareAndSet(ctx.tx, 'refund', refundId, 'pending', { status: 'failed', failureMessage: outcome.failureMessage || 'The provider refused the refund.' })
    return
  }
  await compareAndSet(ctx.tx, 'refund', refundId, 'pending', { status: 'succeeded', providerRefundId: outcome.providerRefundId })
  const payment = await lockRow(ctx.tx, 'Payment', refund.payment)
  await ctx.tx.payment.update({ where: { id: payment.id }, data: { refundedCents: payment.refundedCents + refund.amountCents } })
  if (payment.session) {
    const s = await lockRow(ctx.tx, 'PaymentSession', payment.session)
    const refunded = s.refundedCents + refund.amountCents
    await ctx.tx.paymentSession.update({ where: { id: s.id }, data: { refundedCents: refunded, status: refunded >= s.capturedCents ? 'refunded' : 'partially_refunded' } })
  }
  if (payment.invoice && !refund.claim) {
    const invoice = await lockRow(ctx.tx, 'Invoice', payment.invoice)
    await ctx.tx.invoice.update({ where: { id: invoice.id }, data: { refundedCents: invoice.refundedCents + refund.amountCents } })
  }
}

export async function runProviderRefund(context: any, refundId: string) {
  const prisma = context.sudo().prisma
  const refund = await prisma.refund.findUnique({ where: { id: refundId }, include: { session: { include: { provider: true } } } })
  if (!refund || refund.status !== 'pending' || !refund.session?.providerPaymentId) return refund
  const { adapter } = await paymentAdapter(refund.session.provider.code)
  let outcome: { ok: boolean; providerRefundId: string | null; failureMessage?: string }
  try {
    const result: any = await adapter.refundPaymentFunction({ provider: { code: refund.session.provider.code }, paymentId: refund.session.providerPaymentId, amount: refund.amountCents, idempotencyKey: `recycling-refund-${refund.id}` })
    outcome = { ok: result.status === 'refunded' || result.status === 'pending', providerRefundId: result.id || null, failureMessage: result.failureMessage }
  } catch (error) {
    outcome = { ok: false, providerRefundId: null, failureMessage: error instanceof Error ? error.message : String(error) }
  }
  await runCommand(context.sudo(), { name: 'finishRefund', input: { refundId }, idempotencyKey: `finish:${refundId}` }, async (ctx) => { await finishRefund(ctx, refundId, outcome); return { id: refundId } })
  return prisma.refund.findUnique({ where: { id: refundId } })
}

// ---------------------------------------------------------------------------------------------
// Settlements (§5.10)
// ---------------------------------------------------------------------------------------------

export async function buildSettlementTx(ctx: CommandCtx, input: { accountId: string; periodStart: string; periodEnd: string }) {
  const { tx } = ctx
  const account = await tx.account.findUnique({ where: { id: input.accountId } })
  if (!account) refuse('Account not found.')
  const start = new Date(input.periodStart)
  const end = new Date(input.periodEnd)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) refuse('The period is not valid.')
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'recycling-settlement', account.id)
  const tickets = await tx.scaleTicket.findMany({ where: { accountId: account.id, paymentMode: 'on_account', status: 'completed', settlementId: null, completedAt: { gte: start, lt: end } } })
  const charges = await tx.accountCharge.findMany({ where: { accountId: account.id, status: 'open', settlementId: null, OR: [{ serviceDate: null }, { serviceDate: { lt: end } }] } })
  const donations = account.isNonprofit ? await tx.donation.findMany({ where: { accountId: account.id, status: 'credited', settlementId: null, kind: 'payout_donation' } }) : []
  if (!tickets.length && !charges.length && !donations.length) refuse('Nothing is due for this account in that period.')
  const ticketTotal = tickets.reduce((s: number, t: any) => s + t.totalCents, 0)
  const chargeTotal = charges.reduce((s: number, c: any) => s + c.amountCents, 0)
  const donationTotal = donations.reduce((s: number, d: any) => s + d.amountCents, 0)
  const number = await ctx.sequence('business', 'settlement')
  const settlement = await tx.settlement.create({
    data: { accountId: account.id, number, status: 'draft', periodStart: start, periodEnd: end, ticketTotalCents: ticketTotal, chargeTotalCents: chargeTotal, donationTotalCents: donationTotal, netCents: ticketTotal - chargeTotal + donationTotal },
  })
  for (const t of tickets) if ((await tx.scaleTicket.updateMany({ where: { id: t.id, settlementId: null, status: 'completed' }, data: { settlementId: settlement.id } })).count !== 1) refuse('A ticket joined another settlement. Try again.')
  for (const c of charges) if ((await tx.accountCharge.updateMany({ where: { id: c.id, settlementId: null, status: 'open' }, data: { settlementId: settlement.id } })).count !== 1) refuse('A charge joined another settlement. Try again.')
  for (const d of donations) if ((await tx.donation.updateMany({ where: { id: d.id, settlementId: null, status: 'credited' }, data: { settlementId: settlement.id } })).count !== 1) refuse('A donation joined another settlement. Try again.')
  await ctx.audit({ eventType: 'settlement.built', aggregateType: 'Settlement', aggregateId: settlement.id, after: { tickets: tickets.length, charges: charges.length, donations: donations.length, netCents: settlement.netCents } })
  return settlement
}

export async function approveSettlementTx(ctx: CommandCtx, input: { settlementId: string }) {
  const { tx, now } = ctx
  const s = await lockRow(tx, 'Settlement', input.settlementId)
  if (!s) refuse('Settlement not found.')
  const account = await tx.account.findUnique({ where: { id: s.account } })
  const data: Record<string, unknown> = { status: 'approved', approvedById: ctx.actorId, approvedAt: now }
  if (s.netCents > 0) {
    const payout = await tx.payout.create({ data: { settlementId: s.id, accountId: s.account, amountCents: s.netCents, status: 'ready', allowedMethods: ['check', 'transfer'] } })
    data.payoutId = payout.id
  } else if (s.netCents < 0) {
    const number = await ctx.sequence('business', 'invoice')
    const invoice = await tx.invoice.create({ data: { number, accountId: s.account, kind: 'settlement_balance', status: 'open', subtotalCents: -s.netCents, taxCents: 0, totalCents: -s.netCents, settlementId: s.id, dueOn: new Date(now.getTime() + Number(account?.netDays ?? 30) * 86_400_000), lines: { create: [{ description: `Settlement ${s.number} balance`, amountCents: -s.netCents, kind: 'adjustment' }] } } })
    data.invoiceId = invoice.id
  }
  await compareAndSet(tx, 'settlement', s.id, 'draft', data, 'Only a draft settlement can be approved.')
  await tx.accountCharge.updateMany({ where: { settlementId: s.id, status: 'open' }, data: { status: 'settled' } })
  if (s.netCents === 0) await markSettlementPaid(ctx, s.id)
  await ctx.audit({ eventType: 'settlement.approved', aggregateType: 'Settlement', aggregateId: s.id, after: { netCents: s.netCents, payoutId: data.payoutId, invoiceId: data.invoiceId } })
  return tx.settlement.findUnique({ where: { id: s.id } })
}

async function markSettlementPaid(ctx: CommandCtx, settlementId: string) {
  const won = await ctx.tx.settlement.updateMany({ where: { id: settlementId, status: 'approved' }, data: { status: 'paid', paidAt: ctx.now } })
  if (won.count !== 1) return
  await ctx.tx.donation.updateMany({ where: { settlementId, status: 'credited' }, data: { status: 'disbursed' } })
  const tickets = await ctx.tx.scaleTicket.findMany({ where: { settlementId }, select: { id: true } })
  for (const t of tickets) await maybeSettleTicket(ctx.tx, t.id, ctx.now)
  await ctx.audit({ eventType: 'settlement.paid', aggregateType: 'Settlement', aggregateId: settlementId })
}

async function settleIfPaid(ctx: CommandCtx, settlementId: string) {
  const s = await ctx.tx.settlement.findUnique({ where: { id: settlementId }, include: { payout: true, invoice: true } })
  if (!s || s.status !== 'approved') return
  if ((s.payout && s.payout.status === 'paid') || (s.invoice && s.invoice.status === 'paid')) await markSettlementPaid(ctx, settlementId)
}

export async function voidSettlementTx(ctx: CommandCtx, input: { settlementId: string; reason: string }) {
  const reason = String(input.reason || '').trim()
  if (reason.length < 3) refuse('Give a reason.')
  const s = await lockRow(ctx.tx, 'Settlement', input.settlementId)
  if (!s) refuse('Settlement not found.')
  if (s.status === 'approved') {
    const payout = s.payout ? await ctx.tx.payout.findUnique({ where: { id: s.payout } }) : null
    const invoice = s.invoice ? await ctx.tx.invoice.findUnique({ where: { id: s.invoice } }) : null
    if (payout?.status === 'paid' || (invoice && invoice.paidCents > 0)) refuse('Money moved on this settlement; it cannot be voided.')
    if (payout) await compareAndSet(ctx.tx, 'payout', payout.id, ['ready', 'held', 'pending'], { status: 'cancelled', cancelReason: `Settlement voided: ${reason}` })
    if (invoice) await compareAndSet(ctx.tx, 'invoice', invoice.id, 'open', { status: 'void', voidReason: `Settlement voided: ${reason}` })
    await ctx.tx.accountCharge.updateMany({ where: { settlementId: s.id, status: 'settled' }, data: { status: 'open' } })
  }
  await compareAndSet(ctx.tx, 'settlement', s.id, ['draft', 'approved'], { status: 'void', voidReason: reason }, 'A paid settlement cannot be voided.')
  await ctx.tx.scaleTicket.updateMany({ where: { settlementId: s.id }, data: { settlementId: null } })
  await ctx.tx.accountCharge.updateMany({ where: { settlementId: s.id }, data: { settlementId: null } })
  await ctx.tx.donation.updateMany({ where: { settlementId: s.id }, data: { settlementId: null } })
  await ctx.audit({ eventType: 'settlement.voided', aggregateType: 'Settlement', aggregateId: s.id, reason })
  return ctx.tx.settlement.findUnique({ where: { id: s.id } })
}

// ---------------------------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------------------------

export const moneyTypeDefs = `
  type CardCheckout { paymentSessionId: ID!, url: String }
`

export const moneyMutationDefs = `
  openDrawerSession(drawerId: ID!, openingFloatCents: Int!, idempotencyKey: String): CashDrawerSession
  moveDrawerCash(sessionId: ID!, kind: String!, amountCents: Int!, note: String, idempotencyKey: String!): CashDrawerSession
  countDrawer(sessionId: ID!, countedCents: Int!, idempotencyKey: String): CashDrawerSession
  recountDrawer(sessionId: ID!): CashDrawerSession
  approveDrawerClose(sessionId: ID!, note: String!, idempotencyKey: String): CashDrawerSession
  payPayout(payoutId: ID!, method: String!, drawerSessionId: ID, checkNumber: String, bankAccountLabel: String, transferReference: String, idempotencyKey: String): Payout
  returnPayout(payoutId: ID!, reason: String!, idempotencyKey: String): Payout
  cancelPayout(payoutId: ID!, reason: String!, idempotencyKey: String): Payout
  recordInvoicePayment(invoiceId: ID!, method: String!, amountCents: Int!, reference: String, drawerSessionId: ID, receivedAt: String, idempotencyKey: String!): Payment
  voidInvoice(invoiceId: ID!, reason: String!, idempotencyKey: String): Invoice
  invoiceAccountCharges(accountId: ID!, netDays: Int, idempotencyKey: String): Invoice
  payInvoiceByCard(invoiceId: ID!, returnPath: String, idempotencyKey: String!): CardCheckout
  reconcilePaymentSession(paymentSessionId: ID!): PaymentSession
  refundPayment(paymentId: ID!, amountCents: Int!, reason: String!, idempotencyKey: String!): Refund
  buildSettlement(accountId: ID!, periodStart: String!, periodEnd: String!, idempotencyKey: String): Settlement
  approveSettlement(settlementId: ID!, idempotencyKey: String): Settlement
  voidSettlement(settlementId: ID!, reason: String!, idempotencyKey: String): Settlement
`

export const moneyQueryDefs = `
  payoutQueue(yardId: ID, includeReturned: Boolean): [Payout!]
`

async function canSeeInvoice(context: any, invoice: any) {
  const session = context.session
  if (hasFlag(session, 'canManageFinance') || hasFlag(session, 'canPaySellers')) return true
  if (!session?.itemId) return false
  const prisma = context.sudo().prisma
  if (invoice.accountId && await prisma.accountContact.findFirst({ where: { accountId: invoice.accountId, userId: session.itemId, status: 'active', role: { in: ['owner', 'billing', 'admin'] } } })) return true
  if (invoice.sellerId && await prisma.seller.findFirst({ where: { id: invoice.sellerId, userId: session.itemId } })) return true
  return false
}

export const moneyResolvers = {
  Mutation: {
    openDrawerSession: (_: unknown, a: any, c: any) => runCommand(c, { name: 'openDrawerSession', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: ['canPaySellers', 'canManageCashDrawers'], aggregateType: 'CashDrawerSession' }, (ctx) => openDrawerSessionTx(ctx, a)).then((r: any) => c.db.CashDrawerSession.findOne({ where: { id: r.id } })),
    moveDrawerCash: (_: unknown, a: any, c: any) => runCommand(c, { name: 'moveDrawerCash', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: ['canPaySellers', 'canManageCashDrawers'] }, (ctx) => moveDrawerCashTx(ctx, a, String(cleanKey(a.idempotencyKey)))).then((r: any) => c.db.CashDrawerSession.findOne({ where: { id: r.id } })),
    countDrawer: (_: unknown, a: any, c: any) => runCommand(c, { name: 'countDrawer', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: ['canPaySellers', 'canManageCashDrawers'] }, (ctx) => countDrawerTx(ctx, a)).then((r: any) => c.db.CashDrawerSession.findOne({ where: { id: r.id } })),
    recountDrawer: (_: unknown, a: any, c: any) => runCommand(c, { name: 'recountDrawer', input: a, permission: ['canPaySellers', 'canManageCashDrawers'] }, (ctx) => recountDrawerTx(ctx, a)).then((r: any) => c.db.CashDrawerSession.findOne({ where: { id: r.id } })),
    approveDrawerClose: (_: unknown, a: any, c: any) => runCommand(c, { name: 'approveDrawerClose', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: ['canApproveVariances'] }, (ctx) => approveDrawerCloseTx(ctx, a)).then((r: any) => c.db.CashDrawerSession.findOne({ where: { id: r.id } })),
    payPayout: (_: unknown, a: any, c: any) => runCommand(c, { name: 'payPayout', input: { ...a, idempotencyKey: undefined }, idempotencyKey: cleanKey(a.idempotencyKey), permission: 'canPaySellers', aggregateType: 'Payout' }, (ctx) => payPayoutTx(ctx, a)).then((r: any) => c.db.Payout.findOne({ where: { id: r.id } })),
    returnPayout: (_: unknown, a: any, c: any) => runCommand(c, { name: 'returnPayout', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: 'canManageFinance' }, (ctx) => returnPayoutTx(ctx, a)).then((r: any) => c.db.Payout.findOne({ where: { id: r.id } })),
    cancelPayout: (_: unknown, a: any, c: any) => runCommand(c, { name: 'cancelPayout', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: 'canApproveVariances' }, (ctx) => cancelPayoutTx(ctx, a)).then((r: any) => c.db.Payout.findOne({ where: { id: r.id } })),
    recordInvoicePayment: (_: unknown, a: any, c: any) => runCommand(c, { name: 'recordInvoicePayment', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: ['canManageFinance', 'canPaySellers'] }, (ctx) => recordInvoicePaymentTx(ctx, a, String(cleanKey(a.idempotencyKey)))).then((r: any) => c.db.Payment.findOne({ where: { id: r.id } })),
    voidInvoice: (_: unknown, a: any, c: any) => runCommand(c, { name: 'voidInvoice', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: 'canManageFinance' }, (ctx) => voidInvoiceTx(ctx, a)).then((r: any) => c.db.Invoice.findOne({ where: { id: r.id } })),
    invoiceAccountCharges: (_: unknown, a: any, c: any) => runCommand(c, { name: 'invoiceAccountCharges', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: 'canManageFinance' }, (ctx) => invoiceAccountChargesTx(ctx, a)).then((r: any) => c.db.Invoice.findOne({ where: { id: r.id } })),
    payInvoiceByCard: async (_: unknown, a: any, c: any) => {
      const invoice = await c.sudo().prisma.invoice.findUnique({ where: { id: a.invoiceId } })
      if (!invoice || !(await canSeeInvoice(c, invoice))) throw new CommandError('Invoice not found.', 'NOT_FOUND')
      const created: any = await runCommand(c, { name: 'payInvoiceByCard', input: { invoiceId: a.invoiceId }, idempotencyKey: cleanKey(a.idempotencyKey), requireSignIn: true }, (ctx) => createCardSessionTx(ctx, { invoiceId: a.invoiceId }, String(cleanKey(a.idempotencyKey))))
      const returnPath = typeof a.returnPath === 'string' && a.returnPath.startsWith('/') && !a.returnPath.startsWith('//') ? a.returnPath : `/account/invoices/${a.invoiceId}`
      const checkout = await startProviderCheckout(c.sudo().prisma, created.session.id, { description: created.description, payerEmail: created.payerEmail, returnPath })
      return { paymentSessionId: checkout.sessionId, url: checkout.url }
    },
    reconcilePaymentSession: async (_: unknown, a: any, c: any) => {
      const session = await c.sudo().prisma.paymentSession.findUnique({ where: { id: a.paymentSessionId } })
      if (!session) throw new CommandError('Payment not found.', 'NOT_FOUND')
      const staff = hasFlag(c.session, 'canManageFinance')
      if (!staff && session.payerId !== c.session?.itemId) throw new CommandError('Payment not found.', 'NOT_FOUND')
      const result = await reconcileCardSession(c, a.paymentSessionId)
      return staff ? c.db.PaymentSession.findOne({ where: { id: result.id } }) : { id: result.id, status: result.status, amountCents: result.amountCents }
    },
    refundPayment: async (_: unknown, a: any, c: any) => {
      const r: any = await runCommand(c, { name: 'refundPayment', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: 'canManageFinance' }, (ctx) => reserveRefundTx(ctx, a, String(cleanKey(a.idempotencyKey))))
      if (r.status === 'pending') await runProviderRefund(c, r.id)
      return c.db.Refund.findOne({ where: { id: r.id } })
    },
    buildSettlement: (_: unknown, a: any, c: any) => runCommand(c, { name: 'buildSettlement', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: 'canManageFinance' }, (ctx) => buildSettlementTx(ctx, a)).then((r: any) => c.db.Settlement.findOne({ where: { id: r.id } })),
    approveSettlement: (_: unknown, a: any, c: any) => runCommand(c, { name: 'approveSettlement', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: 'canManageFinance' }, (ctx) => approveSettlementTx(ctx, a)).then((r: any) => c.db.Settlement.findOne({ where: { id: r.id } })),
    voidSettlement: (_: unknown, a: any, c: any) => runCommand(c, { name: 'voidSettlement', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: 'canManageFinance' }, (ctx) => voidSettlementTx(ctx, a)).then((r: any) => c.db.Settlement.findOne({ where: { id: r.id } })),
  },
  Query: {
    payoutQueue: async (_: unknown, { yardId, includeReturned }: any, c: any) => {
      if (!hasFlag(c.session, 'canPaySellers') && !hasFlag(c.session, 'canManageFinance')) throw new CommandError('Staff only.', 'FORBIDDEN')
      await refreshDuePayouts(c.sudo().prisma, new Date())
      return c.db.Payout.findMany({ where: { status: { in: includeReturned ? ['ready', 'held', 'returned'] : ['ready', 'held'] }, ...(yardId ? { ticket: { yard: { id: { equals: yardId } } } } : {}) }, orderBy: [{ createdAt: 'asc' }] })
    },
  },
}
