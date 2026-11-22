'use client';

import { campaignAction, endCampaignAction, fileClaimAction, nonprofitProfileAction, respondOfferAction, withdrawClaimAction } from '../../lib/actions';
import type { CampaignView } from '../../lib/data/buyer';
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

/** B3: accept or decline a counter, or withdraw an offer. The server's can* flags decide which buttons show. */
export function OfferButtons({ id, canAcceptCounter, canWithdraw, idempotencyKey }: { id: string; canAcceptCounter: boolean; canWithdraw: boolean; idempotencyKey: string }) {
  return (
    <ActionForm action={respondOfferAction} className="sf-cluster">
      {() => (
        <>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          {canAcceptCounter ? (
            <>
              <button className="sf-btn sf-btn-sm" type="submit" name="response" value="accept">Accept the counter</button>
              <button className="sf-btn sf-btn-sm sf-btn-ghost" type="submit" name="response" value="decline">Decline</button>
            </>
          ) : null}
          {canWithdraw ? <button className="sf-btn sf-btn-sm sf-btn-ghost" type="submit" name="response" value="withdraw">Withdraw offer</button> : null}
        </>
      )}
    </ActionForm>
  );
}

/** B7: raise a claim on a delivered shipment. */
export function ClaimForm({ slug, orderId, shipmentId, currencyCode, idempotencyKey }: { slug: string; orderId: string; shipmentId: string; currencyCode: string; idempotencyKey: string }) {
  const p = `cl-${shipmentId}`;
  return (
    <ActionForm action={fileClaimAction}>
      {(f) => (
        <>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="shipmentId" value={shipmentId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <Field id={`${p}-k`} label="What went wrong">
            <select id={`${p}-k`} name="kind" className="sf-select" required defaultValue={f.kind || ''}>
              <option value="" disabled>Choose one</option>
              <option value="short_weight">Short weight</option>
              <option value="contamination">Contamination</option>
              <option value="wrong_grade">Wrong grade</option>
              <option value="damage">Damage</option>
              <option value="other">Something else</option>
            </select>
          </Field>
          <Field id={`${p}-d`} label="What you found" hint="Your received weight, scale ticket number, what was in the load.">
            <textarea id={`${p}-d`} name="description" className="sf-input" rows={3} required minLength={10} defaultValue={f.description} />
          </Field>
          <Field id={`${p}-a`} label={`Amount claimed (${currencyCode})`}>
            <input id={`${p}-a`} name="amount" className="sf-input" inputMode="decimal" required defaultValue={f.amount} />
          </Field>
          <Submit pending="Sending…">Send claim</Submit>
        </>
      )}
    </ActionForm>
  );
}

export function WithdrawClaimButton({ id }: { id: string }) {
  return (
    <ActionForm action={withdrawClaimAction} className="">
      {() => (<><input type="hidden" name="id" value={id} /><Submit className="sf-btn sf-btn-sm sf-btn-ghost" pending="Withdrawing…">Withdraw claim</Submit></>)}
    </ActionForm>
  );
}

/** N1: what sellers see about the cause. */
export function NonprofitProfileForm({ accountId, summary, website, isPublic }: { accountId: string; summary: string | null; website: string | null; isPublic: boolean }) {
  return (
    <ActionForm action={nonprofitProfileAction}>
      {(f) => (
        <>
          <input type="hidden" name="accountId" value={accountId} />
          <Field id="np-s" label="About your cause" hint="Sellers read this when they choose where to give.">
            <textarea id="np-s" name="summary" className="sf-input" rows={4} defaultValue={f.summary ?? summary ?? ''} />
          </Field>
          <Field id="np-w" label="Website" hint="Starts with https://">
            <input id="np-w" name="website" type="url" className="sf-input" placeholder="https://" defaultValue={f.website ?? website ?? ''} />
          </Field>
          <label className="sf-check"><input type="checkbox" name="isPublic" defaultChecked={f.isPublic !== undefined ? f.isPublic === 'on' : isPublic} /> Show us on the Donate page and at check-in</label>
          <Submit pending="Saving…">Save profile</Submit>
        </>
      )}
    </ActionForm>
  );
}

/** N2: start or edit a campaign. */
export function CampaignForm({ accountId, slug, campaign }: { accountId: string; slug: string; campaign?: CampaignView }) {
  const p = campaign ? `cp-${campaign.id}` : 'cp-new';
  const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : '');
  return (
    <ActionForm action={campaignAction}>
      {(f) => (
        <>
          <input type="hidden" name="accountId" value={accountId} />
          <input type="hidden" name="slug" value={slug} />
          {campaign ? <input type="hidden" name="campaignId" value={campaign.id} /> : null}
          <Field id={`${p}-n`} label="Campaign name"><input id={`${p}-n`} name="name" className="sf-input" required minLength={3} defaultValue={f.name ?? campaign?.name ?? ''} /></Field>
          <Field id={`${p}-d`} label="What it pays for"><textarea id={`${p}-d`} name="description" className="sf-input" rows={3} defaultValue={f.description ?? campaign?.description ?? ''} /></Field>
          <div className="sf-grid sf-grid-2">
            <Field id={`${p}-g`} label="Money goal (optional)"><input id={`${p}-g`} name="goal" className="sf-input" inputMode="decimal" defaultValue={f.goal ?? (campaign?.goalCents ? String(campaign.goalCents / 100) : '')} /></Field>
            <Field id={`${p}-w`} label="Weight goal (optional)"><input id={`${p}-w`} name="goalWeight" className="sf-input" inputMode="decimal" defaultValue={f.goalWeight ?? campaign?.goalWeight ?? ''} /></Field>
          </div>
          <div className="sf-grid sf-grid-2">
            <Field id={`${p}-s`} label="Starts"><input id={`${p}-s`} name="startsOn" type="date" className="sf-input" defaultValue={f.startsOn ?? day(campaign?.startsOn)} /></Field>
            <Field id={`${p}-e`} label="Ends"><input id={`${p}-e`} name="endsOn" type="date" className="sf-input" defaultValue={f.endsOn ?? day(campaign?.endsOn)} /></Field>
          </div>
          <Field id={`${p}-st`} label="Status">
            <select id={`${p}-st`} name="status" className="sf-select" defaultValue={f.status || campaign?.status || 'active'}>
              <option value="active">Running</option>
              <option value="draft">Draft, not shown yet</option>
            </select>
          </Field>
          <label className="sf-check"><input type="checkbox" name="isPublic" defaultChecked={f.isPublic !== undefined ? f.isPublic === 'on' : campaign?.isPublic ?? true} /> Show this campaign to sellers</label>
          <Submit pending="Saving…">{campaign ? 'Save campaign' : 'Start campaign'}</Submit>
        </>
      )}
    </ActionForm>
  );
}

export function EndCampaignButton({ id }: { id: string }) {
  return (
    <ActionForm action={endCampaignAction} className="">
      {() => (<><input type="hidden" name="id" value={id} /><Submit className="sf-btn sf-btn-sm sf-btn-ghost" pending="Ending…">End campaign</Submit></>)}
    </ActionForm>
  );
}
