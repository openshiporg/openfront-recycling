'use server';

import { revalidatePath } from 'next/cache';
import { platformRequest, trimmed } from '@/features/platform/lib/platformRequest';
import type { Grid, HistoryRow, PriceListCard } from '../types';

const PATH = '/dashboard/platform/pricing';
const KINDS = ['board', 'tier', 'contract', 'sell'];

export async function getPriceLists(kind: string) {
  const where = KINDS.includes(kind) ? { kind: { equals: kind } } : {};
  const r = await platformRequest<{ priceLists: PriceListCard[]; all: Array<{ kind: string }> }>(`
    query PriceLists($where: PriceListWhereInput!) {
      priceLists(where: $where, orderBy: [{ name: asc }], take: 200) { id name kind isActive yard { id name } accountsCount entriesCount updatedAt }
      all: priceLists(take: 500) { kind }
    }`, { where });
  if (!r.ok) return r;
  const counts: Record<string, number> = {};
  r.data.all.forEach((l) => { counts[l.kind] = (counts[l.kind] || 0) + 1; });
  return { ok: true as const, lists: r.data.priceLists, counts, total: r.data.all.length };
}

export async function getGrid(priceListId: string) {
  const r = await platformRequest<{ priceBoardGrid: Grid; priceList: { isActive: boolean; accounts: Array<{ id: string; name: string }> } | null }>(`
    query PriceGrid($id: ID!) {
      priceBoardGrid(priceListId: $id) {
        priceListId name kind yardId yardName lastPublishedAt
        rows { materialId materialName code categoryName direction defaultUnit materialIsPublic unit unitPrice unitPriceHigh isPublic effectiveFrom publishedByName previousPrice change scheduledPrice scheduledFrom }
      }
      priceList(where: { id: $id }) { isActive accounts(take: 50, orderBy: [{ name: asc }]) { id name } }
    }`, { id: priceListId });
  return r.ok ? { ok: true as const, grid: r.data.priceBoardGrid, isActive: r.data.priceList?.isActive ?? true, accounts: r.data.priceList?.accounts || [] } : r;
}

export async function getHistory(priceListId: string, materialId: string) {
  const r = await platformRequest<{ priceEntries: HistoryRow[] }>(`
    query PriceHistory($list: ID!, $mat: ID!) {
      priceEntries(where: { priceList: { id: { equals: $list } }, material: { id: { equals: $mat } } }, orderBy: [{ effectiveFrom: desc }], take: 30) {
        id unit unitPrice unitPriceHigh isPublic effectiveFrom effectiveTo publishedBy { name }
      }
    }`, { list: priceListId, mat: materialId });
  return r.ok ? { ok: true as const, rows: r.data.priceEntries } : r;
}

export async function publishPricesAction(input: { priceListId: string; entries: Array<{ materialId: string; unit: string; unitPrice: string; unitPriceHigh?: string | null; isPublic: boolean }>; effectiveFrom?: string | null; idempotencyKey: string }) {
  if (!input.entries.length) return { ok: false as const, error: 'Change at least one price before publishing.' };
  const entries = input.entries.map((e) => ({ materialId: e.materialId, unit: e.unit, unitPrice: trimmed(e.unitPrice, 20), unitPriceHigh: trimmed(e.unitPriceHigh, 20) || null, isPublic: Boolean(e.isPublic) }));
  const r = await platformRequest<{ publishPrices: { id: string; count: number; effectiveFrom: string } }>(`
    mutation PublishPrices($id: ID!, $entries: [PublishPriceInput!]!, $from: String, $key: String) {
      publishPrices(priceListId: $id, entries: $entries, effectiveFrom: $from, idempotencyKey: $key) { id count effectiveFrom }
    }`, { id: input.priceListId, entries, from: input.effectiveFrom || undefined, key: trimmed(input.idempotencyKey, 200) || undefined });
  if (!r.ok) return r;
  revalidatePath(`${PATH}/${input.priceListId}`);
  revalidatePath(PATH);
  return { ok: true as const, data: r.data.publishPrices };
}

export async function createPriceListAction(input: { name: string; kind: string; yardId?: string }) {
  const name = trimmed(input.name, 120);
  if (!name) return { ok: false as const, error: 'Name the price list.' };
  if (!KINDS.includes(input.kind)) return { ok: false as const, error: 'Choose the kind of list.' };
  const r = await platformRequest<{ createPriceList: { id: string } }>(`mutation CreatePriceList($data: PriceListCreateInput!) { createPriceList(data: $data) { id } }`, {
    data: { name, kind: input.kind, isActive: true, ...(input.yardId ? { yard: { connect: { id: input.yardId } } } : {}) },
  });
  if (!r.ok) return r;
  revalidatePath(PATH);
  return { ok: true as const, data: r.data.createPriceList };
}

export async function setPriceListActiveAction(input: { priceListId: string; isActive: boolean }) {
  const r = await platformRequest(`mutation SetPriceListActive($id: ID!, $on: Boolean!) { updatePriceList(where: { id: $id }, data: { isActive: $on }) { id isActive } }`, { id: input.priceListId, on: input.isActive });
  if (!r.ok) return r;
  revalidatePath(`${PATH}/${input.priceListId}`);
  revalidatePath(PATH);
  return { ok: true as const, data: r.data };
}
