import { keystoneContext } from '@/features/keystone/context'
import { boundedRequestBytes, BoundedBodyError } from '@/features/keystone/lib/bounded-body'
import { processPaymentWebhook } from '@/features/keystone/commands/money'

export const runtime = 'nodejs'
const MAX_WEBHOOK_BYTES = 1_000_000

export async function POST(request: Request, { params }: { params: Promise<{ providerCode: string }> }) {
  const { providerCode } = await params
  if (Number(request.headers.get('content-length') || 0) > MAX_WEBHOOK_BYTES) return Response.json({ success: false }, { status: 413 })
  let rawBody: Uint8Array
  try { rawBody = await boundedRequestBytes(request, MAX_WEBHOOK_BYTES) }
  catch (error) { return Response.json({ success: false }, { status: error instanceof BoundedBodyError ? error.status : 400 }) }
  try {
    const result = await processPaymentWebhook(keystoneContext, { providerCode, rawBody, headers: Object.fromEntries(request.headers.entries()) })
    return Response.json({ success: result.ok }, { status: result.status })
  } catch (error) {
    console.error('[payment-webhook]', error)
    // 500 so the provider retries; the event is recorded only after it was processed.
    return Response.json({ success: false }, { status: 500 })
  }
}
