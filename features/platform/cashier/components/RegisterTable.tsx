'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { DataTable, Empty, Notice, Pill, StatusCell, Td } from '@/features/platform/lib/ui';
import { useCommand, newKey } from '@/features/platform/lib/useCommand';
import { dateTimeIn, money, payoutStatus } from '@/features/platform/lib/format';
import { returnPayoutAction } from '../actions';
import type { RegisterRow } from '../types';

/** Check or transfer register. Finance can mark a check or transfer as come back, which reissues it to the queue. */
export function RegisterTable({ rows, method, timeZone, canReturn }: { rows: RegisterRow[]; method: 'check' | 'transfer'; timeZone: string | null; canReturn: boolean }) {
  const [returning, setReturning] = useState<string | null>(null);
  if (!rows.length) return <Empty>No {method === 'check' ? 'checks' : 'transfers'} written yet.</Empty>;
  return (
    <DataTable label={method === 'check' ? 'Check register' : 'Transfer register'} head={[{ label: 'Paid' }, { label: method === 'check' ? 'Check' : 'Reference' }, { label: 'Payee' }, { label: 'Ticket' }, { label: 'Status' }, { label: 'Amount', className: 'text-right' }, { label: '' }]}>
      {rows.map((r) => [
        <tr key={r.id}>
          <Td className="whitespace-nowrap">{dateTimeIn(r.paidAt, timeZone)}<div className="text-xs text-muted-foreground">{r.paidBy?.name}</div></Td>
          <Td className="font-mono text-xs">{method === 'check' ? <>{r.checkNumber}<div className="font-sans text-muted-foreground">{r.bankAccountLabel}</div></> : r.transferReference}</Td>
          <Td>{r.seller ? `${r.seller.firstName} ${r.seller.lastName}` : r.account?.name || '—'}</Td>
          <Td>{r.ticket ? <Link href={`/dashboard/platform/scale-house/${r.ticket.id}`} className="font-mono text-xs underline-offset-4 hover:underline">{r.ticket.displayNumber}</Link> : '—'}</Td>
          <Td><StatusCell tone={r.status === 'returned' ? 'alert' : 'live'}>{payoutStatus(r.status)}</StatusCell>{r.returnReason ? <div className="text-xs text-muted-foreground">{r.returnReason}</div> : null}</Td>
          <Td className="text-right tabular-nums">{money(r.amountCents)}</Td>
          <Td className="text-right">{canReturn && r.status === 'paid' ? <Pill size="sm" variant="flat" onClick={() => setReturning(returning === r.id ? null : r.id)}>{returning === r.id ? 'Close' : 'Came back…'}</Pill> : null}</Td>
        </tr>,
        returning === r.id ? <tr key={`${r.id}-ret`}><Td colSpan={7} className="bg-muted/30"><ReturnForm id={r.id} onDone={() => setReturning(null)} /></Td></tr> : null,
      ])}
    </DataTable>
  );
}

function ReturnForm({ id, onDone }: { id: string; onDone: () => void }) {
  const cmd = useCommand();
  const [reason, setReason] = useState('');
  return (
    <div className="flex flex-col gap-2 py-1">
      <p className="text-sm text-muted-foreground">Marks the payment as returned and puts a new payout for the same amount back in the queue.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Reason" className="w-80" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Stop payment, check lost, transfer rejected" />
        <Pill size="sm" variant="danger" disabled={cmd.pending} onClick={() => cmd.run(() => returnPayoutAction({ payoutId: id, reason, idempotencyKey: newKey('pay-return') }), onDone)}>{cmd.pending ? 'Saving…' : 'Mark returned and reissue'}</Pill>
      </div>
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
    </div>
  );
}
