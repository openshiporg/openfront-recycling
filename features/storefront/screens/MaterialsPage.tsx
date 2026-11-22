import Link from 'next/link';
import { getCatalog, getPriceBoard } from '../lib/data/public';
import { label, perUnit } from '../lib/format';
import { LoadError, PageHead, StateCard } from '../components/ui';
import { priceText } from './PricesPage';

const FALLBACK_IMAGE: Record<string, string> = { ferrous: '/storefront/steel.jpg', non_ferrous: '/storefront/nonferrous.jpg' };
const CATEGORY_IMAGE: Record<string, string> = { copper: '/storefront/copper.jpg' };

export default async function MaterialsPage({ q, category }: { q?: string | null; category?: string | null }) {
  const [catalogR, boardR] = await Promise.all([getCatalog(), getPriceBoard(null)]);
  if (!catalogR.ok) return (<><PageHead title="Accepted materials" /><LoadError what="the materials list" /></>);
  const { categories, materials } = catalogR.data;
  const board = boardR.ok ? boardR.data : null;
  const priceBy = new Map((board?.entries || []).map((e) => [e.materialId, e]));
  const needle = (q || '').trim().toLowerCase();
  const shown = materials.filter((m) =>
    (!category || m.category?.slug === category) &&
    (!needle || [m.name, m.specName, m.description, m.category?.name].some((t) => (t || '').toLowerCase().includes(needle))),
  );
  const usedCats = categories.filter((c) => materials.some((m) => m.category?.slug === c.slug));

  return (
    <>
      <PageHead title="Accepted materials" crumbs={[{ href: '/', label: 'Home' }, { label: 'Materials' }]} lead="What we buy, what we take for a fee, and how to prepare it so you get the best price." />
      <div className="sf-wrap sf-section sf-stack">
        <form className="sf-cluster" role="search" action="/materials">
          <label className="sf-skip" htmlFor="mq">Search materials</label>
          <input id="mq" className="sf-input" style={{ maxWidth: 420 }} type="search" name="q" defaultValue={q || ''} placeholder="Search, for example copper or radiators" />
          {category ? <input type="hidden" name="category" value={category} /> : null}
          <button className="sf-btn sf-btn-sm" type="submit">Search</button>
        </form>
        {usedCats.length > 1 ? (
          <nav className="sf-chiprow" aria-label="Categories">
            <Link className="sf-chip" href={q ? `/materials?q=${encodeURIComponent(q)}` : '/materials'} aria-current={!category ? 'true' : undefined}>All</Link>
            {usedCats.map((c) => (
              <Link key={c.id} className="sf-chip" href={`/materials?category=${c.slug}${q ? `&q=${encodeURIComponent(q)}` : ''}`} aria-current={category === c.slug ? 'true' : undefined}>{c.name}</Link>
            ))}
          </nav>
        ) : null}

        {materials.length === 0 ? (
          <StateCard title="No materials listed yet">The yard has not published its materials list. Call the yard to ask what they take.</StateCard>
        ) : shown.length === 0 ? (
          <StateCard title="Nothing matches" action={<Link className="sf-btn sf-btn-sm" href="/materials">Show all materials</Link>}>No material matches “{q}”. Try a shorter word, or call the yard.</StateCard>
        ) : (
          <div className="sf-grid sf-grid-4">
            {shown.map((m) => {
              const p = priceBy.get(m.id);
              const img = m.imageUrl || CATEGORY_IMAGE[m.category?.slug || ''] || FALLBACK_IMAGE[m.category?.kind || ''] || '/storefront/yard-gate.jpg';
              return (
                <Link key={m.id} href={`/materials/${m.slug}`} className="sf-card sf-matcard">
                  <div className="sf-matcard-img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="" loading="lazy" />
                  </div>
                  <div className="sf-matcard-body">
                    <span className="sf-muted sf-small">{m.category?.name || label('categoryKind', m.category?.kind)}</span>
                    <strong>{m.name}</strong>
                    {p && board ? (
                      <span><span className={`sf-price${m.direction === 'charge_customer' ? ' sf-price-fee' : ''}`}>{priceText(p, board.currencyCode)}</span> <span className="sf-muted sf-small">{perUnit(p.unit)}{m.direction === 'charge_customer' ? ' fee' : ''}</span></span>
                    ) : (
                      <span className="sf-muted sf-small">{m.direction === 'charge_customer' ? 'Drop-off fee: ask the yard' : 'Price on request'}</span>
                    )}
                    {m.acceptsFromPublic === false ? <span className="sf-badge sf-badge-warn">Business accounts only</span> : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {board && shown.length ? <p className="sf-muted sf-small">Prices shown are {board.yard.name}’s. Open a material to see another yard’s price.</p> : null}
      </div>
    </>
  );
}
