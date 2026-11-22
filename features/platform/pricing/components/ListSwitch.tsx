'use client';

import { Notice, Pill } from '@/features/platform/lib/ui';
import { useCommand } from '@/features/platform/lib/useCommand';
import { setPriceListActiveAction } from '../actions';

export function ListSwitch({ priceListId, isActive }: { priceListId: string; isActive: boolean }) {
  const cmd = useCommand();
  return (
    <div className="flex flex-col items-end gap-2">
      <Pill variant={isActive ? 'flat' : 'primary'} disabled={cmd.pending} onClick={() => cmd.run(() => setPriceListActiveAction({ priceListId, isActive: !isActive }))}>{isActive ? 'Switch list off' : 'Switch list on'}</Pill>
      {cmd.error ? <Notice tone="alert">{cmd.error}</Notice> : null}
    </div>
  );
}
