import { ApplicationsPage } from '@/features/storefront/screens/PickupPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Applications' };
export default async function Page({ searchParams }: { searchParams: SP }) {
  return <ApplicationsPage sent={one((await searchParams).sent) === '1'} />;
}
