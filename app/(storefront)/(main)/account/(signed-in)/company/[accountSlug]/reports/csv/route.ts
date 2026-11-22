import { diversionCsv } from '@/features/storefront/lib/data/companyCsv';
export const dynamic = 'force-dynamic';
export async function GET(req: Request, { params }: { params: Promise<{ accountSlug: string }> }) {
  const { accountSlug } = await params;
  return diversionCsv(accountSlug, new URL(req.url).searchParams.get('year'));
}
