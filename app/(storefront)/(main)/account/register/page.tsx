import { RegisterPage } from '@/features/storefront/screens/AuthPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Create an account' };
export default async function Page({ searchParams }: { searchParams: SP }) {
  return <RegisterPage next={one((await searchParams).next)} />;
}
