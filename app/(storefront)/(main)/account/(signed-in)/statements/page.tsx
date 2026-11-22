import { StatementPage } from '@/features/storefront/screens/account/StatementPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
export const metadata = { title: 'Statements' };
export default async function Page({ searchParams }: { searchParams: SP }) {
  const v = (await searchParams).year;
  const y = Number(Array.isArray(v) ? v[0] : v);
  return <StatementPage year={Number.isInteger(y) && y > 2000 ? y : new Date().getUTCFullYear()} />;
}
