import { ResetPage } from '@/features/storefront/screens/AuthPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Reset your password', robots: { index: false } };
export default async function Page({ searchParams }: { searchParams: SP }) {
  return <ResetPage token={one((await searchParams).token)} />;
}
