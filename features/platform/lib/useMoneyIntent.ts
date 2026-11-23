'use client';

import { useRef } from 'react';
import { useChatMode } from '@/features/dashboard/components/DashboardLayout';
import { moneyIntentRunner } from './moneyIntent';

/** Only pass command fields, never identity documents, account numbers or auth tokens. */
export function useMoneyIntent(scope: string) {
  const { user } = useChatMode();
  const ref = useRef<{ identity: string; run: ReturnType<typeof moneyIntentRunner> } | null>(null);
  return async <P extends object, R extends { ok: boolean }>(payload: P, send: (p: P & { idempotencyKey: string }) => Promise<R>) => {
    const identity = `${user?.id || ''}:${scope}`;
    if (!ref.current || ref.current.identity !== identity) {
      ref.current = { identity, run: moneyIntentRunner(sessionStorage, user?.id || '', scope, () => `${scope}:${crypto.randomUUID()}`) };
    }
    return ref.current.run(payload, send);
  };
}
