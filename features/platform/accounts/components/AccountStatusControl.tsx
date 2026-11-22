'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Notice, Pill } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import { setAccountStatusAction } from '../actions';

export function AccountStatusControl({ accountId, status, canChange }: { accountId: string; status: string; canChange: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const cmd = useCommand();
  if (!canChange) return null;
  const to = status === 'active' ? 'suspended' : 'active';
  return (
    <>
      <Pill variant={to === 'suspended' ? 'danger' : 'raised'} onClick={() => { setReason(''); setOpen(true); }}>{to === 'suspended' ? 'Suspend account' : 'Reinstate account'}</Pill>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{to === 'suspended' ? 'Suspend account' : 'Reinstate account'}</DialogTitle><DialogDescription>{to === 'suspended' ? 'No new tickets, pickups or orders until it is reinstated.' : 'The account can trade again.'}</DialogDescription></DialogHeader>
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); cmd.run(() => setAccountStatusAction({ accountId, status: to, reason }), () => setOpen(false)); }}>
            <div className="grid gap-1.5"><Label htmlFor="as-reason">Reason (kept in the audit log)</Label><Input id="as-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></div>
            {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
            <DialogFooter><Pill type="submit" variant={to === 'suspended' ? 'danger' : 'primary'} disabled={cmd.pending}>{cmd.pending ? 'Saving…' : 'Confirm'}</Pill></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
