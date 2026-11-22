'use server';

import { revalidatePath } from 'next/cache';
import { platformRequest, trimmed } from '@/features/platform/lib/platformRequest';
import type { ActionResult, CollectRow, DrawerState, QueuePayout, RegisterRow } from '../types';

const PATH = '/dashboard/platform/cashier';
const key = (v: unknown) => trimmed(v, 200) || undefined;
const cents = (v: unknown) => (Number.isSafeInteger(v) && Number(v) >= 0 ? Number(v) : null);

function done<T>(r: { ok: true; data: T } | { ok: false; error: string }): ActionResult<T> {
  if (!r.ok) return r;
  revalidatePath(PATH);
  revalidatePath('/dashboard/platform/scale-house');
  return { ok: true, data: r.data };
}

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

export async function getDrawerState(yardId: string) {
  const r = await platformRequest<{ drawerState: DrawerState }>(`
    query CashierDrawers($yardId: ID!) {
      drawerState(yardId: $yardId) {
        yardId pendingApproval
        drawers {
          drawerId name
          session { id status cashierId cashierName isMine openingFloatCents expectedCents countedCents varianceCents openedAt totals { kind count amountCents } events { id kind amountCents note payoutId ticketId createdAt } }
          lastClosed { id closedAt cashierName countedCents varianceCents approvedByName }
        }
      }
    }`, { yardId });
  return r.ok ? { ok: true as const, state: r.data.drawerState } : { ok: false as const, error: r.error };
}

export async function getPayoutQueue(yardId: string) {
  const r = await platformRequest<{ payoutQueue: QueuePayout[] }>(`
    query CashierQueue($yardId: ID!) {
      payoutQueue(yardId: $yardId, includeReturned: true) {
        id amountCents status allowedMethods releaseAt returnReason createdAt mailToAddress
        ticket { id displayNumber completedAt }
        seller { id firstName lastName preferredPayout }
        account { id name }
        replaces { id checkNumber transferReference }
      }
    }`, { yardId });
  return r.ok ? { ok: true as const, payouts: r.data.payoutQueue || [] } : { ok: false as const, error: r.error };
}

const REGISTER_PAGE = 50;

/** Check and transfer register for the yard: every payout paid by check or transfer, newest first. */
export async function getRegister(yardId: string, method: 'check' | 'transfer', page: number) {
  const where = { method: { equals: method }, status: { in: ['paid', 'returned'] }, ticket: { yard: { id: { equals: yardId } } } };
  const r = await platformRequest<{ payouts: RegisterRow[]; payoutsCount: number }>(`
    query CashierRegister($where: PayoutWhereInput!, $take: Int!, $skip: Int!) {
      payouts(where: $where, orderBy: [{ paidAt: desc }], take: $take, skip: $skip) {
        id amountCents status method checkNumber bankAccountLabel transferReference paidAt returnReason paidBy { name }
        ticket { id displayNumber } seller { firstName lastName } account { name }
      }
      payoutsCount(where: $where)
    }`, { where, take: REGISTER_PAGE, skip: (page - 1) * REGISTER_PAGE });
  return r.ok ? { ok: true as const, rows: r.data.payouts, count: r.data.payoutsCount, pages: Math.max(1, Math.ceil(r.data.payoutsCount / REGISTER_PAGE)) } : { ok: false as const, error: r.error };
}

/** Fee tickets waiting for the customer to pay (needs a role that can read invoices). */
export async function getCollectList(yardId: string) {
  const r = await platformRequest<{ invoices: CollectRow[] }>(`
    query CashierCollect($yardId: ID!) {
      invoices(where: { kind: { equals: "fee_ticket" }, status: { in: ["open", "partially_paid"] }, ticket: { yard: { id: { equals: $yardId } } } }, orderBy: [{ createdAt: asc }], take: 100) {
        id number status totalCents paidCents dueOn createdAt ticket { id displayNumber } seller { firstName lastName } account { name }
      }
    }`, { yardId });
  return r.ok ? { ok: true as const, rows: r.data.invoices } : { ok: false as const, error: r.error };
}

// ---------------------------------------------------------------------------------------------
// Drawer commands
// ---------------------------------------------------------------------------------------------

const SESSION = 'id status expectedCents countedCents varianceCents';

export async function openDrawerAction(input: { drawerId: string; openingFloatCents: number; idempotencyKey: string }) {
  const float = cents(input.openingFloatCents);
  if (float === null) return { ok: false as const, error: 'Count the opening float.' };
  return done(await platformRequest(`mutation OpenDrawer($drawerId: ID!, $float: Int!, $key: String) { openDrawerSession(drawerId: $drawerId, openingFloatCents: $float, idempotencyKey: $key) { ${SESSION} } }`,
    { drawerId: input.drawerId, float, key: key(input.idempotencyKey) }));
}

export async function moveCashAction(input: { sessionId: string; kind: 'add' | 'drop'; amountCents: number; note?: string; idempotencyKey: string }) {
  const amount = cents(input.amountCents);
  if (!amount) return { ok: false as const, error: 'Enter the amount.' };
  if (input.kind !== 'add' && input.kind !== 'drop') return { ok: false as const, error: 'Choose add or drop.' };
  return done(await platformRequest(`mutation MoveCash($id: ID!, $kind: String!, $amount: Int!, $note: String, $key: String!) { moveDrawerCash(sessionId: $id, kind: $kind, amountCents: $amount, note: $note, idempotencyKey: $key) { ${SESSION} } }`,
    { id: input.sessionId, kind: input.kind, amount, note: trimmed(input.note, 300) || undefined, key: String(key(input.idempotencyKey)) }));
}

export async function countDrawerAction(input: { sessionId: string; countedCents: number; idempotencyKey: string }) {
  const counted = cents(input.countedCents);
  if (counted === null) return { ok: false as const, error: 'Enter the counted cash.' };
  return done(await platformRequest<{ countDrawer: { status: string; varianceCents: number | null } }>(`mutation CountDrawer($id: ID!, $counted: Int!, $key: String) { countDrawer(sessionId: $id, countedCents: $counted, idempotencyKey: $key) { ${SESSION} } }`,
    { id: input.sessionId, counted, key: key(input.idempotencyKey) }));
}

export async function recountDrawerAction(input: { sessionId: string }) {
  return done(await platformRequest(`mutation RecountDrawer($id: ID!) { recountDrawer(sessionId: $id) { ${SESSION} } }`, { id: input.sessionId }));
}

export async function approveCloseAction(input: { sessionId: string; note: string; idempotencyKey: string }) {
  const note = trimmed(input.note, 500);
  if (note.length < 3) return { ok: false as const, error: 'Write a note explaining the variance.' };
  return done(await platformRequest(`mutation ApproveClose($id: ID!, $note: String!, $key: String) { approveDrawerClose(sessionId: $id, note: $note, idempotencyKey: $key) { ${SESSION} } }`,
    { id: input.sessionId, note, key: key(input.idempotencyKey) }));
}

// ---------------------------------------------------------------------------------------------
// Payout commands
// ---------------------------------------------------------------------------------------------

export async function payPayoutAction(input: { payoutId: string; method: string; drawerSessionId?: string; checkNumber?: string; bankAccountLabel?: string; transferReference?: string; idempotencyKey: string }) {
  if (!['cash', 'check', 'transfer'].includes(input.method)) return { ok: false as const, error: 'Choose cash, check or transfer.' };
  if (input.method === 'cash' && !input.drawerSessionId) return { ok: false as const, error: 'Open your drawer to pay cash.' };
  if (input.method === 'check' && !trimmed(input.checkNumber)) return { ok: false as const, error: 'Enter the check number.' };
  if (input.method === 'transfer' && !trimmed(input.transferReference)) return { ok: false as const, error: 'Enter the bank transfer reference.' };
  return done(await platformRequest<{ payPayout: { id: string; status: string; method: string } }>(`
    mutation PayPayout($id: ID!, $method: String!, $drawer: ID, $check: String, $bank: String, $ref: String, $key: String) {
      payPayout(payoutId: $id, method: $method, drawerSessionId: $drawer, checkNumber: $check, bankAccountLabel: $bank, transferReference: $ref, idempotencyKey: $key) { id status method checkNumber paidAt }
    }`, {
    id: input.payoutId, method: input.method,
    drawer: input.method === 'cash' ? input.drawerSessionId : undefined,
    check: input.method === 'check' ? trimmed(input.checkNumber, 40) : undefined,
    bank: input.method === 'check' ? trimmed(input.bankAccountLabel, 80) || undefined : undefined,
    ref: input.method === 'transfer' ? trimmed(input.transferReference, 120) : undefined,
    key: key(input.idempotencyKey),
  }));
}

export async function returnPayoutAction(input: { payoutId: string; reason: string; idempotencyKey: string }) {
  const reason = trimmed(input.reason, 500);
  if (reason.length < 3) return { ok: false as const, error: 'Give the reason the payment came back.' };
  return done(await platformRequest(`mutation ReturnPayout($id: ID!, $reason: String!, $key: String) { returnPayout(payoutId: $id, reason: $reason, idempotencyKey: $key) { id status } }`, { id: input.payoutId, reason, key: key(input.idempotencyKey) }));
}

export async function cancelPayoutAction(input: { payoutId: string; reason: string; idempotencyKey: string }) {
  const reason = trimmed(input.reason, 500);
  if (reason.length < 3) return { ok: false as const, error: 'Give a reason.' };
  return done(await platformRequest(`mutation CancelPayout($id: ID!, $reason: String!, $key: String) { cancelPayout(payoutId: $id, reason: $reason, idempotencyKey: $key) { id status } }`, { id: input.payoutId, reason, key: key(input.idempotencyKey) }));
}

export async function collectAction(input: { invoiceId: string; method: string; amountCents: number; reference?: string; drawerSessionId?: string; idempotencyKey: string }) {
  const amount = cents(input.amountCents);
  if (!amount) return { ok: false as const, error: 'Enter the amount received.' };
  if (!['cash', 'check', 'ach', 'wire'].includes(input.method)) return { ok: false as const, error: 'Choose cash, check, ACH or wire.' };
  if (input.method === 'cash' && !input.drawerSessionId) return { ok: false as const, error: 'Open your drawer to take cash.' };
  if (input.method !== 'cash' && !trimmed(input.reference)) return { ok: false as const, error: 'Enter the check number or payment reference.' };
  return done(await platformRequest(`
    mutation Collect($id: ID!, $method: String!, $amount: Int!, $ref: String, $drawer: ID, $key: String!) {
      recordInvoicePayment(invoiceId: $id, method: $method, amountCents: $amount, reference: $ref, drawerSessionId: $drawer, idempotencyKey: $key) { id status amountCents }
    }`, { id: input.invoiceId, method: input.method, amount, ref: trimmed(input.reference, 120) || undefined, drawer: input.method === 'cash' ? input.drawerSessionId : undefined, key: String(key(input.idempotencyKey)) }));
}
