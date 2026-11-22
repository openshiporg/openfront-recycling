import type { IncomingMessage } from 'node:http'
import { keystoneContext } from '@/features/keystone/context'
import { servePrivateUpload } from '@/features/keystone/lib/serve-upload'

export const runtime = 'nodejs'

/**
 * GET /api/private-files/<private-images|private-files>/<file>: ID images, ticket photos, signatures,
 * W-9s and reports on the server's disk. Only for a signed-in user who can read the record holding it.
 */
export async function GET(req: Request, { params }: { params: Promise<{ folder: string; name: string }> }) {
  const { folder, name } = await params
  const context = await keystoneContext.withRequest({ headers: { cookie: req.headers.get('cookie') || '' }, method: 'GET', url: new URL(req.url).pathname } as IncomingMessage)
  return servePrivateUpload(context, folder, name)
}
