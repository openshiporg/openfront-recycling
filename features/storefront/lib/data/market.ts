import { cache } from 'react';
import { gql, type GqlResult } from './client';

/** P14, B1 to B3: the material market. P15: nonprofits and campaigns. */

export type MarketUnit = { tagNumber: string; form: string; weight: string };
export type MarketListing = {
  id: string; title: string; description: string | null; form: string; materialName: string; materialSlug: string | null; yardName: string | null;
  photos: string[]; availableWeight: string; minimumWeight: string | null; unit: string; terms: string; closesAt: string | null;
  allowOffers: boolean; buyNow: boolean; askUnitPrice: string | null; unitCount: number; units: MarketUnit[]; status?: string | null; canOffer?: boolean | null;
};

const LISTING = `id title description form materialName materialSlug yardName photos availableWeight minimumWeight unit terms closesAt allowOffers buyNow askUnitPrice unitCount units { tagNumber form weight }`;

export const getMarket = cache(async (): Promise<GqlResult<{ visible: boolean; canSeePrices: boolean; listings: MarketListing[] }>> => {
  const r = await gql<{ marketListings: { visible: boolean; canSeePrices: boolean; listings: MarketListing[] } }>(`query { marketListings { visible canSeePrices listings { ${LISTING} } } }`);
  return r.ok ? { ok: true, data: r.data.marketListings } : r;
});

export const getListing = cache(async (id: string): Promise<GqlResult<MarketListing | null>> => {
  const r = await gql<{ marketListing: MarketListing | null }>(`query($id: ID!) { marketListing(id: $id) { ${LISTING} status canOffer } }`, { id });
  if (!r.ok) return r.notFound ? { ok: true, data: null } : r;
  return { ok: true, data: r.data.marketListing };
});

export type Nonprofit = { id: string; name: string; slug: string; legalName: string | null; ein: string | null; summary: string | null; website: string | null; logoId: string | null; campaigns: Array<{ id: string; name: string; slug: string }> };

export const getNonprofits = cache(async (): Promise<GqlResult<Nonprofit[]>> => {
  const r = await gql<{ publicNonprofits: Nonprofit[] }>(`query { publicNonprofits { id name slug legalName ein summary website logoId campaigns { id name slug } } }`);
  return r.ok ? { ok: true, data: r.data.publicNonprofits } : r;
});

export type Campaign = { id: string; name: string; slug: string; description: string | null; status: string; startsOn: string | null; endsOn: string | null; goalWeight: string | null; goalCents: number | null; raisedCents: number; raisedWeight: string; donorCount: number; nonprofitName: string; nonprofitSlug: string; nonprofitEin: string | null };

export const getCampaign = cache(async (slug: string): Promise<GqlResult<Campaign | null>> => {
  const r = await gql<{ publicCampaign: Campaign | null }>(`query($slug: String!) { publicCampaign(slug: $slug) { id name slug description status startsOn endsOn goalWeight goalCents raisedCents raisedWeight donorCount nonprofitName nonprofitSlug nonprofitEin } }`, { slug });
  if (!r.ok) return r.notFound ? { ok: true, data: null } : r;
  return { ok: true, data: r.data.publicCampaign };
});
