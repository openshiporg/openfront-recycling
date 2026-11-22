import { CompanyDonationsPage } from '@/features/storefront/screens/company/BuyerPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Donations' };
export default async function Page({ params, searchParams }: { params: Promise<{ accountSlug: string }>; searchParams: SP }) {
  const [{ accountSlug }, sp] = await Promise.all([params, searchParams]);
  const p = Number(one(sp.page));
  return <CompanyDonationsPage slug={accountSlug} campaignId={one(sp.campaign)} page={Number.isInteger(p) && p > 0 ? p : 1} />;
}
