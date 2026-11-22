import FeesPage from '@/features/storefront/screens/FeesPage';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Drop-off fees' };
export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <FeesPage yard={one(sp.yard)} />;
}
