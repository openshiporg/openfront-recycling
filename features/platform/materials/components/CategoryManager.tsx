'use client';

import { useState } from 'react';
import { FolderTree } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Notice, Pill, selectClass } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import { humanize } from '@/features/platform/lib/format';
import { saveCategoryAction } from '../actions';
import { CATEGORY_KINDS, type Category } from '../types';

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pill onClick={() => setOpen(true)}><FolderTree />Categories</Pill>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle>Categories</SheetTitle><SheetDescription>Groups on the price board and the public site, in this order.</SheetDescription></SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-6">
            {categories.map((c) => <CategoryRow key={c.id} category={c} />)}
            <h3 className="pt-3 text-sm font-medium">New category</h3>
            <CategoryRow />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function CategoryRow({ category }: { category?: Category }) {
  const cmd = useCommand();
  const [name, setName] = useState(category?.name || '');
  const [kind, setKind] = useState(category?.kind || 'non_ferrous');
  const [order, setOrder] = useState(String(category?.sortOrder ?? 0));
  const id = category?.id || 'new';
  return (
    <form className="flex flex-col gap-2 rounded-[6px] border p-3" onSubmit={(e) => {
      e.preventDefault();
      cmd.run(() => saveCategoryAction({ id: category?.id, name, kind, sortOrder: Number(order) }), () => { if (!category) { setName(''); setOrder('0'); } });
    }}>
      <div className="grid grid-cols-[1fr_9rem_4.5rem] gap-2">
        <div className="grid gap-1"><Label htmlFor={`cat-n-${id}`} className="text-xs">Name</Label><Input id={`cat-n-${id}`} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid gap-1"><Label htmlFor={`cat-k-${id}`} className="text-xs">Kind</Label><select id={`cat-k-${id}`} className={selectClass} value={kind} onChange={(e) => setKind(e.target.value)}>{CATEGORY_KINDS.map((k) => <option key={k} value={k}>{humanize(k)}</option>)}</select></div>
        <div className="grid gap-1"><Label htmlFor={`cat-o-${id}`} className="text-xs">Order</Label><Input id={`cat-o-${id}`} inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value)} /></div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{category ? `${category.materialsCount} material${category.materialsCount === 1 ? '' : 's'}` : ''}</span>
        <Pill type="submit" size="sm" variant={category ? 'flat' : 'primary'} disabled={cmd.pending}>{cmd.pending ? 'Saving…' : category ? 'Save' : 'Add category'}</Pill>
      </div>
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
    </form>
  );
}
