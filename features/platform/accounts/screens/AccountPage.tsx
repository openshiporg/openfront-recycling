import Link from 'next/link';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { DataTable, Empty, Notice, PageHeader, Readouts, Restricted, Section, StatusCell, Tag, Td, type Tone } from '@/features/platform/lib/ui';
import { getStaffContext } from '@/features/platform/lib/staff';
import { dateTimeIn, humanize, money } from '@/features/platform/lib/format';
import { getAccount } from '../actions';
import { AccountStatusControl } from '../components/AccountStatusControl';
import { Contacts } from '../components/Contacts';
import { Sites } from '../components/Sites';
import { TermsForm } from '../components/TermsForm';
import { MoneyActions } from '../components/MoneyActions';
import { CYCLES, TERMS } from '../types';

type Props = { params: Promise<{ accountId: string }> };
const tone: Record<string, Tone> = { open: 'info', completed: 'live', settled: 'live', invoiced: 'live', waived: 'off', voided: 'off', void: 'off', draft: 'wait', approved: 'info', paid: 'live', partially_paid: 'wait', at_customer: 'info' };
const date = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : '—');

export async function AccountPage({ params }: Props) {
  const { accountId } = await params;
  const [ctx, r] = await Promise.all([getStaffContext(), getAccount(accountId)]);
  const name = r.ok ? r.account.name : 'Account';
  const breadcrumbs = [{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'link' as const, label: 'Accounts', href: '/dashboard/platform/accounts' }, { type: 'page' as const, label: name }];
  const shell = (body: React.ReactNode) => <PageContainer title={name} breadcrumbs={breadcrumbs}><div className="flex flex-col gap-6 p-4 md:p-6">{body}</div></PageContainer>;
  if (!ctx.ok) return shell(<Notice tone="alert">{ctx.error}</Notice>);
  if (!r.ok) return shell(<Notice tone="alert">{r.error}</Notice>);
  const a = r.account;
  const tz = ctx.yards[0]?.timezone || undefined;
  const canEdit = Boolean(ctx.role.canManageAccounts);
  const canFinance = Boolean(ctx.role.canManageFinance);
  const unbilled = r.money ? r.money.charges.filter((c) => c.status === 'open').reduce((s, c) => s + c.amountCents, 0) : null;
  const owed = r.money ? r.money.invoices.filter((i) => ['open', 'partially_paid'].includes(i.status)).reduce((s, i) => s + i.totalCents - i.paidCents, 0) : null;
  return shell(
    <>
      <PageHeader title={a.name} tone={a.status === 'active' ? 'live' : 'alert'}
        meta={<><Tag>{a.accountNumber || 'No number'}</Tag> {[a.isSupplier && 'supplier', a.isBuyer && 'buyer', a.isNonprofit && 'nonprofit'].filter(Boolean).join(', ')} · {TERMS[a.paymentTerms] || a.paymentTerms}{a.paymentTerms === 'net' ? ` ${a.netDays} days` : ''} · settles {CYCLES[a.settlementCycle]?.toLowerCase() || a.settlementCycle}</>}
        actions={<AccountStatusControl accountId={a.id} status={a.status} canChange={Boolean(ctx.role.canManageAccounts || ctx.role.canManageFinance || ctx.role.canManageSales)} />} />
      {a.status === 'suspended' ? <Notice tone="alert">Suspended{a.statusReason ? `: ${a.statusReason}` : '.'} The scale house can’t open tickets on this account.</Notice> : null}
      <Readouts items={[
        { label: 'Tickets', value: String(a.ticketsCount) },
        { label: 'Sites', value: String(a.sitesCount) },
        ...(r.containers ? [{ label: 'Containers out', value: String(r.containers.filter((c) => c.status === 'at_customer').length) }] : []),
        ...(unbilled !== null ? [{ label: 'Unbilled charges', value: money(unbilled) }] : []),
        ...(owed !== null ? [{ label: 'Invoices owed', value: money(owed), tone: owed > 0 ? ('wait' as Tone) : undefined }] : []),
        { label: 'Price list', value: a.priceList?.name || 'Yard board' },
      ]} />
      <div className="grid gap-8 xl:grid-cols-2">
        <Section title="Contacts" count={a.contacts.length}><Contacts accountId={a.id} contacts={a.contacts} canEdit={canEdit} /></Section>
        <Section title="Sites" count={a.sites.length}><Sites accountId={a.id} sites={a.sites} canEdit={canEdit} /></Section>
      </div>
      <Section title="Tickets" count={a.ticketsCount}>
        {a.tickets.length ? (
          <DataTable label="Tickets" head={[{ label: 'Ticket' }, { label: 'Site' }, { label: 'Direction' }, { label: 'Status' }, { label: 'Total', className: 'text-right' }, { label: 'Completed' }]}>
            {a.tickets.map((t) => (
              <tr key={t.id} className="hover:bg-muted/40">
                <Td><Link className="font-mono underline-offset-4 hover:underline" href={`/dashboard/platform/scale-house/${t.id}`}>{t.displayNumber || t.id}</Link></Td>
                <Td>{t.site?.name || '—'}</Td><Td>{humanize(t.direction)}</Td>
                <Td><StatusCell tone={tone[t.status] || 'off'}>{humanize(t.status)}</StatusCell></Td>
                <Td className="text-right tabular-nums">{t.totalCents === null ? '—' : money(t.totalCents)}</Td>
                <Td>{t.completedAt ? dateTimeIn(t.completedAt, t.yard?.timezone || tz) : '—'}</Td>
              </tr>
            ))}
          </DataTable>
        ) : <Empty>No tickets yet.</Empty>}
      </Section>
      {r.containers ? (
        <Section title="Containers" count={r.containers.length}>
          {r.containers.length ? (
            <DataTable label="Containers" head={[{ label: 'Number' }, { label: 'Type' }, { label: 'Site' }, { label: 'Material' }, { label: 'Status' }, { label: 'Days on site', className: 'text-right' }]}>
              {r.containers.map((c) => <tr key={c.id}><Td className="font-mono">{c.number || '—'}</Td><Td>{c.type?.name || '—'}</Td><Td>{c.site?.name || '—'}</Td><Td>{c.currentMaterial?.name || '—'}</Td><Td><StatusCell tone={tone[c.status] || 'off'}>{humanize(c.status)}</StatusCell></Td><Td className="text-right tabular-nums">{c.daysOnSite ?? '—'}</Td></tr>)}
            </DataTable>
          ) : <Empty>No containers placed with this account.</Empty>}
        </Section>
      ) : null}
      {r.money ? (
        <>
          <Section title="Charges" count={r.money.charges.length}>
            {r.money.charges.length ? (
              <DataTable label="Charges" head={[{ label: 'Charge' }, { label: 'Kind' }, { label: 'Service date' }, { label: 'Status' }, { label: 'Amount', className: 'text-right' }]}>
                {r.money.charges.map((c) => <tr key={c.id}><Td>{c.description || '—'}</Td><Td>{humanize(c.kind)}</Td><Td>{date(c.serviceDate)}</Td><Td><StatusCell tone={tone[c.status] || 'off'}>{humanize(c.status)}</StatusCell></Td><Td className="text-right tabular-nums">{money(c.amountCents)}</Td></tr>)}
              </DataTable>
            ) : <Empty>No charges.</Empty>}
          </Section>
          <div className="grid gap-8 xl:grid-cols-2">
            <Section title="Settlements" count={r.money.settlements.length}>
              {r.money.settlements.length ? (
                <DataTable label="Settlements" head={[{ label: 'No.' }, { label: 'Period' }, { label: 'Status' }, { label: 'Net', className: 'text-right' }]}>
                  {r.money.settlements.map((s) => <tr key={s.id}><Td>{s.number ?? '—'}</Td><Td>{date(s.periodStart)} – {date(s.periodEnd)}</Td><Td><StatusCell tone={tone[s.status] || 'off'}>{humanize(s.status)}</StatusCell></Td><Td className="text-right tabular-nums">{money(s.netCents)}</Td></tr>)}
                </DataTable>
              ) : <Empty>No settlements yet.</Empty>}
            </Section>
            <Section title="Invoices" count={r.money.invoices.length}>
              {r.money.invoices.length ? (
                <DataTable label="Invoices" head={[{ label: 'No.' }, { label: 'Kind' }, { label: 'Due' }, { label: 'Status' }, { label: 'Balance', className: 'text-right' }]}>
                  {r.money.invoices.map((i) => <tr key={i.id}><Td>{i.number ?? '—'}</Td><Td>{humanize(i.kind)}</Td><Td>{date(i.dueOn)}</Td><Td><StatusCell tone={tone[i.status] || 'off'}>{humanize(i.status)}</StatusCell></Td><Td className="text-right tabular-nums">{money(i.totalCents - i.paidCents)}<div className="text-xs text-muted-foreground">of {money(i.totalCents)}</div></Td></tr>)}
                </DataTable>
              ) : <Empty>No invoices yet.</Empty>}
            </Section>
          </div>
          {canFinance ? <Section title="Bill or settle"><MoneyActions accountId={a.id} netDays={a.netDays} /></Section> : null}
        </>
      ) : null}
      <Section title="Documents" count={a.documents.length}>
        {a.documents.length ? (
          <ul className="flex flex-col gap-1.5 text-sm">{a.documents.map((d) => <li key={d.id}>{d.file ? <a className="underline underline-offset-4" href={d.file.url} target="_blank" rel="noreferrer">{d.title || d.file.filename}</a> : d.title || humanize(d.kind)} <span className="text-muted-foreground">· {humanize(d.kind)} · {dateTimeIn(d.createdAt, tz)}{d.visibleToAccount ? ' · the account can see it' : ''}</span></li>)}</ul>
        ) : <Empty>No documents.</Empty>}
      </Section>
      <Section title="Terms and billing">{canEdit ? <TermsForm account={a} priceLists={r.priceLists} /> : <Restricted>Changing terms needs the accounts permission.</Restricted>}</Section>
    </>,
  );
}
