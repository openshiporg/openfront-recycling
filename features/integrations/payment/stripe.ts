import { createHmac, timingSafeEqual } from 'node:crypto'
import type { PaymentAdapterArgs } from './types'

// Stripe Checkout through Stripe's REST API (adapted from Barbershop). The secret key comes from
// STRIPE_SECRET_KEY. Money is confirmed by reading the Checkout Session back from Stripe (on return
// and from the signed webhook), never from the browser.

const API = 'https://api.stripe.com/v1'

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Card payments are not set up yet. Add the Stripe secret key in Settings → Payments, or take payment in person.')
  return key
}

function form(values: Record<string, string | number | undefined>) {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') body.append(key, String(value))
  return body
}

async function stripe<T>(path: string, init: { method?: 'GET' | 'POST'; body?: URLSearchParams; idempotencyKey?: string } = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: init.method || 'GET',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...(init.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}),
    },
    body: init.body,
    redirect: 'error',
  })
  const json = await response.json().catch(() => ({})) as { error?: { message?: string } } & T
  if (!response.ok) throw new Error(json.error?.message || `Stripe request failed (${response.status}).`)
  return json
}

type CheckoutSession = { id: string; url: string | null; status: string; payment_status: string; amount_total: number | null; currency: string | null; payment_intent: string | null | { id: string; amount_received?: number }; metadata?: Record<string, string> }
type PaymentIntent = { id: string; amount: number; amount_received: number; latest_charge: string | null | { amount_refunded: number } }

function sessionStatus(session: CheckoutSession) {
  if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') return 'captured'
  if (session.status === 'expired') return 'expired'
  return 'pending'
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export async function createPaymentFunction({ amount, currency, successUrl, cancelUrl, description, idempotencyKey, metadata, customerEmail }: PaymentAdapterArgs) {
  const cents = Math.round(Number(amount))
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('Payment amount must be greater than zero.')
  const meta = (metadata && typeof metadata === 'object' ? metadata : {}) as Record<string, unknown>
  const session = await stripe<CheckoutSession>('/checkout/sessions', {
    method: 'POST',
    idempotencyKey: asString(idempotencyKey) || undefined,
    body: form({
      mode: 'payment',
      success_url: asString(successUrl),
      cancel_url: asString(cancelUrl),
      ...(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asString(customerEmail)) ? { customer_email: asString(customerEmail) } : {}),
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': asString(currency || 'usd').toLowerCase(),
      'line_items[0][price_data][unit_amount]': cents,
      'line_items[0][price_data][product_data][name]': asString(description) || 'Payment',
      ...Object.fromEntries(Object.entries(meta).map(([key, value]) => [`metadata[${key}]`, asString(value)])),
      ...Object.fromEntries(Object.entries(meta).map(([key, value]) => [`payment_intent_data[metadata][${key}]`, asString(value)])),
    }),
  })
  return { status: sessionStatus(session), id: session.id, url: session.url, data: { id: session.id, url: session.url, status: session.status, amount: session.amount_total, provider: 'stripe' } }
}

export const generatePaymentLinkFunction = createPaymentFunction

export async function getPaymentStatusFunction({ paymentId }: PaymentAdapterArgs) {
  const session = await stripe<CheckoutSession>(`/checkout/sessions/${encodeURIComponent(asString(paymentId))}?expand[]=payment_intent.latest_charge`)
  const intent = (session.payment_intent && typeof session.payment_intent === 'object' ? session.payment_intent : null) as PaymentIntent | null
  const charge = intent && intent.latest_charge && typeof intent.latest_charge === 'object' ? intent.latest_charge : null
  const refundedAmount = charge ? charge.amount_refunded : 0
  let status = sessionStatus(session)
  if (status === 'captured' && refundedAmount > 0) status = refundedAmount >= (session.amount_total || 0) ? 'refunded' : 'partially_refunded'
  return {
    status, amount: session.amount_total, currency: session.currency, refundedAmount,
    data: { id: session.id, status: session.status, paymentStatus: session.payment_status, paymentIntent: intent?.id || session.payment_intent, amount: session.amount_total },
  }
}

/** Checkout captures on payment; capture reports the session's settled state. */
export async function capturePaymentFunction(args: PaymentAdapterArgs) {
  return getPaymentStatusFunction(args)
}

export async function refundPaymentFunction({ paymentId, amount, idempotencyKey }: PaymentAdapterArgs) {
  const session = await stripe<CheckoutSession>(`/checkout/sessions/${encodeURIComponent(asString(paymentId))}`)
  const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  if (!intentId) throw new Error('This payment has nothing to refund.')
  const refund = await stripe<{ id: string; status: string; amount: number; failure_reason?: string }>('/refunds', {
    method: 'POST',
    idempotencyKey: asString(idempotencyKey) || undefined,
    body: form({ payment_intent: intentId, amount: amount == null ? undefined : Math.round(Number(amount)) }),
  })
  return { status: refund.status === 'succeeded' ? 'refunded' : refund.status, id: refund.id, amount: refund.amount, failureMessage: refund.failure_reason || '', data: refund }
}

/**
 * Stripe signs webhooks as `Stripe-Signature: t=<unix>,v1=<hex hmac of "t.rawBody">`.
 * The event is only a hint: the caller reads the Checkout Session back from Stripe.
 */
export function verifyStripeSignature(rawBody: string, header: string, secret: string, toleranceSeconds = 300, now = Date.now()) {
  if (!header || !secret) return false
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=')).filter((p) => p.length === 2).map(([k, v]) => [k, v])) as Record<string, string>
  const timestamp = Number(parts.t)
  if (!Number.isFinite(timestamp) || Math.abs(now / 1000 - timestamp) > toleranceSeconds) return false
  const expected = createHmac('sha256', secret).update(`${parts.t}.${rawBody}`, 'utf8').digest()
  const signatures = header.split(',').map((p) => p.trim()).filter((p) => p.startsWith('v1=')).map((p) => p.slice(3))
  return signatures.some((sig) => {
    if (!/^[a-f0-9]{64}$/i.test(sig)) return false
    const received = Buffer.from(sig, 'hex')
    return received.length === expected.length && timingSafeEqual(received, expected)
  })
}

export async function handleWebhookFunction({ event, headers, rawBody }: PaymentAdapterArgs) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || ''
  const signature = asString((headers as Record<string, unknown>)?.['stripe-signature'])
  if (!verifyStripeSignature(asString(rawBody), signature, secret)) return { isValid: false }
  const record = (event || {}) as { id?: string; type?: string; data?: { object?: { id?: string; object?: string; metadata?: Record<string, string>; payment_intent?: string } } }
  const object = record.data?.object || {}
  const checkoutSessionId = object.object === 'checkout.session' ? object.id : ''
  return { isValid: true, eventId: record.id, type: record.type, checkoutSessionId, paymentIntentId: object.object === 'payment_intent' ? object.id : object.payment_intent || '', metadata: object.metadata || {} }
}
