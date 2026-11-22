import TrackPage from '@/features/storefront/screens/TrackPage';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Find a receipt', robots: { index: false } };
export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <TrackPage number={one(sp.number)} code={one(sp.code)} />;
}
