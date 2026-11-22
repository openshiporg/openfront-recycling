import { Notice } from '@/features/platform/lib/ui';
import { platformRequest } from '@/features/platform/lib/platformRequest';
import { getTicket } from '../actions';
import { PrintButton } from '../components/PrintButton';
import { dateTimeIn, humanize, money, price, weight } from '../utils/format';

type Props = { params: Promise<{ ticketId: string }> };

/**
 * Printable scale ticket and seller receipt. Only the receipt prints; the dashboard shell is hidden
 * by the print stylesheet below.
 */
export async function TicketPrintPage({ params }: Props) {
  const { ticketId } = await params;
  const [t, biz] = await Promise.all([
    getTicket(ticketId),
    platformRequest<{ businessSettings: { name: string | null; legalName: string | null; supportPhone: string | null; weightUnit: string | null } | null }>(`query PrintBusiness { businessSettings { name legalName supportPhone weightUnit } }`),
  ]);
  if (!t.ok) return <div className="p-6"><Notice tone="alert">{t.error}</Notice></div>;
  const ticket = t.ticket;
  const b = biz.ok ? biz.data.businessSettings : null;
  const unit = b?.weightUnit === 'kg' ? 'kg' : 'lb';
  const tz = ticket.yard?.timezone;
  const party = ticket.seller ? `${ticket.seller.firstName} ${ticket.seller.lastName}` : ticket.account?.name || '—';
  const signature = ticket.attachments.find((a) => a.kind === 'signature');

  return (
    <div className="p-4 md:p-6">
      <style>{`@media print { body * { visibility: hidden !important; } #scale-receipt, #scale-receipt * { visibility: visible !important; } #scale-receipt { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 0; border: 0; } }`}</style>
      <div className="mb-4 flex items-center gap-2 print:hidden">
        <PrintButton />
        <a href={`/dashboard/platform/scale-house/${ticket.id}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">Back to ticket</a>
      </div>
      <article id="scale-receipt" className="mx-auto max-w-[42rem] rounded-[6px] border bg-white p-8 font-mono text-[13px] leading-relaxed text-black">
        <header className="mb-4 border-b border-black pb-3 text-center">
          <p className="text-base font-bold">{b?.name || ticket.yard?.name}</p>
          {b?.legalName && b.legalName !== b.name ? <p>{b.legalName}</p> : null}
          <p>{ticket.yard?.name}{b?.supportPhone ? ` · ${b.supportPhone}` : ''}</p>
        </header>
        <dl className="mb-4 grid grid-cols-[9rem_1fr] gap-x-3">
          <dt>Ticket</dt><dd className="font-bold">{ticket.displayNumber}</dd>
          <dt>Status</dt><dd className="capitalize">{humanize(ticket.status)}{ticket.isAdjustment ? ' (adjustment)' : ''}</dd>
          <dt>{ticket.direction === 'outbound' ? 'Ship to' : 'Seller'}</dt><dd>{party}</dd>
          {ticket.vehiclePlate ? <><dt>Vehicle</dt><dd>{ticket.vehiclePlate} {ticket.vehiclePlateRegion || ''} {ticket.vehicleDescription || ''}</dd></> : null}
          <dt>Opened</dt><dd>{dateTimeIn(ticket.createdAt, tz)}</dd>
          {ticket.completedAt ? <><dt>Completed</dt><dd>{dateTimeIn(ticket.completedAt, tz)}{ticket.completedBy ? ` · ${ticket.completedBy.name}` : ''}</dd></> : null}
          <dt>Time zone</dt><dd>{tz || '—'}</dd>
        </dl>
        <table className="mb-4 w-full border-collapse">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-1 pr-2 font-bold">Material</th>
              <th className="py-1 pr-2 text-right font-bold">Gross</th>
              <th className="py-1 pr-2 text-right font-bold">Tare</th>
              <th className="py-1 pr-2 text-right font-bold">Net pay</th>
              <th className="py-1 pr-2 text-right font-bold">Price</th>
              <th className="py-1 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {ticket.lines.map((l) => (
              <tr key={l.id} className="border-b border-dashed border-black/40 align-top">
                <td className="py-1 pr-2">{l.materialName}{l.deductionReason ? <div className="text-[11px]">less {l.deductionPercent ? `${Number(l.deductionPercent)}%` : weight(l.deductionWeight, unit)}: {l.deductionReason}</div> : null}</td>
                <td className="py-1 pr-2 text-right">{l.unit === 'each' ? '' : weight(l.grossWeight, unit)}</td>
                <td className="py-1 pr-2 text-right">{l.unit === 'each' ? '' : weight(l.tareWeight, unit)}</td>
                <td className="py-1 pr-2 text-right">{l.unit === 'each' ? `${l.quantity} each` : weight(l.payWeight, unit)}</td>
                <td className="py-1 pr-2 text-right">{price(l.unitPrice, l.unit)}</td>
                <td className="py-1 text-right">{l.direction === 'charge_customer' ? '−' : ''}{money(l.amountCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mb-4 ml-auto grid w-64 grid-cols-2 gap-x-3 text-right">
          <dt>Material</dt><dd>{money(ticket.materialTotalCents)}</dd>
          {ticket.feeTotalCents ? <><dt>Fees</dt><dd>−{money(ticket.feeTotalCents)}</dd></> : null}
          {ticket.taxCents ? <><dt>Tax</dt><dd>{money(ticket.taxCents)}</dd></> : null}
          <dt className="font-bold">Total</dt><dd className="font-bold">{money(ticket.totalCents)}</dd>
        </dl>
        {ticket.payouts.length ? (
          <section className="mb-4 border-t border-black pt-2">
            {ticket.payouts.map((p) => (
              <p key={p.id}>{humanize(p.status)}{p.method ? ` by ${p.method}` : ''}: {money(p.amountCents)}{p.status === 'held' && p.releaseAt ? ` · held until ${dateTimeIn(p.releaseAt, tz)}` : ''}{p.paidAt ? ` · paid ${dateTimeIn(p.paidAt, tz)}` : ''}</p>
            ))}
          </section>
        ) : null}
        {ticket.direction === 'inbound' && !ticket.account ? (
          <section className="border-t border-black pt-2 text-[12px]">
            <p>I am the owner of this material, or am authorised to sell it, and the information I gave is true.</p>
            {signature?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signature.image.url} alt="Seller signature" className="mt-2 h-16 object-contain" />
            ) : <div className="mt-8 border-b border-black" />}
            <p>{signature?.signedName || party}</p>
          </section>
        ) : null}
      </article>
    </div>
  );
}
