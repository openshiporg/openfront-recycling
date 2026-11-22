import { TicketsPage } from '@/features/storefront/screens/account/TicketsPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Tickets' };
export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <TicketsPage status={one(sp.status)} from={one(sp.from)} to={one(sp.to)} page={Number(one(sp.page) || 1)} />;
}
