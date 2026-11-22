'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Notice, Pill } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import { setSellerStatusAction } from '../actions';

type Role = Record<string, unknown>;
const LABEL: Record<string, string> = { flagged: 'Flag seller', do_not_buy: 'Do not buy', active: 'Clear status' };
const HELP: Record<string, string> = {
  flagged: 'The scale house sees a warning and checks with a manager before buying.',
  do_not_buy: 'The yard can’t buy from this seller. They are added to the do-not-buy list.',
  active: 'The seller can sell again.',
};

/** Status moves the server allows: active → flagged or do-not-buy, flagged → active or do-not-buy, do-not-buy → active. */
export function SellerStatusControl({ sellerId, status, role }: { sellerId: string; status: string; role: Role }) {
  const managers = Boolean(role.canManageCompliance || role.canApproveVariances || role.canManageSellers);
  const strict = Boolean(role.canManageCompliance || role.canApproveVariances);
  const moves: string[] = [];
  if (status === 'active' && (role.canManageTickets || managers)) moves.push('flagged');
  if ((status === 'active' || status === 'flagged') && strict) moves.push('do_not_buy');
  if (status === 'flagged' && managers) moves.push('active');
  if (status === 'do_not_buy' && strict) moves.push('active');
  const [to, setTo] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const cmd = useCommand();
  if (!moves.length) return null;
  return (
    <>
      <div className="flex gap-2">{moves.map((m) => <Pill key={m} variant={m === 'do_not_buy' ? 'danger' : 'raised'} onClick={() => { setReason(''); setTo(m); }}>{LABEL[m]}</Pill>)}</div>
      <Dialog open={Boolean(to)} onOpenChange={(o) => !o && setTo(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{to ? LABEL[to] : ''}</DialogTitle><DialogDescription>{to ? HELP[to] : ''}</DialogDescription></DialogHeader>
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (to) cmd.run(() => setSellerStatusAction({ sellerId, status: to, reason }), () => setTo(null)); }}>
            <div className="grid gap-1.5"><Label htmlFor="ss-reason">Reason (kept in the audit log)</Label><Input id="ss-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></div>
            {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
            <DialogFooter><Pill type="submit" variant={to === 'do_not_buy' ? 'danger' : 'primary'} disabled={cmd.pending}>{cmd.pending ? 'Saving…' : 'Confirm'}</Pill></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
