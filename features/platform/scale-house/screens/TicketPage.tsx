import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { Notice } from '@/features/platform/lib/ui';
import { getStaffContext, getTicket, getWeighChoices } from '../actions';
import { TicketWorkspace } from '../components/TicketWorkspace';

type Props = { params: Promise<{ ticketId: string }> };

export async function TicketPage({ params }: Props) {
  const { ticketId } = await params;
  const [ctx, t] = await Promise.all([getStaffContext(), getTicket(ticketId)]);
  const crumbs = (label: string) => [
    { type: 'link' as const, label: 'Dashboard', href: '/dashboard' },
    { type: 'link' as const, label: 'Scale house', href: '/dashboard/platform/scale-house' },
    { type: 'page' as const, label },
  ];
  if (!ctx.ok || !t.ok) {
    return <PageContainer title="Ticket" breadcrumbs={crumbs('Ticket')}><div className="p-4 md:p-6"><Notice tone="alert">{!ctx.ok ? ctx.error : !t.ok ? t.error : ''}</Notice></div></PageContainer>;
  }
  const choices = t.ticket.yard ? await getWeighChoices(t.ticket.yard.id) : { ok: true as const, scales: [], materials: [] };
  return (
    <PageContainer title={`Ticket ${t.ticket.displayNumber}`} breadcrumbs={crumbs(t.ticket.displayNumber)}>
      <div className="p-4 md:p-6">
        <TicketWorkspace ticket={t.ticket} scales={choices.scales} materials={choices.materials} role={ctx.role} />
      </div>
    </PageContainer>
  );
}
