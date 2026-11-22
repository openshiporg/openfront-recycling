import Link from 'next/link';
import { getYardRules } from '../../lib/data/public';
import { getVisit, getVisits } from '../../lib/data/seller';
import { calendarDate, address, dateTime, label, shortDate } from '../../lib/format';
import { LoadError, Qr, StateCard } from '../../components/ui';
import { CancelVisitButton } from '../../components/forms/SellerForms';
import { PrintButton } from '../../components/PrintButton';
import { WhatToBring } from '../RulesPage';
import { AccountTitle } from './AccountLayout';

const badge = (s: string) => (s === 'booked' ? 'sf-badge-ok' : s === 'cancelled' || s === 'expired' ? 'sf-badge-alert' : '');

/** S6 list */
export async function VisitsPage() {
  const r = await getVisits();
  if (!r.ok) return <LoadError what="your visits" />;
  return (
    <>
      <AccountTitle title="Visits"><Link className="sf-btn sf-btn-sm" href="/sell/check-in">New check-in</Link></AccountTitle>
      {r.data.length === 0 ? (
        <StateCard title="No visits yet" action={<Link className="sf-btn sf-btn-sm" href="/sell/check-in">Check in now</Link>}>Check in before you drive over and you’ll get a scale pass.</StateCard>
      ) : (
        <div className="sf-stack">
          {r.data.map((v) => (
            <Link key={v.id} href={`/account/visits/${v.id}`} className="sf-card sf-between" style={{ textDecoration: 'none' }}>
              <div>
                <strong>{v.yard?.name}</strong> · {calendarDate(v.plannedDate, true)}
                <div className="sf-mono sf-muted">{v.code}</div>
              </div>
              <span className={`sf-badge ${badge(v.status)}`}>{label('visit', v.status)}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

/** S5 result and S6 detail: the scale pass. */
export async function VisitPage({ id, isNew }: { id: string; isNew?: boolean }) {
  const r = await getVisit(id);
  if (!r.ok) return <LoadError what="this visit" />;
  const v = r.data;
  if (!v) return <StateCard title="We can’t find that visit" action={<Link className="sf-btn sf-btn-sm" href="/account/visits">Your visits</Link>}>It may belong to another account.</StateCard>;
  const rulesR = v.yard?.slug ? await getYardRules(v.yard.slug) : null;
  const rules = rulesR?.ok ? rulesR.data : null;
  const tz = v.yard?.timezone || null;
  const active = v.status === 'booked';
  const a = v.yard ? address({ addressLine1: v.yard.addressLine1, city: v.yard.city }) : null;
  const items = (v.expectedItems || []).filter((x) => x.materialName);
  return (
    <>
      {isNew ? <p className="sf-note sf-note-ok" role="status" style={{ margin: 0 }}>You’re checked in. Show this pass at the scale.</p> : null}
      <section className="sf-card sf-pass">
        <div className="sf-pass-tag">Scale pass</div>
        <div className="sf-h3" style={{ color: 'var(--sf-ink)' }}>{v.yard?.name}</div>
        <div className="sf-muted">{calendarDate(v.plannedDate, true)}</div>
        {active ? <Qr value={v.code} label={`QR code for check-in code ${v.code}`} /> : null}
        <div className="sf-small sf-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>Check-in code</div>
        <div className="sf-pass-code" style={active ? undefined : { textDecoration: 'line-through', opacity: 0.5 }}>{v.code}</div>
        <p style={{ margin: '8px 0 0' }}><span className={`sf-badge ${badge(v.status)}`}>{label('visit', v.status)}</span></p>
        {active && v.expiresAt ? <p className="sf-small sf-muted">Valid until {dateTime(v.expiresAt, tz)}.</p> : null}
        {v.vehicle?.plate ? <p className="sf-small" style={{ margin: 0 }}>Vehicle: <span className="sf-mono">{v.vehicle.plate}</span>{v.vehicle.make ? ` · ${[v.vehicle.make, v.vehicle.model].filter(Boolean).join(' ')}` : ''}</p> : null}
      </section>
      {items.length ? (
        <section className="sf-card sf-card-flat">
          <h2 className="sf-h3" style={{ marginBottom: 6 }}>What you said you’re bringing</h2>
          <ul style={{ margin: 0, paddingLeft: 20 }}>{items.map((x, i) => <li key={i}>{x.materialName}{x.estimatedWeight ? `, about ${x.estimatedWeight}` : ''}</li>)}</ul>
          <p className="sf-small sf-muted" style={{ marginBottom: 0 }}>This is only a guide. The scale weighs what you actually bring.</p>
        </section>
      ) : null}
      {active && rules ? <section className="sf-card sf-card-flat"><h2 className="sf-h3" style={{ marginBottom: 8 }}>Bring with you</h2><WhatToBring rules={rules} /></section> : null}
      <div className="sf-cluster sf-noprint">
        {a?.oneLine ? <a className="sf-btn sf-btn-sm" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.oneLine)}`} target="_blank" rel="noopener noreferrer">Directions</a> : null}
        {active ? <PrintButton label="Print the pass" /> : null}
        {active ? <CancelVisitButton id={v.id} /> : null}
        <Link className="sf-link" href="/account/visits">All visits</Link>
      </div>
    </>
  );
}
