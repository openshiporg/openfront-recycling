'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Empty, Notice, Pill, StatusCell, selectClass } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import { inviteContactAction, updateContactAction } from '../actions';
import { CONTACT_ROLES, type Contact } from '../types';

export function Contacts({ accountId, contacts, canEdit }: { accountId: string; contacts: Contact[]; canEdit: boolean }) {
  const cmd = useCommand();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [sent, setSent] = useState<{ email: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {contacts.length ? contacts.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border p-3">
          <div className="min-w-0">
            <div className="font-medium">{c.user?.name || c.inviteEmail}</div>
            <div className="text-xs text-muted-foreground">{c.user?.email || c.inviteEmail}{c.user?.phone ? ` · ${c.user.phone}` : ''}</div>
            <div className="mt-1">{c.status === 'invited' ? <StatusCell tone="wait">Invited, not joined yet</StatusCell> : <StatusCell tone="live">On the team</StatusCell>}</div>
          </div>
          {canEdit ? (
            <div className="flex items-center gap-2">
              <select aria-label={`Role for ${c.user?.name || c.inviteEmail}`} className={selectClass + ' w-32'} value={c.role} disabled={cmd.pending} onChange={(e) => cmd.run(() => updateContactAction({ accountId, contactId: c.id, role: e.target.value }))}>
                {Object.entries(CONTACT_ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <Pill size="sm" variant="flat" disabled={cmd.pending} onClick={() => cmd.run(() => updateContactAction({ accountId, contactId: c.id, remove: true }))}>Remove</Pill>
            </div>
          ) : <span className="text-sm">{CONTACT_ROLES[c.role] || c.role}</span>}
        </div>
      )) : <Empty>No one on this account yet.</Empty>}
      {canEdit ? (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); const to = email; cmd.run(() => inviteContactAction({ accountId, email, role }), (d) => { const path = (d as { joinPath?: string } | undefined)?.joinPath || ''; setCopied(false); setSent({ email: to, link: `${window.location.origin}${path}` }); setEmail(''); }); }}>
          <div className="grid gap-1.5"><Label htmlFor="ac-email">Invite by email</Label><Input id="ac-email" type="email" className="w-64" value={email} onChange={(e) => { setSent(null); setEmail(e.target.value); }} /></div>
          <div className="grid gap-1.5"><Label htmlFor="ac-role">Role</Label><select id="ac-role" className={selectClass + ' w-32'} value={role} onChange={(e) => setRole(e.target.value)}>{Object.entries(CONTACT_ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <Pill type="submit" size="sm" variant="primary" disabled={cmd.pending || !email}>Invite</Pill>
        </form>
      ) : null}
      {sent ? (
        <div role="status" className="flex flex-col gap-2 rounded-[6px] border bg-muted/40 p-3 text-sm">
          <p>Send {sent.email} this link. They sign in (or create a sign-in) with that address and join the account. It works once; inviting again makes a new link.</p>
          <div className="flex gap-2"><Input readOnly aria-label="Invitation link" value={sent.link} onFocus={(e) => e.currentTarget.select()} /><Pill size="sm" onClick={() => { void navigator.clipboard?.writeText(sent.link); setCopied(true); }}>{copied ? 'Copied' : 'Copy'}</Pill></div>
        </div>
      ) : null}
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
    </div>
  );
}
