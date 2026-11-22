import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { getClaims, getNonprofit, getNonprofitDonations, getOffers, getPurchaseReport, getSalesOrder, getSalesOrders, type ShipmentView } from '../../lib/data/buyer';
import { getAccountOverview } from '../../lib/data/company';
import { getBusiness, businessOrDefaults } from '../../lib/data/public';
import { calendarDate, dateTime, label, money, perUnit, shortDate, unitPriceText, weight } from '../../lib/format';
import { LoadError, StateCard } from '../../components/ui';
import { CampaignForm, ClaimForm, EndCampaignButton, NonprofitProfileForm, OfferButtons, WithdrawClaimButton } from '../../components/forms/BuyerForms';

/** Buyer (B3 to B8) and nonprofit (N1 to N3) pages inside the company portal. */

const base = (slug: string) => `/account/company/${slug}`;
const badge = (s: string, ok: string[], warn: string[], alert: string[]) => `sf-badge${ok.includes(s) ? ' sf-badge-ok' : warn.includes(s) ? ' sf-badge-warn' : alert.includes(s) ? ' sf-badge-alert' : ''}`;
/** FORBIDDEN means the account is not a buyer (or nonprofit), or this contact's role cannot see money pages. */
const fail = (r: { ok: false; code: string | null }, what: string, kind: 'buyer' | 'nonprofit') =>
  r.code === 'FORBIDDEN' ? (
    <StateCard title={kind === 'buyer' ? 'For buyer accounts' : 'For nonprofit partners'} action={<Link className="sf-btn sf-btn-sm" href={kind === 'buyer' ? '/buyers/apply' : '/donate/apply'}>{kind === 'buyer' ? 'Apply as a buyer' : 'Become a partner'}</Link>}>
      {kind === 'buyer' ? 'This page is for companies that buy material from the yard.' : 'This page is for registered nonprofits that receive sellers’ donations.'} If your account already is one, ask its admin: drivers do not see these pages.
    </StateCard>
  ) : <LoadError what={what} />;

/** A quantity in the listing's own unit: lb, kg, net ton or each. */
function qty(value: string | null, unit: string) {
  if (unit === 'lb' || unit === 'kg') return weight(value, unit);
  if (!value) return '—';
  const n = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value));
  return unit === 'each' ? `${n} each` : `${n} ${unit === 'net_ton' ? 'net tons' : unit.replace(/_/g, ' ')}`;
}

async function money0() {
  const b = await getBusiness();
  return businessOrDefaults(b.ok ? b.data : null);
}

/** B3 */
export async function CompanyOffersPage({ slug }: { slug: string }) {
  const [r, biz] = await Promise.all([getOffers(slug), money0()]);
  if (!r.ok) return fail(r, 'your offers', 'buyer');
  const cur = biz.currencyCode;
  return (
    <>
      <div><Link className="sf-btn sf-btn-sm" href="/market">See material for sale</Link></div>
      {r.data.length === 0 ? <StateCard title="No offers yet">Offers you make on the market appear here with the yard’s reply.</StateCard> : (
        <div className="sf-stack">
          {r.data.map((o) => (
            <section key={o.id} className="sf-card sf-stack" style={{ gap: 10 }}>
              <div className="sf-between">
                <div>
                  <strong>{o.listingTitle || o.materialName}</strong>
                  <div className="sf-small sf-muted">{[o.yardName, `sent ${shortDate(o.createdAt)}`, o.contactName].filter(Boolean).join(' · ')}</div>
                </div>
                <span className={badge(o.status, ['accepted'], ['countered'], ['declined', 'expired'])}>{label('offer', o.status)}</span>
              </div>
              <dl className="sf-grid sf-grid-3" style={{ margin: 0 }}>
                <div><dt className="sf-small sf-muted">You offered</dt><dd style={{ margin: 0 }} className="sf-num">{qty(o.weight, o.unit)}{o.unitPrice ? ` at ${unitPriceText(o.unitPrice, cur)} ${perUnit(o.unit)}` : ''}</dd></div>
                {o.pickupFrom ? <div><dt className="sf-small sf-muted">Pickup</dt><dd style={{ margin: 0 }}>{calendarDate(o.pickupFrom)}{o.pickupTo ? ` to ${calendarDate(o.pickupTo)}` : ''}</dd></div> : null}
                {o.status === 'countered' ? <div><dt className="sf-small sf-muted">Yard’s counter</dt><dd style={{ margin: 0 }} className="sf-num"><strong>{o.counterUnitPrice ? `${unitPriceText(o.counterUnitPrice, cur)} ${perUnit(o.unit)}` : ''}{o.counterWeight ? ` for ${qty(o.counterWeight, o.unit)}` : ''}</strong>{o.expiresAt ? <div className="sf-small sf-muted">Answer by {dateTime(o.expiresAt)}</div> : null}</dd></div> : null}
              </dl>
              {o.counterMessage ? <p className="sf-note" style={{ margin: 0 }}>{o.counterMessage}</p> : null}
              {o.decisionReason ? <p className="sf-small sf-muted" style={{ margin: 0 }}>Reason: {o.decisionReason}</p> : null}
              {o.salesOrderId ? <div><Link className="sf-link" href={`${base(slug)}/orders/${o.salesOrderId}`}>Open the order</Link></div> : null}
              {o.canAcceptCounter || o.canWithdraw ? <OfferButtons id={o.id} canAcceptCounter={o.canAcceptCounter} canWithdraw={o.canWithdraw} idempotencyKey={randomUUID()} /> : null}
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/** B4 */
export async function CompanyOrdersPage({ slug }: { slug: string }) {
  const [r, biz] = await Promise.all([getSalesOrders(slug), money0()]);
  if (!r.ok) return fail(r, 'your orders', 'buyer');
  return r.data.length === 0 ? <StateCard title="No orders yet">When the yard accepts an offer or you buy a lot, the order and its loads appear here.</StateCard> : (
    <div className="sf-stack">
      {r.data.map((o) => (
        <Link key={o.id} href={`${base(slug)}/orders/${o.id}`} className="sf-card sf-between" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div>
            <strong>Order {o.number ? `no. ${o.number}` : ''}{o.buyerReference ? ` · your ref ${o.buyerReference}` : ''}</strong>
            <div className="sf-small sf-muted">{o.lines.map((l) => l.materialName).join(', ')} · {weight(o.shippedWeight, biz.weightUnit)} of {weight(o.orderedWeight, biz.weightUnit)} shipped · {money(o.valueCents, biz.currencyCode)}</div>
          </div>
          <span className={badge(o.status, ['fulfilled', 'closed'], ['in_fulfilment'], ['cancelled'])}>{label('salesOrder', o.status)}</span>
        </Link>
      ))}
    </div>
  );
}

function Shipment({ s, slug, orderId, unit, currencyCode }: { s: ShipmentView; slug: string; orderId: string; unit: 'lb' | 'kg'; currencyCode: string }) {
  return (
    <section className="sf-card sf-stack" style={{ gap: 10 }} aria-labelledby={`sh-${s.id}`}>
      <div className="sf-between">
        <h3 id={`sh-${s.id}`} className="sf-h3" style={{ margin: 0 }}>Load {s.number ? `no. ${s.number}` : ''}</h3>
        <span className={badge(s.status, ['delivered', 'reconciled'], ['released', 'loading', 'loaded'], ['cancelled'])}>{label('shipment', s.status)}</span>
      </div>
      <dl className="sf-grid sf-grid-3" style={{ margin: 0 }}>
        {s.scheduledFor ? <div><dt className="sf-small sf-muted">Scheduled</dt><dd style={{ margin: 0 }}>{dateTime(s.scheduledFor)}</dd></div> : null}
        {s.carrier || s.truckPlate ? <div><dt className="sf-small sf-muted">Carrier</dt><dd style={{ margin: 0 }}>{[s.carrier, s.driverName, s.truckPlate, s.trailerNumber ? `trailer ${s.trailerNumber}` : null].filter(Boolean).join(' · ')}</dd></div> : null}
        {s.bolNumber || s.sealNumber ? <div><dt className="sf-small sf-muted">BOL and seal</dt><dd style={{ margin: 0 }}>{[s.bolNumber ? `BOL ${s.bolNumber}` : null, s.sealNumber ? `seal ${s.sealNumber}` : null].filter(Boolean).join(' · ')}</dd></div> : null}
        <div><dt className="sf-small sf-muted">Our scale weight</dt><dd style={{ margin: 0 }} className="sf-num">{s.shippedWeight ? weight(s.shippedWeight, unit) : 'Not weighed yet'}</dd></div>
        {s.receivedWeight ? <div><dt className="sf-small sf-muted">Your received weight</dt><dd style={{ margin: 0 }} className="sf-num">{weight(s.receivedWeight, unit)}{s.receivedGradeNote ? <div className="sf-small sf-muted">{s.receivedGradeNote}</div> : null}</dd></div> : null}
        {s.freightCents ? <div><dt className="sf-small sf-muted">Freight</dt><dd style={{ margin: 0 }} className="sf-num">{money(s.freightCents, currencyCode)}</dd></div> : null}
      </dl>
      {s.units.length ? (
        <details>
          <summary>{s.units.length} tagged {s.units.length === 1 ? 'unit' : 'units'}</summary>
          <ul className="sf-small" style={{ columns: 2, margin: '8px 0 0' }}>{s.units.map((u) => <li key={u.tagNumber}>{u.tagNumber} · {label('form', u.form)}{u.weight ? ` · ${weight(u.weight, unit)}` : ''}</li>)}</ul>
        </details>
      ) : null}
      {s.gatePass ? <p className="sf-note sf-note-ok" style={{ margin: 0 }}>Gate pass: released {dateTime(s.gatePass.releasedAt)}{s.gatePass.truckPlate ? ` on ${s.gatePass.truckPlate}` : ''}{s.gatePass.sealNumber ? `, seal ${s.gatePass.sealNumber}` : ''}.</p> : null}
      {s.invoice ? <div><Link className="sf-link" href={`${base(slug)}/invoices/${s.invoice.id}`}>Invoice {s.invoice.number ? `no. ${s.invoice.number}` : ''}: {money(s.invoice.totalCents, currencyCode)}, {label('invoice', s.invoice.status).toLowerCase()}</Link></div> : null}
      {s.canClaim ? (
        <details>
          <summary className="sf-link">Raise a claim on this load</summary>
          <div style={{ marginTop: 12 }}><ClaimForm slug={slug} orderId={orderId} shipmentId={s.id} currencyCode={currencyCode} idempotencyKey={randomUUID()} /></div>
        </details>
      ) : null}
    </section>
  );
}

/** B5, B6 (invoices link), B7 (claim per load) */
export async function CompanyOrderPage({ slug, id }: { slug: string; id: string }) {
  const [r, biz] = await Promise.all([getSalesOrder(slug, id), money0()]);
  if (!r.ok) return fail(r, 'this order', 'buyer');
  const o = r.data;
  if (!o) return <StateCard title="Order not found" action={<Link className="sf-btn sf-btn-sm" href={`${base(slug)}/orders`}>All orders</Link>} />;
  const cur = biz.currencyCode;
  return (
    <>
      <section className="sf-card sf-stack" style={{ gap: 12 }}>
        <div className="sf-between">
          <h2 className="sf-h3" style={{ margin: 0 }}>Order {o.number ? `no. ${o.number}` : ''}</h2>
          <span className={badge(o.status, ['fulfilled', 'closed'], ['in_fulfilment'], ['cancelled'])}>{label('salesOrder', o.status)}</span>
        </div>
        <dl className="sf-grid sf-grid-3" style={{ margin: 0 }}>
          {o.yardName ? <div><dt className="sf-small sf-muted">From</dt><dd style={{ margin: 0 }}>{o.yardName}</dd></div> : null}
          {o.shipTo ? <div><dt className="sf-small sf-muted">Ship to</dt><dd style={{ margin: 0 }}>{o.shipTo}</dd></div> : null}
          {o.shipWindowStart ? <div><dt className="sf-small sf-muted">Ship window</dt><dd style={{ margin: 0 }}>{calendarDate(o.shipWindowStart, true)}{o.shipWindowEnd ? ` to ${calendarDate(o.shipWindowEnd, true)}` : ''}</dd></div> : null}
          <div><dt className="sf-small sf-muted">Payment</dt><dd style={{ margin: 0 }}>{label('paymentTerms', o.paymentTerms)}{o.netDays ? `, ${o.netDays} days` : ''}</dd></div>
          <div><dt className="sf-small sf-muted">Paid on</dt><dd style={{ margin: 0 }}>{label('weightBasis', o.weightBasis)}</dd></div>
          {o.buyerReference ? <div><dt className="sf-small sf-muted">Your reference</dt><dd style={{ margin: 0 }}>{o.buyerReference}</dd></div> : null}
        </dl>
        {o.cancelReason ? <p className="sf-note sf-note-alert" style={{ margin: 0 }}>Cancelled: {o.cancelReason}</p> : null}
        <div className="sf-table-scroll">
          <table className="sf-table">
            <thead><tr><th scope="col">Material</th><th scope="col" className="r">Ordered</th><th scope="col" className="r">Shipped</th><th scope="col" className="r">Price</th></tr></thead>
            <tbody>{o.lines.map((l) => (
              <tr key={l.id}><td>{l.materialName}{l.tolerancePercent ? <div className="sf-small sf-muted">±{Number(l.tolerancePercent)}%</div> : null}</td><td className="r sf-num">{weight(l.weight, biz.weightUnit)}</td><td className="r sf-num">{weight(l.shippedWeight || '0', biz.weightUnit)}</td><td className="r sf-num">{l.unitPrice ? `${unitPriceText(l.unitPrice, cur)} ${perUnit(l.unit)}` : '—'}</td></tr>
            ))}</tbody>
          </table>
        </div>
        {o.terms ? <p className="sf-small sf-muted" style={{ margin: 0 }}>{o.terms}</p> : null}
      </section>
      <h2 className="sf-h3" style={{ margin: 0 }}>Loads</h2>
      {o.shipments.length === 0 ? <StateCard title="No loads booked yet">The yard books the truck and the load shows here with its weights and gate pass.</StateCard> : o.shipments.map((s) => <Shipment key={s.id} s={s} slug={slug} orderId={o.id} unit={biz.weightUnit} currencyCode={cur} />)}
    </>
  );
}

/** B7 list */
export async function CompanyClaimsPage({ slug, filed }: { slug: string; filed?: boolean }) {
  const [r, biz] = await Promise.all([getClaims(slug), money0()]);
  if (!r.ok) return fail(r, 'your claims', 'buyer');
  return (
    <>
      {filed ? <p className="sf-note sf-note-ok" role="status" style={{ margin: 0 }}>Claim sent. The sales team reviews it and replies here.</p> : null}
      {r.data.length === 0 ? <StateCard title="No claims">If a delivered load is short or off-grade, open the order and raise a claim on that load.</StateCard> : (
        <div className="sf-stack">
          {r.data.map((c) => (
            <section key={c.id} className="sf-card sf-stack" style={{ gap: 8 }}>
              <div className="sf-between">
                <div>
                  <strong>{label('claimKind', c.kind)} · {money(c.claimedCents, biz.currencyCode)}</strong>
                  <div className="sf-small sf-muted">{[c.orderNumber ? `Order no. ${c.orderNumber}` : null, c.shipmentNumber ? `load no. ${c.shipmentNumber}` : null, `sent ${shortDate(c.createdAt)}`, c.openedByName].filter(Boolean).join(' · ')}</div>
                </div>
                <span className={badge(c.status, ['accepted'], ['open'], ['rejected'])}>{label('claim', c.status)}</span>
              </div>
              <p style={{ margin: 0 }}>{c.description}</p>
              {c.status === 'accepted' ? <p className="sf-note sf-note-ok" style={{ margin: 0 }}>Credit of {money(c.creditCents, biz.currencyCode)}{c.decisionReason ? `: ${c.decisionReason}` : '.'}</p> : c.decisionReason ? <p className="sf-small sf-muted" style={{ margin: 0 }}>{c.decisionReason}</p> : null}
              <div className="sf-cluster">
                {c.orderId ? <Link className="sf-link" href={`${base(slug)}/orders/${c.orderId}`}>Open the order</Link> : null}
                {c.canWithdraw ? <WithdrawClaimButton id={c.id} /> : null}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/** B8 */
export async function CompanyPurchasesPage({ slug, year }: { slug: string; year: number }) {
  const r = await getPurchaseReport(slug, year);
  if (!r.ok) return fail(r, 'the purchase report', 'buyer');
  const rows = r.data?.rows || [];
  const unit = r.data?.weightUnit || 'lb';
  const cur = r.data?.currencyCode || 'USD';
  const thisYear = new Date().getUTCFullYear();
  const total = rows.reduce((s, x) => s + Number(x.weight || 0), 0);
  const value = rows.reduce((s, x) => s + x.valueCents, 0);
  return (
    <>
      <nav className="sf-yardswitch" aria-label="Year">
        {[thisYear, thisYear - 1, thisYear - 2].map((y) => <Link key={y} href={`${base(slug)}/purchases?year=${y}`} aria-current={y === year ? 'true' : undefined}>{y}</Link>)}
      </nav>
      {rows.length === 0 ? <StateCard title={`Nothing bought in ${year}`}>Each released load is counted here by month and material.</StateCard> : (
        <div className="sf-card sf-table-scroll" style={{ padding: 0 }}>
          <p className="sf-muted" style={{ margin: 0, padding: '14px 16px 0' }}>{weight(String(total), unit)} bought in {year}, {money(value, cur)}.</p>
          <table className="sf-table">
            <thead><tr><th scope="col">Month</th><th scope="col">Material</th><th scope="col" className="r">Weight</th><th scope="col" className="r">Value</th></tr></thead>
            <tbody>{rows.map((x, n) => <tr key={n}><td>{x.month}</td><td>{x.materialName}</td><td className="r sf-num">{weight(x.weight, unit)}</td><td className="r sf-num">{money(x.valueCents, cur)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** N1, N2 */
export async function CompanyCausePage({ slug, saved }: { slug: string; saved?: boolean }) {
  const [r, biz, ov] = await Promise.all([getNonprofit(slug), money0(), getAccountOverview(slug)]);
  if (!r.ok) return fail(r, 'your cause', 'nonprofit');
  const n = r.data;
  if (!n) return <StateCard title="Not a nonprofit account" />;
  const cur = biz.currencyCode;
  const canRun = ov.ok && ov.data ? ['admin', 'member'].includes(ov.data.role) : false;
  return (
    <>
      {saved ? <p className="sf-note sf-note-ok" role="status" style={{ margin: 0 }}>Campaign saved.</p> : null}
      <div className="sf-grid sf-grid-3">
        <div className="sf-card sf-card-flat"><div className="sf-small sf-muted">Raised</div><div className="sf-price" style={{ fontSize: 28 }}>{money(n.raisedCents, cur)}</div></div>
        <div className="sf-card sf-card-flat"><div className="sf-small sf-muted">Waiting to be paid to you</div><div className="sf-price" style={{ fontSize: 28 }}>{money(n.awaitingDisbursementCents, cur)}</div></div>
        <div className="sf-card sf-card-flat"><div className="sf-small sf-muted">On the Donate page</div><div className="sf-price" style={{ fontSize: 28 }}>{n.isPublic ? 'Shown' : 'Hidden'}</div>{n.isPublic ? <Link className="sf-small sf-link" href="/donate">See it</Link> : null}</div>
      </div>
      <section className="sf-card sf-stack" aria-labelledby="np-h">
        <h2 id="np-h" className="sf-h3" style={{ margin: 0 }}>{n.name}</h2>
        <div className="sf-small sf-muted">{[n.legalName, n.ein ? `EIN ${n.ein}` : null].filter(Boolean).join(' · ')}</div>
        {n.canEdit ? <NonprofitProfileForm accountId={n.accountId} summary={n.summary} website={n.website} isPublic={n.isPublic} /> : (
          <>
            {n.summary ? <p style={{ margin: 0 }}>{n.summary}</p> : null}
            {n.website ? <a className="sf-link" href={n.website} target="_blank" rel="noopener noreferrer">{n.website}</a> : null}
            <p className="sf-small sf-muted" style={{ margin: 0 }}>Only an admin can change this.</p>
          </>
        )}
      </section>
      <h2 className="sf-h3" style={{ margin: 0 }}>Campaigns</h2>
      {n.campaigns.length === 0 ? <StateCard title="No campaigns yet">A campaign lets sellers give to one goal, like a new roof or a food drive.</StateCard> : (
        <div className="sf-stack">
          {n.campaigns.map((c) => {
            const pct = c.goalCents ? Math.min(100, Math.round((c.raisedCents / c.goalCents) * 100)) : null;
            return (
              <section key={c.id} className="sf-card sf-stack" style={{ gap: 8 }}>
                <div className="sf-between">
                  <div>
                    <strong>{c.name}</strong>
                    <div className="sf-small sf-muted">{[c.startsOn ? `from ${calendarDate(c.startsOn, true)}` : null, c.endsOn ? `to ${calendarDate(c.endsOn, true)}` : null, c.isPublic ? 'shown to sellers' : 'hidden from sellers'].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span className={badge(c.status, ['active'], ['draft'], [])}>{label('campaign', c.status)}</span>
                </div>
                <p style={{ margin: 0 }}>{money(c.raisedCents, cur)} raised{c.goalCents ? ` of ${money(c.goalCents, cur)}` : ''} from {c.donationCount} {c.donationCount === 1 ? 'gift' : 'gifts'}{c.raisedWeight && Number(c.raisedWeight) > 0 ? `, ${weight(c.raisedWeight, biz.weightUnit)} of metal` : ''}.</p>
                {pct !== null ? <div className="sf-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${pct}% of goal`}><span style={{ width: `${pct}%` }} /></div> : null}
                <div className="sf-cluster">
                  <Link className="sf-link" href={`${base(slug)}/donations?campaign=${c.id}`}>Donations</Link>
                  {c.isPublic && c.status === 'active' ? <Link className="sf-link" href={`/donate/campaigns/${c.slug}`}>Public page</Link> : null}
                  {canRun && c.status !== 'ended' ? <EndCampaignButton id={c.id} /> : null}
                </div>
                {canRun && c.status !== 'ended' ? (
                  <details><summary className="sf-link">Edit</summary><div style={{ marginTop: 12 }}><CampaignForm accountId={n.accountId} slug={slug} campaign={c} /></div></details>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
      {canRun ? (
        <section className="sf-card" aria-labelledby="cp-new-h">
          <h2 id="cp-new-h" className="sf-h3" style={{ marginTop: 0 }}>Start a campaign</h2>
          <CampaignForm accountId={n.accountId} slug={slug} />
        </section>
      ) : null}
    </>
  );
}

const PAGE = 25;

/** N3 */
export async function CompanyDonationsPage({ slug, campaignId, page }: { slug: string; campaignId: string | null; page: number }) {
  const [r, np, biz] = await Promise.all([getNonprofitDonations(slug, campaignId, PAGE, (page - 1) * PAGE), getNonprofit(slug), money0()]);
  if (!r.ok) return fail(r, 'your donations', 'nonprofit');
  const campaigns = np.ok && np.data ? np.data.campaigns : [];
  const { count, items } = r.data;
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const qs = (n: number) => `${base(slug)}/donations?${new URLSearchParams({ ...(campaignId ? { campaign: campaignId } : {}), page: String(n) })}`;
  return (
    <>
      {campaigns.length ? (
        <nav className="sf-yardswitch" aria-label="Campaign">
          <Link href={`${base(slug)}/donations`} aria-current={!campaignId ? 'true' : undefined}>All</Link>
          {campaigns.map((c) => <Link key={c.id} href={`${base(slug)}/donations?campaign=${c.id}`} aria-current={campaignId === c.id ? 'true' : undefined}>{c.name}</Link>)}
        </nav>
      ) : null}
      {items.length === 0 ? <StateCard title="No donations yet">When a seller gives part of a ticket to you, it shows here once the yard credits it.</StateCard> : (
        <div className="sf-card sf-table-scroll" style={{ padding: 0 }}>
          <p className="sf-muted" style={{ margin: 0, padding: '14px 16px 0' }}>{count} {count === 1 ? 'donation' : 'donations'}.</p>
          <table className="sf-table">
            <thead><tr><th scope="col">Date</th><th scope="col">From</th><th scope="col">Campaign</th><th scope="col" className="r">Amount</th><th scope="col">Status</th></tr></thead>
            <tbody>{items.map((d) => (
              <tr key={d.id}>
                <td>{shortDate(d.date, null, true)}{d.receiptNumber ? <div className="sf-small sf-muted">Receipt {d.receiptNumber}</div> : null}</td>
                <td>{d.donorName || 'A seller'}<div className="sf-small sf-muted">{label('donationKind', d.kind)}</div></td>
                <td>{d.campaignName || '—'}</td>
                <td className="r sf-num">{money(d.amountCents, biz.currencyCode)}{d.weight && Number(d.weight) > 0 ? <div className="sf-small sf-muted">{weight(d.weight, biz.weightUnit)}</div> : null}</td>
                <td><span className={badge(d.status, ['disbursed'], ['credited'], ['cancelled'])}>{label('donation', d.status)}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {pages > 1 ? (
        <nav className="sf-cluster" aria-label="Pages">
          {page > 1 ? <Link className="sf-btn sf-btn-ghost sf-btn-sm" href={qs(page - 1)}>Newer</Link> : null}
          <span className="sf-small sf-muted">Page {page} of {pages}</span>
          {page < pages ? <Link className="sf-btn sf-btn-ghost sf-btn-sm" href={qs(page + 1)}>Older</Link> : null}
        </nav>
      ) : null}
    </>
  );
}
