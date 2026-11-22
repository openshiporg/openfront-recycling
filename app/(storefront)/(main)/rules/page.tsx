import RulesPage from '@/features/storefront/screens/RulesPage';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Selling rules' };
export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <RulesPage yard={one(sp.yard)} />;
}
