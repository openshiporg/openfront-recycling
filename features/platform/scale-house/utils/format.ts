export function money(cents: number | null | undefined) {
  const v = Number(cents || 0) / 100;
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** A decimal weight as typed ("1234.50" → "1,234.5"). */
export function weight(value: string | number | null | undefined, unit = 'lb') {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${unit}`;
}

export function price(value: string | null | undefined, unit?: string | null) {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  const u = unit === 'net_ton' ? 'NT' : unit === 'gross_ton' ? 'GT' : unit === 'metric_tonne' ? 't' : unit || '';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}${u ? ` / ${u}` : ''}`;
}

export function minutesLabel(minutes: number) {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  return `${h} h ${minutes % 60} min`;
}

export function timeIn(at: string | Date | null | undefined, timeZone?: string | null) {
  if (!at) return '—';
  try { return new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...(timeZone ? { timeZone } : {}) }); }
  catch { return new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
}

export function dateTimeIn(at: string | Date | null | undefined, timeZone?: string | null) {
  if (!at) return '—';
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
  try { return new Date(at).toLocaleString('en-US', { ...opts, ...(timeZone ? { timeZone } : {}) }); }
  catch { return new Date(at).toLocaleString('en-US', opts); }
}

export const humanize = (value: string | null | undefined) => String(value || '').replace(/_/g, ' ');
