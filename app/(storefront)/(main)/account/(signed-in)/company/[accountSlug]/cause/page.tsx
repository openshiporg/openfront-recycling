import { CompanyCausePage } from '@/features/storefront/screens/company/BuyerPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
export const metadata = { title: 'Our cause' };
export default async function Page({ params, searchParams }: { params: Promise<{ accountSlug: string }>; searchParams: SP }) {
  const [{ accountSlug }, sp] = await Promise.all([params, searchParams]);
  return <CompanyCausePage slug={accountSlug} saved={sp.saved !== undefined} />;
}
