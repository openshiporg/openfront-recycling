import { getBusiness, getPriceBoard, getYard } from '../lib/data/public';
import { address, dateTime, perUnit, zoneName } from '../lib/format';
import { groupByCategory, priceText } from './PricesPage';
import { PrintButton } from '../components/PrintButton';

/** P4: a plain sheet for the counter window. No site chrome. */
export default async function PriceSheetPage({ yard }: { yard?: string | null }) {
  const [boardR, businessR] = await Promise.all([getPriceBoard(yard || null), getBusiness()]);
  if (!boardR.ok || !boardR.data) {
    return <div className="sf-print"><h1>Price sheet</h1><p>{boardR.ok ? 'This yard has not published prices yet.' : 'Prices could not be loaded. Try again in a moment.'}</p></div>;
  }
  const board = boardR.data;
  const yardR = await getYard(board.yard.slug);
  const y = yardR.ok ? yardR.data : null;
  const business = businessR.ok ? businessR.data : null;
  const addr = y ? address(y) : null;
  const tz = board.yard.timezone;
  const groups = groupByCategory(board.entries.filter((e) => e.direction !== 'charge_customer'));
  const fees = board.entries.filter((e) => e.direction === 'charge_customer');
  return (
    <div className="sf-print">
      <div className="sf-between">
        <div>
          <h1>{business?.name || board.yard.name}</h1>
          <p style={{ margin: '4px 0 0' }}>{board.yard.name}{addr?.oneLine ? ` · ${addr.oneLine}` : ''}{y?.phone ? ` · ${y.phone}` : ''}</p>
        </div>
        <PrintButton />
      </div>
      <p><strong>Prices published {dateTime(board.publishedAt, tz)} ({zoneName(tz)}).</strong> The price on this sheet is the price the scale pays for clean, sorted material.</p>
      <div style={{ columns: '2 320px', columnGap: 28 }}>
        {groups.map((g) => (
          <section key={g.name} style={{ breakInside: 'avoid', marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, textTransform: 'uppercase', borderBottom: '2px solid #000', margin: '0 0 4px' }}>{g.name}</h2>
            <table className="sf-table">
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.materialId}><td>{r.materialName}</td><td className="r"><strong>{priceText(r, board.currencyCode)}</strong> {perUnit(r.unit)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        {fees.length ? (
          <section style={{ breakInside: 'avoid' }}>
            <h2 style={{ fontSize: 18, textTransform: 'uppercase', borderBottom: '2px solid #000', margin: '0 0 4px' }}>Drop-off fees</h2>
            <table className="sf-table"><tbody>{fees.map((r) => <tr key={r.materialId}><td>{r.materialName}</td><td className="r"><strong>{priceText(r, board.currencyCode)}</strong> {perUnit(r.unit)}</td></tr>)}</tbody></table>
          </section>
        ) : null}
      </div>
    </div>
  );
}
