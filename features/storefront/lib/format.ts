/**
 * Plain-words formatting for the storefront. Money arrives as integer cents with the business currency;
 * weights in the business unit; times are always shown with the yard's time zone named.
 * No raw enum value reaches the page: every status goes through a label table here.
 */

export function money(cents: number | null | undefined, currency = 'USD') {
  const value = Number(cents ?? 0) / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(value);
}

/** A unit price is dollars per unit as a decimal string (five places). Show up to 3 places, at least 2. */
export function unitPriceText(price: string | number | null | undefined, currency = 'USD') {
  if (price === null || price === undefined || price === '') return '—';
  const n = Number(price);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2, maximumFractionDigits: n < 10 ? 3 : 2 }).format(n);
}

const UNIT_LABEL: Record<string, string> = {
  lb: 'lb', cwt: '100 lb', net_ton: 'net ton', gross_ton: 'gross ton', kg: 'kg', metric_tonne: 'tonne', each: 'each',
};
export function unitLabel(unit: string | null | undefined) {
  return UNIT_LABEL[String(unit || '')] || 'unit';
}
export function perUnit(unit: string | null | undefined) {
  return unit === 'each' ? 'each' : `per ${unitLabel(unit)}`;
}

export function weight(value: string | number | null | undefined, unit: string | null | undefined = 'lb') {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)} ${unit === 'kg' ? 'kg' : 'lb'}`;
}

function safeZone(tz: string | null | undefined) {
  const zone = tz || 'America/New_York';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    return 'America/New_York';
  }
}

/** "Sun 22 Nov 2026, 9:05 AM CST" */
export function dateTime(value: string | Date | null | undefined, tz?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const zone = safeZone(tz);
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(d);
  return `${date}, ${time}`;
}

/** "Tue 24 Nov" (in the yard's zone) */
export function shortDate(value: string | Date | null | undefined, tz?: string | null, withYear = false) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone: safeZone(tz), weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(d);
}

export function zoneName(tz: string | null | undefined, at: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: safeZone(tz), timeZoneName: 'long' }).formatToParts(at);
  return parts.find((p) => p.type === 'timeZoneName')?.value || safeZone(tz);
}

/** YYYY-MM-DD for "today" in a zone (for date inputs). */
export function todayIn(tz: string | null | undefined, offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: safeZone(tz), year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return parts;
}

// ---- Status labels (never show a raw enum) ----

const LABELS: Record<string, Record<string, string>> = {
  ticket: { open: 'In progress', completed: 'Completed', settled: 'Paid in full', voided: 'Cancelled' },
  payout: { pending: 'Being prepared', held: 'On hold', ready: 'Ready to collect', paid: 'Paid', cancelled: 'Cancelled', returned: 'Returned' },
  payoutMethod: { cash: 'Cash', check: 'Check', transfer: 'Bank transfer' },
  visit: { booked: 'Booked', arrived: 'Arrived', cancelled: 'Cancelled', expired: 'Expired' },
  hold: { held: 'On hold', released: 'Released', police_hold: 'Held by police request', seized: 'Seized', cancelled: 'Cancelled' },
  idVerification: { unverified: 'Not yet checked at the yard', verified: 'Checked at the yard', expired: 'Expired' },
  sellerStatus: { active: 'Active', flagged: 'Active', do_not_buy: 'Please speak to the yard' },
  idKind: { drivers_license: 'Driver’s licence', state_id: 'State ID card', passport: 'Passport', military_id: 'Military ID', other: 'Other government ID' },
  vehicleKind: { car: 'Car', pickup: 'Pickup truck', box_truck: 'Box truck', trailer: 'Trailer', roll_off: 'Roll-off truck', semi: 'Semi truck', other: 'Other' },
  deduction: { dirt: 'Dirt', moisture: 'Moisture', plastic: 'Plastic', attachments: 'Attachments', oil: 'Oil', other: 'Other' },
  restriction: { prohibited: 'Not accepted', proof_of_ownership: 'Proof of ownership needed', commercial_only: 'Business accounts only', payment_rule: 'Special payment rules' },
  direction: { pay_seller: 'We pay you', charge_customer: 'Drop-off fee' },
  categoryKind: { ferrous: 'Ferrous', non_ferrous: 'Non-ferrous', electronics: 'Electronics', paper: 'Paper', plastic: 'Plastic', glass: 'Glass', other: 'Other' },
  documents: { title: 'Vehicle title', repair_invoice: 'Repair invoice', business_licence: 'Business licence', bill_of_sale: 'Bill of sale', receipt: 'Purchase receipt' },
  application: { submitted: 'Waiting for review', approved: 'Approved', declined: 'Declined', withdrawn: 'Withdrawn' },
  applicationKind: { supplier: 'Commercial supplier', buyer: 'Buyer', nonprofit: 'Nonprofit partner' },
  request: { requested: 'Received', awaiting_payment: 'Waiting for payment', approved: 'Approved', scheduled: 'Scheduled', completed: 'Done', declined: 'Declined', cancelled: 'Cancelled' },
  requestKind: { deliver: 'Deliver a container', swap: 'Swap a container', pickup: 'Empty a container', remove: 'Remove a container', live_load: 'Live load', public_pickup: 'Pickup' },
  window: { any: 'Any time', morning: 'Morning', afternoon: 'Afternoon' },
  job: { planned: 'Planned', assigned: 'Driver assigned', en_route: 'On the way', on_site: 'On site', completed: 'Done', failed: 'Could not be done', cancelled: 'Cancelled' },
  form: { loose: 'Loose', baled: 'Baled', sheared: 'Sheared', shredded: 'Shredded', briquetted: 'Briquetted', boxed: 'In boxes', gaylord: 'In gaylords', drum: 'In drums', ingot: 'Ingots', bundle: 'Bundles' },
  contactRole: { admin: 'Admin', member: 'Member', billing: 'Billing', driver: 'Driver' },
  accountStatus: { active: 'Active', suspended: 'Suspended' },
  paymentTerms: { pay_at_scale: 'Paid at the scale', on_account: 'On account', prepay: 'Prepaid', net: 'Net terms' },
  cycle: { weekly: 'Weekly', semi_monthly: 'Twice a month', monthly: 'Monthly' },
  container: { in_yard: 'In the yard', assigned: 'Assigned', at_customer: 'On site', in_transit: 'On the truck', maintenance: 'In repair', retired: 'Retired' },
  settlement: { draft: 'Being prepared', approved: 'Approved', paid: 'Paid', void: 'Cancelled' },
  chargeKind: { haul: 'Haul', delivery: 'Delivery', rental: 'Container rental', dry_run: 'Dry run', other: 'Other' },
  invoice: { draft: 'Draft', open: 'Open', partially_paid: 'Part paid', paid: 'Paid', void: 'Cancelled', refunded: 'Refunded' },
  invoiceKind: { ticket: 'Scale ticket', service: 'Service', settlement: 'Settlement', shipment: 'Shipment', other: 'Other' },
  payment: { pending: 'Pending', succeeded: 'Paid', failed: 'Failed', refunded: 'Refunded', partially_refunded: 'Part refunded' },
  paymentMethod: { card: 'Card', cash: 'Cash', check: 'Check', transfer: 'Bank transfer' },
  containerKind: { roll_off: 'Roll-off', lugger: 'Lugger box', hopper: 'Hopper', gaylord: 'Gaylord', drum: 'Drum', trailer: 'Trailer' },
};

export function label(kind: keyof typeof LABELS | string, value: string | null | undefined) {
  if (!value) return '—';
  const found = LABELS[kind]?.[value];
  if (found) return found;
  // Unknown value: words, never an underscore.
  return value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function list(values: string[]) {
  if (values.length <= 1) return values.join('');
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}

export function methodsText(methods: string[] | null | undefined) {
  const v = (methods || []).map((m) => label('payoutMethod', m).toLowerCase());
  return v.length ? list(v) : 'the methods the yard offers';
}

/** "Payment for this item is held until Tue 24 Nov, as this yard's rules require." */
export function holdSentence(releaseAt: string | null | undefined, tz: string | null | undefined, what = 'this item') {
  if (!releaseAt) return `Payment for ${what} is on hold.`;
  return `Payment for ${what} is held until ${shortDate(releaseAt, tz)}, as this yard’s rules require.`;
}

// ---- Yard hours ----
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_NAME: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
export function dayName(d: string) {
  return DAY_NAME[d] || d;
}

export type DayHours = { open?: string | null; close?: string | null; closed?: boolean } | null | undefined;

export function clock(hhmm: string | null | undefined) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function hoursText(day: DayHours) {
  if (!day || day.closed || !day.open || !day.close) return 'Closed';
  return `${clock(day.open)} – ${clock(day.close)}`;
}

function zonedParts(tz: string | null | undefined, at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: safeZone(tz), weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return { day: get('weekday').slice(0, 3).toLowerCase(), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export type ClosureLite = { date: string; reason?: string | null; isPartial?: boolean | null; openTime?: string | null; closeTime?: string | null };

/** Today's hours in the yard's zone, taking a closure for today into account. */
export function todayStatus(hours: Record<string, DayHours> | null | undefined, tz: string | null | undefined, closures: ClosureLite[] = []) {
  const { day, minutes } = zonedParts(tz);
  const today = todayIn(tz);
  const closure = closures.find((c) => todayIn(tz, 0) === new Intl.DateTimeFormat('en-CA', { timeZone: safeZone(tz), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(c.date)));
  let h: DayHours = hours?.[day];
  if (closure) h = closure.isPartial && closure.openTime && closure.closeTime ? { open: closure.openTime, close: closure.closeTime } : { closed: true };
  const toMin = (s?: string | null) => (s && /^\d{1,2}:\d{2}$/.test(s) ? Number(s.split(':')[0]) * 60 + Number(s.split(':')[1]) : null);
  const o = toMin(h?.open);
  const c = toMin(h?.close);
  const open = !h?.closed && o !== null && c !== null && minutes >= o && minutes < c;
  let nextOpen: string | null = null;
  if (!open) {
    if (!h?.closed && o !== null && minutes < o) nextOpen = `Opens today at ${clock(h?.open)}`;
    else {
      const closedDates = new Set(closures.filter((x) => !x.isPartial).map((x) => new Intl.DateTimeFormat('en-CA', { timeZone: safeZone(tz), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(x.date))));
      for (let i = 1; i <= 7 && !nextOpen; i++) {
        const at = new Date(Date.now() + i * 86400000);
        const d = zonedParts(tz, at).day;
        const dh = hours?.[d];
        if (dh && !dh.closed && dh.open && dh.close && !closedDates.has(todayIn(tz, i))) nextOpen = `Opens ${i === 1 ? 'tomorrow' : dayName(d).slice(0, 3)} ${clock(dh.open)}`;
      }
    }
  }
  return { day, today, open, nextOpen, text: hoursText(h), closureReason: closure?.reason || null, hasHours: Boolean(hours && Object.keys(hours).length) };
}

/** Group weekdays with the same hours: "Mon – Fri: 7:00 AM – 4:30 PM". */
export function groupedHours(hours: Record<string, DayHours> | null | undefined) {
  const out: Array<{ days: string; text: string }> = [];
  let start = 0;
  for (let i = 1; i <= WEEKDAYS.length; i++) {
    const prev = hoursText(hours?.[WEEKDAYS[i - 1]]);
    const cur = i < WEEKDAYS.length ? hoursText(hours?.[WEEKDAYS[i]]) : null;
    if (cur !== prev) {
      const a = WEEKDAYS[start];
      const b = WEEKDAYS[i - 1];
      const short = (d: string) => dayName(d).slice(0, 3);
      out.push({ days: a === b ? short(a) : `${short(a)} – ${short(b)}`, text: prev });
      start = i;
    }
  }
  return out;
}

export function address(y: { addressLine1?: string | null; addressLine2?: string | null; city?: string | null; region?: string | null; postalCode?: string | null }) {
  const line1 = [y.addressLine1, y.addressLine2].filter(Boolean).join(', ');
  const line2 = [y.city, [y.region, y.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return { line1, line2, oneLine: [line1, line2].filter(Boolean).join(', ') };
}

export function telHref(phone: string | null | undefined) {
  return phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : undefined;
}

export function mapsHref(oneLine: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(oneLine)}`;
}
