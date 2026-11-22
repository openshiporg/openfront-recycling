import { LocationPage } from '@/features/storefront/screens/LocationsPage';
import { getYard } from '@/features/storefront/lib/data/public';
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const r = await getYard((await params).slug);
  return { title: r.ok && r.data ? r.data.name : 'Location' };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <LocationPage slug={(await params).slug} />;
}
