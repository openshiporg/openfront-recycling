import PricesPage from '@/features/storefront/screens/PricesPage';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Today’s prices' };
export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <PricesPage yard={one(sp.yard)} />;
}
