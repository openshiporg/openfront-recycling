import { CompanyOrderPage } from '@/features/storefront/screens/company/BuyerPages';
export const metadata = { title: 'Order' };
export default async function Page({ params }: { params: Promise<{ accountSlug: string; id: string }> }) {
  const { accountSlug, id } = await params;
  return <CompanyOrderPage slug={accountSlug} id={id} />;
}
