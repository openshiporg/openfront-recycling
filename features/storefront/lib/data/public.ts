import { cache } from 'react';
import { gql, type GqlResult } from './client';

/**
 * Public (no sign-in) data. Yards, closures, categories, materials and container types are public read
 * lists (dissertation §7.2); business details, prices and yard rules come from the custom queries
 * publicBusiness, publicPriceBoard and publicYardRules, which return only public fields.
 */

export type Business = {
  name: string;
  legalName: string | null;
  logoUrl: string | null;
  weightUnit: 'lb' | 'kg';
  currencyCode: string;
  timezone: string;
  isNonprofit: boolean;
  ein: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  about: string | null;
};

export type Closure = { id: string; date: string; reason: string | null; isPartial: boolean | null; openTime: string | null; closeTime: string | null };

export type Yard = {
  id: string;
  name: string;
  slug: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: string | null;
  longitude: string | null;
  phone: string | null;
  email: string | null;
  timezone: string | null;
  hours: Record<string, { open?: string; close?: string; closed?: boolean }> | null;
  acceptsPublic: boolean | null;
  scaleTypes: unknown;
  publicNotes: string | null;
  payoutMethods: string[] | null;
  closures: Closure[];
};

export type PriceRow = {
  materialId: string;
  materialName: string;
  materialSlug: string;
  categoryName: string | null;
  categorySlug: string | null;
  categorySortOrder: number | null;
  direction: 'pay_seller' | 'charge_customer' | string;
  unit: string;
  unitPrice: string;
  unitPriceHigh: string | null;
  effectiveFrom: string;
  imageUrl: string | null;
};

export type PriceBoard = {
  yard: { id: string; name: string; slug: string; timezone: string | null };
  publishedAt: string | null;
  currencyCode: string;
  weightUnit: 'lb' | 'kg';
  entries: PriceRow[];
};

export type YardRules = {
  yardName: string;
  requireGovernmentId: boolean;
  requireIdPhoto: boolean;
  requireSellerPhoto: boolean;
  requireVehiclePlate: boolean;
  requireSignature: boolean;
  requireThumbprint: boolean;
  minimumSellerAge: number | null;
  payoutMethods: string[];
  cashLimitPerTicketCents: number | null;
  cashRounding: string | null;
  defaultPaymentHoldDays: number | null;
  defaultMaterialHoldDays: number | null;
  ownershipStatement: string | null;
  restrictions: Array<{
    label: string;
    kind: string;
    materialName: string | null;
    materialSlug: string | null;
    categoryName: string | null;
    forbidCash: boolean | null;
    allowedMethods: string[] | null;
    paymentHoldDays: number | null;
    materialHoldDays: number | null;
    mailCheckOnly: boolean | null;
    requiredDocuments: string[] | null;
    publicNote: string | null;
  }>;
};

export type Category = { id: string; name: string; slug: string; kind: string; sortOrder: number | null; imageUrl: string | null };
export type MaterialLite = {
  id: string;
  name: string;
  slug: string;
  specName: string | null;
  description: string | null;
  defaultUnit: string;
  direction: string;
  acceptsFromPublic: boolean | null;
  sortOrder: number | null;
  imageUrl: string | null;
  category: { name: string; slug: string; kind: string; sortOrder: number | null } | null;
};

export type MaterialDetail = MaterialLite & {
  preparationTips: string | null;
  minimumWeight: string | null;
  images: string[];
};

export type ContainerType = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  capacityLabel: string | null;
  dimensions: string | null;
  description: string | null;
  suitableFor: string | null;
  imageUrl: string | null;
  deliveryFeeCents: number;
  haulFeeCents: number;
  rentalFeePerDayCents: number;
  freeRentalDays: number;
  dryRunFeeCents: number;
};

const YARD_FIELDS = `id name slug addressLine1 addressLine2 city region postalCode country latitude longitude phone email timezone hours acceptsPublic scaleTypes publicNotes payoutMethods
  closures(orderBy: [{ date: asc }], take: 20) { id date reason isPartial openTime closeTime }`;

export const getBusiness = cache(async (): Promise<GqlResult<Business | null>> => {
  const r = await gql<{ publicBusiness: Business | null }>(`query { publicBusiness { name legalName logoUrl weightUnit currencyCode timezone isNonprofit ein supportEmail supportPhone about } }`);
  return r.ok ? { ok: true, data: r.data.publicBusiness } : r;
});

export const getYards = cache(async (): Promise<GqlResult<Yard[]>> => {
  const r = await gql<{ yards: Yard[] }>(`query { yards(where: { status: { equals: "active" } }, orderBy: [{ name: asc }]) { ${YARD_FIELDS} } }`);
  if (!r.ok) return r;
  // Closures already past are not news.
  const cutoff = Date.now() - 86400000;
  return { ok: true, data: r.data.yards.map((y) => ({ ...y, payoutMethods: Array.isArray(y.payoutMethods) ? y.payoutMethods : [], closures: (y.closures || []).filter((c) => new Date(c.date).getTime() >= cutoff) })) };
});

/** Yards that take walk-in sellers: the ones the public price, calculator and rules pages offer. */
export const getPublicYards = cache(async (): Promise<GqlResult<Yard[]>> => {
  const r = await getYards();
  return r.ok ? { ok: true, data: r.data.filter((y) => y.acceptsPublic !== false) } : r;
});

export const getYard = cache(async (slug: string): Promise<GqlResult<Yard | null>> => {
  const r = await getYards();
  if (!r.ok) return r;
  return { ok: true, data: r.data.find((y) => y.slug === slug) || null };
});

const PRICE_ROW = `materialId materialName materialSlug categoryName categorySlug categorySortOrder direction unit unitPrice unitPriceHigh effectiveFrom imageUrl`;

export const getPriceBoard = cache(async (yardSlug?: string | null): Promise<GqlResult<PriceBoard | null>> => {
  const r = await gql<{ publicPriceBoard: PriceBoard | null }>(
    `query($yardSlug: String) { publicPriceBoard(yardSlug: $yardSlug) { yard { id name slug timezone } publishedAt currencyCode weightUnit entries { ${PRICE_ROW} } } }`,
    { yardSlug: yardSlug || null },
  );
  return r.ok ? { ok: true, data: r.data.publicPriceBoard } : r;
});

export const getYardRules = cache(async (yardSlug: string): Promise<GqlResult<YardRules | null>> => {
  const r = await gql<{ publicYardRules: YardRules | null }>(
    `query($yardSlug: String!) { publicYardRules(yardSlug: $yardSlug) {
      yardName requireGovernmentId requireIdPhoto requireSellerPhoto requireVehiclePlate requireSignature requireThumbprint minimumSellerAge
      payoutMethods cashLimitPerTicketCents cashRounding defaultPaymentHoldDays defaultMaterialHoldDays ownershipStatement
      restrictions { label kind materialName materialSlug categoryName forbidCash allowedMethods paymentHoldDays materialHoldDays mailCheckOnly requiredDocuments publicNote }
    } }`,
    { yardSlug },
  );
  return r.ok ? { ok: true, data: r.data.publicYardRules } : r;
});

type RawMaterial = Omit<MaterialLite, 'imageUrl'> & { image: { url: string } | null; category: (MaterialLite['category'] & { image?: { url: string } | null }) | null };

export const getCatalog = cache(async (): Promise<GqlResult<{ categories: Category[]; materials: MaterialLite[] }>> => {
  const r = await gql<{ materialCategories: Array<Omit<Category, 'imageUrl'> & { image: { url: string } | null }>; materials: RawMaterial[] }>(`query {
    materialCategories(orderBy: [{ sortOrder: asc }, { name: asc }]) { id name slug kind sortOrder image { url } }
    materials(where: { isActive: { equals: true } }, orderBy: [{ sortOrder: asc }, { name: asc }]) {
      id name slug specName description defaultUnit direction acceptsFromPublic sortOrder image { url } category { name slug kind sortOrder }
    }
  }`);
  if (!r.ok) return r;
  return {
    ok: true,
    data: {
      categories: r.data.materialCategories.map(({ image, ...c }) => ({ ...c, imageUrl: image?.url || null })),
      materials: r.data.materials.map(({ image, ...m }) => ({ ...m, imageUrl: image?.url || null })),
    },
  };
});

export const getMaterial = cache(async (slug: string): Promise<GqlResult<MaterialDetail | null>> => {
  const r = await gql<{ materials: Array<RawMaterial & { preparationTips: string | null; minimumWeight: string | null; images: unknown }> }>(
    `query($slug: String!) { materials(where: { slug: { equals: $slug } }, take: 1) {
      id name slug specName description preparationTips minimumWeight images defaultUnit direction acceptsFromPublic sortOrder image { url } category { name slug kind sortOrder }
    } }`,
    { slug },
  );
  if (!r.ok) return r;
  const m = r.data.materials[0];
  if (!m) return { ok: true, data: null };
  const { image, images, ...rest } = m;
  return { ok: true, data: { ...rest, imageUrl: image?.url || null, images: Array.isArray(images) ? images.filter((x): x is string => typeof x === 'string') : [] } };
});

export type PricePoint = { effectiveFrom: string; unitPrice: string; unitPriceHigh: string | null; unit: string };

export const getPriceHistory = cache(async (materialSlug: string, yardSlug: string | null, days = 90): Promise<GqlResult<PricePoint[]>> => {
  const r = await gql<{ publicPriceHistory: PricePoint[] | null }>(
    `query($materialSlug: String!, $yardSlug: String, $days: Int) { publicPriceHistory(materialSlug: $materialSlug, yardSlug: $yardSlug, days: $days) { effectiveFrom unitPrice unitPriceHigh unit } }`,
    { materialSlug, yardSlug, days },
  );
  return r.ok ? { ok: true, data: r.data.publicPriceHistory || [] } : r;
});

export const getContainerTypes = cache(async (): Promise<GqlResult<ContainerType[]>> => {
  const r = await gql<{ containerTypes: Array<Omit<ContainerType, 'imageUrl'> & { image: { url: string } | null }> }>(`query {
    containerTypes(orderBy: [{ name: asc }]) { id name slug kind capacityLabel dimensions description suitableFor image { url } deliveryFeeCents haulFeeCents rentalFeePerDayCents freeRentalDays dryRunFeeCents }
  }`);
  if (!r.ok) return r;
  return { ok: true, data: r.data.containerTypes.map(({ image, ...c }) => ({ ...c, imageUrl: image?.url || null })) };
});

export type Receipt = {
  displayNumber: string;
  status: string;
  completedAt: string | null;
  yard: { name: string; timezone: string | null; phone: string | null } | null;
  sellerName: string | null;
  maskedIdNumber: string | null;
  vehiclePlate: string | null;
  currencyCode: string;
  weightUnit: 'lb' | 'kg';
  lines: TicketLineView[];
  fees: Array<{ label: string; amountCents: number }>;
  materialTotalCents: number;
  feeTotalCents: number;
  taxCents: number;
  totalCents: number;
  payouts: PayoutView[];
  holdTags: HoldView[];
  lookupCode: string | null;
};

export type TicketLineView = {
  id?: string;
  materialName: string;
  direction: string;
  grossWeight: string | null;
  tareWeight: string | null;
  netWeight: string | null;
  deductionWeight: string | null;
  deductionPercent: string | null;
  deductionReason: string | null;
  payWeight: string | null;
  quantity: number | null;
  unit: string;
  unitPrice: string | null;
  amountCents: number;
};

export type PayoutView = { id?: string; amountCents: number; status: string; method: string | null; allowedMethods: string[] | null; checkNumber: string | null; releaseAt: string | null; paidAt: string | null };
export type HoldView = { materialName: string | null; weight: string | null; status: string; releaseAt: string | null };

/** Fields of the backend TicketReceipt type, shared by lookupTicketReceipt and myTicket. */
export const RECEIPT_FIELDS = `id displayNumber direction status yardName yardAddress sellerName accountName vehiclePlate completedAt createdAt businessName weightUnit paymentMode donatePercent
  lines { id materialName grossWeight tareWeight netWeight deductionWeight deductionPercent deductionReason payWeight quantity unit unitPrice amountCents direction }
  fees { label amountCents } materialTotalCents feeTotalCents taxCents totalCents
  payouts { id amountCents status method allowedMethods releaseAt checkNumber paidAt returnReason }
  holds { id status releaseAt weight } adjustments { id displayNumber status totalCents } adjustsDisplayNumber photoIds`;

export type RawReceipt = {
  id: string; displayNumber: string; status: string; yardName: string; yardAddress: string | null; sellerName: string | null; vehiclePlate: string | null;
  completedAt: string | null; createdAt: string | null; weightUnit: string; lines: TicketLineView[]; fees: Array<{ label: string; amountCents: number }>;
  materialTotalCents: number; feeTotalCents: number; taxCents: number; totalCents: number; payouts: PayoutView[];
  holds: Array<{ id: string; status: string; releaseAt: string | null; weight: string }>; adjustments: Array<{ id: string; displayNumber: string }>; adjustsDisplayNumber: string | null;
};

/** Shape a backend receipt for ReceiptView; the zone and currency come from the business settings. */
export async function toReceipt(raw: RawReceipt, lookupCode: string | null = null): Promise<Receipt & { id: string }> {
  const b = await getBusiness();
  const biz = businessOrDefaults(b.ok ? b.data : null);
  const yards = await getYards();
  const yard = yards.ok ? yards.data.find((y) => y.name === raw.yardName) : undefined;
  return {
    id: raw.id, displayNumber: raw.displayNumber, status: raw.status, completedAt: raw.completedAt,
    yard: { name: raw.yardName, timezone: yard?.timezone || biz.timezone, phone: yard?.phone || null },
    sellerName: raw.sellerName, maskedIdNumber: null, vehiclePlate: raw.vehiclePlate, currencyCode: biz.currencyCode,
    weightUnit: (raw.weightUnit || biz.weightUnit) as 'lb' | 'kg', lines: raw.lines, fees: raw.fees,
    materialTotalCents: raw.materialTotalCents, feeTotalCents: raw.feeTotalCents, taxCents: raw.taxCents, totalCents: raw.totalCents,
    payouts: raw.payouts, holdTags: raw.holds.map((h) => ({ materialName: null, weight: h.weight, status: h.status, releaseAt: h.releaseAt })), lookupCode,
  };
}

export async function lookupReceipt(displayNumber: string, lookupCode: string): Promise<GqlResult<Receipt | null>> {
  const r = await gql<{ lookupTicketReceipt: RawReceipt | null }>(
    `query($displayNumber: String!, $lookupCode: String!) { lookupTicketReceipt(displayNumber: $displayNumber, lookupCode: $lookupCode) { ${RECEIPT_FIELDS} } }`,
    { displayNumber, lookupCode },
  );
  if (!r.ok) return r.notFound ? { ok: true, data: null } : r;
  return { ok: true, data: r.data.lookupTicketReceipt ? await toReceipt(r.data.lookupTicketReceipt, lookupCode.toUpperCase()) : null };
}

/** Default business settings when publicBusiness cannot be reached: never a name, only units. */
export function businessOrDefaults(b: Business | null | undefined) {
  return {
    name: b?.name || null,
    weightUnit: (b?.weightUnit || 'lb') as 'lb' | 'kg',
    currencyCode: b?.currencyCode || 'USD',
    timezone: b?.timezone || 'America/New_York',
  };
}
