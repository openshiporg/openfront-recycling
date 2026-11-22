'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Company portal sub-navigation. The server picks the tabs from what the account is (supplier, buyer, nonprofit). */
export function CompanyNav({ slug, items }: { slug: string; items: Array<[string, string]> }) {
  const p = usePathname() || '';
  const root = `/account/company/${slug}`;
  return (
    <nav className="sf-yardswitch sf-companynav" aria-label="Company">
      {items.map(([s, l]) => {
        const href = root + s;
        const current = s === '' ? p === root : p === href || p.startsWith(`${href}/`);
        return <Link key={href} href={href} aria-current={current ? 'page' : undefined}>{l}</Link>;
      })}
    </nav>
  );
}
