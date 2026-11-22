'use client';

import { acceptQuoteAction, applyAction, cancelRequestAction, payByCardAction, requestPickupAction, withdrawApplicationAction } from '../../lib/actions';
import { ActionForm, Submit } from '../ActionForm';

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="sf-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <span className="sf-hint">{hint}</span> : null}
    </div>
  );
}

/** P12, P13, nonprofit partner application. */
export function ApplyForm({ kind, email, categories, idempotencyKey }: { kind: 'supplier' | 'buyer' | 'nonprofit'; email: string; categories: string[]; idempotencyKey: string }) {
  return (
    <ActionForm action={applyAction}>
      {(f) => (
        <>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <div className="sf-grid sf-grid-2">
            <Field id="bn" label={kind === 'nonprofit' ? 'Organisation name' : 'Business name'}><input id="bn" name="businessName" className="sf-input" required autoComplete="organization" defaultValue={f.businessName} /></Field>
            <Field id="ln" label="Legal name" hint="If different"><input id="ln" name="legalName" className="sf-input" defaultValue={f.legalName} /></Field>
          </div>
          <Field id="tx" label={kind === 'nonprofit' ? 'EIN' : 'Tax ID (EIN)'} hint={kind === 'nonprofit' ? 'Needed to issue donation receipts.' : 'Optional now; needed before we pay on account.'}>
            <input id="tx" name="taxId" className="sf-input" required={kind === 'nonprofit'} inputMode="numeric" defaultValue={f.taxId} />
          </Field>
          <Field id="a1" label="Street address"><input id="a1" name="addressLine1" className="sf-input" autoComplete="address-line1" defaultValue={f.addressLine1} /></Field>
          <div className="sf-grid sf-grid-3">
            <Field id="ci" label="City"><input id="ci" name="city" className="sf-input" autoComplete="address-level2" defaultValue={f.city} /></Field>
            <Field id="rg" label="State"><input id="rg" name="region" className="sf-input" autoComplete="address-level1" defaultValue={f.region} /></Field>
            <Field id="pc" label="ZIP code"><input id="pc" name="postalCode" className="sf-input" autoComplete="postal-code" defaultValue={f.postalCode} /></Field>
          </div>
          <div className="sf-grid sf-grid-2">
            <Field id="ph" label="Phone"><input id="ph" name="phone" type="tel" className="sf-input" autoComplete="tel" defaultValue={f.phone} /></Field>
            <Field id="em" label="Email for the decision"><input id="em" name="email" type="email" className="sf-input" autoComplete="email" defaultValue={f.email ?? email} /></Field>
          </div>
          {kind !== 'nonprofit' ? (
            <>
              <Field id="mt" label={kind === 'buyer' ? 'Materials you buy' : 'Materials you produce'} hint={categories.length ? `For example: ${categories.slice(0, 3).join(', ')}` : 'Separate with commas'}>
                <input id="mt" name="materials" className="sf-input" defaultValue={f.materials} />
              </Field>
              <Field id="mv" label={kind === 'buyer' ? 'About how much a month' : 'About how much a month'} hint="Rough is fine, for example “20 tons”."><input id="mv" name="monthlyVolume" className="sf-input" defaultValue={f.monthlyVolume} /></Field>
            </>
          ) : null}
          {kind === 'supplier' ? <Field id="cn" label="Containers you need" hint="Sizes and how many, or leave empty."><input id="cn" name="containerNeeds" className="sf-input" defaultValue={f.containerNeeds} /></Field> : null}
          <Field id="ms" label="Anything else we should know"><textarea id="ms" name="message" className="sf-input" rows={4} defaultValue={f.message} /></Field>
          <Submit pending="Sending…">Send application</Submit>
        </>
      )}
    </ActionForm>
  );
}

/** P16 */
export function PickupForm({ yards, materials, minDate, idempotencyKey }: { yards: Array<{ id: string; name: string }>; materials: Array<{ id: string; name: string }>; minDate: string; idempotencyKey: string }) {
  return (
    <ActionForm action={requestPickupAction}>
      {(f) => (
        <>
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          {yards.length > 1 ? (
            <Field id="yd" label="Nearest yard"><select id="yd" name="yardId" className="sf-select" required defaultValue={f.yardId || yards[0].id}>{yards.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></Field>
          ) : <input type="hidden" name="yardId" value={yards[0]?.id || ''} />}
          <Field id="it" label="What should we pick up?" hint="Item, how many, and anything heavy or hazardous, for example “two fridges, one with the door off”.">
            <textarea id="it" name="itemsDescription" className="sf-input" rows={3} required defaultValue={f.itemsDescription} />
          </Field>
          {materials.length ? (
            <Field id="mt" label="Closest material" hint="Optional"><select id="mt" name="materialId" className="sf-select" defaultValue={f.materialId || ''}><option value="">Not sure</option>{materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
          ) : null}
          <Field id="a1" label="Pickup address"><input id="a1" name="addressLine1" className="sf-input" required autoComplete="address-line1" defaultValue={f.addressLine1} /></Field>
          <div className="sf-grid sf-grid-3">
            <Field id="ci" label="City"><input id="ci" name="city" className="sf-input" required autoComplete="address-level2" defaultValue={f.city} /></Field>
            <Field id="rg" label="State"><input id="rg" name="region" className="sf-input" autoComplete="address-level1" defaultValue={f.region} /></Field>
            <Field id="pc" label="ZIP code"><input id="pc" name="postalCode" className="sf-input" autoComplete="postal-code" defaultValue={f.postalCode} /></Field>
          </div>
          <div className="sf-grid sf-grid-2">
            <Field id="cn" label="Contact on the day"><input id="cn" name="contactName" className="sf-input" autoComplete="name" defaultValue={f.contactName} /></Field>
            <Field id="cp" label="Their phone"><input id="cp" name="contactPhone" type="tel" className="sf-input" autoComplete="tel" defaultValue={f.contactPhone} /></Field>
          </div>
          <div className="sf-grid sf-grid-2">
            <Field id="dt" label="Preferred day"><input id="dt" name="preferredDate" type="date" className="sf-input" min={minDate} defaultValue={f.preferredDate} /></Field>
            <Field id="wn" label="Time of day"><select id="wn" name="preferredWindow" className="sf-select" defaultValue={f.preferredWindow || 'any'}><option value="any">Any time</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option></select></Field>
          </div>
          <Field id="ac" label="Access notes" hint="Gate codes, stairs, where the items are."><textarea id="ac" name="accessNotes" className="sf-input" rows={2} defaultValue={f.accessNotes} /></Field>
          <Submit pending="Sending…">Ask for a pickup</Submit>
        </>
      )}
    </ActionForm>
  );
}

function OneButton({ action, id, label, pending, ghost, extra }: { action: Parameters<typeof ActionForm>[0]['action']; id: string; label: string; pending: string; ghost?: boolean; extra?: Record<string, string> }) {
  return (
    <ActionForm action={action} className="">
      {() => (
        <>
          <input type="hidden" name="id" value={id} />
          {Object.entries(extra || {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <Submit className={`sf-btn sf-btn-sm${ghost ? ' sf-btn-ghost' : ''}`} pending={pending}>{label}</Submit>
        </>
      )}
    </ActionForm>
  );
}

export const WithdrawApplicationButton = ({ id }: { id: string }) => <OneButton action={withdrawApplicationAction} id={id} label="Withdraw" pending="Withdrawing…" ghost />;
export const AcceptQuoteButton = ({ id }: { id: string }) => <OneButton action={acceptQuoteAction} id={id} label="Accept the quote" pending="Accepting…" />;
export const CancelRequestButton = ({ id }: { id: string }) => <OneButton action={cancelRequestAction} id={id} label="Cancel request" pending="Cancelling…" ghost />;
export function PayByCardButton({ kind, id, label, returnPath, idempotencyKey }: { kind: 'request' | 'invoice'; id: string; label: string; returnPath: string; idempotencyKey: string }) {
  return <OneButton action={payByCardAction} id={id} label={label} pending="Opening secure checkout…" extra={{ kind, returnPath, idempotencyKey }} />;
}
