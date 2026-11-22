import Link from 'next/link';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { Empty, Notice, PageHeader, Readouts, Restricted, Section, StatusDot, Tag, liveStamp } from '@/features/platform/lib/ui';
import { getBoard, getStaffContext } from '../actions';
import { BoardControls } from '../components/BoardControls';
import { NewTicketDrawer } from '../components/NewTicketDrawer';
import type { TicketCard } from '../types';
import { minutesLabel, money, timeIn, weight } from '../utils/format';

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

const BASE = '/dashboard/platform/scale-house';

export async function ScaleHousePage({ searchParams }: Props) {
  const params = (await searchParams) || {};
  const ctx = await getStaffContext();
  const breadcrumbs = [{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'page' as const, label: 'Scale house' }];
  if (!ctx.ok) return <PageContainer title="Scale house" breadcrumbs={breadcrumbs}><div className="p-4 md:p-6"><Notice tone="alert">{ctx.error}</Notice></div></PageContainer>;
  if (!ctx.yards.length) return <PageContainer title="Scale house" breadcrumbs={breadcrumbs}><div className="p-4 md:p-6"><Restricted>You are not assigned to a yard yet. A manager can add you to a yard under Team.</Restricted></div></PageContainer>;

  const wanted = typeof params.yard === 'string' ? params.yard : '';
  const yard = ctx.yards.find((y) => y.id === wanted || y.code === wanted) || ctx.yards[0];
  const result = await getBoard(yard.id);
  const canOpen = Boolean(ctx.role.canManageTickets);

  return (
    <PageContainer title="Scale house" breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <PageHeader
          title="Scale house"
          tone="live"
          meta={<>{yard.name} · updated {liveStamp(result.ok ? new Date(result.board.generatedAt) : new Date(), yard.timezone)}</>}
          actions={<div className="flex flex-wrap items-center gap-2"><BoardControls yards={ctx.yards} yardId={yard.id} />{canOpen ? <NewTicketDrawer yardId={yard.id} yardName={yard.name} /> : null}</div>}
        />
        {!result.ok ? <Notice tone="alert">{result.error}</Notice> : (
          <>
            <Readouts items={[
              { label: 'Checked in', value: result.board.checkedIn.length, tone: 'info' },
              { label: 'Weighing', value: result.board.weighing.length, tone: 'wait' },
              { label: 'Ready to complete', value: result.board.readyToComplete.length, tone: result.board.readyToComplete.some((t) => t.missing.length) ? 'alert' : 'live' },
              { label: 'Ready to pay', value: result.board.readyToPay.length, tone: 'live' },
              { label: 'To pay out', value: money(result.board.readyToPay.filter((p) => p.status === 'ready').reduce((s, p) => s + p.amountCents, 0)) },
            ]} />
            <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-4">
              <Section title="Checked in" tone="info" count={result.board.checkedIn.length}>
                {result.board.checkedIn.length ? (
                  <ul className="flex flex-col gap-2">
                    {result.board.checkedIn.map((v) => (
                      <li key={v.visitId} className="rounded-[6px] border p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{v.sellerName || 'Seller'}</span>
                          <Tag tone={v.status === 'arrived' ? 'live' : 'info'}>{v.status}</Tag>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Visit {v.code || '—'}{v.vehiclePlate ? ` · ${v.vehiclePlate}` : ''}{v.plannedDate ? ` · ${timeIn(v.plannedDate, yard.timezone)}` : ''}</p>
                        {v.expectedItems.length ? <p className="mt-1 text-xs">{v.expectedItems.join(', ')}</p> : null}
                        {canOpen ? <div className="mt-2"><NewTicketDrawer yardId={yard.id} yardName={yard.name} visit={{ code: v.code || '', sellerId: v.sellerId, sellerName: v.sellerName, plate: v.vehiclePlate }} /></div> : null}
                      </li>
                    ))}
                  </ul>
                ) : <Empty>No booked visits waiting.</Empty>}
              </Section>
              <Section title="Weighing" tone="wait" count={result.board.weighing.length}>
                {result.board.weighing.length ? <TicketList tickets={result.board.weighing} timeZone={yard.timezone} /> : <Empty>No ticket is waiting for its first weight.</Empty>}
              </Section>
              <Section title="Ready to complete" tone="live" count={result.board.readyToComplete.length}>
                {result.board.readyToComplete.length ? <TicketList tickets={result.board.readyToComplete} timeZone={yard.timezone} /> : <Empty>No ticket has lines waiting to complete.</Empty>}
              </Section>
              <Section title="Ready to pay" tone="live" count={result.board.readyToPay.length}>
                {result.board.readyToPay.length ? (
                  <ul className="flex flex-col gap-2">
                    {result.board.readyToPay.map((p) => (
                      <li key={p.payoutId}>
                        <Link href={p.ticketId ? `${BASE}/${p.ticketId}` : BASE} className="block rounded-[6px] border p-3 text-sm hover:bg-muted/50">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs">{p.number || '—'}</span>
                            <span className="font-semibold tabular-nums">{money(p.amountCents)}</span>
                          </div>
                          <p className="mt-1 truncate">{p.sellerName || p.accountName || '—'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            <StatusDot tone={p.status === 'held' ? 'wait' : 'live'} />{p.status === 'held' && p.releaseAt ? `Held until ${new Date(p.releaseAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: yard.timezone || undefined })}` : 'Ready'}
                            {p.allowedMethods.length ? ` · ${p.allowedMethods.join(', ')}` : ''}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <Empty>Nothing waiting at the cashier.</Empty>}
              </Section>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
}

function TicketList({ tickets, timeZone }: { tickets: TicketCard[]; timeZone?: string | null }) {
  return (
    <ul className="flex flex-col gap-2">
      {tickets.map((t) => (
        <li key={t.ticketId}>
          <Link href={`${BASE}/${t.ticketId}`} className="block rounded-[6px] border p-3 text-sm hover:bg-muted/50">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs">{t.number}</span>
              <span className="text-xs text-muted-foreground">{minutesLabel(t.minutesOpen)}</span>
            </div>
            <p className="mt-1 truncate font-medium">{t.sellerName || t.accountName || (t.direction === 'outbound' ? 'Outbound load' : 'Walk-in')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t.direction === 'outbound' ? 'Outbound · ' : ''}{t.vehiclePlate ? `${t.vehiclePlate} · ` : ''}{t.lineCount} {t.lineCount === 1 ? 'line' : 'lines'}{t.lineCount ? ` · ${weight(t.payWeight)} · ${money(t.totalCents)}` : ''} · opened {timeIn(t.openedAt, timeZone)}
            </p>
            {t.missing.length ? (
              <p className="mt-1.5 text-xs text-red-700 dark:text-red-400"><StatusDot tone="alert" />{t.missing.length} missing: {t.missing.slice(0, 2).map((m) => m.message).join(' ')}{t.missing.length > 2 ? ' …' : ''}</p>
            ) : t.lineCount ? <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400"><StatusDot tone="live" />Checklist complete</p> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
