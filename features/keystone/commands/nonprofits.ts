import { CommandError, compareAndSet, refuse, runCommand, type CommandCtx, type Tx } from '../lib/command'
import { businessSettings } from '../lib/domain'
import { requireAccountRole, slugify } from './accounts'

/**
 * Nonprofits, campaigns and donation receipts (dissertation §4.8, §5.12).
 * Goods given to a nonprofit centre are described, never valued; the donor values their own gift.
 */

export async function updateNonprofitProfileTx(ctx: CommandCtx, input: { accountId: string; nonprofitSummary?: string | null; nonprofitWebsite?: string | null; isPublicNonprofit?: boolean | null }) {
  await requireAccountRole(ctx.tx, ctx.session, input.accountId, ['admin'], 'canManageAccounts')
  const account = await ctx.tx.account.findUnique({ where: { id: input.accountId } })
  if (!account?.isNonprofit) refuse('This account is not a nonprofit.')
  const site = String(input.nonprofitWebsite || '').trim()
  if (site && !/^https:\/\/[^\s]+$/i.test(site)) refuse('The website must start with https://')
  const data: Record<string, unknown> = {}
  if (input.nonprofitSummary !== undefined) data.nonprofitSummary = String(input.nonprofitSummary || '').slice(0, 4000)
  if (input.nonprofitWebsite !== undefined) data.nonprofitWebsite = site
  if (input.isPublicNonprofit !== undefined && input.isPublicNonprofit !== null) data.isPublicNonprofit = input.isPublicNonprofit
  await ctx.tx.account.update({ where: { id: account.id }, data })
  await ctx.audit({ eventType: 'nonprofit.updated', aggregateType: 'Account', aggregateId: account.id, after: data })
  return ctx.tx.account.findUnique({ where: { id: account.id } })
}

export async function upsertCampaignTx(ctx: CommandCtx, input: { accountId: string; campaignId?: string | null; name: string; description?: string | null; goalWeight?: string | null; goalCents?: number | null; startsOn?: string | null; endsOn?: string | null; isPublic?: boolean | null; status?: string | null }) {
  await requireAccountRole(ctx.tx, ctx.session, input.accountId, ['admin', 'member'], 'canManageAccounts')
  const account = await ctx.tx.account.findUnique({ where: { id: input.accountId } })
  if (!account?.isNonprofit) refuse('Only a nonprofit runs campaigns.')
  const name = String(input.name || '').trim()
  if (name.length < 3) refuse('Name the campaign.')
  const starts = input.startsOn ? new Date(input.startsOn) : null
  const ends = input.endsOn ? new Date(input.endsOn) : null
  if (starts && ends && ends <= starts) refuse('The end date must be after the start.')
  const status = input.status || 'active'
  if (!['draft', 'active', 'ended'].includes(status)) refuse('Choose draft, active or ended.')
  const data = {
    name, description: String(input.description || ''), goalWeight: input.goalWeight ? String(input.goalWeight) : null, goalCents: input.goalCents ?? null,
    startsOn: starts, endsOn: ends, isPublic: input.isPublic ?? true, status,
  }
  if (input.campaignId) {
    const existing = await ctx.tx.donationCampaign.findUnique({ where: { id: input.campaignId } })
    if (!existing || existing.accountId !== account.id) throw new CommandError('Campaign not found.', 'NOT_FOUND')
    return ctx.tx.donationCampaign.update({ where: { id: existing.id }, data })
  }
  let slug = slugify(`${account.slug}-${name}`)
  if (await ctx.tx.donationCampaign.findFirst({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`
  const campaign = await ctx.tx.donationCampaign.create({ data: { ...data, slug, accountId: account.id } })
  await ctx.audit({ eventType: 'campaign.created', aggregateType: 'DonationCampaign', aggregateId: campaign.id, after: { name } })
  return campaign
}

export async function endCampaignTx(ctx: CommandCtx, input: { campaignId: string }) {
  const campaign = await ctx.tx.donationCampaign.findUnique({ where: { id: input.campaignId } })
  if (!campaign) refuse('Campaign not found.')
  await requireAccountRole(ctx.tx, ctx.session, campaign.accountId, ['admin', 'member'], 'canManageAccounts')
  await compareAndSet(ctx.tx, 'donationCampaign', campaign.id, ['draft', 'active'], { status: 'ended', endsOn: campaign.endsOn || ctx.now })
  return ctx.tx.donationCampaign.findUnique({ where: { id: campaign.id } })
}

/** The receipt as data (S13). Values in §4.8; used by the printable receipt and the API. */
export async function donationReceipt(tx: Tx, donationId: string) {
  const d = await tx.donation.findUnique({
    where: { id: donationId },
    include: { seller: true, account: true, campaign: true, ticket: { include: { yard: true, lines: { orderBy: { sortOrder: 'asc' } } } } },
  })
  if (!d || !d.receiptNumber) return null
  const settings: any = await businessSettings(tx)
  const goods = d.kind === 'goods_donation'
  const nonprofit = goods ? { legalName: settings.legalName || settings.name, ein: settings.ein || '' } : { legalName: d.account?.legalName || d.account?.name || '', ein: d.account?.ein || '' }
  const items = (d.ticket?.lines || []).map((l: any) => ({ material: l.materialName, weight: String(l.payWeight), unit: l.unit, quantity: l.quantity }))
  return {
    id: d.id, receiptNumber: d.receiptNumber, issuedAt: d.receiptIssuedAt, status: d.status, kind: d.kind,
    donorName: d.seller ? `${d.seller.firstName} ${d.seller.lastName}`.trim() : '', date: d.ticket?.completedAt || d.createdAt,
    yardName: d.ticket?.yard?.name || '', nonprofitLegalName: nonprofit.legalName, nonprofitEin: nonprofit.ein, campaignName: d.campaign?.name || null,
    items, amountCreditedCents: goods ? null : d.amountCents, goodsOrServicesProvided: d.goodsOrServicesProvided,
    statement: d.goodsOrServicesProvided
      ? 'Goods or services were provided in return for this donation.'
      : goods
        ? `No goods or services were provided in return for this donation. ${nonprofit.legalName} does not state a value for donated goods; the donor determines the value of their gift.`
        : 'No goods or services were provided in return for this donation.',
  }
}

export const nonprofitTypeDefs = `
  type DonationReceiptItem { material: String, weight: String, unit: String, quantity: Int }
  type DonationReceipt {
    id: ID!, receiptNumber: String!, issuedAt: DateTime, status: String!, kind: String!, donorName: String, date: DateTime, yardName: String,
    nonprofitLegalName: String, nonprofitEin: String, campaignName: String, items: [DonationReceiptItem!]!, amountCreditedCents: Int,
    goodsOrServicesProvided: Boolean!, statement: String!
  }
`
export const nonprofitMutationDefs = `
  updateNonprofitProfile(accountId: ID!, nonprofitSummary: String, nonprofitWebsite: String, isPublicNonprofit: Boolean): Account
  upsertCampaign(accountId: ID!, campaignId: ID, name: String!, description: String, goalWeight: String, goalCents: Int, startsOn: String, endsOn: String, isPublic: Boolean, status: String): DonationCampaign
  endCampaign(campaignId: ID!): DonationCampaign
`
const sudoOne = (c: any, list: string) => (r: any) => (r?.id ? c.sudo().db[list].findOne({ where: { id: r.id } }) : null)
export const nonprofitResolvers = {
  Mutation: {
    updateNonprofitProfile: (_: unknown, a: any, c: any) => runCommand(c, { name: 'updateNonprofitProfile', input: a, requireSignIn: true }, (ctx) => updateNonprofitProfileTx(ctx, a)).then(sudoOne(c, 'Account')),
    upsertCampaign: (_: unknown, a: any, c: any) => runCommand(c, { name: 'upsertCampaign', input: a, requireSignIn: true }, (ctx) => upsertCampaignTx(ctx, a)).then(sudoOne(c, 'DonationCampaign')),
    endCampaign: (_: unknown, a: any, c: any) => runCommand(c, { name: 'endCampaign', input: a, requireSignIn: true }, (ctx) => endCampaignTx(ctx, a)).then(sudoOne(c, 'DonationCampaign')),
  },
}
