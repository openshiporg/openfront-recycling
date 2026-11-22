import { yearStatementCsv } from '@/features/storefront/lib/data/companyCsv';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  return yearStatementCsv(new URL(req.url).searchParams.get('year'));
}
