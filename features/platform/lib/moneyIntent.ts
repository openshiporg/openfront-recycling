export class MoneyIntentError extends Error {}
export const MONEY_PREFIX = 'recycling:money:';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
export function clearMoneyIntents(storage: StorageLike) {
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i);
    if (key?.startsWith(MONEY_PREFIX)) storage.removeItem(key);
  }
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
/** Persist before dispatch; only a confirmed success retires the intent. No automatic retries. */
export function moneyIntentRunner(storage: StorageLike, userId: string, scope: string, newKey: () => string) {
  let busy = false;
  return async function run<P extends object, R extends { ok: boolean }>(payload: P, send: (p: P & { idempotencyKey: string }) => Promise<R>): Promise<R> {
    if (!userId) throw new MoneyIntentError('Sign in again before making a money command.');
    if (busy) throw new MoneyIntentError('This money command is already being submitted.');
    const ownerKey = `${MONEY_PREFIX}owner`;
    if (storage.getItem(ownerKey) !== userId) {
      clearMoneyIntents(storage);
      storage.setItem(ownerKey, userId);
    }
    const slot = `${MONEY_PREFIX}${userId}:${scope}`;
    const existing = storage.getItem(slot);
    const intent = existing ? JSON.parse(existing) : { payload, key: newKey() };
    if (canonical(intent.payload) !== canonical(payload)) throw new MoneyIntentError('An earlier submission is unresolved. Restore its original fields and retry; do not submit different values.');
    if (!existing) storage.setItem(slot, JSON.stringify(intent)); // storage failure must prevent dispatch
    busy = true;
    try {
      const result = await send({ ...intent.payload, idempotencyKey: intent.key });
      if (result.ok) storage.removeItem(slot);
      return result;
    } finally { busy = false; }
  };
}
