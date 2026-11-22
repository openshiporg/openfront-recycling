'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '../lib/actions';

const ITEMS = [
  { href: '/account', label: 'Overview', exact: true },
  { href: '/sell/check-in', label: 'Check in' },
  { href: '/account/visits', label: 'Visits' },
  { href: '/account/tickets', label: 'Tickets' },
  { href: '/account/payouts', label: 'Payouts' },
  { href: '/account/statements', label: 'Statements' },
  { href: '/account/pickups', label: 'Pickups' },
  { href: '/account/profile', label: 'My details' },
  { href: '/account/identity', label: 'ID' },
  { href: '/account/vehicles', label: 'Vehicles' },
  { href: '/account/applications', label: 'Applications' },
  { href: '/account/company', label: 'Company portal' },
];

export function AccountNav({ extra = [] }: { extra?: Array<{ href: string; label: string }> }) {
  const p = usePathname() || '';
  return (
    <nav className="sf-acctnav" aria-label="Your account">
      {[...ITEMS, ...extra].map((i) => {
        const current = 'exact' in i && i.exact ? p === i.href : p === i.href || p.startsWith(`${i.href}/`);
        return <Link key={i.href} href={i.href} aria-current={current ? 'page' : undefined}>{i.label}</Link>;
      })}
      <form action={signOutAction}><button type="submit">Sign out</button></form>
    </nav>
  );
}
