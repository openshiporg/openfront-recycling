import { TicketPage } from '@/features/storefront/screens/account/TicketsPages';
export const metadata = { title: 'Ticket' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <TicketPage id={(await params).id} />;
}
