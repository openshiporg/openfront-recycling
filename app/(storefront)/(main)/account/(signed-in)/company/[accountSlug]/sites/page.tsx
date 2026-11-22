import { CompanySitesPage } from '@/features/storefront/screens/company/CompanyPages';
export const metadata = { title: 'Sites' };
export default async function Page({ params }: { params: Promise<{ accountSlug: string }> }) {
  const { accountSlug } = await params;
  return <CompanySitesPage slug={accountSlug} />;
}
