'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, Empty, Notice, Pill, Td, Track } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import { dateTimeIn, money, toCents } from '@/features/platform/lib/format';
import { useMoneyIntent } from '@/features/platform/lib/useMoneyIntent';
import { collectAction } from '../actions';
import type { CollectRow } from '../types';

const METHODS = [{ v: 'cash', l: 'Cash' }, { v: 'check', l: 'Check' }, { v: 'ach', l: 'ACH' }, { v: 'wire', l: 'Wire' }];

/** Fee tickets where the customer owes the yard (tipping fees, disposal): take the money at the window. */
export function CollectTable({ rows, mySessionId, timeZone }: { rows: CollectRow[]; mySessionId: string | null; timeZone: string | null }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (!rows.length) return <Empty>No fee tickets waiting for payment.</Empty>;
  return (
    <DataTable label="Fee tickets to collect" head={[{ label: 'Invoice' }, { label: 'Ticket' }, { label: 'Customer' }, { label: 'Balance', className: 'text-right' }, { label: '' }]}>
      {rows.map((r) => [
        <tr key={r.id}>
          <Td className="whitespace-nowrap">No. {r.number}<div className="text-xs text-muted-foreground">{dateTimeIn(r.createdAt, timeZone)}</div></Td>
          <Td>{r.ticket ? <Link href={`/dashboard/platform/scale-house/${r.ticket.id}`} className="font-mono text-xs underline-offset-4 hover:underline">{r.ticket.displayNumber}</Link> : '—'}</Td>
          <Td>{r.sellerName || r.accountName || '—'}</Td>
          <Td className="text-right font-semibold tabular-nums">{money(r.totalCents - r.paidCents)}{r.paidCents ? <div className="text-xs font-normal text-muted-foreground">of {money(r.totalCents)}</div> : null}</Td>
          <Td className="text-right"><Pill size="sm" variant={openId === r.id ? 'flat' : 'primary'} onClick={() => setOpenId(openId === r.id ? null : r.id)}>{openId === r.id ? 'Close' : 'Collect'}</Pill></Td>
        </tr>,
        openId === r.id ? <tr key={`${r.id}-c`}><Td colSpan={5} className="bg-muted/30"><CollectForm row={r} mySessionId={mySessionId} onDone={() => setOpenId(null)} /></Td></tr> : null,
      ])}
    </DataTable>
  );
}

function CollectForm({ row, mySessionId, onDone }: { row: CollectRow; mySessionId: string | null; onDone: () => void }) {
  const cmd = useCommand();
  const balance = row.totalCents - row.paidCents;
  const [method, setMethod] = useState('cash');
  const [amount, setAmount] = useState((balance / 100).toFixed(2));
  const [reference, setReference] = useState('');
  const intent = useMoneyIntent(`invoice-collect:${row.id}`);
  return (
    <div className="flex flex-col gap-3 py-1">
      <Track label="Method">{METHODS.map((m) => <Pill key={m.v} size="sm" variant={method === m.v ? 'primary' : 'flat'} aria-pressed={method === m.v} onClick={() => setMethod(m.v)}>{m.l}</Pill>)}</Track>
      <div className="flex flex-wrap gap-2">
        <div className="grid gap-1.5"><Label htmlFor={`ca-${row.id}`}>Amount received ($)</Label><Input id={`ca-${row.id}`} inputMode="decimal" className="w-40" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        {method !== 'cash' ? <div className="grid gap-1.5"><Label htmlFor={`cr-${row.id}`}>{method === 'check' ? 'Check number' : 'Reference'}</Label><Input id={`cr-${row.id}`} className="w-56" value={reference} onChange={(e) => setReference(e.target.value)} /></div> : null}
      </div>
      {method === 'cash' && !mySessionId ? <Notice tone="alert">Open your drawer to take cash.</Notice> : null}
      <Pill variant="primary" className="self-start" disabled={cmd.pending || (method === 'cash' && !mySessionId)} onClick={() => {
        const c = toCents(amount);
        if (!c) return cmd.setError('Enter the amount received.');
        cmd.run(() => intent({ invoiceId: row.id, method, amountCents: c, reference, drawerSessionId: mySessionId || undefined }, collectAction), onDone);
      }}>{cmd.pending ? 'Saving…' : 'Record payment'}</Pill>
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
    </div>
  );
}
