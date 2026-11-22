import Link from 'next/link';
import { getYardRules, getYards } from '../../lib/data/public';
import { getIdentity, getOverview, getVehicles, getViewer } from '../../lib/data/seller';
import { label, shortDate } from '../../lib/format';
import { LoadError } from '../../components/ui';
import { IdentityForm, ProfileForm, RemoveVehicleButton, VehicleForm } from '../../components/forms/SellerForms';
import { AccountTitle } from './AccountLayout';

const safe = (n?: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '');

/** S2 */
export async function ProfilePage({ welcome, next }: { welcome?: boolean; next?: string | null }) {
  const [o, viewer, yards] = await Promise.all([getOverview(), getViewer(), getYards()]);
  if (!o.ok || !viewer.ok || !viewer.data) return <LoadError what="your details" />;
  const methods = new Set<string>();
  if (yards.ok && yards.data[0]) {
    const rr = await getYardRules(yards.data[0].slug);
    (rr.ok && rr.data ? rr.data.payoutMethods : yards.data[0].payoutMethods || []).forEach((m) => methods.add(m));
  }
  return (
    <>
      <AccountTitle title="My details" lead="The yard needs these on every ticket. You enter them once." />
      {welcome ? <p className="sf-note sf-note-ok" style={{ margin: 0 }}>Your account is ready. Add your details, then your ID and vehicle.</p> : null}
      <section className="sf-card"><ProfileForm seller={o.data?.seller || null} viewer={viewer.data} payoutMethods={[...methods]} next={safe(next) || (welcome ? '/account/identity' : '')} /></section>
    </>
  );
}

/** S3 */
export async function IdentityPage({ next }: { next?: string | null }) {
  const r = await getIdentity();
  if (!r.ok) return <LoadError what="your ID" />;
  const docs = r.data?.documents || [];
  const current = docs.find((d) => d.isCurrent);
  const expired = current?.expiresOn && new Date(current.expiresOn).getTime() < Date.now();
  return (
    <>
      <AccountTitle title="Photo ID" lead="Yards must record a current government photo ID for every purchase." />
      {current ? (
        <section className="sf-card sf-between">
          <div>
            <strong>{label('idKind', current.kind)}{current.issuer ? `, ${current.issuer}` : ''}</strong>
            <div className="sf-muted">Ending {current.last4 || '••••'} · {current.expiresOn ? `expires ${shortDate(current.expiresOn, null, true)}` : 'no expiry date'}</div>
          </div>
          <span className={`sf-badge ${expired ? 'sf-badge-alert' : current.verified ? 'sf-badge-ok' : 'sf-badge-warn'}`}>{expired ? 'Expired' : label('idVerification', current.verified ? 'verified' : 'unverified')}</span>
        </section>
      ) : <p className="sf-note sf-note-warn" style={{ margin: 0 }}>You don’t have an ID on file yet. Add it before you check in.</p>}
      <section className="sf-card">
        <h2 className="sf-h3" style={{ marginBottom: 12 }}>{current ? 'Replace with a new ID' : 'Add your ID'}</h2>
        <IdentityForm next={safe(next)} />
      </section>
    </>
  );
}

/** S4 */
export async function VehiclesPage({ next }: { next?: string | null }) {
  const r = await getVehicles();
  if (!r.ok) return <LoadError what="your vehicles" />;
  return (
    <>
      <AccountTitle title="Vehicles" lead="The scale records the plate of the vehicle you deliver in." />
      {r.data.length ? (
        <div className="sf-stack">
          {r.data.map((veh) => (
            <details key={veh.id} className="sf-card">
              <summary className="sf-between" style={{ cursor: 'pointer', listStyle: 'none' }}>
                <span><strong className="sf-mono">{veh.plate}</strong>{veh.plateRegion ? ` (${veh.plateRegion})` : ''} · {[veh.color, veh.make, veh.model].filter(Boolean).join(' ') || label('vehicleKind', veh.kind)}</span>
                <span className="sf-link">Edit</span>
              </summary>
              <div style={{ marginTop: 16 }}><VehicleForm vehicle={veh} /></div>
              <div style={{ marginTop: 10 }}><RemoveVehicleButton id={veh.id} /></div>
            </details>
          ))}
        </div>
      ) : <p className="sf-muted" style={{ margin: 0 }}>No vehicles yet.</p>}
      <section className="sf-card">
        <h2 className="sf-h3" style={{ marginBottom: 12 }}>Add a vehicle</h2>
        <VehicleForm next={safe(next)} />
      </section>
      {safe(next) ? <Link className="sf-link" href={safe(next)}>Continue</Link> : null}
    </>
  );
}
