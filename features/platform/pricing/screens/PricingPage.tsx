import Link from 'next/link';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { Empty, Notice, PageHeader, Restricted, StatusDot, StatusTabs, Tag } from '@/features/platform/lib/ui';
import { getStaffContext } from '@/features/platform/lib/staff';
import { dateTimeIn } from '@/features/platform/lib/format';
import { getPriceLists } from '../actions';
import { NewPriceList } from '../components/NewPriceList';
import { KIND_LABEL } from '../types';

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/dashboard/platform/pricing';

export async function PricingPage({ searchParams }: Props) {
  const params = (await searchParams) || {};
  const breadcrumbs = [{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'page' as const, label: 'Pricing' }];
  const shell = (body: React.ReactNode) => <PageContainer title="Pricing" breadcrumbs={breadcrumbs}><div className="flex flex-col gap-6 p-4 md:p-6">{body}</div></PageContainer>;
  const ctx = await getStaffContext();
  if (!ctx.ok) return shell(<Notice tone="alert">{ctx.error}</Notice>);
  if (!ctx.role.canManagePricing && !ctx.role.canManageTickets && !ctx.role.canManageMaterials) return shell(<Restricted>Your role doesn’t include pricing.</Restricted>);
  const kind = typeof params.kind === 'string' ? params.kind : '';
  const r = await getPriceLists(kind);
  if (!r.ok) return shell(<Notice tone="alert">{r.error}</Notice>);
  const canEdit = Boolean(ctx.role.canManagePricing);

  return shell(
    <>
      <PageHeader title="Pricing" tone="live" meta={<>Buy prices per yard board, customer tier and contract. Publishing adds a new dated price; tickets keep the price they were weighed at.</>} actions={canEdit ? <NewPriceList yards={ctx.yards} /> : null} />
      <StatusTabs label="Kind of list" current={kind} hrefFor={(v) => (v ? `${BASE}?kind=${v}` : BASE)} tabs={[
        { value: '', label: 'All', count: r.total },
        ...(['board', 'tier', 'contract', 'sell'] as const).map((k) => ({ value: k, label: KIND_LABEL[k], count: r.counts[k] || 0 })),
      ]} />
      {r.lists.length ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {r.lists.map((l) => (
            <li key={l.id}>
              <Link href={`${BASE}/${l.id}`} className="flex h-full flex-col gap-2 rounded-[6px] border p-4 text-sm hover:bg-muted/50">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium"><StatusDot tone={l.isActive ? 'live' : 'off'} />{l.name}</span>
                  <Tag>{KIND_LABEL[l.kind] || l.kind}</Tag>
                </div>
                <p className="text-xs text-muted-foreground">{l.yard ? l.yard.name : 'All yards'}{l.accountsCount ? ` · ${l.accountsCount} account${l.accountsCount === 1 ? '' : 's'}` : ''} · {l.entriesCount} price{l.entriesCount === 1 ? '' : 's'} published{l.isActive ? '' : ' · switched off'}</p>
                <p className="mt-auto text-xs text-muted-foreground">Updated {dateTimeIn(l.updatedAt, null)}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : <Empty>{kind ? 'No lists of this kind yet.' : 'No price lists yet. Onboarding creates one board per yard.'}</Empty>}
    </>,
  );
}
