'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Notice, Pill, selectClass } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import { updateSellerAction } from '../actions';
import type { SellerDetail } from '../types';

export function SellerProfileForm({ seller }: { seller: SellerDetail }) {
  const cmd = useCommand();
  const [saved, setSaved] = useState(false);
  const [f, setF] = useState({
    firstName: seller.firstName, lastName: seller.lastName, dateOfBirth: seller.dateOfBirth ? seller.dateOfBirth.slice(0, 10) : '', phone: seller.phone || '', email: seller.email || '',
    addressLine1: seller.addressLine1 || '', addressLine2: seller.addressLine2 || '', city: seller.city || '', region: seller.region || '', postalCode: seller.postalCode || '', country: seller.country || 'US',
    preferredPayout: seller.preferredPayout || 'cash', notes: seller.notes || '',
  });
  const set = (p: Partial<typeof f>) => { setSaved(false); setF((x) => ({ ...x, ...p })); };
  const field = (k: keyof typeof f, label: string, extra: Record<string, unknown> = {}) => (
    <div className="grid gap-1.5"><Label htmlFor={`sp-${k}`}>{label}</Label><Input id={`sp-${k}`} value={f[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<typeof f>)} {...extra} /></div>
  );
  return (
    <form className="flex max-w-3xl flex-col gap-4" onSubmit={(e) => { e.preventDefault(); cmd.run(() => updateSellerAction(seller.id, f), () => setSaved(true)); }}>
      <div className="grid gap-3 sm:grid-cols-3">{field('firstName', 'First name')}{field('lastName', 'Last name')}{field('dateOfBirth', 'Date of birth', { type: 'date' })}</div>
      <div className="grid gap-3 sm:grid-cols-2">{field('phone', 'Phone', { inputMode: 'tel' })}{field('email', 'Email', { type: 'email' })}</div>
      <div className="grid gap-3 sm:grid-cols-2">{field('addressLine1', 'Address')}{field('addressLine2', 'Address line 2')}</div>
      <div className="grid gap-3 sm:grid-cols-4">{field('city', 'City')}{field('region', 'State')}{field('postalCode', 'ZIP')}{field('country', 'Country')}</div>
      <div className="grid gap-1.5 sm:w-64"><Label htmlFor="sp-pay">Prefers to be paid by</Label><select id="sp-pay" className={selectClass} value={f.preferredPayout} onChange={(e) => set({ preferredPayout: e.target.value })}><option value="cash">Cash</option><option value="check">Check</option><option value="transfer">Transfer</option></select></div>
      <div className="grid gap-1.5"><Label htmlFor="sp-notes">Staff notes</Label><Textarea id="sp-notes" rows={3} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
      <div className="flex items-center gap-3"><Pill type="submit" variant="primary" disabled={cmd.pending}>{cmd.pending ? 'Saving…' : 'Save seller'}</Pill>{saved ? <span role="status" className="text-sm text-muted-foreground">Saved.</span> : null}</div>
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
    </form>
  );
}
