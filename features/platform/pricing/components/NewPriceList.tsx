'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Notice, Pill, selectClass } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import type { YardChoice } from '@/features/platform/lib/staff';
import { createPriceListAction } from '../actions';
import { KIND_LABEL } from '../types';

const HELP: Record<string, string> = {
  board: 'The walk-in price at one yard. Tickets use it unless the seller or account has another list.',
  tier: 'A better or worse schedule for a group of sellers; set it on the seller.',
  contract: 'Agreed prices for a commercial account; set it on the account.',
  sell: 'What the yard asks when it sells material to mills and brokers.',
};

export function NewPriceList({ yards }: { yards: YardChoice[] }) {
  const router = useRouter();
  const cmd = useCommand();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('tier');
  const [yardId, setYardId] = useState('');
  return (
    <>
      <Pill variant="primary" onClick={() => setOpen(true)}><Plus />New price list</Pill>
      <Sheet open={open} onOpenChange={(v) => { if (!cmd.pending) setOpen(v); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle>New price list</SheetTitle><SheetDescription>Create the list, then publish its prices on the grid.</SheetDescription></SheetHeader>
          <form className="flex flex-col gap-4 px-4 pb-6" onSubmit={(e) => {
            e.preventDefault();
            cmd.run(() => createPriceListAction({ name, kind, yardId }), (d) => { setOpen(false); if (d && typeof d === 'object' && 'id' in d) router.push(`/dashboard/platform/pricing/${(d as { id: string }).id}`); });
          }}>
            <div className="grid gap-1.5"><Label htmlFor="pl-name">Name</Label><Input id="pl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contractor tier" /></div>
            <div className="grid gap-1.5">
              <Label htmlFor="pl-kind">Kind</Label>
              <select id="pl-kind" className={selectClass} value={kind} onChange={(e) => setKind(e.target.value)}>{Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <p className="text-xs text-muted-foreground">{HELP[kind]}</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pl-yard">Yard</Label>
              <select id="pl-yard" className={selectClass} value={yardId} onChange={(e) => setYardId(e.target.value)}><option value="">All yards</option>{yards.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select>
            </div>
            <Pill type="submit" variant="primary" disabled={cmd.pending}>{cmd.pending ? 'Creating…' : 'Create list'}</Pill>
            {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
