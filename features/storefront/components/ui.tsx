import Link from 'next/link';
import type { ReactNode } from 'react';
import { qrSvg } from '../lib/qr';

export function PageHead({ title, lead, crumbs, children }: { title: ReactNode; lead?: ReactNode; crumbs?: Array<{ href?: string; label: string }>; children?: ReactNode }) {
  return (
    <header className="sf-pagehead">
      <div className="sf-wrap">
        {crumbs?.length ? (
          <nav className="sf-crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={i}>
                {i > 0 && ' / '}
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
              </span>
            ))}
          </nav>
        ) : null}
        <h1>{title}</h1>
        {lead ? <p>{lead}</p> : null}
        {children}
      </div>
    </header>
  );
}

/** Empty, error, not-allowed and not-found states, all in the same card. */
export function StateCard({ title, children, action, tone = 'neutral', role }: { title: string; children?: ReactNode; action?: ReactNode; tone?: 'neutral' | 'alert'; role?: 'alert' | 'status' }) {
  return (
    <div className="sf-state" role={role || (tone === 'alert' ? 'alert' : undefined)}>
      <div className="sf-wrap">
        <div className="sf-state-card">
          <h2 className="sf-h2">{title}</h2>
          {children ? <p>{children}</p> : null}
          {action ? <div className="sf-cluster" style={{ justifyContent: 'center' }}>{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function LoadError({ what = 'this page' }: { what?: string }) {
  return (
    <StateCard title="We couldn’t load this" tone="alert" action={<Link className="sf-btn sf-btn-sm" href="">Try again</Link>}>
      Something went wrong loading {what}. Nothing you did caused it. Try again in a moment, or call the yard.
    </StateCard>
  );
}

export function NotOpenYet() {
  return (
    <StateCard title="Opening soon">
      This yard’s website is being set up. Prices, materials and online check-in will appear here as soon as the owner publishes them.
    </StateCard>
  );
}

export function SignInNeeded({ next, what }: { next: string; what: string }) {
  return (
    <StateCard
      title="Sign in to continue"
      action={
        <>
          <Link className="sf-btn sf-btn-sm" href={`/account/sign-in?next=${encodeURIComponent(next)}`}>Sign in</Link>
          <Link className="sf-btn sf-btn-ghost sf-btn-sm" href={`/account/register?next=${encodeURIComponent(next)}`}>Create an account</Link>
        </>
      }
    >
      {what}
    </StateCard>
  );
}

export function Qr({ value, label, className = 'sf-qr' }: { value: string; label: string; className?: string }) {
  // The SVG is produced locally from our own pass code or URL, never from user-supplied markup.
  return <div className={className} role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: qrSvg(value) }} />;
}

export function Skeleton({ h = 18, w = '100%' }: { h?: number; w?: number | string }) {
  return <div className="sf-skeleton" style={{ height: h, width: w }} />;
}

export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="sf-pagehead"><div className="sf-wrap"><span className="sf-skip">Loading</span><Skeleton h={46} w="40%" /><div style={{ height: 12 }} /><Skeleton h={18} w="60%" /></div></div>
      <div className="sf-wrap sf-section sf-stack">
        {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} h={22} />)}
      </div>
    </div>
  );
}
