import Link from 'next/link';
import { getBusiness, getPriceBoard, getPublicYards, type PriceRow } from '../lib/data/public';
import { dateTime, perUnit, unitPriceText, zoneName } from '../lib/format';
import { LoadError, NotOpenYet, PageHead, StateCard } from '../components/ui';

export function groupByCategory(entries: PriceRow[]) {
  const groups = new Map<string, { name: string; slug: string | null; sort: number; rows: PriceRow[] }>();
  for (const e of entries) {
    const key = e.categorySlug || e.categoryName || 'other';
    if (!groups.has(key)) groups.set(key, { name: e.categoryName || 'Other', slug: e.categorySlug, sort: e.categorySortOrder ?? 999, rows: [] });
    groups.get(key)!.rows.push(e);
  }
  return [...groups.values()].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
}

export function priceText(r: PriceRow, currency: string) {
  return `${unitPriceText(r.unitPrice, currency)}${r.unitPriceHigh && r.unitPriceHigh !== r.unitPrice ? ` – ${unitPriceText(r.unitPriceHigh, currency)}` : ''}`;
}

export default async function PricesPage({ yard }: { yard?: string | null }) {
  const [boardR, yardsR, businessR] = await Promise.all([getPriceBoard(yard || null), getPublicYards(), getBusiness()]);
  const yards = yardsR.ok ? yardsR.data : [];
  if (!boardR.ok) return (<><PageHead title="Today’s prices" /><LoadError what="today’s prices" /></>);
  const board = boardR.data;
  if (!board) {
    if (yards.length === 0 && !(businessR.ok && businessR.data)) return <NotOpenYet />;
    return (
      <>
        <PageHead title="Today’s prices" />
        <StateCard title={yard ? 'We don’t know that yard' : 'Prices are not published yet'} action={<Link className="sf-btn sf-btn-sm" href="/locations">See our locations</Link>}>
          {yard ? 'Pick a yard from our locations to see its prices.' : 'The yard has not published a price board yet. Call the yard for today’s prices.'}
        </StateCard>
      </>
    );
  }
  const currency = board.currencyCode;
  const tz = board.yard.timezone;
  const buy = board.entries.filter((e) => e.direction !== 'charge_customer');
  const fees = board.entries.filter((e) => e.direction === 'charge_customer');
  const groups = groupByCategory(buy);

  return (
    <>
      <PageHead
        title="Today’s prices"
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Prices' }]}
        lead={
          <>
            {board.yard.name}. {board.publishedAt ? <>Last published {dateTime(board.publishedAt, tz)} ({zoneName(tz)}).</> : 'Not published yet.'} The price on this page is the price the scale pays.
          </>
        }
      />
      <div className="sf-wrap sf-section sf-stack">
        <div className="sf-between sf-noprint">
          {yards.length > 1 ? (
            <nav className="sf-yardswitch" aria-label="Choose a yard">
              {yards.map((y) => (
                <Link key={y.id} href={`/prices?yard=${y.slug}`} aria-current={y.slug === board.yard.slug ? 'true' : undefined}>{y.name}</Link>
              ))}
            </nav>
          ) : <span />}
          <div className="sf-cluster">
            <Link className="sf-btn sf-btn-ghost sf-btn-sm" href={`/prices/print?yard=${board.yard.slug}`}>Printable sheet</Link>
            <Link className="sf-btn sf-btn-ghost sf-btn-sm" href={`/calculator?yard=${board.yard.slug}`}>Estimate a load</Link>
          </div>
        </div>

        {groups.length === 0 ? (
          <StateCard title="No prices on the board">This yard has not posted any buying prices yet. Call the yard for a quote.</StateCard>
        ) : (
          <div className="sf-grid sf-grid-2">
            {groups.map((g) => (
              <section key={g.name} className="sf-card sf-pricecat" style={{ marginTop: 0 }} aria-labelledby={`cat-${g.slug || g.name}`}>
                <h2 id={`cat-${g.slug || g.name}`}>{g.name}</h2>
                {g.rows.map((r) => (
                  <div className="sf-pricerow" key={r.materialId}>
                    <Link href={`/materials/${r.materialSlug}?yard=${board.yard.slug}`}>{r.materialName}</Link>
                    <span className="sf-priceval">
                      <span className="sf-price">{priceText(r, currency)}</span>
                      <span className="sf-unit">{perUnit(r.unit)}</span>
                    </span>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}

        {fees.length ? (
          <p className="sf-note">This yard also charges a fee for some items, such as {fees.slice(0, 3).map((f) => f.materialName.toLowerCase()).join(', ')}. <Link className="sf-link" href={`/fees?yard=${board.yard.slug}`}>See drop-off fees</Link>.</p>
        ) : null}
        <p className="sf-muted sf-small">Prices are for clean, sorted material. Dirt, attachments and moisture are deducted at the scale and each deduction is written on your ticket. <Link className="sf-link" href={`/rules?yard=${board.yard.slug}`}>Selling rules for this yard</Link>.</p>
      </div>
    </>
  );
}
