import Link from 'next/link';
import { getBusiness, getCatalog, getPriceBoard, getYardRules, getYards, type PriceRow } from '../lib/data/public';
import { dateTime, methodsText, perUnit, todayStatus, unitPriceText, zoneName } from '../lib/format';
import { IconArrow, IconBolt, IconBuilding, IconCash, IconClock, IconContainer, IconLaptopCheck, IconQr, IconTag, IconTruckScale } from '../components/icons';
import { LoadError, NotOpenYet, Qr } from '../components/ui';

function topPrices(entries: PriceRow[], n = 8) {
  return entries
    .filter((e) => e.direction !== 'charge_customer')
    .slice()
    .sort((a, b) => (a.categorySortOrder ?? 0) - (b.categorySortOrder ?? 0))
    .slice(0, n);
}

export default async function HomePage() {
  const [businessR, yardsR, boardR, catalogR] = await Promise.all([getBusiness(), getYards(), getPriceBoard(null), getCatalog()]);
  if (!businessR.ok && !yardsR.ok) return <LoadError what="the home page" />;
  const business = businessR.ok ? businessR.data : null;
  const yards = yardsR.ok ? yardsR.data : [];
  if (!business && yards.length === 0) return <NotOpenYet />;

  const board = boardR.ok ? boardR.data : null;
  const mainYard = yards.find((y) => y.slug === board?.yard.slug) || yards[0] || null;
  const rulesR = mainYard ? await getYardRules(mainYard.slug) : null;
  const rules = rulesR?.ok ? rulesR.data : null;
  const currency = board?.currencyCode || business?.currencyCode || 'USD';
  const tz = board?.yard.timezone || mainYard?.timezone || business?.timezone || null;
  const materialCount = catalogR.ok ? catalogR.data.materials.filter((m) => m.direction !== 'charge_customer').length : null;
  const today = mainYard ? todayStatus(mainYard.hours, mainYard.timezone, mainYard.closures) : null;
  const rows = board ? topPrices(board.entries) : [];
  const name = business?.name || mainYard?.name || '';
  const payout = rules?.payoutMethods?.length ? rules.payoutMethods : mainYard?.payoutMethods || [];
  const holdDays = rules?.defaultPaymentHoldDays || 0;
  const restrictedHolds = (rules?.restrictions || []).filter((r) => (r.paymentHoldDays || 0) > 0);

  return (
    <>
      {/* 2. Hero */}
      <section className="sf-hero" aria-labelledby="hero-title">
        <div className="sf-hero-block">
          <div className="sf-hero-inner">
            <h1 id="hero-title">Turn your scrap<br />into money</h1>
            <div className="sf-hero-rule" aria-hidden />
            <p className="sf-hero-sub">
              Check today’s prices, check in online, and get paid at {name || 'our yard'}. The price on this site is the price the scale pays.
            </p>
          </div>
        </div>
        <div className="sf-hero-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/storefront/hero.jpg" alt="A crane grapple lifting steel scrap in the yard" />
        </div>
      </section>
      <div className="sf-hero-card-row">
        <div className="sf-wrap">
          <div className="sf-checkin">
            <div className="sf-checkin-icon"><IconLaptopCheck size={72} /></div>
            <div>
              <h2>Check in to<br />sell scrap online</h2>
              <p>Tell us you’re on the way, get your scale pass, and spend less time at the window.</p>
            </div>
            <Link className="sf-btn" href="/sell/check-in">Check in now <IconArrow /></Link>
          </div>
        </div>
      </div>

      {/* 3. Facts from data */}
      <section className="sf-facts" aria-label="At a glance">
        <div className="sf-wrap">
          <div className="sf-facts-row">
            <div className="sf-fact">
              <IconBolt size={40} />
              <div>
                <strong>{today ? (today.closureReason ? 'Closed today' : today.open ? 'Open now' : 'Closed now') : 'Hours'}</strong>
                <span>{today ? (today.closureReason ? today.closureReason : `Today: ${today.text}`) : 'See each location'}</span>
              </div>
            </div>
            <div className="sf-fact">
              <IconTag size={40} />
              <div>
                <strong>{materialCount ? `${materialCount} materials` : 'Materials'}</strong>
                <span>{board?.publishedAt ? `Prices published ${dateTime(board.publishedAt, tz)}` : 'Bought by weight at the scale'}</span>
              </div>
            </div>
            <div className="sf-fact">
              <IconCash size={40} />
              <div>
                <strong>Get paid</strong>
                <span>By {methodsText(payout)}{holdDays > 0 ? `, after ${holdDays} days` : restrictedHolds.length ? '; some items are held' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How it works */}
      <section className="sf-how" aria-labelledby="how-title">
        <div className="sf-wrap sf-how-grid">
          <div>
            <div className="sf-titlebar"><h2 id="how-title">How it works</h2></div>
            <ol className="sf-steps">
              <li className="sf-step"><IconLaptopCheck size={76} /><h3>1. Check in online</h3><p>Add your ID and vehicle once, then tell us the day and what you’re bringing.</p></li>
              <li className="sf-step"><IconQr size={76} /><h3>2. Get your pass</h3><p>You get a scale pass with a short code and a QR code.</p></li>
              <li className="sf-step"><IconTruckScale size={76} /><h3>3. Show it at the scale</h3><p>The operator scans it and your ticket opens with your details filled in.</p></li>
              <li className="sf-step"><IconCash size={76} /><h3>4. Weigh, unload, get paid</h3><p>We weigh and grade each material and pay by {methodsText(payout)}.</p></li>
            </ol>
          </div>
          <div className="sf-phonecol" aria-hidden>
            <div className="sf-pass-phone">
              <div className="sf-phone-screen">
                <div className="sf-brand-name" style={{ fontSize: 20 }}>{name}</div>
                <div className="sf-pass-tag">Scale pass</div>
                <Qr value="/sell/check-in" label="" />
                <small>Check-in code</small>
                <strong>YOUR CODE</strong>
                <small>Show this pass at the scale</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Today's prices (what the image lacks; the product's main selling point) */}
      <section className="sf-today" aria-labelledby="today-title">
        <div className="sf-wrap">
          <div className="sf-card sf-today-card">
            <div>
              {rows.length ? (
                <table className="sf-table">
                  <caption className="sf-skip">Today’s prices at {board?.yard.name}</caption>
                  <thead><tr><th scope="col">Material</th><th scope="col" className="r">We pay</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.materialId}>
                        <td><Link className="sf-link" style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }} href={`/materials/${r.materialSlug}`}>{r.materialName}</Link></td>
                        <td className="r"><span className="sf-price">{unitPriceText(r.unitPrice, currency)}{r.unitPriceHigh ? `–${unitPriceText(r.unitPriceHigh, currency)}` : ''}</span> <span className="sf-muted sf-small">{perUnit(r.unit)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 24 }}>
                  <p className="sf-muted" style={{ margin: 0 }}>{boardR.ok ? 'Prices have not been published yet today. Call the yard for a quote.' : 'Prices could not be loaded just now. Try again in a moment.'}</p>
                </div>
              )}
            </div>
            <div className="sf-today-side">
              <h2 id="today-title">Today’s prices</h2>
              {board?.publishedAt ? <p>Last published {dateTime(board.publishedAt, tz)}{tz ? ` (${zoneName(tz)})` : ''}{yards.length > 1 ? ` at ${board.yard.name}` : ''}.</p> : null}
              <p>The price you see here is the price the scale pays.</p>
              <Link className="sf-btn sf-btn-light" href={board ? `/prices?yard=${board.yard.slug}` : '/prices'}>All prices <IconArrow /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Picture tiles */}
      <section className="sf-wrap" aria-label="Find out more">
        <div className="sf-tiles">
          <Link className="sf-tile" href="/prices">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/storefront/copper.jpg" alt="" />
            <span className="sf-tile-label"><strong>Current scrap prices</strong><span aria-hidden>→</span></span>
          </Link>
          <Link className="sf-tile" href="/materials">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/storefront/steel.jpg" alt="" />
            <span className="sf-tile-label"><strong>Accepted materials</strong><span aria-hidden>→</span></span>
          </Link>
          <Link className="sf-tile" href={yards.length === 1 ? `/locations/${yards[0].slug}` : '/locations'}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/storefront/yard-gate.jpg" alt="" />
            <span className="sf-tile-label"><strong>Hours &amp; location</strong><span aria-hidden>→</span></span>
          </Link>
        </div>
      </section>

      {/* Businesses */}
      <section className="sf-bizband" aria-labelledby="biz-title">
        <div className="sf-wrap sf-bizband-row">
          <div>
            <h2 id="biz-title" className="sf-h2">Containers and commercial accounts</h2>
            <p className="sf-muted" style={{ margin: 0 }}>For contractors, plants and shops: containers on site, contract prices, and statements online.</p>
          </div>
          <Link className="sf-bizlink" href="/containers"><IconContainer size={40} /><div><strong>Containers</strong><span>Roll-offs and boxes, sizes and fees</span></div></Link>
          <Link className="sf-bizlink" href="/commercial"><IconBuilding size={40} /><div><strong>Commercial</strong><span>Open an account for your business</span></div></Link>
        </div>
      </section>

      <section className="sf-wrap" aria-label="Quick links" style={{ paddingTop: 24 }}>
        <div className="sf-cluster sf-small">
          <IconClock size={18} />
          <Link className="sf-link" href="/calculator">Estimate your load</Link>
          <Link className="sf-link" href="/rules">What to bring</Link>
          <Link className="sf-link" href="/fees">Drop-off fees</Link>
          <Link className="sf-link" href="/track">Find a receipt</Link>
        </div>
      </section>
    </>
  );
}
