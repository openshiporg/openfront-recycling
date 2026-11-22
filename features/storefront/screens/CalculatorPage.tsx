import Link from 'next/link';
import { getPriceBoard, getYards } from '../lib/data/public';
import { dateTime, zoneName } from '../lib/format';
import { LoadError, PageHead, StateCard } from '../components/ui';
import { Calculator } from '../components/Calculator';

export default async function CalculatorPage({ yard }: { yard?: string | null }) {
  const [boardR, yardsR] = await Promise.all([getPriceBoard(yard || null), getYards()]);
  const head = <PageHead title="Scrap calculator" crumbs={[{ href: '/', label: 'Home' }, { label: 'Calculator' }]} lead="Pick a material, enter the weight, and see what today’s price comes to." />;
  if (!boardR.ok) return (<>{head}<LoadError what="today’s prices" /></>);
  const board = boardR.data;
  if (!board || board.entries.length === 0) return (<>{head}<StateCard title="Prices are not published yet">The calculator uses today’s prices. Call the yard for a quote.</StateCard></>);
  const yards = yardsR.ok ? yardsR.data : [];
  const rows = board.entries.map((e) => ({ id: e.materialId, name: e.materialName, category: e.categoryName || 'Other', unit: e.unit, unitPrice: e.unitPrice, direction: e.direction }));
  return (
    <>
      {head}
      <div className="sf-wrap sf-section sf-stack">
        <div className="sf-between">
          <p style={{ margin: 0 }}>Using <strong>{board.yard.name}</strong> prices published {dateTime(board.publishedAt, board.yard.timezone)} ({zoneName(board.yard.timezone)}).</p>
          {yards.length > 1 ? (
            <nav className="sf-yardswitch" aria-label="Choose a yard">
              {yards.map((y) => <Link key={y.id} href={`/calculator?yard=${y.slug}`} aria-current={y.slug === board.yard.slug ? 'true' : undefined}>{y.name}</Link>)}
            </nav>
          ) : null}
        </div>
        {/* key resets the rows when the yard changes */}
        <Calculator key={board.yard.slug} rows={rows} currency={board.currencyCode} weightUnit={board.weightUnit} />
        <p className="sf-note">This is an estimate at the lower posted price. The scale weighs your load, and anything that isn’t the material (dirt, plastic, attachments, moisture) is deducted and written on your ticket. Ranged prices depend on grade.</p>
        <div className="sf-cluster"><Link className="sf-btn" href="/sell/check-in">Check in to sell</Link><Link className="sf-link" href={`/prices?yard=${board.yard.slug}`}>See all prices</Link></div>
      </div>
    </>
  );
}
