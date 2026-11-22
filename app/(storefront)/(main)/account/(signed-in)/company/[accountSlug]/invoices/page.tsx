import { CompanyInvoicesPage } from '@/features/storefront/screens/company/CompanyPages';
export const metadata = { title: 'Invoices' };
export default async function Page({ params }: { params: Promise<{ accountSlug: string }> }) {
  const { accountSlug } = await params;
  return <CompanyInvoicesPage slug={accountSlug} />;
}
