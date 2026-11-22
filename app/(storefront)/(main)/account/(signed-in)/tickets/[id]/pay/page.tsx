import { TicketPayPage } from '@/features/storefront/screens/account/TicketsPages';
export const metadata = { title: 'Pay a ticket' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <TicketPayPage id={(await params).id} />;
}
