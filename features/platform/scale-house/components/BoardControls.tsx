'use client';

import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { useLiveRefresh } from '@/features/platform/lib/useLiveRefresh';
import { Pill, selectClass } from '@/features/platform/lib/ui';
import type { YardChoice } from '../types';

/** Yard switcher and live refresh for the board (polls every 20 s while the tab is visible). */
export function BoardControls({ yards, yardId }: { yards: YardChoice[]; yardId: string }) {
  const router = useRouter();
  const { refresh, refreshing } = useLiveRefresh({ paused: false, intervalMs: 20_000 });
  return (
    <div className="flex items-center gap-2">
      {yards.length > 1 ? (
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Yard</span>
          <select className={selectClass + ' w-56'} value={yardId} onChange={(e) => router.push(`/dashboard/platform/scale-house?yard=${encodeURIComponent(e.target.value)}`)}>
            {yards.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </label>
      ) : null}
      <Pill onClick={refresh} disabled={refreshing} aria-label="Refresh board"><RefreshCw className={refreshing ? 'animate-spin' : ''} />Refresh</Pill>
    </div>
  );
}
