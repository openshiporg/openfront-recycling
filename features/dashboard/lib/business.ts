import { cache } from 'react';
import { keystoneClient } from './keystoneClient';

export const FALLBACK_BUSINESS_NAME = 'Openfront Recycling';
export type DashboardBusiness = { name: string; logoUrl: string | null };

/** The business name and logo set at onboarding, for the dashboard brand and page titles. */
export const getDashboardBusiness = cache(async (): Promise<DashboardBusiness> => {
  const r = await keystoneClient<{ publicBusiness: { name: string | null; logoUrl: string | null } | null }>(`query DashboardBusiness { publicBusiness { name logoUrl } }`);
  const b = r.success ? r.data?.publicBusiness : null;
  return { name: b?.name?.trim() || FALLBACK_BUSINESS_NAME, logoUrl: b?.logoUrl || null };
});
