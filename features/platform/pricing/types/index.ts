export type PriceListCard = { id: string; name: string; kind: string; isActive: boolean; yard: { id: string; name: string } | null; accountsCount: number; entriesCount: number; updatedAt: string | null };
export type GridRow = {
  materialId: string; materialName: string; code: string | null; categoryName: string | null; direction: string; defaultUnit: string; materialIsPublic: boolean;
  unit: string; unitPrice: string | null; unitPriceHigh: string | null; isPublic: boolean; effectiveFrom: string | null; publishedByName: string | null;
  previousPrice: string | null; change: string | null; scheduledPrice: string | null; scheduledFrom: string | null;
};
export type Grid = { priceListId: string; name: string; kind: string; yardId: string | null; yardName: string | null; lastPublishedAt: string | null; rows: GridRow[] };
export type HistoryRow = { id: string; unit: string; unitPrice: string; unitPriceHigh: string | null; isPublic: boolean; effectiveFrom: string; effectiveTo: string | null; publishedBy: { name: string } | null };
export const UNITS = ['lb', 'cwt', 'net_ton', 'gross_ton', 'kg', 'metric_tonne', 'each'] as const;
export const UNIT_LABEL: Record<string, string> = { lb: 'lb', cwt: 'cwt', net_ton: 'net ton', gross_ton: 'gross ton', kg: 'kg', metric_tonne: 'tonne', each: 'each' };
export const KIND_LABEL: Record<string, string> = { board: 'Yard board', tier: 'Customer tier', contract: 'Contract', sell: 'Sell list' };
