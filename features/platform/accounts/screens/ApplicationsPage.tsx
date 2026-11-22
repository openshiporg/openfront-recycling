import Link from 'next/link';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { DataTable, Empty, Notice, PageHeader, Restricted, StatusCell, StatusTabs, Td } from '@/features/platform/lib/ui';
import { getStaffContext } from '@/features/platform/lib/staff';
import { dateTimeIn, humanize } from '@/features/platform/lib/format';
import { listApplications } from '../actions';

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/dashboard/platform/accounts/applications';
const STATUSES = ['submitted', 'approved', 'declined', 'withdrawn'];

export async function ApplicationsPage({ searchParams }: Props) {
  const p = (await searchParams) || {};
  const breadcrumbs = [{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'link' as const, label: 'Accounts', href: '/dashboard/platform/accounts' }, { type: 'page' as const, label: 'Applications' }];
  const shell = (body: React.ReactNode) => <PageContainer title="Applications" breadcrumbs={breadcrumbs}><div className="flex flex-col gap-6 p-4 md:p-6">{body}</div></PageContainer>;
  const ctx = await getStaffContext();
  if (!ctx.ok) return shell(<Notice tone="alert">{ctx.error}</Notice>);
  if (!ctx.role.canManageAccounts) return shell(<Restricted>Reviewing applications needs the accounts permission.</Restricted>);
  const status = STATUSES.includes(String(p.status)) ? String(p.status) : 'submitted';
  const r = await listApplications(status);
  if (!r.ok) return shell(<Notice tone="alert">{r.error}</Notice>);
  const tz = ctx.yards[0]?.timezone;
  return shell(
    <>
      <PageHeader title="Applications" tone={r.submitted ? 'wait' : 'live'} meta="Businesses that applied on the website for a commercial, buyer or nonprofit account, oldest first" />
      <StatusTabs label="Application status" current={status} hrefFor={(v) => (v === 'submitted' ? BASE : `${BASE}?status=${v}`)} tabs={[
        { value: 'submitted', label: 'Waiting', count: r.submitted, tone: 'wait' },
        { value: 'approved', label: 'Approved', count: r.approved, tone: 'live' },
        { value: 'declined', label: 'Declined', count: r.declined, tone: 'alert' },
        { value: 'withdrawn', label: 'Withdrawn', count: r.withdrawn, tone: 'off' },
      ]} />
      {r.accountApplications.length ? (
        <DataTable label="Applications" head={[{ label: 'Business' }, { label: 'Kind' }, { label: 'Contact' }, { label: 'Volume' }, { label: 'Applied' }, { label: 'Status' }]}>
          {r.accountApplications.map((a) => (
            <tr key={a.id} className="hover:bg-muted/40">
              <Td><Link className="font-medium underline-offset-4 hover:underline" href={`${BASE}/${a.id}`}>{a.businessName}</Link><div className="text-xs text-muted-foreground">{[a.city, a.region].filter(Boolean).join(', ')}</div></Td>
              <Td>{humanize(a.kind)}</Td>
              <Td>{a.applicant?.name || '—'}<div className="text-xs text-muted-foreground">{a.email || a.applicant?.email || ''}</div></Td>
              <Td>{a.monthlyVolume || '—'}</Td>
              <Td>{dateTimeIn(a.createdAt, tz)}</Td>
              <Td><StatusCell tone={a.status === 'submitted' ? 'wait' : a.status === 'approved' ? 'live' : a.status === 'declined' ? 'alert' : 'off'}>{a.status === 'submitted' ? 'Waiting' : humanize(a.status)}</StatusCell></Td>
            </tr>
          ))}
        </DataTable>
      ) : <Empty>{status === 'submitted' ? 'No applications waiting.' : 'None.'}</Empty>}
    </>,
  );
}
