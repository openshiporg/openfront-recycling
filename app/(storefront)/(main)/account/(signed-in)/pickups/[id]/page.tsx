import { PickupDetailPage } from '@/features/storefront/screens/PickupPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Pickup' };
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  return <PickupDetailPage id={id} isNew={one(sp.new) === '1'} paid={one(sp.paid) === '1'} />;
}
