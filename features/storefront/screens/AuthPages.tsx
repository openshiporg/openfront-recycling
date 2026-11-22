import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getViewer } from '../lib/data/seller';
import { PageHead } from '../components/ui';
import { RegisterForm, ResetRedeemForm, ResetRequestForm, SignInForm } from '../components/forms/AuthForms';

const safe = (n?: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '');

async function bounceIfSignedIn(next?: string | null) {
  const v = await getViewer();
  if (v.ok && v.data) redirect(v.data.isStaff ? '/dashboard' : safe(next) || '/account');
}

function Narrow({ children }: { children: React.ReactNode }) {
  return <div className="sf-wrap sf-section" style={{ maxWidth: 520 }}><div className="sf-card">{children}</div></div>;
}

export async function SignInPage({ next }: { next?: string | null }) {
  await bounceIfSignedIn(next);
  return (
    <>
      <PageHead title="Sign in" lead="See your tickets and payouts, and check in before you drive over." />
      <Narrow>
        <SignInForm next={safe(next)} />
        <hr style={{ border: 0, borderTop: '1px solid var(--sf-rule)', margin: '20px 0' }} />
        <p style={{ margin: 0 }}>New here? <Link className="sf-link" href={`/account/register${next ? `?next=${encodeURIComponent(safe(next))}` : ''}`}>Create an account</Link></p>
      </Narrow>
    </>
  );
}

export async function RegisterPage({ next }: { next?: string | null }) {
  await bounceIfSignedIn(next);
  return (
    <>
      <PageHead title="Create an account" lead="It takes a minute. After this you add your ID and vehicle once, and checking in takes seconds." />
      <Narrow>
        <RegisterForm next={safe(next)} />
        <p className="sf-small sf-muted" style={{ margin: '16px 0 0' }}>Already have an account? <Link className="sf-link" href="/account/sign-in">Sign in</Link></p>
      </Narrow>
    </>
  );
}

export function ResetPage({ token }: { token?: string | null }) {
  return (
    <>
      <PageHead title={token ? 'Choose a new password' : 'Reset your password'} lead={token ? undefined : 'We’ll email you a link to choose a new password.'} />
      <Narrow>{token ? <ResetRedeemForm token={token} /> : <ResetRequestForm />}</Narrow>
    </>
  );
}
