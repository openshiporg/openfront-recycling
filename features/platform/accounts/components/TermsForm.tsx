'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Notice, Pill, selectClass } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import { updateTermsAction } from '../actions';
import { CYCLES, TERMS, type AccountDetail } from '../types';

export function TermsForm({ account, priceLists }: { account: AccountDetail; priceLists: Array<{ id: string; name: string; kind: string }> }) {
  const cmd = useCommand();
  const [saved, setSaved] = useState(false);
  const [f, setF] = useState({
    paymentTerms: account.paymentTerms, netDays: String(account.netDays ?? 0), settlementCycle: account.settlementCycle, weightBasis: account.weightBasis, hasCredit: account.hasCredit,
    priceListId: account.priceList?.id || '', billingEmail: account.billingEmail || '', phone: account.phone || '', notes: account.notes || '',
  });
  const set = (p: Partial<typeof f>) => { setSaved(false); setF((x) => ({ ...x, ...p })); };
  return (
    <form className="flex max-w-3xl flex-col gap-4" onSubmit={(e) => { e.preventDefault(); cmd.run(() => updateTermsAction(account.id, f), () => setSaved(true)); }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5"><Label htmlFor="tf-terms">Payment terms</Label><select id="tf-terms" className={selectClass} value={f.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })}>{Object.entries(TERMS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div className="grid gap-1.5"><Label htmlFor="tf-net">Net days</Label><Input id="tf-net" inputMode="numeric" value={f.netDays} onChange={(e) => set({ netDays: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="tf-cycle">Settlement cycle</Label><select id="tf-cycle" className={selectClass} value={f.settlementCycle} onChange={(e) => set({ settlementCycle: e.target.value })}>{Object.entries(CYCLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5"><Label htmlFor="tf-pl">Price list</Label><select id="tf-pl" className={selectClass} value={f.priceListId} onChange={(e) => set({ priceListId: e.target.value })}><option value="">Yard board</option>{priceLists.filter((p) => p.kind !== 'board').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="grid gap-1.5"><Label htmlFor="tf-basis">Buyer weights on</Label><select id="tf-basis" className={selectClass} value={f.weightBasis} onChange={(e) => set({ weightBasis: e.target.value })}><option value="shipped">Our shipped weight</option><option value="received">Their received weight</option></select></div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" className="size-4" checked={f.hasCredit} onChange={(e) => set({ hasCredit: e.target.checked })} />Buyer has credit</label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5"><Label htmlFor="tf-email">Billing email</Label><Input id="tf-email" type="email" value={f.billingEmail} onChange={(e) => set({ billingEmail: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="tf-phone">Phone</Label><Input id="tf-phone" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></div>
      </div>
      <div className="grid gap-1.5"><Label htmlFor="tf-notes">Staff notes</Label><Textarea id="tf-notes" rows={3} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
      <div className="flex items-center gap-3"><Pill type="submit" variant="primary" disabled={cmd.pending}>{cmd.pending ? 'Saving…' : 'Save terms'}</Pill>{saved ? <span role="status" className="text-sm text-muted-foreground">Saved.</span> : null}</div>
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
    </form>
  );
}
