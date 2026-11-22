'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { selectClass } from '@/features/platform/lib/ui';
import type { Category } from '../types';

export function CatalogFilters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params?.get('q') || '');
  const push = (patch: Record<string, string>) => {
    const s = new URLSearchParams(params?.toString() || '');
    Object.entries(patch).forEach(([k, v]) => (v ? s.set(k, v) : s.delete(k)));
    s.delete('page');
    router.replace(`${pathname}${s.toString() ? `?${s}` : ''}`);
  };
  useEffect(() => {
    const t = setTimeout(() => { if ((params?.get('q') || '') !== q) push({ q }); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Search materials" className="w-72 pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, code or grade spec" />
      </div>
      <select aria-label="Category" className={selectClass + ' w-56'} value={params?.get('category') || ''} onChange={(e) => push({ category: e.target.value })}>
        <option value="">All categories</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.materialsCount})</option>)}
      </select>
    </div>
  );
}
