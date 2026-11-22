import Link from 'next/link';
import { getYardRules, getPublicYards, type YardRules } from '../lib/data/public';
import { label, list, methodsText, money } from '../lib/format';
import { LoadError, NotOpenYet, PageHead, StateCard } from '../components/ui';

/** What to bring, as a plain list from the yard's rules profile. Shared with check-in (S5). */
export function WhatToBring({ rules }: { rules: YardRules }) {
  const items: string[] = [];
  if (rules.requireGovernmentId) items.push('A current government photo ID (driver’s licence, state ID or passport)');
  if (rules.requireVehiclePlate) items.push('The vehicle you deliver in; staff record its plate');
  if (rules.requireSellerPhoto) items.push('Staff take a photo of you at the scale');
  if (rules.requireThumbprint) items.push('Staff take a thumbprint, as state law requires');
  if (rules.requireSignature) items.push('You sign the ticket to confirm the material is yours to sell');
  if (rules.minimumSellerAge) items.push(`You must be at least ${rules.minimumSellerAge}`);
  if (!items.length) items.push('Your material, sorted by type if you can');
  return <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>{items.map((t) => <li key={t}>{t}</li>)}</ul>;
}

export function PaymentFacts({ rules, currency = 'USD' }: { rules: YardRules; currency?: string }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
      <li>We pay by {methodsText(rules.payoutMethods)}.</li>
      {rules.cashLimitPerTicketCents ? <li>Cash is paid up to {money(rules.cashLimitPerTicketCents, currency)} a ticket; anything over is paid another way.</li> : null}
      {rules.defaultPaymentHoldDays ? <li>Payment is ready {rules.defaultPaymentHoldDays} days after you sell.</li> : <li>Most tickets are paid the same day, once weighed and graded.</li>}
      {rules.defaultMaterialHoldDays ? <li>We keep material for {rules.defaultMaterialHoldDays} days before processing it.</li> : null}
    </ul>
  );
}

export default async function RulesPage({ yard }: { yard?: string | null }) {
  const yardsR = await getPublicYards();
  if (!yardsR.ok) return (<><PageHead title="Selling rules" /><LoadError what="the selling rules" /></>);
  const yards = yardsR.data;
  if (!yards.length) return <NotOpenYet />;
  const current = yards.find((y) => y.slug === yard) || yards[0];
  const rulesR = await getYardRules(current.slug);
  const head = <PageHead title="Selling rules" crumbs={[{ href: '/', label: 'Home' }, { label: 'Selling rules' }]} lead={`What to bring, how you get paid, and what ${current.name} cannot take.`} />;
  if (!rulesR.ok) return (<>{head}<LoadError what="the selling rules" /></>);
  const rules = rulesR.data;
  if (!rules) return (<>{head}<StateCard title="Rules not published">Call {current.name} to ask what to bring.</StateCard></>);
  const prohibited = rules.restrictions.filter((r) => r.kind === 'prohibited');
  const other = rules.restrictions.filter((r) => r.kind !== 'prohibited');
  return (
    <>
      {head}
      <div className="sf-wrap sf-section sf-stack">
        {yards.length > 1 ? (
          <nav className="sf-yardswitch" aria-label="Choose a yard">
            {yards.map((y) => <Link key={y.id} href={`/rules?yard=${y.slug}`} aria-current={y.slug === current.slug ? 'true' : undefined}>{y.name}</Link>)}
          </nav>
        ) : null}
        <div className="sf-grid sf-grid-2">
          <section className="sf-card"><h2 className="sf-h3" style={{ marginBottom: 10 }}>What to bring</h2><WhatToBring rules={rules} /></section>
          <section className="sf-card"><h2 className="sf-h3" style={{ marginBottom: 10 }}>How you get paid</h2><PaymentFacts rules={rules} /></section>
        </div>
        {other.length ? (
          <section className="sf-card">
            <h2 className="sf-h3" style={{ marginBottom: 6 }}>Items with special rules</h2>
            <div className="sf-table-scroll">
              <table className="sf-table">
                <thead><tr><th scope="col">Item</th><th scope="col">Rule</th><th scope="col">What it means for you</th></tr></thead>
                <tbody>
                  {other.map((r, i) => (
                    <tr key={i}>
                      <td>{r.materialSlug ? <Link className="sf-link" href={`/materials/${r.materialSlug}`}>{r.materialName || r.label}</Link> : r.materialName || r.categoryName || r.label}</td>
                      <td>{label('restriction', r.kind)}</td>
                      <td>
                        {[
                          r.requiredDocuments?.length ? `Bring ${list(r.requiredDocuments.map((d) => label('documents', d).toLowerCase()))}.` : null,
                          r.forbidCash ? `Paid by ${methodsText((r.allowedMethods || []).filter((m) => m !== 'cash'))}, not cash.` : null,
                          r.mailCheckOnly ? 'Paid by a check mailed to you.' : null,
                          r.paymentHoldDays ? `Payment held ${r.paymentHoldDays} days.` : null,
                          r.materialHoldDays ? `Material kept ${r.materialHoldDays} days.` : null,
                          r.kind === 'commercial_only' ? 'Only from business accounts.' : null,
                          r.publicNote,
                        ].filter(Boolean).join(' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        {prohibited.length ? (
          <section className="sf-card sf-note-alert">
            <h2 className="sf-h3" style={{ marginBottom: 6 }}>We cannot accept</h2>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{prohibited.map((r, i) => <li key={i}>{r.materialName || r.categoryName || r.label}{r.publicNote ? `: ${r.publicNote}` : ''}</li>)}</ul>
          </section>
        ) : null}
        {rules.ownershipStatement ? <section className="sf-card sf-card-flat"><h2 className="sf-h3" style={{ marginBottom: 6 }}>What you sign</h2><p style={{ margin: 0, whiteSpace: 'pre-line' }}>{rules.ownershipStatement}</p></section> : null}
        <div className="sf-cluster"><Link className="sf-btn" href="/sell/check-in">Check in to sell</Link><Link className="sf-link" href={`/fees?yard=${current.slug}`}>Drop-off fees</Link></div>
      </div>
    </>
  );
}
