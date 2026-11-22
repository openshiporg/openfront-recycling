'use client';

import { trackAction } from '../../lib/actions';
import { ActionForm, Submit } from '../ActionForm';

export function TrackForm() {
  return (
    <ActionForm action={trackAction}>
      {(f) => (
        <>
          <div className="sf-field"><label htmlFor="tn">Ticket number</label><input id="tn" name="number" className="sf-input sf-mono" required autoComplete="off" defaultValue={f.number} /></div>
          <div className="sf-field"><label htmlFor="tc">Lookup code</label><input id="tc" name="code" className="sf-input sf-mono" required autoComplete="off" maxLength={16} defaultValue={f.code} /></div>
          <Submit pending="Looking…">Find my receipt</Submit>
        </>
      )}
    </ActionForm>
  );
}
