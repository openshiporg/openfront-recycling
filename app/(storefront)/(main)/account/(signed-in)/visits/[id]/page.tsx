import { VisitPage } from '@/features/storefront/screens/account/VisitsPages';
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export const metadata = { title: 'Scale pass' };
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  return <VisitPage id={id} isNew={one(sp.new) === '1'} />;
}
