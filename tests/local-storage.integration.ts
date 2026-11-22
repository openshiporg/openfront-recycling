/**
 * Photos and files on the server's disk when no S3 is configured (dissertation §10): a fresh deployment
 * has no upload folders, the first photo must still save, and only someone who can read the record gets it back.
 *   npm run test:integration -- tests/local-storage.integration.ts
 */
import './db-guard'
import './fresh-upload-dir'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { Readable } from 'node:stream'
// @ts-expect-error no types shipped for this deep import
import Upload from 'graphql-upload/Upload.js'
import path from 'node:path'
import { keystoneContext } from '../features/keystone/context'
import { ROLE_FLAGS } from '../features/keystone/access'
import { LOCAL_UPLOAD_ROOT } from '../features/keystone/lib/storage'
import { servePrivateUpload, servePublicUpload } from '../features/keystone/lib/serve-upload'

const run = randomUUID().slice(0, 6).toUpperCase()
const prisma: any = (keystoneContext as any).prisma
// A real 1×1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
// The same Upload object the multipart parser (graphql-upload) hands Keystone for a browser upload.
function upload(filename: string) {
  const u = new Upload()
  u.resolve({ filename, mimetype: 'image/png', encoding: '7bit', createReadStream: () => Readable.from([PNG]) } as any)
  return { upload: u }
}

async function staff(flags: Record<string, boolean> | null, yardIds: string[]) {
  const role = flags ? await prisma.role.create({ data: { name: `Store ${run} ${randomUUID().slice(0, 6)}`, ...flags } }) : null
  const user = await prisma.user.create({ data: { name: `Staff ${run}`, email: `st-${randomUUID().slice(0, 8)}@riverside.example.com`, password: 'x'.repeat(60), roleId: role?.id ?? null } })
  return keystoneContext.withSession({ itemId: user.id, listKey: 'User', data: { name: user.name, email: user.email, yards: yardIds.map((id) => ({ id })), role: role ? { id: role.id, name: role.name, ...flags } : null } })
}

test('a material photo saves on a fresh disk and is served only to staff who can read the ticket', async () => {
  assert.ok(LOCAL_UPLOAD_ROOT.endsWith('not-yet-created'))
  for (const f of ['public', 'private-images', 'private-files']) assert.ok(existsSync(path.join(LOCAL_UPLOAD_ROOT, f)), `${f} folder created at startup`)

  const yard = await prisma.yard.create({ data: { name: `Store Yard ${run}`, code: `S${run.slice(0, 4)}`, slug: `store-${run.toLowerCase()}`, status: 'active', payoutMethods: ['check'] } })
  const other = await prisma.yard.create({ data: { name: `Other Yard ${run}`, code: `O${run.slice(0, 4)}`, slug: `other-${run.toLowerCase()}`, status: 'active', payoutMethods: ['check'] } })
  const seller = await prisma.seller.create({ data: { firstName: 'Lena', lastName: `Ortiz${run}`, searchName: `lena ortiz${run.toLowerCase()}`, dateOfBirth: new Date('1979-05-21'), status: 'active' } })
  const all = Object.fromEntries(ROLE_FLAGS.map((f) => [f, true]))
  const operator = await staff({ canAccessDashboard: true, canManageTickets: true, canManageSellers: true }, [yard.id])
  const elsewhere = await staff({ canAccessDashboard: true, canManageTickets: true, canManageSellers: true }, [other.id])
  const owner = await staff(all, [yard.id])
  // ID images use the same private store (and the ID lets the ticket open).
  const doc = await owner.db.IdentityDocument.createOne({ data: { seller: { connect: { id: seller.id } }, kind: 'drivers_license', number: `LO${run}`, expiresOn: new Date(Date.now() + 90 * 86_400_000).toISOString(), frontImage: upload('license.png') } as any })
  const docRow = await prisma.identityDocument.findUnique({ where: { id: doc.id } })
  const t = (await owner.graphql.raw({ query: `mutation($d: OpenTicketInput!) { openTicket(data: $d) { id } }`, variables: { d: { yardId: yard.id, sellerId: seller.id } } })) as any
  assert.equal(t.errors, undefined, JSON.stringify(t.errors))
  const ticketId = t.data.openTicket.id

  const att = await operator.db.TicketAttachment.createOne({ data: { ticket: { connect: { id: ticketId } }, kind: 'material_photo', image: upload('copper.png') } as any })
  const row = await prisma.ticketAttachment.findUnique({ where: { id: att.id } })
  assert.ok(row.image_id && row.image_extension === 'png')
  const name = `${row.image_id}.png`
  assert.ok(existsSync(path.join(LOCAL_UPLOAD_ROOT, 'private-images', name)))
  const read = await operator.query.TicketAttachment.findOne({ where: { id: att.id }, query: 'image { url }' })
  assert.equal(read.image.url, `/api/private-files/private-images/${name}`)

  const ok = await servePrivateUpload(operator, 'private-images', name)
  assert.equal(ok.status, 200)
  assert.equal(ok.headers.get('content-type'), 'image/png')
  assert.deepEqual(Buffer.from(await ok.arrayBuffer()), PNG)
  assert.equal((await servePrivateUpload(elsewhere, 'private-images', name)).status, 404, 'staff at another yard cannot fetch it')
  assert.equal((await servePrivateUpload(keystoneContext, 'private-images', name)).status, 401, 'signed out')
  assert.equal((await servePrivateUpload(operator, 'private-images', '..%2F..%2Fpasswd')).status, 404)
  assert.equal((await servePublicUpload('private-images', name)).status, 404, 'private files never come through the public route')

  assert.equal((await servePrivateUpload(operator, 'private-images', `${docRow.frontImage_id}.png`)).status, 200)
})

test.after(async () => { await prisma.$disconnect() })
