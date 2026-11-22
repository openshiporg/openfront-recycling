import { CompanyInvoicePage } from '@/features/storefront/screens/company/CompanyPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Invoice' };
export default async function Page({ params, searchParams }: { params: Promise<{ accountSlug: string; id: string }>; searchParams: SP }) {
  const [{ accountSlug, id }, sp] = await Promise.all([params, searchParams]);
  return <CompanyInvoicePage slug={accountSlug} id={id} paid={one(sp.paid) === '1'} />;
}
