import { createHash, randomBytes } from 'node:crypto'
import { hasFlag } from '../access'
import { CommandError, cleanKey, compareAndSet, lockRow, refuse, runCommand, type CommandCtx, type Tx } from '../lib/command'

/**
 * Accounts, applications, contacts and the seller state machine (dissertation §4.3, §5.4, §5.5).
 */

const hash = (v: string) => createHash('sha256').update(v).digest('hex')

export function slugify(value: string) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'account'
}

async function uniqueSlug(tx: Tx, base: string) {
  const root = slugify(base)
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`
    if (!(await tx.account.findFirst({ where: { slug } }))) return slug
  }
  return `${root}-${randomBytes(3).toString('hex')}`
}

/** A contact of the account with one of the given roles. Staff with the flag pass. */
export async function requireAccountRole(tx: Tx, session: any, accountId: string, roles: string[] = ['admin', 'member', 'billing', 'driver'], staffFlag: any = 'canManageAccounts') {
  if (staffFlag && hasFlag(session, staffFlag)) return { staff: true, contact: null }
  if (!session?.itemId) throw new CommandError('Sign in first.', 'UNAUTHENTICATED')
  const contact = await tx.accountContact.findFirst({ where: { accountId, userId: session.itemId, status: 'active', role: { in: roles } } })
  if (!contact) throw new CommandError('Account not found.', 'NOT_FOUND')
  return { staff: false, contact }
}

// --- Applications (§5.5) ---
type ApplicationInput = {
  kind: 'supplier' | 'buyer' | 'nonprofit'; businessName: string; legalName?: string | null; taxId?: string | null; addressLine1?: string | null; addressLine2?: string | null;
  city?: string | null; region?: string | null; postalCode?: string | null; country?: string | null; phone?: string | null; email?: string | null; materials?: unknown;
  monthlyVolume?: string | null; containerNeeds?: string | null; message?: string | null
}
export async function submitApplicationTx(ctx: CommandCtx, input: ApplicationInput) {
  if (!['supplier', 'buyer', 'nonprofit'].includes(input.kind)) refuse('Choose supplier, buyer or nonprofit.')
  const name = String(input.businessName || '').trim()
  if (name.length < 2) refuse('Enter the business name.')
  if (input.kind === 'nonprofit' && !String(input.taxId || '').trim()) refuse('Enter the EIN of the nonprofit.')
  const open = await ctx.tx.accountApplication.findFirst({ where: { applicantId: ctx.actorId, kind: input.kind, status: 'submitted', businessName: name } })
  if (open) refuse('You already have an application waiting for this business.')
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const app = await ctx.tx.accountApplication.create({
    data: {
      applicantId: ctx.actorId, kind: input.kind, businessName: name, legalName: s(input.legalName), taxId: s(input.taxId), addressLine1: s(input.addressLine1), addressLine2: s(input.addressLine2),
      city: s(input.city), region: s(input.region), postalCode: s(input.postalCode), country: s(input.country) || 'US', phone: s(input.phone), email: s(input.email),
      materials: (input.materials as any) ?? null, monthlyVolume: s(input.monthlyVolume), containerNeeds: s(input.containerNeeds), message: s(input.message), status: 'submitted',
    },
  })
  await ctx.audit({ eventType: 'application.submitted', aggregateType: 'AccountApplication', aggregateId: app.id, after: { kind: input.kind, businessName: name } })
  return app
}

export async function decideApplicationTx(ctx: CommandCtx, input: { applicationId: string; decision: 'approve' | 'decline'; reason?: string | null; accountId?: string | null; paymentTerms?: string | null; netDays?: number | null; weightBasis?: string | null; hasCredit?: boolean | null; priceListId?: string | null }) {
  const { tx } = ctx
  const app = await lockRow(tx, 'AccountApplication', input.applicationId)
  if (!app) refuse('Application not found.')
  if (app.status !== 'submitted') refuse(`This application is ${app.status}.`)
  if (input.decision === 'decline') {
    const reason = String(input.reason || '').trim()
    if (reason.length < 3) refuse('Give the applicant a reason.')
    await compareAndSet(tx, 'accountApplication', app.id, 'submitted', { status: 'declined', decisionReason: reason, decidedById: ctx.actorId, decidedAt: ctx.now })
    await ctx.audit({ eventType: 'application.declined', aggregateType: 'AccountApplication', aggregateId: app.id, reason })
    return tx.accountApplication.findUnique({ where: { id: app.id } })
  }
  if (input.decision !== 'approve') refuse('Choose approve or decline.')
  const kindFlag = app.kind === 'buyer' ? { isBuyer: true } : app.kind === 'nonprofit' ? { isNonprofit: true } : { isSupplier: true }
  let account
  if (input.accountId) {
    account = await tx.account.update({ where: { id: input.accountId }, data: { ...kindFlag, status: 'active' } })
  } else {
    const terms = input.paymentTerms || (app.kind === 'buyer' ? 'prepay' : 'on_account')
    if (!['pay_at_scale', 'on_account', 'prepay', 'net'].includes(terms)) refuse('Choose valid payment terms.')
    const number = await ctx.sequence('business', 'account')
    account = await tx.account.create({
      data: {
        name: app.businessName, legalName: app.legalName || app.businessName, slug: await uniqueSlug(tx, app.businessName), accountNumber: `A${String(number).padStart(5, '0')}`, status: 'active',
        ...kindFlag, taxId: app.kind === 'nonprofit' ? '' : app.taxId, ein: app.kind === 'nonprofit' ? app.taxId : '',
        billingAddressLine1: app.addressLine1, billingAddressLine2: app.addressLine2, billingCity: app.city, billingRegion: app.region, billingPostalCode: app.postalCode, billingCountry: app.country,
        billingEmail: app.email, phone: app.phone, paymentTerms: terms, netDays: Math.max(0, Math.trunc(Number(input.netDays ?? (terms === 'net' ? 30 : 0)))),
        weightBasis: input.weightBasis === 'received' ? 'received' : 'shipped', hasCredit: Boolean(input.hasCredit), priceListId: input.priceListId || null,
      },
    })
  }
  if (app.applicant) {
    await tx.$executeRawUnsafe(
      `INSERT INTO "AccountContact" ("id", "account", "user", "role", "status", "inviteEmail", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, 'admin', 'active', '', NOW(), NOW())
       ON CONFLICT ("account", "user") DO UPDATE SET "status" = 'active', "role" = 'admin', "updatedAt" = NOW()`,
      account.id, app.applicant,
    )
  }
  await compareAndSet(tx, 'accountApplication', app.id, 'submitted', { status: 'approved', accountId: account.id, decidedById: ctx.actorId, decidedAt: ctx.now, decisionReason: input.reason || '' })
  await ctx.audit({ eventType: 'application.approved', aggregateType: 'AccountApplication', aggregateId: app.id, after: { accountId: account.id, kind: app.kind } })
  return tx.accountApplication.findUnique({ where: { id: app.id } })
}

export async function withdrawApplicationTx(ctx: CommandCtx, input: { applicationId: string }) {
  const app = await ctx.tx.accountApplication.findUnique({ where: { id: input.applicationId } })
  if (!app || app.applicantId !== ctx.actorId) throw new CommandError('Application not found.', 'NOT_FOUND')
  await compareAndSet(ctx.tx, 'accountApplication', app.id, 'submitted', { status: 'withdrawn' }, 'Only a waiting application can be withdrawn.')
  await ctx.audit({ eventType: 'application.withdrawn', aggregateType: 'AccountApplication', aggregateId: app.id })
  return ctx.tx.accountApplication.findUnique({ where: { id: app.id } })
}

// --- Account status (§5.5) ---
export async function setAccountStatusTx(ctx: CommandCtx, input: { accountId: string; status: 'active' | 'suspended'; reason: string }) {
  const reason = String(input.reason || '').trim()
  if (reason.length < 3) refuse('Give a reason.')
  const from = input.status === 'active' ? 'suspended' : input.status === 'suspended' ? 'active' : null
  if (!from) refuse('Choose active or suspended.')
  await compareAndSet(ctx.tx, 'account', input.accountId, from, { status: input.status, statusReason: reason }, `The account is not ${from}.`)
  await ctx.audit({ eventType: `account.${input.status}`, aggregateType: 'Account', aggregateId: input.accountId, before: { status: from }, reason })
  return ctx.tx.account.findUnique({ where: { id: input.accountId } })
}

// --- Contacts (C13) ---
export async function inviteContactTx(ctx: CommandCtx, input: { accountId: string; email: string; role: string }) {
  await requireAccountRole(ctx.tx, ctx.session, input.accountId, ['admin'])
  const email = String(input.email || '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) refuse('Enter an email address.')
  if (!['admin', 'member', 'billing', 'driver'].includes(input.role)) refuse('Choose a role.')
  const token = randomBytes(24).toString('base64url')
  const user = await ctx.tx.user.findFirst({ where: { email } })
  if (user) {
    const existing = await ctx.tx.accountContact.findFirst({ where: { accountId: input.accountId, userId: user.id } })
    if (existing?.status === 'active') refuse('This person is already on the team.')
    if (existing) {
      await ctx.tx.accountContact.update({ where: { id: existing.id }, data: { status: 'invited', role: input.role, inviteEmail: email, inviteTokenHash: hash(token) } })
      return { contactId: existing.id, token }
    }
  }
  const pending = await ctx.tx.accountContact.findFirst({ where: { accountId: input.accountId, inviteEmail: email, status: 'invited' } })
  if (pending) {
    await ctx.tx.accountContact.update({ where: { id: pending.id }, data: { role: input.role, inviteTokenHash: hash(token) } })
    return { contactId: pending.id, token }
  }
  const contact = await ctx.tx.accountContact.create({ data: { accountId: input.accountId, userId: null, role: input.role, status: 'invited', inviteEmail: email, inviteTokenHash: hash(token) } })
  await ctx.audit({ eventType: 'contact.invited', aggregateType: 'AccountContact', aggregateId: contact.id, after: { email, role: input.role } })
  return { contactId: contact.id, token }
}

export async function acceptInviteTx(ctx: CommandCtx, input: { token: string }) {
  const contact = await ctx.tx.accountContact.findFirst({ where: { inviteTokenHash: hash(String(input.token || '')), status: 'invited' } })
  if (!contact) refuse('This invitation is not valid any more.')
  const user = await ctx.tx.user.findUnique({ where: { id: ctx.actorId } })
  if (contact.inviteEmail && user.email.toLowerCase() !== contact.inviteEmail.toLowerCase()) refuse('Sign in with the email address the invitation was sent to.')
  const dup = await ctx.tx.accountContact.findFirst({ where: { accountId: contact.accountId, userId: user.id, id: { not: contact.id } } })
  if (dup) {
    await ctx.tx.accountContact.update({ where: { id: dup.id }, data: { status: 'active', role: contact.role } })
    await ctx.tx.accountContact.update({ where: { id: contact.id }, data: { status: 'removed', inviteTokenHash: null } })
    return dup
  }
  const won = await ctx.tx.accountContact.updateMany({ where: { id: contact.id, status: 'invited' }, data: { status: 'active', userId: user.id, inviteTokenHash: null } })
  if (won.count !== 1) refuse('This invitation is not valid any more.')
  await ctx.audit({ eventType: 'contact.joined', aggregateType: 'AccountContact', aggregateId: contact.id })
  return ctx.tx.accountContact.findUnique({ where: { id: contact.id } })
}

export async function updateContactTx(ctx: CommandCtx, input: { contactId: string; role?: string | null; remove?: boolean | null }) {
  const contact = await ctx.tx.accountContact.findUnique({ where: { id: input.contactId } })
  if (!contact) refuse('Contact not found.')
  await requireAccountRole(ctx.tx, ctx.session, contact.accountId, ['admin'])
  if (input.remove || (input.role && input.role !== 'admin' && contact.role === 'admin')) {
    const admins = await ctx.tx.accountContact.count({ where: { accountId: contact.accountId, status: 'active', role: 'admin', id: { not: contact.id } } })
    if (admins === 0 && contact.status === 'active' && contact.role === 'admin') refuse('An account needs at least one admin.')
  }
  const data: Record<string, unknown> = {}
  if (input.remove) Object.assign(data, { status: 'removed', inviteTokenHash: null })
  else if (input.role) {
    if (!['admin', 'member', 'billing', 'driver'].includes(input.role)) refuse('Choose a role.')
    data.role = input.role
  }
  await ctx.tx.accountContact.update({ where: { id: contact.id }, data })
  await ctx.audit({ eventType: input.remove ? 'contact.removed' : 'contact.updated', aggregateType: 'AccountContact', aggregateId: contact.id, before: { role: contact.role, status: contact.status }, after: data })
  return ctx.tx.accountContact.findUnique({ where: { id: contact.id } })
}

// --- Sites (C4) ---
export async function upsertSiteTx(ctx: CommandCtx, input: { accountId: string; siteId?: string | null; name: string; addressLine1: string; addressLine2?: string | null; city: string; region?: string | null; postalCode?: string | null; country?: string | null; contactName?: string | null; contactPhone?: string | null; accessNotes?: string | null; isActive?: boolean | null }) {
  await requireAccountRole(ctx.tx, ctx.session, input.accountId, ['admin', 'member'], 'canManageAccounts')
  if (!String(input.name || '').trim() || !String(input.addressLine1 || '').trim() || !String(input.city || '').trim()) refuse('Enter the site name, street and city.')
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const data = { name: s(input.name), addressLine1: s(input.addressLine1), addressLine2: s(input.addressLine2), city: s(input.city), region: s(input.region), postalCode: s(input.postalCode), country: s(input.country) || 'US', contactName: s(input.contactName), contactPhone: s(input.contactPhone), accessNotes: s(input.accessNotes), isActive: input.isActive ?? true }
  if (input.siteId) {
    const site = await ctx.tx.serviceSite.findUnique({ where: { id: input.siteId } })
    if (!site || site.accountId !== input.accountId) throw new CommandError('Site not found.', 'NOT_FOUND')
    return ctx.tx.serviceSite.update({ where: { id: site.id }, data })
  }
  return ctx.tx.serviceSite.create({ data: { ...data, accountId: input.accountId } })
}

// --- Seller state (§5.4) ---
export async function setSellerStatusTx(ctx: CommandCtx, input: { sellerId: string; status: 'active' | 'flagged' | 'do_not_buy'; reason: string }) {
  const reason = String(input.reason || '').trim()
  if (reason.length < 3) refuse('Give a reason.')
  const seller = await lockRow(ctx.tx, 'Seller', input.sellerId)
  if (!seller) refuse('Seller not found.')
  const managers = hasFlag(ctx.session, 'canManageCompliance') || hasFlag(ctx.session, 'canApproveVariances') || hasFlag(ctx.session, 'canManageSellers')
  const allowed: Record<string, { from: string[]; who: boolean }> = {
    flagged: { from: ['active'], who: hasFlag(ctx.session, 'canManageTickets') || managers },
    do_not_buy: { from: ['active', 'flagged'], who: hasFlag(ctx.session, 'canManageCompliance') || hasFlag(ctx.session, 'canApproveVariances') },
    active: { from: seller.status === 'do_not_buy' ? ['do_not_buy'] : ['flagged'], who: seller.status === 'do_not_buy' ? hasFlag(ctx.session, 'canApproveVariances') || hasFlag(ctx.session, 'canManageCompliance') : managers },
  }
  const rule = allowed[input.status]
  if (!rule) refuse('Choose active, flagged or do-not-buy.')
  if (!rule.who) throw new CommandError('A manager must make this change.', 'FORBIDDEN')
  await compareAndSet(ctx.tx, 'seller', seller.id, rule.from, { status: input.status, statusReason: reason }, `A ${seller.status} seller cannot become ${input.status}.`)
  if (input.status === 'do_not_buy') {
    await ctx.tx.doNotBuyEntry.create({ data: { firstName: seller.firstName, lastName: seller.lastName, nameNormalized: `${seller.firstName} ${seller.lastName}`.toLowerCase().replace(/[^a-z]/g, ''), dateOfBirth: seller.dateOfBirth, source: 'yard', reason, isActive: true, sellerId: seller.id, addedById: ctx.actorId } })
  } else if (seller.status === 'do_not_buy') {
    await ctx.tx.doNotBuyEntry.updateMany({ where: { sellerId: seller.id, source: 'yard', isActive: true }, data: { isActive: false } })
  }
  await ctx.audit({ eventType: `seller.${input.status}`, aggregateType: 'Seller', aggregateId: seller.id, before: { status: seller.status }, reason })
  return ctx.tx.seller.findUnique({ where: { id: seller.id } })
}

export async function verifyIdentityTx(ctx: CommandCtx, input: { identityDocumentId: string }) {
  const doc = await ctx.tx.identityDocument.findUnique({ where: { id: input.identityDocumentId } })
  if (!doc) refuse('ID not found.')
  if (doc.expiresOn && new Date(doc.expiresOn) < ctx.now) refuse('This ID has expired.')
  await ctx.tx.identityDocument.update({ where: { id: doc.id }, data: { verifiedById: ctx.actorId, verifiedAt: ctx.now } })
  await ctx.tx.seller.update({ where: { id: doc.sellerId }, data: { idVerification: 'verified' } })
  await ctx.audit({ eventType: 'seller.id_verified', aggregateType: 'IdentityDocument', aggregateId: doc.id })
  return ctx.tx.seller.findUnique({ where: { id: doc.sellerId } })
}

// ---------------------------------------------------------------------------------------------

export const accountTypeDefs = `
  type AccountInvite { contactId: ID!, token: String! }
`
export const accountMutationDefs = `
  submitAccountApplication(kind: String!, businessName: String!, legalName: String, taxId: String, addressLine1: String, addressLine2: String, city: String, region: String, postalCode: String, country: String, phone: String, email: String, materials: JSON, monthlyVolume: String, containerNeeds: String, message: String, idempotencyKey: String): AccountApplication
  decideAccountApplication(applicationId: ID!, decision: String!, reason: String, accountId: ID, paymentTerms: String, netDays: Int, weightBasis: String, hasCredit: Boolean, priceListId: ID, idempotencyKey: String): AccountApplication
  withdrawApplication(applicationId: ID!): AccountApplication
  setAccountStatus(accountId: ID!, status: String!, reason: String!): Account
  inviteAccountContact(accountId: ID!, email: String!, role: String!): AccountInvite
  acceptAccountInvite(token: String!): AccountContact
  updateAccountContact(contactId: ID!, role: String, remove: Boolean): AccountContact
  upsertAccountSite(accountId: ID!, siteId: ID, name: String!, addressLine1: String!, addressLine2: String, city: String!, region: String, postalCode: String, country: String, contactName: String, contactPhone: String, accessNotes: String, isActive: Boolean): ServiceSite
  setSellerStatus(sellerId: ID!, status: String!, reason: String!): Seller
  verifySellerIdentity(identityDocumentId: ID!): Seller
`

const sudoOne = (c: any, list: string) => (r: any) => (r?.id ? c.sudo().db[list].findOne({ where: { id: r.id } }) : null)
const one = (c: any, list: string) => (r: any) => (r?.id ? c.db[list].findOne({ where: { id: r.id } }) : null)
export const accountResolvers = {
  Mutation: {
    submitAccountApplication: (_: unknown, a: any, c: any) => runCommand(c, { name: 'submitAccountApplication', input: a, idempotencyKey: cleanKey(a.idempotencyKey), requireSignIn: true }, (ctx) => submitApplicationTx(ctx, a)).then(sudoOne(c, 'AccountApplication')),
    decideAccountApplication: (_: unknown, a: any, c: any) => runCommand(c, { name: 'decideAccountApplication', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: ['canManageAccounts', 'canManageSales'] }, (ctx) => decideApplicationTx(ctx, a)).then(one(c, 'AccountApplication')),
    withdrawApplication: (_: unknown, a: any, c: any) => runCommand(c, { name: 'withdrawApplication', input: a, requireSignIn: true }, (ctx) => withdrawApplicationTx(ctx, a)).then(sudoOne(c, 'AccountApplication')),
    setAccountStatus: (_: unknown, a: any, c: any) => runCommand(c, { name: 'setAccountStatus', input: a, permission: ['canManageAccounts', 'canManageFinance', 'canManageSales'] }, (ctx) => setAccountStatusTx(ctx, a)).then(one(c, 'Account')),
    inviteAccountContact: (_: unknown, a: any, c: any) => runCommand(c, { name: 'inviteAccountContact', input: a, requireSignIn: true }, (ctx) => inviteContactTx(ctx, a)),
    acceptAccountInvite: (_: unknown, a: any, c: any) => runCommand(c, { name: 'acceptAccountInvite', input: { token: hash(String(a.token)) }, requireSignIn: true }, (ctx) => acceptInviteTx(ctx, a)).then(sudoOne(c, 'AccountContact')),
    updateAccountContact: (_: unknown, a: any, c: any) => runCommand(c, { name: 'updateAccountContact', input: a, requireSignIn: true }, (ctx) => updateContactTx(ctx, a)).then(sudoOne(c, 'AccountContact')),
    upsertAccountSite: (_: unknown, a: any, c: any) => runCommand(c, { name: 'upsertAccountSite', input: a, requireSignIn: true }, (ctx) => upsertSiteTx(ctx, a)).then(sudoOne(c, 'ServiceSite')),
    setSellerStatus: (_: unknown, a: any, c: any) => runCommand(c, { name: 'setSellerStatus', input: a, permission: ['canManageTickets', 'canManageSellers', 'canManageCompliance'] }, (ctx) => setSellerStatusTx(ctx, a)).then(one(c, 'Seller')),
    verifySellerIdentity: (_: unknown, a: any, c: any) => runCommand(c, { name: 'verifySellerIdentity', input: a, permission: ['canManageTickets', 'canManageSellers'] }, (ctx) => verifyIdentityTx(ctx, a)).then(one(c, 'Seller')),
  },
}
