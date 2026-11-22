import MaterialsPage from '@/features/storefront/screens/MaterialsPage';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Accepted materials' };
export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <MaterialsPage q={one(sp.q)} category={one(sp.category)} />;
}
