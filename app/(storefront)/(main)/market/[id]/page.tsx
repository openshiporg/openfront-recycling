import { ListingPage } from '@/features/storefront/screens/MarketPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Listing' };
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  return <ListingPage id={id} sent={one(sp.sent)} />;
}
