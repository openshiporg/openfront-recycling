import { VehiclesPage } from '@/features/storefront/screens/account/DetailsPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Vehicles' };
export default async function Page({ searchParams }: { searchParams: SP }) {
  return <VehiclesPage next={one((await searchParams).next)} />;
}
