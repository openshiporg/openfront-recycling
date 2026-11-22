import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { Notice, PageHeader, Restricted, Tag } from '@/features/platform/lib/ui';
import { getStaffContext } from '@/features/platform/lib/staff';
import { dateTimeIn } from '@/features/platform/lib/format';
import { getGrid } from '../actions';
import { PriceGrid } from '../components/PriceGrid';
import { ListSwitch } from '../components/ListSwitch';
import { KIND_LABEL } from '../types';

type Props = { params: Promise<{ priceListId: string }> };

export async function PriceListPage({ params }: Props) {
  const { priceListId } = await params;
  const ctx = await getStaffContext();
  const r = await getGrid(priceListId);
  const name = r.ok ? r.grid.name : 'Price list';
  const breadcrumbs = [{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'link' as const, label: 'Pricing', href: '/dashboard/platform/pricing' }, { type: 'page' as const, label: name }];
  const shell = (body: React.ReactNode) => <PageContainer title={name} breadcrumbs={breadcrumbs}><div className="flex flex-col gap-6 p-4 md:p-6">{body}</div></PageContainer>;
  if (!ctx.ok) return shell(<Notice tone="alert">{ctx.error}</Notice>);
  if (!r.ok) return shell(<Notice tone="alert">{r.error}</Notice>);
  const canEdit = Boolean(ctx.role.canManagePricing);
  const tz = ctx.yards.find((y) => y.id === r.grid.yardId)?.timezone || ctx.yards[0]?.timezone || null;
  const priced = r.grid.rows.filter((x) => x.unitPrice !== null).length;

  return shell(
    <>
      <PageHeader
        title={r.grid.name}
        tone={r.isActive ? 'live' : 'off'}
        meta={<><Tag>{KIND_LABEL[r.grid.kind] || r.grid.kind}</Tag> {r.grid.yardName || 'All yards'} · {priced} of {r.grid.rows.length} materials priced · last published {r.grid.lastPublishedAt ? dateTimeIn(r.grid.lastPublishedAt, tz) : 'never'}{r.accounts.length ? ` · used by ${r.accounts.map((a) => a.name).join(', ')}` : ''}</>}
        actions={canEdit ? <ListSwitch priceListId={priceListId} isActive={r.isActive} /> : null}
      />
      {!r.isActive ? <Notice>This list is switched off. Tickets don’t use it until it is switched on.</Notice> : null}
      {!canEdit ? <Restricted>You can see prices. Publishing needs the pricing permission.</Restricted> : null}
      <PriceGrid grid={r.grid} canEdit={canEdit && r.isActive} timeZone={tz} />
    </>,
  );
}
