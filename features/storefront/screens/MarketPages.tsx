import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { getListing, getMarket, getCampaign, getNonprofits, type MarketListing } from '../lib/data/market';
import { getMyAccounts } from '../lib/data/company';
import { getBusiness, businessOrDefaults } from '../lib/data/public';
import { label, money, perUnit, shortDate, unitPriceText, weight } from '../lib/format';
import { LoadError, PageHead, StateCard } from '../components/ui';
import { OfferForm } from '../components/forms/OfferForm';

function ListingFacts({ l, unitLabel, cur }: { l: MarketListing; unitLabel: 'lb' | 'kg'; cur: string }) {
  return (
    <dl className="sf-grid sf-grid-2" style={{ margin: 0, gap: 10 }}>
      <div><dt className="sf-small sf-muted">Available</dt><dd style={{ margin: 0 }} className="sf-num">{weight(l.availableWeight, unitLabel)}{l.unitCount ? ` in ${l.unitCount} ${l.unitCount === 1 ? 'unit' : 'units'}` : ''}</dd></div>
      <div><dt className="sf-small sf-muted">Asking</dt><dd style={{ margin: 0 }} className="sf-num">{l.askUnitPrice ? `${unitPriceText(l.askUnitPrice, cur)} ${perUnit(l.unit)}` : l.allowOffers ? 'Make an offer' : 'Buyers only'}</dd></div>
      <div><dt className="sf-small sf-muted">Form</dt><dd style={{ margin: 0 }}>{label('form', l.form)}</dd></div>
      <div><dt className="sf-small sf-muted">At</dt><dd style={{ margin: 0 }}>{l.yardName || '—'}</dd></div>
      {l.minimumWeight ? <div><dt className="sf-small sf-muted">Smallest lot</dt><dd style={{ margin: 0 }} className="sf-num">{weight(l.minimumWeight, unitLabel)}</dd></div> : null}
      {l.closesAt ? <div><dt className="sf-small sf-muted">Closes</dt><dd style={{ margin: 0 }}>{shortDate(l.closesAt, null, true)}</dd></div> : null}
    </dl>
  );
}

/** P14, B1 */
export async function MarketPage() {
  const [r, b] = await Promise.all([getMarket(), getBusiness()]);
  const biz = businessOrDefaults(b.ok ? b.data : null);
  const head = <PageHead title="Material for sale" crumbs={[{ href: '/', label: 'Home' }, { href: '/buyers', label: 'Buyers' }, { label: 'Market' }]} lead="Sorted, weighed lots at our yards. Approved buyers can make offers." />;
  if (!r.ok) return <>{head}<div className="sf-wrap sf-section"><LoadError what="the market" /></div></>;
  const m = r.data;
  return (
    <>
      {head}
      <div className="sf-wrap sf-section sf-stack">
        {!m.visible ? (
          <StateCard title="The market is open to approved buyers" action={<><Link className="sf-btn sf-btn-sm" href="/buyers/apply">Apply as a buyer</Link><Link className="sf-btn sf-btn-ghost sf-btn-sm" href="/account/sign-in?next=/market">Sign in</Link></>}>
            Sign in with a buyer account to see the listings.
          </StateCard>
        ) : m.listings.length === 0 ? (
          <StateCard title="Nothing listed right now">New lots are listed as they are processed. <Link className="sf-link" href="/buyers/apply">Apply as a buyer</Link> to hear first.</StateCard>
        ) : (
          <>
            {!m.canSeePrices ? <p className="sf-note" style={{ margin: 0 }}>Prices are shown to approved buyers. <Link className="sf-link" href="/buyers/apply">Apply</Link> or <Link className="sf-link" href="/account/sign-in?next=/market">sign in</Link>.</p> : null}
            <div className="sf-grid sf-grid-3">
              {m.listings.map((l) => (
                <Link key={l.id} href={`/market/${l.id}`} className="sf-card sf-stack" style={{ textDecoration: 'none', color: 'inherit', gap: 10 }}>
                  <div>
                    <div className="sf-small sf-muted">{l.materialName}</div>
                    <strong className="sf-h3">{l.title}</strong>
                  </div>
                  <ListingFacts l={l} unitLabel={biz.weightUnit} cur={biz.currencyCode} />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** B1 detail, B2 make an offer or buy now */
export async function ListingPage({ id, sent }: { id: string; sent?: string | null }) {
  const [r, b] = await Promise.all([getListing(id), getBusiness()]);
  const biz = businessOrDefaults(b.ok ? b.data : null);
  if (!r.ok) return <div className="sf-wrap sf-section"><LoadError what="this listing" /></div>;
  const l = r.data;
  if (!l) return <div className="sf-wrap sf-section"><StateCard title="That listing is not available" action={<Link className="sf-btn sf-btn-sm" href="/market">All listings</Link>}>It may have sold or closed.</StateCard></div>;
  const accounts = l.canOffer ? await getMyAccounts() : null;
  const buyerAccounts = accounts?.ok ? accounts.data.filter((a) => a.isBuyer && a.status === 'active') : [];
  return (
    <>
      <PageHead title={l.title} crumbs={[{ href: '/', label: 'Home' }, { href: '/market', label: 'Market' }, { label: l.materialName }]} lead={l.description || undefined} />
      <div className="sf-wrap sf-section sf-split">
        <div className="sf-stack">
          {sent ? <p className="sf-note sf-note-ok" role="status" style={{ margin: 0 }}>{sent === 'bought' ? 'Bought. The sales team will confirm pickup and send the invoice.' : 'Offer sent. The sales team will reply by email.'}</p> : null}
          <section className="sf-card"><ListingFacts l={l} unitLabel={biz.weightUnit} cur={biz.currencyCode} /></section>
          {l.terms ? <section className="sf-card"><h2 className="sf-h3" style={{ marginTop: 0 }}>Terms</h2><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{l.terms}</p></section> : null}
          {l.units.length ? (
            <section className="sf-card sf-table-scroll" style={{ padding: 0 }}>
              <table className="sf-table">
                <thead><tr><th scope="col">Tag</th><th scope="col">Form</th><th scope="col" className="r">Weight</th></tr></thead>
                <tbody>{l.units.map((u) => <tr key={u.tagNumber}><td className="sf-mono">{u.tagNumber}</td><td>{label('form', u.form)}</td><td className="r sf-num">{weight(u.weight, biz.weightUnit)}</td></tr>)}</tbody>
              </table>
            </section>
          ) : null}
        </div>
        <aside className="sf-card sf-stack">
          {l.canOffer && buyerAccounts.length ? (
            <>
              <h2 className="sf-h3" style={{ margin: 0 }}>{l.allowOffers ? 'Make an offer' : 'Buy this lot'}</h2>
              <OfferForm listing={{ id: l.id, unit: l.unit, allowOffers: l.allowOffers, buyNow: l.buyNow, askUnitPrice: l.askUnitPrice, minimumWeight: l.minimumWeight, availableWeight: l.availableWeight }} accounts={buyerAccounts.map((a) => ({ id: a.id, name: a.name }))} idempotencyKey={randomUUID()} />
            </>
          ) : (
            <>
              <h2 className="sf-h3" style={{ margin: 0 }}>Want this lot?</h2>
              <p style={{ margin: 0 }}>Offers come from approved buyer accounts.</p>
              <div className="sf-cluster"><Link className="sf-btn sf-btn-sm" href="/buyers/apply">Apply as a buyer</Link><Link className="sf-btn sf-btn-ghost sf-btn-sm" href={`/account/sign-in?next=/market/${l.id}`}>Sign in</Link></div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

/** P15 */
export async function DonatePage() {
  const r = await getNonprofits();
  const head = <PageHead title="Donate your scrap" crumbs={[{ href: '/', label: 'Home' }, { label: 'Donate' }]} lead="Give all or part of a ticket’s value to a local nonprofit. Choose it at check-in or tell the cashier; the nonprofit gets the money and you get a receipt." />;
  if (!r.ok) return <>{head}<div className="sf-wrap sf-section"><LoadError what="our nonprofit partners" /></div></>;
  return (
    <>
      {head}
      <div className="sf-wrap sf-section sf-stack">
        {r.data.length === 0 ? <StateCard title="No nonprofit partners yet" /> : (
          <div className="sf-grid sf-grid-2">
            {r.data.map((n) => (
              <article key={n.id} className="sf-card sf-stack" style={{ gap: 8 }}>
                <h2 className="sf-h3" style={{ margin: 0 }}>{n.name}</h2>
                {n.ein ? <div className="sf-small sf-muted">EIN {n.ein}</div> : null}
                {n.summary ? <p style={{ margin: 0 }}>{n.summary}</p> : null}
                <div className="sf-cluster">
                  {n.campaigns.map((c) => <Link key={c.id} className="sf-btn sf-btn-ghost sf-btn-sm" href={`/donate/${c.slug}`}>{c.name}</Link>)}
                  {n.website ? <a className="sf-link" href={n.website} rel="noopener noreferrer" target="_blank">Website</a> : null}
                </div>
              </article>
            ))}
          </div>
        )}
        <section className="sf-card sf-card-flat sf-between">
          <p style={{ margin: 0 }}>Run a registered nonprofit? Partners receive donations from sellers’ tickets.</p>
          <Link className="sf-btn sf-btn-sm" href="/donate/apply">Become a partner</Link>
        </section>
      </div>
    </>
  );
}

/** P15 campaign */
export async function CampaignPage({ slug }: { slug: string }) {
  const [r, b] = await Promise.all([getCampaign(slug), getBusiness()]);
  const biz = businessOrDefaults(b.ok ? b.data : null);
  if (!r.ok) return <div className="sf-wrap sf-section"><LoadError what="this campaign" /></div>;
  const c = r.data;
  if (!c) return <div className="sf-wrap sf-section"><StateCard title="We can’t find that campaign" action={<Link className="sf-btn sf-btn-sm" href="/donate">All nonprofits</Link>} /></div>;
  const pct = c.goalCents ? Math.min(100, Math.round((c.raisedCents / c.goalCents) * 100)) : c.goalWeight ? Math.min(100, Math.round((Number(c.raisedWeight) / Number(c.goalWeight)) * 100)) : null;
  return (
    <>
      <PageHead title={c.name} crumbs={[{ href: '/', label: 'Home' }, { href: '/donate', label: 'Donate' }, { label: c.nonprofitName }]} lead={c.description || undefined} />
      <div className="sf-wrap sf-section sf-split">
        <section className="sf-card sf-stack">
          <div className="sf-grid sf-grid-3">
            <div><div className="sf-small sf-muted">Raised</div><div className="sf-price" style={{ fontSize: 28 }}>{money(c.raisedCents, biz.currencyCode)}</div>{c.goalCents ? <div className="sf-small sf-muted">of {money(c.goalCents, biz.currencyCode)}</div> : null}</div>
            <div><div className="sf-small sf-muted">Recycled</div><div className="sf-price" style={{ fontSize: 28 }}>{weight(c.raisedWeight, biz.weightUnit)}</div>{c.goalWeight ? <div className="sf-small sf-muted">of {weight(c.goalWeight, biz.weightUnit)}</div> : null}</div>
            <div><div className="sf-small sf-muted">Donors</div><div className="sf-price" style={{ fontSize: 28 }}>{c.donorCount}</div></div>
          </div>
          {pct !== null ? <div className="sf-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Toward the goal"><span style={{ width: `${pct}%` }} /></div> : null}
          {c.status === 'ended' ? <p className="sf-note" style={{ margin: 0 }}>This campaign has ended{c.endsOn ? ` (${shortDate(c.endsOn, null, true)})` : ''}. Thank you.</p> : null}
        </section>
        <aside className="sf-card sf-stack" style={{ gap: 8 }}>
          <h2 className="sf-h3" style={{ margin: 0 }}>How to give</h2>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
            <li><Link className="sf-link" href="/sell/check-in">Check in</Link> and bring your material.</li>
            <li>Tell the cashier you are giving to {c.nonprofitName}, and how much of the ticket.</li>
            <li>Your receipt shows the donation{c.nonprofitEin ? ` and the nonprofit’s EIN, ${c.nonprofitEin}` : ''}.</li>
          </ol>
        </aside>
      </div>
    </>
  );
}
