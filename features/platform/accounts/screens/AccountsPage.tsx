import Link from 'next/link';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { DataTable, Empty, Notice, PageHeader, Pager, Restricted, StatusCell, StatusTabs, Tag, Td, pillClass } from '@/features/platform/lib/ui';
import { getStaffContext } from '@/features/platform/lib/staff';
import { listAccounts } from '../actions';
import { ListSearch } from '../components/ListSearch';
import { TERMS } from '../types';

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/dashboard/platform/accounts';
const PER_PAGE = 50;
const TABS = ['all', 'suppliers', 'buyers', 'nonprofits', 'suspended'];

export async function AccountsPage({ searchParams }: Props) {
  const p = (await searchParams) || {};
  const breadcrumbs = [{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'page' as const, label: 'Accounts' }];
  const shell = (body: React.ReactNode) => <PageContainer title="Accounts" breadcrumbs={breadcrumbs}><div className="flex flex-col gap-6 p-4 md:p-6">{body}</div></PageContainer>;
  const ctx = await getStaffContext();
  if (!ctx.ok) return shell(<Notice tone="alert">{ctx.error}</Notice>);
  if (!ctx.role.canManageAccounts && !ctx.role.canManageFinance && !ctx.role.canManageSales) return shell(<Restricted>Your role doesn’t include commercial accounts.</Restricted>);
  const tab = TABS.includes(String(p.tab)) ? String(p.tab) : 'all';
  const q = typeof p.q === 'string' ? p.q : '';
  const page = Math.max(1, Number.parseInt(String(p.page || '1'), 10) || 1);
  const r = await listAccounts({ tab, q, page, perPage: PER_PAGE });
  if (!r.ok) return shell(<Notice tone="alert">{r.error}</Notice>);
  const pages = Math.max(1, Math.ceil(r.count / PER_PAGE));
  const href = (patch: Record<string, string>) => {
    const s = new URLSearchParams({ ...(tab !== 'all' ? { tab } : {}), ...(q ? { q } : {}), ...patch });
    [...s.entries()].forEach(([k, v]) => { if (!v) s.delete(k); });
    return `${BASE}${s.toString() ? `?${s}` : ''}`;
  };
  return shell(
    <>
      <PageHeader title="Accounts" tone="live" meta="Contractors, plants, buyers and nonprofits the yard does business with"
        actions={<Link className={pillClass(r.applications ? 'primary' : 'raised')} href={`${BASE}/applications`}>Applications{r.applications ? ` · ${r.applications} waiting` : ''}</Link>} />
      <ListSearch label="Search accounts" placeholder="Name or account number" />
      <StatusTabs label="Account kind" current={tab} hrefFor={(v) => href({ tab: v === 'all' ? '' : v, page: '' })} tabs={[
        { value: 'all', label: 'Active' },
        { value: 'suppliers', label: 'Suppliers', count: r.suppliers },
        { value: 'buyers', label: 'Buyers', count: r.buyers },
        { value: 'nonprofits', label: 'Nonprofits', count: r.nonprofits },
        { value: 'suspended', label: 'Suspended', count: r.suspended, tone: 'alert' },
      ]} />
      {r.accounts.length ? (
        <>
          <DataTable label="Accounts" head={[{ label: 'Account' }, { label: 'Number' }, { label: 'Kind' }, { label: 'Terms' }, { label: 'Price list' }, { label: 'Sites' }, { label: 'City' }, { label: 'Status' }]}>
            {r.accounts.map((a) => (
              <tr key={a.id} className="hover:bg-muted/40">
                <Td><Link className="font-medium underline-offset-4 hover:underline" href={`${BASE}/${a.id}`}>{a.name}</Link></Td>
                <Td className="font-mono text-xs">{a.accountNumber || '—'}</Td>
                <Td>{[a.isSupplier && 'Supplier', a.isBuyer && 'Buyer', a.isNonprofit && 'Nonprofit'].filter(Boolean).map((k) => <Tag key={String(k)}>{k}</Tag>)}</Td>
                <Td>{TERMS[a.paymentTerms] || a.paymentTerms}{a.paymentTerms === 'net' ? ` ${a.netDays}` : ''}</Td>
                <Td>{a.priceList?.name || 'Yard board'}</Td>
                <Td>{a.sitesCount}</Td>
                <Td>{[a.billingCity, a.billingRegion].filter(Boolean).join(', ') || '—'}</Td>
                <Td><StatusCell tone={a.status === 'active' ? 'live' : 'alert'}>{a.status === 'active' ? 'Active' : 'Suspended'}</StatusCell></Td>
              </tr>
            ))}
          </DataTable>
          <Pager page={page} pages={pages} label="Account pages" prev={page > 1 ? href({ page: String(page - 1) }) : null} next={page < pages ? href({ page: String(page + 1) }) : null} />
        </>
      ) : <Empty>{q ? 'No accounts match.' : 'No accounts here yet. Approved applications appear here.'}</Empty>}
    </>,
  );
}
