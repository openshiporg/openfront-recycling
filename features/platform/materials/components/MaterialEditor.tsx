'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Notice, Pill, selectClass } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import { createMaterialAction, updateMaterialAction } from '../actions';
import { UNITS, UNIT_LABEL, type MaterialDetail } from '../types';

type Cat = { id: string; name: string };

/** New material in a side sheet. */
export function MaterialEditor({ categories }: { categories: Cat[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pill variant="primary" onClick={() => setOpen(true)}><Plus />New material</Pill>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>New material</SheetTitle><SheetDescription>Then publish its price on each board under Pricing.</SheetDescription></SheetHeader>
          <div className="px-4 pb-6"><MaterialForm categories={categories} onCreated={() => setOpen(false)} /></div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function MaterialForm({ material, categories, onCreated }: { material?: MaterialDetail; categories: Cat[]; onCreated?: () => void }) {
  const router = useRouter();
  const cmd = useCommand();
  const [saved, setSaved] = useState(false);
  const [f, setF] = useState({
    name: material?.name || '', code: material?.code || '', categoryId: material?.category?.id || '', specName: material?.specName || '',
    description: material?.description || '', preparationTips: material?.preparationTips || '', defaultUnit: material?.defaultUnit || 'lb',
    direction: material?.direction || 'pay_seller', isPublic: material?.isPublic ?? true, isActive: material?.isActive ?? true,
    acceptsFromPublic: material?.acceptsFromPublic ?? true, sortOrder: String(material?.sortOrder ?? 0),
    minimumWeight: material?.minimumWeight ? String(Number(material.minimumWeight)) : '', standardContainerTare: material?.standardContainerTare ? String(Number(material.standardContainerTare)) : '',
  });
  const set = (patch: Partial<typeof f>) => { setSaved(false); setF((x) => ({ ...x, ...patch })); };
  const unit = f.defaultUnit === 'kg' || f.defaultUnit === 'metric_tonne' ? 'kg' : 'lb';
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => {
      e.preventDefault();
      const input = { ...f, sortOrder: Number(f.sortOrder) };
      if (material) cmd.run(() => updateMaterialAction(material.id, input), () => setSaved(true));
      else cmd.run(() => createMaterialAction(input), (d) => { onCreated?.(); const id = (d as { id?: string } | undefined)?.id; if (id) router.push(`/dashboard/platform/materials/${id}`); });
    }}>
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
        <div className="grid gap-1.5"><Label htmlFor="m-name">Name</Label><Input id="m-name" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="#1 Bare Bright Copper" /></div>
        <div className="grid gap-1.5"><Label htmlFor="m-code">Code</Label><Input id="m-code" value={f.code} onChange={(e) => set({ code: e.target.value })} placeholder="CU-1" /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5"><Label htmlFor="m-cat">Category</Label><select id="m-cat" className={selectClass} value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })}><option value="">None</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="grid gap-1.5"><Label htmlFor="m-spec">Grade spec (ISRI)</Label><Input id="m-spec" value={f.specName} onChange={(e) => set({ specName: e.target.value })} placeholder="Barley" /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5"><Label htmlFor="m-unit">Priced per</Label><select id="m-unit" className={selectClass} value={f.defaultUnit} onChange={(e) => set({ defaultUnit: e.target.value })}>{UNITS.map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}</select></div>
        <div className="grid gap-1.5"><Label htmlFor="m-dir">Money</Label><select id="m-dir" className={selectClass} value={f.direction} onChange={(e) => set({ direction: e.target.value })}><option value="pay_seller">Yard pays the seller</option><option value="charge_customer">Customer pays a fee</option></select></div>
        <div className="grid gap-1.5"><Label htmlFor="m-order">Board order</Label><Input id="m-order" inputMode="numeric" value={f.sortOrder} onChange={(e) => set({ sortOrder: e.target.value })} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5"><Label htmlFor="m-min">Minimum weight ({unit})</Label><Input id="m-min" inputMode="decimal" value={f.minimumWeight} onChange={(e) => set({ minimumWeight: e.target.value })} placeholder="None" /></div>
        <div className="grid gap-1.5"><Label htmlFor="m-tare">Standard container tare ({unit})</Label><Input id="m-tare" inputMode="decimal" value={f.standardContainerTare} onChange={(e) => set({ standardContainerTare: e.target.value })} placeholder="None" /></div>
      </div>
      <div className="grid gap-1.5"><Label htmlFor="m-desc">Description</Label><Textarea id="m-desc" rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} /></div>
      <div className="grid gap-1.5"><Label htmlFor="m-tips">Preparation tips (shown to sellers)</Label><Textarea id="m-tips" rows={3} value={f.preparationTips} onChange={(e) => set({ preparationTips: e.target.value })} placeholder="Strip insulation, remove brass fittings and solder." /></div>
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 text-sm font-medium">Where it shows</legend>
        <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={f.isActive} onChange={(e) => set({ isActive: e.target.checked })} />Active: the scale house can buy it</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={f.isPublic} onChange={(e) => set({ isPublic: e.target.checked })} />Shown on the public price board and site</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={f.acceptsFromPublic} onChange={(e) => set({ acceptsFromPublic: e.target.checked })} />Accepted from walk-in sellers</label>
      </fieldset>
      <div className="flex items-center gap-3">
        <Pill type="submit" variant="primary" disabled={cmd.pending}>{cmd.pending ? 'Saving…' : material ? 'Save material' : 'Create material'}</Pill>
        {saved ? <span role="status" className="text-sm text-muted-foreground">Saved.</span> : null}
      </div>
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
    </form>
  );
}
