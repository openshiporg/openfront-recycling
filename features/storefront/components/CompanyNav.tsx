'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  ['', 'Home'], ['/prices', 'Prices'], ['/tickets', 'Tickets'], ['/requests', 'Requests'], ['/containers', 'Containers'],
  ['/sites', 'Sites'], ['/statements', 'Statements'], ['/invoices', 'Invoices'], ['/reports', 'Reports'],
] as const;

/** Company portal sub-navigation (C1 to C11), a horizontal tab row. */
export function CompanyNav({ slug }: { slug: string }) {
  const p = usePathname() || '';
  const root = `/account/company/${slug}`;
  return (
    <nav className="sf-yardswitch sf-companynav" aria-label="Company">
      {ITEMS.map(([s, l]) => {
        const href = root + s;
        const current = s === '' ? p === root : p === href || p.startsWith(`${href}/`);
        return <Link key={href} href={href} aria-current={current ? 'page' : undefined}>{l}</Link>;
      })}
    </nav>
  );
}
