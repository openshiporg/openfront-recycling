import Link from 'next/link';
import { getBusiness, getContainerTypes, businessOrDefaults, type ContainerType } from '../lib/data/public';
import { label, money } from '../lib/format';
import { LoadError, PageHead, StateCard } from '../components/ui';

function Fees({ c, cur }: { c: ContainerType; cur: string }) {
  const rows: Array<[string, string]> = [];
  if (c.deliveryFeeCents) rows.push(['Delivery', money(c.deliveryFeeCents, cur)]);
  if (c.haulFeeCents) rows.push(['Each haul', money(c.haulFeeCents, cur)]);
  if (c.rentalFeePerDayCents) rows.push(['Rental', `${money(c.rentalFeePerDayCents, cur)} a day${c.freeRentalDays ? ` after ${c.freeRentalDays} free day${c.freeRentalDays === 1 ? '' : 's'}` : ''}`]);
  else if (c.freeRentalDays) rows.push(['Rental', 'No daily charge']);
  if (c.dryRunFeeCents) rows.push(['Dry run', `${money(c.dryRunFeeCents, cur)} if the truck cannot reach the container`]);
  if (!rows.length) return <p className="sf-muted" style={{ margin: 0 }}>Priced with your account. Ask us for a quote.</p>;
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', margin: 0 }}>
      {rows.map(([k, v]) => (<div key={k} style={{ display: 'contents' }}><dt className="sf-muted">{k}</dt><dd style={{ margin: 0, fontWeight: 600 }}>{v}</dd></div>))}
    </dl>
  );
}

const ACTIONS = (
  <div className="sf-cluster">
    <Link className="sf-btn" href="/commercial/apply">Open a business account</Link>
    <Link className="sf-btn sf-btn-ghost" href="/account/company">I have an account</Link>
  </div>
);

/** P11 */
export default async function ContainersPage() {
  const [r, b] = await Promise.all([getContainerTypes(), getBusiness()]);
  const head = <PageHead title="Containers" crumbs={[{ href: '/', label: 'Home' }, { label: 'Containers' }]} lead="Roll-offs and boxes for shops, contractors and plants. We drop the container, you fill it, we haul it to the scale and pay you for the metal." />;
  if (!r.ok) return (<>{head}<div className="sf-wrap sf-section"><LoadError what="the containers" /></div></>);
  const cur = businessOrDefaults(b.ok ? b.data : null).currencyCode;
  return (
    <>
      {head}
      <div className="sf-wrap sf-section sf-stack">
        {r.data.length === 0 ? (
          <StateCard title="No containers listed yet" action={ACTIONS}>Call us about container service for your site.</StateCard>
        ) : (
          <div className="sf-grid sf-grid-3">
            {r.data.map((c) => (
              <article key={c.id} className="sf-card sf-stack" style={{ gap: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.imageUrl || (c.kind === 'roll_off' ? '/storefront/container.jpg' : '/storefront/nonferrous.jpg')} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '3/2', objectFit: 'cover', borderRadius: 'var(--sf-radius-tile)' }} />
                <div>
                  <div className="sf-small sf-muted">{label('containerKind', c.kind)}{c.capacityLabel ? ` · ${c.capacityLabel}` : ''}</div>
                  <h2 className="sf-h3" style={{ margin: '2px 0 0' }}><Link className="sf-link" href={`/containers/${c.slug}`}>{c.name}</Link></h2>
                </div>
                {c.description ? <p style={{ margin: 0 }}>{c.description}</p> : null}
                <Fees c={c} cur={cur} />
              </article>
            ))}
          </div>
        )}
        <section className="sf-card sf-between">
          <div>
            <h2 className="sf-h3" style={{ marginTop: 0 }}>How container service works</h2>
            <p style={{ margin: 0, maxWidth: '62ch' }}>Container service is for business accounts. Once your account is open, request a delivery, swap or pickup from your company portal; you see every haul’s ticket, weights and payment there.</p>
          </div>
          {ACTIONS}
        </section>
      </div>
    </>
  );
}

/** P11 detail */
export async function ContainerPage({ slug }: { slug: string }) {
  const [r, b] = await Promise.all([getContainerTypes(), getBusiness()]);
  if (!r.ok) return <div className="sf-wrap sf-section"><LoadError what="this container" /></div>;
  const c = r.data.find((x) => x.slug === slug);
  if (!c) return <div className="sf-wrap sf-section"><StateCard title="We can’t find that container" action={<Link className="sf-btn sf-btn-sm" href="/containers">All containers</Link>} /></div>;
  const cur = businessOrDefaults(b.ok ? b.data : null).currencyCode;
  return (
    <>
      <PageHead title={c.name} crumbs={[{ href: '/', label: 'Home' }, { href: '/containers', label: 'Containers' }, { label: c.name }]} lead={[label('containerKind', c.kind), c.capacityLabel, c.dimensions].filter(Boolean).join(' · ')} />
      <div className="sf-wrap sf-section sf-split">
        <div className="sf-stack">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.imageUrl || (c.kind === 'roll_off' ? '/storefront/container.jpg' : '/storefront/nonferrous.jpg')} alt="" style={{ width: '100%', aspectRatio: '3/2', objectFit: 'cover', borderRadius: 'var(--sf-radius-card)' }} />
          {c.description && c.description !== c.suitableFor ? <p style={{ margin: 0 }}>{c.description}</p> : null}
          {c.suitableFor ? (<section className="sf-card sf-card-flat"><h2 className="sf-h3" style={{ marginTop: 0 }}>What fits</h2><p style={{ margin: 0, whiteSpace: 'pre-line' }}>{c.suitableFor}</p></section>) : null}
        </div>
        <aside className="sf-card sf-stack">
          <h2 className="sf-h3" style={{ margin: 0 }}>Fees</h2>
          <Fees c={c} cur={cur} />
          <p className="sf-small sf-muted" style={{ margin: 0 }}>The metal in it is weighed and paid at your account’s prices.</p>
          {ACTIONS}
        </aside>
      </div>
    </>
  );
}
