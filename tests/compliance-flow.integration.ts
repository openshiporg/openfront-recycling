/**
 * Daily report CSV, do-not-buy import blocking check-in, theft alerts, police lookup, and donation receipts.
 */
import './db-guard'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { keystoneContext } from '../features/keystone/context'
import { ROLE_FLAGS } from '../features/keystone/access'
import { parseCsv } from '../features/recycling/csv'

const run = randomUUID().slice(0, 6).toUpperCase()
const prisma: any = (keystoneContext as any).prisma
const ALL = Object.fromEntries(ROLE_FLAGS.map((f) => [f, true]))

async function staff(yardIds: string[]) {
  const role = await prisma.role.create({ data: { name: `Compliance ${run} ${randomUUID().slice(0, 8)}`, ...ALL } })
  const user = await prisma.user.create({ data: { name: `Officer ${run}`, email: `o-${randomUUID()}@yard.example.com`, password: 'x'.repeat(60), roleId: role.id } })
  return keystoneContext.withSession({ itemId: user.id, listKey: 'User', data: { name: user.name, email: user.email, yards: yardIds.map((id) => ({ id })), role: { id: role.id, name: role.name, ...ALL } } })
}
async function gql(context: any, query: string, variables: any = {}) {
  const res = await context.graphql.raw({ query, variables })
  if (res.errors?.length) throw new Error(res.errors.map((e: any) => e.message).join('; '))
  return res.data
}

async function setup(profile: Record<string, unknown> = {}) {
  const code = randomUUID().slice(0, 4).toUpperCase()
  const rules = await prisma.rulesProfile.create({ data: { name: `Rules ${code}`, requireGovernmentId: true, requireIdPhoto: true, requireSellerPhoto: false, requireMaterialPhoto: false, requireVehiclePlate: true, requireSignature: false, requireThumbprint: false, minimumSellerAge: 18, retentionDays: 365, ...profile } })
  const yard = await prisma.yard.create({ data: { name: `Yard ${code}`, code, slug: `yard-${code.toLowerCase()}-${run.toLowerCase()}`, status: 'active', payoutMethods: ['cash', 'check'], timezone: 'America/New_York', rulesProfileId: rules.id } })
  const list = await prisma.priceList.create({ data: { name: `Board ${code}`, kind: 'board', yardId: yard.id, isActive: true } })
  await prisma.yard.update({ where: { id: yard.id }, data: { boardPriceListId: list.id } })
  const mcode = `CU${randomUUID().slice(0, 6)}`
  const material = await prisma.material.create({ data: { name: `#1 Copper Tubing ${run}`, slug: mcode.toLowerCase(), code: mcode, defaultUnit: 'lb', direction: 'pay_seller', isActive: true } })
  await prisma.priceEntry.create({ data: { priceListId: list.id, materialId: material.id, unit: 'lb', unitPrice: '3.20000', effectiveFrom: new Date(Date.now() - 60_000) } })
  const ctx = await staff([yard.id])
  return { yard, material, ctx }
}
async function sellerWithId(last: string, idNumber: string) {
  const s = await prisma.seller.create({ data: { firstName: 'Dana', lastName: last, searchName: `dana ${last.toLowerCase()}`, dateOfBirth: new Date('1981-04-02'), status: 'active', addressLine1: '5 Oak St', city: 'Canton', region: 'OH' } })
  await prisma.identityDocument.create({ data: { sellerId: s.id, kind: 'drivers_license', number: idNumber, numberNormalized: idNumber.replace(/[^a-z0-9]/gi, '').toUpperCase(), issuer: 'OH', expiresOn: new Date(Date.now() + 9e10), frontImage_id: 'f', frontImage_extension: 'jpg', isCurrent: true } })
  return s
}

test('daily report lists each completed line, omits prices when the profile says so, guards formula cells, and locks once submitted', async () => {
  const { yard, material, ctx } = await setup({ reportOmitsPrice: true, dailyReport: true })
  const seller = await sellerWithId(`=HYPERLINK${run}`, `OH-${run}`)
  const { openTicket } = await gql(ctx, `mutation($d: OpenTicketInput!) { openTicket(data: $d) { id } }`, { d: { yardId: yard.id, sellerId: seller.id, vehiclePlate: 'HGT 4411' } })
  await gql(ctx, `mutation($d: TicketLineInput!) { addTicketLine(data: $d) { id } }`, { d: { ticketId: openTicket.id, materialId: material.id, grossWeight: '120', tareWeight: '0' } })
  await gql(ctx, `mutation($t: ID!) { completeTicket(ticketId: $t) { id } }`, { t: openTicket.id })

  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const { generateComplianceReport: report } = await gql(ctx, `mutation($y: ID!, $d: String!) { generateComplianceReport(yardId: $y, reportDate: $d) { id ticketCount status } }`, { y: yard.id, d: parts })
  assert.equal(report.ticketCount, 1)
  const { complianceReportCsv } = await gql(ctx, `query($r: ID!) { complianceReportCsv(reportId: $r) }`, { r: report.id })
  const rows = parseCsv(complianceReportCsv)
  assert.equal(rows.length, 2)
  const header = rows[0]
  const line = Object.fromEntries(header.map((h, i) => [h, rows[1][i]]))
  assert.equal(line.seller_last_name, `'=HYPERLINK${run}`)
  assert.equal(line.id_number, `OH-${run}`)
  assert.equal(line.vehicle_plate, 'HGT4411')
  assert.equal(line.unit_price, '')
  assert.equal(line.amount, '')
  await gql(ctx, `mutation($r: ID!) { markComplianceReportSubmitted(reportId: $r, note: "Uploaded at noon") { status } }`, { r: report.id })
  await assert.rejects(gql(ctx, `mutation($y: ID!, $d: String!) { generateComplianceReport(yardId: $y, reportDate: $d) { id } }`, { y: yard.id, d: parts }), /already submitted/)

  const { policeLookup } = await gql(ctx, `query($p: String) { policeLookup(plate: $p) { id } }`, { p: 'hgt-4411' })
  assert.ok(policeLookup.some((t: any) => t.id === openTicket.id))
})

test('imported do-not-buy entry blocks check-in by ID number, without override', async () => {
  const { yard, ctx } = await setup()
  const idNumber = `ZX-${run}-77`
  const csv = `first_name,last_name,date_of_birth,id_number,plate,source,reason\r\nRay,Holt${run},1975-02-03,${idNumber},,court,"Order 24-CV-118, theft of wire"\r\n,,,,,,\r\n`
  const { importDoNotBuyList } = await gql(ctx, `mutation($c: String!) { importDoNotBuyList(csv: $c) { created skipped errors } }`, { c: csv })
  assert.equal(importDoNotBuyList.created, 1)
  const again = await gql(ctx, `mutation($c: String!) { importDoNotBuyList(csv: $c) { created skipped } }`, { c: csv })
  assert.equal(again.importDoNotBuyList.skipped, 1)
  const seller = await sellerWithId(`Holt${run}`, idNumber)
  await assert.rejects(gql(ctx, `mutation($d: OpenTicketInput!) { openTicket(data: $d) { id } }`, { d: { yardId: yard.id, sellerId: seller.id, vehiclePlate: 'ABC1', overrideReason: 'Known regular' } }), /do-not-buy|do not buy/i)
})

test('theft alert matches a material by link or keyword', async () => {
  const { material, ctx } = await setup()
  await prisma.theftAlert.create({ data: { title: `Stolen tubing ${run}`, description: 'Copper tubing from a jobsite', keywords: 'tubing, line set', isActive: true, agency: 'Stark County Sheriff' } })
  const { theftAlertsForMaterial } = await gql(ctx, `query($m: ID!) { theftAlertsForMaterial(materialId: $m) { title } }`, { m: material.id })
  assert.ok(theftAlertsForMaterial.some((a: any) => a.title === `Stolen tubing ${run}`))
})
