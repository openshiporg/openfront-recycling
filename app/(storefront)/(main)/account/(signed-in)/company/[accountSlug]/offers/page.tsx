import { CompanyOffersPage } from '@/features/storefront/screens/company/BuyerPages';
export const metadata = { title: 'Offers' };
export default async function Page({ params }: { params: Promise<{ accountSlug: string }> }) {
  const { accountSlug } = await params;
  return <CompanyOffersPage slug={accountSlug} />;
}
