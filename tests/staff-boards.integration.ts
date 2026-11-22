/**
 * Staff dashboard reads (dissertation §9): scale-house board, drawer state, price grid, seller search.
 *   npm run test:integration -- tests/staff-boards.integration.ts
 */
import './db-guard'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { keystoneContext } from '../features/keystone/context'
import { ROLE_FLAGS } from '../features/keystone/access'

const run = randomUUID().slice(0, 6).toUpperCase()
const prisma: any = (keystoneContext as any).prisma

async function staff(flags: Record<string, boolean>, yardIds: string[]) {
  const role = await prisma.role.create({ data: { name: `Board ${run} ${randomUUID().slice(0, 6)}`, ...flags } })
  const user = await prisma.user.create({ data: { name: `Cashier ${run}`, email: `board-${randomUUID().slice(0, 8)}@yard.example.com`, password: 'x'.repeat(60), roleId: role.id } })
  return keystoneContext.withSession({ itemId: user.id, listKey: 'User', data: { name: user.name, email: user.email, yards: yardIds.map((id) => ({ id })), role: { id: role.id, name: role.name, ...flags } } })
}
async function gql(context: any, query: string, variables: any = {}) {
  const res = await context.graphql.raw({ query, variables })
  if (res.errors?.length) throw new Error(res.errors.map((e: any) => `${e.extensions?.code || ''} ${e.message}`).join('; '))
  return JSON.parse(JSON.stringify(res.data))
}

test('scale-house board, drawer, price grid and seller search follow real records and the yard', async () => {
  const code = `B${run.slice(0, 4)}`
  const yard = await prisma.yard.create({ data: { name: `Board Yard ${run}`, code, slug: `board-${run.toLowerCase()}`, status: 'active', timezone: 'America/New_York', payoutMethods: ['cash', 'check'] } })
  const other = await prisma.yard.create({ data: { name: `Other Yard ${run}`, code: `O${run.slice(0, 4)}`, slug: `other-${run.toLowerCase()}`, status: 'active' } })
  const list = await prisma.priceList.create({ data: { name: `Board ${run}`, kind: 'board', yardId: yard.id, isActive: true } })
  await prisma.yard.update({ where: { id: yard.id }, data: { boardPriceListId: list.id } })
  const mat = await prisma.material.create({ data: { name: `Insulated Wire ${run}`, slug: `wire-${run.toLowerCase()}`, code: `IW${run}`, defaultUnit: 'lb', isActive: true } })
  const owner = await staff(Object.fromEntries(ROLE_FLAGS.map((f) => [f, true])), [yard.id])
  const clerk = await staff({ canAccessDashboard: true, canManageTickets: true, canPaySellers: true }, [yard.id])
  const outsider = await staff({ canAccessDashboard: true, canManageTickets: true, canPaySellers: true }, [other.id])

  const publish = `mutation($l: ID!, $e: [PublishPriceInput!]!) { publishPrices(priceListId: $l, entries: $e) { count } }`
  await gql(owner, publish, { l: list.id, e: [{ materialId: mat.id, unitPrice: '1.10' }] })
  await gql(owner, publish, { l: list.id, e: [{ materialId: mat.id, unitPrice: '1.25' }] })
  const grid = (await gql(clerk, `query($l: ID!) { priceBoardGrid(priceListId: $l) { name rows { materialId unitPrice previousPrice change } } }`, { l: list.id })).priceBoardGrid
  const row = grid.rows.find((r: any) => r.materialId === mat.id)
  assert.deepEqual([row.unitPrice, row.previousPrice, row.change], ['1.25', '1.1', '0.15'])

  const seller = await prisma.seller.create({ data: { firstName: 'Lorraine', lastName: `Okafor${run}`, searchName: `lorraine okafor${run.toLowerCase()}`, phone: '(614) 555-0177', dateOfBirth: new Date('1979-08-14'), status: 'active' } })
  await prisma.identityDocument.create({ data: { sellerId: seller.id, kind: 'drivers_license', number: `OH${run}42`, numberNormalized: `OH${run}42`, expiresOn: new Date(Date.now() + 300 * 86_400_000), frontImage_id: `id-${run}`, frontImage_extension: 'jpg', isCurrent: true } })
  await prisma.vehicle.create({ data: { sellerId: seller.id, plate: `JK${run.slice(0, 3)}-4`, plateRegion: 'OH' } })
  const search = `query($q: String!) { searchSellers(q: $q) { id matchedOn idLast4 plates } }`
  for (const [q, why] of [[`okafor${run}`, 'name'], [`oh${run}42`, 'id_number'], ['6145550177', 'phone'], [`jk ${run.slice(0, 3)}4`, 'plate']]) {
    const hits = (await gql(clerk, search, { q })).searchSellers
    const hit = hits.find((h: any) => h.id === seller.id)
    assert.ok(hit, `found by ${why}`)
    assert.ok(hit.matchedOn.includes(why), `${why} in ${hit.matchedOn}`)
  }

  // One open ticket with a line, then complete it so it shows under Ready to pay.
  const open = (await gql(clerk, `mutation($d: OpenTicketInput!) { openTicket(data: $d) { id } }`, { d: { yardId: yard.id, sellerId: seller.id, vehiclePlate: `JK${run.slice(0, 3)}4` } })).openTicket
  let board = (await gql(clerk, `query($y: ID!) { scaleHouseBoard(yardId: $y) { weighing { ticketId } readyToComplete { ticketId missing { code } } readyToPay { payoutId } } }`, { y: yard.id })).scaleHouseBoard
  assert.ok(board.weighing.some((t: any) => t.ticketId === open.id))
  await gql(clerk, `mutation($d: TicketLineInput!) { addTicketLine(data: $d) { id } }`, { d: { ticketId: open.id, materialId: mat.id, grossWeight: '100', tareWeight: '0' } })
  board = (await gql(clerk, `query($y: ID!) { scaleHouseBoard(yardId: $y) { weighing { ticketId } readyToComplete { ticketId missing { code } } readyToPay { payoutId amountCents } } }`, { y: yard.id })).scaleHouseBoard
  const card = board.readyToComplete.find((t: any) => t.ticketId === open.id)
  assert.ok(card && card.missing.length > 0, 'shows what is missing before completion')
  for (const kind of ['material_photo', 'signature']) await prisma.ticketAttachment.create({ data: { ticketId: open.id, kind, image_id: `${kind}-${run}`, image_extension: 'jpg', image_filesize: 1000 } })
  await gql(clerk, `mutation($t: ID!) { completeTicket(ticketId: $t) { id } }`, { t: open.id })
  board = (await gql(clerk, `query($y: ID!) { scaleHouseBoard(yardId: $y) { readyToComplete { ticketId } readyToPay { payoutId amountCents } } }`, { y: yard.id })).scaleHouseBoard
  assert.ok(!board.readyToComplete.some((t: any) => t.ticketId === open.id))
  assert.ok(board.readyToPay.some((p: any) => p.amountCents === 12500))

  const drawer = await prisma.cashDrawer.create({ data: { name: `Counter ${run}`, yardId: yard.id, isActive: true } })
  await gql(clerk, `mutation($d: ID!) { openDrawerSession(drawerId: $d, openingFloatCents: 20000) { id } }`, { d: drawer.id })
  const state = (await gql(clerk, `query($y: ID!) { drawerState(yardId: $y) { drawers { drawerId session { isMine expectedCents totals { kind amountCents } } } } }`, { y: yard.id })).drawerState
  const mine = state.drawers.find((d: any) => d.drawerId === drawer.id)
  assert.equal(mine.session.isMine, true)
  assert.equal(mine.session.expectedCents, 20000)

  await assert.rejects(gql(outsider, `query($y: ID!) { scaleHouseBoard(yardId: $y) { yardId } }`, { y: yard.id }), /yard/)
  await assert.rejects(gql(outsider, `query($y: ID!) { drawerState(yardId: $y) { yardId } }`, { y: yard.id }), /yard/)
  await assert.rejects(gql(outsider, `query($l: ID!) { priceBoardGrid(priceListId: $l) { name } }`, { l: list.id }), /yard/)
  await assert.rejects(gql(keystoneContext, `query { searchSellers(q: "okafor") { id } }`), /Staff only/)
})

test.after(async () => { await prisma.$disconnect() })
