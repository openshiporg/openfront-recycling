import Link from 'next/link';
import type { ReactNode } from 'react';
import { getBusiness, getYards, type Business, type Yard } from '../lib/data/public';
import { getViewer } from '../lib/data/seller';
import { address, groupedHours, mapsHref, telHref, todayStatus } from '../lib/format';
import { MobileMenu, NavLinks, type NavItem } from '../components/NavLinks';
import { IconClock, IconMail, IconPhone, IconPin } from '../components/icons';

const NAV: NavItem[] = [
  { href: '/prices', label: 'Prices' },
  { href: '/materials', label: 'Materials' },
  { href: '/sell', label: 'Sell scrap' },
  { href: '/containers', label: 'Containers' },
  { href: '/commercial', label: 'Commercial' },
  { href: '/locations', label: 'Locations' },
];

export function Brand({ business, fallbackName }: { business: Business | null; fallbackName: string | null; size?: 'header' | 'footer' }) {
  const name = business?.name || fallbackName;
  if (business?.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={business.logoUrl} alt={name || 'Home'} />;
  }
  if (!name) return <span className="sf-brand-name">Home</span>;
  const words = name.trim().split(/\s+/);
  // A long name sets its first word large and the rest beneath, as the Capella mark does.
  const head = words.length > 2 ? words[0] : name;
  const rest = words.length > 2 ? words.slice(1).join(' ') : null;
  return (
    <span>
      <span className="sf-brand-name">{head}</span>
      {rest ? <span className="sf-brand-sub">{rest}</span> : null}
    </span>
  );
}

function primaryContact(business: Business | null, yards: Yard[]) {
  const main = yards.find((y) => y.acceptsPublic !== false) || yards[0] || null;
  return {
    phone: business?.supportPhone || main?.phone || null,
    email: business?.supportEmail || main?.email || null,
    main,
  };
}

export async function StorefrontShell({ children }: { children: ReactNode }) {
  const [businessR, yardsR, viewerR] = await Promise.all([getBusiness(), getYards(), getViewer()]);
  const business = businessR.ok ? businessR.data : null;
  const yards = yardsR.ok ? yardsR.data : [];
  const viewer = viewerR.ok ? viewerR.data : null;
  const { phone, email, main } = primaryContact(business, yards);
  const fallbackName = main?.name || null;
  const account: NavItem = viewer ? { href: viewer.isStaff ? '/dashboard' : '/account', label: viewer.isStaff ? 'Dashboard' : 'My account' } : { href: '/account/sign-in', label: 'Sign in' };
  const today = main ? todayStatus(main.hours, main.timezone, main.closures) : null;
  const addr = main ? address(main) : null;

  return (
    <div data-storefront>
      <a className="sf-skip" href="#main">Skip to content</a>
      <header className="sf-header">
        <div className="sf-wrap sf-header-row">
          <Link href="/" className="sf-brand" aria-label={`${business?.name || fallbackName || 'Home'}, home`}>
            <Brand business={business} fallbackName={fallbackName} />
          </Link>
          <NavLinks items={NAV} />
          <div className="sf-header-side">
            {phone ? (
              <a className="sf-phone" href={telHref(phone)} aria-label={`Call ${phone}`}>
                <IconPhone size={24} /> <span className="sf-phone-text">{phone}</span>
              </a>
            ) : null}
            <Link className="sf-signin" href={account.href}>{account.label}</Link>
          </div>
          <MobileMenu items={NAV} account={account} />
        </div>
      </header>

      <main id="main" className="sf-main">{children}</main>

      <footer className="sf-footer">
        <div className="sf-footer-ridge" aria-hidden>
          <svg viewBox="0 0 1200 40" preserveAspectRatio="none"><path d="M0 40V22l60-10 40 8 70-16 60 14 50-6 80 12 60-18 70 10 50-4 90 14 60-12 80 6 50-10 70 12 60-8 70 10 60-14 70 8 50 6V40z" fill="currentColor" /></svg>
        </div>
        <div className="sf-wrap">
          <div className="sf-footer-row">
            <div>
              <Link href="/" className="sf-brand" aria-label="Home"><Brand business={business} fallbackName={fallbackName} size="footer" /></Link>
              {business?.about ? <p style={{ marginTop: 12 }}>{business.about.length > 160 ? `${business.about.slice(0, 157)}…` : business.about}</p> : null}
            </div>
            <div>
              <h3><IconClock size={20} /> Hours{main && yards.length > 1 ? ` · ${main.name}` : ''}</h3>
              {main && main.hours ? (
                <ul>
                  {groupedHours(main.hours).map((g) => <li key={g.days}>{g.days}: {g.text}</li>)}
                  {today ? <li style={{ marginTop: 4, color: 'var(--sf-footer-text)' }}>{today.closureReason ? `Closed today: ${today.closureReason}` : today.open ? 'Open now' : `Closed now${today.nextOpen ? ` · ${today.nextOpen.replace('Opens', 'opens')}` : ''}`}</li> : null}
                </ul>
              ) : <p>Hours are on each yard’s page.</p>}
            </div>
            <div>
              <h3><IconPin size={20} /> Location</h3>
              {addr?.oneLine ? (
                <>
                  <p>{addr.line1}<br />{addr.line2}</p>
                  <p style={{ marginTop: 6 }}><a href={mapsHref(addr.oneLine)} target="_blank" rel="noopener noreferrer">Get directions →</a></p>
                </>
              ) : <p><Link href="/locations">See our locations</Link></p>}
              {yards.length > 1 ? <p style={{ marginTop: 6 }}><Link href="/locations">All {yards.length} locations</Link></p> : null}
            </div>
            <div>
              <h3><IconPhone size={18} /> Contact</h3>
              <ul>
                {phone ? <li><a href={telHref(phone)}>{phone}</a></li> : null}
                {email ? <li><a href={`mailto:${email}`}><IconMail size={16} /> {email}</a></li> : null}
                <li><Link href="/about">About us</Link></li>
              </ul>
            </div>
            <div>
              <h3>Sellers</h3>
              <ul>
                <li><Link href="/sell/check-in">Check in online</Link></li>
                <li><Link href="/calculator">Scrap calculator</Link></li>
                <li><Link href="/rules">Selling rules</Link></li>
                <li><Link href="/fees">Drop-off fees</Link></li>
                <li><Link href="/track">Find a receipt</Link></li>
              </ul>
            </div>
          </div>
          <div className="sf-footer-base">
            <span>© {new Date().getFullYear()} {business?.legalName || business?.name || fallbackName || ''}</span>
            <Link href="/prices/print">Printable price sheet</Link>
            <Link href="/pickup">Request a pickup</Link>
            <Link href="/commercial/apply">Open a business account</Link>
            <Link href="/buyers">Buy material</Link>
            <Link href="/market">Material for sale</Link>
            <Link href="/donate">Donate your scrap</Link>
            {business?.isNonprofit && business.ein ? <span>Nonprofit · EIN {business.ein}</span> : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
