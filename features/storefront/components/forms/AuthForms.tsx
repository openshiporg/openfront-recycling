'use client';

import Link from 'next/link';
import { redeemResetAction, registerAction, requestResetAction, signInAction } from '../../lib/actions';
import { ActionForm, Submit } from '../ActionForm';

export function SignInForm({ next }: { next?: string }) {
  return (
    <ActionForm action={signInAction}>
      {(f) => (
        <>
          <input type="hidden" name="next" value={next || ''} />
          <div className="sf-field"><label htmlFor="em">Email</label><input id="em" name="email" type="email" className="sf-input" autoComplete="email" required defaultValue={f.email} /></div>
          <div className="sf-field"><label htmlFor="pw">Password</label><input id="pw" name="password" type="password" className="sf-input" autoComplete="current-password" required /></div>
          <Submit pending="Signing in…">Sign in</Submit>
          <p className="sf-small" style={{ margin: 0 }}><Link className="sf-link" href="/account/reset">Forgot your password?</Link></p>
        </>
      )}
    </ActionForm>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  return (
    <ActionForm action={registerAction}>
      {(f) => (
        <>
          <input type="hidden" name="next" value={next || ''} />
          <div className="sf-field"><label htmlFor="nm">Full name</label><input id="nm" name="name" className="sf-input" autoComplete="name" required defaultValue={f.name} /></div>
          <div className="sf-field"><label htmlFor="em">Email</label><input id="em" name="email" type="email" className="sf-input" autoComplete="email" required defaultValue={f.email} /></div>
          <div className="sf-field"><label htmlFor="ph">Mobile phone</label><input id="ph" name="phone" type="tel" className="sf-input" autoComplete="tel" required defaultValue={f.phone} /></div>
          <div className="sf-field"><label htmlFor="pw">Password</label><input id="pw" name="password" type="password" className="sf-input" autoComplete="new-password" minLength={10} required /><span className="sf-hint">At least 10 characters.</span></div>
          <Submit pending="Creating your account…">Create account</Submit>
        </>
      )}
    </ActionForm>
  );
}

export function ResetRequestForm() {
  return (
    <ActionForm action={requestResetAction}>
      {(f) => (
        <>
          <div className="sf-field"><label htmlFor="em">Email on your account</label><input id="em" name="email" type="email" className="sf-input" autoComplete="email" required defaultValue={f.email} /></div>
          <Submit pending="Sending…">Email me a reset link</Submit>
        </>
      )}
    </ActionForm>
  );
}

export function ResetRedeemForm({ token }: { token: string }) {
  return (
    <ActionForm action={redeemResetAction}>
      {() => (
        <>
          <input type="hidden" name="token" value={token} />
          <div className="sf-field"><label htmlFor="em">Email on your account</label><input id="em" name="email" type="email" className="sf-input" autoComplete="email" required /></div>
          <div className="sf-field"><label htmlFor="pw">New password</label><input id="pw" name="password" type="password" className="sf-input" autoComplete="new-password" minLength={10} required /></div>
          <Submit pending="Saving…">Set new password</Submit>
          <p className="sf-small" style={{ margin: 0 }}><Link className="sf-link" href="/account/sign-in">Back to sign in</Link></p>
        </>
      )}
    </ActionForm>
  );
}
