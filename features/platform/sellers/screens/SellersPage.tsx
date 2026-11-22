import Link from 'next/link';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { DataTable, Empty, Notice, PageHeader, Pager, Restricted, StatusCell, StatusTabs, Tag, Td, type Tone } from '@/features/platform/lib/ui';
import { getStaffContext } from '@/features/platform/lib/staff';
import { dateTimeIn, humanize } from '@/features/platform/lib/format';
import { listSellers, searchSellers } from '../actions';
import { SellerSearchBox } from '../components/SellerSearchBox';
import { SELLER_STATUS } from '../types';

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/dashboard/platform/sellers';
const PER_PAGE = 50;
const STATUSES = ['active', 'flagged', 'do_not_buy', 'unverified', 'all'];
export const statusTone: Record<string, Tone> = { active: 'live', flagged: 'wait', do_not_buy: 'alert' };
export const idTone: Record<string, Tone> = { verified: 'live', unverified: 'wait', expired: 'alert' };
const MATCH: Record<string, string> = { name: 'name', phone: 'phone', email: 'email', id: 'ID number', plate: 'plate' };

export async function SellersPage({ searchParams }: Props) {
  const p = (await searchParams) || {};
  const breadcrumbs = [{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'page' as const, label: 'Sellers' }];
  const shell = (body: React.ReactNode) => <PageContainer title="Sellers" breadcrumbs={breadcrumbs}><div className="flex flex-col gap-6 p-4 md:p-6">{body}</div></PageContainer>;
  const ctx = await getStaffContext();
  if (!ctx.ok) return shell(<Notice tone="alert">{ctx.error}</Notice>);
  if (!ctx.role.canManageSellers && !ctx.role.canManageTickets && !ctx.role.canManageCompliance) return shell(<Restricted>Your role doesn’t include seller records.</Restricted>);
  const tz = ctx.yards[0]?.timezone;
  const q = typeof p.q === 'string' ? p.q.trim() : '';
  const status = STATUSES.includes(String(p.status)) ? String(p.status) : 'active';
  const page = Math.max(1, Number.parseInt(String(p.page || '1'), 10) || 1);
  const header = <PageHeader title="Sellers" tone="live" meta="Walk-in sellers: find by name, ID number, phone or plate" />;

  if (q.length >= 2) {
    const r = await searchSellers(q);
    if (!r.ok) return shell(<>{header}<SellerSearchBox /><Notice tone="alert">{r.error}</Notice></>);
    return shell(
      <>
        {header}
        <SellerSearchBox />
        {r.sellers.length ? (
          <DataTable label="Matching sellers" head={[{ label: 'Seller' }, { label: 'Matched on' }, { label: 'ID' }, { label: 'Plates' }, { label: 'Tickets' }, { label: 'Last ticket' }, { label: 'Status' }]}>
            {r.sellers.map((s) => (
              <tr key={s.id} className="hover:bg-muted/40">
                <Td><Link className="font-medium underline-offset-4 hover:underline" href={`${BASE}/${s.id}`}>{s.name}</Link><div className="text-xs text-muted-foreground">{[s.phone, s.city].filter(Boolean).join(' · ') || '—'}</div></Td>
                <Td>{s.matchedOn.map((m) => MATCH[m] || humanize(m)).join(', ') || '—'}</Td>
                <Td>{s.idLast4 ? <>{humanize(s.idKind || 'ID')} ···{s.idLast4}</> : '—'}<div><StatusCell tone={idTone[s.idVerification] || 'off'}>{humanize(s.idVerification)}</StatusCell></div></Td>
                <Td>{s.plates.length ? s.plates.map((x) => <Tag key={x}>{x}</Tag>) : '—'}</Td>
                <Td>{s.ticketCount}</Td>
                <Td>{s.lastTicketAt ? dateTimeIn(s.lastTicketAt, tz) : '—'}</Td>
                <Td><StatusCell tone={statusTone[s.status] || 'off'}>{SELLER_STATUS[s.status] || s.status}</StatusCell></Td>
              </tr>
            ))}
          </DataTable>
        ) : <Empty>No seller matches “{q}”. New sellers are added at the scale house when they bring material.</Empty>}
      </>,
    );
  }

  const r = await listSellers({ status, page, perPage: PER_PAGE });
  if (!r.ok) return shell(<>{header}<Notice tone="alert">{r.error}</Notice></>);
  const pages = Math.max(1, Math.ceil(r.count / PER_PAGE));
  const href = (patch: Record<string, string>) => {
    const s = new URLSearchParams({ ...(status !== 'active' ? { status } : {}), ...patch });
    [...s.entries()].forEach(([k, v]) => { if (!v) s.delete(k); });
    return `${BASE}${s.toString() ? `?${s}` : ''}`;
  };
  return shell(
    <>
      {header}
      <SellerSearchBox />
      <StatusTabs label="Seller status" current={status} hrefFor={(v) => href({ status: v === 'active' ? '' : v, page: '' })} tabs={[
        { value: 'active', label: 'Active', count: r.active, tone: 'live' },
        { value: 'flagged', label: 'Flagged', count: r.flagged, tone: 'wait' },
        { value: 'do_not_buy', label: 'Do not buy', count: r.dnb, tone: 'alert' },
        { value: 'unverified', label: 'ID not verified', count: r.unverified, tone: 'wait' },
        { value: 'all', label: 'All', count: r.all },
      ]} />
      {r.sellers.length ? (
        <>
          <DataTable label="Sellers" head={[{ label: 'Seller' }, { label: 'Phone' }, { label: 'City' }, { label: 'Plates' }, { label: 'Tickets' }, { label: 'ID' }, { label: 'Status' }, { label: 'Since' }]}>
            {r.sellers.map((s) => (
              <tr key={s.id} className="hover:bg-muted/40">
                <Td><Link className="font-medium underline-offset-4 hover:underline" href={`${BASE}/${s.id}`}>{s.firstName} {s.lastName}</Link></Td>
                <Td>{s.phone || '—'}</Td>
                <Td>{[s.city, s.region].filter(Boolean).join(', ') || '—'}</Td>
                <Td>{s.vehicles.filter((v) => v.plate).map((v) => <Tag key={v.plate}>{v.plate}</Tag>)}{s.vehicles.length ? null : '—'}</Td>
                <Td>{s.ticketsCount}</Td>
                <Td><StatusCell tone={idTone[s.idVerification] || 'off'}>{humanize(s.idVerification)}</StatusCell></Td>
                <Td><StatusCell tone={statusTone[s.status] || 'off'}>{SELLER_STATUS[s.status] || s.status}</StatusCell></Td>
                <Td>{dateTimeIn(s.createdAt, tz)}</Td>
              </tr>
            ))}
          </DataTable>
          <Pager page={page} pages={pages} label="Seller pages" prev={page > 1 ? href({ page: String(page - 1) }) : null} next={page < pages ? href({ page: String(page + 1) }) : null} />
        </>
      ) : <Empty>No sellers here.</Empty>}
    </>,
  );
}
