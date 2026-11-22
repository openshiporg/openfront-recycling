'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, Empty, Notice, Pill, StatusCell, Td, selectClass, type Tone } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import { addRestrictionAction, removeRestrictionAction } from '../actions';
import { RESTRICTION_KINDS, type Profile, type Restriction } from '../types';

const tone: Record<string, Tone> = { prohibited: 'alert', proof_of_ownership: 'wait', commercial_only: 'info', payment_rule: 'wait' };

function effects(r: Restriction) {
  const out: string[] = [];
  if (r.forbidCash) out.push('no cash');
  if (r.mailCheckOnly) out.push('check mailed to the seller’s address');
  if (Array.isArray(r.allowedMethods) && r.allowedMethods.length) out.push(`pay by ${r.allowedMethods.join(' or ')}`);
  if (r.paymentHoldDays) out.push(`hold payment ${r.paymentHoldDays} day${r.paymentHoldDays === 1 ? '' : 's'}`);
  if (r.materialHoldDays) out.push(`hold material ${r.materialHoldDays} day${r.materialHoldDays === 1 ? '' : 's'}`);
  if (Array.isArray(r.requiredDocuments) && r.requiredDocuments.length) out.push(`needs ${r.requiredDocuments.join(', ')}`);
  return out.join(' · ') || '—';
}

/** Rules that apply to this material in each rules profile (its own and its category's). */
export function Restrictions({ materialId, restrictions, profiles, canEdit }: { materialId: string; restrictions: Restriction[]; profiles: Profile[]; canEdit: boolean }) {
  const cmd = useCommand();
  return (
    <div className="flex flex-col gap-4">
      {restrictions.length ? (
        <DataTable label="Rules" head={[{ label: 'Rule' }, { label: 'Kind' }, { label: 'Profile' }, { label: 'Effect' }, { label: 'Applies through' }, { label: '' }]}>
          {restrictions.map((r) => (
            <tr key={r.id}>
              <Td><span className="font-medium">{r.label}</span>{r.publicNote ? <div className="text-xs text-muted-foreground">{r.publicNote}</div> : null}</Td>
              <Td><StatusCell tone={tone[r.kind] || 'off'}>{RESTRICTION_KINDS[r.kind] || r.kind}</StatusCell></Td>
              <Td>{r.profile?.name || '—'}</Td>
              <Td className="text-muted-foreground">{effects(r)}</Td>
              <Td>{r.material?.id === materialId ? 'This material' : r.category ? `Category: ${r.category.name}` : '—'}</Td>
              <Td className="text-right">{canEdit && r.material?.id === materialId ? <Pill size="sm" variant="flat" disabled={cmd.pending} onClick={() => cmd.run(() => removeRestrictionAction({ id: r.id, materialId }))}>Remove</Pill> : null}</Td>
            </tr>
          ))}
        </DataTable>
      ) : <Empty>No special rules. The yard’s rules profile applies as usual.</Empty>}
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
      {canEdit ? (profiles.length ? <AddRule materialId={materialId} profiles={profiles} /> : <Notice>No rules profile yet. Onboarding or Settings creates one.</Notice>) : null}
    </div>
  );
}

function AddRule({ materialId, profiles }: { materialId: string; profiles: Profile[] }) {
  const cmd = useCommand();
  const blank = { profileId: profiles[0]?.id || '', label: '', kind: 'payment_rule', forbidCash: false, mailCheckOnly: false, paymentHoldDays: '0', materialHoldDays: '0', publicNote: '', requiredDocuments: '' };
  const [f, setF] = useState(blank);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  return (
    <form className="flex flex-col gap-3 rounded-[6px] border p-3" onSubmit={(e) => {
      e.preventDefault();
      cmd.run(() => addRestrictionAction({ materialId, ...f, paymentHoldDays: Number(f.paymentHoldDays), materialHoldDays: Number(f.materialHoldDays) }), () => setF(blank));
    }}>
      <h3 className="text-sm font-medium">Add a rule</h3>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1.5"><Label htmlFor="rr-p">Rules profile</Label><select id="rr-p" className={selectClass} value={f.profileId} onChange={(e) => set({ profileId: e.target.value })}>{profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="grid gap-1.5"><Label htmlFor="rr-k">Kind</Label><select id="rr-k" className={selectClass} value={f.kind} onChange={(e) => set({ kind: e.target.value })}>{Object.entries(RESTRICTION_KINDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div className="grid gap-1.5"><Label htmlFor="rr-l">Rule</Label><Input id="rr-l" value={f.label} onChange={(e) => set({ label: e.target.value })} placeholder="Catalytic converters: check only" /></div>
      </div>
      {f.kind === 'payment_rule' || f.kind === 'proof_of_ownership' ? (
        <div className="grid gap-3 md:grid-cols-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.forbidCash} onChange={(e) => set({ forbidCash: e.target.checked })} />No cash</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.mailCheckOnly} onChange={(e) => set({ mailCheckOnly: e.target.checked })} />Mail the check</label>
          <div className="grid gap-1.5"><Label htmlFor="rr-ph">Hold payment (days)</Label><Input id="rr-ph" inputMode="numeric" value={f.paymentHoldDays} onChange={(e) => set({ paymentHoldDays: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label htmlFor="rr-mh">Hold material (days)</Label><Input id="rr-mh" inputMode="numeric" value={f.materialHoldDays} onChange={(e) => set({ materialHoldDays: e.target.value })} /></div>
        </div>
      ) : null}
      {f.kind === 'proof_of_ownership' ? <div className="grid gap-1.5"><Label htmlFor="rr-d">Documents needed (comma separated)</Label><Input id="rr-d" value={f.requiredDocuments} onChange={(e) => set({ requiredDocuments: e.target.value })} placeholder="vehicle title, contractor licence" /></div> : null}
      <div className="grid gap-1.5"><Label htmlFor="rr-n">Note shown to sellers</Label><Input id="rr-n" value={f.publicNote} onChange={(e) => set({ publicNote: e.target.value })} /></div>
      <Pill type="submit" variant="primary" size="sm" className="self-start" disabled={cmd.pending}>{cmd.pending ? 'Saving…' : 'Add rule'}</Pill>
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
    </form>
  );
}
