import type { ReactNode } from 'react';
import { getViewer } from '../../lib/data/seller';
import { AccountNav } from '../../components/AccountNav';
import { LoadError, SignInNeeded } from '../../components/ui';

/** Gate for every signed-in seller page. */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const v = await getViewer();
  if (!v.ok) return <LoadError what="your account" />;
  if (!v.data) return <SignInNeeded next="/account" what="Sign in to see your tickets, payouts and visits." />;
  return (
    <div className="sf-wrap sf-account">
      <AccountNav />
      <div className="sf-stack" style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function AccountTitle({ title, lead, children }: { title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="sf-between" style={{ alignItems: 'flex-end' }}>
      <div>
        <h1 className="sf-h1">{title}</h1>
        {lead ? <p className="sf-muted" style={{ margin: '6px 0 0' }}>{lead}</p> : null}
      </div>
      {children}
    </div>
  );
}
