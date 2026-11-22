import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { getBusiness, getCatalog, getContainerTypes } from '../lib/data/public';
import { getViewer } from '../lib/data/seller';
import { PageHead, SignInNeeded } from '../components/ui';
import { ApplyForm } from '../components/forms/RequestForms';
import { IconBuilding, IconContainer, IconScale, IconTruckScale } from '../components/icons';

const KINDS = {
  supplier: { title: 'Open a business account', crumb: 'Commercial', back: '/commercial', lead: 'For shops, contractors, plants and demolition crews that bring metal often or need containers. We read every application and reply by email.' },
  buyer: { title: 'Apply as a buyer', crumb: 'Buyers', back: '/buyers', lead: 'Mills, foundries, brokers and exporters can buy processed material from our yards. Approved buyers see the market with prices and make offers.' },
  nonprofit: { title: 'Become a nonprofit partner', crumb: 'Donate', back: '/donate', lead: 'Registered nonprofits can receive sellers’ donations from their scale tickets. You need an EIN.' },
} as const;
export type ApplyKind = keyof typeof KINDS;

/** P12 overview */
export async function CommercialPage() {
  const [b, ct] = await Promise.all([getBusiness(), getContainerTypes()]);
  const name = b.ok && b.data?.name ? b.data.name : 'We';
  const hasContainers = ct.ok && ct.data.length > 0;
  const points = [
    { icon: <IconContainer />, t: 'Containers on site', d: hasContainers ? 'Roll-offs and boxes delivered, swapped and hauled on your schedule.' : 'Ask us about container service for your site.', href: '/containers' },
    { icon: <IconScale />, t: 'Your own prices', d: 'Contract or tier prices by material, with the date each takes effect.' },
    { icon: <IconTruckScale />, t: 'Every ticket online', d: 'Weights, grades, photos and receipts for every load, by site and material.' },
    { icon: <IconBuilding />, t: 'Settlements and reports', d: 'Statements on a cycle, invoices you can pay by card, and a diversion report for your records.' },
  ];
  return (
    <>
      <PageHead title="Commercial accounts" crumbs={[{ href: '/', label: 'Home' }, { label: 'Commercial' }]} lead={`${name === 'We' ? 'We buy' : `${name} buys`} from shops, contractors, plants and demolition crews, and puts containers where the scrap is made.`}>
        <div className="sf-cluster"><Link className="sf-btn" href="/commercial/apply">Open a business account</Link><Link className="sf-btn sf-btn-ghost" href="/account/company">Company sign in</Link></div>
      </PageHead>
      <div className="sf-wrap sf-section sf-stack">
        <div className="sf-grid sf-grid-4">
          {points.map((p) => (
            <article key={p.t} className="sf-card sf-stack" style={{ gap: 8 }}>
              <span className="sf-icon-badge" aria-hidden>{p.icon}</span>
              <h2 className="sf-h3" style={{ margin: 0 }}>{p.href ? <Link className="sf-link" href={p.href}>{p.t}</Link> : p.t}</h2>
              <p style={{ margin: 0 }}>{p.d}</p>
            </article>
          ))}
        </div>
        <section className="sf-card">
          <h2 className="sf-h3" style={{ marginTop: 0 }}>How to start</h2>
          <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 6 }}>
            <li>Create a sign-in, then send the short application with your business details.</li>
            <li>We review it, set your payment terms and prices, and email you.</li>
            <li>Your team signs in to the company portal to see tickets and request service.</li>
          </ol>
        </section>
        <p className="sf-muted" style={{ margin: 0 }}>Selling material yourself? <Link className="sf-link" href="/buyers">Buying from us</Link> is a separate programme for mills and brokers.</p>
      </div>
    </>
  );
}

/** P13 overview */
export async function BuyersPage() {
  return (
    <>
      <PageHead title="Buy material from us" crumbs={[{ href: '/', label: 'Home' }, { label: 'Buyers' }]} lead="Processed ferrous and non-ferrous material, sorted and weighed at our yards, for mills, foundries, brokers and exporters.">
        <div className="sf-cluster"><Link className="sf-btn" href="/buyers/apply">Apply as a buyer</Link><Link className="sf-btn sf-btn-ghost" href="/market">See what is for sale</Link></div>
      </PageHead>
      <div className="sf-wrap sf-section sf-grid sf-grid-3">
        <article className="sf-card"><h2 className="sf-h3" style={{ marginTop: 0 }}>Listings</h2><p style={{ margin: 0 }}>Lots by material and form, with weight, location and the terms of sale.</p></article>
        <article className="sf-card"><h2 className="sf-h3" style={{ marginTop: 0 }}>Offers and orders</h2><p style={{ margin: 0 }}>Approved buyers make offers or buy outright; accepted offers become sales orders with shipments and invoices.</p></article>
        <article className="sf-card"><h2 className="sf-h3" style={{ marginTop: 0 }}>Weights you can check</h2><p style={{ margin: 0 }}>Every shipment carries our scale weight; raise a claim if your received weight differs.</p></article>
      </div>
    </>
  );
}

/** P12, P13 and the nonprofit application. */
export async function ApplyPage({ kind }: { kind: ApplyKind }) {
  const k = KINDS[kind];
  const path = kind === 'supplier' ? '/commercial/apply' : kind === 'buyer' ? '/buyers/apply' : '/donate/apply';
  const [viewerR, catalog] = await Promise.all([getViewer(), getCatalog()]);
  const viewer = viewerR.ok ? viewerR.data : null;
  const head = <PageHead title={k.title} crumbs={[{ href: '/', label: 'Home' }, { href: k.back, label: k.crumb }, { label: 'Apply' }]} lead={k.lead} />;
  if (!viewer) return (<>{head}<div className="sf-wrap sf-section"><SignInNeeded next={path} what="Applications are tied to a sign-in, so you can follow the decision and your team can join later." /></div></>);
  const cats = catalog.ok ? catalog.data.categories.map((c) => c.name) : [];
  return (
    <>
      {head}
      <div className="sf-wrap sf-section sf-split">
        <div className="sf-card"><ApplyForm kind={kind} email={viewer.email} categories={cats} idempotencyKey={randomUUID()} /></div>
        <aside className="sf-card sf-card-flat sf-stack" style={{ gap: 8 }}>
          <h2 className="sf-h3" style={{ margin: 0 }}>What happens next</h2>
          <p style={{ margin: 0 }}>Your application goes to our accounts team. You can see its status, or withdraw it, under <Link className="sf-link" href="/account/applications">Applications</Link> in your account.</p>
          <p className="sf-small sf-muted" style={{ margin: 0 }}>Signed in as {viewer.email}.</p>
        </aside>
      </div>
    </>
  );
}

