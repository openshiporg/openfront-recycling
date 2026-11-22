'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice, Pill, selectClass } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import { decideApplicationAction } from '../actions';
import { TERMS, type Application } from '../types';

export function DecideApplication({ application, priceLists }: { application: Application; priceLists: Array<{ id: string; name: string; kind: string }> }) {
  const router = useRouter();
  const cmd = useCommand();
  const [terms, setTerms] = useState(application.kind === 'buyer' ? 'prepay' : 'on_account');
  const [netDays, setNetDays] = useState('30');
  const [basis, setBasis] = useState('shipped');
  const [credit, setCredit] = useState(false);
  const [priceListId, setPriceListId] = useState('');
  const [reason, setReason] = useState('');
  return (
    <div className="flex flex-col gap-5">
      <form className="flex flex-col gap-3" onSubmit={(e) => {
        e.preventDefault();
        cmd.run(() => decideApplicationAction({ applicationId: application.id, decision: 'approve', paymentTerms: terms, netDays: terms === 'net' ? Number(netDays) : 0, weightBasis: basis, hasCredit: credit, priceListId: priceListId || undefined }),
          (d) => { const id = (d as { account?: { id: string } | null } | undefined)?.account?.id; if (id) router.push(`/dashboard/platform/accounts/${id}`); });
      }}>
        <div className="grid gap-1.5"><Label htmlFor="ap-terms">Payment terms</Label><select id="ap-terms" className={selectClass} value={terms} onChange={(e) => setTerms(e.target.value)}>{Object.entries(TERMS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        {terms === 'net' ? <div className="grid gap-1.5"><Label htmlFor="ap-net">Net days</Label><Input id="ap-net" inputMode="numeric" value={netDays} onChange={(e) => setNetDays(e.target.value)} className="w-28" /></div> : null}
        <div className="grid gap-1.5"><Label htmlFor="ap-pl">Price list</Label><select id="ap-pl" className={selectClass} value={priceListId} onChange={(e) => setPriceListId(e.target.value)}><option value="">Yard board</option>{priceLists.filter((p) => p.kind !== 'board').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        {application.kind === 'buyer' ? (
          <>
            <div className="grid gap-1.5"><Label htmlFor="ap-basis">Weights invoiced on</Label><select id="ap-basis" className={selectClass} value={basis} onChange={(e) => setBasis(e.target.value)}><option value="shipped">Our shipped weight</option><option value="received">Their received weight</option></select></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={credit} onChange={(e) => setCredit(e.target.checked)} />Allow credit (ship before payment)</label>
          </>
        ) : null}
        <Pill type="submit" variant="primary" disabled={cmd.pending}>{cmd.pending ? 'Saving…' : 'Approve and open account'}</Pill>
      </form>
      <form className="flex flex-col gap-3 border-t pt-4" onSubmit={(e) => { e.preventDefault(); cmd.run(() => decideApplicationAction({ applicationId: application.id, decision: 'decline', reason })); }}>
        <div className="grid gap-1.5"><Label htmlFor="ap-reason">Reason for declining (sent to the applicant)</Label><Input id="ap-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <Pill type="submit" variant="danger" disabled={cmd.pending}>Decline</Pill>
      </form>
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
    </div>
  );
}
