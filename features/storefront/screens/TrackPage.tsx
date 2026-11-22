import Link from 'next/link';
import { lookupReceipt } from '../lib/data/public';
import { LoadError, PageHead, StateCard } from '../components/ui';
import { ReceiptView } from '../components/ReceiptView';
import { TrackForm } from '../components/forms/TrackForm';

/** P17: a receipt by ticket number and the lookup code printed on it. */
export default async function TrackPage({ number, code }: { number?: string | null; code?: string | null }) {
  const head = <PageHead title="Find a receipt" crumbs={[{ href: '/', label: 'Home' }, { label: 'Find a receipt' }]} lead="Enter the ticket number and the lookup code printed on your receipt." />;
  if (!number || !code) {
    return (<>{head}<div className="sf-wrap sf-section" style={{ maxWidth: 560 }}><div className="sf-card"><TrackForm /></div></div></>);
  }
  const r = await lookupReceipt(number, code);
  if (!r.ok) return (<>{head}<LoadError what="the receipt" /></>);
  if (!r.data) {
    return (
      <>
        {head}
        <StateCard title="No receipt matches" action={<Link className="sf-btn sf-btn-sm" href="/track">Try again</Link>}>
          Check the ticket number and code against your receipt. The code is the 8 letters and numbers under the barcode.
        </StateCard>
      </>
    );
  }
  return (
    <>
      {head}
      <div className="sf-wrap sf-section">
        <ReceiptView r={r.data} />
        <p className="sf-small sf-muted">Have an account? <Link className="sf-link" href="/account/tickets">See all your tickets</Link>.</p>
      </div>
    </>
  );
}
