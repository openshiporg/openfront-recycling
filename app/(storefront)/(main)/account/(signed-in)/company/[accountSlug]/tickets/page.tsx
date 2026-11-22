import { CompanyTicketsPage } from '@/features/storefront/screens/company/CompanyPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Company tickets' };
export default async function Page({ params, searchParams }: { params: Promise<{ accountSlug: string }>; searchParams: SP }) {
  const [{ accountSlug }, sp] = await Promise.all([params, searchParams]);
  return <CompanyTicketsPage slug={accountSlug} siteId={one(sp.site)} from={one(sp.from)} to={one(sp.to)} page={Number(one(sp.page)) || 1} />;
}
