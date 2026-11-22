'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pill, Track } from '@/features/platform/lib/ui';

/** Finger or mouse signature on a canvas, saved as a PNG with the printed name. */
export function SignaturePad({ defaultName, pending, onSave, onCancel }: { defaultName: string; pending: boolean; onSave: (png: Blob, name: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111';
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext('2d')!;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext('2d')!;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  };
  const up = () => { drawing.current = false; };
  const clear = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
    setHasInk(false);
  };
  const save = () => canvasRef.current?.toBlob((b) => { if (b) onSave(b, name.trim()); }, 'image/png');

  return (
    <div className="flex flex-col gap-3 rounded-[6px] border p-3">
      <p className="text-sm">I am the owner of this material, or am authorised to sell it, and the information I gave is true.</p>
      <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} className="h-40 w-full touch-none rounded-[6px] border bg-white" aria-label="Signature pad" />
      <div className="flex flex-col gap-1.5"><Label htmlFor="sig-name">Printed name</Label><Input id="sig-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <Track>
        <Pill variant="primary" size="sm" disabled={!hasInk || !name.trim() || pending} onClick={save}>{pending ? 'Saving…' : 'Save signature'}</Pill>
        <Pill size="sm" variant="flat" onClick={clear} disabled={pending}>Clear</Pill>
        <Pill size="sm" variant="flat" onClick={onCancel} disabled={pending}>Cancel</Pill>
      </Track>
    </div>
  );
}
