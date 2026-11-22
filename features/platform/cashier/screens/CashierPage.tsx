import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { Notice, PageHeader, Pager, Readouts, Restricted, Section, StatusTabs, liveStamp } from '@/features/platform/lib/ui';
import { getStaffContext, pickYard } from '@/features/platform/lib/staff';
import { YardSwitcher } from '@/features/platform/lib/YardSwitcher';
import { money } from '@/features/platform/lib/format';
import { getCollectList, getDrawerState, getPayoutQueue, getRegister } from '../actions';
import { CollectTable } from '../components/CollectTable';
import { DrawerPanel } from '../components/DrawerPanel';
import { PayoutQueue } from '../components/PayoutQueue';
import { RegisterTable } from '../components/RegisterTable';

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/dashboard/platform/cashier';
const TABS = ['queue', 'drawers', 'collect', 'checks', 'transfers'] as const;
type Tab = (typeof TABS)[number];

export async function CashierPage({ searchParams }: Props) {
  const params = (await searchParams) || {};
  const breadcrumbs = [{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'page' as const, label: 'Cashier' }];
  const shell = (body: React.ReactNode) => <PageContainer title="Cashier" breadcrumbs={breadcrumbs}><div className="flex flex-col gap-6 p-4 md:p-6">{body}</div></PageContainer>;

  const ctx = await getStaffContext();
  if (!ctx.ok) return shell(<Notice tone="alert">{ctx.error}</Notice>);
  const { role } = ctx;
  if (!role.canPaySellers && !role.canManageCashDrawers && !role.canManageFinance) return shell(<Restricted>Your role doesn’t include the cashier window.</Restricted>);
  const yard = pickYard(ctx.yards, params.yard);
  if (!yard) return shell(<Restricted>You are not assigned to a yard yet. A manager can add you to a yard under Team.</Restricted>);

  const tab: Tab = (TABS as readonly string[]).includes(String(params.tab)) ? (params.tab as Tab) : 'queue';
  const page = Math.max(1, Number.parseInt(String(params.page || '1'), 10) || 1);
  const canCollect = Boolean(role.canManageFinance);
  const [drawers, queue, register, collect] = await Promise.all([
    getDrawerState(yard.id),
    getPayoutQueue(yard.id),
    tab === 'checks' || tab === 'transfers' ? getRegister(yard.id, tab === 'checks' ? 'check' : 'transfer', page) : Promise.resolve(null),
    canCollect ? getCollectList(yard.id) : Promise.resolve(null),
  ]);

  const mine = drawers.ok ? drawers.state.drawers.find((d) => d.session?.isMine && d.session.status === 'open')?.session || null : null;
  const iHaveOpen = drawers.ok ? drawers.state.drawers.some((d) => d.session?.isMine) : false;
  const payouts = queue.ok ? queue.payouts : [];
  const ready = payouts.filter((p) => p.status === 'ready');
  const held = payouts.filter((p) => p.status === 'held');
  const returned = payouts.filter((p) => p.status === 'returned');
  const href = (t: string, extra: Record<string, string> = {}) => `${BASE}?${new URLSearchParams({ yard: yard.id, tab: t, ...extra }).toString()}`;

  return shell(
    <>
      <PageHeader
        title="Cashier"
        tone="live"
        meta={<>{yard.name} · {mine ? `your drawer holds ${money(mine.expectedCents)}` : 'no drawer open'} · updated {liveStamp(new Date(), yard.timezone)}</>}
        actions={<YardSwitcher yards={ctx.yards} yardId={yard.id} />}
      />
      <Readouts items={[
        { label: 'Ready to pay', value: `${ready.length} · ${money(ready.reduce((s, p) => s + p.amountCents, 0))}`, tone: 'live' },
        { label: 'Held', value: `${held.length} · ${money(held.reduce((s, p) => s + p.amountCents, 0))}`, tone: 'wait' },
        { label: 'Returned', value: returned.length, tone: returned.length ? 'alert' : undefined },
        { label: 'My drawer', value: mine ? money(mine.expectedCents) : 'Closed', tone: mine ? 'live' : 'off' },
        { label: 'Drawers to approve', value: drawers.ok ? drawers.state.pendingApproval : '—', tone: drawers.ok && drawers.state.pendingApproval ? 'alert' : undefined },
      ]} />
      <StatusTabs
        label="Cashier views"
        current={tab}
        hrefFor={(t) => href(t)}
        tabs={[
          { value: 'queue', label: 'Payout queue', count: payouts.length, tone: 'live' },
          { value: 'drawers', label: 'Drawers', count: drawers.ok ? drawers.state.drawers.length : undefined, tone: drawers.ok && drawers.state.pendingApproval ? 'alert' : undefined },
          ...(canCollect ? [{ value: 'collect', label: 'Collect', count: collect?.ok ? collect.rows.length : undefined }] : []),
          { value: 'checks', label: 'Check register' },
          { value: 'transfers', label: 'Transfers' },
        ]}
      />
      {tab === 'queue' ? (
        !queue.ok ? <Notice tone="alert">{queue.error}</Notice> : (
          <Section title="Payout queue" count={payouts.length}>
            {!mine && ready.length ? <Notice className="mb-3">Open a drawer on the Drawers tab to pay cash. Checks and transfers don’t need one.</Notice> : null}
            <PayoutQueue payouts={payouts} mySessionId={mine?.id || null} myExpectedCents={mine?.expectedCents ?? null} timeZone={yard.timezone} role={role} />
          </Section>
        )
      ) : null}
      {tab === 'drawers' ? (
        !drawers.ok ? <Notice tone="alert">{drawers.error}</Notice>
          : drawers.state.drawers.length ? <div className="flex flex-col gap-8">{drawers.state.drawers.map((d) => <DrawerPanel key={d.drawerId} drawer={d} timeZone={yard.timezone} role={role} iHaveOpen={iHaveOpen} />)}</div>
            : <Restricted>This yard has no cash drawer. Add one under Settings.</Restricted>
      ) : null}
      {tab === 'collect' && canCollect ? (
        !collect || !collect.ok ? <Notice tone="alert">{collect && !collect.ok ? collect.error : 'Not available.'}</Notice> : (
          <Section title="Fee tickets to collect" count={collect.rows.length}><CollectTable rows={collect.rows} mySessionId={mine?.id || null} timeZone={yard.timezone} /></Section>
        )
      ) : null}
      {(tab === 'checks' || tab === 'transfers') && register ? (
        !register.ok ? <Notice tone="alert">{register.error}</Notice> : (
          <Section title={tab === 'checks' ? 'Check register' : 'Transfer register'} count={register.count}>
            <RegisterTable rows={register.rows} method={tab === 'checks' ? 'check' : 'transfer'} timeZone={yard.timezone} canReturn={Boolean(role.canManageFinance)} />
            <Pager page={page} pages={register.pages} label="Register pages" prev={page > 1 ? href(tab, { page: String(page - 1) }) : null} next={page < register.pages ? href(tab, { page: String(page + 1) }) : null} />
          </Section>
        )
      ) : null}
    </>,
  );
}
