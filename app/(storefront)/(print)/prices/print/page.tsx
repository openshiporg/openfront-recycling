import PriceSheetPage from '@/features/storefront/screens/PriceSheetPage';
type SP = Promise<Record<string, string | string[] | undefined>>;
export const metadata = { title: 'Price sheet' };
export default async function Page({ searchParams }: { searchParams: SP }) {
  const y = (await searchParams).yard;
  return <PriceSheetPage yard={(Array.isArray(y) ? y[0] : y) || null} />;
}
