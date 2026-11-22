import Link from 'next/link';
import { getBusiness, getYards } from '../lib/data/public';
import { address, telHref } from '../lib/format';
import { LoadError, NotOpenYet, PageHead } from '../components/ui';

export default async function AboutPage() {
  const [bR, yR] = await Promise.all([getBusiness(), getYards()]);
  if (!bR.ok && !yR.ok) return (<><PageHead title="About us" /><LoadError /></>);
  const b = bR.ok ? bR.data : null;
  const yards = yR.ok ? yR.data : [];
  if (!b && !yards.length) return <NotOpenYet />;
  const name = b?.name || yards[0]?.name || 'About us';
  return (
    <>
      <PageHead title={`About ${name}`} crumbs={[{ href: '/', label: 'Home' }, { label: 'About' }]} />
      <div className="sf-wrap sf-section sf-split sf-grid">
        <div className="sf-stack">
          <section className="sf-card"><p style={{ margin: 0, whiteSpace: 'pre-line', fontSize: 18 }}>{b?.about || `${name} buys scrap metal and recyclable material from the public and from businesses, at prices posted on this site every day.`}</p></section>
          {b?.isNonprofit ? <section className="sf-card sf-card-flat"><h2 className="sf-h3">Nonprofit</h2><p style={{ marginBottom: 0 }}>{b.legalName || name} is a registered nonprofit{b.ein ? `, EIN ${b.ein}` : ''}.</p></section> : null}
          {b?.legalName && b.legalName !== name ? <p className="sf-muted sf-small">Legal name: {b.legalName}</p> : null}
        </div>
        <aside className="sf-stack">
          <section className="sf-card sf-stack" style={{ gap: 8 }}>
            <h2 className="sf-h3">Contact</h2>
            {b?.supportPhone ? <a href={telHref(b.supportPhone)}>{b.supportPhone}</a> : null}
            {b?.supportEmail ? <a href={`mailto:${b.supportEmail}`}>{b.supportEmail}</a> : null}
            {yards.map((y) => (
              <div key={y.id}><Link className="sf-link" href={`/locations/${y.slug}`}>{y.name}</Link><br /><span className="sf-small sf-muted">{address(y).oneLine}</span></div>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}
