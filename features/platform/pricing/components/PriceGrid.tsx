'use client';

import { useEffect, useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, Empty, Notice, Pill, StatusCell, Td, Track, selectClass } from '@/features/platform/lib/ui';
import { useCommand, newKey } from '@/features/platform/lib/useCommand';
import { dateTimeIn } from '@/features/platform/lib/format';
import { getHistory, publishPricesAction } from '../actions';
import { UNITS, UNIT_LABEL, type Grid, type GridRow, type HistoryRow } from '../types';

type Draft = { unitPrice: string; unitPriceHigh: string; unit: string; isPublic: boolean };
const PRICE = /^\d{0,7}(\.\d{0,5})?$/;
const fmt = (v: string | null) => (v === null ? '—' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 })}`);

function draftOf(r: GridRow): Draft {
  return { unitPrice: r.unitPrice ?? '', unitPriceHigh: r.unitPriceHigh ?? '', unit: r.unit, isPublic: r.isPublic };
}
function changed(r: GridRow, d: Draft) {
  const same = (a: string | null, b: string) => (a === null ? b.trim() === '' : b.trim() !== '' && Number(a) === Number(b));
  return !same(r.unitPrice, d.unitPrice) || !same(r.unitPriceHigh, d.unitPriceHigh) || r.unit !== d.unit || r.isPublic !== d.isPublic;
}

export function PriceGrid({ grid, canEdit, timeZone }: { grid: Grid; canEdit: boolean; timeZone: string | null }) {
  const cmd = useCommand();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState('');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [published, setPublished] = useState<string | null>(null);
  const [publishKey, setPublishKey] = useState(() => newKey('prices'));

  const categories = useMemo(() => [...new Set(grid.rows.map((r) => r.categoryName || 'Other'))], [grid.rows]);
  const rows = grid.rows.filter((r) => (!category || (r.categoryName || 'Other') === category) && (!filter || `${r.materialName} ${r.code || ''}`.toLowerCase().includes(filter.toLowerCase())));
  const edits = grid.rows.filter((r) => drafts[r.materialId] && changed(r, drafts[r.materialId]));
  const invalid = edits.filter((r) => { const d = drafts[r.materialId]; return !d.unitPrice.trim() || !PRICE.test(d.unitPrice.trim()) || (d.unitPriceHigh.trim() && (!PRICE.test(d.unitPriceHigh.trim()) || Number(d.unitPriceHigh) < Number(d.unitPrice))); });

  const set = (r: GridRow, patch: Partial<Draft>) => { setPublished(null); setDrafts((all) => ({ ...all, [r.materialId]: { ...(all[r.materialId] || draftOf(r)), ...patch } })); };

  const publish = () => {
    if (invalid.length) return cmd.setError(`Check the price for ${invalid.map((r) => r.materialName).join(', ')}: a price is needed and the high price can’t be below it.`);
    let from: string | null = null;
    if (when === 'later') {
      if (!effectiveFrom) return cmd.setError('Choose when the new prices take effect.');
      from = new Date(effectiveFrom).toISOString();
    }
    const entries = edits.map((r) => ({ materialId: r.materialId, ...drafts[r.materialId] }));
    cmd.run(() => publishPricesAction({ priceListId: grid.priceListId, entries, effectiveFrom: from, idempotencyKey: publishKey }), (d) => {
      const res = d as { count: number; effectiveFrom: string } | undefined;
      setPublished(`${res?.count ?? entries.length} price${(res?.count ?? entries.length) === 1 ? '' : 's'} published, effective ${dateTimeIn(res?.effectiveFrom || new Date().toISOString(), timeZone)}.`);
      setDrafts({});
      setPublishKey(newKey('prices'));
    });
  };

  if (!grid.rows.length) return <Empty>No active materials yet. Add materials first.</Empty>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5"><Label htmlFor="pg-q">Find material</Label><Input id="pg-q" className="w-64" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Name or code" /></div>
        <div className="grid gap-1.5"><Label htmlFor="pg-cat">Category</Label><select id="pg-cat" className={selectClass + ' w-52'} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>
      <DataTable label="Prices" head={[
        { label: 'Material' }, { label: 'Current', className: 'text-right' }, { label: 'Change', className: 'text-right' },
        ...(canEdit ? [{ label: 'New price' }, { label: 'High (range)' }] : [{ label: 'High', className: 'text-right' }]),
        { label: 'Unit' }, { label: 'On public board' }, { label: 'Published' }, { label: '' },
      ]}>
        {rows.map((r) => {
          const d = drafts[r.materialId] || draftOf(r);
          const dirty = Boolean(drafts[r.materialId]) && changed(r, d);
          const change = r.change === null ? null : Number(r.change);
          return [
            <tr key={r.materialId} className={dirty ? 'bg-amber-50/60 dark:bg-amber-950/20' : undefined}>
              <Td><span className="font-medium">{r.materialName}</span><div className="text-xs text-muted-foreground">{r.code ? `${r.code} · ` : ''}{r.categoryName || 'Other'}{r.direction === 'charge_customer' ? ' · fee (customer pays)' : ''}</div></Td>
              <Td className="whitespace-nowrap text-right tabular-nums">{fmt(r.unitPrice)}{r.unitPrice !== null ? <span className="text-xs text-muted-foreground"> / {UNIT_LABEL[r.unit] || r.unit}</span> : null}{r.scheduledPrice ? <div className="text-xs text-muted-foreground">{fmt(r.scheduledPrice)} from {dateTimeIn(r.scheduledFrom, timeZone)}</div> : null}</Td>
              <Td className="whitespace-nowrap text-right tabular-nums">{change === null ? <span className="text-muted-foreground">—</span> : <StatusCell tone={change > 0 ? 'live' : change < 0 ? 'alert' : 'off'}>{change > 0 ? '+' : change < 0 ? '−' : ''}{fmt(String(Math.abs(change)))}</StatusCell>}</Td>
              {canEdit ? (
                <>
                  <Td><Input aria-label={`New price for ${r.materialName}`} inputMode="decimal" className="h-8 w-28 tabular-nums" value={d.unitPrice} onChange={(e) => set(r, { unitPrice: e.target.value })} /></Td>
                  <Td><Input aria-label={`High price for ${r.materialName}`} inputMode="decimal" className="h-8 w-28 tabular-nums" value={d.unitPriceHigh} placeholder="—" onChange={(e) => set(r, { unitPriceHigh: e.target.value })} /></Td>
                  <Td><select aria-label={`Unit for ${r.materialName}`} className={selectClass + ' h-8 w-28'} value={d.unit} onChange={(e) => set(r, { unit: e.target.value })}>{UNITS.map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}</select></Td>
                  <Td><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={d.isPublic} onChange={(e) => set(r, { isPublic: e.target.checked })} />{d.isPublic ? 'Shown' : 'Hidden'}</label>{!r.materialIsPublic ? <div className="text-xs text-muted-foreground">Material is hidden</div> : null}</Td>
                </>
              ) : (
                <>
                  <Td className="text-right tabular-nums">{fmt(r.unitPriceHigh)}</Td>
                  <Td>{UNIT_LABEL[r.unit] || r.unit}</Td>
                  <Td>{r.isPublic ? 'Shown' : 'Hidden'}</Td>
                </>
              )}
              <Td className="whitespace-nowrap text-xs text-muted-foreground">{r.effectiveFrom ? <>{dateTimeIn(r.effectiveFrom, timeZone)}<div>{r.publishedByName}</div></> : 'Never'}</Td>
              <Td className="text-right"><Pill size="sm" variant="flat" aria-label={`Price history for ${r.materialName}`} onClick={() => setHistoryFor(historyFor === r.materialId ? null : r.materialId)}><History /></Pill></Td>
            </tr>,
            historyFor === r.materialId ? <tr key={`${r.materialId}-h`}><Td colSpan={canEdit ? 9 : 8} className="bg-muted/30"><PriceHistory priceListId={grid.priceListId} materialId={r.materialId} timeZone={timeZone} /></Td></tr> : null,
          ];
        })}
      </DataTable>
      {canEdit ? (
        <div className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-[6px] border bg-background p-3 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <p className="text-sm"><strong className="tabular-nums">{edits.length}</strong> change{edits.length === 1 ? '' : 's'} ready{invalid.length ? <span className="text-destructive"> · {invalid.length} to fix</span> : null}</p>
            <Track label="When">
              <Pill size="sm" variant={when === 'now' ? 'primary' : 'flat'} aria-pressed={when === 'now'} onClick={() => setWhen('now')}>Take effect now</Pill>
              <Pill size="sm" variant={when === 'later' ? 'primary' : 'flat'} aria-pressed={when === 'later'} onClick={() => setWhen('later')}>Schedule</Pill>
            </Track>
            {when === 'later' ? <div className="grid gap-1.5"><Label htmlFor="pg-from">Effective from (your local time)</Label><Input id="pg-from" type="datetime-local" className="w-60" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></div> : null}
            <div className="ml-auto flex gap-2">
              <Pill variant="flat" disabled={!edits.length || cmd.pending} onClick={() => { setDrafts({}); cmd.setError(null); }}>Discard</Pill>
              <Pill variant="primary" disabled={!edits.length || cmd.pending} onClick={publish}>{cmd.pending ? 'Publishing…' : `Publish ${edits.length || ''} price${edits.length === 1 ? '' : 's'}`}</Pill>
            </div>
          </div>
          {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
          {published ? <Notice>{published}</Notice> : null}
        </div>
      ) : null}
    </div>
  );
}

function PriceHistory({ priceListId, materialId, timeZone }: { priceListId: string; materialId: string; timeZone: string | null }) {
  const [state, setState] = useState<{ rows?: HistoryRow[]; error?: string } | null>(null);
  useEffect(() => { getHistory(priceListId, materialId).then((r) => setState(r.ok ? { rows: r.rows } : { error: r.error })); }, [priceListId, materialId]);
  if (!state) return <p className="py-2 text-sm text-muted-foreground">Loading history…</p>;
  if (state.error) return <Notice tone="alert">{state.error}</Notice>;
  if (!state.rows?.length) return <p className="py-2 text-sm text-muted-foreground">No prices published for this material on this list.</p>;
  return (
    <ol aria-label="Price history" className="flex flex-col gap-1 py-1 text-sm">
      {state.rows.map((h) => (
        <li key={h.id} className="grid grid-cols-[10rem_1fr_auto] gap-3 tabular-nums">
          <span>{fmt(h.unitPrice)}{h.unitPriceHigh ? `–${fmt(h.unitPriceHigh)}` : ''} / {UNIT_LABEL[h.unit] || h.unit}</span>
          <span className="text-muted-foreground">{dateTimeIn(h.effectiveFrom, timeZone)} → {h.effectiveTo ? dateTimeIn(h.effectiveTo, timeZone) : 'current'}{h.isPublic ? '' : ' · hidden'}</span>
          <span className="text-muted-foreground">{h.publishedBy?.name}</span>
        </li>
      ))}
    </ol>
  );
}
