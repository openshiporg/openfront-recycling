import Link from 'next/link';
import { getDonationReceipt, getDonations, getYearSummary } from '../../lib/data/seller';
import { getBusiness } from '../../lib/data/public';
import { label, money, shortDate, weight } from '../../lib/format';
import { LoadError, StateCard } from '../../components/ui';
import { PrintButton } from '../../components/PrintButton';
import { AccountTitle } from './AccountLayout';

type Unit = 'lb' | 'kg';

/** S15 yearly statement and S13 donations, one page per year. */
export async function StatementPage({ year }: { year: number }) {
  const [sr, dr] = await Promise.all([getYearSummary(year), getDonations(year)]);
  const thisYear = new Date().getUTCFullYear();
  return (
    <>
      <AccountTitle title="Statements" lead="What you sold, what you were paid and what you gave, by year." />
      <div className="sf-between" style={{ marginBottom: 16 }}>
        <nav className="sf-yardswitch" aria-label="Year">
          {[thisYear, thisYear - 1, thisYear - 2].map((y) => <Link key={y} href={`/account/statements?year=${y}`} aria-current={y === year ? 'true' : undefined}>{y}</Link>)}
        </nav>
        {sr.ok && sr.data.ticketCount ? <a className="sf-btn sf-btn-ghost sf-btn-sm" href={`/account/statements/csv?year=${year}`} download>Download CSV</a> : null}
      </div>
      {!sr.ok ? <LoadError what="your statement" /> : sr.data.ticketCount === 0 ? (
        <StateCard title={`No tickets in ${year}`}>Your yearly totals appear here after your first completed ticket.</StateCard>
      ) : (
        <div className="sf-stack">
          <div className="sf-grid sf-grid-4">
            <div className="sf-card"><div className="sf-small sf-muted">Tickets</div><div className="sf-price">{sr.data.ticketCount}</div></div>
            <div className="sf-card"><div className="sf-small sf-muted">Weight sold</div><div className="sf-price">{weight(sr.data.totalWeight, sr.data.weightUnit as Unit)}</div></div>
            <div className="sf-card"><div className="sf-small sf-muted">Ticket value</div><div className="sf-price">{money(sr.data.totalCents, sr.data.currencyCode)}</div></div>
            <div className="sf-card"><div className="sf-small sf-muted">Paid to you</div><div className="sf-price">{money(sr.data.paidCents, sr.data.currencyCode)}</div></div>
          </div>
          <div className="sf-card sf-table-scroll" style={{ padding: 0 }}>
            <table className="sf-table">
              <thead><tr><th scope="col">Material</th><th scope="col" className="r">Weight</th><th scope="col" className="r">Amount</th></tr></thead>
              <tbody>{sr.data.materials.map((m) => (
                <tr key={`${m.materialName}|${m.unit}`}><td>{m.materialName}</td><td className="r sf-num">{m.unit === 'each' ? `${m.quantity} each` : weight(m.weight, (m.unit === 'kg' ? 'kg' : sr.data.weightUnit) as Unit)}</td><td className="r sf-num">{money(m.amountCents, sr.data.currencyCode)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      <h2 className="sf-h2" style={{ marginTop: 32 }}>Donations</h2>
      {!dr.ok ? <LoadError what="your donations" /> : dr.data.length === 0 ? (
        <StateCard title={`No donations in ${year}`}>You can give part or all of a payout to a local cause when you check out at the scale. <Link className="sf-link" href="/donate">See the causes</Link></StateCard>
      ) : (
        <div className="sf-stack">
          {dr.data.map((d) => (
            <article key={d.id} className="sf-card sf-between">
              <div>
                <div className="sf-h3">{d.nonprofitName || 'Donation'}{d.campaignName ? ` · ${d.campaignName}` : ''}</div>
                <div className="sf-small">
                  {d.kind === 'goods_donation' ? `Material, ${weight(d.weight, (sr.ok ? sr.data.weightUnit : 'lb') as Unit)}` : money(d.amountCents || 0, sr.ok ? sr.data.currencyCode : 'USD')}
                  {d.date ? ` · ${shortDate(d.date, null, true)}` : ''}
                  {d.ticket ? <> · <Link className="sf-link" href={`/account/tickets/${d.ticket.id}`}>{d.ticket.displayNumber}</Link></> : null}
                </div>
              </div>
              <div className="sf-cluster">
                <span className={`sf-badge ${d.status === 'credited' || d.status === 'disbursed' ? 'sf-badge-ok' : d.status === 'cancelled' ? 'sf-badge-alert' : ''}`}>{label('donation', d.status)}</span>
                {d.receiptNumber ? <Link className="sf-btn sf-btn-ghost sf-btn-sm" href={`/account/donations/${d.id}/receipt`}>Receipt</Link> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

/** S13 donation receipt, printable. */
export async function DonationReceiptPage({ id }: { id: string }) {
  const [r, b] = await Promise.all([getDonationReceipt(id), getBusiness()]);
  if (!r.ok) return <LoadError what="this receipt" />;
  const d = r.data;
  if (!d) return <StateCard title="We can’t find that receipt" action={<Link className="sf-btn sf-btn-sm" href="/account/statements">Your statements</Link>} />;
  const currency = b.ok ? b.data?.currencyCode || 'USD' : 'USD';
  return (
    <div className="sf-print">
      <div className="sf-between">
        <div>
          <h1>Donation receipt</h1>
          <p style={{ margin: '4px 0 0' }}>No. <span className="sf-mono">{d.receiptNumber}</span>{d.issuedAt ? ` · issued ${shortDate(d.issuedAt, null, true)}` : ''}</p>
        </div>
        <div className="sf-cluster sf-noprint"><PrintButton /><Link className="sf-link" href="/account/statements">Back</Link></div>
      </div>
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', margin: '20px 0' }}>
        {d.donorName ? <><dt>Donor</dt><dd>{d.donorName}</dd></> : null}
        <dt>Received by</dt><dd>{d.nonprofitLegalName || '—'}{d.nonprofitEin ? ` (EIN ${d.nonprofitEin})` : ''}</dd>
        {d.campaignName ? <><dt>Campaign</dt><dd>{d.campaignName}</dd></> : null}
        <dt>Date</dt><dd>{d.date ? shortDate(d.date, null, true) : '—'}{d.yardName ? ` at ${d.yardName}` : ''}</dd>
        {d.amountCreditedCents != null ? <><dt>Amount</dt><dd>{money(d.amountCreditedCents, currency)}</dd></> : null}
      </dl>
      {d.items.length ? (
        <table className="sf-table">
          <thead><tr><th scope="col">Material</th><th scope="col" className="r">Amount</th></tr></thead>
          <tbody>{d.items.map((i, n) => <tr key={n}><td>{i.material || '—'}</td><td className="r sf-num">{i.unit === 'each' ? `${i.quantity ?? 0} each` : `${i.weight ?? '0'} ${i.unit || ''}`}</td></tr>)}</tbody>
        </table>
      ) : null}
      <p>{d.statement}</p>
    </div>
  );
}
