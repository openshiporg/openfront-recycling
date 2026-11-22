import Link from 'next/link';
import { getMaterial, getPriceBoard, getPriceHistory, getYardRules, getYards, type PricePoint } from '../lib/data/public';
import { dateTime, label, list, methodsText, perUnit, shortDate, unitPriceText, weight, zoneName } from '../lib/format';
import { LoadError, PageHead, StateCard } from '../components/ui';
import { priceText } from './PricesPage';

function HistoryChart({ points, currency, tz }: { points: PricePoint[]; currency: string; tz: string | null }) {
  if (points.length < 2) return <p className="sf-muted">Not enough price changes in the last 90 days to draw a chart.</p>;
  const sorted = [...points].sort((a, b) => +new Date(a.effectiveFrom) - +new Date(b.effectiveFrom));
  const values = sorted.map((p) => Number(p.unitPrice));
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || max * 0.1 || 1;
  const W = 640, H = 200, P = 34;
  const t0 = +new Date(sorted[0].effectiveFrom);
  const t1 = Date.now();
  const x = (t: number) => P + ((t - t0) / Math.max(1, t1 - t0)) * (W - P * 2);
  const y = (v: number) => H - P - ((v - (min - span * 0.1)) / (span * 1.2)) * (H - P * 2);
  // A step line: a price holds until the next one is published.
  let d = '';
  sorted.forEach((p, i) => {
    const px = x(+new Date(p.effectiveFrom)), py = y(Number(p.unitPrice));
    d += i === 0 ? `M${px} ${py}` : `H${px}V${py}`;
  });
  d += `H${x(t1)}`;
  const last = sorted[sorted.length - 1];
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Price over the last 90 days, from ${unitPriceText(sorted[0].unitPrice, currency)} to ${unitPriceText(last.unitPrice, currency)}`}>
        <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="var(--sf-rule)" strokeWidth="2" />
        <path d={d} fill="none" stroke="var(--sf-rust)" strokeWidth="3" />
        <text x={P} y={H - 10} fontSize="12" fill="var(--sf-ink-muted)">{shortDate(sorted[0].effectiveFrom, tz)}</text>
        <text x={W - P} y={H - 10} fontSize="12" fill="var(--sf-ink-muted)" textAnchor="end">Today</text>
        <text x={P} y={y(max) - 8} fontSize="12" fill="var(--sf-ink-muted)">{unitPriceText(max, currency)}</text>
        <text x={P} y={y(min) + 18} fontSize="12" fill="var(--sf-ink-muted)">{unitPriceText(min, currency)}</text>
      </svg>
      <figcaption className="sf-small sf-muted">{sorted.length} price changes in the last 90 days.</figcaption>
    </figure>
  );
}

export default async function MaterialPage({ slug, yard }: { slug: string; yard?: string | null }) {
  const [matR, yardsR] = await Promise.all([getMaterial(slug), getYards()]);
  if (!matR.ok) return (<><PageHead title="Material" /><LoadError what="this material" /></>);
  const m = matR.data;
  if (!m) return (<><PageHead title="Not found" /><StateCard title="We don’t list that material" action={<Link className="sf-btn sf-btn-sm" href="/materials">All materials</Link>}>It may have been renamed. Search the materials list, or call the yard.</StateCard></>);
  const yards = yardsR.ok ? yardsR.data : [];
  const boardR = await getPriceBoard(yard || null);
  const board = boardR.ok ? boardR.data : null;
  const yardSlug = board?.yard.slug || yards[0]?.slug || null;
  const [historyR, rulesR] = await Promise.all([getPriceHistory(m.slug, yardSlug, 90), yardSlug ? getYardRules(yardSlug) : Promise.resolve(null)]);
  const entry = board?.entries.find((e) => e.materialId === m.id) || null;
  const rules = rulesR && rulesR.ok ? rulesR.data : null;
  const restrictions = (rules?.restrictions || []).filter((r) => r.materialSlug === m.slug || (!r.materialSlug && r.categoryName && r.categoryName === m.category?.name));
  const tz = board?.yard.timezone || null;
  const currency = board?.currencyCode || 'USD';
  const images = [m.imageUrl, ...m.images].filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i);
  const fee = m.direction === 'charge_customer';

  return (
    <>
      <PageHead title={m.name} crumbs={[{ href: '/', label: 'Home' }, { href: '/materials', label: 'Materials' }, { label: m.name }]} lead={m.specName ? `Grade: ${m.specName}` : m.category?.name || undefined} />
      <div className="sf-wrap sf-section">
        <div className="sf-grid sf-split">
          <div className="sf-stack">
            {images.length ? (
              <div className="sf-grid sf-grid-2">
                {images.slice(0, 4).map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt={i === 0 ? m.name : ''} style={{ width: '100%', aspectRatio: '3/2', objectFit: 'cover', borderRadius: 'var(--sf-radius-tile)' }} />
                ))}
              </div>
            ) : null}
            {m.description ? <div className="sf-card sf-card-flat"><h2 className="sf-h3">About this material</h2><p style={{ whiteSpace: 'pre-line', marginBottom: 0 }}>{m.description}</p></div> : null}
            <div className="sf-card sf-card-flat">
              <h2 className="sf-h3">How to prepare it</h2>
              <p style={{ whiteSpace: 'pre-line', marginBottom: 0 }}>{m.preparationTips || 'Keep it separate from other materials and remove anything that isn’t this material. Anything left on is deducted at the scale and written on your ticket.'}</p>
            </div>
            <div className="sf-card sf-card-flat">
              <h2 className="sf-h3">Price over 90 days{board ? ` at ${board.yard.name}` : ''}</h2>
              {historyR.ok ? <HistoryChart points={historyR.data} currency={currency} tz={tz} /> : <p className="sf-muted">The price history could not be loaded just now.</p>}
            </div>
          </div>
          <aside className="sf-stack">
            <div className="sf-card">
              <span className="sf-muted sf-small">{fee ? 'Drop-off fee' : 'We pay'}{board ? ` at ${board.yard.name}` : ''}</span>
              {entry && board ? (
                <>
                  <div className={`sf-price${fee ? ' sf-price-fee' : ''}`} style={{ fontSize: 40, lineHeight: 1.1 }}>{priceText(entry, currency)}</div>
                  <div className="sf-muted">{perUnit(entry.unit)}</div>
                  <p className="sf-small sf-muted" style={{ marginBottom: 0 }}>Published {dateTime(board.publishedAt, tz)} ({zoneName(tz)}).</p>
                </>
              ) : <p style={{ margin: '6px 0 0' }}>{board ? 'This yard does not post a price for it. Call for a quote.' : 'Prices are not published yet. Call the yard for a quote.'}</p>}
              {m.minimumWeight && Number(m.minimumWeight) > 0 ? <p className="sf-small" style={{ marginBottom: 0 }}>Minimum load: {weight(m.minimumWeight, board?.weightUnit)}.</p> : null}
              {m.acceptsFromPublic === false ? <p className="sf-note sf-note-warn" style={{ marginBottom: 0 }}>We buy this only from business accounts. <Link className="sf-link" href="/commercial">Open an account</Link>.</p> : null}
              {yards.length > 1 ? (
                <nav className="sf-yardswitch" aria-label="Price at another yard" style={{ marginTop: 14 }}>
                  {yards.map((y) => <Link key={y.id} href={`/materials/${m.slug}?yard=${y.slug}`} aria-current={y.slug === board?.yard.slug ? 'true' : undefined}>{y.name}</Link>)}
                </nav>
              ) : null}
            </div>
            {restrictions.length ? (
              <div className="sf-card sf-note-warn" role="note">
                <h2 className="sf-h3">Before you bring it</h2>
                {restrictions.map((r, i) => (
                  <div key={i} style={{ marginTop: 10 }}>
                    <strong>{label('restriction', r.kind)}</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {r.kind === 'prohibited' ? <li>{rules?.yardName} does not accept this.</li> : null}
                      {r.requiredDocuments?.length ? <li>Bring: {list(r.requiredDocuments.map((d) => label('documents', d).toLowerCase()))}.</li> : null}
                      {r.forbidCash ? <li>Paid by {methodsText((r.allowedMethods || []).filter((x) => x !== 'cash'))}, not cash.</li> : null}
                      {r.mailCheckOnly ? <li>Paid by a check mailed to your address.</li> : null}
                      {r.paymentHoldDays ? <li>Payment is held for {r.paymentHoldDays} days.</li> : null}
                      {r.materialHoldDays ? <li>The yard keeps it for {r.materialHoldDays} days before processing it.</li> : null}
                      {r.publicNote ? <li>{r.publicNote}</li> : null}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
            <Link className="sf-btn" href="/sell/check-in">Check in to sell</Link>
            <Link className="sf-btn sf-btn-ghost" href={`/calculator${yardSlug ? `?yard=${yardSlug}` : ''}`}>Estimate your load</Link>
          </aside>
        </div>
      </div>
    </>
  );
}
