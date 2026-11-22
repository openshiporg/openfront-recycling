import { Decimal } from 'decimal.js'
import { ROLE_FLAGS } from '../access'
import { cleanKey, refuse, runCommand, type CommandCtx } from '../lib/command'
import {
  COMMUNITY_CATEGORIES, COMMUNITY_MATERIALS, CONTAINER_FLEET, CONTAINER_TYPES, RULES_TEMPLATES, SCRAP_CATEGORIES, SCRAP_MATERIALS, STAFF_ROLES, TIER_LISTS, WEEKDAY_HOURS,
  type RulesTemplate,
} from '../../recycling/templates'
import { publishPricesTx } from './pricing'
import { slugify } from './accounts'

/**
 * Onboarding (dissertation §11): business, first yard, rules template, materials template, container
 * types, payment provider row, staff roles. Every step is an upsert keyed by a stable slug or code,
 * so running it again fills gaps and never duplicates. Prices are published through publishPrices.
 */

export type OnboardingInput = {
  template: 'scrap_yard' | 'community_centre'
  business: { name: string; legalName?: string | null; weightUnit?: 'lb' | 'kg' | null; currencyCode?: string | null; timezone?: string | null; isNonprofit?: boolean | null; ein?: string | null; supportEmail?: string | null; supportPhone?: string | null; about?: string | null }
  yard: { name: string; code?: string | null; acceptsPublic?: boolean | null; scaleTypes?: string[] | null; publicNotes?: string | null; addressLine1?: string | null; city?: string | null; region?: string | null; postalCode?: string | null; country?: string | null; phone?: string | null; email?: string | null; payoutMethods?: string[] | null; hours?: unknown }
  additionalYards?: Array<OnboardingInput['yard']> | null
  rulesTemplate?: RulesTemplate['template'] | null
  cardProvider?: 'stripe' | 'none' | null
}

const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

type Step1 = { yardId: string; yardIds: string[]; profileId: string; template: 'scrap_yard' | 'community_centre'; weightUnit: 'lb' | 'kg'; rules: RulesTemplate['template'] }

/** Step 1: business, roles, rules profile, first yard. */
export async function onboardBusinessTx(ctx: CommandCtx, input: OnboardingInput): Promise<Step1> {
  const { tx } = ctx
  const template = input.template === 'community_centre' ? 'community_centre' : 'scrap_yard'
  const b = input.business || ({} as OnboardingInput['business'])
  const name = text(b.name, 120)
  if (name.length < 2) refuse('Enter the business name.')
  const weightUnit = b.weightUnit === 'kg' ? 'kg' : 'lb'
  const currencyCode = (text(b.currencyCode, 3) || 'USD').toUpperCase()
  if (!/^[A-Z]{3}$/.test(currencyCode)) refuse('Enter a three-letter currency code.')
  const timezone = text(b.timezone, 60) || 'America/New_York'
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }) } catch { refuse('Choose a real time zone.') }
  const isNonprofit = template === 'community_centre' ? true : Boolean(b.isNonprofit)

  // (1) Business.
  const business = {
    name, legalName: text(b.legalName, 160), weightUnit, currencyCode, timezone, isNonprofit, ein: text(b.ein, 20), supportEmail: text(b.supportEmail, 254), supportPhone: text(b.supportPhone, 40),
    about: text(b.about, 2000), onboardingStatus: 'in_progress',
  }
  const existingSettings = await tx.businessSettings.findFirst()
  if (existingSettings) await tx.businessSettings.update({ where: { id: existingSettings.id }, data: business })
  else await tx.businessSettings.create({ data: { id: 1, ...business } })

  // (7) Roles first, so the owner can be given one.
  const roleIds: Record<string, string> = {}
  for (const r of STAFF_ROLES) {
    const flags = r.flags === 'all' ? Object.fromEntries(ROLE_FLAGS.map((f) => [f, true])) : Object.fromEntries(ROLE_FLAGS.map((f) => [f, Boolean((r.flags as any)[f])]))
    const role = await tx.role.upsert({ where: { name: r.name }, create: { name: r.name, ...flags }, update: {} })
    roleIds[r.name] = role.id
  }

  // (3) Rules.
  const rt = RULES_TEMPLATES[input.rulesTemplate || 'general'] || RULES_TEMPLATES.general
  let profile = await tx.rulesProfile.findFirst({ where: { template: rt.template, name: rt.name } })
  if (!profile) profile = await tx.rulesProfile.create({ data: { name: rt.name, region: rt.region, template: rt.template, ...rt.profile } })

  // (2) Yards: the first one, then any others. Every yard gets the same rules and starting prices.
  const yardInputs = [input.yard, ...(Array.isArray(input.additionalYards) ? input.additionalYards : [])].filter(Boolean).slice(0, 10)
  if (!yardInputs.length) refuse('Enter the yard name.')
  const codes = new Set<string>()
  const yardIds: string[] = []
  for (const [i, y] of yardInputs.entries()) {
    const yardName = text(y.name, 120)
    if (yardName.length < 2) refuse('Enter the yard name.')
    const code = (text(y.code, 8) || (i === 0 ? 'MAIN' : '')).toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!code) refuse(`Enter a short code for ${yardName}, for example EAST.`)
    if (codes.has(code)) refuse(`Two yards use the code ${code}.`)
    codes.add(code)
    const payoutMethods = (Array.isArray(y.payoutMethods) && y.payoutMethods.length ? y.payoutMethods : ['cash', 'check']).filter((m) => ['cash', 'check', 'transfer'].includes(m))
    if (!payoutMethods.length) refuse(`Choose how ${yardName} pays sellers.`)
    const yardData = {
      name: yardName, addressLine1: text(y.addressLine1), city: text(y.city, 100), region: text(y.region, 100), postalCode: text(y.postalCode, 20), country: text(y.country, 2) || 'US',
      phone: text(y.phone, 40), email: text(y.email, 254), timezone, hours: (y.hours as any) || WEEKDAY_HOURS, payoutMethods, acceptsPublic: y.acceptsPublic ?? true, status: 'active',
      scaleTypes: (Array.isArray(y.scaleTypes) && y.scaleTypes.length ? y.scaleTypes : ['truck', 'floor']).filter((k) => ['truck', 'floor', 'bench'].includes(k)), publicNotes: text(y.publicNotes, 1000), rulesProfileId: profile.id,
    }
    let yard = await tx.yard.findUnique({ where: { code } })
    if (yard) yard = await tx.yard.update({ where: { id: yard.id }, data: yardData })
    else {
      let slug = slugify(yardName) || `yard-${code.toLowerCase()}`
      if (await tx.yard.findUnique({ where: { slug } })) slug = `${slug}-${code.toLowerCase()}`
      yard = await tx.yard.create({ data: { ...yardData, code, slug } })
    }
    yardIds.push(yard.id)
  }
  if (ctx.actorId) {
    const actor = await tx.user.findUnique({ where: { id: ctx.actorId }, include: { yards: { select: { id: true } } } })
    const missing = yardIds.filter((id) => !actor?.yards.some((x: any) => x.id === id))
    if (actor && missing.length) await tx.user.update({ where: { id: actor.id }, data: { yards: { connect: missing.map((id) => ({ id })) } } })
  }

  return { yardId: yardIds[0], yardIds, profileId: profile.id, template, weightUnit, rules: rt.template }
}

const templateMaterials = (t: Step1['template']) => (t === 'community_centre' ? [...SCRAP_MATERIALS, ...COMMUNITY_MATERIALS] : SCRAP_MATERIALS)

/** Step 2: categories, materials and the rules template's restrictions. */
export async function onboardMaterialsTx(ctx: CommandCtx, s1: Step1) {
  const { tx } = ctx
  const { template, weightUnit } = s1
  const rt = RULES_TEMPLATES[s1.rules]
  const profile = { id: s1.profileId }
  const categories = template === 'community_centre' ? [...SCRAP_CATEGORIES, ...COMMUNITY_CATEGORIES] : SCRAP_CATEGORIES
  const materials = templateMaterials(template)
  const catIds: Record<string, string> = {}
  for (const c of categories) {
    const row = await tx.materialCategory.upsert({ where: { slug: c.slug }, create: c, update: {} })
    catIds[c.slug] = row.id
  }
  const matIds: Record<string, string> = {}
  let sort = 0
  for (const m of materials) {
    sort += 10
    const unit = weightUnit === 'kg' && m.unit === 'lb' ? 'kg' : weightUnit === 'kg' && m.unit === 'net_ton' ? 'metric_tonne' : m.unit
    const row = await tx.material.upsert({
      where: { code: m.code },
      create: {
        code: m.code, name: m.name, slug: slugify(m.name), categoryId: catIds[m.category], specName: m.spec || '', description: m.description || '', preparationTips: m.tips || '', defaultUnit: unit,
        direction: m.direction || 'pay_seller', isPublic: m.isPublic ?? true, isActive: true, acceptsFromPublic: m.acceptsFromPublic ?? true, sortOrder: sort,
      },
      update: {},
    })
    matIds[m.code] = row.id
  }

  for (const r of rt.restrictions) {
    const materialId = r.material ? matIds[r.material] : null
    const categoryId = r.category ? catIds[r.category] : null
    if (!materialId && !categoryId) continue
    const exists = await tx.materialRestriction.findFirst({ where: { profileId: profile.id, materialId, categoryId, kind: r.kind } })
    if (exists) continue
    await tx.materialRestriction.create({
      data: { profileId: profile.id, materialId, categoryId, label: r.label, kind: r.kind, requiredDocuments: r.requiredDocuments || [], forbidCash: Boolean(r.forbidCash), allowedMethods: r.allowedMethods || null, paymentHoldDays: r.paymentHoldDays ?? null, materialHoldDays: r.materialHoldDays ?? null, mailCheckOnly: Boolean(r.mailCheckOnly), publicNote: r.publicNote || '' },
    })
  }

  return { count: materials.length }
}

/** Step 3: board and tier lists; prices published today. A list that already has prices is left alone. */
export async function onboardPricesTx(ctx: CommandCtx, s1: Step1) {
  const { tx } = ctx
  const { weightUnit } = s1
  const materials = templateMaterials(s1.template)
  const yard = await tx.yard.findUnique({ where: { id: s1.yardId } })
  const matIds: Record<string, string> = Object.fromEntries((await tx.material.findMany({ where: { code: { in: materials.map((m) => m.code) } }, select: { id: true, code: true } })).map((m: any) => [m.code, m.id]))
  const toUnitPrice = (m: (typeof materials)[number], factor = 1) => {
    let p = new Decimal(m.price)
    if (weightUnit === 'kg' && m.unit === 'lb') p = p.times('2.20462')
    if (weightUnit === 'kg' && m.unit === 'net_ton') p = p.times('1.10231')
    return p.times(factor).toDecimalPlaces(m.unit === 'each' || m.unit === 'net_ton' ? 2 : 3).toFixed()
  }
  let published = 0
  for (const yardId of s1.yardIds) {
    const y = await tx.yard.findUnique({ where: { id: yardId } })
    let board = y.boardPriceListId ? await tx.priceList.findUnique({ where: { id: y.boardPriceListId } }) : null
    if (!board) {
      board = await tx.priceList.create({ data: { name: `${y.name} board`, kind: 'board', yardId: y.id, isActive: true } })
      await tx.yard.update({ where: { id: y.id }, data: { boardPriceListId: board.id } })
    }
    if (await tx.priceEntry.count({ where: { priceListId: board.id } })) continue
    const r = await publishPricesTx(ctx, {
      priceListId: board.id,
      entries: materials.map((m) => ({ materialId: matIds[m.code], unitPrice: toUnitPrice(m), unitPriceHigh: m.high ? toUnitPrice({ ...m, price: m.high }) : null, isPublic: m.isPublic ?? true })),
    })
    published += r.count
  }
  for (const t of TIER_LISTS) {
    let list = await tx.priceList.findFirst({ where: { name: t.name, kind: 'tier' } })
    if (!list) list = await tx.priceList.create({ data: { name: t.name, kind: 'tier', yardId: yard.id, isActive: true } })
    if (await tx.priceEntry.count({ where: { priceListId: list.id } })) continue
    const r = await publishPricesTx(ctx, {
      priceListId: list.id,
      entries: materials.filter((m) => (m.direction || 'pay_seller') === 'pay_seller' && m.unit !== 'each').map((m) => ({ materialId: matIds[m.code], unitPrice: toUnitPrice(m, 1 + t.premiumPercent / 100), isPublic: false })),
    })
    published += r.count
  }

  return { published }
}

/** Step 4: container types and fleet, trucks, scales, drawer, card provider; marks onboarding done. */
export async function onboardEquipmentTx(ctx: CommandCtx, s1: Step1, input: OnboardingInput) {
  const { tx } = ctx
  const { weightUnit, template } = s1
  const yard = { id: s1.yardId }
  const typeIds: Record<string, string> = {}
  for (const c of CONTAINER_TYPES) {
    const row = await tx.containerType.upsert({ where: { slug: c.slug }, create: { ...c, description: c.suitableFor, isPublic: true }, update: {} })
    typeIds[c.slug] = row.id
  }
  for (const f of CONTAINER_FLEET) {
    for (let i = 1; i <= f.count; i++) {
      const number = `${f.prefix}-${String(i).padStart(3, '0')}`
      await tx.container.upsert({ where: { number }, create: { number, typeId: typeIds[f.type], homeYardId: yard.id, status: 'in_yard', tareWeight: weightUnit === 'kg' ? new Decimal(f.tare).div('2.20462').toFixed(0) : f.tare }, update: {} })
    }
  }
  const trucks = [{ name: 'Roll-off 1', plate: '', kind: 'roll_off' }, { name: 'Flatbed 1', plate: '', kind: 'flatbed' }]
  for (const t of trucks) if (!(await tx.truck.findFirst({ where: { yardId: yard.id, name: t.name } }))) await tx.truck.create({ data: { ...t, yardId: yard.id, isActive: true } })
  for (const yardId of s1.yardIds) {
    const y = await tx.yard.findUnique({ where: { id: yardId } })
    const kinds: string[] = Array.isArray(y.scaleTypes) && y.scaleTypes.length ? y.scaleTypes : ['truck', 'floor']
    for (const kind of kinds) {
      const scaleName = kind === 'truck' ? 'Truck scale' : kind === 'floor' ? 'Floor scale' : 'Bench scale'
      if (!(await tx.scale.findFirst({ where: { yardId, name: scaleName } }))) await tx.scale.create({ data: { name: scaleName, kind, yardId, isActive: true } })
    }
    if (!(await tx.cashDrawer.findFirst({ where: { yardId } }))) await tx.cashDrawer.create({ data: { name: 'Front counter', yardId, isActive: true } })
  }

  // (6) Payment provider: card payments use the Stripe adapter when its keys are present on the server.
  if (input.cardProvider !== 'none') {
    await tx.paymentProvider.upsert({ where: { code: 'pp_stripe' }, create: { code: 'pp_stripe', name: 'Stripe', isInstalled: true }, update: { isInstalled: true } })
  }

  await tx.businessSettings.updateMany({ data: { onboardingStatus: 'completed' } })
  await ctx.audit({ eventType: 'onboarding.completed', aggregateType: 'BusinessSettings', aggregateId: '1', yardId: yard.id, after: { template, rules: s1.rules } })
  return { containers: CONTAINER_FLEET.reduce((s, f) => s + f.count, 0) }
}

/** The steps run in order, each in its own transaction (a remote database makes one big one too slow). */
export async function runOnboarding(c: any, input: OnboardingInput, idempotencyKey?: string | null) {
  const key = cleanKey(idempotencyKey)
  const opts = (step: string) => ({ name: `runOnboarding.${step}`, input, idempotencyKey: key ? `${key}:${step}` : null, permission: 'canManageOnboarding' as const })
  const s1 = await runCommand(c, opts('business'), (ctx) => onboardBusinessTx(ctx, input))
  const s2 = await runCommand(c, opts('materials'), (ctx) => onboardMaterialsTx(ctx, s1))
  const s3 = await runCommand(c, opts('prices'), (ctx) => onboardPricesTx(ctx, s1))
  const s4 = await runCommand(c, opts('equipment'), (ctx) => onboardEquipmentTx(ctx, s1, input))
  const yard = await c.sudo().prisma.yard.findUnique({ where: { id: s1.yardId } })
  return { id: yard.id, yardSlug: yard.slug, yards: s1.yardIds.length, template: s1.template, materials: s2.count, pricesPublished: s3.published, roles: STAFF_ROLES.length, containers: s4.containers }
}

export const onboardingTypeDefs = `
  input OnboardingBusinessInput { name: String!, legalName: String, weightUnit: String, currencyCode: String, timezone: String, isNonprofit: Boolean, ein: String, supportEmail: String, supportPhone: String, about: String }
  input OnboardingYardInput { name: String!, code: String, acceptsPublic: Boolean, scaleTypes: [String!], publicNotes: String, addressLine1: String, city: String, region: String, postalCode: String, country: String, phone: String, email: String, payoutMethods: [String!], hours: JSON }
  input RunOnboardingInput { template: String!, business: OnboardingBusinessInput!, yard: OnboardingYardInput!, additionalYards: [OnboardingYardInput!], rulesTemplate: String, cardProvider: String }
  type OnboardingResult { id: ID!, yardSlug: String!, yards: Int!, template: String!, materials: Int!, pricesPublished: Int!, roles: Int!, containers: Int! }
`
export const onboardingMutationDefs = `
  runOnboarding(data: RunOnboardingInput!, idempotencyKey: String): OnboardingResult
`
export const onboardingResolvers = {
  Mutation: {
    runOnboarding: (_: unknown, a: any, c: any) => runOnboarding(c, a.data, a.idempotencyKey),
  },
}
