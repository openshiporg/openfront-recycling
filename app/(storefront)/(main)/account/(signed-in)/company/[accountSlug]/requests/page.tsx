import { CompanyRequestsPage } from '@/features/storefront/screens/company/CompanyPages';
export const metadata = { title: 'Service requests' };
export default async function Page({ params }: { params: Promise<{ accountSlug: string }> }) {
  const { accountSlug } = await params;
  return <CompanyRequestsPage slug={accountSlug} />;
}
