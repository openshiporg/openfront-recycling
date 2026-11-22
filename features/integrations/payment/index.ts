import type { PaymentAdapterModule } from './types'

export type PaymentWebhookRegistration = { secretEnv: string; signatureHeader: string }

export type PaymentAdapterRegistration = {
  load: () => Promise<PaymentAdapterModule>
  /** `offline` providers have no processor: money is recorded by staff (wire, ACH, check, cash). */
  settlement: 'offline' | 'processor'
  webhook: PaymentWebhookRegistration | null
}

// Provider execution is code-owned (adapted from Barbershop). Database rows may select only one of
// these keys; they never supply an import path, URL or secret.
export const paymentProviderAdapters = {
  manual: { load: () => import('./manual') as Promise<PaymentAdapterModule>, settlement: 'offline', webhook: null },
  stripe: { load: () => import('./stripe') as Promise<PaymentAdapterModule>, settlement: 'processor', webhook: { secretEnv: 'STRIPE_WEBHOOK_SECRET', signatureHeader: 'stripe-signature' } },
} as const satisfies Record<string, PaymentAdapterRegistration>

export type PaymentProviderAdapterCode = keyof typeof paymentProviderAdapters

export function isPaymentProviderAdapterCode(value: string): value is PaymentProviderAdapterCode {
  return Object.prototype.hasOwnProperty.call(paymentProviderAdapters, value)
}

export function getPaymentProviderRegistration(code: string): PaymentAdapterRegistration | null {
  const bare = code.replace(/^pp_/, '')
  return isPaymentProviderAdapterCode(bare) ? paymentProviderAdapters[bare] : null
}

export async function paymentAdapter(code: string) {
  const registration = getPaymentProviderRegistration(code)
  if (!registration) throw new Error(`Payment adapter ${code} is not registered.`)
  return { registration, adapter: await registration.load() }
}
