'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Empty, Notice, Pill, StatusCell, selectClass } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import { dateTimeIn } from '@/features/platform/lib/format';
import { addIdAction, verifyIdAction } from '../actions';
import { ID_KINDS, type IdDoc } from '../types';
import { IdPhotoButton } from './IdPhotoButton';

const dateOnly = (v: string | null) => (v ? new Date(v).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }) : null);

export function IdDocuments({ sellerId, docs, canEdit, tz }: { sellerId: string; docs: IdDoc[]; canEdit: boolean; tz?: string | null }) {
  const cmd = useCommand();
  const [adding, setAdding] = useState(false);
  const now = Date.now();
  return (
    <div className="flex flex-col gap-3">
      {docs.length ? docs.map((d) => {
        const expired = d.expiresOn ? new Date(d.expiresOn).getTime() < now : false;
        return (
          <div key={d.id} className="flex flex-wrap items-start justify-between gap-3 rounded-[6px] border p-3">
            <div className="min-w-0">
              <div className="font-medium">{ID_KINDS[d.kind] || d.kind} <span className="font-mono">{d.number}</span>{d.issuer ? <span className="text-muted-foreground"> · {d.issuer}</span> : null}</div>
              <div className="text-xs text-muted-foreground">{d.expiresOn ? `${expired ? 'Expired' : 'Expires'} ${dateOnly(d.expiresOn)}` : 'No expiry recorded'}{d.isCurrent ? '' : ' · replaced'}</div>
              <div className="mt-1">{expired ? <StatusCell tone="alert">Expired</StatusCell> : d.verifiedAt ? <StatusCell tone="live">Checked by {d.verifiedBy?.name || 'staff'}, {dateTimeIn(d.verifiedAt, tz)}</StatusCell> : <StatusCell tone="wait">Not checked yet</StatusCell>}</div>
              {d.frontImage || d.backImage ? (
                <div className="mt-2 flex gap-2">
                  {[d.frontImage, d.backImage].filter(Boolean).map((img, i) => <a key={i} href={img!.url} target="_blank" rel="noreferrer"><img src={img!.url} alt={i ? 'ID back' : 'ID front'} className="h-16 w-24 rounded-[4px] border object-cover" /></a>)}
                </div>
              ) : null}
              {canEdit && d.isCurrent ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <IdPhotoButton sellerId={sellerId} documentId={d.id} side="front" label={d.frontImage ? 'Retake front' : 'Photo of the front'} />
                  <IdPhotoButton sellerId={sellerId} documentId={d.id} side="back" label={d.backImage ? 'Retake back' : 'Photo of the back'} />
                </div>
              ) : null}
            </div>
            {canEdit && !d.verifiedAt && !expired && d.isCurrent ? <Pill size="sm" disabled={cmd.pending} onClick={() => cmd.run(() => verifyIdAction({ sellerId, documentId: d.id }))}>Mark checked</Pill> : null}
          </div>
        );
      }) : <Empty>No ID on file. The scale house records it on the seller’s first ticket.</Empty>}
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
      {canEdit ? (adding ? <AddId sellerId={sellerId} onDone={() => setAdding(false)} /> : <Pill size="sm" className="self-start" onClick={() => setAdding(true)}>Add an ID</Pill>) : null}
    </div>
  );
}

function AddId({ sellerId, onDone }: { sellerId: string; onDone: () => void }) {
  const cmd = useCommand();
  const [f, setF] = useState({ kind: 'drivers_license', number: '', issuer: '', expiresOn: '' });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  return (
    <form className="flex flex-col gap-3 rounded-[6px] border p-3" onSubmit={(e) => { e.preventDefault(); cmd.run(() => addIdAction({ sellerId, ...f }), onDone); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5"><Label htmlFor="id-kind">Kind</Label><select id="id-kind" className={selectClass} value={f.kind} onChange={(e) => set({ kind: e.target.value })}>{Object.entries(ID_KINDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div className="grid gap-1.5"><Label htmlFor="id-num">Number</Label><Input id="id-num" value={f.number} onChange={(e) => set({ number: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="id-iss">Issued by (state)</Label><Input id="id-iss" value={f.issuer} onChange={(e) => set({ issuer: e.target.value })} placeholder="OH" /></div>
        <div className="grid gap-1.5"><Label htmlFor="id-exp">Expires</Label><Input id="id-exp" type="date" value={f.expiresOn} onChange={(e) => set({ expiresOn: e.target.value })} /></div>
      </div>
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
      <div className="flex gap-2"><Pill type="submit" size="sm" variant="primary" disabled={cmd.pending}>{cmd.pending ? 'Saving…' : 'Save ID'}</Pill><Pill size="sm" variant="flat" onClick={onDone}>Cancel</Pill></div>
    </form>
  );
}
