import { cache } from 'react';
import { gql, type GqlResult } from './client';

/**
 * Buyer (B3 to B8) and nonprofit (N1 to N3) reads for the company portal. Every query takes the account slug;
 * the server proves an active contact, answers NOT_FOUND for another company's slug and FORBIDDEN when the
 * account is not a buyer (or not a nonprofit).
 */

type R<T> = Promise<GqlResult<T>>;
function unwrap<K extends string, T>(r: GqlResult<Record<K, T>>, key: K, empty: T): GqlResult<T> {
  if (!r.ok) return r.notFound ? { ok: true, data: empty } : r;
  return { ok: true, data: r.data[key] ?? empty };
}

export type Offer = {
  id: string; status: string; listingId: string | null; listingTitle: string | null; materialName: string | null; yardName: string | null;
  weight: string | null; unit: string; unitPrice: string | null; pickupFrom: string | null; pickupTo: string | null; message: string | null;
  counterUnitPrice: string | null; counterWeight: string | null; counterMessage: string | null; decisionReason: string | null;
  expiresAt: string | null; salesOrderId: string | null; contactName: string | null; createdAt: string; canAcceptCounter: boolean; canWithdraw: boolean;
};

export const getOffers = cache(async (accountSlug: string): R<Offer[]> => {
  const r = await gql<{ accountOffers: Offer[] }>(
    `query($accountSlug: String!) { accountOffers(accountSlug: $accountSlug) { id status listingId listingTitle materialName yardName weight unit unitPrice pickupFrom pickupTo message counterUnitPrice counterWeight counterMessage decisionReason expiresAt salesOrderId contactName createdAt canAcceptCounter canWithdraw } }`,
    { accountSlug },
  );
  return unwrap(r, 'accountOffers', []);
});

export type ShipmentView = {
  id: string; number: number | null; status: string; carrier: string | null; driverName: string | null; truckPlate: string | null; trailerNumber: string | null;
  sealNumber: string | null; bolNumber: string | null; scheduledFor: string | null; shippedWeight: string | null; receivedWeight: string | null; receivedGradeNote: string | null;
  freightCents: number; releasedAt: string | null; deliveredAt: string | null;
  units: Array<{ tagNumber: string; form: string; weight: string | null }>;
  gatePass: { shipmentId: string; bolNumber: string | null; sealNumber: string | null; truckPlate: string | null; releasedAt: string | null } | null;
  invoice: { id: string; number: number | null; status: string; totalCents: number; paidCents: number } | null;
  canClaim: boolean;
};
export type SalesOrder = {
  id: string; number: number | null; status: string; yardName: string | null; buyerReference: string | null; shipTo: string | null; terms: string | null;
  paymentTerms: string; netDays: number | null; weightBasis: string; shipWindowStart: string | null; shipWindowEnd: string | null; cancelReason: string | null;
  createdAt: string; orderedWeight: string; shippedWeight: string; valueCents: number;
  lines: Array<{ id: string; materialName: string; weight: string | null; unit: string; unitPrice: string | null; shippedWeight: string | null; tolerancePercent: string | null }>;
  shipments: ShipmentView[];
};
const ORDER = `id number status yardName buyerReference shipTo terms paymentTerms netDays weightBasis shipWindowStart shipWindowEnd cancelReason createdAt orderedWeight shippedWeight valueCents
  lines { id materialName weight unit unitPrice shippedWeight tolerancePercent }
  shipments { id number status carrier driverName truckPlate trailerNumber sealNumber bolNumber scheduledFor shippedWeight receivedWeight receivedGradeNote freightCents releasedAt deliveredAt
    units { tagNumber form weight } gatePass { shipmentId bolNumber sealNumber truckPlate releasedAt } invoice { id number status totalCents paidCents } canClaim }`;

export const getSalesOrders = cache(async (accountSlug: string): R<SalesOrder[]> => {
  const r = await gql<{ accountSalesOrders: SalesOrder[] }>(`query($accountSlug: String!) { accountSalesOrders(accountSlug: $accountSlug) { ${ORDER} } }`, { accountSlug });
  return unwrap(r, 'accountSalesOrders', []);
});

export const getSalesOrder = cache(async (accountSlug: string, id: string): R<SalesOrder | null> => {
  const r = await gql<{ accountSalesOrder: SalesOrder | null }>(`query($accountSlug: String!, $id: ID!) { accountSalesOrder(accountSlug: $accountSlug, id: $id) { ${ORDER} } }`, { accountSlug, id });
  return unwrap(r, 'accountSalesOrder', null);
});

export type Claim = {
  id: string; status: string; kind: string; description: string; claimedCents: number; creditCents: number; decisionReason: string | null; decidedAt: string | null;
  photoCount: number; shipmentId: string | null; shipmentNumber: number | null; orderId: string | null; orderNumber: number | null; openedByName: string | null;
  createdAt: string; canWithdraw: boolean;
};

export const getClaims = cache(async (accountSlug: string): R<Claim[]> => {
  const r = await gql<{ accountClaims: Claim[] }>(
    `query($accountSlug: String!) { accountClaims(accountSlug: $accountSlug) { id status kind description claimedCents creditCents decisionReason decidedAt photoCount shipmentId shipmentNumber orderId orderNumber openedByName createdAt canWithdraw } }`,
    { accountSlug },
  );
  return unwrap(r, 'accountClaims', []);
});

export type PurchaseReport = { year: number; weightUnit: 'lb' | 'kg'; currencyCode: string; rows: Array<{ month: string; materialName: string; weight: string; valueCents: number }> };

export const getPurchaseReport = cache(async (accountSlug: string, year: number): R<PurchaseReport | null> => {
  const r = await gql<{ accountPurchaseReport: PurchaseReport | null }>(
    `query($accountSlug: String!, $year: Int!) { accountPurchaseReport(accountSlug: $accountSlug, year: $year) { year weightUnit currencyCode rows { month materialName weight valueCents } } }`,
    { accountSlug, year },
  );
  return unwrap(r, 'accountPurchaseReport', null);
});

export type CampaignView = {
  id: string; name: string; slug: string; description: string | null; status: string; isPublic: boolean; startsOn: string | null; endsOn: string | null;
  goalWeight: string | null; goalCents: number | null; raisedCents: number; raisedWeight: string | null; donationCount: number;
};
export type NonprofitView = {
  accountId: string; slug: string; name: string; legalName: string | null; ein: string | null; summary: string | null; website: string | null; logoId: string | null;
  isPublic: boolean; canEdit: boolean; raisedCents: number; awaitingDisbursementCents: number; campaigns: CampaignView[];
};

export const getNonprofit = cache(async (accountSlug: string): R<NonprofitView | null> => {
  const r = await gql<{ accountNonprofit: NonprofitView | null }>(
    `query($accountSlug: String!) { accountNonprofit(accountSlug: $accountSlug) { accountId slug name legalName ein summary website logoId isPublic canEdit raisedCents awaitingDisbursementCents
      campaigns { id name slug description status isPublic startsOn endsOn goalWeight goalCents raisedCents raisedWeight donationCount } } }`,
    { accountSlug },
  );
  return unwrap(r, 'accountNonprofit', null);
});

export type DonationRow = { id: string; date: string | null; kind: string; status: string; amountCents: number; weight: string | null; campaignName: string | null; receiptNumber: string | null; donorName: string | null; disbursed: boolean };

export const getNonprofitDonations = cache(async (accountSlug: string, campaignId: string | null, take: number, skip: number): R<{ count: number; items: DonationRow[] }> => {
  const r = await gql<{ accountDonations: { count: number; items: DonationRow[] } }>(
    `query($accountSlug: String!, $campaignId: ID, $take: Int, $skip: Int) { accountDonations(accountSlug: $accountSlug, campaignId: $campaignId, take: $take, skip: $skip) { count items { id date kind status amountCents weight campaignName receiptNumber donorName disbursed } } }`,
    { accountSlug, campaignId, take, skip },
  );
  return unwrap(r, 'accountDonations', { count: 0, items: [] });
});
