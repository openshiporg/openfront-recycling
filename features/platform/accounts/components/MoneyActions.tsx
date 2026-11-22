'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice, Pill } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import { buildSettlementAction, invoiceChargesAction } from '../actions';

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function MoneyActions({ accountId, netDays }: { accountId: string; netDays: number }) {
  const today = new Date();
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const [start, setStart] = useState(ymd(first));
  const [end, setEnd] = useState(ymd(today));
  const settle = useCommand();
  const bill = useCommand();
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); setDone(null); settle.run(() => buildSettlementAction({ accountId, periodStart: start, periodEnd: end }), () => setDone('Settlement built as a draft. Approve it under Finance.')); }}>
        <h3 className="text-sm font-medium">Build a settlement</h3>
        <p className="text-xs text-muted-foreground">Gathers completed on-account tickets and open charges in the period into one statement.</p>
        <div className="flex flex-wrap gap-2">
          <div className="grid gap-1.5"><Label htmlFor="ma-s">From</Label><Input id="ma-s" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="ma-e">To</Label><Input id="ma-e" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <Pill type="submit" size="sm" className="self-start" disabled={settle.pending}>{settle.pending ? 'Building…' : 'Build settlement'}</Pill>
        {settle.error ? <Notice tone="alert">{settle.error}</Notice> : null}
      </form>
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Invoice open charges</h3>
        <p className="text-xs text-muted-foreground">Puts every open charge (rentals, hauls, fees) on one invoice due in {netDays || 0} days.</p>
        <Pill size="sm" className="self-start" disabled={bill.pending} onClick={() => { setDone(null); bill.run(() => invoiceChargesAction({ accountId, netDays }), () => setDone('Invoice created.')); }}>{bill.pending ? 'Invoicing…' : 'Invoice charges'}</Pill>
        {bill.error ? <Notice tone="alert">{bill.error}</Notice> : null}
      </div>
      {done ? <p role="status" className="text-sm text-muted-foreground md:col-span-2">{done}</p> : null}
    </div>
  );
}
