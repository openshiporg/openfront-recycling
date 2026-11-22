'use client';

import { removeVehicleAction, saveProfileAction, saveVehicleAction, submitIdentityAction, cancelVisitAction } from '../../lib/actions';
import type { SellerProfile, VehicleView } from '../../lib/data/seller';
import { ActionForm, Submit } from '../ActionForm';

const v = (fields: Record<string, string>, k: string, fallback?: string | null) => (k in fields ? fields[k] : fallback || '');

export function ProfileForm({ seller, viewer, payoutMethods, next }: { seller: SellerProfile | null; viewer: { name: string; email: string }; payoutMethods: string[]; next?: string }) {
  const [first, ...rest] = (viewer.name || '').split(' ');
  return (
    <ActionForm action={saveProfileAction}>
      {(f) => (
        <>
          <input type="hidden" name="next" value={next || ''} />
          <div className="sf-row2">
            <div className="sf-field"><label htmlFor="fn">First name</label><input id="fn" name="firstName" className="sf-input" autoComplete="given-name" required defaultValue={v(f, 'firstName', seller?.firstName || first)} /></div>
            <div className="sf-field"><label htmlFor="ln">Last name</label><input id="ln" name="lastName" className="sf-input" autoComplete="family-name" required defaultValue={v(f, 'lastName', seller?.lastName || rest.join(' '))} /></div>
          </div>
          <span className="sf-hint" style={{ marginTop: -8 }}>As printed on your ID.</span>
          <div className="sf-row2">
            <div className="sf-field"><label htmlFor="dob">Date of birth</label><input id="dob" name="dateOfBirth" type="date" className="sf-input" autoComplete="bday" required defaultValue={v(f, 'dateOfBirth', seller?.dateOfBirth?.slice(0, 10))} /></div>
            <div className="sf-field"><label htmlFor="ph">Phone</label><input id="ph" name="phone" type="tel" className="sf-input" autoComplete="tel" defaultValue={v(f, 'phone', seller?.phone)} /></div>
          </div>
          <div className="sf-field"><label htmlFor="em">Email for receipts</label><input id="em" name="email" type="email" className="sf-input" autoComplete="email" defaultValue={v(f, 'email', seller?.email || viewer.email)} /></div>
          <div className="sf-field"><label htmlFor="a1">Street address</label><input id="a1" name="addressLine1" className="sf-input" autoComplete="address-line1" defaultValue={v(f, 'addressLine1', seller?.addressLine1)} /></div>
          <div className="sf-field"><label htmlFor="a2">Apartment, suite (optional)</label><input id="a2" name="addressLine2" className="sf-input" autoComplete="address-line2" defaultValue={v(f, 'addressLine2', seller?.addressLine2)} /></div>
          <div className="sf-row3">
            <div className="sf-field"><label htmlFor="ci">City</label><input id="ci" name="city" className="sf-input" autoComplete="address-level2" defaultValue={v(f, 'city', seller?.city)} /></div>
            <div className="sf-field"><label htmlFor="rg">State</label><input id="rg" name="region" className="sf-input" autoComplete="address-level1" defaultValue={v(f, 'region', seller?.region)} /></div>
            <div className="sf-field"><label htmlFor="pc">ZIP code</label><input id="pc" name="postalCode" className="sf-input" autoComplete="postal-code" defaultValue={v(f, 'postalCode', seller?.postalCode)} /></div>
          </div>
          <span className="sf-hint" style={{ marginTop: -8 }}>Needed if the yard mails you a check.</span>
          {payoutMethods.length ? (
            <fieldset className="sf-field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="sf-label" style={{ marginBottom: 6 }}>How would you like to be paid?</legend>
              <div className="sf-grid sf-grid-3" style={{ gap: 8 }}>
                {payoutMethods.map((m) => (
                  <label key={m} className="sf-check"><input type="radio" name="preferredPayout" value={m} defaultChecked={v(f, 'preferredPayout', seller?.preferredPayout) === m} /> {m === 'cash' ? 'Cash' : m === 'check' ? 'Check' : 'Bank transfer'}</label>
                ))}
              </div>
              <span className="sf-hint">The yard’s rules may require another method for some items or amounts.</span>
            </fieldset>
          ) : null}
          <Submit pending="Saving…">Save my details</Submit>
        </>
      )}
    </ActionForm>
  );
}

export function IdentityForm({ next }: { next?: string }) {
  return (
    <ActionForm action={submitIdentityAction} encType="multipart/form-data">
      {(f) => (
        <>
          <input type="hidden" name="next" value={next || ''} />
          <div className="sf-row2">
            <div className="sf-field">
              <label htmlFor="kd">Kind of ID</label>
              <select id="kd" name="kind" className="sf-select" required defaultValue={f.kind || 'drivers_license'}>
                <option value="drivers_license">Driver’s licence</option>
                <option value="state_id">State ID card</option>
                <option value="passport">Passport</option>
                <option value="military_id">Military ID</option>
                <option value="other">Other government ID</option>
              </select>
            </div>
            <div className="sf-field"><label htmlFor="is">Issued by</label><input id="is" name="issuer" className="sf-input" placeholder="State or country" defaultValue={f.issuer} /></div>
          </div>
          <div className="sf-row2">
            <div className="sf-field"><label htmlFor="nu">ID number</label><input id="nu" name="number" className="sf-input" autoComplete="off" required /></div>
            <div className="sf-field"><label htmlFor="ex">Expires on</label><input id="ex" name="expiresOn" type="date" className="sf-input" required defaultValue={f.expiresOn} /></div>
          </div>
          <div className="sf-row2">
            <div className="sf-field"><label htmlFor="fr">Photo of the front</label><input id="fr" name="frontImage" type="file" accept="image/*" capture="environment" className="sf-input" /></div>
            <div className="sf-field"><label htmlFor="bk">Photo of the back (optional)</label><input id="bk" name="backImage" type="file" accept="image/*" capture="environment" className="sf-input" /></div>
          </div>
          <p className="sf-hint" style={{ margin: 0 }}>The number is stored encrypted and only the last four digits are ever shown. Staff check the card itself the first time you sell.</p>
          <Submit pending="Uploading…">Save my ID</Submit>
        </>
      )}
    </ActionForm>
  );
}

export function VehicleForm({ vehicle, next }: { vehicle?: VehicleView | null; next?: string }) {
  return (
    <ActionForm action={saveVehicleAction}>
      {(f) => (
        <>
          <input type="hidden" name="id" value={vehicle?.id || ''} />
          <input type="hidden" name="next" value={next || ''} />
          <div className="sf-row2">
            <div className="sf-field"><label htmlFor={`pl${vehicle?.id || ''}`}>Licence plate</label><input id={`pl${vehicle?.id || ''}`} name="plate" className="sf-input sf-mono" required autoCapitalize="characters" defaultValue={v(f, 'plate', vehicle?.plate)} /></div>
            <div className="sf-field"><label htmlFor={`pr${vehicle?.id || ''}`}>State</label><input id={`pr${vehicle?.id || ''}`} name="plateRegion" className="sf-input" defaultValue={v(f, 'plateRegion', vehicle?.plateRegion)} /></div>
          </div>
          <div className="sf-row3">
            <div className="sf-field"><label htmlFor={`mk${vehicle?.id || ''}`}>Make</label><input id={`mk${vehicle?.id || ''}`} name="make" className="sf-input" defaultValue={v(f, 'make', vehicle?.make)} /></div>
            <div className="sf-field"><label htmlFor={`md${vehicle?.id || ''}`}>Model</label><input id={`md${vehicle?.id || ''}`} name="model" className="sf-input" defaultValue={v(f, 'model', vehicle?.model)} /></div>
            <div className="sf-field"><label htmlFor={`co${vehicle?.id || ''}`}>Colour</label><input id={`co${vehicle?.id || ''}`} name="color" className="sf-input" defaultValue={v(f, 'color', vehicle?.color)} /></div>
          </div>
          <div className="sf-field">
            <label htmlFor={`kd${vehicle?.id || ''}`}>Kind</label>
            <select id={`kd${vehicle?.id || ''}`} name="kind" className="sf-select" defaultValue={v(f, 'kind', vehicle?.kind || 'pickup')}>
              <option value="car">Car</option><option value="pickup">Pickup truck</option><option value="box_truck">Box truck</option><option value="trailer">Trailer</option><option value="other">Other</option>
            </select>
          </div>
          <Submit pending="Saving…">{vehicle ? 'Save changes' : 'Add vehicle'}</Submit>
        </>
      )}
    </ActionForm>
  );
}

export function RemoveVehicleButton({ id }: { id: string }) {
  return (
    <ActionForm action={removeVehicleAction} className="">
      {() => (<><input type="hidden" name="id" value={id} /><Submit className="sf-btn sf-btn-ghost sf-btn-sm" pending="Removing…">Remove</Submit></>)}
    </ActionForm>
  );
}

export function CancelVisitButton({ id }: { id: string }) {
  return (
    <ActionForm action={cancelVisitAction} className="">
      {() => (<><input type="hidden" name="id" value={id} /><Submit className="sf-btn sf-btn-ghost sf-btn-sm" pending="Cancelling…">Cancel this visit</Submit></>)}
    </ActionForm>
  );
}
