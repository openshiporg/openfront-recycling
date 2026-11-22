'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { IconMenu } from './icons';

export type NavItem = { href: string; label: string };

function isCurrent(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname() || '/';
  return (
    <nav className="sf-nav" aria-label="Main">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={isCurrent(pathname, i.href) ? 'page' : undefined}>{i.label}</Link>
      ))}
    </nav>
  );
}

export function MobileMenu({ items, account }: { items: NavItem[]; account: NavItem }) {
  const pathname = usePathname() || '/';
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (ref.current) ref.current.open = false; }, [pathname]);
  return (
    <details className="sf-menu" ref={ref}>
      <summary aria-label="Menu"><IconMenu /> Menu</summary>
      <nav className="sf-menu-panel" aria-label="Main">
        {[...items, account].map((i) => (
          <Link key={i.href} href={i.href} aria-current={isCurrent(pathname, i.href) ? 'page' : undefined}>{i.label}</Link>
        ))}
      </nav>
    </details>
  );
}
