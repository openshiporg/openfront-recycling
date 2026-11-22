import { CompanyPricesPage } from '@/features/storefront/screens/company/CompanyPages';
export const metadata = { title: 'Contract prices' };
export default async function Page({ params }: { params: Promise<{ accountSlug: string }> }) {
  const { accountSlug } = await params;
  return <CompanyPricesPage slug={accountSlug} />;
}
