import { ReceiptPage } from '@/features/storefront/screens/account/TicketsPages';
export const metadata = { title: 'Receipt', robots: { index: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ReceiptPage id={(await params).id} />;
}
