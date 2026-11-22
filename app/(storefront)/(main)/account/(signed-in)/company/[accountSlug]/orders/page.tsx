import { CompanyOrdersPage } from '@/features/storefront/screens/company/BuyerPages';
export const metadata = { title: 'Orders' };
export default async function Page({ params }: { params: Promise<{ accountSlug: string }> }) {
  const { accountSlug } = await params;
  return <CompanyOrdersPage slug={accountSlug} />;
}
