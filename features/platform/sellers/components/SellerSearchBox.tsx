'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function SellerSearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params?.get('q') || '');
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params?.get('q') || '') === q.trim()) return;
      const s = new URLSearchParams(params?.toString() || '');
      if (q.trim()) s.set('q', q.trim()); else s.delete('q');
      s.delete('page');
      router.replace(`${pathname}${s.toString() ? `?${s}` : ''}`);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  return (
    <div className="relative max-w-xl">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input aria-label="Search sellers" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, ID number, phone or plate" autoFocus />
    </div>
  );
}
