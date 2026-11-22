import Link from 'next/link';
import { getPriceBoard, getPublicYards } from '../lib/data/public';
import { dateTime, perUnit, zoneName } from '../lib/format';
import { LoadError, PageHead, StateCard } from '../components/ui';
import { priceText } from './PricesPage';

export default async function FeesPage({ yard }: { yard?: string | null }) {
  const [boardR, yardsR] = await Promise.all([getPriceBoard(yard || null), getPublicYards()]);
  const head = <PageHead title="Drop-off fees" crumbs={[{ href: '/', label: 'Home' }, { label: 'Drop-off fees' }]} lead="Some items cost money to recycle safely, such as tires and appliances with refrigerant. The fee is charged at the scale and shown on your ticket." />;
  if (!boardR.ok) return (<>{head}<LoadError what="the fees" /></>);
  const board = boardR.data;
  const fees = (board?.entries || []).filter((e) => e.direction === 'charge_customer');
  const yards = yardsR.ok ? yardsR.data : [];
  return (
    <>
      {head}
      <div className="sf-wrap sf-section sf-stack">
        {yards.length > 1 ? (
          <nav className="sf-yardswitch" aria-label="Choose a yard">
            {yards.map((y) => <Link key={y.id} href={`/fees?yard=${y.slug}`} aria-current={y.slug === board?.yard.slug ? 'true' : undefined}>{y.name}</Link>)}
          </nav>
        ) : null}
        {!board || fees.length === 0 ? (
          <StateCard title="No drop-off fees listed">{board ? `${board.yard.name} does not list any fee items. Call the yard if you are unsure about an item.` : 'Fees are not published yet. Call the yard.'}</StateCard>
        ) : (
          <section className="sf-card">
            <p className="sf-muted" style={{ marginTop: 0 }}>{board.yard.name}, published {dateTime(board.publishedAt, board.yard.timezone)} ({zoneName(board.yard.timezone)}).</p>
            {fees.map((r) => (
              <div className="sf-pricerow" key={r.materialId}>
                <Link href={`/materials/${r.materialSlug}`}>{r.materialName}</Link>
                <span className="sf-priceval"><span className="sf-price sf-price-fee">{priceText(r, board.currencyCode)}</span><span className="sf-unit">{perUnit(r.unit)}</span></span>
              </div>
            ))}
          </section>
        )}
        <p className="sf-small sf-muted">If you sell metal on the same visit, the fee comes off what we pay you. If you only drop off fee items, you pay the fee at the window or online from your account.</p>
      </div>
    </>
  );
}
