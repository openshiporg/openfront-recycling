'use client';

import { useRef } from 'react';
import { Camera } from 'lucide-react';
import { Notice, Pill } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import { uploadIdPhotoAction } from '../actions';

/** Take or choose a photo of the seller's ID; on a phone or tablet this opens the camera. */
export function IdPhotoButton({ sellerId, documentId, side = 'front', label }: { sellerId: string; documentId: string; side?: 'front' | 'back'; label?: string }) {
  const cmd = useCommand();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" aria-label={side === 'back' ? 'ID photo, back' : 'ID photo, front'} onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const form = new FormData();
        form.set('sellerId', sellerId); form.set('documentId', documentId); form.set('side', side); form.set('image', file);
        cmd.run(() => uploadIdPhotoAction(form));
        e.target.value = '';
      }} />
      <Pill size="sm" className="self-start" disabled={cmd.pending} onClick={() => input.current?.click()}><Camera />{cmd.pending ? 'Uploading…' : label || (side === 'back' ? 'Photo of the back' : 'Photo of the front')}</Pill>
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
    </div>
  );
}
