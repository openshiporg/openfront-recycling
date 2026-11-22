'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, Empty, Notice, Pill, StatusCell, Td, Track, type Tone } from '@/features/platform/lib/ui';
import { useCommand, newKey } from '@/features/platform/lib/useCommand';
import { dateTimeIn, money, payoutStatus } from '@/features/platform/lib/format';
import { cancelPayoutAction, payPayoutAction } from '../actions';
import type { QueuePayout } from '../types';

const tone: Record<string, Tone> = { ready: 'live', held: 'wait', returned: 'alert' };
const METHOD: Record<string, string> = { cash: 'Cash', check: 'Check', transfer: 'Transfer' };

type Props = { payouts: QueuePayout[]; mySessionId: string | null; myExpectedCents: number | null; timeZone: string | null; role: Record<string, boolean> };

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return <>release due, refresh</>;
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  return <>{d ? `${d} d ${h % 24} h` : h ? `${h} h ${Math.floor((ms % 3_600_000) / 60_000)} min` : `${Math.max(1, Math.round(ms / 60_000))} min`} left</>;
}

export function PayoutQueue({ payouts, mySessionId, myExpectedCents, timeZone, role }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (!payouts.length) return <Empty>No payouts waiting. Completed tickets appear here.</Empty>;
  return (
    <DataTable label="Payout queue" head={[{ label: 'Ticket' }, { label: 'Payee' }, { label: 'Status' }, { label: 'Methods' }, { label: 'Amount', className: 'text-right' }, { label: '' }]}>
      {payouts.map((p) => {
        const payee = p.seller ? `${p.seller.firstName} ${p.seller.lastName}` : p.account?.name || '—';
        const methods = Array.isArray(p.allowedMethods) && p.allowedMethods.length ? p.allowedMethods : ['cash', 'check', 'transfer'];
        return [
          <tr key={p.id}>
            <Td className="whitespace-nowrap">{p.ticket ? <Link href={`/dashboard/platform/scale-house/${p.ticket.id}`} className="font-mono text-xs underline-offset-4 hover:underline">{p.ticket.displayNumber}</Link> : '—'}<div className="text-xs text-muted-foreground">{p.ticket?.completedAt ? dateTimeIn(p.ticket.completedAt, timeZone) : ''}</div></Td>
            <Td>{payee}{p.seller?.preferredPayout ? <div className="text-xs text-muted-foreground">Prefers {p.seller.preferredPayout}</div> : null}</Td>
            <Td>
              <StatusCell tone={tone[p.status] || 'off'}>{payoutStatus(p.status)}</StatusCell>
              {p.status === 'held' && p.releaseAt ? <div className="text-xs text-muted-foreground">until {dateTimeIn(p.releaseAt, timeZone)} · <Countdown until={p.releaseAt} /></div> : null}
              {p.status === 'returned' ? <div className="text-xs text-muted-foreground">{p.returnReason}</div> : null}
              {p.replaces ? <div className="text-xs text-muted-foreground">Reissue of {p.replaces.checkNumber ? `check ${p.replaces.checkNumber}` : p.replaces.transferReference || 'a returned payment'}</div> : null}
            </Td>
            <Td className="whitespace-nowrap text-muted-foreground">{methods.map((m) => METHOD[m] || m).join(', ')}</Td>
            <Td className="text-right font-semibold tabular-nums">{money(p.amountCents)}</Td>
            <Td className="text-right">{p.status === 'ready' ? <Pill size="sm" variant={openId === p.id ? 'flat' : 'primary'} onClick={() => setOpenId(openId === p.id ? null : p.id)}>{openId === p.id ? 'Close' : 'Pay'}</Pill> : null}</Td>
          </tr>,
          openId === p.id ? (
            <tr key={`${p.id}-pay`}><Td colSpan={6} className="bg-muted/30"><PayForm payout={p} methods={methods} mySessionId={mySessionId} myExpectedCents={myExpectedCents} canCancel={Boolean(role.canApproveVariances)} onDone={() => setOpenId(null)} /></Td></tr>
          ) : null,
        ];
      })}
    </DataTable>
  );
}

function PayForm({ payout, methods, mySessionId, myExpectedCents, canCancel, onDone }: { payout: QueuePayout; methods: string[]; mySessionId: string | null; myExpectedCents: number | null; canCancel: boolean; onDone: () => void }) {
  const cmd = useCommand();
  const preferred = payout.seller?.preferredPayout && methods.includes(payout.seller.preferredPayout) ? payout.seller.preferredPayout : methods[0];
  const [method, setMethod] = useState(preferred);
  const [checkNumber, setCheckNumber] = useState('');
  const [bank, setBank] = useState('Operating');
  const [reference, setReference] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  // One key per payout form: a double press or a retry after a dropped response pays once.
  const [payKey] = useState(() => newKey('pay'));

  const pay = () => cmd.run(() => payPayoutAction({ payoutId: payout.id, method, drawerSessionId: mySessionId || undefined, checkNumber, bankAccountLabel: bank, transferReference: reference, idempotencyKey: payKey }), onDone);

  return (
    <div className="flex flex-col gap-3 py-1">
      <Track label="Payment method">
        {methods.map((m) => <Pill key={m} size="sm" variant={method === m ? 'primary' : 'flat'} aria-pressed={method === m} onClick={() => setMethod(m)}>{METHOD[m] || m}</Pill>)}
      </Track>
      {method === 'cash' ? (
        mySessionId ? <p className="text-sm">Count out <strong className="tabular-nums">{money(payout.amountCents)}</strong> from your drawer{myExpectedCents !== null ? <> (holds {money(myExpectedCents)})</> : null}. Cash may round up to the nickel under the yard’s rules.</p>
          : <Notice tone="alert">Open your drawer to pay cash.</Notice>
      ) : null}
      {method === 'check' ? (
        <div className="flex flex-wrap gap-2">
          <div className="grid gap-1.5"><Label htmlFor={`ck-${payout.id}`}>Check number</Label><Input id={`ck-${payout.id}`} className="w-40" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor={`bk-${payout.id}`}>Bank account</Label><Input id={`bk-${payout.id}`} className="w-48" value={bank} onChange={(e) => setBank(e.target.value)} /></div>
          {payout.mailToAddress ? <p className="self-end text-xs text-muted-foreground">Mail to {payout.mailToAddress}</p> : null}
        </div>
      ) : null}
      {method === 'transfer' ? (
        <div className="grid gap-1.5"><Label htmlFor={`tr-${payout.id}`}>Bank transfer reference</Label><Input id={`tr-${payout.id}`} className="w-72" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
      ) : null}
      <Track>
        <Pill variant="primary" disabled={cmd.pending || (method === 'cash' && !mySessionId)} onClick={pay}>{cmd.pending ? 'Paying…' : `Pay ${money(payout.amountCents)} by ${(METHOD[method] || method).toLowerCase()}`}</Pill>
        {canCancel ? <Pill variant="flat" onClick={() => setCancelling(!cancelling)}>Cancel payout…</Pill> : null}
      </Track>
      {cancelling ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5"><Label htmlFor={`cx-${payout.id}`}>Reason</Label><Input id={`cx-${payout.id}`} className="w-80" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <Pill variant="danger" size="sm" disabled={cmd.pending} onClick={() => cmd.run(() => cancelPayoutAction({ payoutId: payout.id, reason, idempotencyKey: newKey('pay-cancel') }), onDone)}>Cancel payout</Pill>
        </div>
      ) : null}
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
    </div>
  );
}
