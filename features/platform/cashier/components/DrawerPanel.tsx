'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, Empty, Notice, Pill, Readouts, Section, StatusCell, Td, Track, type Tone } from '@/features/platform/lib/ui';
import { useCommand, newKey } from '@/features/platform/lib/useCommand';
import { dateTimeIn, money, timeIn, toCents } from '@/features/platform/lib/format';
import { approveCloseAction, countDrawerAction, moveCashAction, openDrawerAction, recountDrawerAction } from '../actions';
import type { DrawerRow } from '../types';

const KIND: Record<string, string> = { open: 'Opening float', payout: 'Paid out', collect: 'Taken in', add: 'Added from safe', drop: 'Dropped to safe' };
const sign = (kind: string) => (kind === 'payout' || kind === 'drop' ? -1 : 1);

type Props = { drawer: DrawerRow; timeZone: string | null; role: Record<string, boolean>; iHaveOpen: boolean };

export function DrawerPanel({ drawer, timeZone, role, iHaveOpen }: Props) {
  const s = drawer.session;
  const tone: Tone = !s ? 'off' : s.status === 'counting' ? 'alert' : 'live';
  const canHandle = Boolean(s && (s.isMine || role.canManageCashDrawers));
  return (
    <Section title={drawer.name} tone={tone} actions={<span className="text-xs text-muted-foreground">{!s ? 'Closed' : s.status === 'counting' ? `Counted · waiting for approval · ${s.cashierName || ''}` : `Open · ${s.isMine ? 'your drawer' : s.cashierName || ''}`}</span>}>
      {!s ? <OpenDrawer drawer={drawer} timeZone={timeZone} disabled={iHaveOpen || !(role.canPaySellers || role.canManageCashDrawers)} /> : (
        <div className="flex flex-col gap-4">
          <Readouts items={[
            { label: 'Expected in drawer', value: money(s.expectedCents), tone: 'live' },
            { label: 'Opening float', value: money(s.openingFloatCents) },
            ...(['payout', 'collect', 'add', 'drop'] as const).map((k) => {
              const t = s.totals.find((x) => x.kind === k);
              return { label: `${KIND[k]}${t ? ` (${t.count})` : ''}`, value: money(t?.amountCents || 0) };
            }),
            ...(s.status === 'counting' ? [{ label: 'Variance', value: `${(s.varianceCents || 0) > 0 ? '+' : ''}${money(s.varianceCents)}`, tone: 'alert' as Tone }] : []),
          ]} />
          {s.status === 'open' && canHandle ? <div className="grid gap-4 lg:grid-cols-2"><MoveCash sessionId={s.id} /><CountDrawer sessionId={s.id} /></div> : null}
          {s.status === 'open' && !canHandle ? <Notice>This is {s.cashierName || 'another cashier'}’s drawer.</Notice> : null}
          {s.status === 'counting' ? <Variance sessionId={s.id} counted={s.countedCents} expected={s.expectedCents} variance={s.varianceCents} canRecount={canHandle} canApprove={Boolean(role.canApproveVariances)} mine={s.isMine} /> : null}
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Last {s.events.length} drawer movements · opened {dateTimeIn(s.openedAt, timeZone)}</h3>
            {s.events.length ? (
              <DataTable label={`${drawer.name} movements`} head={[{ label: 'Time' }, { label: 'Movement' }, { label: 'Amount', className: 'text-right' }, { label: 'Note' }]}>
                {s.events.map((e) => (
                  <tr key={e.id}>
                    <Td className="whitespace-nowrap tabular-nums">{timeIn(e.createdAt, timeZone)}</Td>
                    <Td><StatusCell tone={sign(e.kind) < 0 ? 'wait' : 'live'}>{KIND[e.kind] || e.kind}</StatusCell></Td>
                    <Td className="text-right tabular-nums">{sign(e.kind) < 0 ? '−' : '+'}{money(e.amountCents)}</Td>
                    <Td className="text-muted-foreground">{e.ticketId ? <Link className="underline-offset-4 hover:underline" href={`/dashboard/platform/scale-house/${e.ticketId}`}>Ticket</Link> : null}{e.ticketId && e.note ? ' · ' : ''}{e.note}</Td>
                  </tr>
                ))}
              </DataTable>
            ) : <Empty>No movements yet.</Empty>}
          </div>
        </div>
      )}
    </Section>
  );
}

function OpenDrawer({ drawer, timeZone, disabled }: { drawer: DrawerRow; timeZone: string | null; disabled: boolean }) {
  const cmd = useCommand();
  const [float, setFloat] = useState('');
  const id = `float-${drawer.drawerId}`;
  const last = drawer.lastClosed;
  return (
    <div className="flex flex-col gap-3">
      {last ? <p className="text-sm text-muted-foreground">Last closed {dateTimeIn(last.closedAt, timeZone)}{last.cashierName ? ` by ${last.cashierName}` : ''} · counted {money(last.countedCents)}{last.varianceCents ? ` · variance ${money(last.varianceCents)}${last.approvedByName ? `, approved by ${last.approvedByName}` : ''}` : ' · balanced'}</p> : <p className="text-sm text-muted-foreground">Not opened yet.</p>}
      {disabled ? <p className="text-sm text-muted-foreground">You already have a drawer open.</p> : (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
          e.preventDefault();
          const c = toCents(float);
          if (c === null) return cmd.setError('Enter the counted float in dollars.');
          cmd.run(() => openDrawerAction({ drawerId: drawer.drawerId, openingFloatCents: c, idempotencyKey: newKey('drawer-open') }), () => setFloat(''));
        }}>
          <div className="grid gap-1.5"><Label htmlFor={id}>Counted opening float ($)</Label><Input id={id} inputMode="decimal" className="w-44" value={float} onChange={(e) => setFloat(e.target.value)} placeholder="500.00" /></div>
          <Pill type="submit" variant="primary" disabled={cmd.pending}>{cmd.pending ? 'Opening…' : 'Open drawer'}</Pill>
        </form>
      )}
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
    </div>
  );
}

function MoveCash({ sessionId }: { sessionId: string }) {
  const cmd = useCommand();
  const [kind, setKind] = useState<'add' | 'drop'>('drop');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  return (
    <form className="flex flex-col gap-2 rounded-[6px] border p-3" onSubmit={(e) => {
      e.preventDefault();
      const c = toCents(amount);
      if (!c) return cmd.setError('Enter the amount in dollars.');
      cmd.run(() => moveCashAction({ sessionId, kind, amountCents: c, note, idempotencyKey: newKey('drawer-move') }), () => { setAmount(''); setNote(''); });
    }}>
      <h3 className="text-sm font-medium">Safe</h3>
      <Track label="Movement">
        <Pill size="sm" variant={kind === 'drop' ? 'primary' : 'flat'} aria-pressed={kind === 'drop'} onClick={() => setKind('drop')}>Drop to safe</Pill>
        <Pill size="sm" variant={kind === 'add' ? 'primary' : 'flat'} aria-pressed={kind === 'add'} onClick={() => setKind('add')}>Add from safe</Pill>
      </Track>
      <div className="grid grid-cols-[9rem_1fr] gap-2">
        <div className="grid gap-1.5"><Label htmlFor={`mv-a-${sessionId}`}>Amount ($)</Label><Input id={`mv-a-${sessionId}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor={`mv-n-${sessionId}`}>Note</Label><Input id={`mv-n-${sessionId}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bag number, who witnessed" /></div>
      </div>
      <Pill type="submit" size="sm" className="self-start" disabled={cmd.pending}>{cmd.pending ? 'Saving…' : kind === 'drop' ? 'Record drop' : 'Record cash added'}</Pill>
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
    </form>
  );
}

function CountDrawer({ sessionId }: { sessionId: string }) {
  const cmd = useCommand();
  const [counted, setCounted] = useState('');
  return (
    <form className="flex flex-col gap-2 rounded-[6px] border p-3" onSubmit={(e) => {
      e.preventDefault();
      const c = toCents(counted);
      if (c === null) return cmd.setError('Enter the counted cash in dollars.');
      cmd.run(() => countDrawerAction({ sessionId, countedCents: c, idempotencyKey: newKey('drawer-count') }), () => setCounted(''));
    }}>
      <h3 className="text-sm font-medium">Close drawer</h3>
      <p className="text-xs text-muted-foreground">Count every note and coin in the drawer. A drawer that balances closes; any difference waits for a manager to approve with a note.</p>
      <div className="grid gap-1.5"><Label htmlFor={`ct-${sessionId}`}>Counted cash ($)</Label><Input id={`ct-${sessionId}`} inputMode="decimal" className="w-44" value={counted} onChange={(e) => setCounted(e.target.value)} /></div>
      <Pill type="submit" size="sm" variant="primary" className="self-start" disabled={cmd.pending}>{cmd.pending ? 'Saving…' : 'Submit count'}</Pill>
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
    </form>
  );
}

function Variance({ sessionId, counted, expected, variance, canRecount, canApprove, mine }: { sessionId: string; counted: number | null; expected: number; variance: number | null; canRecount: boolean; canApprove: boolean; mine: boolean }) {
  const cmd = useCommand();
  const [note, setNote] = useState('');
  const v = variance || 0;
  return (
    <div className="flex flex-col gap-2 rounded-[6px] border border-destructive/30 p-3">
      <p className="text-sm">Counted {money(counted)} against {money(expected)} expected: <strong className="tabular-nums">{v > 0 ? `${money(v)} over` : `${money(-v)} short`}</strong>.</p>
      {canApprove ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`ap-${sessionId}`}>Approval note</Label>
          <Input id={`ap-${sessionId}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What explains the difference" />
          {mine ? <p className="text-xs text-muted-foreground">Another manager must approve your own drawer unless you manage settings.</p> : null}
        </div>
      ) : <p className="text-sm text-muted-foreground">A manager approves the close with a note.</p>}
      <Track>
        {canApprove ? <Pill size="sm" variant="primary" disabled={cmd.pending} onClick={() => cmd.run(() => approveCloseAction({ sessionId, note, idempotencyKey: newKey('drawer-approve') }), () => setNote(''))}>{cmd.pending ? 'Saving…' : 'Approve close'}</Pill> : null}
        {canRecount ? <Pill size="sm" disabled={cmd.pending} onClick={() => cmd.run(() => recountDrawerAction({ sessionId }))}>Recount</Pill> : null}
      </Track>
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
    </div>
  );
}
