import { Fragment } from 'react';
import type { Receipt } from '../lib/data/public';
import { dateTime, holdSentence, label, money, perUnit, unitPriceText, weight, zoneName } from '../lib/format';

/** One ticket's lines, totals, payouts and holds (S8, S9, S11, P17). Same markup for screen and print. */
export function ReceiptView({ r, photos }: { r: Receipt; photos?: Array<{ kind: string; imageUrl: string | null }> }) {
  const tz = r.yard?.timezone || null;
  const cur = r.currencyCode;
  const u = r.weightUnit;
  return (
    <div className="sf-stack">
      <div className="sf-card sf-card-flat">
        <div className="sf-between">
          <div>
            <div className="sf-muted sf-small">Ticket</div>
            <div className="sf-h2 sf-mono" style={{ color: 'var(--sf-ink)' }}>{r.displayNumber}</div>
          </div>
          <span className={`sf-badge ${r.status === 'voided' ? 'sf-badge-alert' : r.status === 'open' ? 'sf-badge-warn' : 'sf-badge-ok'}`}>{label('ticket', r.status)}</span>
        </div>
        <dl className="sf-grid sf-grid-3" style={{ margin: '14px 0 0', gap: 10 }}>
          <div><dt className="sf-small sf-muted">Yard</dt><dd style={{ margin: 0 }}>{r.yard?.name || '—'}</dd></div>
          <div><dt className="sf-small sf-muted">Completed</dt><dd style={{ margin: 0 }}>{r.completedAt ? `${dateTime(r.completedAt, tz)}` : 'Not yet'}</dd></div>
          <div><dt className="sf-small sf-muted">Seller</dt><dd style={{ margin: 0 }}>{r.sellerName || '—'}{r.maskedIdNumber ? ` · ID ${r.maskedIdNumber}` : ''}{r.vehiclePlate ? ` · ${r.vehiclePlate}` : ''}</dd></div>
        </dl>
        {r.completedAt && tz ? <p className="sf-small sf-muted" style={{ margin: '6px 0 0' }}>Times are {zoneName(tz)}.</p> : null}
      </div>

      <section className="sf-card sf-card-flat" aria-labelledby="lines-h">
        <h2 id="lines-h" className="sf-h3" style={{ marginBottom: 10 }}>What was weighed</h2>
        {r.lines.length === 0 ? <p className="sf-muted">No lines yet.</p> : (
          <div className="sf-lines">
            {r.lines.map((l, i) => {
              const each = l.unit === 'each';
              const hasDeduction = Number(l.deductionWeight || 0) > 0;
              return (
                <div className="sf-line" key={l.id || i}>
                  <div className="sf-between">
                    <strong>{l.materialName}{l.direction === 'charge_customer' ? <span className="sf-badge sf-badge-alert" style={{ marginLeft: 8 }}>Fee</span> : null}</strong>
                    <strong className={`sf-num ${l.direction === 'charge_customer' ? 'sf-price-fee' : ''}`}>{l.direction === 'charge_customer' ? '−' : ''}{money(l.amountCents, cur)}</strong>
                  </div>
                  <dl>
                    {each ? (<><dt>Quantity</dt><dd>{l.quantity ?? '—'}</dd></>) : (
                      <>
                        <dt>Gross</dt><dd>{weight(l.grossWeight, u)}</dd>
                        <dt>Tare</dt><dd>{weight(l.tareWeight, u)}</dd>
                        <dt>Net</dt><dd>{weight(l.netWeight, u)}</dd>
                        {hasDeduction ? (<><dt>Deduction{l.deductionReason ? ` (${label('deduction', l.deductionReason).toLowerCase()})` : ''}{l.deductionPercent ? `, ${Number(l.deductionPercent)}%` : ''}</dt><dd>−{weight(l.deductionWeight, u)}</dd></>) : null}
                        <dt><strong>Pay weight</strong></dt><dd><strong>{weight(l.payWeight, u)}</strong></dd>
                      </>
                    )}
                    <dt>Price</dt><dd>{unitPriceText(l.unitPrice, cur)} {perUnit(l.unit)}</dd>
                  </dl>
                </div>
              );
            })}
          </div>
        )}
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 16px', margin: '16px 0 0', fontVariantNumeric: 'tabular-nums' }}>
          <dt>Materials</dt><dd style={{ margin: 0, textAlign: 'right' }}>{money(r.materialTotalCents, cur)}</dd>
          {r.fees.map((f, i) => (<Fragment key={i}><dt>{f.label}</dt><dd style={{ margin: 0, textAlign: 'right' }}>{money(f.amountCents, cur)}</dd></Fragment>))}
          {r.taxCents ? (<><dt>Tax on fees</dt><dd style={{ margin: 0, textAlign: 'right' }}>−{money(r.taxCents, cur)}</dd></>) : null}
          <dt style={{ fontWeight: 800, fontSize: 20 }}>{r.totalCents < 0 ? 'You owe' : 'Total to you'}</dt>
          <dd style={{ margin: 0, textAlign: 'right', fontWeight: 800, fontSize: 20, color: 'var(--sf-rust)' }}>{money(Math.abs(r.totalCents), cur)}</dd>
        </dl>
      </section>

      {r.holdTags.length ? (
        <section className="sf-card sf-note-warn" aria-labelledby="holds-h">
          <h2 id="holds-h" className="sf-h3" style={{ marginBottom: 8 }}>Held items</h2>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
            {r.holdTags.map((h, i) => (
              <li key={i}>
                {h.status === 'released' ? `${h.materialName || 'This item'} was released.` : holdSentence(h.releaseAt, tz, h.materialName ? `${h.materialName}${h.weight ? ` (${weight(h.weight, u)})` : ''}` : 'this item')}
                {h.status !== 'held' && h.status !== 'released' ? ` ${label('hold', h.status)}.` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="sf-card sf-card-flat" aria-labelledby="pay-h">
        <h2 id="pay-h" className="sf-h3" style={{ marginBottom: 8 }}>Payment</h2>
        {r.payouts.length === 0 ? <p className="sf-muted" style={{ margin: 0 }}>{r.status === 'open' ? 'Payment is set once the ticket is complete.' : r.totalCents < 0 ? 'This ticket is a charge, not a payout.' : 'No payment recorded yet.'}</p> : (
          <div className="sf-table-scroll">
            <table className="sf-table">
              <thead><tr><th scope="col">Amount</th><th scope="col">How</th><th scope="col">Status</th><th scope="col">When</th></tr></thead>
              <tbody>
                {r.payouts.map((p, i) => (
                  <tr key={p.id || i}>
                    <td className="sf-num">{money(p.amountCents, cur)}</td>
                    <td>{p.method ? label('payoutMethod', p.method) : p.allowedMethods?.length ? `${p.allowedMethods.map((m) => label('payoutMethod', m)).join(' or ')}` : '—'}{p.checkNumber ? `, no. ${p.checkNumber}` : ''}</td>
                    <td>{label('payout', p.status)}</td>
                    <td>{p.paidAt ? `Paid ${dateTime(p.paidAt, tz)}` : p.status === 'held' && p.releaseAt ? holdSentence(p.releaseAt, tz, 'this ticket') : p.releaseAt ? `From ${dateTime(p.releaseAt, tz)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {photos?.length ? (
        <section className="sf-card sf-card-flat" aria-labelledby="ph-h">
          <h2 id="ph-h" className="sf-h3" style={{ marginBottom: 8 }}>Photos</h2>
          <div className="sf-grid sf-grid-4">
            {photos.filter((p) => p.imageUrl).map((p, i) => (
              <a key={i} href={p.imageUrl!} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl!} alt={`Ticket photo: ${p.kind.replace(/_/g, ' ')}`} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 'var(--sf-radius-tile)' }} />
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
