import CheckInPage from '@/features/storefront/screens/CheckInPage';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Check in online' };
export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <CheckInPage yard={one(sp.yard)} />;
}
