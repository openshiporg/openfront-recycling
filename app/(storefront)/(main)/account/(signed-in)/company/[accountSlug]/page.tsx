import { CompanyHomePage } from '@/features/storefront/screens/company/CompanyPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
export const metadata = { title: 'Company account' };
export default async function Page({ params, searchParams }: { params: Promise<{ accountSlug: string }>; searchParams: SP }) {
  const [{ accountSlug }, sp] = await Promise.all([params, searchParams]);
  return <CompanyHomePage slug={accountSlug} joined={sp.joined !== undefined} />;
}
