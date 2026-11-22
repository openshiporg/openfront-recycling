import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { businessOrDefaults, getBusiness, getCatalog, getYards } from '../lib/data/public';
import { getViewer } from '../lib/data/seller';
import { getApplications, getPickup, getPickups } from '../lib/data/requests';
import { dateTime, label, money, shortDate, todayIn } from '../lib/format';
import { LoadError, NotOpenYet, PageHead, SignInNeeded, StateCard } from '../components/ui';
import { AcceptQuoteButton, CancelRequestButton, PayByCardButton, PickupForm, WithdrawApplicationButton } from '../components/forms/RequestForms';
import { AccountTitle } from './account/AccountLayout';

/** P16 */
export async function PickupPage() {
  const [viewerR, yardsR, catalog] = await Promise.all([getViewer(), getYards(), getCatalog()]);
  const head = <PageHead title="Request a pickup" crumbs={[{ href: '/', label: 'Home' }, { label: 'Pickup' }]} lead="Appliances, a car that no longer runs, or a pile of scrap too big to bring in. Tell us what and where; we reply with a quote before anything is booked." />;
  if (!yardsR.ok) return (<>{head}<div className="sf-wrap sf-section"><LoadError what="the yards" /></div></>);
  if (!yardsR.data.length) return (<>{head}<div className="sf-wrap sf-section"><NotOpenYet /></div></>);
  const viewer = viewerR.ok ? viewerR.data : null;
  const yards = yardsR.data.filter((y) => y.acceptsPublic !== false);
  const materials = catalog.ok ? catalog.data.materials.filter((m) => m.acceptsFromPublic !== false).map((m) => ({ id: m.id, name: m.name })) : [];
  return (
    <>
      {head}
      <div className="sf-wrap sf-section sf-split">
        <div className="sf-card">
          {viewer ? (
            <PickupForm yards={(yards.length ? yards : yardsR.data).map((y) => ({ id: y.id, name: y.name }))} materials={materials} minDate={todayIn(yardsR.data[0].timezone)} idempotencyKey={randomUUID()} />
          ) : (
            <SignInNeeded next="/pickup" what="Requests are tied to an account so we can send the quote and you can follow the truck." />
          )}
        </div>
        <aside className="sf-card sf-card-flat sf-stack" style={{ gap: 8 }}>
          <h2 className="sf-h3" style={{ margin: 0 }}>How it works</h2>
          <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 6 }}>
            <li>Send the request with the address and what to collect.</li>
            <li>We quote a fee, or free if the metal covers it.</li>
            <li>Accept the quote (and pay by card if there is a fee). We book the truck.</li>
            <li>Follow it under <Link className="sf-link" href="/account/pickups">Pickups</Link> in your account.</li>
          </ol>
          <p className="sf-small sf-muted" style={{ margin: 0 }}>Businesses with containers on site request service from the company portal instead.</p>
        </aside>
      </div>
    </>
  );
}

/** S14 list */
export async function PickupsPage() {
  const r = await getPickups();
  if (!r.ok) return <LoadError what="your pickups" />;
  return (
    <>
      <AccountTitle title="Pickups" lead="Pickups you asked for, their quotes and when the truck comes."><Link className="sf-btn sf-btn-sm" href="/pickup">Request a pickup</Link></AccountTitle>
      {r.data.length === 0 ? <StateCard title="No pickups yet" action={<Link className="sf-btn sf-btn-sm" href="/pickup">Request a pickup</Link>}>Ask us to collect appliances, a vehicle or a pile of scrap.</StateCard> : (
        <div className="sf-stack">
          {r.data.map((p) => (
            <Link key={p.id} href={`/account/pickups/${p.id}`} className="sf-card sf-between" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div>
                <strong>{p.itemsDescription || label('requestKind', p.kind)}</strong>
                <div className="sf-small sf-muted">{p.site?.addressLine1}{p.site?.city ? `, ${p.site.city}` : ''} · asked {shortDate(p.createdAt, p.yard?.timezone)}</div>
              </div>
              <span className={`sf-badge ${p.status === 'awaiting_payment' ? 'sf-badge-warn' : p.status === 'declined' || p.status === 'cancelled' ? 'sf-badge-alert' : p.status === 'completed' ? 'sf-badge-ok' : ''}`}>{label('request', p.status)}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

/** S14 detail */
export async function PickupDetailPage({ id, isNew, paid }: { id: string; isNew?: boolean; paid?: boolean }) {
  const [r, b] = await Promise.all([getPickup(id), getBusiness()]);
  if (!r.ok) return <LoadError what="this pickup" />;
  const p = r.data;
  if (!p) return <StateCard title="We can’t find that pickup" action={<Link className="sf-btn sf-btn-sm" href="/account/pickups">Your pickups</Link>} />;
  const cur = businessOrDefaults(b.ok ? b.data : null).currencyCode;
  const tz = p.yard?.timezone || null;
  const quoted = p.canAcceptQuote ?? (p.status === 'requested' && p.kind === 'public_pickup' && !p.quoteAcceptedAt && (p.feeCents > 0 || Boolean(p.quoteNote)));
  const canCancel = p.canCancel ?? (['requested', 'awaiting_payment', 'approved', 'scheduled'].includes(p.status) && !['en_route', 'on_site'].includes(p.job?.status || ''));
  return (
    <>
      <AccountTitle title={`Pickup${p.number ? ` no. ${p.number}` : ''}`} lead={p.itemsDescription || undefined} />
      {isNew ? <p className="sf-note sf-note-ok" role="status" style={{ margin: 0 }}>Request sent. We’ll quote it and let you know by email.</p> : null}
      {paid ? <p className="sf-note sf-note-ok" role="status" style={{ margin: 0 }}>Thanks. Once the card payment is confirmed we book the truck.</p> : null}
      <section className="sf-card sf-stack">
        <div className="sf-between">
          <span className={`sf-badge ${p.status === 'awaiting_payment' ? 'sf-badge-warn' : p.status === 'declined' || p.status === 'cancelled' ? 'sf-badge-alert' : p.status === 'completed' ? 'sf-badge-ok' : ''}`}>{label('request', p.status)}</span>
          {canCancel ? <CancelRequestButton id={p.id} /> : null}
        </div>
        <dl className="sf-grid sf-grid-2" style={{ margin: 0, gap: 12 }}>
          <div><dt className="sf-small sf-muted">Address</dt><dd style={{ margin: 0 }}>{p.site?.addressLine1}{p.site?.city ? `, ${p.site.city}` : ''}</dd></div>
          <div><dt className="sf-small sf-muted">Yard</dt><dd style={{ margin: 0 }}>{p.yard?.name}{p.yard?.phone ? ` · ${p.yard.phone}` : ''}</dd></div>
          <div><dt className="sf-small sf-muted">Preferred</dt><dd style={{ margin: 0 }}>{p.preferredDate ? shortDate(p.preferredDate, tz, true) : 'Any day'}, {label('window', p.preferredWindow || 'any').toLowerCase()}</dd></div>
          <div><dt className="sf-small sf-muted">Fee</dt><dd style={{ margin: 0 }}>{p.feeCents > 0 ? money(p.feeCents, cur) : p.quoteAcceptedAt || p.status !== 'requested' ? 'No fee' : 'Waiting for our quote'}</dd></div>
          {p.job ? <div><dt className="sf-small sf-muted">Truck</dt><dd style={{ margin: 0 }}>{label('job', p.job.status)}{p.job.scheduledDate ? `, ${shortDate(p.job.scheduledDate, tz, true)}` : ''}</dd></div> : null}
          {p.job?.driverNotes ? <div><dt className="sf-small sf-muted">Driver’s note</dt><dd style={{ margin: 0 }}>{p.job.driverNotes}</dd></div> : null}
        </dl>
        {p.quoteNote ? <p className="sf-note" style={{ margin: 0 }}><strong>Our quote:</strong> {p.quoteNote}</p> : null}
        {quoted ? <div className="sf-cluster"><AcceptQuoteButton id={p.id} /><span className="sf-small sf-muted">{p.feeCents > 0 ? `You then pay ${money(p.feeCents, cur)} by card.` : 'No fee; we book the truck.'}</span></div> : null}
        {(p.canPay ?? p.status === 'awaiting_payment') ? (
          <div className="sf-cluster"><PayByCardButton kind="request" id={p.id} label={`Pay ${money(p.feeCents, cur)} by card`} returnPath={`/account/pickups/${p.id}?paid=1`} idempotencyKey={randomUUID()} /><span className="sf-small sf-muted">Refunded in full if you cancel before the truck leaves.</span></div>
        ) : null}
        <p className="sf-small sf-muted" style={{ margin: 0 }}>Asked {dateTime(p.createdAt, tz)}.</p>
      </section>
    </>
  );
}

/** S16 */
export async function ApplicationsPage({ sent }: { sent?: boolean }) {
  const r = await getApplications();
  if (!r.ok) return <LoadError what="your applications" />;
  return (
    <>
      <AccountTitle title="Applications" lead="Business, buyer and nonprofit applications you have sent." />
      {sent ? <p className="sf-note sf-note-ok" role="status" style={{ margin: 0 }}>Application sent. We reply by email, usually within two working days.</p> : null}
      {r.data.length === 0 ? (
        <StateCard title="No applications" action={<><Link className="sf-btn sf-btn-sm" href="/commercial/apply">Business account</Link><Link className="sf-btn sf-btn-ghost sf-btn-sm" href="/buyers/apply">Buyer</Link></>}>Apply for a business or buyer account here.</StateCard>
      ) : (
        <div className="sf-stack">
          {r.data.map((a) => (
            <article key={a.id} className="sf-card sf-between">
              <div>
                <strong>{a.businessName}</strong>
                <div className="sf-small sf-muted">{label('applicationKind', a.kind)} · sent {shortDate(a.createdAt, null)}</div>
                {a.decisionReason && a.status === 'declined' ? <div className="sf-small">{a.decisionReason}</div> : null}
                {a.status === 'approved' && a.kind === 'supplier' ? <div className="sf-small"><Link className="sf-link" href={a.accountSlug ? `/account/company/${a.accountSlug}` : '/account/company'}>Open the company portal</Link></div> : null}
              </div>
              <div className="sf-cluster">
                <span className={`sf-badge ${a.status === 'approved' ? 'sf-badge-ok' : a.status === 'declined' ? 'sf-badge-alert' : a.status === 'submitted' ? 'sf-badge-warn' : ''}`}>{label('application', a.status)}</span>
                {a.status === 'submitted' ? <WithdrawApplicationButton id={a.id} /> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
