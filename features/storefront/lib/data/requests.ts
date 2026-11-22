import { cache } from 'react';
import { gql, type GqlResult } from './client';

/** The signed-in customer's applications (S16) and pickup requests (S14), through the custom my* reads. */

export type ApplicationView = { id: string; kind: string; businessName: string; status: string; decisionReason: string | null; createdAt: string };

export const getApplications = cache(async (): Promise<GqlResult<ApplicationView[]>> => {
  const r = await gql<{ myApplications: ApplicationView[] | null }>(`query { myApplications { id kind businessName status decisionReason createdAt } }`);
  return r.ok ? { ok: true, data: r.data.myApplications || [] } : r;
});

export type RequestView = {
  id: string;
  number: number | null;
  kind: string;
  status: string;
  feeCents: number;
  quoteNote: string | null;
  quoteAcceptedAt: string | null;
  preferredDate: string | null;
  preferredWindow: string | null;
  itemsDescription: string | null;
  accessNotes: string | null;
  createdAt: string;
  yard: { name: string; timezone: string | null; phone: string | null } | null;
  site: { name: string | null; addressLine1: string | null; city: string | null } | null;
  job: { scheduledDate: string | null; status: string; driverNotes: string | null } | null;
};

const REQUEST_FIELDS = `id number kind status feeCents quoteNote quoteAcceptedAt preferredDate preferredWindow itemsDescription accessNotes createdAt
  yard { name timezone phone } site { name addressLine1 city } job { scheduledDate status driverNotes }`;

export const getPickups = cache(async (): Promise<GqlResult<RequestView[]>> => {
  const r = await gql<{ myServiceRequests: RequestView[] | null }>(`query { myServiceRequests { ${REQUEST_FIELDS} } }`);
  return r.ok ? { ok: true, data: r.data.myServiceRequests || [] } : r;
});

export const getPickup = cache(async (id: string): Promise<GqlResult<RequestView | null>> => {
  const r = await gql<{ myServiceRequest: RequestView | null }>(`query($id: ID!) { myServiceRequest(id: $id) { ${REQUEST_FIELDS} } }`, { id });
  if (!r.ok) return r.notFound ? { ok: true, data: null } : r;
  return { ok: true, data: r.data.myServiceRequest };
});
