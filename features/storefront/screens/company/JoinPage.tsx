import Link from 'next/link';
import { getViewer } from '../../lib/data/seller';
import { LoadError, SignInNeeded, StateCard } from '../../components/ui';
import { AcceptInviteForm } from '../../components/forms/CompanyForms';

/** Join a company account from the invitation link staff send (`/account/company/join?token=…`). */
export async function CompanyJoinPage({ token }: { token: string | null }) {
  const next = token ? `/account/company/join?token=${encodeURIComponent(token)}` : '/account/company/join';
  const v = await getViewer();
  let body;
  if (!v.ok) body = <LoadError what="your account" />;
  else if (!token) body = <StateCard title="This invitation link is incomplete" action={<Link className="sf-btn sf-btn-sm" href="/account/company">Your companies</Link>}>Open the link from the invitation email again, or ask the person who invited you to send a new one.</StateCard>;
  else if (!v.data) body = <SignInNeeded next={next} what="Sign in, or create an account, with the email address the invitation was sent to. You come back here to join." />;
  else body = (
    <section className="sf-card sf-stack" style={{ maxWidth: 560 }}>
      <h2 className="sf-h3" style={{ margin: 0 }}>You have been invited to a company account</h2>
      <p style={{ margin: 0 }}>You are signed in as <strong>{v.data.email}</strong>. Joining lets you see the company’s tickets, requests and invoices as your role allows.</p>
      <AcceptInviteForm token={token} />
      <p className="sf-small sf-muted" style={{ margin: 0 }}>Wrong account? <Link className="sf-link" href={`/account/sign-in?next=${encodeURIComponent(next)}`}>Sign in with another email</Link>.</p>
    </section>
  );
  return (
    <div className="sf-wrap sf-stack" style={{ paddingBlock: 40 }}>
      <h1 className="sf-h1">Join a company account</h1>
      {body}
    </div>
  );
}
