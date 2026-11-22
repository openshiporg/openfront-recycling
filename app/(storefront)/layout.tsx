import type { Metadata } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import { getBusiness } from '@/features/storefront/lib/data/public';
import '@/features/storefront/styles/storefront.css';

// Capella: heavy condensed capitals for headings, a plain sans for body text.
const display = Barlow_Condensed({ variable: '--font-sf-display', weight: ['700', '800'], subsets: ['latin'] });
const body = Barlow({ variable: '--font-sf-body', weight: ['400', '500', '600', '700'], subsets: ['latin'] });

export async function generateMetadata(): Promise<Metadata> {
  const r = await getBusiness();
  const b = r.ok ? r.data : null;
  const name = b?.name || 'Scrap yard';
  return {
    title: { default: name, template: `%s · ${name}` },
    description: b?.about || `Today's scrap prices, accepted materials, hours and online check-in for ${name}.`,
    icons: b?.logoUrl ? { icon: b.logoUrl } : { icon: '/favicon.svg' },
  };
}

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${body.variable}`}>{children}</div>;
}
