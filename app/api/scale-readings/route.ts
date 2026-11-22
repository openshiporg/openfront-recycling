import { keystoneContext } from '@/features/keystone/context'
import { boundedRequestText } from '@/features/keystone/lib/bounded-body'
import { recordScaleReading } from '@/features/keystone/commands/tickets'

export const runtime = 'nodejs'

/**
 * POST /api/scale-readings
 *   Authorization: Bearer <scale key from Settings → Scales>
 *   { "weight": 1520.5, "stable": true }
 * Stores the scale's latest reading. The ticket screen's "Read scale" uses a stable reading under 10 seconds old.
 */
export async function POST(request: Request) {
  const key = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  let body: any
  try { body = JSON.parse(await boundedRequestText(request, 4096)) } catch { return Response.json({ error: 'Send JSON: {"weight": number, "stable": boolean}' }, { status: 400 }) }
  try {
    const reading = await recordScaleReading((keystoneContext as any).sudo().prisma, key, body || {})
    return Response.json(reading)
  } catch (error: any) {
    const unauth = error?.extensions?.code === 'UNAUTHENTICATED'
    return Response.json({ error: error?.message || 'Reading not stored.' }, { status: unauth ? 401 : 400 })
  }
}
