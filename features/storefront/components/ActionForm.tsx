'use client';

import { useActionState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { FormState } from '../lib/actions';

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

export function Submit({ children, pending: pendingText, className = 'sf-btn', disabled = false }: { children: ReactNode; pending?: string; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending || disabled} aria-disabled={pending || disabled}>
      {pending ? pendingText || 'Working…' : children}
    </button>
  );
}

/**
 * A server-action form with an error and success line. The children are a function of the last submitted
 * values so a failed submit keeps what the person typed.
 */
export function ActionForm({
  action,
  children,
  className = 'sf-form',
  encType,
}: {
  action: Action;
  children: (fields: Record<string, string>) => ReactNode;
  className?: string;
  encType?: 'multipart/form-data';
}) {
  const [state, formAction] = useActionState(action, { error: null } as FormState);
  return (
    <form action={formAction} className={className} encType={encType} noValidate={false}>
      {state.error ? <p className="sf-note sf-note-alert" role="alert" style={{ margin: 0 }}>{state.error}</p> : null}
      {state.success ? <p className="sf-note sf-note-ok" role="status" style={{ margin: 0 }}>{state.success}</p> : null}
      {children(state.fields || {})}
    </form>
  );
}
