'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Empty, Notice, Pill } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import { upsertSiteAction } from '../actions';
import type { Site } from '../types';

export function Sites({ accountId, sites, canEdit }: { accountId: string; sites: Site[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      {sites.length ? sites.map((s) => editing === s.id ? <SiteForm key={s.id} accountId={accountId} site={s} onDone={() => setEditing(null)} /> : (
        <div key={s.id} className={'flex items-start justify-between gap-3 rounded-[6px] border p-3 ' + (s.isActive ? '' : 'opacity-60')}>
          <div className="min-w-0 text-sm">
            <div className="font-medium">{s.name}{s.isActive ? '' : ' · closed'}</div>
            <div className="text-muted-foreground">{[s.addressLine1, s.addressLine2, [s.city, s.region, s.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</div>
            {s.contactName || s.contactPhone ? <div className="text-xs text-muted-foreground">On site: {[s.contactName, s.contactPhone].filter(Boolean).join(' · ')}</div> : null}
            {s.accessNotes ? <div className="text-xs text-muted-foreground">Access: {s.accessNotes}</div> : null}
          </div>
          {canEdit ? <Pill size="sm" variant="flat" onClick={() => setEditing(s.id)}>Edit</Pill> : null}
        </div>
      )) : <Empty>No sites. Add the addresses where containers go or pickups happen.</Empty>}
      {canEdit ? (editing === 'new' ? <SiteForm accountId={accountId} onDone={() => setEditing(null)} /> : <Pill size="sm" className="self-start" onClick={() => setEditing('new')}>Add a site</Pill>) : null}
    </div>
  );
}

function SiteForm({ accountId, site, onDone }: { accountId: string; site?: Site; onDone: () => void }) {
  const cmd = useCommand();
  const [f, setF] = useState({
    name: site?.name || '', addressLine1: site?.addressLine1 || '', addressLine2: site?.addressLine2 || '', city: site?.city || '', region: site?.region || '', postalCode: site?.postalCode || '',
    contactName: site?.contactName || '', contactPhone: site?.contactPhone || '', accessNotes: site?.accessNotes || '', isActive: site?.isActive ?? true,
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const id = site?.id || 'new';
  const input = (k: 'name' | 'addressLine1' | 'addressLine2' | 'city' | 'region' | 'postalCode' | 'contactName' | 'contactPhone' | 'accessNotes', label: string) => (
    <div className="grid gap-1.5"><Label htmlFor={`st-${k}-${id}`}>{label}</Label><Input id={`st-${k}-${id}`} value={f[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<typeof f>)} /></div>
  );
  return (
    <form className="flex flex-col gap-3 rounded-[6px] border p-3" onSubmit={(e) => { e.preventDefault(); cmd.run(() => upsertSiteAction({ accountId, siteId: site?.id, ...f }), onDone); }}>
      {input('name', 'Site name')}
      <div className="grid gap-3 sm:grid-cols-2">{input('addressLine1', 'Street')}{input('addressLine2', 'Suite, gate')}</div>
      <div className="grid gap-3 sm:grid-cols-3">{input('city', 'City')}{input('region', 'State')}{input('postalCode', 'ZIP')}</div>
      <div className="grid gap-3 sm:grid-cols-2">{input('contactName', 'On-site contact')}{input('contactPhone', 'Contact phone')}</div>
      {input('accessNotes', 'Access notes for drivers')}
      {site ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.isActive} onChange={(e) => set({ isActive: e.target.checked })} />Site is open</label> : null}
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
      <div className="flex gap-2"><Pill type="submit" size="sm" variant="primary" disabled={cmd.pending}>{cmd.pending ? 'Saving…' : 'Save site'}</Pill><Pill size="sm" variant="flat" onClick={onDone}>Cancel</Pill></div>
    </form>
  );
}
