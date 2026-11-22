import { CompanyJoinPage } from '@/features/storefront/screens/company/JoinPage';
type SP = Promise<Record<string, string | string[] | undefined>>;
export const metadata = { title: 'Join a company account', robots: { index: false } };
export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const t = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  return <CompanyJoinPage token={t || null} />;
}
