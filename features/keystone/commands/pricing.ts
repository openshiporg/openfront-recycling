import { Decimal } from 'decimal.js'
import { cleanKey, refuse, runCommand, type CommandCtx } from '../lib/command'
import { UNITS } from '../models/catalog'

/**
 * publishPrices (dissertation §4.4). Price entries are append-only: publishing writes new rows that take
 * effect at `effectiveFrom` (default now) and closes the previous open entry for the same material on
 * that list. Lines already on tickets keep their snapshot.
 */

export type PriceInput = { materialId: string; unit?: string | null; unitPrice: string; unitPriceHigh?: string | null; isPublic?: boolean | null }

const price = (v: unknown, label: string) => {
  let d: Decimal
  try { d = new Decimal(String(v ?? '').trim()) } catch { refuse(`Enter a price for ${label}.`) }
  if (!d!.isFinite() || d!.lt(0) || d!.gt(1_000_000)) refuse(`Enter a price for ${label} from 0 up.`)
  return d!.toDecimalPlaces(5)
}

export async function publishPricesTx(ctx: CommandCtx, input: { priceListId: string; entries: PriceInput[]; effectiveFrom?: string | null }) {
  const { tx } = ctx
  const list = await tx.priceList.findUnique({ where: { id: input.priceListId } })
  if (!list) refuse('Price list not found.')
  if (!list.isActive) refuse('This price list is switched off.')
  const entries = Array.isArray(input.entries) ? input.entries : []
  if (!entries.length) refuse('Add at least one price.')
  if (entries.length > 500) refuse('Publish at most 500 prices at a time.')
  const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : ctx.now
  if (Number.isNaN(effectiveFrom.getTime())) refuse('Enter when the prices take effect.')
  if (effectiveFrom.getTime() < ctx.now.getTime() - 60_000) refuse('Prices take effect now or later; past prices stay as they were.')

  const ids = [...new Set(entries.map((e) => String(e.materialId || '')))]
  if (ids.length !== entries.length) refuse('Each material appears once.')
  const materials = await tx.material.findMany({ where: { id: { in: ids } } })
  const byId = new Map(materials.map((m: any) => [m.id, m]))
  const rows: any[] = []
  for (const e of entries) {
    const m: any = byId.get(String(e.materialId))
    if (!m) refuse('One of the materials was not found.')
    const unit = e.unit || m.defaultUnit
    if (!(UNITS as readonly string[]).includes(unit)) refuse(`Choose a unit for ${m.name}.`)
    const low = price(e.unitPrice, m.name)
    const high = e.unitPriceHigh === null || e.unitPriceHigh === undefined || String(e.unitPriceHigh).trim() === '' ? null : price(e.unitPriceHigh, m.name)
    if (high && high.lt(low)) refuse(`The high price for ${m.name} is below the low price.`)
    rows.push({ priceListId: list.id, materialId: m.id, unit, unitPrice: low.toFixed(5), unitPriceHigh: high ? high.toFixed(5) : null, isPublic: e.isPublic ?? true, effectiveFrom, publishedById: ctx.actorId })
  }
  // Close the entries open at the new start (a later scheduled one stays), then append the new rows.
  await tx.priceEntry.updateMany({ where: { priceListId: list.id, materialId: { in: ids }, effectiveFrom: { lt: effectiveFrom }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }] }, data: { effectiveTo: effectiveFrom } })
  await tx.priceEntry.createMany({ data: rows })
  const created = rows.map((r) => r.materialId)
  await ctx.audit({ eventType: 'prices.published', aggregateType: 'PriceList', aggregateId: list.id, yardId: list.yardId, after: { count: created.length, effectiveFrom } })
  return { id: list.id, count: created.length, effectiveFrom }
}

export const pricingTypeDefs = `
  input PublishPriceInput { materialId: ID!, unit: String, unitPrice: String!, unitPriceHigh: String, isPublic: Boolean }
  type PublishPricesResult { id: ID!, count: Int!, effectiveFrom: DateTime! }
`
export const pricingMutationDefs = `
  publishPrices(priceListId: ID!, entries: [PublishPriceInput!]!, effectiveFrom: String, idempotencyKey: String): PublishPricesResult
`
export const pricingResolvers = {
  Mutation: {
    publishPrices: (_: unknown, a: any, c: any) =>
      runCommand(c, { name: 'publishPrices', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: 'canManagePricing', aggregateType: 'PriceList' }, (ctx) => publishPricesTx(ctx, a)),
  },
}
