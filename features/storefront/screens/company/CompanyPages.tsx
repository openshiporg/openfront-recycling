import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import type { ReactNode } from 'react';
import { getAccountContainers, getAccountInvoice, getAccountInvoices, getAccountOverview, getAccountPrices, getAccountRequest, getAccountRequests, getAccountSites, getAccountStatements, getAccountTicket, getAccountTickets, getDiversionReport, getMyAccounts } from '../../lib/data/company';
import { getBusiness, getContainerTypes, getYards, businessOrDefaults } from '../../lib/data/public';
import { calendarDate, dateTime, label, money, perUnit, shortDate, todayIn, unitPriceText, weight } from '../../lib/format';
import { LoadError, StateCard } from '../../components/ui';
import { ReceiptView } from '../../components/ReceiptView';
import { CompanyNav } from '../../components/CompanyNav';
import { CancelRequestButton, PayByCardButton } from '../../components/forms/RequestForms';
import { ServiceRequestForm, SiteForm } from '../../components/forms/CompanyForms';
import { AccountTitle } from '../account/AccountLayout';

const base = (slug: string) => `/account/company/${slug}`;

type Kinds = { isSupplier: boolean; isBuyer: boolean; isNonprofit: boolean };
const accountKinds = (a: Kinds) => [a.isSupplier ? 'Supplier' : null, a.isBuyer ? 'Buyer' : null, a.isNonprofit ? 'Nonprofit' : null].filter(Boolean).join(', ') || 'Business account';

/** Tabs for what the account is. An account with no kind set is treated as a supplier (the commercial default). */
export function companyTabs(a: Kinds | null): Array<[string, string]> {
  const supplier = !a || a.isSupplier || (!a.isBuyer && !a.isNonprofit);
  const tabs: Array<[string, string]> = [['', 'Home']];
  if (supplier) tabs.push(['/prices', 'Prices'], ['/tickets', 'Tickets'], ['/requests', 'Requests'], ['/containers', 'Containers'], ['/sites', 'Sites']);
  if (a?.isBuyer) tabs.push(['/offers', 'Offers'], ['/orders', 'Orders'], ['/claims', 'Claims']);
  if (a?.isNonprofit) tabs.push(['/cause', 'Our cause'], ['/donations', 'Donations']);
  if (supplier || a?.isNonprofit) tabs.push(['/statements', 'Statements']);
  tabs.push(['/invoices', 'Invoices']);
  if (supplier) tabs.push(['/reports', 'Reports']);
  if (a?.isBuyer) tabs.push(['/purchases', 'Purchases']);
  return tabs;
}

/** Chooser: the accounts this person is a contact of. */
export async function CompanyChooserPage() {
  const r = await getMyAccounts();
  if (!r.ok) return <LoadError what="your companies" />;
  const accounts = r.data;
  return (
    <>
      <AccountTitle title="Company portal" lead="Business accounts you are on." />
      {accounts.length === 0 ? (
        <StateCard title="You are not on a business account yet" action={<><Link className="sf-btn sf-btn-sm" href="/commercial/apply">Open a business account</Link><Link className="sf-btn sf-btn-ghost sf-btn-sm" href="/account/applications">Your applications</Link></>}>
          If a colleague has invited you, open the link in their email while signed in with that address.
        </StateCard>
      ) : (
        <div className="sf-grid sf-grid-2">
          {accounts.map((a) => (
            <Link key={a.id} href={base(a.slug)} className="sf-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <strong className="sf-h3">{a.name}</strong>
              <div className="sf-small sf-muted">{accountKinds(a)} · {label('contactRole', a.role)}{a.status !== 'active' ? ` · ${label('accountStatus', a.status)}` : ''}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

/** Wraps every company page: loads the account (the server checks membership) and shows the sub-navigation. */
export async function CompanyFrame({ slug, children }: { slug: string; children: ReactNode }) {
  const [r, mine] = await Promise.all([getAccountOverview(slug), getMyAccounts()]);
  if (!r.ok) return <LoadError what="this company account" />;
  const kinds = mine.ok ? mine.data.find((m) => m.slug === slug) || null : null;
  if (!r.data) return <StateCard title="You are not on this account" action={<Link className="sf-btn sf-btn-sm" href="/account/company">Your companies</Link>}>Ask the account’s admin to invite you.</StateCard>;
  const a = r.data.account;
  return (
    <div className="sf-stack">
      <div>
        <div className="sf-small sf-muted"><Link className="sf-link" href="/account/company">Company portal</Link>{a.accountNumber ? ` · Account ${a.accountNumber}` : ''}</div>
        <div className="sf-h2" style={{ margin: '2px 0 0' }}>{a.name}</div>
      </div>
      {a.status !== 'active' ? <p className="sf-note sf-note-alert" role="alert" style={{ margin: 0 }}>This account is suspended. You can see its records; new service requests are paused. Call the yard.</p> : null}
      <CompanyNav slug={slug} items={companyTabs(kinds)} />
      {children}
    </div>
  );
}

/** C1 */
export async function CompanyHomePage({ slug, joined }: { slug: string; joined?: boolean }) {
  const [r, mine] = await Promise.all([getAccountOverview(slug), getMyAccounts()]);
  if (!r.ok || !r.data) return null;
  const o = r.data;
  const k = mine.ok ? mine.data.find((m) => m.slug === slug) : null;
  const welcome = joined ? <p className="sf-note sf-note-ok" role="status" style={{ margin: 0 }}>You joined {o.account.name}{k ? ` as ${label('contactRole', k.role).toLowerCase()}` : ''}.</p> : null;
  if (k && !k.isSupplier && (k.isBuyer || k.isNonprofit)) return <>{welcome}<OtherHome slug={slug} isBuyer={k.isBuyer} isNonprofit={k.isNonprofit} /></>;
  const stats: Array<[string, string, string?]> = [
    ['This month', weight(o.monthWeight, o.weightUnit), `${money(o.monthValueCents, o.currencyCode)} value`],
    ['Open requests', String(o.openRequests), undefined],
    ['Containers on site', String(o.containersOnSite), undefined],
    ['Not yet settled', money(o.unsettledCents, o.currencyCode), o.openInvoiceCents ? `${money(o.openInvoiceCents, o.currencyCode)} in open invoices` : undefined],
  ];
  return (
    <>
      {welcome}
      <div className="sf-grid sf-grid-4">
        {stats.map(([k, v, s]) => (
          <div key={k} className="sf-card sf-card-flat">
            <div className="sf-small sf-muted">{k}</div>
            <div className="sf-price" style={{ fontSize: 28 }}>{v}</div>
            {s ? <div className="sf-small sf-muted">{s}</div> : null}
          </div>
        ))}
      </div>
      <div className="sf-cluster">
        <Link className="sf-btn" href={`${base(slug)}/requests/new`}>Request service</Link>
        <Link className="sf-btn sf-btn-ghost" href={`${base(slug)}/tickets`}>Tickets</Link>
        <Link className="sf-btn sf-btn-ghost" href={`${base(slug)}/invoices`}>Invoices</Link>
      </div>
      <p className="sf-small sf-muted" style={{ margin: 0 }}>Terms: {label('paymentTerms', o.account.paymentTerms)}{o.account.settlementCycle ? `, settled ${label('cycle', o.account.settlementCycle).toLowerCase()}` : ''}.</p>
    </>
  );
}

function OtherHome({ slug, isBuyer, isNonprofit }: { slug: string; isBuyer: boolean; isNonprofit: boolean }) {
  const tiles: Array<[string, string, string]> = [];
  if (isBuyer) tiles.push(['/market', 'Material for sale', 'Lots on offer now, with weights and terms.'], [`${base(slug)}/offers`, 'Your offers', 'Offers you made and counters from the yard.'], [`${base(slug)}/orders`, 'Orders and loads', 'Shipments, gate passes, weights and invoices.']);
  if (isNonprofit) tiles.push([`${base(slug)}/cause`, 'Your cause and campaigns', 'What sellers see, and what you have raised.'], [`${base(slug)}/donations`, 'Donations', 'Every gift from a seller’s ticket.']);
  return (
    <div className="sf-grid sf-grid-3">
      {tiles.map(([href, t, d]) => (
        <Link key={href} href={href} className="sf-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <strong className="sf-h3">{t}</strong>
          <p className="sf-small sf-muted" style={{ margin: '4px 0 0' }}>{d}</p>
        </Link>
      ))}
    </div>
  );
}

/** C2 */
export async function CompanyPricesPage({ slug }: { slug: string }) {
  const r = await getAccountPrices(slug);
  if (!r.ok) return <LoadError what="your prices" />;
  const { items, currencyCode, priceListName } = r.data;
  if (!items.length) return <StateCard title="No contract prices">Your account is paid at the posted prices. <Link className="sf-link" href="/prices">See today’s prices</Link>.</StateCard>;
  return (
    <div className="sf-card sf-table-scroll" style={{ padding: 0 }}>
      {priceListName ? <p className="sf-muted" style={{ margin: 0, padding: '14px 16px 0' }}>Price list: {priceListName}</p> : null}
      <table className="sf-table">
        <thead><tr><th scope="col">Material</th><th scope="col" className="r">Price</th><th scope="col">From</th><th scope="col">Until</th></tr></thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.materialId}>
              <td>{p.materialName}{p.categoryName ? <div className="sf-small sf-muted">{p.categoryName}</div> : null}</td>
              <td className="r sf-num">{p.direction === 'charge_customer' ? 'Fee ' : ''}{unitPriceText(p.unitPrice, currencyCode)}{p.unitPriceHigh ? `–${unitPriceText(p.unitPriceHigh, currencyCode)}` : ''} {perUnit(p.unit)}</td>
              <td>{shortDate(p.effectiveFrom, null, true)}</td>
              <td>{p.effectiveTo ? shortDate(p.effectiveTo, null, true) : 'Until changed'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** C3 list */
export async function CompanyTicketsPage({ slug, siteId, from, to, page }: { slug: string; siteId?: string | null; from?: string | null; to?: string | null; page?: number }) {
  const P = 25;
  const p = Math.max(1, page || 1);
  const [r, sites] = await Promise.all([getAccountTickets(slug, { siteId, from, to, take: P, skip: (p - 1) * P }), getAccountSites(slug)]);
  if (!r.ok) return <LoadError what="the tickets" />;
  const { items, count, currencyCode } = r.data;
  const qs = (n: number) => `${base(slug)}/tickets?${new URLSearchParams({ ...(siteId ? { site: siteId } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), page: String(n) })}`;
  return (
    <>
      <form className="sf-card sf-card-flat sf-cluster sf-filters" action={`${base(slug)}/tickets`} style={{ alignItems: 'end' }}>
        {sites.ok && sites.data.length > 1 ? (
          <div className="sf-field"><label htmlFor="st">Site</label><select id="st" name="site" className="sf-select" defaultValue={siteId || ''}><option value="">All sites</option>{sites.data.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        ) : null}
        <div className="sf-field"><label htmlFor="fr">From</label><input id="fr" name="from" type="date" className="sf-input" defaultValue={from || ''} /></div>
        <div className="sf-field"><label htmlFor="to">To</label><input id="to" name="to" type="date" className="sf-input" defaultValue={to || ''} /></div>
        <button className="sf-btn sf-btn-sm" type="submit">Show</button>
      </form>
      {items.length === 0 ? <StateCard title="No tickets">{siteId || from || to ? 'Nothing matches these filters.' : 'Tickets for loads from your sites appear here.'}</StateCard> : (
        <div className="sf-card sf-table-scroll" style={{ padding: 0 }}>
          <table className="sf-table">
            <thead><tr><th scope="col">Ticket</th><th scope="col">Date</th><th scope="col">Site</th><th scope="col">Material</th><th scope="col" className="r">Net</th><th scope="col" className="r">Total</th></tr></thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td><Link className="sf-link sf-mono" href={`${base(slug)}/tickets/${t.id}`}>{t.displayNumber}</Link><div className="sf-small sf-muted">{label('ticket', t.status)}</div></td>
                  <td>{shortDate(t.completedAt || t.createdAt, t.yard?.timezone, true)}</td>
                  <td>{t.siteName || '—'}</td>
                  <td>{t.materials || '—'}</td>
                  <td className="r sf-num">{t.netWeight ? weight(t.netWeight, null) : '—'}</td>
                  <td className="r sf-num">{t.totalCents < 0 ? '−' : ''}{money(Math.abs(t.totalCents), currencyCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {count > P ? (
        <nav className="sf-cluster" aria-label="Pages">
          {p > 1 ? <Link className="sf-btn sf-btn-ghost sf-btn-sm" href={qs(p - 1)}>Newer</Link> : null}
          <span className="sf-muted">Page {p} of {Math.ceil(count / P)}</span>
          {p * P < count ? <Link className="sf-btn sf-btn-ghost sf-btn-sm" href={qs(p + 1)}>Older</Link> : null}
        </nav>
      ) : null}
    </>
  );
}

/** C3 detail */
export async function CompanyTicketPage({ slug, id }: { slug: string; id: string }) {
  const r = await getAccountTicket(slug, id);
  if (!r.ok) return <LoadError what="this ticket" />;
  if (!r.data) return <StateCard title="We can’t find that ticket" action={<Link className="sf-btn sf-btn-sm" href={`${base(slug)}/tickets`}>All tickets</Link>} />;
  return <ReceiptView r={r.data} />;
}

/** C4 */
export async function CompanySitesPage({ slug }: { slug: string }) {
  const [r, o] = await Promise.all([getAccountSites(slug), getAccountOverview(slug)]);
  if (!r.ok) return <LoadError what="your sites" />;
  const accountId = o.ok && o.data ? o.data.account.id : '';
  const isAdmin = o.ok && o.data ? ['admin', 'member'].includes(o.data.role) : false;
  return (
    <>
      {r.data.length === 0 ? <StateCard title="No sites yet">Add the addresses where we deliver containers or collect material.</StateCard> : (
        <div className="sf-grid sf-grid-2">
          {r.data.map((s) => (
            <details key={s.id} className="sf-card">
              <summary style={{ cursor: 'pointer' }}>
                <strong>{s.name}</strong>{!s.isActive ? <span className="sf-badge" style={{ marginLeft: 8 }}>Not active</span> : null}
                <div className="sf-small sf-muted">{[s.addressLine1, s.city, s.region].filter(Boolean).join(', ')}</div>
              </summary>
              {isAdmin ? <div style={{ marginTop: 12 }}><SiteForm accountId={accountId} slug={slug} site={s} /></div> : null}
            </details>
          ))}
        </div>
      )}
      {isAdmin ? (
        <section className="sf-card">
          <h2 className="sf-h3" style={{ marginTop: 0 }}>Add a site</h2>
          <SiteForm accountId={accountId} slug={slug} />
        </section>
      ) : null}
    </>
  );
}

/** C5 */
export async function CompanyContainersPage({ slug }: { slug: string }) {
  const [r, b] = await Promise.all([getAccountContainers(slug), getBusiness()]);
  if (!r.ok) return <LoadError what="your containers" />;
  const cur = businessOrDefaults(b.ok ? b.data : null).currencyCode;
  if (!r.data.length) return <StateCard title="No containers on your sites" action={<Link className="sf-btn sf-btn-sm" href={`${base(slug)}/requests/new`}>Request a delivery</Link>} />;
  return (
    <div className="sf-card sf-table-scroll" style={{ padding: 0 }}>
      <table className="sf-table">
        <thead><tr><th scope="col">Container</th><th scope="col">Type</th><th scope="col">Site</th><th scope="col" className="r">Days on site</th><th scope="col" className="r">Rental accruing</th></tr></thead>
        <tbody>
          {r.data.map((c) => (
            <tr key={c.id}>
              <td className="sf-mono">{c.number}<div className="sf-small sf-muted">{label('container', c.status)}</div></td>
              <td>{c.type?.name}{c.type?.capacityLabel ? ` · ${c.type.capacityLabel}` : ''}{c.currentMaterial ? <div className="sf-small sf-muted">{c.currentMaterial.name}</div> : null}</td>
              <td>{c.site?.name || '—'}</td>
              <td className="r sf-num">{c.daysOnSite ?? '—'}{c.type?.freeRentalDays ? <div className="sf-small sf-muted">{c.type.freeRentalDays} free</div> : null}</td>
              <td className="r sf-num">{c.rentalAccruingCents ? money(c.rentalAccruingCents, cur) : 'None'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** C6 */
export async function CompanyNewRequestPage({ slug }: { slug: string }) {
  const [o, sites, containers, types, yards] = await Promise.all([getAccountOverview(slug), getAccountSites(slug), getAccountContainers(slug), getContainerTypes(), getYards()]);
  if (!o.ok || !o.data) return <LoadError what="this account" />;
  if (!sites.ok || !yards.ok) return <LoadError what="the request form" />;
  if (o.data.account.status !== 'active') return <StateCard title="Requests are paused" tone="alert">This account is suspended. Call the yard.</StateCard>;
  const activeSites = sites.data.filter((s) => s.isActive);
  if (!activeSites.length) return <StateCard title="Add a site first" action={<Link className="sf-btn sf-btn-sm" href={`${base(slug)}/sites`}>Add a site</Link>}>We need the address before we can send a truck.</StateCard>;
  const cur = o.data.currencyCode;
  return (
    <section className="sf-card">
      <h2 className="sf-h3" style={{ marginTop: 0 }}>Request service</h2>
      <ServiceRequestForm
        accountId={o.data.account.id}
        slug={slug}
        yards={yards.data.map((y) => ({ id: y.id, name: y.name }))}
        sites={activeSites.map((s) => ({ id: s.id, name: s.name }))}
        containers={(containers.ok ? containers.data : []).filter((c) => c.status === 'at_customer').map((c) => ({ id: c.id, label: `${c.number} · ${c.type?.name || ''} · ${c.site?.name || ''}` }))}
        types={(types.ok ? types.data : []).map((t) => ({ id: t.id, label: `${t.name}${t.deliveryFeeCents ? ` · delivery ${money(t.deliveryFeeCents, cur)}` : ''}${t.haulFeeCents ? ` · haul ${money(t.haulFeeCents, cur)}` : ''}` }))}
        minDate={todayIn(yards.data[0]?.timezone || null)}
        chargeToAccount={o.data.account.hasCredit}
        idempotencyKey={randomUUID()}
      />
    </section>
  );
}

/** C7 list */
export async function CompanyRequestsPage({ slug }: { slug: string }) {
  const r = await getAccountRequests(slug);
  if (!r.ok) return <LoadError what="your requests" />;
  return (
    <>
      <div><Link className="sf-btn sf-btn-sm" href={`${base(slug)}/requests/new`}>Request service</Link></div>
      {r.data.length === 0 ? <StateCard title="No service requests yet" /> : (
        <div className="sf-stack">
          {r.data.map((q) => (
            <Link key={q.id} href={`${base(slug)}/requests/${q.id}`} className="sf-card sf-between" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div>
                <strong>{label('requestKind', q.kind)}{q.number ? ` · no. ${q.number}` : ''}</strong>
                <div className="sf-small sf-muted">{q.site?.name || q.site?.addressLine1} · {q.job?.scheduledDate ? `booked ${calendarDate(q.job.scheduledDate, true)}` : `asked ${shortDate(q.createdAt, q.yard?.timezone)}`}</div>
              </div>
              <span className={`sf-badge ${q.status === 'awaiting_payment' ? 'sf-badge-warn' : q.status === 'declined' || q.status === 'cancelled' ? 'sf-badge-alert' : q.status === 'completed' ? 'sf-badge-ok' : ''}`}>{label('request', q.status)}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

/** C7 detail, C6 card payment */
export async function CompanyRequestPage({ slug, id, isNew, paid }: { slug: string; id: string; isNew?: boolean; paid?: boolean }) {
  const [r, o] = await Promise.all([getAccountRequest(slug, id), getAccountOverview(slug)]);
  if (!r.ok) return <LoadError what="this request" />;
  const q = r.data;
  if (!q) return <StateCard title="We can’t find that request" action={<Link className="sf-btn sf-btn-sm" href={`${base(slug)}/requests`}>All requests</Link>} />;
  const cur = o.ok && o.data ? o.data.currencyCode : 'USD';
  const tz = q.yard?.timezone || null;
  const canCancel = ['requested', 'awaiting_payment', 'approved', 'scheduled'].includes(q.status) && !['en_route', 'on_site'].includes(q.job?.status || '');
  return (
    <section className="sf-card sf-stack">
      {isNew ? <p className="sf-note sf-note-ok" role="status" style={{ margin: 0 }}>Request sent to dispatch.</p> : null}
      {paid ? <p className="sf-note sf-note-ok" role="status" style={{ margin: 0 }}>Thanks. Once the card payment is confirmed, dispatch books the truck.</p> : null}
      <div className="sf-between">
        <h2 className="sf-h3" style={{ margin: 0 }}>{label('requestKind', q.kind)}{q.number ? ` · no. ${q.number}` : ''}</h2>
        <span className={`sf-badge ${q.status === 'awaiting_payment' ? 'sf-badge-warn' : q.status === 'declined' || q.status === 'cancelled' ? 'sf-badge-alert' : q.status === 'completed' ? 'sf-badge-ok' : ''}`}>{label('request', q.status)}</span>
      </div>
      <dl className="sf-grid sf-grid-2" style={{ margin: 0, gap: 12 }}>
        <div><dt className="sf-small sf-muted">Site</dt><dd style={{ margin: 0 }}>{q.site?.name}{q.site?.addressLine1 ? `, ${q.site.addressLine1}` : ''}</dd></div>
        <div><dt className="sf-small sf-muted">Preferred</dt><dd style={{ margin: 0 }}>{q.preferredDate ? calendarDate(q.preferredDate, true) : 'Any day'}, {label('window', q.preferredWindow || 'any').toLowerCase()}</dd></div>
        <div><dt className="sf-small sf-muted">Truck</dt><dd style={{ margin: 0 }}>{q.job ? `${label('job', q.job.status)}${q.job.scheduledDate ? `, ${calendarDate(q.job.scheduledDate, true)}` : ''}` : 'Not booked yet'}</dd></div>
        <div><dt className="sf-small sf-muted">Fee</dt><dd style={{ margin: 0 }}>{q.feeCents ? money(q.feeCents, cur) : 'None'}</dd></div>
        {q.job?.driverNotes ? <div><dt className="sf-small sf-muted">Driver’s note</dt><dd style={{ margin: 0 }}>{q.job.driverNotes}</dd></div> : null}
        {q.accessNotes ? <div><dt className="sf-small sf-muted">Access notes</dt><dd style={{ margin: 0 }}>{q.accessNotes}</dd></div> : null}
      </dl>
      <div className="sf-cluster">
        {q.status === 'awaiting_payment' ? <PayByCardButton kind="request" id={q.id} label={`Pay ${money(q.feeCents, cur)} by card`} returnPath={`${base(slug)}/requests/${q.id}?paid=1`} idempotencyKey={randomUUID()} /> : null}
        {canCancel ? <CancelRequestButton id={q.id} /> : null}
      </div>
      <p className="sf-small sf-muted" style={{ margin: 0 }}>Asked {dateTime(q.createdAt, tz)}.</p>
    </section>
  );
}

/** C8, C9 */
export async function CompanyStatementsPage({ slug }: { slug: string }) {
  const r = await getAccountStatements(slug);
  if (!r.ok) return <LoadError what="your statements" />;
  const { settlements, charges, currencyCode: cur } = r.data;
  return (
    <>
      <section className="sf-card sf-table-scroll" style={{ padding: 0 }} aria-labelledby="st-h">
        <h2 id="st-h" className="sf-h3" style={{ margin: 0, padding: '16px 16px 0' }}>Settlements</h2>
        {settlements.length === 0 ? <p className="sf-muted" style={{ padding: '0 16px 16px' }}>No settlements yet. Tickets on account are settled each cycle.</p> : (
          <table className="sf-table">
            <thead><tr><th scope="col">Period</th><th scope="col" className="r">Tickets</th><th scope="col" className="r">Charges</th><th scope="col" className="r">Net</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.id}>
                  <td>{calendarDate(s.periodStart, true)} to {calendarDate(s.periodEnd, true)}<div className="sf-small sf-muted">No. {s.number}</div></td>
                  <td className="r sf-num">{money(s.ticketTotalCents, cur)}</td>
                  <td className="r sf-num">−{money(s.chargeTotalCents, cur)}{s.donationTotalCents ? <div className="sf-small sf-muted">−{money(s.donationTotalCents, cur)} donated</div> : null}</td>
                  <td className="r sf-num"><strong>{s.netCents < 0 ? '−' : ''}{money(Math.abs(s.netCents), cur)}</strong></td>
                  <td>{label('settlement', s.status)}{s.payoutStatus ? <div className="sf-small sf-muted">{label('payout', s.payoutStatus)}</div> : null}{s.paidAt ? <div className="sf-small sf-muted">Paid {shortDate(s.paidAt, null, true)}</div> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="sf-card sf-table-scroll" style={{ padding: 0 }} aria-labelledby="ch-h">
        <h2 id="ch-h" className="sf-h3" style={{ margin: 0, padding: '16px 16px 0' }}>Charges not yet settled</h2>
        {charges.length === 0 ? <p className="sf-muted" style={{ padding: '0 16px 16px' }}>None.</p> : (
          <table className="sf-table">
            <thead><tr><th scope="col">Date</th><th scope="col">Charge</th><th scope="col" className="r">Amount</th></tr></thead>
            <tbody>
              {charges.map((c) => (
                <tr key={c.id}><td>{calendarDate(c.serviceDate, true)}</td><td>{label('chargeKind', c.kind)}{c.containerNumber ? `, container ${c.containerNumber}` : ''}{c.description ? <div className="sf-small sf-muted">{c.description}</div> : null}</td><td className="r sf-num">{money(c.amountCents, cur)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

/** C10 list */
export async function CompanyInvoicesPage({ slug }: { slug: string }) {
  const r = await getAccountInvoices(slug);
  if (!r.ok) return <LoadError what="your invoices" />;
  const { items, currencyCode: cur } = r.data;
  if (!items.length) return <StateCard title="No invoices">Invoices for container rental and service fees appear here.</StateCard>;
  return (
    <div className="sf-card sf-table-scroll" style={{ padding: 0 }}>
      <table className="sf-table">
        <thead><tr><th scope="col">Invoice</th><th scope="col">Date</th><th scope="col">Due</th><th scope="col" className="r">Total</th><th scope="col" className="r">Still due</th><th scope="col">Status</th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td><Link className="sf-link" href={`${base(slug)}/invoices/${i.id}`}>No. {i.number}</Link><div className="sf-small sf-muted">{label('invoiceKind', i.kind)}</div></td>
              <td>{shortDate(i.createdAt, null, true)}</td>
              <td>{i.dueOn ? calendarDate(i.dueOn, true) : '—'}</td>
              <td className="r sf-num">{money(i.totalCents, cur)}</td>
              <td className="r sf-num">{money(Math.max(0, i.totalCents - i.paidCents), cur)}</td>
              <td>{label('invoice', i.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** C10 detail with card payment */
export async function CompanyInvoicePage({ slug, id, paid }: { slug: string; id: string; paid?: boolean }) {
  const r = await getAccountInvoice(slug, id);
  if (!r.ok) return <LoadError what="this invoice" />;
  const { invoice: i, currencyCode: cur } = r.data;
  if (!i) return <StateCard title="We can’t find that invoice" action={<Link className="sf-btn sf-btn-sm" href={`${base(slug)}/invoices`}>All invoices</Link>} />;
  const due = Math.max(0, i.totalCents - i.paidCents);
  return (
    <section className="sf-card sf-stack">
      {paid ? <p className="sf-note sf-note-ok" role="status" style={{ margin: 0 }}>Thanks. The payment shows here once the card provider confirms it.</p> : null}
      <div className="sf-between">
        <div><h2 className="sf-h3" style={{ margin: 0 }}>Invoice no. {i.number}</h2><div className="sf-small sf-muted">{label('invoiceKind', i.kind)} · {shortDate(i.createdAt, null, true)}{i.dueOn ? ` · due ${calendarDate(i.dueOn, true)}` : ''}</div></div>
        <span className={`sf-badge ${i.status === 'paid' ? 'sf-badge-ok' : i.status === 'void' ? 'sf-badge-alert' : 'sf-badge-warn'}`}>{label('invoice', i.status)}</span>
      </div>
      {i.lines?.length ? (
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 16px', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
          {i.lines.map((l, n) => (<div key={n} style={{ display: 'contents' }}><dt>{l.description}{l.quantity ? ` × ${Number(l.quantity)}` : ''}</dt><dd style={{ margin: 0, textAlign: 'right' }}>{money(l.amountCents, cur)}</dd></div>))}
          {i.taxCents ? (<><dt>Tax</dt><dd style={{ margin: 0, textAlign: 'right' }}>{money(i.taxCents, cur)}</dd></>) : null}
          <dt style={{ fontWeight: 800 }}>Total</dt><dd style={{ margin: 0, textAlign: 'right', fontWeight: 800 }}>{money(i.totalCents, cur)}</dd>
        </dl>
      ) : null}
      {due > 0 && ['open', 'partially_paid'].includes(i.status) ? (
        <div className="sf-cluster"><PayByCardButton kind="invoice" id={i.id} label={`Pay ${money(due, cur)} by card`} returnPath={`${base(slug)}/invoices/${i.id}?paid=1`} idempotencyKey={randomUUID()} /><span className="sf-small sf-muted">On the card provider’s secure page.</span></div>
      ) : null}
      {i.payments?.length ? (
        <div className="sf-table-scroll">
          <h3 className="sf-h3" style={{ margin: '8px 0' }}>Payments</h3>
          <table className="sf-table">
            <thead><tr><th scope="col">Date</th><th scope="col">How</th><th scope="col" className="r">Amount</th><th scope="col">Status</th></tr></thead>
            <tbody>{i.payments.map((p) => (<tr key={p.id}><td>{dateTime(p.createdAt, null)}</td><td>{label('paymentMethod', p.method)}</td><td className="r sf-num">{money(p.amountCents, cur)}{p.refundedCents ? <div className="sf-small sf-muted">−{money(p.refundedCents, cur)} refunded</div> : null}</td><td>{label('payment', p.status)}</td></tr>))}</tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

/** C11 */
export async function CompanyReportsPage({ slug, year }: { slug: string; year: number }) {
  const r = await getDiversionReport(slug, year);
  if (!r.ok) return <LoadError what="the report" />;
  const { rows, weightUnit, currencyCode } = r.data;
  const total = rows.reduce((s, x) => s + Number(x.weight || 0), 0);
  const thisYear = new Date().getUTCFullYear();
  return (
    <>
      <div className="sf-between">
        <nav className="sf-yardswitch" aria-label="Year">
          {[thisYear, thisYear - 1, thisYear - 2].map((y) => <Link key={y} href={`${base(slug)}/reports?year=${y}`} aria-current={y === year ? 'true' : undefined}>{y}</Link>)}
        </nav>
        {rows.length ? <a className="sf-btn sf-btn-ghost sf-btn-sm" href={`${base(slug)}/reports/csv?year=${year}`} download>Download CSV</a> : null}
      </div>
      {rows.length === 0 ? <StateCard title={`Nothing recycled in ${year}`}>The diversion report lists weight by material for each month.</StateCard> : (
        <div className="sf-card sf-table-scroll" style={{ padding: 0 }}>
          <p className="sf-muted" style={{ margin: 0, padding: '14px 16px 0' }}>{weight(String(total), weightUnit as 'lb' | 'kg')} recycled in {year}.</p>
          <table className="sf-table">
            <thead><tr><th scope="col">Month</th><th scope="col">Material</th><th scope="col" className="r">Weight</th><th scope="col" className="r">Value</th></tr></thead>
            <tbody>{rows.map((x, n) => (<tr key={n}><td>{x.month}</td><td>{x.materialName}{x.categoryName ? <div className="sf-small sf-muted">{x.categoryName}</div> : null}</td><td className="r sf-num">{weight(x.weight, weightUnit as 'lb' | 'kg')}</td><td className="r sf-num">{money(x.valueCents, currencyCode)}</td></tr>))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
