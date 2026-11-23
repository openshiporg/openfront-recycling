import test from 'node:test';
import assert from 'node:assert/strict';
import { clearMoneyIntents, moneyIntentRunner } from './moneyIntent';

class MemoryStorage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] || null; }
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
test('double click dispatches only once', async () => {
  const store = new MemoryStorage();
  const run = moneyIntentRunner(store, 'u1', 'count:drawer1', () => 'key1');
  let finish!: (r: { ok: boolean }) => void;
  let calls = 0;
  const send = () => { calls++; return new Promise<{ ok: boolean }>(resolve => { finish = resolve; }); };
  const first = run({ countedCents: 31000 }, send);
  await assert.rejects(run({ countedCents: 31000 }, send), /already being submitted/);
  assert.equal(calls, 1);
  finish({ ok: true }); await first;
});
test('lost response and remount retry preserve key AND payload; changed payload refused', async () => {
  const store = new MemoryStorage();
  const payload = { amountCents: 1000, kind: 'drop', sessionId: 's1' };
  const seen: unknown[] = [];
  const run = moneyIntentRunner(store, 'u1', 'move:s1', () => 'original');
  await assert.rejects(run(payload, async p => { seen.push(p); throw new Error('transport lost'); }));
  const remounted = moneyIntentRunner(store, 'u1', 'move:s1', () => 'must-not-be-used');
  await assert.rejects(remounted({ ...payload, amountCents: 2000 }, async () => { throw new Error('must not dispatch'); }), /unresolved/);
  await remounted(payload, async p => { seen.push(p); return { ok: true }; });
  assert.deepEqual(seen[0], seen[1]);
  assert.equal(store.length, 1); // owner marker only
  await remounted({ ...payload, amountCents: 2000 }, async p => {
    assert.equal(p.idempotencyKey, 'must-not-be-used'); return { ok: true };
  });
});
test('explicit failure conservatively retains intent; storage failure prevents dispatch', async () => {
  const store = new MemoryStorage();
  const run = moneyIntentRunner(store, 'u1', 'return:p1', () => 'key');
  await run({ reason: 'returned' }, async () => ({ ok: false }));
  await assert.rejects(run({ reason: 'changed' }, async () => ({ ok: true })), /unresolved/);
  store.setItem = () => { throw new Error('storage unavailable'); };
  let called = false;
  await assert.rejects(moneyIntentRunner(store, 'u1', 'new', () => 'key')({}, async () => { called = true; return { ok: true }; }));
  assert.equal(called, false);
});
test('user switch and sign-out clear previous user intent', async () => {
  const store = new MemoryStorage();
  await moneyIntentRunner(store, 'u1', 'count:s1', () => 'old')({}, async () => ({ ok: false }));
  await moneyIntentRunner(store, 'u2', 'count:s1', () => 'new')({}, async p => {
    assert.equal(p.idempotencyKey, 'new'); return { ok: false };
  });
  assert.equal([...store.data.keys()].some(k => k.includes(':u1:')), false);
  clearMoneyIntents(store); assert.equal(store.length, 0);
});
