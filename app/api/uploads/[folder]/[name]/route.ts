import { servePublicUpload } from '@/features/keystone/lib/serve-upload'

export const runtime = 'nodejs'

/** GET /api/uploads/public/<file>: public images stored on the server's disk (no S3). */
export async function GET(_req: Request, { params }: { params: Promise<{ folder: string; name: string }> }) {
  const { folder, name } = await params
  return servePublicUpload(folder, name)
}
