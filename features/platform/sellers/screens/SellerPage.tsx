import Link from 'next/link';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { DataTable, Empty, Notice, PageHeader, Readouts, Restricted, Section, StatusCell, Tag, Td, type Tone } from '@/features/platform/lib/ui';
import { getStaffContext } from '@/features/platform/lib/staff';
import { dateTimeIn, humanize, money, payoutStatus } from '@/features/platform/lib/format';
import { getSeller } from '../actions';
import { SellerProfileForm } from '../components/SellerProfileForm';
import { SellerStatusControl } from '../components/SellerStatusControl';
import { IdDocuments } from '../components/IdDocuments';
import { Vehicles } from '../components/Vehicles';
import { SELLER_STATUS } from '../types';
import { idTone, statusTone } from './SellersPage';

type Props = { params: Promise<{ sellerId: string }> };
const ticketTone: Record<string, Tone> = { open: 'info', completed: 'live', settled: 'live', paid: 'live', voided: 'off' };
const payoutTone: Record<string, Tone> = { ready: 'info', held: 'wait', paid: 'live', returned: 'alert', cancelled: 'off' };

const age = (dob: string | null) => {
  if (!dob) return null;
  const d = new Date(dob), n = new Date();
  return n.getUTCFullYear() - d.getUTCFullYear() - (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate()) ? 1 : 0);
};

export async function SellerPage({ params }: Props) {
  const { sellerId } = await params;
  const [ctx, r] = await Promise.all([getStaffContext(), getSeller(sellerId)]);
  const name = r.ok ? `${r.seller.firstName} ${r.seller.lastName}` : 'Seller';
  const breadcrumbs = [{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'link' as const, label: 'Sellers', href: '/dashboard/platform/sellers' }, { type: 'page' as const, label: name }];
  const shell = (body: React.ReactNode) => <PageContainer title={name} breadcrumbs={breadcrumbs}><div className="flex flex-col gap-6 p-4 md:p-6">{body}</div></PageContainer>;
  if (!ctx.ok) return shell(<Notice tone="alert">{ctx.error}</Notice>);
  if (!r.ok) return shell(<Notice tone="alert">{r.error}</Notice>);
  const s = r.seller;
  const tz = ctx.yards[0]?.timezone || undefined;
  const canEdit = Boolean(ctx.role.canManageSellers || ctx.role.canManageTickets);
  const payouts = r.payouts;
  const paidCents = (payouts || []).filter((p) => p.status === 'paid').reduce((a, p) => a + p.amountCents, 0);
  const years = age(s.dateOfBirth);
  return shell(
    <>
      <PageHeader title={name} tone={statusTone[s.status] || 'off'}
        meta={<>{SELLER_STATUS[s.status] || s.status} · ID {humanize(s.idVerification)}{years !== null ? ` · age ${years}` : ''} · seller since {dateTimeIn(s.createdAt, tz)}{s.user ? ' · has a website sign-in' : ''}</>}
        actions={<SellerStatusControl sellerId={s.id} status={s.status} role={ctx.role} />} />
      {s.status !== 'active' ? <Notice tone={s.status === 'do_not_buy' ? 'alert' : 'status'}>{s.status === 'do_not_buy' ? 'Do not buy from this seller.' : 'Flagged: check with a manager before buying.'}{s.statusReason ? ` Reason: ${s.statusReason}` : ''}</Notice> : null}
      <Readouts items={[
        { label: 'Tickets', value: String(s.ticketsCount) },
        ...(payouts ? [{ label: 'Paid out (last 25)', value: money(paidCents) }] : []),
        { label: 'ID', value: <StatusCell tone={idTone[s.idVerification] || 'off'}>{humanize(s.idVerification)}</StatusCell> },
        { label: 'Prefers', value: humanize(s.preferredPayout) },
        { label: 'Price list', value: s.priceList?.name || 'Yard board' },
      ]} />
      <div className="grid gap-8 xl:grid-cols-2">
        <Section title="ID documents" count={s.identityDocuments.length}><IdDocuments sellerId={s.id} docs={s.identityDocuments} canEdit={canEdit} tz={tz} /></Section>
        <Section title="Vehicles" count={s.vehicles.filter((v) => !v.isRemoved).length}><Vehicles sellerId={s.id} vehicles={s.vehicles} canEdit={canEdit} /></Section>
      </div>
      <Section title="Tickets" count={s.ticketsCount}>
        {s.tickets.length ? (
          <DataTable label="Tickets" head={[{ label: 'Ticket' }, { label: 'Yard' }, { label: 'Status' }, { label: 'Total', className: 'text-right' }, { label: 'Completed' }]}>
            {s.tickets.map((t) => (
              <tr key={t.id} className="hover:bg-muted/40">
                <Td><Link className="font-mono underline-offset-4 hover:underline" href={`/dashboard/platform/scale-house/${t.id}`}>{t.displayNumber || t.id}</Link></Td>
                <Td>{t.yard?.name || '—'}</Td>
                <Td><StatusCell tone={ticketTone[t.status] || 'off'}>{humanize(t.status)}</StatusCell></Td>
                <Td className="text-right tabular-nums">{t.totalCents === null ? '—' : money(t.totalCents)}</Td>
                <Td>{t.completedAt ? dateTimeIn(t.completedAt, t.yard?.timezone || tz) : '—'}</Td>
              </tr>
            ))}
          </DataTable>
        ) : <Empty>No tickets yet.</Empty>}
      </Section>
      {payouts ? <Section title="Payouts" count={payouts.length}>
        {payouts.length ? (
          <DataTable label="Payouts" head={[{ label: 'Ticket' }, { label: 'Amount', className: 'text-right' }, { label: 'Status' }, { label: 'Method' }, { label: 'When' }]}>
            {payouts.map((p) => (
              <tr key={p.id}>
                <Td className="font-mono">{p.ticket?.displayNumber || '—'}</Td>
                <Td className="text-right tabular-nums">{money(p.amountCents)}</Td>
                <Td><StatusCell tone={payoutTone[p.status] || 'off'}>{payoutStatus(p.status)}</StatusCell></Td>
                <Td>{p.method ? humanize(p.method) : '—'}{p.checkNumber ? <> <Tag>#{p.checkNumber}</Tag></> : null}</Td>
                <Td>{p.paidAt ? `Paid ${dateTimeIn(p.paidAt, tz)}` : p.releaseAt && p.status === 'held' ? `Releases ${dateTimeIn(p.releaseAt, tz)}` : dateTimeIn(p.createdAt, tz)}</Td>
              </tr>
            ))}
          </DataTable>
        ) : <Empty>No payouts yet.</Empty>}
      </Section> : null}
      {r.doNotBuy && r.doNotBuy.length ? (
        <Section title="Do-not-buy entries" count={r.doNotBuy.length}>
          <DataTable label="Do-not-buy entries" head={[{ label: 'Reason' }, { label: 'Source' }, { label: 'Until' }, { label: 'Status' }]}>
            {r.doNotBuy.map((d) => (
              <tr key={d.id}><Td>{d.reason || '—'}</Td><Td>{d.source ? humanize(d.source) : '—'}</Td><Td>{d.expiresOn ? dateTimeIn(d.expiresOn, tz) : 'No end date'}</Td><Td><StatusCell tone={d.isActive ? 'alert' : 'off'}>{d.isActive ? 'In force' : 'Lifted'}</StatusCell></Td></tr>
            ))}
          </DataTable>
        </Section>
      ) : null}
      <Section title="Contact and address">{canEdit ? <SellerProfileForm seller={s} /> : <Restricted>Editing needs the sellers permission.</Restricted>}</Section>
    </>,
  );
}
