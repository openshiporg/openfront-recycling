import { cache } from 'react';
import { gql, type GqlResult } from './client';
import { RECEIPT_FIELDS, toReceipt, type PayoutView, type RawReceipt, type Receipt } from './public';

/**
 * Signed-in seller data (matrix §8.2). Every call is a custom operation that proves the seller belongs
 * to the session user before it reads anything (dissertation §7.3).
 */

export type Viewer = { id: string; name: string; email: string; isStaff: boolean };

export const getViewer = cache(async (): Promise<GqlResult<Viewer | null>> => {
  const r = await gql<{ authenticatedItem: { id: string; name: string; email: string; role: { canAccessDashboard: boolean | null } | null } | null }>(
    `query { authenticatedItem { ... on User { id name email role { canAccessDashboard } } } }`,
  );
  if (!r.ok) return r;
  const u = r.data.authenticatedItem;
  return { ok: true, data: u ? { id: u.id, name: u.name, email: u.email, isStaff: Boolean(u.role?.canAccessDashboard) } : null };
});

export type SellerProfile = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  idVerification: string;
  preferredPayout: string | null;
  phone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
};

export type VisitView = {
  id: string;
  code: string;
  status: string;
  plannedDate: string;
  expiresAt: string | null;
  donatePercent: number | null;
  yard: { name: string; slug: string; timezone: string | null; addressLine1?: string | null; city?: string | null; phone?: string | null } | null;
  vehicle: { plate: string | null; make: string | null; model: string | null } | null;
  expectedItems: Array<{ materialId?: string; materialName?: string; estimatedWeight?: string | number | null }> | null;
};

export type Overview = {
  seller: SellerProfile | null;
  lifetimeWeight: string | null;
  lifetimePaidCents: number;
  pendingCents: number;
  heldCents: number;
  identityOnFile: boolean;
  vehicleCount: number;
  nextVisit: VisitView | null;
  currencyCode: string;
  weightUnit: 'lb' | 'kg';
};

const SELLER_FIELDS = `id firstName lastName status idVerification preferredPayout phone email dateOfBirth addressLine1 addressLine2 city region postalCode`;
const VISIT_FIELDS = `id code status plannedDate expiresAt donatePercent yard { name slug timezone addressLine1 city phone } vehicle { plate make model } expectedItems`;

export const getOverview = cache(async (): Promise<GqlResult<Overview | null>> => {
  const r = await gql<{ mySellerOverview: Overview | null }>(`query { mySellerOverview {
    seller { ${SELLER_FIELDS} } lifetimeWeight lifetimePaidCents pendingCents heldCents identityOnFile vehicleCount currencyCode weightUnit
    nextVisit { ${VISIT_FIELDS} }
  } }`);
  return r.ok ? { ok: true, data: r.data.mySellerOverview } : r;
});

export type IdentityStatus = {
  status: string;
  documents: Array<{ id: string; kind: string; issuer: string | null; last4: string | null; expiresOn: string | null; isCurrent: boolean; verified: boolean }>;
};

export const getIdentity = cache(async (): Promise<GqlResult<IdentityStatus | null>> => {
  const r = await gql<{ myIdentityStatus: IdentityStatus | null }>(`query { myIdentityStatus { status documents { id kind issuer last4 expiresOn isCurrent verified } } }`);
  return r.ok ? { ok: true, data: r.data.myIdentityStatus } : r;
});

export type VehicleView = { id: string; plate: string | null; plateRegion: string | null; make: string | null; model: string | null; color: string | null; kind: string };

export const getVehicles = cache(async (): Promise<GqlResult<VehicleView[]>> => {
  const r = await gql<{ myVehicles: VehicleView[] | null }>(`query { myVehicles { id plate plateRegion make model color kind } }`);
  return r.ok ? { ok: true, data: r.data.myVehicles || [] } : r;
});

export const getVisits = cache(async (): Promise<GqlResult<VisitView[]>> => {
  const r = await gql<{ myVisits: VisitView[] | null }>(`query { myVisits { ${VISIT_FIELDS} } }`);
  return r.ok ? { ok: true, data: r.data.myVisits || [] } : r;
});

export const getVisit = cache(async (id: string): Promise<GqlResult<VisitView | null>> => {
  const r = await gql<{ myVisit: VisitView | null }>(`query($id: ID!) { myVisit(id: $id) { ${VISIT_FIELDS} } }`, { id });
  return r.ok ? { ok: true, data: r.data.myVisit } : r;
});

export type TicketSummary = {
  id: string;
  displayNumber: string;
  status: string;
  completedAt: string | null;
  createdAt: string | null;
  totalCents: number;
  payoutStatus: string | null;
  yard: { name: string; timezone: string | null } | null;
};

export type TicketPage = { items: TicketSummary[]; count: number; currencyCode: string };

export async function getTickets(filters: { status?: string | null; from?: string | null; to?: string | null; take?: number; skip?: number }): Promise<GqlResult<TicketPage>> {
  const r = await gql<{ myTickets: TicketPage | null }>(
    `query($status: String, $from: String, $to: String, $take: Int, $skip: Int) { myTickets(status: $status, from: $from, to: $to, take: $take, skip: $skip) {
      count currencyCode items { id displayNumber status completedAt createdAt totalCents payoutStatus yard { name timezone } }
    } }`,
    { status: filters.status || null, from: filters.from || null, to: filters.to || null, take: filters.take ?? 20, skip: filters.skip ?? 0 },
  );
  return r.ok ? { ok: true, data: r.data.myTickets || { items: [], count: 0, currencyCode: 'USD' } } : r;
}

export type TicketDetail = Receipt & {
  id: string;
  attachments: Array<{ kind: string; imageUrl: string | null }>;
  adjustments: Array<{ id: string; displayNumber: string }>;
  adjusts: { id: string; displayNumber: string } | null;
  amountDueCents: number | null;
  invoiceId: string | null;
};

export const getTicket = cache(async (id: string): Promise<GqlResult<TicketDetail | null>> => {
  const r = await gql<{ myTicket: (RawReceipt & { lookupCode?: string | null; amountDueCents?: number | null; invoiceId?: string | null; adjustsId?: string | null }) | null }>(
    `query($id: ID!) { myTicket(id: $id) { ${RECEIPT_FIELDS} } }`,
    { id },
  );
  if (!r.ok) return r.notFound ? { ok: true, data: null } : r;
  const t = r.data.myTicket;
  if (!t) return { ok: true, data: null };
  const base = await toReceipt(t, t.lookupCode || null);
  return {
    ok: true,
    data: {
      ...base,
      attachments: [],
      adjustments: t.adjustments,
      adjusts: t.adjustsDisplayNumber ? { id: t.adjustsId || '', displayNumber: t.adjustsDisplayNumber } : null,
      // Charge tickets (the seller owes a fee) carry the amount still due once the backend exposes it.
      amountDueCents: t.amountDueCents ?? null,
      invoiceId: t.invoiceId ?? null,
    },
  };
});

export type PayoutRow = PayoutView & { id: string; ticket: { id: string; displayNumber: string } | null; yard: { name: string; timezone: string | null } | null };

export const getPayouts = cache(async (): Promise<GqlResult<{ items: PayoutRow[]; currencyCode: string }>> => {
  const r = await gql<{ myPayouts: { items: PayoutRow[]; currencyCode: string } | null }>(`query { myPayouts {
    currencyCode items { id amountCents status method allowedMethods checkNumber releaseAt paidAt ticket { id displayNumber } yard { name timezone } }
  } }`);
  return r.ok ? { ok: true, data: r.data.myPayouts || { items: [], currencyCode: 'USD' } } : r;
});
