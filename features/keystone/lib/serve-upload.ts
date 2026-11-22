import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { LOCAL_UPLOAD_ROOT } from './storage'

/**
 * Serving files kept on the server's disk (no S3). Public images go to anyone; private images and
 * files only to a signed-in user whose own list and field access lets them read the record that
 * holds the file, so this route never grants more than GraphQL would.
 */

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf',
  csv: 'text/csv; charset=utf-8', txt: 'text/plain; charset=utf-8',
}

/** Who may hold a private file: list, the field's GraphQL name, and how the stored name is matched. */
const PRIVATE_IMAGES = [
  { list: 'IdentityDocument', prisma: 'identityDocument', field: 'frontImage' },
  { list: 'IdentityDocument', prisma: 'identityDocument', field: 'backImage' },
  { list: 'IdentityDocument', prisma: 'identityDocument', field: 'thumbprintImage' },
  { list: 'TicketAttachment', prisma: 'ticketAttachment', field: 'image' },
  { list: 'WeighEvent', prisma: 'weighEvent', field: 'photo' },
]
const PRIVATE_FILES = [
  { list: 'TicketAttachment', prisma: 'ticketAttachment', field: 'file' },
  { list: 'AccountDocument', prisma: 'accountDocument', field: 'file' },
  { list: 'AccountApplication', prisma: 'accountApplication', field: 'w9' },
  { list: 'ComplianceReport', prisma: 'complianceReport', field: 'file' },
]

/** A single safe file name: no folders, no dot-dot, only the characters Keystone writes. */
export function safeName(name: string) {
  const n = decodeURIComponent(String(name || ''))
  if (!/^[A-Za-z0-9._-]{1,200}$/.test(n) || n.startsWith('.') || n.includes('..')) return null
  return n
}

async function send(folder: string, name: string, cache: string) {
  const full = path.join(LOCAL_UPLOAD_ROOT, folder, name)
  if (!full.startsWith(path.join(LOCAL_UPLOAD_ROOT, folder) + path.sep)) return new Response('Not found', { status: 404 })
  try {
    const s = await stat(full)
    if (!s.isFile()) return new Response('Not found', { status: 404 })
    const body = await readFile(full)
    const ext = name.split('.').pop()!.toLowerCase()
    return new Response(new Uint8Array(body), { headers: { 'content-type': TYPES[ext] || 'application/octet-stream', 'content-length': String(body.length), 'cache-control': cache, 'x-content-type-options': 'nosniff' } })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}

export async function servePublicUpload(folder: string, name: string) {
  const n = safeName(name)
  if (folder !== 'public' || !n) return new Response('Not found', { status: 404 })
  return send('public', n, 'public, max-age=86400')
}

/** context: a Keystone context built from the request's session cookie. */
export async function servePrivateUpload(context: any, folder: string, name: string) {
  const n = safeName(name)
  if (!n || !['private-images', 'private-files'].includes(folder)) return new Response('Not found', { status: 404 })
  if (!context?.session?.itemId) return new Response('Sign in to see this file.', { status: 401 })
  const prisma = context.sudo().prisma
  const holders = folder === 'private-images' ? PRIVATE_IMAGES : PRIVATE_FILES
  const id = n.replace(/\.[^.]+$/, '')
  if (folder === 'private-files') {
    // Company portal (C12): an active contact of the account gets the documents shared with it, as accountDocuments lists them.
    const doc = await prisma.accountDocument.findFirst({ where: { file_filename: n, visibleToAccount: true, accountId: { not: null } }, select: { accountId: true } })
    if (doc && (await prisma.accountContact.findFirst({ where: { accountId: doc.accountId, userId: context.session.itemId, status: 'active' }, select: { id: true } }))) {
      return send(folder, n, 'private, max-age=300')
    }
  }
  for (const h of holders) {
    const where: Record<string, string> = folder === 'private-images' ? { [`${h.field}_id`]: id } : { [`${h.field}_filename`]: n }
    const rows: Array<{ id: string }> = await prisma[h.prisma].findMany({ where, select: { id: true }, take: 5 })
    for (const r of rows as Array<{ id: string }>) {
      // Read it back through the user's own access: null or a missing field means no.
      const item: any = await context.query[h.list].findOne({ where: { id: r.id }, query: `id ${h.field} { ${folder === 'private-images' ? 'id' : 'filename'} }` }).catch(() => null)
      const value: any = item?.[h.field]
      if (value && (value.id === id || value.filename === n)) return send(folder, n, 'private, max-age=300')
    }
  }
  return new Response('Not found', { status: 404 })
}
