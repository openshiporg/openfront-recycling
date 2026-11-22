import { CampaignPage } from '@/features/storefront/screens/MarketPages';
export const metadata = { title: 'Campaign' };
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CampaignPage slug={slug} />;
}
