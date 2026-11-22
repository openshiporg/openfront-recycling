import Link from 'next/link';
import { getCatalog, getPriceBoard, getYard, getYardRules, getYards, type Yard } from '../lib/data/public';
import { address, groupedHours, mapsHref, methodsText, shortDate, telHref, todayStatus, zoneName } from '../lib/format';
import { IconClock, IconPhone, IconPin } from '../components/icons';
import { LoadError, NotOpenYet, PageHead, StateCard } from '../components/ui';
import { WhatToBring } from './RulesPage';

function OpenBadge({ y }: { y: Yard }) {
  const t = todayStatus(y.hours, y.timezone, y.closures);
  if (!t.hasHours) return null;
  if (t.closureReason) return <span className="sf-badge sf-badge-alert">Closed today</span>;
  return <span className={`sf-badge ${t.open ? 'sf-badge-ok' : ''}`}>{t.open ? 'Open now' : 'Closed now'}</span>;
}

function Closures({ y }: { y: Yard }) {
  if (!y.closures.length) return null;
  return (
    <div className="sf-note sf-note-warn">
      <strong>Coming closures</strong>
      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
        {y.closures.slice(0, 5).map((c) => (
          <li key={c.id}>{shortDate(c.date, y.timezone, true)}: {c.isPartial && c.openTime && c.closeTime ? `open ${c.openTime}–${c.closeTime} only` : 'closed'}{c.reason ? ` (${c.reason})` : ''}</li>
        ))}
      </ul>
    </div>
  );
}

export async function LocationsPage() {
  const r = await getYards();
  if (!r.ok) return (<><PageHead title="Locations" /><LoadError what="our locations" /></>);
  if (!r.data.length) return <NotOpenYet />;
  return (
    <>
      <PageHead title={r.data.length === 1 ? 'Hours & location' : 'Locations'} crumbs={[{ href: '/', label: 'Home' }, { label: 'Locations' }]} lead="Hours, address and what each yard takes." />
      <div className="sf-wrap sf-section sf-grid sf-grid-2">
        {r.data.map((y) => {
          const a = address(y);
          const t = todayStatus(y.hours, y.timezone, y.closures);
          return (
            <article key={y.id} className="sf-card sf-stack" style={{ gap: 10 }}>
              <div className="sf-between"><h2 className="sf-h3"><Link href={`/locations/${y.slug}`} style={{ textDecoration: 'none' }}>{y.name}</Link></h2><OpenBadge y={y} /></div>
              {a.oneLine ? <p style={{ margin: 0 }}><IconPin size={18} /> {a.oneLine}</p> : null}
              {t.hasHours ? <p style={{ margin: 0 }}><IconClock size={18} /> Today: {t.closureReason ? `closed (${t.closureReason})` : t.text}</p> : null}
              {y.phone ? <p style={{ margin: 0 }}><IconPhone size={16} /> <a href={telHref(y.phone)}>{y.phone}</a></p> : null}
              {y.acceptsPublic === false ? <span className="sf-badge sf-badge-warn">Business accounts only</span> : null}
              <div className="sf-cluster"><Link className="sf-btn sf-btn-sm" href={`/locations/${y.slug}`}>Hours and details</Link><Link className="sf-link" href={`/prices?yard=${y.slug}`}>Prices</Link></div>
            </article>
          );
        })}
      </div>
    </>
  );
}

export async function LocationPage({ slug }: { slug: string }) {
  const r = await getYard(slug);
  if (!r.ok) return (<><PageHead title="Location" /><LoadError what="this location" /></>);
  const y = r.data;
  if (!y) return (<><PageHead title="Not found" /><StateCard title="We don’t have a yard by that name" action={<Link className="sf-btn sf-btn-sm" href="/locations">All locations</Link>} /></>);
  const [rulesR, boardR, catalogR] = await Promise.all([getYardRules(y.slug), getPriceBoard(y.slug), getCatalog()]);
  const rules = rulesR.ok ? rulesR.data : null;
  const board = boardR.ok ? boardR.data : null;
  const a = address(y);
  const priced = new Set((board?.entries || []).map((e) => e.materialId));
  const accepted = catalogR.ok ? catalogR.data.materials.filter((m) => priced.has(m.id)) : [];
  const byCat = new Map<string, string[]>();
  accepted.forEach((m) => { const k = m.category?.name || 'Other'; byCat.set(k, [...(byCat.get(k) || []), m.name]); });
  const scaleTypes = Array.isArray(y.scaleTypes) ? (y.scaleTypes as string[]) : [];
  return (
    <>
      <PageHead title={y.name} crumbs={[{ href: '/', label: 'Home' }, { href: '/locations', label: 'Locations' }, { label: y.name }]} lead={a.oneLine || undefined} />
      <div className="sf-wrap sf-section sf-split sf-grid">
        <div className="sf-stack">
          <Closures y={y} />
          <section className="sf-card">
            <div className="sf-between"><h2 className="sf-h3">Hours</h2><OpenBadge y={y} /></div>
            {y.hours ? (
              <table className="sf-table" style={{ marginTop: 8 }}><tbody>{groupedHours(y.hours).map((g) => <tr key={g.days}><td>{g.days}</td><td className="r">{g.text}</td></tr>)}</tbody></table>
            ) : <p>Call for hours.</p>}
            <p className="sf-small sf-muted" style={{ marginBottom: 0 }}>Times are {zoneName(y.timezone)}.</p>
          </section>
          {rules ? <section className="sf-card"><h2 className="sf-h3" style={{ marginBottom: 10 }}>What to bring</h2><WhatToBring rules={rules} /><p style={{ marginBottom: 0 }}>We pay by {methodsText(rules.payoutMethods)}. <Link className="sf-link" href={`/rules?yard=${y.slug}`}>All selling rules</Link></p></section> : null}
          {byCat.size ? (
            <section className="sf-card">
              <h2 className="sf-h3" style={{ marginBottom: 8 }}>What we take here</h2>
              {[...byCat.entries()].map(([cat, names]) => <p key={cat} style={{ margin: '0 0 8px' }}><strong>{cat}:</strong> {names.join(', ')}</p>)}
              <Link className="sf-link" href={`/prices?yard=${y.slug}`}>Today’s prices at {y.name}</Link>
            </section>
          ) : null}
          {y.publicNotes ? <section className="sf-card sf-card-flat"><p style={{ margin: 0, whiteSpace: 'pre-line' }}>{y.publicNotes}</p></section> : null}
        </div>
        <aside className="sf-stack">
          <section className="sf-card sf-stack" style={{ gap: 10 }}>
            {a.oneLine ? <a className="sf-btn" href={mapsHref(a.oneLine)} target="_blank" rel="noopener noreferrer">Get directions</a> : null}
            {y.phone ? <a className="sf-btn sf-btn-ghost" href={telHref(y.phone)}>Call {y.phone}</a> : null}
            {y.email ? <a className="sf-link" href={`mailto:${y.email}`}>{y.email}</a> : null}
            {scaleTypes.length ? <p className="sf-small sf-muted" style={{ margin: 0 }}>Scales here: {scaleTypes.map((s) => s.replace(/_/g, ' ')).join(', ')}.</p> : null}
            {y.acceptsPublic === false ? <p className="sf-note sf-note-warn" style={{ margin: 0 }}>This yard buys from business accounts only.</p> : <Link className="sf-btn sf-btn-light" href={`/sell/check-in?yard=${y.slug}`}>Check in here</Link>}
          </section>
        </aside>
      </div>
    </>
  );
}
