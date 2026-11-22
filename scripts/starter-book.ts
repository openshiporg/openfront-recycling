/**
 * Starter book (dissertation §11 "include a starter book"): a realistic set of records so the dashboard
 * and the portals are not empty on day one. Every record goes through the same commands staff and
 * customers use (openTicket, addTicketLine, completeTicket, payPayout, placePoliceHold, buildSettlement,
 * submitAccountApplication, draftListing, submitOffer, scheduleShipment, createServiceRequest, ...), so
 * totals, inventory, payouts and audit agree. It only adds records; it never deletes or resets.
 *
 * Safe to run twice: people, accounts, listings and requests are found before they are made, tickets
 * are opened with stable idempotency keys, and each later step runs only if the record still needs it.
 *
 * After the commands run, the book's ticket, payout, donation and invoice dates are spread over the last
 * 14 days so the reports have a history. Audit events, weigh events, drawer events and inventory movements
 * are append-only and keep the real time they were written.
 *
 *   node --import tsx scripts/starter-book.ts
 * Needs DATABASE_URL and an onboarded business (scripts/onboard.ts) with the owner user, the staff roles,
 * a scale operator and a cashier at the first yard. New logins are appended to STARTER_LOGINS_FILE
 * (default ~/.config/openfront/recycling-scratch-logins.txt, mode 600); passwords never print.
 */
import { appendFileSync, chmodSync, existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { Readable } from 'node:stream'
// @ts-expect-error no types shipped for this deep import
import Upload from 'graphql-upload/Upload.js'
import sharp from 'sharp'
import { keystoneContext } from '../features/keystone/context'
import { ROLE_FLAGS } from '../features/keystone/access'
import { registerCustomer } from '../features/keystone/commands/storefront-seller'

const prisma: any = (keystoneContext as any).prisma
const DAY = 86_400_000
const NOW = Date.now()
const KEY = 'starter-book'
const LOGINS = process.env.STARTER_LOGINS_FILE || path.join(homedir(), '.config/openfront/recycling-scratch-logins.txt')
const ROOT = path.resolve(__dirname, '..')

// --- helpers -------------------------------------------------------------------------------------
const log = (...a: unknown[]) => console.log('[starter-book]', ...a)
async function gql(ctx: any, query: string, variables: any = {}) {
  const res = await ctx.graphql.raw({ query, variables })
  if (res.errors?.length) throw new Error(res.errors.map((e: any) => e.message).join('; '))
  return res.data
}
/** A time `daysAgo` days back at a local yard hour (America/New_York, UTC-5 in winter). */
function at(daysAgo: number, hour: number, minute = 0) {
  const d = new Date(NOW - daysAgo * DAY)
  d.setUTCHours(hour + 5, minute, 0, 0)
  return daysAgo >= 0 && d.getTime() > NOW ? new Date(NOW - 5 * 60_000) : d
}
function upload(buffer: Buffer, filename: string, mimetype: string) {
  const u = new Upload()
  u.resolve({ filename, mimetype, encoding: '7bit', createReadStream: () => Readable.from([buffer]) } as any)
  return { upload: u }
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
async function svgPng(svg: string) { return sharp(Buffer.from(svg)).png().toBuffer() }
async function photo(file: string, width = 640) { return sharp(path.join(ROOT, 'public/storefront', file)).resize(width).jpeg({ quality: 78 }).toBuffer() }
function licenceCard(s: SellerSpec) {
  return svgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="404"><rect width="640" height="404" rx="24" fill="#eef3f8"/><rect width="640" height="70" rx="24" fill="#b3122e"/><text x="28" y="46" font-family="Helvetica" font-size="28" font-weight="bold" fill="#fff">OHIO  DRIVER LICENSE</text><rect x="28" y="96" width="170" height="210" rx="8" fill="#c9d3de"/><circle cx="113" cy="170" r="44" fill="#8796a8"/><rect x="58" y="226" width="110" height="70" rx="35" fill="#8796a8"/><g font-family="Helvetica" fill="#1d2633"><text x="226" y="120" font-size="16">DL NO.</text><text x="226" y="146" font-size="24" font-weight="bold">${esc(s.idNumber)}</text><text x="226" y="186" font-size="22" font-weight="bold">${esc(s.last.toUpperCase())}</text><text x="226" y="214" font-size="22">${esc(s.first.toUpperCase())}</text><text x="226" y="252" font-size="16">DOB ${s.dob}</text><text x="226" y="278" font-size="16">EXP ${s.idExpires}</text><text x="226" y="304" font-size="16">${esc(s.address.toUpperCase())}</text><text x="226" y="326" font-size="16">${esc(s.city.toUpperCase())}, OH ${s.zip}</text></g></svg>`)
}
function portrait(s: SellerSpec) {
  return svgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="440"><rect width="360" height="440" fill="#d9dee4"/><circle cx="180" cy="170" r="82" fill="#7a8796"/><rect x="70" y="270" width="220" height="190" rx="100" fill="#7a8796"/><text x="180" y="420" text-anchor="middle" font-family="Helvetica" font-size="22" fill="#1d2633">${esc(s.first)} ${esc(s.last)}</text></svg>`)
}
function signature(name: string) {
  return svgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="120"><rect width="100%" height="100%" fill="#fff"/><line x1="20" y1="92" x2="460" y2="92" stroke="#9aa4b1"/><text x="28" y="80" font-family="Snell Roundhand, Brush Script MT, cursive" font-size="44" fill="#1c2a5a">${esc(name)}</text></svg>`)
}

async function sessionFor(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, include: { role: true, yards: { select: { id: true } } } })
  if (!u) throw new Error(`User ${userId} not found.`)
  const role = u.role ? { id: u.role.id, name: u.role.name, ...Object.fromEntries(ROLE_FLAGS.map((f) => [f, Boolean(u.role[f])])) } : null
  return keystoneContext.withSession({ itemId: u.id, listKey: 'User', data: { name: u.name, email: u.email, yards: u.yards, role } } as any)
}
function remember(line: string) {
  appendFileSync(LOGINS, `${line}\n`)
  try { chmodSync(LOGINS, 0o600) } catch {}
}
/** A customer login through the storefront's registerCustomer command. Found by email on a second run. */
async function customer(name: string, email: string, label: string) {
  const found = await prisma.user.findFirst({ where: { email } })
  if (found) return found.id
  const password = randomBytes(12).toString('base64url')
  const u = await registerCustomer(keystoneContext, { name, email, password })
  remember(`${label}: ${email} / ${password}  (user ${u.id})`)
  log('login created', email)
  return u.id
}

// --- the book --------------------------------------------------------------------------------------
type SellerSpec = { first: string; last: string; dob: string; phone: string; address: string; city: string; zip: string; idNumber: string; idExpires: string; plate: string; make: string; model: string; color: string; kind: string; payout: string; verify: boolean }
const SELLERS: SellerSpec[] = [
  { first: 'Darnell', last: 'Brooks', dob: '1981-03-14', phone: '614-555-0142', address: '1187 Oakwood Ave', city: 'Columbus', zip: '43206', idNumber: 'TR418273', idExpires: '2029-03-14', plate: 'JKR4471', make: 'Ford', model: 'F-150', color: 'Gray', kind: 'pickup', payout: 'cash', verify: true },
  { first: 'Rosa', last: 'Delgado', dob: '1975-09-02', phone: '614-555-0187', address: '322 Whittier St', city: 'Columbus', zip: '43206', idNumber: 'RD551902', idExpires: '2028-09-02', plate: 'HFN2208', make: 'Chevrolet', model: 'Silverado', color: 'White', kind: 'pickup', payout: 'cash', verify: true },
  { first: 'Wayne', last: 'Hutchins', dob: '1968-11-21', phone: '740-555-0113', address: '48 Canal St', city: 'Canal Winchester', zip: '43110', idNumber: 'WH330871', idExpires: '2027-11-21', plate: 'GTA9015', make: 'Dodge', model: 'Ram 2500', color: 'Red', kind: 'pickup', payout: 'check', verify: true },
  { first: 'Tamika', last: 'Greene', dob: '1990-06-30', phone: '614-555-0129', address: '2710 Cleveland Ave', city: 'Columbus', zip: '43211', idNumber: 'TG902114', idExpires: '2030-06-30', plate: 'KLM3390', make: 'Toyota', model: 'Tacoma', color: 'Blue', kind: 'pickup', payout: 'cash', verify: false },
  { first: 'Earl', last: 'Showalter', dob: '1959-01-08', phone: '740-555-0166', address: '9 Mill Rd', city: 'Lockbourne', zip: '43137', idNumber: 'ES118560', idExpires: '2028-01-08', plate: 'DPX7724', make: 'GMC', model: 'Sierra', color: 'Green', kind: 'pickup', payout: 'check', verify: true },
  { first: 'Linh', last: 'Tran', dob: '1986-04-17', phone: '614-555-0151', address: '5520 Refugee Rd', city: 'Columbus', zip: '43232', idNumber: 'LT774031', idExpires: '2029-04-17', plate: 'JBS6612', make: 'Honda', model: 'Ridgeline', color: 'Silver', kind: 'pickup', payout: 'cash', verify: true },
  { first: 'Bobby', last: 'Keane', dob: '1979-12-05', phone: '614-555-0174', address: '1401 Lockbourne Rd', city: 'Columbus', zip: '43207', idNumber: 'BK665218', idExpires: '2027-12-05', plate: 'HXR1048', make: 'Ford', model: 'Ranger', color: 'Black', kind: 'pickup', payout: 'check', verify: false },
  { first: 'Marisol', last: 'Vega', dob: '1993-08-19', phone: '614-555-0138', address: '760 S Ohio Ave', city: 'Columbus', zip: '43205', idNumber: 'MV209967', idExpires: '2031-08-19', plate: 'KCE5583', make: 'Nissan', model: 'Frontier', color: 'White', kind: 'pickup', payout: 'cash', verify: true },
  { first: 'Curtis', last: 'Lyle', dob: '1972-02-27', phone: '740-555-0190', address: '215 High St', city: 'Groveport', zip: '43125', idNumber: 'CL483305', idExpires: '2028-02-27', plate: 'FWT8836', make: 'Chevrolet', model: 'Express', color: 'White', kind: 'box_truck', payout: 'check', verify: true },
  { first: 'Janet', last: 'Okafor', dob: '1984-10-11', phone: '614-555-0105', address: '3349 E Livingston Ave', city: 'Columbus', zip: '43227', idNumber: 'JO590428', idExpires: '2030-10-11', plate: 'JPQ2257', make: 'Ford', model: 'Transit', color: 'Blue', kind: 'other', payout: 'check', verify: true },
]

type Line = { m: string; gross?: string; tare?: string; qty?: number; docs?: string[] }
type TicketSpec = {
  n: number; days: number; hour: number; yard: 'EAST' | 'WEST' | 'GROVE'
  seller?: number; account?: 'kessler' | 'buckeye'; truck?: Array<[string, string?]>; lines?: Line[]
  outcome: 'check' | 'cash' | 'transfer' | 'ready' | 'held' | 'police' | 'fee' | 'void' | 'open' | 'donate' | 'on_account'
}
const T: TicketSpec[] = [
  { n: 1, days: 13, hour: 8, yard: 'EAST', seller: 0, lines: [{ m: 'CU-1', gross: '66', tare: '4' }], outcome: 'check' },
  { n: 2, days: 13, hour: 10, yard: 'EAST', seller: 1, lines: [{ m: 'AL-UBC', gross: '52', tare: '3' }, { m: 'AL-SHT', gross: '124', tare: '0' }], outcome: 'check' },
  { n: 3, days: 12, hour: 9, yard: 'EAST', account: 'kessler', truck: [['38400'], ['24200', 'FE-HMS1']], outcome: 'on_account' },
  { n: 4, days: 12, hour: 13, yard: 'EAST', seller: 2, lines: [{ m: 'FE-HMS2', gross: '1880', tare: '0' }], outcome: 'check' },
  { n: 5, days: 11, hour: 9, yard: 'EAST', seller: 3, lines: [{ m: 'BR-Y', gross: '87', tare: '2' }, { m: 'CU-2', gross: '42', tare: '2' }], outcome: 'check' },
  { n: 6, days: 11, hour: 11, yard: 'GROVE', account: 'buckeye', truck: [['14620'], ['13980', 'CU-ICW-M'], ['13710', 'BR-RAD']], outcome: 'transfer' },
  { n: 7, days: 10, hour: 10, yard: 'EAST', seller: 4, lines: [{ m: 'FE-APP', gross: '960', tare: '0' }, { m: 'FE-HMS2', gross: '410', tare: '0' }], outcome: 'check' },
  { n: 8, days: 10, hour: 14, yard: 'EAST', account: 'kessler', truck: [['31900'], ['22100', 'FE-PS']], outcome: 'on_account' },
  { n: 9, days: 9, hour: 9, yard: 'EAST', seller: 5, lines: [{ m: 'CU-BB', gross: '37', tare: '1' }], outcome: 'check' },
  { n: 10, days: 9, hour: 12, yard: 'WEST', seller: 6, lines: [{ m: 'AL-RIM', gross: '92', tare: '0' }], outcome: 'check' },
  { n: 11, days: 8, hour: 10, yard: 'EAST', seller: 7, lines: [{ m: 'AL-UBC', gross: '146', tare: '6' }], outcome: 'donate' },
  { n: 12, days: 8, hour: 15, yard: 'EAST', seller: 8, lines: [{ m: 'CAT', qty: 2, docs: ['vehicle_title'] }], outcome: 'check' },
  { n: 13, days: 7, hour: 9, yard: 'EAST', seller: 9, lines: [{ m: 'SS-304', gross: '214', tare: '10' }], outcome: 'check' },
  { n: 14, days: 7, hour: 13, yard: 'GROVE', account: 'buckeye', truck: [['12880'], ['12610', 'CU-1'], ['12300', 'AL-SHT']], outcome: 'transfer' },
  { n: 15, days: 6, hour: 10, yard: 'EAST', seller: 0, lines: [{ m: 'CU-2', gross: '58', tare: '3' }], outcome: 'check' },
  { n: 16, days: 6, hour: 14, yard: 'EAST', account: 'kessler', truck: [['37100'], ['24500', 'FE-HMS1']], outcome: 'on_account' },
  { n: 17, days: 5, hour: 11, yard: 'WEST', seller: 1, lines: [{ m: 'AL-CST', gross: '134', tare: '4' }], outcome: 'check' },
  { n: 18, days: 5, hour: 15, yard: 'EAST', seller: 2, lines: [{ m: 'CU-1', gross: '212', tare: '6' }, { m: 'BR-Y', gross: '96', tare: '2' }], outcome: 'police' },
  { n: 19, days: 4, hour: 9, yard: 'EAST', seller: 3, lines: [{ m: 'PB-BAT', gross: '128', tare: '0' }], outcome: 'check' },
  { n: 20, days: 4, hour: 12, yard: 'EAST', seller: 4, lines: [{ m: 'FEE-TIRE', qty: 4 }], outcome: 'fee' },
  { n: 21, days: 3, hour: 10, yard: 'EAST', seller: 5, lines: [{ m: 'AL-UBC', gross: '88', tare: '4' }], outcome: 'donate' },
  { n: 22, days: 3, hour: 13, yard: 'GROVE', account: 'buckeye', truck: [['13240'], ['12890', 'CU-ICW-H']], outcome: 'ready' },
  { n: 23, days: 2, hour: 11, yard: 'EAST', seller: 6, lines: [{ m: 'CAT', qty: 1, docs: ['vehicle_title'] }], outcome: 'held' },
  { n: 24, days: 2, hour: 14, yard: 'WEST', seller: 7, lines: [{ m: 'AL-UBC', gross: '64', tare: '3' }], outcome: 'check' },
  { n: 25, days: 1, hour: 9, yard: 'EAST', seller: 8, lines: [{ m: 'EL-WIRE', gross: '118', tare: '4' }], outcome: 'check' },
  { n: 26, days: 1, hour: 13, yard: 'EAST', seller: 9, lines: [{ m: 'CU-1', gross: '44', tare: '2' }], outcome: 'check' },
  { n: 27, days: 0, hour: 8, yard: 'EAST', seller: 0, lines: [{ m: 'BR-Y', gross: '71', tare: '2' }], outcome: 'cash' },
  { n: 28, days: 0, hour: 9, yard: 'EAST', seller: 1, lines: [{ m: 'AL-SHT', gross: '96', tare: '0' }, { m: 'AL-UBC', gross: '31', tare: '2' }], outcome: 'cash' },
  { n: 29, days: 0, hour: 10, yard: 'EAST', seller: 2, lines: [{ m: 'CU-2', gross: '76', tare: '3' }], outcome: 'ready' },
  { n: 30, days: 0, hour: 10, yard: 'EAST', seller: 3, lines: [{ m: 'AL-CST', gross: '40', tare: '0' }], outcome: 'void' },
  { n: 31, days: 0, hour: 11, yard: 'EAST', seller: 4, lines: [{ m: 'FE-HMS2', gross: '1320', tare: '0' }], outcome: 'open' },
]

;(async () => {
  if (!existsSync(LOGINS)) throw new Error(`Logins file ${LOGINS} not found; create it (mode 600) first.`)
  const yards: Record<string, any> = Object.fromEntries((await prisma.yard.findMany()).map((y: any) => [y.code, y]))
  for (const c of ['EAST', 'WEST', 'GROVE']) if (!yards[c]) throw new Error(`Yard ${c} is missing; run onboarding first.`)
  const materials: Record<string, any> = Object.fromEntries((await prisma.material.findMany()).map((m: any) => [m.code, m]))
  const ownerUser = await prisma.user.findFirst({ where: { role: { name: 'Owner' } }, orderBy: { createdAt: 'asc' } })
  const operatorUser = await prisma.user.findFirst({ where: { role: { name: 'Scale operator' }, yards: { some: { id: yards.EAST.id } } }, orderBy: { createdAt: 'asc' } })
  const cashierUser = await prisma.user.findFirst({ where: { role: { name: 'Cashier' }, yards: { some: { id: yards.EAST.id } } }, orderBy: { createdAt: 'asc' } })
  if (!ownerUser || !operatorUser || !cashierUser) throw new Error('Needs the owner, a scale operator and a cashier at the first yard.')
  const owner = await sessionFor(ownerUser.id)
  const operator = await sessionFor(operatorUser.id)
  const cashier = await sessionFor(cashierUser.id)
  const domain = 'openfront-recycling.local'

  const [copperPhoto, steelPhoto, nonferrousPhoto] = await Promise.all([photo('copper.jpg'), photo('steel.jpg'), photo('nonferrous.jpg')])

  // --- Sellers, IDs, vehicles (the counter's add-seller flow) ---
  const sellers: Array<{ id: string; vehicleId: string; spec: SellerSpec }> = []
  for (const s of SELLERS) {
    let seller = await prisma.seller.findFirst({ where: { firstName: s.first, lastName: s.last, dateOfBirth: new Date(`${s.dob}T00:00:00.000Z`) } })
    if (!seller) {
      seller = await owner.db.Seller.createOne({ data: { firstName: s.first, lastName: s.last, dateOfBirth: `${s.dob}T00:00:00.000Z`, phone: s.phone, addressLine1: s.address, city: s.city, region: 'OH', postalCode: s.zip, preferredPayout: s.payout } })
      log('seller', s.first, s.last)
    }
    if (!(await prisma.identityDocument.findFirst({ where: { sellerId: seller.id, isCurrent: true } }))) {
      const doc = await owner.db.IdentityDocument.createOne({ data: { seller: { connect: { id: seller.id } }, kind: 'drivers_license', number: s.idNumber, issuer: 'OH', expiresOn: `${s.idExpires}T00:00:00.000Z`, frontImage: upload(await licenceCard(s), `${s.idNumber}.png`, 'image/png') } as any })
      if (s.verify) await gql(owner, `mutation($d: ID!) { verifySellerIdentity(identityDocumentId: $d) { id } }`, { d: doc.id })
    }
    let vehicle = await prisma.vehicle.findFirst({ where: { sellerId: seller.id, plate: s.plate } })
    if (!vehicle) vehicle = await owner.db.Vehicle.createOne({ data: { seller: { connect: { id: seller.id } }, plate: s.plate, plateRegion: 'OH', make: s.make, model: s.model, color: s.color, kind: s.kind } })
    sellers.push({ id: seller.id, vehicleId: vehicle.id, spec: s })
  }

  // --- Accounts: applications from their own people, approved by the owner ---
  async function account(o: { kind: 'supplier' | 'buyer' | 'nonprofit'; name: string; legal: string; taxId?: string; contact: string; email: string; address: string; city: string; zip: string; phone: string; decide: Record<string, unknown>; message: string }) {
    const userId = await customer(o.contact, o.email, `${o.kind} contact (${o.name})`)
    const me = await sessionFor(userId)
    const existing = await prisma.accountContact.findFirst({ where: { userId, status: 'active', account: { name: o.name } }, include: { account: true } })
    if (existing) return { id: existing.account.id, ctx: me, userId }
    let app = await prisma.accountApplication.findFirst({ where: { applicantId: userId, businessName: o.name, status: 'submitted' } })
    if (!app) {
      const r = await gql(me, `mutation($k: String!, $b: String!, $l: String, $t: String, $a: String, $c: String, $z: String, $p: String, $e: String, $m: String) { submitAccountApplication(kind: $k, businessName: $b, legalName: $l, taxId: $t, addressLine1: $a, city: $c, region: "OH", postalCode: $z, phone: $p, email: $e, message: $m) { id } }`,
        { k: o.kind, b: o.name, l: o.legal, t: o.taxId || null, a: o.address, c: o.city, z: o.zip, p: o.phone, e: o.email, m: o.message })
      app = { id: r.submitAccountApplication.id }
    }
    const d = o.decide as any
    const r = await gql(owner, `mutation($a: ID!, $pt: String, $nd: Int, $wb: String, $hc: Boolean) { decideAccountApplication(applicationId: $a, decision: "approve", paymentTerms: $pt, netDays: $nd, weightBasis: $wb, hasCredit: $hc) { account { id } } }`,
      { a: app.id, pt: d.paymentTerms ?? null, nd: d.netDays ?? null, wb: d.weightBasis ?? null, hc: d.hasCredit ?? null })
    log('account', o.name)
    return { id: r.decideAccountApplication.account.id, ctx: me, userId }
  }
  async function site(acc: { id: string; ctx: any }, name: string, a1: string, city: string, zip: string, contactName: string, contactPhone: string, accessNotes: string) {
    const found = await prisma.serviceSite.findFirst({ where: { accountId: acc.id, name } })
    if (found) return found.id
    const r = await gql(acc.ctx, `mutation($a: ID!, $n: String!, $s: String!, $c: String!, $z: String, $cn: String, $cp: String, $an: String) { upsertAccountSite(accountId: $a, name: $n, addressLine1: $s, city: $c, region: "OH", postalCode: $z, contactName: $cn, contactPhone: $cp, accessNotes: $an) { id } }`,
      { a: acc.id, n: name, s: a1, c: city, z: zip, cn: contactName, cp: contactPhone, an: accessNotes })
    return r.upsertAccountSite.id
  }

  const kessler = await account({ kind: 'supplier', name: 'Kessler Tool & Die', legal: 'Kessler Tool & Die Inc.', contact: 'Frank Kessler', email: `frank@kessler-tool.${domain}`, address: '2200 Alum Creek Dr', city: 'Columbus', zip: '43207', phone: '614-555-0211', decide: { paymentTerms: 'on_account', netDays: 30, hasCredit: true }, message: 'Two to three loads of plate and turnings a month, plus a roll-off at the plant.' })
  const kesslerPlant = await site(kessler, 'Main plant', '2200 Alum Creek Dr', 'Columbus', '43207', 'Frank Kessler', '614-555-0211', 'Dock 3 at the back; call 20 minutes before arrival.')
  await site(kessler, 'Press shop', '2236 Alum Creek Dr', 'Columbus', '43207', 'Ana Ruiz', '614-555-0214', 'Gate code at the guard shack.')
  const buckeye = await account({ kind: 'supplier', name: 'Buckeye HVAC Services', legal: 'Buckeye HVAC Services LLC', contact: 'Sharon Pike', email: `sharon@buckeye-hvac.${domain}`, address: '845 Parsons Ave', city: 'Columbus', zip: '43206', phone: '614-555-0236', decide: { paymentTerms: 'pay_at_scale' }, message: 'Copper line sets, radiators and condensers from change-outs.' })
  await site(buckeye, 'Service shop', '845 Parsons Ave', 'Columbus', '43206', 'Sharon Pike', '614-555-0236', 'Alley entrance off Kossuth St.')
  const mill = await account({ kind: 'buyer', name: 'Mahoning Valley Steel', legal: 'Mahoning Valley Steel Corp.', contact: 'Gary Novak', email: `gary.novak@mahoning-steel.${domain}`, address: '1 Furnace Rd', city: 'Youngstown', zip: '44502', phone: '330-555-0170', decide: { paymentTerms: 'prepay', weightBasis: 'received' }, message: 'Buying HMS 1&2 and shredded by the truckload.' })
  const np = await account({ kind: 'nonprofit', name: 'Hilltop Youth Robotics', legal: 'Hilltop Youth Robotics Inc.', taxId: '31-1849276', contact: 'Denise Carter', email: `denise@hilltop-robotics.${domain}`, address: '2800 W Broad St', city: 'Columbus', zip: '43204', phone: '614-555-0258', decide: {}, message: 'Students collect cans to pay for competition kits and travel.' })
  await gql(np.ctx, `mutation($a: ID!) { updateNonprofitProfile(accountId: $a, nonprofitSummary: "High school robotics teams on the Hilltop. Every can you donate goes to parts, kits and travel to the state finals.", nonprofitWebsite: "https://hilltoprobotics.org", isPublicNonprofit: true) { id } }`, { a: np.id })
  let campaign = await prisma.donationCampaign.findFirst({ where: { accountId: np.id, name: 'Cans for the state finals' } })
  if (!campaign) {
    const r = await gql(np.ctx, `mutation($a: ID!, $s: String) { upsertCampaign(accountId: $a, name: "Cans for the state finals", description: "Drop your aluminum cans at Riverside Metals East and choose Hilltop Youth Robotics. Goal: 5,000 lb by March.", goalWeight: "5000", startsOn: $s, isPublic: true, status: "active") { id } }`, { a: np.id, s: at(20, 0).toISOString() })
    campaign = { id: r.upsertCampaign.id }
  }

  // --- Tickets ---
  const scales = await prisma.scale.findMany()
  const truckScale = (yardId: string) => scales.find((s: any) => s.yardId === yardId && s.kind === 'truck')?.id || null
  const floorScale = (yardId: string) => scales.find((s: any) => s.yardId === yardId && s.kind === 'floor')?.id || null
  const accounts = { kessler, buckeye }
  let checkNo = 4100
  let drawerSessionId: string | null = null

  async function backdate(ticketId: string, when: Date) {
    const ticket = await prisma.scaleTicket.findUnique({ where: { id: ticketId } })
    const done = new Date(when.getTime() + 18 * 60_000)
    await prisma.scaleTicket.update({ where: { id: ticketId }, data: { createdAt: when, ...(ticket.completedAt ? { completedAt: done } : {}), ...(ticket.voidedAt ? { voidedAt: done } : {}) } })
    await prisma.ticketLine.updateMany({ where: { ticketId }, data: { createdAt: new Date(when.getTime() + 4 * 60_000) } })
    await prisma.ticketAttachment.updateMany({ where: { ticketId }, data: { createdAt: new Date(when.getTime() + 8 * 60_000), capturedAt: new Date(when.getTime() + 8 * 60_000) } })
    await prisma.donation.updateMany({ where: { ticketId }, data: { createdAt: done, receiptIssuedAt: done } })
    await prisma.invoice.updateMany({ where: { ticketId, kind: 'fee_ticket' }, data: { createdAt: done, dueOn: done } })
    await prisma.holdTag.updateMany({ where: { ticketId, kind: 'material' }, data: { createdAt: done } })
    for (const p of await prisma.payout.findMany({ where: { ticketId } })) {
      const shift = p.releaseAt && p.createdAt ? new Date(p.releaseAt).getTime() - new Date(p.createdAt).getTime() : 0
      await prisma.payout.update({ where: { id: p.id }, data: { createdAt: done, ...(p.releaseAt ? { releaseAt: new Date(done.getTime() + shift) } : {}), ...(p.paidAt ? { paidAt: new Date(done.getTime() + 12 * 60_000) } : {}) } })
    }
    const after = await prisma.scaleTicket.findUnique({ where: { id: ticketId } })
    if (after.settledAt) await prisma.scaleTicket.update({ where: { id: ticketId }, data: { settledAt: new Date(done.getTime() + 12 * 60_000) } })
  }

  async function cashDrawer() {
    if (drawerSessionId) return drawerSessionId
    const open = await prisma.cashDrawerSession.findFirst({ where: { cashierId: cashierUser.id, status: 'open' } })
    if (open) return (drawerSessionId = open.id)
    const drawer = await prisma.cashDrawer.findFirst({ where: { yardId: yards.EAST.id, isActive: true } })
    const r = await gql(cashier, `mutation($d: ID!) { openDrawerSession(drawerId: $d, openingFloatCents: 150000) { id } }`, { d: drawer.id })
    return (drawerSessionId = r.openDrawerSession.id)
  }

  for (const t of T) {
    const yard = yards[t.yard]
    const staff = t.yard === 'EAST' ? operator : owner
    const seller = t.seller !== undefined ? sellers[t.seller] : null
    const acc = t.account ? accounts[t.account] : null
    const data: Record<string, unknown> = { yardId: yard.id }
    if (seller) Object.assign(data, { sellerId: seller.id, vehicleId: seller.vehicleId })
    if (acc) Object.assign(data, { accountId: acc.id, vehiclePlate: t.account === 'kessler' ? 'PKD3318' : 'HVC7702', vehiclePlateRegion: 'OH', ...(t.account === 'kessler' ? { siteId: kesslerPlant } : {}) })
    if (t.outcome === 'donate') Object.assign(data, { campaignId: campaign.id, donatePercent: 100 })
    const opened = await gql(staff, `mutation($d: OpenTicketInput!, $k: String) { openTicket(data: $d, idempotencyKey: $k) { id } }`, { d: data, k: `${KEY}:ticket:${t.n}` })
    const id = opened.openTicket.id
    let row = await prisma.scaleTicket.findUnique({ where: { id }, include: { lines: true, attachments: true } })

    if (row.status === 'open' && !row.lines.length) {
      if (t.truck) {
        for (const [weight, m] of t.truck) {
          await gql(staff, `mutation($d: TruckWeightInput!) { recordTruckWeight(data: $d) { weighEventId } }`, { d: { ticketId: id, weight, scaleId: truckScale(yard.id), ...(m ? { materialId: materials[m].id } : {}) } })
        }
      } else {
        for (const l of t.lines || []) {
          await gql(staff, `mutation($d: TicketLineInput!) { addTicketLine(data: $d) { id } }`, { d: { ticketId: id, materialId: materials[l.m].id, scaleId: floorScale(yard.id), ...(l.qty ? { quantity: l.qty } : { grossWeight: l.gross, tareWeight: l.tare }), ...(l.docs ? { documents: l.docs } : {}) } })
        }
      }
    }
    if (row.status === 'open' && seller && t.outcome !== 'void') {
      const kinds = new Set(row.attachments.map((a: any) => a.kind))
      const add = async (kind: string, image: any, signedName?: string) => staff.db.TicketAttachment.createOne({ data: { ticket: { connect: { id } }, kind, image, ...(signedName ? { signedName } : {}) } as any })
      if (!kinds.has('seller_photo')) await add('seller_photo', upload(await portrait(seller.spec), 'seller.png', 'image/png'))
      const mat = (t.lines || [])[0]?.m || ''
      const pic = mat.startsWith('CU') || mat.startsWith('BR') || mat === 'EL-WIRE' ? copperPhoto : mat.startsWith('FE') || mat === 'CAT' ? steelPhoto : nonferrousPhoto
      if (!kinds.has('material_photo')) await add('material_photo', upload(pic, 'material.jpg', 'image/jpeg'))
      if (t.outcome !== 'open' && !kinds.has('signature')) await add('signature', upload(await signature(`${seller.spec.first} ${seller.spec.last}`), 'signature.png', 'image/png'), `${seller.spec.first} ${seller.spec.last}`)
    }
    if (acc && row.status === 'open' && !row.attachments.some((a: any) => a.kind === 'material_photo')) {
      await staff.db.TicketAttachment.createOne({ data: { ticket: { connect: { id } }, kind: 'material_photo', image: upload(t.account === 'kessler' ? steelPhoto : copperPhoto, 'load.jpg', 'image/jpeg') } as any })
    }

    if (row.status === 'open' && t.outcome === 'void') {
      await gql(staff, `mutation($t: ID!) { voidTicket(ticketId: $t, reason: "Seller left before the load was graded.") { id } }`, { t: id })
    } else if (row.status === 'open' && t.outcome !== 'open') {
      await gql(staff, `mutation($t: ID!) { completeTicket(ticketId: $t) { id } }`, { t: id })
    }
    if (t.outcome !== 'open') await backdate(id, at(t.days, t.hour, (t.n * 7) % 50))
    row = await prisma.scaleTicket.findUnique({ where: { id }, include: { payouts: true } })

    if (t.outcome === 'police' && !(await prisma.holdTag.findFirst({ where: { ticketId: id, status: 'police_hold' } }))) {
      await gql(owner, `mutation($t: ID!) { placePoliceHold(ticketId: $t, agency: "Columbus Division of Police", caseNumber: "CPD-26-118734", reason: "Detective asked to hold copper and brass matching a reported job-site theft.") { id } }`, { t: id })
    }
    const payer = t.yard === 'EAST' ? cashier : owner
    for (const p of row.payouts) {
      if (p.status === 'paid' || !['check', 'cash', 'transfer'].includes(t.outcome)) continue
      if (p.status === 'held' && p.releaseAt && new Date(p.releaseAt).getTime() > NOW) continue
      const method = t.outcome === 'cash' ? 'cash' : t.outcome === 'transfer' ? 'transfer' : 'check'
      const vars: Record<string, unknown> = { p: p.id, m: method, k: `${KEY}:payout:${t.n}:${p.id}` }
      if (method === 'cash') vars.s = await cashDrawer()
      if (method === 'check') { checkNo += 1; vars.c = String(10000 + t.n * 10 + checkNo % 10) }
      if (method === 'transfer') vars.r = `ACH-${String(t.n).padStart(4, '0')}-BUCKEYE`
      await gql(payer, `mutation($p: ID!, $m: String!, $s: ID, $c: String, $r: String, $k: String) { payPayout(payoutId: $p, method: $m, drawerSessionId: $s, checkNumber: $c, bankAccountLabel: "Operating", transferReference: $r, idempotencyKey: $k) { id } }`, vars)
    }
    if (['check', 'cash', 'transfer'].includes(t.outcome)) await backdate(id, at(t.days, t.hour, (t.n * 7) % 50))
    log(`ticket ${t.n} ${t.outcome}`)
  }

  // Close the cashier's drawer if this run opened one: counted equals expected, so it closes clean.
  if (drawerSessionId) {
    const s = await prisma.cashDrawerSession.findUnique({ where: { id: drawerSessionId } })
    if (s.status === 'open') {
      const events = await prisma.cashDrawerEvent.findMany({ where: { sessionId: s.id } })
      const expected = events.reduce((sum: number, e: any) => sum + (e.kind === 'payout' || e.kind === 'drop' ? -e.amountCents : e.amountCents), 0)
      await gql(cashier, `mutation($s: ID!, $c: Int!) { countDrawer(sessionId: $s, countedCents: $c) { status } }`, { s: s.id, c: expected })
    }
  }

  // --- Kessler's first-week settlement: on-account tickets from 14 to 7 days ago, paid by check ---
  if (!(await prisma.settlement.findFirst({ where: { accountId: kessler.id, status: { not: 'void' } } }))) {
    const r = await gql(owner, `mutation($a: ID!, $s: String!, $e: String!) { buildSettlement(accountId: $a, periodStart: $s, periodEnd: $e) { id } }`, { a: kessler.id, s: at(14, 0).toISOString(), e: at(7, 0).toISOString() })
    await gql(owner, `mutation($s: ID!) { approveSettlement(settlementId: $s) { id } }`, { s: r.buildSettlement.id })
    const s = await prisma.settlement.findUnique({ where: { id: r.buildSettlement.id } })
    if (s.payoutId) await gql(owner, `mutation($p: ID!) { payPayout(payoutId: $p, method: "check", checkNumber: "4090", bankAccountLabel: "Operating") { id } }`, { p: s.payoutId })
    log('settlement for Kessler Tool & Die')
  }

  // --- Market: a copper listing with an open offer, and an HMS load bought outright that ships today ---
  async function listing(title: string, vars: Record<string, unknown>) {
    let l = await prisma.listing.findFirst({ where: { title } })
    if (!l) {
      const r = await gql(owner, `mutation($y: ID!, $m: ID!, $t: String!, $d: String, $f: String, $w: String!, $p: String, $u: String, $o: Boolean, $b: Boolean, $min: String, $c: String) { draftListing(yardId: $y, materialId: $m, title: $t, description: $d, form: $f, estimatedWeight: $w, askUnitPrice: $p, unit: $u, allowOffers: $o, buyNow: $b, minimumWeight: $min, closesAt: $c) { id } }`, { t: title, ...vars })
      l = await prisma.listing.findUnique({ where: { id: r.draftListing.id } })
    }
    if (l.status === 'draft') await gql(owner, `mutation($l: ID!) { setListingStatus(listingId: $l, status: "open") { id } }`, { l: l.id })
    return l.id
  }
  const copperListing = await listing('#2 copper, loose, about 4,000 lb', { y: yards.EAST.id, m: materials['CU-2'].id, d: 'Clean #2 copper from the counter, sorted and loose in gaylords. FOB Riverside Metals East.', f: 'gaylord', w: '4000', p: '3.98', u: 'lb', o: true, b: false, min: '1000', c: at(-10, 17).toISOString() })
  if (!(await prisma.offer.findFirst({ where: { listingId: copperListing, accountId: mill.id } }))) {
    await gql(mill.ctx, `mutation($l: ID!, $a: ID!) { submitOffer(listingId: $l, accountId: $a, weight: "2500", unitPrice: "3.91", message: "We can pick up next Tuesday or Wednesday.") { id } }`, { l: copperListing, a: mill.id })
  }
  const hmsListing = await listing('HMS 1 heavy melt, 20 net tons', { y: yards.EAST.id, m: materials['FE-HMS1'].id, d: 'Prepared HMS 1 from plant scrap and counter loads. One truckload, FOB yard.', f: 'loose', w: '40000', p: '285', u: 'net_ton', o: false, b: true, min: '20000', c: at(-14, 17).toISOString() })
  let buy = await prisma.offer.findFirst({ where: { listingId: hmsListing, accountId: mill.id } })
  if (!buy) {
    const r = await gql(mill.ctx, `mutation($l: ID!, $a: ID!) { submitOffer(listingId: $l, accountId: $a, weight: "20000", buyNow: true) { id } }`, { l: hmsListing, a: mill.id })
    buy = await prisma.offer.findUnique({ where: { id: r.submitOffer.id } })
  }
  let shipment = await prisma.shipment.findFirst({ where: { orderId: buy.salesOrderId } })
  if (!shipment) {
    const r = await gql(owner, `mutation($o: ID!, $s: String) { scheduleShipment(orderId: $o, carrier: "Valley Freight Lines", driverName: "Tony Russo", truckPlate: "PNV4410", trailerNumber: "VF-218", sealNumber: "S-551902", scheduledFor: $s) { id } }`, { o: buy.salesOrderId, s: new Date(NOW).toISOString() })
    shipment = await prisma.shipment.findUnique({ where: { id: r.scheduleShipment.id } })
  }
  const out = await gql(owner, `mutation($d: OpenTicketInput!, $k: String) { openTicket(data: $d, idempotencyKey: $k) { id status } }`, { d: { yardId: yards.EAST.id, direction: 'outbound', shipmentId: shipment.id, vehiclePlate: 'PNV4410' }, k: `${KEY}:outbound:hms` })
  const outRow = await prisma.scaleTicket.findUnique({ where: { id: out.openTicket.id }, include: { lines: true } })
  if (outRow.status === 'open') {
    if (!outRow.lines.length) await gql(owner, `mutation($d: TicketLineInput!) { addTicketLine(data: $d) { id } }`, { d: { ticketId: outRow.id, materialId: materials['FE-HMS1'].id, grossWeight: '46200', tareWeight: '26100', scaleId: truckScale(yards.EAST.id) } })
    await owner.db.TicketAttachment.createOne({ data: { ticket: { connect: { id: outRow.id } }, kind: 'material_photo', image: upload(steelPhoto, 'load.jpg', 'image/jpeg') } as any })
    await gql(owner, `mutation($t: ID!) { completeTicket(ticketId: $t) { id } }`, { t: outRow.id })
  }
  log('market: listings, offer, order, shipment and invoice')

  // --- Container service: a delivery done, a pickup waiting for dispatch, a lugger box waiting on payment ---
  const driverEmail = `ray.dominguez@${domain}`
  let driver = await prisma.user.findFirst({ where: { email: driverEmail } })
  if (!driver) {
    const password = randomBytes(12).toString('base64url')
    const role = await prisma.role.findFirst({ where: { name: 'Driver' } })
    driver = await owner.db.User.createOne({ data: { name: 'Ray Dominguez', email: driverEmail, password, role: { connect: { id: role.id } }, yards: { connect: [{ id: yards.EAST.id }] } } })
    remember(`driver (East yard only): ${driverEmail} / ${password}  (user ${driver.id})`)
  }
  const driverCtx = await sessionFor(driver.id)
  const types: Record<string, any> = Object.fromEntries((await prisma.containerType.findMany()).map((c: any) => [c.slug, c]))
  let delivery = await prisma.serviceRequest.findFirst({ where: { accountId: kessler.id, kind: 'deliver' } })
  if (!delivery) {
    const r = await gql(kessler.ctx, `mutation($y: ID!, $a: ID!, $s: ID!, $t: ID!) { createServiceRequest(yardId: $y, kind: "deliver", accountId: $a, siteId: $s, containerTypeId: $t, preferredWindow: "morning", accessNotes: "Set it by dock 3.") { id } }`, { y: yards.EAST.id, a: kessler.id, s: kesslerPlant, t: types['roll-off-30'].id })
    delivery = await prisma.serviceRequest.findUnique({ where: { id: r.createServiceRequest.id } })
  }
  if (delivery.status === 'requested') await gql(owner, `mutation($r: ID!) { approveServiceRequest(requestId: $r) { id } }`, { r: delivery.id })
  let job = await prisma.dispatchJob.findFirst({ where: { requestId: delivery.id, status: { notIn: ['cancelled', 'failed'] } } })
  if (!job) {
    const box = await prisma.container.findFirst({ where: { typeId: types['roll-off-30'].id, homeYardId: yards.EAST.id, status: 'in_yard' }, orderBy: { number: 'asc' } })
    const truck = await prisma.truck.findFirst({ where: { yardId: yards.EAST.id, kind: 'roll_off', isActive: true } })
    const r = await gql(owner, `mutation($r: ID!, $d: ID!, $t: ID!, $c: ID!, $at: String!) { scheduleDispatchJob(requestId: $r, scheduledDate: $at, driverId: $d, truckId: $t, dropContainerId: $c) { id } }`, { r: delivery.id, d: driver.id, t: truck.id, c: box.id, at: at(9, 8).toISOString() })
    job = await prisma.dispatchJob.findUnique({ where: { id: r.scheduleDispatchJob.id } })
  }
  if (job.status === 'assigned') { await gql(driverCtx, `mutation($j: ID!) { startDispatchJob(jobId: $j) { id } }`, { j: job.id }); job.status = 'en_route' }
  if (job.status === 'en_route') { await gql(driverCtx, `mutation($j: ID!) { arriveDispatchJob(jobId: $j) { id } }`, { j: job.id }); job.status = 'on_site' }
  if (job.status === 'on_site') await gql(driverCtx, `mutation($j: ID!) { completeDispatchJob(jobId: $j, signedName: "Frank Kessler", driverNotes: "Set at dock 3.") { id } }`, { j: job.id })
  const placed = await prisma.container.findFirst({ where: { siteId: kesslerPlant, status: 'at_customer' } })
  if (placed && !(await prisma.serviceRequest.findFirst({ where: { accountId: kessler.id, kind: 'pickup' } }))) {
    await gql(kessler.ctx, `mutation($y: ID!, $a: ID!, $s: ID!, $c: ID!) { createServiceRequest(yardId: $y, kind: "pickup", accountId: $a, siteId: $s, containerId: $c, preferredWindow: "afternoon", accessNotes: "Box is full of turnings; tarp it.") { id } }`, { y: yards.EAST.id, a: kessler.id, s: kesslerPlant, c: placed.id })
  }
  const buckeyeSite = await prisma.serviceSite.findFirst({ where: { accountId: buckeye.id } })
  if (!(await prisma.serviceRequest.findFirst({ where: { accountId: buckeye.id } }))) {
    await gql(buckeye.ctx, `mutation($y: ID!, $a: ID!, $s: ID!, $t: ID!) { createServiceRequest(yardId: $y, kind: "deliver", accountId: $a, siteId: $s, containerTypeId: $t, preferredWindow: "morning") { id } }`, { y: yards.EAST.id, a: buckeye.id, s: buckeyeSite.id, t: types['lugger-box'].id })
  }
  log('container service requests and jobs')

  const counts = {
    sellers: await prisma.seller.count(), tickets: await prisma.scaleTicket.count(), payouts: await prisma.payout.groupBy({ by: ['status'], _count: true }),
    accounts: await prisma.account.count(), listings: await prisma.listing.count(), offers: await prisma.offer.count(), invoices: await prisma.invoice.count(), serviceRequests: await prisma.serviceRequest.count(),
  }
  console.log(JSON.stringify(counts))
  process.exit(0)
})().catch((e) => { console.error('[starter-book] failed:', e?.message || e); process.exit(1) })
