import { CompanyStatementsPage } from '@/features/storefront/screens/company/CompanyPages';
export const metadata = { title: 'Statements' };
export default async function Page({ params }: { params: Promise<{ accountSlug: string }> }) {
  const { accountSlug } = await params;
  return <CompanyStatementsPage slug={accountSlug} />;
}
