import { CompanyClaimsPage } from '@/features/storefront/screens/company/BuyerPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
export const metadata = { title: 'Claims' };
export default async function Page({ params, searchParams }: { params: Promise<{ accountSlug: string }>; searchParams: SP }) {
  const [{ accountSlug }, sp] = await Promise.all([params, searchParams]);
  return <CompanyClaimsPage slug={accountSlug} filed={sp.filed !== undefined} />;
}
