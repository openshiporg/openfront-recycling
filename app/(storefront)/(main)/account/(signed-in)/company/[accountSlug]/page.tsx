import { CompanyHomePage } from '@/features/storefront/screens/company/CompanyPages';
export const metadata = { title: 'Company account' };
export default async function Page({ params }: { params: Promise<{ accountSlug: string }> }) {
  const { accountSlug } = await params;
  return <CompanyHomePage slug={accountSlug} />;
}
