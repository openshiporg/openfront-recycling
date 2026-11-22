import { getDiversionReport } from './company';
import { getYearSummary } from './seller';

export const cell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // never let a spreadsheet run a formula
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** C11 CSV download: same rows as the report page. */
export async function diversionCsv(accountSlug: string, yearParam: string | null) {
  const y = Number(yearParam);
  const year = Number.isInteger(y) && y > 2000 ? y : new Date().getUTCFullYear();
  const r = await getDiversionReport(accountSlug, year);
  if (!r.ok) return new Response('Could not load the report.', { status: 502 });
  const { rows, weightUnit } = r.data;
  const lines = [['Month', 'Category', 'Material', `Weight (${weightUnit})`, 'Value'].map(cell).join(',')];
  for (const x of rows) lines.push([x.month, x.categoryName || '', x.materialName, x.weight, (x.valueCents / 100).toFixed(2)].map(cell).join(','));
  return new Response(lines.join('\n') + '\n', {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="diversion-${accountSlug}-${year}.csv"`, 'cache-control': 'private, no-store' },
  });
}

/** S15 yearly statement CSV for the signed-in seller. */
export async function yearStatementCsv(yearParam: string | null) {
  const y = Number(yearParam);
  const year = Number.isInteger(y) && y > 2000 ? y : new Date().getUTCFullYear();
  const r = await getYearSummary(year);
  if (!r.ok) return new Response('Could not load the statement.', { status: 502 });
  const s = r.data;
  const lines = [['Material', 'Unit', `Weight (${s.weightUnit})`, 'Quantity', `Amount (${s.currencyCode})`].map(cell).join(',')];
  for (const m of s.materials) lines.push([m.materialName, m.unit, m.unit === 'each' ? '' : m.weight, m.quantity || '', (m.amountCents / 100).toFixed(2)].map(cell).join(','));
  lines.push(['Total', '', s.totalWeight, '', (s.totalCents / 100).toFixed(2)].map(cell).join(','));
  return new Response(lines.join('\n') + '\n', {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="statement-${year}.csv"`, 'cache-control': 'private, no-store' },
  });
}
