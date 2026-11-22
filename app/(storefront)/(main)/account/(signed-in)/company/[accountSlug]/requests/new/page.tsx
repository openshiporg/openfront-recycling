import { CompanyNewRequestPage } from '@/features/storefront/screens/company/CompanyPages';
export const metadata = { title: 'Request service' };
export default async function Page({ params }: { params: Promise<{ accountSlug: string }> }) {
  const { accountSlug } = await params;
  return <CompanyNewRequestPage slug={accountSlug} />;
}
