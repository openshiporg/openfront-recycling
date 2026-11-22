/**
 * Company portal C12 documents and certificate requests, C13 team, C14 vehicles (dissertation §8.3).
 *   npm run test:integration -- tests/storefront-account-team.integration.ts
 */
import './db-guard'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
// @ts-expect-error no types shipped for this deep import
import Upload from 'graphql-upload/Upload.js'
import { keystoneContext } from '../features/keystone/context'
import { ROLE_FLAGS } from '../features/keystone/access'
import { servePrivateUpload } from '../features/keystone/lib/serve-upload'
import { s3Configured } from '../features/keystone/lib/storage'

const run = randomUUID().slice(0, 6).toUpperCase()
const prisma: any = (keystoneContext as any).prisma
const anon: any = keystoneContext
const DAY = 86_400_000

async function gql(context: any, query: string, variables: any = {}) {
  const res = await context.graphql.raw({ query, variables })
  if (res.errors?.length) throw new Error(res.errors.map((e: any) => `${e.extensions?.code || ''} ${e.message}`).join('; '))
  return JSON.parse(JSON.stringify(res.data))
}
const as = (user: any) => anon.withSession({ itemId: user.id, listKey: 'User', data: { name: user.name, email: user.email, yards: [], role: null } })
const user = (tag: string) => prisma.user.create({ data: { name: `${tag} ${run}`, email: `${tag.toLowerCase()}-${run.toLowerCase()}@team.example.com`, phone: '614-555-0100', password: 'not-used-here-123' } })
function pdf() {
  const u = new Upload()
  u.resolve({ filename: 'certificate.pdf', mimetype: 'application/pdf', encoding: '7bit', createReadStream: () => Readable.from([Buffer.from('%PDF-1.4\n%%EOF\n')]) } as any)
  return { upload: u }
}

const DOCS = `query($s: String!, $k: String) { accountDocuments(accountSlug: $s, kind: $k) { documents { id kind title fileName fileUrl ticketId ticketNumber } certificatesRequested { ticketId ticketNumber } } }`
const TEAM = `query($s: String!) { accountTeam(accountSlug: $s) { canManage myContactId members { id role status isMe name email phone } } }`
const VEH = `query($s: String!) { accountVehicles(accountSlug: $s) { id plate storedTare tareExpired ticketCount lastTicketAt } }`

test('C12 to C14: documents and certificate requests, team, vehicles; each only for the account’s own contacts', async () => {
  const yard = await prisma.yard.create({ data: { name: `Team Yard ${run}`, code: `T${run.slice(0, 4)}`, slug: `team-${run.toLowerCase()}`, status: 'active' } })
  const acct = await prisma.account.create({ data: { name: `Allied Fab ${run}`, slug: `allied-fab-${run.toLowerCase()}`, status: 'active', isSupplier: true } })
  const rival = await prisma.account.create({ data: { name: `Rival ${run}`, slug: `rival-${run.toLowerCase()}`, status: 'active', isSupplier: true } })
  const admin = await user('Admin'), member = await user('Member'), outsider = await user('Outsider')
  const adminC = await prisma.accountContact.create({ data: { accountId: acct.id, userId: admin.id, role: 'admin', status: 'active' } })
  await prisma.accountContact.create({ data: { accountId: acct.id, userId: member.id, role: 'member', status: 'active' } })
  await prisma.accountContact.create({ data: { accountId: acct.id, userId: null, role: 'billing', status: 'invited', inviteEmail: `ap-${run.toLowerCase()}@team.example.com` } })
  await prisma.accountContact.create({ data: { accountId: rival.id, userId: outsider.id, role: 'admin', status: 'active' } })

  const truck = await prisma.vehicle.create({ data: { accountId: acct.id, plate: `AF${run.slice(0, 4)}`, kind: 'roll_off', storedTare: '26140.00', storedTareExpiresOn: new Date(Date.now() + 30 * DAY) } })
  await prisma.vehicle.create({ data: { accountId: acct.id, plate: `OLD${run.slice(0, 3)}`, kind: 'semi', storedTare: '31000.00', storedTareExpiresOn: new Date(Date.now() - DAY) } })
  await prisma.vehicle.create({ data: { accountId: acct.id, plate: `GONE${run.slice(0, 2)}`, kind: 'pickup', isRemoved: true } })
  await prisma.vehicle.create({ data: { accountId: rival.id, plate: `RV${run.slice(0, 4)}`, kind: 'pickup' } })
  const ticket = await prisma.scaleTicket.create({ data: { yardId: yard.id, direction: 'inbound', number: 1, status: 'completed', accountId: acct.id, vehicleId: truck.id, paymentMode: 'on_account', completedAt: new Date(), lookupCode: `T${run}A` } })
  const open = await prisma.scaleTicket.create({ data: { yardId: yard.id, direction: 'inbound', number: 2, status: 'open', accountId: acct.id, paymentMode: 'on_account', lookupCode: `T${run}B` } })
  const rivalTicket = await prisma.scaleTicket.create({ data: { yardId: yard.id, direction: 'inbound', number: 3, status: 'completed', accountId: rival.id, paymentMode: 'on_account', completedAt: new Date(), lookupCode: `T${run}C` } })

  // C14 vehicles.
  const v = (await gql(as(member), VEH, { s: acct.slug })).accountVehicles
  assert.deepEqual(v.map((x: any) => x.plate).sort(), [`AF${run.slice(0, 4)}`, `OLD${run.slice(0, 3)}`].sort())
  const live = v.find((x: any) => x.id === truck.id)
  assert.equal(live.storedTare, '26140')
  assert.equal(live.tareExpired, false)
  assert.equal(live.ticketCount, 1)
  assert.ok(live.lastTicketAt)
  assert.equal(v.find((x: any) => x.id !== truck.id).tareExpired, true)
  await assert.rejects(gql(as(outsider), VEH, { s: acct.slug }), /NOT_FOUND/)
  await assert.rejects(gql(anon, VEH, { s: acct.slug }), /UNAUTHENTICATED/)

  // C13 team: the admin sees the pending invite and phones; a member sees active people only.
  const ta = (await gql(as(admin), TEAM, { s: acct.slug })).accountTeam
  assert.equal(ta.canManage, true)
  assert.equal(ta.myContactId, adminC.id)
  assert.equal(ta.members.length, 3)
  assert.ok(ta.members.some((m: any) => m.status === 'invited' && m.email === `ap-${run.toLowerCase()}@team.example.com`))
  assert.ok(ta.members.find((m: any) => m.isMe).phone)
  const tm = (await gql(as(member), TEAM, { s: acct.slug })).accountTeam
  assert.equal(tm.canManage, false)
  assert.equal(tm.members.length, 2)
  assert.ok(tm.members.every((m: any) => m.phone === null && m.status === 'active'))
  await assert.rejects(gql(as(outsider), TEAM, { s: acct.slug }), /NOT_FOUND/)

  // C12: request a certificate, staff issue it with a file, the contact sees and downloads it.
  const REQ = `mutation($s: String!, $t: ID!) { requestTicketCertificate(accountSlug: $s, ticketId: $t) { ticketId certificateRequested } }`
  await assert.rejects(gql(as(member), REQ, { s: acct.slug, t: open.id }), /complete/)
  await assert.rejects(gql(as(member), REQ, { s: acct.slug, t: rivalTicket.id }), /not found/i)
  await assert.rejects(gql(as(outsider), REQ, { s: acct.slug, t: ticket.id }), /not found/i)
  assert.equal((await gql(as(member), REQ, { s: acct.slug, t: ticket.id })).requestTicketCertificate.certificateRequested, true)
  await gql(as(member), REQ, { s: acct.slug, t: ticket.id })
  let d = (await gql(as(admin), DOCS, { s: acct.slug })).accountDocuments
  assert.deepEqual(d.certificatesRequested.map((r: any) => r.ticketId), [ticket.id])
  assert.match(d.certificatesRequested[0].ticketNumber, new RegExp(`^T${run.slice(0, 4)}-I-000001$`))
  assert.equal(await prisma.auditEvent.count({ where: { aggregateId: ticket.id, eventType: 'ticket.certificate_requested' } }), 1, 'asking twice records once')

  const role = await prisma.role.create({ data: { name: `Accounts ${run}`, canAccessDashboard: true, canManageAccounts: true } })
  const staffUser = await prisma.user.create({ data: { name: `Staff ${run}`, email: `staff-${run.toLowerCase()}@team.example.com`, password: 'x'.repeat(60), roleId: role.id, yards: { connect: [{ id: yard.id }] } } })
  const flags = Object.fromEntries(ROLE_FLAGS.map((f) => [f, f === 'canAccessDashboard' || f === 'canManageAccounts']))
  const staff = anon.withSession({ itemId: staffUser.id, listKey: 'User', data: { name: staffUser.name, email: staffUser.email, yards: [{ id: yard.id }], role: { id: role.id, name: role.name, ...flags } } })
  await staff.db.AccountDocument.createOne({ data: { account: { connect: { id: acct.id } }, ticket: { connect: { id: ticket.id } }, kind: 'certificate', title: 'Certificate of recycling', file: pdf() } as any })
  await staff.db.AccountDocument.createOne({ data: { account: { connect: { id: acct.id } }, kind: 'contract', title: 'Internal pricing memo', visibleToAccount: false } })
  await staff.db.AccountDocument.createOne({ data: { account: { connect: { id: rival.id } }, kind: 'w9', title: 'Rival W-9' } })

  d = (await gql(as(member), DOCS, { s: acct.slug })).accountDocuments
  assert.equal(d.documents.length, 1, 'hidden documents and other accounts are never listed')
  const cert = d.documents[0]
  assert.equal(cert.kind, 'certificate')
  assert.equal(cert.ticketId, ticket.id)
  assert.ok(cert.fileName?.endsWith('.pdf'))
  assert.ok(cert.fileUrl)
  assert.equal(d.certificatesRequested.length, 0, 'an issued certificate leaves the request list')
  if (!s3Configured()) {
    const name = cert.fileUrl.split('/').pop()
    assert.equal((await servePrivateUpload(as(member), 'private-files', name)).status, 200, 'the contact downloads the certificate')
    assert.equal((await servePrivateUpload(as(outsider), 'private-files', name)).status, 404)
  }
  assert.equal((await gql(as(member), DOCS, { s: acct.slug, k: 'w9' })).accountDocuments.documents.length, 0)
  await assert.rejects(gql(as(member), DOCS, { s: acct.slug, k: 'passport' }), /kind/)
  await assert.rejects(gql(as(outsider), DOCS, { s: acct.slug }), /NOT_FOUND/)

  // Bounded access review: suspension preserves reads; membership revocation does not.
  await prisma.account.update({ where: { id: acct.id }, data: { status: 'suspended' } })
  for (const query of [DOCS, TEAM, VEH]) await gql(as(member), query, { s: acct.slug })
  const filename = cert.fileUrl.split('/').pop()
  if (!s3Configured()) {
    const response = await servePrivateUpload(as(member), 'private-files', filename)
    assert.equal(response.status, 200, 'active contacts retain reads on suspended accounts')
    assert.equal(response.headers.get('cache-control'), 'private, no-store', 'a future request must reauthorize after revocation')
    assert.equal((await servePrivateUpload(anon, 'private-files', filename)).status, 401)
    assert.equal((await servePrivateUpload(as(member), 'private-files', '../certificate.pdf')).status, 404)
    assert.equal((await servePrivateUpload(as(member), 'private-files', 'unknown.pdf')).status, 404)
  }
  await prisma.accountDocument.update({ where: { id: cert.id }, data: { visibleToAccount: false } })
  assert.equal((await gql(as(member), DOCS, { s: acct.slug })).accountDocuments.documents.length, 0)
  if (!s3Configured()) assert.equal((await servePrivateUpload(as(member), 'private-files', filename)).status, 404, 'known filename cannot bypass hidden document')
  await prisma.accountDocument.update({ where: { id: cert.id }, data: { visibleToAccount: true } })

  for (const status of ['invited', 'removed']) {
    await prisma.accountContact.updateMany({ where: { accountId: acct.id, userId: member.id }, data: { status } })
    for (const query of [DOCS, TEAM, VEH]) await assert.rejects(gql(as(member), query, { s: acct.slug }), /NOT_FOUND/)
    await assert.rejects(gql(as(member), REQ, { s: acct.slug, t: ticket.id }), /NOT_FOUND/)
    if (!s3Configured()) assert.equal((await servePrivateUpload(as(member), 'private-files', filename)).status, 404, `${status} contact cannot reuse a known filename`)
  }
  // Revoke an actual invitation through the command, then refuse its original token.
  const invitee = await user('Invitee')
  const invitation = (await gql(as(admin), `mutation($a: ID!, $e: String!) { inviteAccountContact(accountId: $a, email: $e, role: "member") { contactId token } }`, { a: acct.id, e: invitee.email })).inviteAccountContact
  await gql(as(admin), `mutation($c: ID!) { updateAccountContact(contactId: $c, remove: true) { id } }`, { c: invitation.contactId })
  await assert.rejects(gql(as(invitee), `mutation($t: String!) { acceptAccountInvite(token: $t) { id } }`, { t: invitation.token }), /not valid any more/)
  for (const query of [DOCS, TEAM, VEH]) await assert.rejects(gql(as(invitee), query, { s: acct.slug }), /NOT_FOUND/)
  if (!s3Configured()) assert.equal((await servePrivateUpload(as(invitee), 'private-files', filename)).status, 404)
})

test.after(async () => { await prisma.$disconnect() })
