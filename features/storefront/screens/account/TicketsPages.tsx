import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { PayByCardButton } from '../../components/forms/RequestForms';
import { getBusiness } from '../../lib/data/public';
import { getPayouts, getTicket, getTickets } from '../../lib/data/seller';
import { dateTime, holdSentence, label, money, shortDate } from '../../lib/format';
import { LoadError, StateCard } from '../../components/ui';
import { ReceiptView } from '../../components/ReceiptView';
import { PrintButton } from '../../components/PrintButton';
import { AccountTitle } from './AccountLayout';

const PAGE = 20;
const STATUSES = ['completed', 'settled', 'open', 'voided'];

/** S7 */
export async function TicketsPage({ status, from, to, page }: { status?: string | null; from?: string | null; to?: string | null; page?: number }) {
  const p = Math.max(1, page || 1);
  const r = await getTickets({ status: status && STATUSES.includes(status) ? status : null, from, to, take: PAGE, skip: (p - 1) * PAGE });
  if (!r.ok) return <LoadError what="your tickets" />;
  const { items, count, currencyCode } = r.data;
  const qs = (n: number) => `/account/tickets?${new URLSearchParams({ ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), page: String(n) })}`;
  return (
    <>
      <AccountTitle title="Tickets" lead={count ? `${count} ticket${count === 1 ? '' : 's'}` : undefined} />
      <form className="sf-card sf-card-flat sf-cluster" action="/account/tickets" style={{ alignItems: 'end' }}>
        <div className="sf-field"><label htmlFor="st">Status</label>
          <select id="st" name="status" className="sf-select" defaultValue={status || ''}>
            <option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{label('ticket', s)}</option>)}
          </select>
        </div>
        <div className="sf-field"><label htmlFor="fr">From</label><input id="fr" name="from" type="date" className="sf-input" defaultValue={from || ''} /></div>
        <div className="sf-field"><label htmlFor="to">To</label><input id="to" name="to" type="date" className="sf-input" defaultValue={to || ''} /></div>
        <button className="sf-btn sf-btn-sm" type="submit">Show</button>
        {status || from || to ? <Link className="sf-link" href="/account/tickets">Clear</Link> : null}
      </form>
      {items.length === 0 ? (
        <StateCard title={status || from || to ? 'No tickets match' : 'No tickets yet'}>{status || from || to ? 'Try a wider date range.' : 'When you sell at the scale, your tickets appear here with every weight and price.'}</StateCard>
      ) : (
        <div className="sf-card sf-table-scroll" style={{ padding: 0 }}>
          <table className="sf-table">
            <thead><tr><th scope="col">Ticket</th><th scope="col">Date</th><th scope="col">Yard</th><th scope="col">Status</th><th scope="col" className="r">Total</th></tr></thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td><Link className="sf-link sf-mono" href={`/account/tickets/${t.id}`}>{t.displayNumber}</Link></td>
                  <td>{shortDate(t.completedAt || t.createdAt, t.yard?.timezone, true)}</td>
                  <td>{t.yard?.name}</td>
                  <td>{label('ticket', t.status)}{t.payoutStatus ? <div className="sf-small sf-muted">{label('payout', t.payoutStatus)}</div> : null}</td>
                  <td className="r sf-num">{t.totalCents < 0 ? '−' : ''}{money(Math.abs(t.totalCents), currencyCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {count > PAGE ? (
        <nav className="sf-cluster" aria-label="Pages">
          {p > 1 ? <Link className="sf-btn sf-btn-ghost sf-btn-sm" href={qs(p - 1)}>Newer</Link> : null}
          <span className="sf-muted">Page {p} of {Math.ceil(count / PAGE)}</span>
          {p * PAGE < count ? <Link className="sf-btn sf-btn-ghost sf-btn-sm" href={qs(p + 1)}>Older</Link> : null}
        </nav>
      ) : null}
    </>
  );
}

/** S8, S11 */
export async function TicketPage({ id }: { id: string }) {
  const r = await getTicket(id);
  if (!r.ok) return <LoadError what="this ticket" />;
  const t = r.data;
  if (!t) return <StateCard title="We can’t find that ticket" action={<Link className="sf-btn sf-btn-sm" href="/account/tickets">Your tickets</Link>}>It may belong to another account.</StateCard>;
  const owes = (t.amountDueCents || 0) > 0;
  return (
    <>
      <AccountTitle title={`Ticket ${t.displayNumber}`}>
        <div className="sf-cluster">
          {owes ? <Link className="sf-btn sf-btn-sm" href={`/account/tickets/${t.id}/pay`}>Pay {money(t.amountDueCents || 0, t.currencyCode)}</Link> : null}
          <Link className="sf-btn sf-btn-ghost sf-btn-sm" href={`/account/tickets/${t.id}/receipt`}>Receipt</Link>
        </div>
      </AccountTitle>
      {t.adjusts ? <p className="sf-note" style={{ margin: 0 }}>This ticket corrects {t.adjusts.id ? <Link className="sf-link" href={`/account/tickets/${t.adjusts.id}`}>{t.adjusts.displayNumber}</Link> : <span className="sf-mono">{t.adjusts.displayNumber}</span>}.</p> : null}
      {t.adjustments.length ? <p className="sf-note sf-note-warn" style={{ margin: 0 }}>This ticket was corrected by {t.adjustments.map((a, i) => <span key={a.id}>{i ? ', ' : ''}<Link className="sf-link" href={`/account/tickets/${a.id}`}>{a.displayNumber}</Link></span>)}.</p> : null}
      <ReceiptView r={t} photos={t.attachments} />
    </>
  );
}

/** S9: printable receipt, without the account chrome. */
export async function ReceiptPage({ id }: { id: string }) {
  const [r, b] = await Promise.all([getTicket(id), getBusiness()]);
  if (!r.ok) return <LoadError what="this receipt" />;
  const t = r.data;
  if (!t) return <StateCard title="We can’t find that receipt" />;
  const biz = b.ok ? b.data : null;
  return (
    <div className="sf-print">
      <div className="sf-between">
        <div>
          <h1>{biz?.name || t.yard?.name}</h1>
          <p style={{ margin: '4px 0 0' }}>{t.yard?.name}{t.yard?.phone ? ` · ${t.yard.phone}` : ''}</p>
        </div>
        <div className="sf-cluster sf-noprint"><PrintButton /><Link className="sf-link" href={`/account/tickets/${t.id}`}>Back</Link></div>
      </div>
      <ReceiptView r={t} />
      {t.lookupCode ? <p className="sf-small">Lookup code <span className="sf-mono">{t.lookupCode}</span>: find this receipt any time at /track.</p> : null}
    </div>
  );
}

/** S10 */
export async function PayoutsPage() {
  const r = await getPayouts();
  if (!r.ok) return <LoadError what="your payouts" />;
  const { items, currencyCode } = r.data;
  return (
    <>
      <AccountTitle title="Payouts" lead="Every payment the yard owes you, how it is paid, and when." />
      {items.length === 0 ? <StateCard title="No payouts yet">When a ticket is completed, its payment appears here.</StateCard> : (
        <div className="sf-stack">
          {items.map((p) => {
            const tz = p.yard?.timezone || null;
            return (
              <article key={p.id} className="sf-card sf-between">
                <div>
                  <div className="sf-price" style={{ fontSize: 24 }}>{money(p.amountCents, currencyCode)}</div>
                  <div className="sf-small">
                    {p.method ? label('payoutMethod', p.method) : p.allowedMethods?.length ? p.allowedMethods.map((m) => label('payoutMethod', m)).join(' or ') : ''}
                    {p.checkNumber ? `, check no. ${p.checkNumber}` : ''}
                    {p.ticket ? <> · <Link className="sf-link" href={`/account/tickets/${p.ticket.id}`}>{p.ticket.displayNumber}</Link></> : null}
                    {p.yard ? ` · ${p.yard.name}` : ''}
                  </div>
                  <div className="sf-small sf-muted">
                    {p.paidAt ? `Paid ${dateTime(p.paidAt, tz)}` : p.status === 'held' ? holdSentence(p.releaseAt, tz, 'this ticket') : p.status === 'returned' ? 'The payment came back. The yard will reissue it.' : p.releaseAt ? `Ready from ${dateTime(p.releaseAt, tz)}` : ''}
                  </div>
                </div>
                <span className={`sf-badge ${p.status === 'paid' ? 'sf-badge-ok' : p.status === 'held' || p.status === 'returned' ? 'sf-badge-warn' : p.status === 'cancelled' ? 'sf-badge-alert' : ''}`}>{label('payout', p.status)}</span>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

/** S12: pay a fee ticket by card through the ticket's invoice. */
export async function TicketPayPage({ id }: { id: string }) {
  const r = await getTicket(id);
  if (!r.ok) return <LoadError what="this ticket" />;
  const t = r.data;
  if (!t) return <StateCard title="We can’t find that ticket" action={<Link className="sf-btn sf-btn-sm" href="/account/tickets">Your tickets</Link>} />;
  const due = t.amountDueCents || 0;
  return (
    <>
      <AccountTitle title={`Pay ticket ${t.displayNumber}`} />
      {due <= 0 || !t.invoiceId ? (
        <StateCard title="Nothing to pay" action={<Link className="sf-btn sf-btn-sm" href={`/account/tickets/${t.id}`}>Back to the ticket</Link>}>{t.totalCents < 0 ? 'This ticket has been paid.' : 'This ticket pays you; there is nothing to pay on it.'}</StateCard>
      ) : (
        <section className="sf-card sf-stack">
          <div className="sf-between">
            <div><div className="sf-small sf-muted">Amount due</div><div className="sf-price" style={{ fontSize: 34 }}>{money(due, t.currencyCode)}</div></div>
            <PayByCardButton kind="invoice" id={t.invoiceId} label={`Pay ${money(due, t.currencyCode)} by card`} returnPath={`/account/tickets/${t.id}?paid=1`} idempotencyKey={randomUUID()} />
          </div>
          <p className="sf-small sf-muted" style={{ margin: 0 }}>You pay on the card provider’s secure page and come back here. You can also pay at the scale window.</p>
        </section>
      )}
      <ReceiptView r={t} />
    </>
  );
}
