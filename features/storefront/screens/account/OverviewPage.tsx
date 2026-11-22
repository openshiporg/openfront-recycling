import Link from 'next/link';
import { getOverview } from '../../lib/data/seller';
import { label, money, shortDate, weight } from '../../lib/format';
import { LoadError } from '../../components/ui';
import { AccountTitle } from './AccountLayout';

/** S1 */
export default async function OverviewPage() {
  const r = await getOverview();
  if (!r.ok) return <LoadError what="your account" />;
  const o = r.data;
  const s = o?.seller || null;
  const cur = o?.currencyCode || 'USD';
  const steps = [
    { done: Boolean(s), href: '/account/profile', text: 'Add your name, date of birth and address' },
    { done: Boolean(o?.identityOnFile), href: '/account/identity', text: 'Add your photo ID' },
    { done: (o?.vehicleCount || 0) > 0, href: '/account/vehicles', text: 'Add the vehicle you deliver in' },
  ];
  const ready = steps.every((x) => x.done);
  return (
    <>
      <AccountTitle title={s ? `Hello, ${s.firstName}` : 'Your account'} lead={s?.status === 'do_not_buy' ? label('sellerStatus', s.status) : undefined}>
        <Link className="sf-btn" href="/sell/check-in">Check in to sell</Link>
      </AccountTitle>

      {!ready ? (
        <section className="sf-card">
          <h2 className="sf-h3" style={{ marginBottom: 8 }}>Get ready to check in</h2>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
            {steps.map((x) => (
              <li key={x.href}>{x.done ? <span className="sf-badge sf-badge-ok">Done</span> : <Link className="sf-link" href={x.href}>{x.text}</Link>} {x.done ? x.text : null}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {o?.nextVisit ? (
        <section className="sf-card sf-between">
          <div>
            <span className="sf-muted sf-small">Your next visit</span>
            <div className="sf-h3">{o.nextVisit.yard?.name} · {shortDate(o.nextVisit.plannedDate, o.nextVisit.yard?.timezone)}</div>
            <span className="sf-mono" style={{ fontSize: 22, letterSpacing: '0.1em' }}>{o.nextVisit.code}</span>
          </div>
          <Link className="sf-btn sf-btn-sm" href={`/account/visits/${o.nextVisit.id}`}>Show my pass</Link>
        </section>
      ) : null}

      <div className="sf-grid sf-grid-4">
        <div className="sf-card sf-stat"><span>Paid to you</span><strong>{money(o?.lifetimePaidCents || 0, cur)}</strong></div>
        <div className="sf-card sf-stat"><span>Being prepared</span><strong>{money(o?.pendingCents || 0, cur)}</strong></div>
        <div className="sf-card sf-stat"><span>On hold</span><strong>{money(o?.heldCents || 0, cur)}</strong></div>
        <div className="sf-card sf-stat"><span>Weight sold</span><strong>{weight(o?.lifetimeWeight || 0, o?.weightUnit)}</strong></div>
      </div>
      {(o?.heldCents || 0) > 0 ? <p className="sf-note sf-note-warn" style={{ margin: 0 }}>Some of your money is on hold under the yard’s rules. <Link className="sf-link" href="/account/payouts">See when it is released</Link>.</p> : null}
      <div className="sf-cluster"><Link className="sf-link" href="/account/tickets">All tickets</Link><Link className="sf-link" href="/account/payouts">All payouts</Link><Link className="sf-link" href="/account/visits">Visits</Link></div>
    </>
  );
}
