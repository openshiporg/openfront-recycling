'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createVisitAction } from '../../lib/actions';
import { ActionForm, Submit } from '../ActionForm';

type Props = {
  yards: Array<{ slug: string; name: string }>;
  yardSlug: string;
  minDate: string;
  maxDate: string;
  zone: string;
  vehicles: Array<{ id: string; label: string }>;
  requirePlate: boolean;
  materials: Array<{ id: string; name: string; category: string; fee: boolean }>;
  weightUnit: 'lb' | 'kg';
  idempotencyKey: string;
};

export function CheckInForm(p: Props) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const cats = [...new Set(p.materials.map((m) => m.category))];
  const toggle = (id: string) => setPicked((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  return (
    <ActionForm action={createVisitAction}>
      {(f) => (
        <>
          <input type="hidden" name="idempotencyKey" value={p.idempotencyKey} />
          {p.yards.length > 1 ? (
            <div className="sf-field">
              <label htmlFor="yd">Yard</label>
              <select id="yd" name="yardSlug" className="sf-select" defaultValue={p.yardSlug} onChange={(e) => router.push(`/sell/check-in?yard=${e.target.value}`)}>
                {p.yards.map((y) => <option key={y.slug} value={y.slug}>{y.name}</option>)}
              </select>
            </div>
          ) : (
            <><input type="hidden" name="yardSlug" value={p.yardSlug} /><p style={{ margin: 0 }}><strong>Yard:</strong> {p.yards[0]?.name}</p></>
          )}
          <div className="sf-field">
            <label htmlFor="dt">Day you’re coming</label>
            <input id="dt" name="plannedDate" type="date" className="sf-input" required min={p.minDate} max={p.maxDate} defaultValue={f.plannedDate || p.minDate} />
            <span className="sf-hint">Dates are in {p.zone}.</span>
          </div>
          <div className="sf-field">
            <label htmlFor="vh">Vehicle</label>
            {p.vehicles.length ? (
              <select id="vh" name="vehicleId" className="sf-select" required={p.requirePlate} defaultValue={f.vehicleId || p.vehicles[0].id}>
                {!p.requirePlate ? <option value="">I’ll tell the scale</option> : null}
                {p.vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            ) : (
              <p className={`sf-note ${p.requirePlate ? 'sf-note-warn' : ''}`} style={{ margin: 0 }}>
                {p.requirePlate ? 'This yard records the plate of every vehicle. ' : 'No vehicle on file. '}
                <Link className="sf-link" href="/account/vehicles?next=/sell/check-in">Add a vehicle</Link>
              </p>
            )}
          </div>
          {p.materials.length ? (
            <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="sf-stack">
              <legend className="sf-label" style={{ marginBottom: 6 }}>What are you bringing? <span className="sf-muted" style={{ fontWeight: 400 }}>(optional, helps the yard get ready)</span></legend>
              {cats.map((c) => (
                <div key={c}>
                  <div className="sf-small sf-muted" style={{ marginBottom: 6 }}>{c}</div>
                  <div className="sf-grid sf-grid-2" style={{ gap: 8 }}>
                    {p.materials.filter((m) => m.category === c).map((m) => (
                      <div key={m.id} className="sf-check" style={{ flexWrap: 'wrap' }}>
                        <input id={`mt${m.id}`} type="checkbox" name="materialId" value={m.id} checked={picked.includes(m.id)} onChange={() => toggle(m.id)} />
                        <label htmlFor={`mt${m.id}`} style={{ flex: 1, fontWeight: 600 }}>{m.name}{m.fee ? <span className="sf-muted" style={{ fontWeight: 400 }}> (fee)</span> : null}</label>
                        {picked.includes(m.id) ? (
                          <input aria-label={`About how much ${m.name}, in ${p.weightUnit}`} name={`weight_${m.id}`} type="number" min="0" step="1" inputMode="numeric" className="sf-input" style={{ width: 130, minHeight: 44 }} placeholder={`About ${p.weightUnit}`} />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
          ) : null}
          <Submit pending="Checking you in…">Get my scale pass</Submit>
        </>
      )}
    </ActionForm>
  );
}
