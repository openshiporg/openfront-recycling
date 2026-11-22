'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { useLiveRefresh } from './useLiveRefresh';
import { Pill, selectClass } from './ui';
import type { YardChoice } from './staff';

/** Yard switcher (only for staff at more than one yard) and live refresh while the tab is visible. */
export function YardSwitcher({ yards, yardId, intervalMs = 20_000 }: { yards: YardChoice[]; yardId: string; intervalMs?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { refresh, refreshing } = useLiveRefresh({ paused: false, intervalMs });
  const go = (id: string) => {
    const next = new URLSearchParams(params?.toString() || "");
    next.set('yard', id);
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  };
  return (
    <div className="flex items-center gap-2">
      {yards.length > 1 ? (
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Yard</span>
          <select className={selectClass + ' w-56'} value={yardId} onChange={(e) => go(e.target.value)}>
            {yards.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </label>
      ) : null}
      <Pill onClick={refresh} disabled={refreshing} aria-label="Refresh"><RefreshCw className={refreshing ? 'animate-spin' : ''} />Refresh</Pill>
    </div>
  );
}
