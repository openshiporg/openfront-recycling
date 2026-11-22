import { ProfilePage } from '@/features/storefront/screens/account/DetailsPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'My details' };
export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <ProfilePage welcome={one(sp.welcome) === '1'} next={one(sp.next)} />;
}
