import { ContainerPage } from '@/features/storefront/screens/ContainersPage';
import { getContainerTypes } from '@/features/storefront/lib/data/public';
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, r] = await Promise.all([params, getContainerTypes()]);
  return { title: (r.ok && r.data.find((c) => c.slug === slug)?.name) || 'Container' };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <ContainerPage slug={(await params).slug} />;
}
