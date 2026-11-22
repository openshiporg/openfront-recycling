import { IdentityPage } from '@/features/storefront/screens/account/DetailsPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Photo ID' };
export default async function Page({ searchParams }: { searchParams: SP }) {
  return <IdentityPage next={one((await searchParams).next)} />;
}
