import { CompanyContainersPage } from '@/features/storefront/screens/company/CompanyPages';
export const metadata = { title: 'Containers on site' };
export default async function Page({ params }: { params: Promise<{ accountSlug: string }> }) {
  const { accountSlug } = await params;
  return <CompanyContainersPage slug={accountSlug} />;
}
