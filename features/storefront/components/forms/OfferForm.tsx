'use client';

import { useState } from 'react';
import { offerAction } from '../../lib/actions';
import { ActionForm, Submit } from '../ActionForm';

type L = { id: string; unit: string; allowOffers: boolean; buyNow: boolean; askUnitPrice: string | null; minimumWeight: string | null; availableWeight: string };

/** B2: offer on a listing, or buy it outright at the asking price. */
export function OfferForm({ listing: l, accounts, idempotencyKey }: { listing: L; accounts: Array<{ id: string; name: string }>; idempotencyKey: string }) {
  const canBuy = l.buyNow && l.askUnitPrice !== null;
  const [mode, setMode] = useState<'offer' | 'buy'>(l.allowOffers ? 'offer' : 'buy');
  return (
    <ActionForm action={offerAction}>
      {(f) => (
        <>
          <input type="hidden" name="listingId" value={l.id} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <input type="hidden" name="mode" value={mode} />
          {l.allowOffers && canBuy ? (
            <div className="sf-yardswitch" role="group" aria-label="How">
              <button type="button" aria-pressed={mode === 'offer'} aria-current={mode === 'offer' ? 'true' : undefined} onClick={() => setMode('offer')}>Make an offer</button>
              <button type="button" aria-pressed={mode === 'buy'} aria-current={mode === 'buy' ? 'true' : undefined} onClick={() => setMode('buy')}>Buy now</button>
            </div>
          ) : null}
          {accounts.length > 1 ? (
            <div className="sf-field"><label htmlFor="of-a">Buying as</label><select id="of-a" name="accountId" className="sf-select" defaultValue={f.accountId || accounts[0].id}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
          ) : <input type="hidden" name="accountId" value={accounts[0].id} />}
          <div className="sf-field">
            <label htmlFor="of-w">Weight ({l.unit === 'kg' ? 'kg' : l.unit === 'ton' ? 'tons' : 'lb'})</label>
            <input id="of-w" name="weight" className="sf-input" inputMode="decimal" required defaultValue={f.weight || l.availableWeight} />
            <span className="sf-hint">{l.minimumWeight ? `At least ${Number(l.minimumWeight)}, ` : ''}up to {Number(l.availableWeight)}.</span>
          </div>
          {mode === 'offer' ? (
            <div className="sf-field"><label htmlFor="of-p">Your price per {l.unit}</label><input id="of-p" name="unitPrice" className="sf-input" inputMode="decimal" required defaultValue={f.unitPrice} /></div>
          ) : <p className="sf-small" style={{ margin: 0 }}>At the asking price of {l.askUnitPrice} per {l.unit}.</p>}
          <div className="sf-grid sf-grid-2">
            <div className="sf-field"><label htmlFor="of-f">Pick up from</label><input id="of-f" name="pickupFrom" type="date" className="sf-input" defaultValue={f.pickupFrom} /></div>
            <div className="sf-field"><label htmlFor="of-t">Pick up by</label><input id="of-t" name="pickupTo" type="date" className="sf-input" defaultValue={f.pickupTo} /></div>
          </div>
          <div className="sf-field"><label htmlFor="of-m">Message</label><textarea id="of-m" name="message" className="sf-input" rows={3} defaultValue={f.message} /></div>
          <Submit pending="Sending…">{mode === 'buy' ? 'Buy now' : 'Send offer'}</Submit>
        </>
      )}
    </ActionForm>
  );
}
