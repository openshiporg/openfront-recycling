'use client';

import { IdPhotoButton } from '@/features/platform/sellers/components/IdPhotoButton';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Camera, Check, Gauge, Printer, Scissors, Trash2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, Empty, Notice, PageHeader, Pill, pillClass, Readouts, Section, StatusCell, StatusDot, Td, Track, selectClass, type Tone } from '@/features/platform/lib/ui';
import {
  addAttachmentAction, addLineAction, adjustmentTicketAction, completeTicketAction, gradeLineAction, readScaleAction,
  removeLineAction, splitLineAction, truckWeightAction, updateDetailsAction, voidTicketAction,
} from '../actions';
import type { MaterialChoice, ScaleChoice, TicketDetail, TicketLineRow } from '../types';
import { dateTimeIn, humanize, payoutStatus, titleCase, money, price, timeIn, weight } from '../utils/format';
import { SignaturePad } from './SignaturePad';

type Props = { ticket: TicketDetail; scales: ScaleChoice[]; materials: MaterialChoice[]; role: Record<string, boolean> };

const statusTone: Record<string, Tone> = { open: 'wait', completed: 'live', settled: 'live', void: 'off' };
const newKey = (p: string) => `${p}:${crypto.randomUUID()}`;

/** Runs one server action at a time, shows its error, refreshes the page on success. */
function useCommand() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) { setError(r.error || 'This couldn’t be done.'); return; }
      after?.();
      router.refresh();
    });
  };
  return { pending, error, run, setError };
}

export function TicketWorkspace({ ticket, scales, materials, role }: Props) {
  const isOpen = ticket.status === 'open';
  const canEdit = isOpen && Boolean(role.canManageTickets || role.canGradeTickets);
  const tz = ticket.yard?.timezone;
  const party = ticket.seller ? `${ticket.seller.firstName} ${ticket.seller.lastName}` : ticket.account?.name || (ticket.direction === 'outbound' ? 'Outbound load' : 'No seller');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={<>Ticket <span className="font-mono">{ticket.displayNumber}</span></>}
        tone={statusTone[ticket.status] || 'off'}
        meta={<>
          {titleCase(ticket.status)} · {ticket.direction === 'outbound' ? 'Outbound' : 'Inbound'}{ticket.isAdjustment ? ' adjustment' : ''} · {party}
          {ticket.vehiclePlate ? ` · ${ticket.vehiclePlate}${ticket.vehiclePlateRegion ? ` ${ticket.vehiclePlateRegion}` : ''}` : ''} · opened {dateTimeIn(ticket.createdAt, tz)}{ticket.openedBy ? ` by ${ticket.openedBy.name}` : ''}
        </>}
        actions={<Link href={`/dashboard/platform/scale-house/${ticket.id}/print`} className={pillClass('raised')}><Printer />{isOpen ? 'Print ticket' : 'Print receipt'}</Link>}
      />
      {ticket.seller && ticket.seller.status !== 'active' ? <Notice tone="alert">Seller is {humanize(ticket.seller.status)}.</Notice> : null}
      {ticket.status === 'void' ? <Notice tone="alert">Voided {dateTimeIn(ticket.voidedAt, tz)}: {ticket.voidReason}</Notice> : null}

      <Readouts items={[
        { label: 'Lines', value: ticket.lines.length },
        { label: 'Pay weight', value: weight(ticket.lines.reduce((s, l) => s + Number(l.payWeight || 0), 0)) },
        { label: 'Material', value: money(ticket.materialTotalCents ?? ticket.lines.reduce((s, l) => s + (l.amountCents || 0), 0)) },
        { label: 'Fees', value: money(ticket.feeTotalCents) },
        { label: 'Total', value: money(ticket.totalCents ?? ticket.lines.reduce((s, l) => s + (l.amountCents || 0), 0)), tone: statusTone[ticket.status] },
      ]} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {canEdit ? <WeighPanel ticket={ticket} scales={scales} materials={materials} /> : null}
          <LinesSection ticket={ticket} materials={materials} canEdit={canEdit} canOverride={Boolean(role.canOverridePrices)} />
          <WeighLog ticket={ticket} />
          <AttachmentsSection ticket={ticket} canEdit={isOpen && Boolean(role.canManageTickets || role.canGradeTickets)} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          {isOpen ? <CompleteSection ticket={ticket} canManage={Boolean(role.canApproveVariances)} /> : <PayoutsSection ticket={ticket} />}
          {isOpen && role.canManageTickets ? <DetailsSection ticket={ticket} /> : null}
          <ManageSection ticket={ticket} role={role} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Weighing: floor scale (gross and tare per line) or truck scale (in full, out after each material)
// ---------------------------------------------------------------------------------------------

function WeighPanel({ ticket, scales, materials }: { ticket: TicketDetail; scales: ScaleChoice[]; materials: MaterialChoice[] }) {
  const truckScales = scales.filter((s) => s.kind === 'truck');
  const hasTruckEvents = ticket.weighEvents.some((e) => e.kind === 'sequential');
  const [mode, setMode] = useState<'floor' | 'truck'>(hasTruckEvents || (truckScales.length && !scales.some((s) => s.kind !== 'truck')) ? 'truck' : 'floor');
  const modeScales = mode === 'truck' ? (truckScales.length ? truckScales : scales) : (scales.filter((s) => s.kind !== 'truck').length ? scales.filter((s) => s.kind !== 'truck') : scales);
  const [scaleId, setScaleId] = useState(modeScales[0]?.id || '');
  const activeScale = modeScales.find((s) => s.id === scaleId) || modeScales[0];

  return (
    <Section title="Weigh" tone="wait" actions={
      <Track label="Weigh mode">
        <Pill size="sm" variant="flat" aria-pressed={mode === 'floor'} onClick={() => setMode('floor')}>Floor scale</Pill>
        <Pill size="sm" variant="flat" aria-pressed={mode === 'truck'} onClick={() => setMode('truck')}>Truck scale</Pill>
      </Track>
    }>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-scale">Scale</Label>
          <select id="w-scale" className={selectClass + ' w-56'} value={activeScale?.id || ''} onChange={(e) => setScaleId(e.target.value)}>
            {modeScales.length ? modeScales.map((s) => <option key={s.id} value={s.id}>{s.name}</option>) : <option value="">No scale set up: type weights</option>}
          </select>
        </div>
      </div>
      {mode === 'floor'
        ? <FloorLineForm ticket={ticket} scaleId={activeScale?.id} materials={materials} />
        : <TruckForm ticket={ticket} scaleId={activeScale?.id} materials={materials} />}
    </Section>
  );
}

/** "Read scale": the latest reading if it is stable and under 10 seconds old, otherwise type it. */
function useScaleReading(scaleId?: string) {
  const [reading, setReading] = useState<{ weight: string; at: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const read = (onWeight: (w: string) => void) => {
    if (!scaleId) { setMessage('No scale is set up at this yard. Type the weight.'); return; }
    setMessage(null);
    start(async () => {
      const r = await readScaleAction(scaleId);
      if (!r.ok) { setMessage(r.error); return; }
      const s = r.scale;
      const fresh = s?.lastReadingAt && Date.now() - new Date(s.lastReadingAt).getTime() <= 10_000;
      if (!s || s.lastReadingWeight === null || !fresh || !s.lastReadingStable) {
        setReading(null);
        setMessage(s?.lastReadingAt ? `No stable reading in the last 10 seconds (last ${weight(s.lastReadingWeight)} at ${timeIn(s.lastReadingAt)}). Type the weight; it is saved as manual.` : 'This scale has not sent a reading. Type the weight; it is saved as manual.');
        return;
      }
      setReading({ weight: String(Number(s.lastReadingWeight)), at: s.lastReadingAt! });
      onWeight(String(Number(s.lastReadingWeight)));
    });
  };
  return { reading, message, pending, read, clear: () => setReading(null) };
}

function MaterialSelect({ id, value, onChange, materials, direction }: { id: string; value: string; onChange: (v: string) => void; materials: MaterialChoice[]; direction?: string }) {
  const groups = useMemo(() => {
    const m = new Map<string, MaterialChoice[]>();
    for (const x of materials) {
      if (direction === 'outbound' && x.direction === 'charge_customer') continue;
      const g = x.category?.name || 'Other';
      m.set(g, [...(m.get(g) || []), x]);
    }
    return [...m.entries()];
  }, [materials, direction]);
  return (
    <select id={id} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Pick material</option>
      {groups.map(([g, items]) => (
        <optgroup key={g} label={g}>
          {items.map((x) => <option key={x.id} value={x.id}>{x.name}{x.code ? ` (${x.code})` : ''}{x.direction === 'charge_customer' ? ' · fee' : ''}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function FloorLineForm({ ticket, scaleId, materials }: { ticket: TicketDetail; scaleId?: string; materials: MaterialChoice[] }) {
  const empty = { materialId: '', gross: '', tare: '', quantity: '', deductionWeight: '', deductionPercent: '', deductionReason: '' };
  const [f, setF] = useState(empty);
  const [fromScale, setFromScale] = useState({ gross: false, tare: false });
  const gross = useScaleReading(scaleId);
  const tare = useScaleReading(scaleId);
  const cmd = useCommand();
  const material = materials.find((m) => m.id === f.materialId);
  const each = material?.defaultUnit === 'each';
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF({ ...f, [k]: e.target.value });
    if (k === 'gross') setFromScale((s) => ({ ...s, gross: false }));
    if (k === 'tare') setFromScale((s) => ({ ...s, tare: false }));
  };
  const net = Number(f.gross || 0) - Number(f.tare || 0);

  const submit = () => cmd.run(() => addLineAction({
    ticketId: ticket.id, materialId: f.materialId, grossWeight: f.gross, tareWeight: f.tare, quantity: f.quantity,
    deductionWeight: f.deductionWeight, deductionPercent: f.deductionPercent, deductionReason: f.deductionReason,
    scaleId, grossFromScale: fromScale.gross, tareFromScale: fromScale.tare, idempotencyKey: newKey('line'),
  }), () => { setF(empty); setFromScale({ gross: false, tare: false }); gross.clear(); tare.clear(); });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5"><Label htmlFor="fl-mat">Material</Label><MaterialSelect id="fl-mat" value={f.materialId} onChange={(v) => setF({ ...f, materialId: v })} materials={materials} direction={ticket.direction} /></div>
        {each ? (
          <div className="flex flex-col gap-1.5"><Label htmlFor="fl-qty">Quantity</Label><Input id="fl-qty" inputMode="numeric" value={f.quantity} onChange={set('quantity')} /></div>
        ) : (
          <>
            <WeightInput id="fl-gross" label="Gross" value={f.gross} onChange={set('gross')} reading={gross} fromScale={fromScale.gross} onRead={() => gross.read((w) => { setF((x) => ({ ...x, gross: w })); setFromScale((s) => ({ ...s, gross: true })); })} />
            <WeightInput id="fl-tare" label="Tare" value={f.tare} onChange={set('tare')} reading={tare} fromScale={fromScale.tare} onRead={() => tare.read((w) => { setF((x) => ({ ...x, tare: w })); setFromScale((s) => ({ ...s, tare: true })); })} />
          </>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1.5"><Label htmlFor="fl-dw">Deduction (lb)</Label><Input id="fl-dw" inputMode="decimal" value={f.deductionWeight} onChange={set('deductionWeight')} disabled={Boolean(f.deductionPercent)} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="fl-dp">Deduction (%)</Label><Input id="fl-dp" inputMode="decimal" value={f.deductionPercent} onChange={set('deductionPercent')} disabled={Boolean(f.deductionWeight)} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="fl-dr">Deduction reason</Label><Input id="fl-dr" value={f.deductionReason} onChange={set('deductionReason')} placeholder="Dirt, attachments, water…" /></div>
      </div>
      {gross.message || tare.message ? <Notice>{gross.message || tare.message}</Notice> : null}
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Pill variant="primary" onClick={submit} disabled={cmd.pending}>{cmd.pending ? 'Adding…' : 'Add line'}</Pill>
        {!each && f.gross ? <span className="text-sm tabular-nums text-muted-foreground">Net {weight(net)}</span> : null}
        <span className="text-xs text-muted-foreground">The price comes from the account’s contract, the seller’s list or today’s board.</span>
      </div>
    </div>
  );
}

function WeightInput({ id, label, value, onChange, reading, fromScale, onRead }: { id: string; label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; reading: ReturnType<typeof useScaleReading>; fromScale: boolean; onRead: () => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label} (lb){fromScale ? <span className="ml-1.5 text-xs font-normal text-emerald-700 dark:text-emerald-400">from scale</span> : null}</Label>
      <div className="flex gap-1.5">
        <Input id={id} inputMode="decimal" value={value} onChange={onChange} className="tabular-nums" />
        <Pill size="sm" onClick={onRead} disabled={reading.pending} aria-label={`Read scale for ${label.toLowerCase()}`}><Gauge />{reading.pending ? '…' : 'Read'}</Pill>
      </div>
    </div>
  );
}

function TruckForm({ ticket, scaleId, materials }: { ticket: TicketDetail; scaleId?: string; materials: MaterialChoice[] }) {
  const events = ticket.weighEvents.filter((e) => e.kind === 'sequential');
  const last = events[events.length - 1];
  const first = events.length === 0;
  const [w, setW] = useState('');
  const [fromScale, setFromScale] = useState(false);
  const [materialId, setMaterialId] = useState('');
  const [deduction, setDeduction] = useState({ weight: '', percent: '', reason: '' });
  const reading = useScaleReading(scaleId);
  const cmd = useCommand();
  const submit = () => cmd.run(() => truckWeightAction({
    ticketId: ticket.id, weight: w, scaleId, fromScale, materialId: first ? undefined : materialId,
    deductionWeight: deduction.weight, deductionPercent: deduction.percent, deductionReason: deduction.reason, idempotencyKey: newKey('truck'),
  }), () => { setW(''); setFromScale(false); setMaterialId(''); setDeduction({ weight: '', percent: '', reason: '' }); reading.clear(); });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {first ? 'Weigh the loaded truck first.' : `Last weight ${weight(last.weight)} at ${timeIn(last.capturedAt, ticket.yard?.timezone)}. Unload one material, weigh again, and pick what came off. Weigh the empty truck with the last material.`}
      </p>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <WeightInput id="tr-w" label={first ? 'Loaded weight' : 'Weight now'} value={w} onChange={(e) => { setW(e.target.value); setFromScale(false); }} reading={reading} fromScale={fromScale} onRead={() => reading.read((x) => { setW(x); setFromScale(true); })} />
        {!first ? <div className="flex flex-col gap-1.5"><Label htmlFor="tr-mat">Material unloaded</Label><MaterialSelect id="tr-mat" value={materialId} onChange={setMaterialId} materials={materials} direction={ticket.direction} /></div> : null}
      </div>
      {!first ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1.5"><Label htmlFor="tr-dw">Deduction (lb)</Label><Input id="tr-dw" inputMode="decimal" value={deduction.weight} onChange={(e) => setDeduction({ ...deduction, weight: e.target.value })} disabled={Boolean(deduction.percent)} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="tr-dp">Deduction (%)</Label><Input id="tr-dp" inputMode="decimal" value={deduction.percent} onChange={(e) => setDeduction({ ...deduction, percent: e.target.value })} disabled={Boolean(deduction.weight)} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="tr-dr">Reason</Label><Input id="tr-dr" value={deduction.reason} onChange={(e) => setDeduction({ ...deduction, reason: e.target.value })} /></div>
        </div>
      ) : null}
      {reading.message ? <Notice>{reading.message}</Notice> : null}
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
      <div className="flex items-center gap-3">
        <Pill variant="primary" onClick={submit} disabled={cmd.pending || (!first && !materialId)}>{cmd.pending ? 'Saving…' : first ? 'Record loaded weight' : 'Record weight and add line'}</Pill>
        {!first && w && last ? <span className="text-sm tabular-nums text-muted-foreground">Unloaded {weight(Number(last.weight) - Number(w))}</span> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Lines and grading
// ---------------------------------------------------------------------------------------------

function LinesSection({ ticket, materials, canEdit, canOverride }: { ticket: TicketDetail; materials: MaterialChoice[]; canEdit: boolean; canOverride: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [splitting, setSplitting] = useState<string | null>(null);
  const missingByLine = new Map<string, string[]>();
  for (const m of ticket.checklist) if (m.lineId) missingByLine.set(m.lineId, [...(missingByLine.get(m.lineId) || []), m.message]);
  return (
    <Section title="Lines" count={ticket.lines.length}>
      {ticket.lines.length ? (
        <DataTable label="Ticket lines" head={[{ label: 'Material' }, { label: 'Gross', className: 'text-right' }, { label: 'Tare', className: 'text-right' }, { label: 'Deduct', className: 'text-right' }, { label: 'Pay weight', className: 'text-right' }, { label: 'Price', className: 'text-right' }, { label: 'Amount', className: 'text-right' }, { label: '' }]}>
          {ticket.lines.map((l) => (
            <LineRow key={l.id} line={l} ticket={ticket} materials={materials} canEdit={canEdit} canOverride={canOverride} missing={missingByLine.get(l.id) || []}
              editing={editing === l.id} splitting={splitting === l.id}
              onEdit={() => { setEditing(editing === l.id ? null : l.id); setSplitting(null); }}
              onSplit={() => { setSplitting(splitting === l.id ? null : l.id); setEditing(null); }}
              onDone={() => { setEditing(null); setSplitting(null); }} />
          ))}
        </DataTable>
      ) : <Empty>No lines yet. Weigh the first material above.</Empty>}
    </Section>
  );
}

function LineRow({ line, ticket, materials, canEdit, canOverride, missing, editing, splitting, onEdit, onSplit, onDone }: { line: TicketLineRow; ticket: TicketDetail; materials: MaterialChoice[]; canEdit: boolean; canOverride: boolean; missing: string[]; editing: boolean; splitting: boolean; onEdit: () => void; onSplit: () => void; onDone: () => void }) {
  const cmd = useCommand();
  const each = line.unit === 'each';
  const deduction = line.deductionPercent ? `${Number(line.deductionPercent)}%` : line.deductionWeight ? weight(line.deductionWeight) : '—';
  const remove = () => {
    const reason = window.prompt('Why is this line removed?') ?? null;
    if (reason === null) return;
    cmd.run(() => removeLineAction({ ticketId: ticket.id, lineId: line.id, reason, idempotencyKey: newKey('rm') }));
  };
  return (
    <>
      <tr>
        <Td>
          <span className="font-medium">{line.materialName}</span>
          {line.direction === 'charge_customer' ? <span className="ml-1.5 text-xs text-muted-foreground">fee</span> : null}
          {line.priceSource === 'override' ? <p className="text-xs text-amber-700 dark:text-amber-400">Price override: {line.overrideReason}</p> : null}
          {line.deductionReason ? <p className="text-xs text-muted-foreground">{line.deductionReason}</p> : null}
          {missing.map((m) => <p key={m} className="text-xs text-red-700 dark:text-red-400"><StatusDot tone="alert" />{m}</p>)}
          {cmd.error ? <p className="text-xs text-red-700 dark:text-red-400">{cmd.error}</p> : null}
        </Td>
        <Td className="text-right tabular-nums">{each ? '—' : weight(line.grossWeight)}</Td>
        <Td className="text-right tabular-nums">{each ? '—' : weight(line.tareWeight)}</Td>
        <Td className="text-right tabular-nums">{deduction}</Td>
        <Td className="text-right tabular-nums">{each ? `${line.quantity ?? 0} each` : weight(line.payWeight)}</Td>
        <Td className="text-right tabular-nums">{price(line.unitPrice, line.unit)}<p className="text-xs text-muted-foreground">{humanize(line.priceSource)}</p></Td>
        <Td className="text-right font-medium tabular-nums">{(line.amountCents ?? 0) < 0 ? '−' : ''}{money(Math.abs(line.amountCents ?? 0))}</Td>
        <Td className="whitespace-nowrap text-right">
          {canEdit ? (
            <Track>
              <Pill size="sm" variant="flat" onClick={onEdit} aria-pressed={editing}>Grade</Pill>
              {!each ? <Pill size="sm" variant="flat" onClick={onSplit} aria-pressed={splitting} aria-label="Split line"><Scissors /></Pill> : null}
              <Pill size="sm" variant="flat" onClick={remove} disabled={cmd.pending} aria-label="Remove line"><Trash2 /></Pill>
            </Track>
          ) : null}
        </Td>
      </tr>
      {editing ? <tr><Td colSpan={8} className="bg-muted/30"><GradeForm line={line} ticket={ticket} materials={materials} canOverride={canOverride} onDone={onDone} /></Td></tr> : null}
      {splitting ? <tr><Td colSpan={8} className="bg-muted/30"><SplitForm line={line} ticket={ticket} materials={materials} onDone={onDone} /></Td></tr> : null}
    </>
  );
}

function GradeForm({ line, ticket, materials, canOverride, onDone }: { line: TicketLineRow; ticket: TicketDetail; materials: MaterialChoice[]; canOverride: boolean; onDone: () => void }) {
  const [f, setF] = useState({
    materialId: line.material?.id || '', deductionWeight: line.deductionWeight ? String(Number(line.deductionWeight)) : '', deductionPercent: line.deductionPercent ? String(Number(line.deductionPercent)) : '',
    deductionReason: line.deductionReason || '', unitPrice: '', overrideReason: '', quantity: line.quantity ? String(line.quantity) : '',
  });
  const cmd = useCommand();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const save = () => cmd.run(() => gradeLineAction({
    ticketId: ticket.id, lineId: line.id, materialId: f.materialId !== line.material?.id ? f.materialId : undefined,
    deductionWeight: f.deductionWeight, deductionPercent: f.deductionPercent, deductionReason: f.deductionReason,
    unitPrice: canOverride ? f.unitPrice : undefined, overrideReason: canOverride ? f.overrideReason : undefined,
    quantity: line.unit === 'each' ? f.quantity : undefined, idempotencyKey: newKey('grade'),
  }), onDone);
  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="flex flex-col gap-1.5 md:col-span-2"><Label htmlFor={`g-mat-${line.id}`}>Grade as</Label><MaterialSelect id={`g-mat-${line.id}`} value={f.materialId} onChange={(v) => setF({ ...f, materialId: v })} materials={materials} direction={ticket.direction} /></div>
        {line.unit === 'each' ? <div className="flex flex-col gap-1.5"><Label htmlFor={`g-q-${line.id}`}>Quantity</Label><Input id={`g-q-${line.id}`} value={f.quantity} onChange={set('quantity')} inputMode="numeric" /></div> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1.5"><Label htmlFor={`g-dw-${line.id}`}>Deduction (lb)</Label><Input id={`g-dw-${line.id}`} inputMode="decimal" value={f.deductionWeight} onChange={set('deductionWeight')} disabled={Boolean(f.deductionPercent)} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor={`g-dp-${line.id}`}>Deduction (%)</Label><Input id={`g-dp-${line.id}`} inputMode="decimal" value={f.deductionPercent} onChange={set('deductionPercent')} disabled={Boolean(f.deductionWeight)} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor={`g-dr-${line.id}`}>Reason</Label><Input id={`g-dr-${line.id}`} value={f.deductionReason} onChange={set('deductionReason')} /></div>
      </div>
      {canOverride ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1.5"><Label htmlFor={`g-up-${line.id}`}>Override price ({line.unit || 'lb'})</Label><Input id={`g-up-${line.id}`} inputMode="decimal" value={f.unitPrice} onChange={set('unitPrice')} placeholder={line.unitPrice ? String(Number(line.unitPrice)) : ''} /></div>
          <div className="flex flex-col gap-1.5 md:col-span-2"><Label htmlFor={`g-or-${line.id}`}>Override reason</Label><Input id={`g-or-${line.id}`} value={f.overrideReason} onChange={set('overrideReason')} /></div>
        </div>
      ) : null}
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
      <Track>
        <Pill variant="primary" size="sm" onClick={save} disabled={cmd.pending}><Check />{cmd.pending ? 'Saving…' : 'Save grade'}</Pill>
        <Pill variant="flat" size="sm" onClick={onDone} disabled={cmd.pending}>Cancel</Pill>
      </Track>
    </div>
  );
}

function SplitForm({ line, ticket, materials, onDone }: { line: TicketLineRow; ticket: TicketDetail; materials: MaterialChoice[]; onDone: () => void }) {
  const [w, setW] = useState('');
  const [materialId, setMaterialId] = useState('');
  const cmd = useCommand();
  return (
    <div className="flex flex-col gap-3 py-1">
      <p className="text-sm text-muted-foreground">Move part of {weight(line.netWeight)} net to another material.</p>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1.5"><Label htmlFor={`s-w-${line.id}`}>Weight to move (lb)</Label><Input id={`s-w-${line.id}`} inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} /></div>
        <div className="flex flex-col gap-1.5 md:col-span-2"><Label htmlFor={`s-m-${line.id}`}>New material</Label><MaterialSelect id={`s-m-${line.id}`} value={materialId} onChange={setMaterialId} materials={materials} direction={ticket.direction} /></div>
      </div>
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
      <Track>
        <Pill variant="primary" size="sm" disabled={cmd.pending} onClick={() => cmd.run(() => splitLineAction({ ticketId: ticket.id, lineId: line.id, weight: w, materialId, idempotencyKey: newKey('split') }), onDone)}>{cmd.pending ? 'Splitting…' : 'Split line'}</Pill>
        <Pill variant="flat" size="sm" onClick={onDone}>Cancel</Pill>
      </Track>
    </div>
  );
}

function WeighLog({ ticket }: { ticket: TicketDetail }) {
  if (!ticket.weighEvents.length) return null;
  return (
    <Section title="Weigh log" count={ticket.weighEvents.length}>
      <DataTable label="Weigh events" head={[{ label: 'Time' }, { label: 'Kind' }, { label: 'Weight', className: 'text-right' }, { label: 'How' }, { label: 'Scale' }]}>
        {ticket.weighEvents.map((e) => (
          <tr key={e.id}>
            <Td className="tabular-nums">{timeIn(e.capturedAt, ticket.yard?.timezone)}</Td>
            <Td>{humanize(e.kind)}</Td>
            <Td className="text-right tabular-nums">{weight(e.weight)}</Td>
            <Td><StatusCell tone={e.captureMethod === 'scale' ? 'live' : 'wait'}>{e.captureMethod === 'scale' ? 'Scale' : 'Typed'}</StatusCell></Td>
            <Td>{e.scale?.name || '—'}</Td>
          </tr>
        ))}
      </DataTable>
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------
// Photos and signature
// ---------------------------------------------------------------------------------------------

const KINDS = [
  { value: 'material_photo', label: 'Material' },
  { value: 'seller_photo', label: 'Seller' },
  { value: 'vehicle_photo', label: 'Vehicle' },
  { value: 'ownership_document', label: 'Proof of ownership' },
  { value: 'thumbprint', label: 'Thumbprint' },
  { value: 'bol', label: 'Bill of lading' },
  { value: 'other', label: 'Other' },
];

function AttachmentsSection({ ticket, canEdit }: { ticket: TicketDetail; canEdit: boolean }) {
  const [kind, setKind] = useState('material_photo');
  const [lineId, setLineId] = useState('');
  const [signing, setSigning] = useState(false);
  const cmd = useCommand();
  const upload = (file: File | Blob, k: string, signedName?: string) => {
    const form = new FormData();
    form.set('ticketId', ticket.id);
    form.set('kind', k);
    if (lineId && k !== 'signature') form.set('lineId', lineId);
    if (signedName) form.set('signedName', signedName);
    form.set('image', file instanceof File ? file : new File([file], 'signature.png', { type: 'image/png' }));
    cmd.run(() => addAttachmentAction(form), () => setSigning(false));
  };
  return (
    <Section title="Photos and signature" count={ticket.attachments.length}>
      {ticket.attachments.length ? (
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ticket.attachments.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-[6px] border">
              {a.image ? (
                // Private images are served by /api/private-files after a staff check; next/image would cache them.
                // eslint-disable-next-line @next/next/no-img-element
                <a href={a.image.url} target="_blank" rel="noreferrer"><img src={a.image.url} alt={humanize(a.kind)} className={'aspect-[4/3] w-full object-cover ' + (a.kind === 'signature' ? 'bg-white object-contain' : '')} /></a>
              ) : <div className="aspect-[4/3] bg-muted" />}
              <p className="truncate px-2 py-1.5 text-xs">{humanize(a.kind)}{a.signedName ? `: ${a.signedName}` : ''} · {timeIn(a.capturedAt, ticket.yard?.timezone)}</p>
            </li>
          ))}
        </ul>
      ) : <Empty>No photos yet.</Empty>}
      {canEdit ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5"><Label htmlFor="at-kind">Photo of</Label>
              <select id="at-kind" className={selectClass + ' w-48'} value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
            </div>
            {ticket.lines.length ? (
              <div className="flex flex-col gap-1.5"><Label htmlFor="at-line">For line</Label>
                <select id="at-line" className={selectClass + ' w-56'} value={lineId} onChange={(e) => setLineId(e.target.value)}>
                  <option value="">Whole ticket</option>
                  {ticket.lines.map((l) => <option key={l.id} value={l.id}>{l.materialName}</option>)}
                </select>
              </div>
            ) : null}
            <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[6px] border bg-background px-3.5 text-sm font-medium hover:bg-muted/60 sm:h-9">
              <Camera className="size-4" />{cmd.pending ? 'Uploading…' : 'Take or choose photo'}
              <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={cmd.pending} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) upload(file, kind); }} />
            </label>
            <Pill onClick={() => setSigning(!signing)} aria-pressed={signing}>Seller signature</Pill>
          </div>
          {signing ? <SignaturePad defaultName={ticket.seller ? `${ticket.seller.firstName} ${ticket.seller.lastName}` : ''} pending={cmd.pending} onSave={(blob, name) => upload(blob, 'signature', name)} onCancel={() => setSigning(false)} /> : null}
          {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
        </div>
      ) : null}
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------
// Compliance and completion
// ---------------------------------------------------------------------------------------------

function CompleteSection({ ticket, canManage }: { ticket: TicketDetail; canManage: boolean }) {
  const [override, setOverride] = useState('');
  const cmd = useCommand();
  const items = ticket.checklist;
  const hard = items.filter((i) => !i.overridable);
  const soft = items.filter((i) => i.overridable);
  const canComplete = !hard.length && (!soft.length || (canManage && override.trim().length >= 3));
  return (
    <Section title="Compliance checklist" tone={items.length ? 'alert' : 'live'} count={items.length ? `${items.length} missing` : 'complete'}>
      {items.length ? (
        <ul className="mb-4 flex flex-col gap-1.5 text-sm">
          {items.map((i, n) => (
            <li key={`${i.code}-${i.lineId || n}`}>
              <StatusDot tone={i.overridable ? 'wait' : 'alert'} />{i.message}{i.overridable ? <span className="ml-1 text-xs text-muted-foreground">(manager can override)</span> : null}
              {i.code === 'id_photo' && ticket.status === 'open' && ticket.seller?.identityDocuments?.[0] ? <div className="mt-1.5 ml-4"><IdPhotoButton sellerId={ticket.seller.id} documentId={ticket.seller.identityDocuments[0].id} label="Photo of the ID" /></div> : null}
            </li>
          ))}
        </ul>
      ) : <p className="mb-4 text-sm"><StatusDot tone="live" />Everything the yard’s rules need is on the ticket.</p>}
      {soft.length && !hard.length ? (
        canManage ? (
          <div className="mb-3 flex flex-col gap-1.5"><Label htmlFor="c-override">Override reason</Label><Input id="c-override" value={override} onChange={(e) => setOverride(e.target.value)} placeholder="Why the ticket can complete without these" /></div>
        ) : <p className="mb-3 text-xs text-muted-foreground">A manager can override the items marked amber.</p>
      ) : null}
      {cmd.error ? <Notice tone="alert" className="mb-3">{cmd.error}</Notice> : null}
      <Pill variant="primary" className="w-full" disabled={cmd.pending || !canComplete} onClick={() => cmd.run(() => completeTicketAction({ ticketId: ticket.id, overrideReason: soft.length ? override : undefined, idempotencyKey: newKey('complete') }))}>
        <Check />{cmd.pending ? 'Completing…' : 'Complete ticket'}
      </Pill>
    </Section>
  );
}

function PayoutsSection({ ticket }: { ticket: TicketDetail }) {
  const tz = ticket.yard?.timezone;
  return (
    <Section title="Payment" tone={ticket.payouts.some((p) => p.status === 'ready') ? 'wait' : 'live'}>
      {ticket.completedAt ? <p className="mb-3 text-sm text-muted-foreground">Completed {dateTimeIn(ticket.completedAt, tz)}{ticket.completedBy ? ` by ${ticket.completedBy.name}` : ''}.</p> : null}
      {ticket.overrideReason ? <p className="mb-3 text-sm">Compliance override: {ticket.overrideReason}</p> : null}
      {ticket.payouts.length ? (
        <ul className="flex flex-col gap-2 text-sm">
          {ticket.payouts.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded-[6px] border p-3">
              <span><StatusDot tone={p.status === 'paid' ? 'live' : p.status === 'held' ? 'wait' : p.status === 'ready' ? 'info' : 'off'} />{payoutStatus(p.status)}{p.method ? ` · ${p.method}` : ''}{p.status === 'held' && p.releaseAt ? ` until ${dateTimeIn(p.releaseAt, tz)}` : ''}{p.paidAt ? ` · ${dateTimeIn(p.paidAt, tz)}` : ''}</span>
              <span className="font-semibold tabular-nums">{money(p.amountCents)}</span>
            </li>
          ))}
        </ul>
      ) : <Empty>{ticket.status === 'void' ? 'Voided: nothing to pay.' : 'No payout on this ticket.'}</Empty>}
      {ticket.payouts.some((p) => p.status === 'ready') ? <p className="mt-3 text-xs text-muted-foreground">The cashier pays it from the payout queue.</p> : null}
    </Section>
  );
}

function DetailsSection({ ticket }: { ticket: TicketDetail }) {
  const [f, setF] = useState({ vehiclePlate: ticket.vehiclePlate || '', vehiclePlateRegion: ticket.vehiclePlateRegion || '', vehicleDescription: ticket.vehicleDescription || '', paymentMode: ticket.paymentMode || 'pay_now', notes: ticket.notes || '' });
  const cmd = useCommand();
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setSaved(false); setF({ ...f, [k]: e.target.value }); };
  return (
    <Section title="Details">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <div className="flex flex-col gap-1.5"><Label htmlFor="d-plate">Plate</Label><Input id="d-plate" value={f.vehiclePlate} onChange={set('vehiclePlate')} className="uppercase" /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="d-pr">State</Label><Input id="d-pr" value={f.vehiclePlateRegion} onChange={set('vehiclePlateRegion')} className="uppercase" maxLength={3} /></div>
        </div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="d-veh">Vehicle</Label><Input id="d-veh" value={f.vehicleDescription} onChange={set('vehicleDescription')} placeholder="White F-150" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="d-pm">Payment</Label>
          <select id="d-pm" className={selectClass} value={f.paymentMode} onChange={set('paymentMode')}>
            <option value="pay_now">Pay now</option>
            <option value="on_account">On account (settlement)</option>
            <option value="donation_only">Donate all</option>
            <option value="customer_pays">Customer pays (fees)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="d-notes">Notes</Label><Input id="d-notes" value={f.notes} onChange={set('notes')} /></div>
        {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : saved ? <Notice>Saved.</Notice> : null}
        <Pill size="sm" className="self-start" disabled={cmd.pending} onClick={() => cmd.run(() => updateDetailsAction({ ticketId: ticket.id, ...f, idempotencyKey: newKey('details') }), () => setSaved(true))}>{cmd.pending ? 'Saving…' : 'Save details'}</Pill>
      </div>
    </Section>
  );
}

function ManageSection({ ticket, role }: { ticket: TicketDetail; role: Record<string, boolean> }) {
  const router = useRouter();
  const cmd = useCommand();
  const [mode, setMode] = useState<'void' | 'adjust' | null>(null);
  const [reason, setReason] = useState('');
  const canVoid = ticket.status !== 'void' && Boolean(role.canManageTickets || role.canVoidTickets);
  const canAdjust = (ticket.status === 'completed' || ticket.status === 'settled') && !ticket.isAdjustment && Boolean(role.canManageTickets);
  if (!canVoid && !canAdjust) return null;
  const go = () => {
    if (mode === 'void') cmd.run(() => voidTicketAction({ ticketId: ticket.id, reason, idempotencyKey: newKey('void') }), () => { setMode(null); setReason(''); });
    if (mode === 'adjust') {
      cmd.setError(null);
      adjustmentTicketAction({ ticketId: ticket.id, reason, idempotencyKey: newKey('adjust') }).then((r) => {
        if (!r.ok) cmd.setError(r.error);
        else router.push(`/dashboard/platform/scale-house/${r.data.id}`);
      });
    }
  };
  return (
    <Section title="Corrections">
      {mode ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5"><Label htmlFor="m-reason">{mode === 'void' ? 'Why void this ticket?' : 'What does the adjustment correct?'}</Label><Input id="m-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></div>
          {mode === 'void' && ticket.status !== 'open' ? <p className="text-xs text-muted-foreground">Voiding a completed ticket reverses its inventory, payouts, holds and donation.</p> : null}
          {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
          <Track>
            <Pill size="sm" variant={mode === 'void' ? 'danger' : 'primary'} disabled={cmd.pending || reason.trim().length < 3} onClick={go}>{mode === 'void' ? 'Void ticket' : 'Open adjustment ticket'}</Pill>
            <Pill size="sm" variant="flat" onClick={() => { setMode(null); setReason(''); cmd.setError(null); }}><X />Cancel</Pill>
          </Track>
        </div>
      ) : (
        <Track wrap>
          {canAdjust ? <Pill size="sm" onClick={() => setMode('adjust')}>Adjustment ticket</Pill> : null}
          {canVoid ? <Pill size="sm" variant="danger" onClick={() => setMode('void')}>Void</Pill> : null}
        </Track>
      )}
    </Section>
  );
}
