import { DonationReceiptPage } from '@/features/storefront/screens/account/StatementPages';
export const metadata = { title: 'Donation receipt', robots: { index: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <DonationReceiptPage id={(await params).id} />;
}
