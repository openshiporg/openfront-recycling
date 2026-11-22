'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/** Runs one server action at a time, keeps its refusal message, refreshes the page on success. */
export function useCommand() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = <T,>(fn: () => Promise<{ ok: true; data?: T } | { ok: false; error: string }>, after?: (data: T | undefined) => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) { setError(r.error || 'This couldn’t be done.'); return; }
      after?.(r.data);
      router.refresh();
    });
  };
  return { pending, error, run, setError };
}

export const newKey = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;
