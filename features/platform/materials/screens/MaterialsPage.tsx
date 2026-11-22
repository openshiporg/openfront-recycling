import Link from 'next/link';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { DataTable, Empty, Notice, PageHeader, Pager, Restricted, StatusCell, StatusTabs, Td } from '@/features/platform/lib/ui';
import { getStaffContext } from '@/features/platform/lib/staff';
import { getCatalog } from '../actions';
import { CatalogFilters } from '../components/CatalogFilters';
import { CategoryManager } from '../components/CategoryManager';
import { MaterialEditor } from '../components/MaterialEditor';
import { UNIT_LABEL } from '../types';

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/dashboard/platform/materials';
const PER_PAGE = 50;
const STATUSES = ['active', 'hidden', 'fees', 'inactive', 'all'];

export async function MaterialsPage({ searchParams }: Props) {
  const p = (await searchParams) || {};
  const breadcrumbs = [{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'page' as const, label: 'Materials' }];
  const shell = (body: React.ReactNode) => <PageContainer title="Materials" breadcrumbs={breadcrumbs}><div className="flex flex-col gap-6 p-4 md:p-6">{body}</div></PageContainer>;
  const ctx = await getStaffContext();
  if (!ctx.ok) return shell(<Notice tone="alert">{ctx.error}</Notice>);
  if (!ctx.role.canManageMaterials && !ctx.role.canManagePricing && !ctx.role.canManageCompliance) return shell(<Restricted>Your role doesn’t include the material catalogue.</Restricted>);
  const status = STATUSES.includes(String(p.status)) ? String(p.status) : 'active';
  const categoryId = typeof p.category === 'string' ? p.category : '';
  const q = typeof p.q === 'string' ? p.q : '';
  const page = Math.max(1, Number.parseInt(String(p.page || '1'), 10) || 1);
  const r = await getCatalog({ status: status === 'all' ? '' : status, categoryId, q, page, perPage: PER_PAGE });
  if (!r.ok) return shell(<Notice tone="alert">{r.error}</Notice>);
  const canEdit = Boolean(ctx.role.canManageMaterials);
  const pages = Math.max(1, Math.ceil(r.materialsCount / PER_PAGE));
  const href = (patch: Record<string, string>) => {
    const s = new URLSearchParams({ ...(status !== 'active' ? { status } : {}), ...(categoryId ? { category: categoryId } : {}), ...(q ? { q } : {}), ...patch });
    [...s.entries()].forEach(([k, v]) => { if (!v) s.delete(k); });
    return `${BASE}${s.toString() ? `?${s}` : ''}`;
  };

  return shell(
    <>
      <PageHeader title="Materials" tone="live" meta={<>{r.active} active · {r.categories.length} categories · what the yard buys, and the fees it charges</>} actions={canEdit ? <div className="flex gap-2"><CategoryManager categories={r.categories} /><MaterialEditor categories={r.categories} /></div> : null} />
      <CatalogFilters categories={r.categories} />
      <StatusTabs label="Material status" current={status} hrefFor={(v) => href({ status: v === 'active' ? '' : v, page: '' })} tabs={[
        { value: 'active', label: 'Active', count: r.active, tone: 'live' },
        { value: 'hidden', label: 'Hidden from public', count: r.hidden, tone: 'wait' },
        { value: 'fees', label: 'Fees', count: r.fees },
        { value: 'inactive', label: 'Switched off', count: r.inactive, tone: 'off' },
        { value: 'all', label: 'All', count: r.all },
      ]} />
      {r.materials.length ? (
        <>
          <DataTable label="Materials" head={[{ label: '' }, { label: 'Material' }, { label: 'Code' }, { label: 'Category' }, { label: 'Unit' }, { label: 'Kind' }, { label: 'Public board' }, { label: 'Status' }]}>
            {r.materials.map((m) => (
              <tr key={m.id} className="hover:bg-muted/40">
                <Td className="w-12">{m.image ? <img src={m.image.url} alt="" className="size-9 rounded-[4px] object-cover" /> : <div className="size-9 rounded-[4px] bg-muted" />}</Td>
                <Td><Link href={`${BASE}/${m.id}`} className="font-medium underline-offset-4 hover:underline">{m.name}</Link>{m.specName ? <div className="text-xs text-muted-foreground">{m.specName}</div> : null}</Td>
                <Td className="font-mono text-xs">{m.code}</Td>
                <Td>{m.category?.name || '—'}</Td>
                <Td>{UNIT_LABEL[m.defaultUnit] || m.defaultUnit}</Td>
                <Td>{m.direction === 'charge_customer' ? 'Fee (customer pays)' : 'Yard pays'}</Td>
                <Td>{m.isPublic ? (m.acceptsFromPublic ? 'Shown' : 'Shown, commercial only') : 'Hidden'}</Td>
                <Td><StatusCell tone={m.isActive ? 'live' : 'off'}>{m.isActive ? 'Active' : 'Switched off'}</StatusCell></Td>
              </tr>
            ))}
          </DataTable>
          <Pager page={page} pages={pages} label="Material pages" prev={page > 1 ? href({ page: String(page - 1) }) : null} next={page < pages ? href({ page: String(page + 1) }) : null} />
        </>
      ) : <Empty>{q || categoryId ? 'No materials match.' : 'No materials here yet.'}</Empty>}
    </>,
  );
}
