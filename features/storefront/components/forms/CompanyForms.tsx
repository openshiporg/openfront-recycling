'use client';

import { useState } from 'react';
import { acceptInviteAction, companyRequestAction, saveSiteAction } from '../../lib/actions';
import type { SiteView } from '../../lib/data/company';
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

/** C4: add or edit a service site. */
export function SiteForm({ accountId, slug, site }: { accountId: string; slug: string; site?: SiteView }) {
  const p = site ? `s${site.id}` : 'new';
  return (
    <ActionForm action={saveSiteAction}>
      {(f) => (
        <>
          <input type="hidden" name="accountId" value={accountId} />
          <input type="hidden" name="slug" value={slug} />
          {site ? <input type="hidden" name="siteId" value={site.id} /> : null}
          <Field id={`${p}-n`} label="Site name" hint="What your team calls it, for example “Plant 2 dock”."><input id={`${p}-n`} name="name" className="sf-input" required defaultValue={f.name ?? site?.name ?? ''} /></Field>
          <Field id={`${p}-a1`} label="Street address"><input id={`${p}-a1`} name="addressLine1" className="sf-input" required autoComplete="address-line1" defaultValue={f.addressLine1 ?? site?.addressLine1 ?? ''} /></Field>
          <div className="sf-grid sf-grid-3">
            <Field id={`${p}-c`} label="City"><input id={`${p}-c`} name="city" className="sf-input" required defaultValue={f.city ?? site?.city ?? ''} /></Field>
            <Field id={`${p}-r`} label="State"><input id={`${p}-r`} name="region" className="sf-input" defaultValue={f.region ?? site?.region ?? ''} /></Field>
            <Field id={`${p}-z`} label="ZIP code"><input id={`${p}-z`} name="postalCode" className="sf-input" defaultValue={f.postalCode ?? site?.postalCode ?? ''} /></Field>
          </div>
          <div className="sf-grid sf-grid-2">
            <Field id={`${p}-cn`} label="Contact on site"><input id={`${p}-cn`} name="contactName" className="sf-input" defaultValue={f.contactName ?? site?.contactName ?? ''} /></Field>
            <Field id={`${p}-cp`} label="Their phone"><input id={`${p}-cp`} name="contactPhone" type="tel" className="sf-input" defaultValue={f.contactPhone ?? site?.contactPhone ?? ''} /></Field>
          </div>
          <Field id={`${p}-an`} label="Access notes for the driver" hint="Gate code, hours, where the container goes."><textarea id={`${p}-an`} name="accessNotes" className="sf-input" rows={3} defaultValue={f.accessNotes ?? site?.accessNotes ?? ''} /></Field>
          {site ? <label className="sf-check"><input type="checkbox" name="isActive" defaultChecked={site.isActive} /> Site is active</label> : null}
          <Submit pending="Saving…">{site ? 'Save site' : 'Add site'}</Submit>
        </>
      )}
    </ActionForm>
  );
}

const KINDS: Array<[string, string, string]> = [
  ['deliver', 'Deliver a container', 'An empty container dropped at your site.'],
  ['swap', 'Swap a full container', 'We bring an empty one and take the full one.'],
  ['pickup', 'Haul and return', 'We empty it at the yard and bring it back.'],
  ['remove', 'Remove a container', 'We take it away for good.'],
  ['live_load', 'Live load', 'A truck waits while you load it.'],
];

/** C6: request a container service for one of the account's sites. */
export function ServiceRequestForm({ accountId, slug, yards, sites, containers, types, minDate, chargeToAccount, idempotencyKey }: {
  accountId: string; slug: string; yards: Array<{ id: string; name: string }>; sites: Array<{ id: string; name: string }>;
  containers: Array<{ id: string; label: string }>; types: Array<{ id: string; label: string }>; minDate: string; chargeToAccount: boolean; idempotencyKey: string;
}) {
  const [kind, setKind] = useState('deliver');
  const needType = kind === 'deliver' || kind === 'swap';
  const needContainer = ['pickup', 'remove', 'swap'].includes(kind);
  return (
    <ActionForm action={companyRequestAction}>
      {(f) => (
        <>
          <input type="hidden" name="accountId" value={accountId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <fieldset className="sf-field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 700, marginBottom: 6 }}>What do you need?</legend>
            <div className="sf-grid sf-grid-2" style={{ gap: 8 }}>
              {KINDS.map(([v, l, h]) => (
                <label key={v} className="sf-check sf-card sf-card-flat" style={{ alignItems: 'flex-start' }}>
                  <input type="radio" name="kind" value={v} checked={kind === v} onChange={() => setKind(v)} />
                  <span><strong>{l}</strong><br /><span className="sf-small sf-muted">{h}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="sf-grid sf-grid-2">
            <Field id="cr-s" label="Site"><select id="cr-s" name="siteId" className="sf-select" required defaultValue={f.siteId || sites[0]?.id}>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field id="cr-y" label="Yard"><select id="cr-y" name="yardId" className="sf-select" required defaultValue={f.yardId || yards[0]?.id}>{yards.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></Field>
          </div>
          {needType ? (
            <Field id="cr-t" label={kind === 'swap' ? 'Size of the empty container' : 'Container size'}>
              <select id="cr-t" name="containerTypeId" className="sf-select" required defaultValue={f.containerTypeId || ''}><option value="" disabled>Choose a size</option>{types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
            </Field>
          ) : null}
          {needContainer ? (
            containers.length ? (
              <Field id="cr-c" label="Container on site">
                <select id="cr-c" name="containerId" className="sf-select" required defaultValue={f.containerId || ''}><option value="" disabled>Choose a container</option>{containers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
              </Field>
            ) : <p className="sf-note sf-note-warn" style={{ margin: 0 }}>You have no containers on site to move. Request a delivery first.</p>
          ) : null}
          <div className="sf-grid sf-grid-2">
            <Field id="cr-d" label="Preferred day"><input id="cr-d" name="preferredDate" type="date" className="sf-input" min={minDate} defaultValue={f.preferredDate} /></Field>
            <Field id="cr-w" label="Time of day"><select id="cr-w" name="preferredWindow" className="sf-select" defaultValue={f.preferredWindow || 'any'}><option value="any">Any time</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option></select></Field>
          </div>
          <Field id="cr-i" label="What is in it" hint="Optional, helps the yard plan."><input id="cr-i" name="itemsDescription" className="sf-input" defaultValue={f.itemsDescription} /></Field>
          <Field id="cr-a" label="Notes for the driver"><textarea id="cr-a" name="accessNotes" className="sf-input" rows={3} defaultValue={f.accessNotes} /></Field>
          <p className="sf-small sf-muted" style={{ margin: 0 }}>{chargeToAccount ? 'Fees go on your account and show on your next statement.' : 'If there is a fee, you pay it by card before the truck is booked.'}</p>
          <Submit pending="Sending…" disabled={needContainer && !containers.length}>Send request</Submit>
        </>
      )}
    </ActionForm>
  );
}

/** Accept a company invitation: the token stays in the form, so nothing is accepted by opening the link alone. */
export function AcceptInviteForm({ token }: { token: string }) {
  return (
    <ActionForm action={acceptInviteAction}>
      {() => (
        <>
          <input type="hidden" name="token" value={token} />
          <Submit pending="Joining…">Join the company account</Submit>
        </>
      )}
    </ActionForm>
  );
}
