'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Empty, Notice, Pill, Tag, selectClass } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import { humanize, weight } from '@/features/platform/lib/format';
import { addVehicleAction, removeVehicleAction } from '../actions';
import { VEHICLE_KINDS, type Vehicle } from '../types';

export function Vehicles({ sellerId, vehicles, canEdit }: { sellerId: string; vehicles: Vehicle[]; canEdit: boolean }) {
  const cmd = useCommand();
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {vehicles.length ? vehicles.map((v) => (
        <div key={v.id} className={'flex items-center justify-between gap-3 rounded-[6px] border p-3 ' + (v.isRemoved ? 'opacity-60' : '')}>
          <div>
            <div className="font-medium"><Tag>{v.plate || 'No plate'}</Tag>{v.plateRegion ? <span className="ml-1 text-muted-foreground">{v.plateRegion}</span> : null}</div>
            <div className="text-xs text-muted-foreground">{[v.color, v.make, v.model].filter(Boolean).join(' ')}{v.make || v.model || v.color ? ' · ' : ''}{humanize(v.kind)}{v.storedTare ? ` · stored tare ${weight(v.storedTare)}` : ''}{v.isRemoved ? ' · no longer used' : ''}</div>
          </div>
          {canEdit ? <Pill size="sm" variant="flat" disabled={cmd.pending} onClick={() => cmd.run(() => removeVehicleAction({ sellerId, vehicleId: v.id, removed: !v.isRemoved }))}>{v.isRemoved ? 'Restore' : 'No longer used'}</Pill> : null}
        </div>
      )) : <Empty>No vehicles on file.</Empty>}
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
      {canEdit ? (adding ? <AddVehicle sellerId={sellerId} onDone={() => setAdding(false)} /> : <Pill size="sm" className="self-start" onClick={() => setAdding(true)}>Add a vehicle</Pill>) : null}
    </div>
  );
}

function AddVehicle({ sellerId, onDone }: { sellerId: string; onDone: () => void }) {
  const cmd = useCommand();
  const [f, setF] = useState({ plate: '', plateRegion: '', make: '', model: '', color: '', kind: 'pickup' });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  return (
    <form className="flex flex-col gap-3 rounded-[6px] border p-3" onSubmit={(e) => { e.preventDefault(); cmd.run(() => addVehicleAction({ sellerId, ...f }), onDone); }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5"><Label htmlFor="v-plate">Plate</Label><Input id="v-plate" value={f.plate} onChange={(e) => set({ plate: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="v-reg">State</Label><Input id="v-reg" value={f.plateRegion} onChange={(e) => set({ plateRegion: e.target.value })} placeholder="OH" /></div>
        <div className="grid gap-1.5"><Label htmlFor="v-kind">Kind</Label><select id="v-kind" className={selectClass} value={f.kind} onChange={(e) => set({ kind: e.target.value })}>{VEHICLE_KINDS.map((k) => <option key={k} value={k}>{humanize(k)}</option>)}</select></div>
        <div className="grid gap-1.5"><Label htmlFor="v-make">Make</Label><Input id="v-make" value={f.make} onChange={(e) => set({ make: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="v-model">Model</Label><Input id="v-model" value={f.model} onChange={(e) => set({ model: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="v-color">Colour</Label><Input id="v-color" value={f.color} onChange={(e) => set({ color: e.target.value })} /></div>
      </div>
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
      <div className="flex gap-2"><Pill type="submit" size="sm" variant="primary" disabled={cmd.pending}>{cmd.pending ? 'Saving…' : 'Save vehicle'}</Pill><Pill size="sm" variant="flat" onClick={onDone}>Cancel</Pill></div>
    </form>
  );
}
