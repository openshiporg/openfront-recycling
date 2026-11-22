import MaterialPage from '@/features/storefront/screens/MaterialPage';
import { getMaterial } from '@/features/storefront/lib/data/public';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const r = await getMaterial((await params).slug);
  return { title: r.ok && r.data ? r.data.name : 'Material' };
}
export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: SP }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  return <MaterialPage slug={slug} yard={one(sp.yard)} />;
}
