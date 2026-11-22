import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { getCatalog, getPriceBoard, getYardRules, getYards } from '../lib/data/public';
import { getIdentity, getOverview, getVehicles, getViewer } from '../lib/data/seller';
import { todayIn, zoneName } from '../lib/format';
import { LoadError, NotOpenYet, PageHead, SignInNeeded, StateCard } from '../components/ui';
import { CheckInForm } from '../components/forms/CheckInForm';
import { WhatToBring } from './RulesPage';

/** S5: pre-check-in. Walks a seller through profile, ID and vehicle first when they are missing. */
export default async function CheckInPage({ yard }: { yard?: string | null }) {
  const head = <PageHead title="Check in online" crumbs={[{ href: '/', label: 'Home' }, { href: '/sell', label: 'Sell scrap' }, { label: 'Check in' }]} lead="Tell us when you’re coming and what you’re bringing. You’ll get a scale pass to show at the window." />;
  const viewer = await getViewer();
  if (!viewer.ok) return (<>{head}<LoadError what="check-in" /></>);
  if (!viewer.data) return (<>{head}<SignInNeeded next={`/sell/check-in${yard ? `?yard=${yard}` : ''}`} what="Checking in needs an account, so your ID and vehicle are ready at the scale. It takes a minute." /></>);

  const [yardsR, overviewR, identityR, vehiclesR] = await Promise.all([getYards(), getOverview(), getIdentity(), getVehicles()]);
  if (!yardsR.ok || !overviewR.ok) return (<>{head}<LoadError what="check-in" /></>);
  const yards = yardsR.data.filter((y) => y.acceptsPublic !== false);
  if (!yardsR.data.length) return <NotOpenYet />;
  if (!yards.length) return (<>{head}<StateCard title="Business accounts only">Our yards buy from business accounts only. <Link className="sf-link" href="/commercial">Open an account</Link>.</StateCard></>);

  const here = '/sell/check-in';
  const seller = overviewR.data?.seller;
  const docs = identityR.ok ? identityR.data?.documents || [] : [];
  const currentId = docs.find((d) => d.isCurrent && (!d.expiresOn || new Date(d.expiresOn).getTime() >= Date.now()));
  const vehicles = vehiclesR.ok ? vehiclesR.data : [];

  const steps = [
    { key: 'profile', done: Boolean(seller), label: 'Your details' },
    { key: 'id', done: Boolean(currentId), label: 'Photo ID' },
    { key: 'visit', done: false, label: 'Your visit' },
  ];
  const currentStep = steps.find((s) => !s.done)?.key || 'visit';
  const progress = (
    <ol className="sf-flowsteps" aria-label="Steps">
      {steps.map((s, i) => <li key={s.key} data-state={s.done ? 'done' : s.key === currentStep ? 'current' : 'todo'} aria-current={s.key === currentStep ? 'step' : undefined}><b>{s.done ? '✓' : i + 1}</b>{s.label}</li>)}
    </ol>
  );

  if (!seller) {
    return (<>{head}<div className="sf-wrap sf-section" style={{ maxWidth: 760 }}>{progress}<StateCard title="First, your details" action={<Link className="sf-btn" href={`/account/profile?next=${encodeURIComponent(here)}`}>Add my details</Link>}>The yard records your name, date of birth and address on every ticket. You enter them once.</StateCard></div></>);
  }
  if (!currentId) {
    return (<>{head}<div className="sf-wrap sf-section" style={{ maxWidth: 760 }}>{progress}<StateCard title="Next, your photo ID" action={<Link className="sf-btn" href={`/account/identity?next=${encodeURIComponent(here)}`}>Add my ID</Link>}>{docs.length ? 'The ID on file has expired. Add a current one.' : 'Yards must record a current government photo ID for every purchase.'}</StateCard></div></>);
  }

  const chosen = yards.find((y) => y.slug === yard) || yards[0];
  const [rulesR, boardR, catalogR] = await Promise.all([getYardRules(chosen.slug), getPriceBoard(chosen.slug), getCatalog()]);
  const rules = rulesR.ok ? rulesR.data : null;
  const priced = new Set((boardR.ok && boardR.data ? boardR.data.entries : []).map((e) => e.materialId));
  const materials = (catalogR.ok ? catalogR.data.materials : [])
    .filter((m) => m.acceptsFromPublic !== false && (priced.size === 0 || priced.has(m.id)))
    .map((m) => ({ id: m.id, name: m.name, category: m.category?.name || 'Other', fee: m.direction === 'charge_customer' }));
  const unit = boardR.ok && boardR.data ? boardR.data.weightUnit : 'lb';

  return (
    <>
      {head}
      <div className="sf-wrap sf-section sf-split sf-grid">
        <div className="sf-stack">
          {progress}
          <section className="sf-card">
            <CheckInForm
              yards={yards.map((y) => ({ slug: y.slug, name: y.name }))}
              yardSlug={chosen.slug}
              minDate={todayIn(chosen.timezone)}
              maxDate={todayIn(chosen.timezone, 13)}
              zone={zoneName(chosen.timezone)}
              vehicles={vehicles.map((v) => ({ id: v.id, label: `${v.plate}${v.make ? ` · ${[v.color, v.make, v.model].filter(Boolean).join(' ')}` : ''}` }))}
              requirePlate={Boolean(rules?.requireVehiclePlate)}
              materials={materials}
              weightUnit={unit}
              idempotencyKey={randomUUID()}
            />
          </section>
        </div>
        <aside className="sf-stack">
          {rules ? <section className="sf-card"><h2 className="sf-h3" style={{ marginBottom: 8 }}>Bring with you</h2><WhatToBring rules={rules} /></section> : null}
          <section className="sf-card sf-card-flat sf-small">
            <p style={{ marginTop: 0 }}>Your pass is good for the day you choose and the next day. You can cancel it from your account.</p>
            <p style={{ marginBottom: 0 }}>Not sure what it’s worth? <Link className="sf-link" href={`/calculator?yard=${chosen.slug}`}>Estimate your load</Link>.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
