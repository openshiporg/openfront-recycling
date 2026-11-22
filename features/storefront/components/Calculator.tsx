'use client';

import { useMemo, useState } from 'react';
import { computeLine } from '@/features/recycling/ticketMath';

export type CalcRow = { id: string; name: string; category: string; unit: string; unitPrice: string; direction: string };

function fmtMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}
const UNIT: Record<string, string> = { lb: 'lb', cwt: '100 lb', net_ton: 'net ton', gross_ton: 'gross ton', kg: 'kg', metric_tonne: 'tonne', each: 'each' };

/**
 * P7. Uses the same line maths as the scale (features/recycling/ticketMath), so with the same weights
 * and today's price the estimate equals the ticket line before deductions.
 */
export function Calculator({ rows, currency, weightUnit }: { rows: CalcRow[]; currency: string; weightUnit: 'lb' | 'kg' }) {
  const [picked, setPicked] = useState<Array<{ key: number; id: string; amount: string }>>([{ key: 1, id: rows[0]?.id || '', amount: '' }]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  const lines = picked.map((p) => {
    const r = byId.get(p.id);
    if (!r || !p.amount || !(Number(p.amount) > 0)) return { p, r, cents: 0 };
    try {
      const each = r.unit === 'each';
      const res = computeLine(
        { grossWeight: each ? 0 : p.amount, tareWeight: 0, quantity: each ? Math.round(Number(p.amount)) : null, unit: r.unit, unitPrice: r.unitPrice, direction: r.direction },
        weightUnit,
      );
      return { p, r, cents: res.signedAmountCents };
    } catch {
      return { p, r, cents: 0 };
    }
  });
  const total = lines.reduce((s, l) => s + l.cents, 0);
  const update = (key: number, patch: Partial<{ id: string; amount: string }>) => setPicked((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const categories = [...new Set(rows.map((r) => r.category))];

  return (
    <div className="sf-stack">
      {picked.map(({ key, id, amount }, i) => {
        const r = byId.get(id);
        const each = r?.unit === 'each';
        const cents = lines[i]?.cents || 0;
        return (
          <div key={key} className="sf-card sf-card-flat sf-stack" style={{ gap: 10 }}>
            <div className="sf-row3" style={{ alignItems: 'end' }}>
              <div className="sf-field">
                <label htmlFor={`m${key}`}>Material</label>
                <select id={`m${key}`} className="sf-select" value={id} onChange={(e) => update(key, { id: e.target.value })}>
                  {categories.map((c) => (
                    <optgroup key={c} label={c}>
                      {rows.filter((x) => x.category === c).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="sf-field">
                <label htmlFor={`w${key}`}>{each ? 'How many' : `Weight (${weightUnit})`}</label>
                <input id={`w${key}`} className="sf-input" inputMode="decimal" type="number" min="0" step={each ? 1 : 0.1} value={amount} onChange={(e) => update(key, { amount: e.target.value })} placeholder="0" />
              </div>
              <div className="sf-field" aria-live="polite">
                <span className="sf-label">{r?.direction === 'charge_customer' ? 'Fee' : 'Estimate'}</span>
                <strong className={`sf-price${cents < 0 ? ' sf-price-fee' : ''}`} style={{ fontSize: 22, minHeight: 48, display: 'flex', alignItems: 'center' }}>{fmtMoney(Math.abs(cents), currency)}</strong>
              </div>
            </div>
            <div className="sf-between sf-small sf-muted">
              <span>{r ? `${new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(Number(r.unitPrice))} ${r.unit === 'each' ? 'each' : `per ${UNIT[r.unit] || r.unit}`}` : ''}</span>
              {picked.length > 1 ? <button type="button" className="sf-link" style={{ background: 'none', border: 0, cursor: 'pointer', minHeight: 44 }} onClick={() => setPicked((xs) => xs.filter((x) => x.key !== key))}>Remove</button> : null}
            </div>
          </div>
        );
      })}
      <div className="sf-between">
        <button type="button" className="sf-btn sf-btn-ghost sf-btn-sm" onClick={() => setPicked((xs) => [...xs, { key: Math.max(0, ...xs.map((x) => x.key)) + 1, id: rows[0]?.id || '', amount: '' }])}>Add another material</button>
        <div className="sf-card" style={{ padding: '14px 20px' }} aria-live="polite">
          <span className="sf-muted sf-small">{total < 0 ? 'You would pay about' : 'You would get about'}</span>
          <div className="sf-price" style={{ fontSize: 34 }}>{fmtMoney(Math.abs(total), currency)}</div>
        </div>
      </div>
    </div>
  );
}
