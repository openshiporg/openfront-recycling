export type Category = { id: string; name: string; slug: string; kind: string; sortOrder: number; materialsCount: number; image: { url: string } | null };
export type MaterialRow = {
  id: string; name: string; code: string; slug: string; specName: string | null; defaultUnit: string; direction: string;
  isPublic: boolean; isActive: boolean; acceptsFromPublic: boolean; sortOrder: number; image: { url: string } | null;
  category: { id: string; name: string } | null;
};
export type MaterialDetail = MaterialRow & { description: string | null; preparationTips: string | null; minimumWeight: string | null; standardContainerTare: string | null; updatedAt: string | null };
export type Restriction = {
  id: string; label: string; kind: string; forbidCash: boolean; allowedMethods: string[] | null; paymentHoldDays: number; materialHoldDays: number; mailCheckOnly: boolean; publicNote: string | null;
  requiredDocuments: string[] | null; profile: { id: string; name: string } | null; material: { id: string } | null; category: { id: string; name: string } | null;
};
export type Profile = { id: string; name: string; template: string; region: string | null };
export const UNITS = ['lb', 'cwt', 'net_ton', 'gross_ton', 'kg', 'metric_tonne', 'each'] as const;
export const UNIT_LABEL: Record<string, string> = { lb: 'lb', cwt: 'cwt', net_ton: 'net ton', gross_ton: 'gross ton', kg: 'kg', metric_tonne: 'tonne', each: 'each' };
export const CATEGORY_KINDS = ['ferrous', 'non_ferrous', 'electronics', 'paper', 'plastic', 'glass', 'other'] as const;
export const RESTRICTION_KINDS: Record<string, string> = { prohibited: 'Not accepted', proof_of_ownership: 'Proof of ownership', commercial_only: 'Commercial sellers only', payment_rule: 'Payment rule' };
