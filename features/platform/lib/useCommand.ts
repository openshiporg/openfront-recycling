'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { flushSync } from 'react-dom';
import { MoneyIntentError } from './moneyIntent';

/** Show a confirmed command result before refreshing server-rendered data in the background. */
export function useCommand() {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<{ ok: true; data?: T } | { ok: false; error: string }>, after?: (data: T | undefined) => void) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const r = await fn();
      if (!r.ok) { setError(r.error || 'This couldn’t be done.'); return; }
      // Commit the confirmed result outside the refresh transition. Otherwise React
      // can batch it with the slower server-rendered secondary panels.
      flushSync(() => { after?.(r.data); setPending(false); });
      // Yield a frame before starting the RSC request so the confirmed result paints.
      requestAnimationFrame(() => {
        setTimeout(() => startRefresh(() => router.refresh()), 0);
      });
    } catch (error) {
      // A disconnected request may already have committed: don't retry automatically.
      setError(error instanceof MoneyIntentError ? error.message : 'The result could not be confirmed. Refresh before trying again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return { pending, error, run, setError };
}

export const newKey = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;
