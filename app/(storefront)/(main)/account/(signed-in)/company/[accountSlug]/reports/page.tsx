import { CompanyReportsPage } from '@/features/storefront/screens/company/CompanyPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Diversion report' };
export default async function Page({ params, searchParams }: { params: Promise<{ accountSlug: string }>; searchParams: SP }) {
  const [{ accountSlug }, sp] = await Promise.all([params, searchParams]);
  const y = Number(one(sp.year));
  return <CompanyReportsPage slug={accountSlug} year={Number.isInteger(y) && y > 2000 ? y : new Date().getUTCFullYear()} />;
}
