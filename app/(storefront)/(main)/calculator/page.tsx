import CalculatorPage from '@/features/storefront/screens/CalculatorPage';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Scrap calculator' };
export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <CalculatorPage yard={one(sp.yard)} />;
}
