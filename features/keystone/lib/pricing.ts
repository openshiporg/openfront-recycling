import type { Tx } from './command'

/**
 * Price waterfall (dissertation §4.1 step 6, §4.4): the account's contract list, then the account's
 * or seller's price list, then the yard's board. The latest effective entry wins; publishing writes
 * new rows and never changes a line already on a ticket.
 */

export type PriceSnapshot = { unitPrice: string; unit: string; source: 'contract' | 'price_list' | 'board'; priceEntryId: string } | null

export async function currentEntry(tx: Tx, priceListId: string | null | undefined, materialId: string, at: Date) {
  if (!priceListId) return null
  return tx.priceEntry.findFirst({
    where: {
      priceListId,
      materialId,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function resolvePrice(tx: Tx, input: { yardId: string; materialId: string; accountId?: string | null; sellerId?: string | null; at?: Date }): Promise<PriceSnapshot> {
  const at = input.at || new Date()
  const candidates: Array<{ listId: string | null; source: 'contract' | 'price_list' | 'board' }> = []
  if (input.accountId) {
    const account = await tx.account.findUnique({ where: { id: input.accountId }, include: { priceList: true } })
    if (account?.priceList?.isActive) candidates.push({ listId: account.priceList.id, source: account.priceList.kind === 'contract' ? 'contract' : 'price_list' })
  }
  if (input.sellerId) {
    const seller = await tx.seller.findUnique({ where: { id: input.sellerId }, include: { priceList: true } })
    if (seller?.priceList?.isActive) candidates.push({ listId: seller.priceList.id, source: seller.priceList.kind === 'contract' ? 'contract' : 'price_list' })
  }
  const yard = await tx.yard.findUnique({ where: { id: input.yardId } })
  candidates.push({ listId: yard?.boardPriceListId || null, source: 'board' })
  // A contract list always comes first.
  candidates.sort((a, b) => (a.source === 'contract' ? 0 : a.source === 'price_list' ? 1 : 2) - (b.source === 'contract' ? 0 : b.source === 'price_list' ? 1 : 2))
  for (const candidate of candidates) {
    const entry = await currentEntry(tx, candidate.listId, input.materialId, at)
    if (entry) return { unitPrice: String(entry.unitPrice), unit: entry.unit, source: candidate.source, priceEntryId: entry.id }
  }
  return null
}
