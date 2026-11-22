'use client';

import { useRef } from 'react';
import { Camera } from 'lucide-react';
import { Notice, Pill } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import { uploadMaterialImageAction } from '../actions';

export function MaterialImage({ materialId, url, canEdit }: { materialId: string; url: string | null; canEdit: boolean }) {
  const cmd = useCommand();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-3">
      {url ? <img src={url} alt="" className="aspect-[4/3] w-full rounded-[6px] border object-cover" /> : <div className="grid aspect-[4/3] w-full place-items-center rounded-[6px] border bg-muted text-sm text-muted-foreground">No photo yet</div>}
      {canEdit ? (
        <>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Material photo" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const form = new FormData();
            form.set('materialId', materialId);
            form.set('image', file);
            cmd.run(() => uploadMaterialImageAction(form));
            e.target.value = '';
          }} />
          <Pill className="self-start" disabled={cmd.pending} onClick={() => input.current?.click()}><Camera />{cmd.pending ? 'Uploading…' : url ? 'Replace photo' : 'Add photo'}</Pill>
          <p className="text-xs text-muted-foreground">Shown on the public price board. JPEG, PNG or WebP up to 8 MB.</p>
        </>
      ) : null}
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
    </div>
  );
}
