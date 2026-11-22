import { CompanyTicketPage } from '@/features/storefront/screens/company/CompanyPages';
export const metadata = { title: 'Ticket' };
export default async function Page({ params }: { params: Promise<{ accountSlug: string; id: string }> }) {
  const { accountSlug, id } = await params;
  return <CompanyTicketPage slug={accountSlug} id={id} />;
}
