'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, UserPlus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice, Pill, StatusDot, Track, selectClass } from '@/features/platform/lib/ui';
import { createSellerAction, openTicketAction, searchAccountsAction, searchSellersAction } from '../actions';
import type { SellerHit } from '../types';
import { humanize } from '../utils/format';

type Visit = { code: string; sellerId: string | null; sellerName: string | null; plate: string | null };
type Party = { kind: 'seller'; id: string; name: string; status?: string } | { kind: 'account'; id: string; name: string } | null;

/**
 * New ticket: find or create the seller (or pick a commercial account), the vehicle, then open.
 * Screening for do-not-buy, age and ID runs on the server when the ticket opens.
 */
export function NewTicketDrawer({ yardId, yardName, visit }: { yardId: string; yardName: string; visit?: Visit }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<'inbound' | 'outbound'>('inbound');
  const [mode, setMode] = useState<'retail' | 'commercial'>('retail');
  const [party, setParty] = useState<Party>(visit?.sellerId ? { kind: 'seller', id: visit.sellerId, name: visit.sellerName || 'Seller' } : null);
  const [plate, setPlate] = useState(visit?.plate || '');
  const [region, setRegion] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const keyRef = useRef<string>('');

  const reset = () => { setError(null); keyRef.current = ''; };

  const submit = () => {
    setError(null);
    if (direction === 'inbound' && mode === 'retail' && !party && !visit) { setError('Find or add the seller first.'); return; }
    if (direction === 'inbound' && mode === 'commercial' && !party) { setError('Pick the account.'); return; }
    if (!keyRef.current) keyRef.current = `open:${crypto.randomUUID()}`;
    start(async () => {
      const r = await openTicketAction({
        yardId, direction,
        sellerId: party?.kind === 'seller' ? party.id : undefined,
        accountId: party?.kind === 'account' ? party.id : undefined,
        vehiclePlate: plate, vehiclePlateRegion: region, visitCode: visit?.code || undefined, notes,
        idempotencyKey: keyRef.current,
      });
      if (!r.ok) { setError(r.error); keyRef.current = ''; return; }
      setOpen(false);
      router.push(`/dashboard/platform/scale-house/${r.data.id}`);
    });
  };

  return (
    <>
      <Pill variant={visit ? 'raised' : 'primary'} size={visit ? 'sm' : 'md'} onClick={() => { reset(); setOpen(true); }}>
        <Plus />{visit ? 'Start ticket' : 'New ticket'}
      </Pill>
      <Sheet open={open} onOpenChange={(v) => { if (!pending) setOpen(v); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{visit ? `Start ticket for visit ${visit.code}` : 'New ticket'}</SheetTitle>
            <SheetDescription>{yardName}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 px-4 pb-6">
            {!visit ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label>Direction</Label>
                  <Track label="Direction">
                    <Pill variant="flat" aria-pressed={direction === 'inbound'} onClick={() => setDirection('inbound')}>Buying (inbound)</Pill>
                    <Pill variant="flat" aria-pressed={direction === 'outbound'} onClick={() => { setDirection('outbound'); setMode('commercial'); setParty(null); }}>Shipping (outbound)</Pill>
                  </Track>
                </div>
                {direction === 'inbound' ? (
                  <div className="flex flex-col gap-2">
                    <Label>From</Label>
                    <Track label="Seller type">
                      <Pill variant="flat" aria-pressed={mode === 'retail'} onClick={() => { setMode('retail'); setParty(null); }}>Retail seller</Pill>
                      <Pill variant="flat" aria-pressed={mode === 'commercial'} onClick={() => { setMode('commercial'); setParty(null); }}>Commercial account</Pill>
                    </Track>
                  </div>
                ) : null}
                {party ? (
                  <div className="flex items-center justify-between gap-2 rounded-[6px] border p-3 text-sm">
                    <span><StatusDot tone={party.kind === 'seller' && party.status === 'flagged' ? 'wait' : 'live'} />{party.name}{party.kind === 'seller' && party.status && party.status !== 'active' ? ` · ${humanize(party.status)}` : ''}</span>
                    <Pill size="sm" variant="flat" onClick={() => setParty(null)}>Change</Pill>
                  </div>
                ) : mode === 'retail' ? (
                  <SellerFinder onPick={(s) => { setParty({ kind: 'seller', id: s.id, name: s.name, status: s.status }); if (!plate && s.plates[0]) setPlate(s.plates[0].split(' ')[0]); }} />
                ) : (
                  <AccountFinder optional={direction === 'outbound'} onPick={(a) => setParty({ kind: 'account', id: a.id, name: a.name })} />
                )}
              </>
            ) : (
              <p className="text-sm">{visit.sellerName || 'Seller'} · visit {visit.code}</p>
            )}
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nt-plate">Vehicle plate</Label>
                <Input id="nt-plate" value={plate} onChange={(e) => setPlate(e.target.value)} autoComplete="off" className="uppercase" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nt-region">State</Label>
                <Input id="nt-region" value={region} onChange={(e) => setRegion(e.target.value)} maxLength={3} className="uppercase" placeholder="OH" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nt-notes">Notes</Label>
              <Input id="nt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {error ? <Notice tone="alert">{error}</Notice> : null}
            <Pill variant="primary" onClick={submit} disabled={pending}>{pending ? 'Opening…' : 'Open ticket'}</Pill>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SellerFinder({ onPick }: { onPick: (s: SellerHit) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SellerHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); setSearched(false); return; }
    const t = window.setTimeout(() => {
      start(async () => {
        const r = await searchSellersAction(q);
        if (!r.ok) { setError(r.error); return; }
        setError(null); setHits(r.sellers); setSearched(true);
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  if (adding) return <NewSellerForm initialName={q} onCancel={() => setAdding(false)} onCreated={(s) => onPick({ id: s.id, name: s.name, status: 'active', plates: s.plate ? [s.plate] : [] } as SellerHit)} />;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="nt-find">Find seller</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input id="nt-find" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, ID number, phone or plate" className="pl-8" autoComplete="off" />
      </div>
      {error ? <Notice tone="alert">{error}</Notice> : null}
      {hits.length ? (
        <ul className="flex max-h-72 flex-col divide-y overflow-y-auto rounded-[6px] border">
          {hits.map((s) => (
            <li key={s.id}>
              <button type="button" disabled={s.status === 'do_not_buy'} onClick={() => onPick(s)} className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium"><StatusDot tone={s.status === 'do_not_buy' ? 'alert' : s.status === 'flagged' ? 'wait' : 'live'} />{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.ticketCount} tickets</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[s.idKind ? `${humanize(s.idKind)} ••${s.idLast4}` : 'No ID on file', s.idVerification !== 'verified' ? humanize(s.idVerification) : null, s.phone, s.plates.join(', ')].filter(Boolean).join(' · ')}
                </p>
                {s.status === 'do_not_buy' ? <p className="text-xs text-red-700 dark:text-red-400">On the do-not-buy list. The yard cannot buy from this seller.</p> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : searched && !pending ? <p className="text-sm text-muted-foreground">No seller matches.</p> : null}
      <Pill variant="raised" size="sm" onClick={() => setAdding(true)} className="self-start"><UserPlus />New seller</Pill>
    </div>
  );
}

function NewSellerForm({ initialName, onCreated, onCancel }: { initialName: string; onCreated: (s: { id: string; name: string; plate?: string }) => void; onCancel: () => void }) {
  const [first, ...rest] = initialName.trim().split(/\s+/);
  const [f, setF] = useState({ firstName: /\d/.test(first || '') ? '' : first || '', lastName: rest.join(' '), phone: '', dateOfBirth: '', idKind: 'drivers_license', idNumber: '', idIssuer: '', idExpiresOn: '', plate: '', plateRegion: '' });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const save = () => start(async () => {
    const r = await createSellerAction(f);
    if (!r.ok) { setError(r.error); return; }
    onCreated({ ...r.data, plate: f.plate.toUpperCase() });
  });
  return (
    <div className="flex flex-col gap-3 rounded-[6px] border p-3">
      <p className="text-sm font-medium">New seller</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" id="ns-first"><Input id="ns-first" value={f.firstName} onChange={set('firstName')} /></Field>
        <Field label="Last name" id="ns-last"><Input id="ns-last" value={f.lastName} onChange={set('lastName')} /></Field>
        <Field label="Phone" id="ns-phone"><Input id="ns-phone" value={f.phone} onChange={set('phone')} inputMode="tel" /></Field>
        <Field label="Date of birth" id="ns-dob"><Input id="ns-dob" type="date" value={f.dateOfBirth} onChange={set('dateOfBirth')} /></Field>
        <Field label="ID type" id="ns-kind">
          <select id="ns-kind" className={selectClass} value={f.idKind} onChange={set('idKind')}>
            <option value="drivers_license">Driver’s license</option>
            <option value="state_id">State ID</option>
            <option value="passport">Passport</option>
            <option value="military_id">Military ID</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="ID number" id="ns-idn"><Input id="ns-idn" value={f.idNumber} onChange={set('idNumber')} autoComplete="off" /></Field>
        <Field label="Issued by" id="ns-iss"><Input id="ns-iss" value={f.idIssuer} onChange={set('idIssuer')} placeholder="OH" /></Field>
        <Field label="ID expires" id="ns-exp"><Input id="ns-exp" type="date" value={f.idExpiresOn} onChange={set('idExpiresOn')} /></Field>
        <Field label="Vehicle plate" id="ns-plate"><Input id="ns-plate" value={f.plate} onChange={set('plate')} className="uppercase" /></Field>
        <Field label="Plate state" id="ns-pr"><Input id="ns-pr" value={f.plateRegion} onChange={set('plateRegion')} className="uppercase" maxLength={3} /></Field>
      </div>
      {error ? <Notice tone="alert">{error}</Notice> : null}
      <Track>
        <Pill variant="primary" size="sm" onClick={save} disabled={pending}>{pending ? 'Saving…' : 'Save seller'}</Pill>
        <Pill variant="flat" size="sm" onClick={onCancel} disabled={pending}>Back to search</Pill>
      </Track>
    </div>
  );
}

function AccountFinder({ onPick, optional }: { onPick: (a: { id: string; name: string }) => void; optional?: boolean }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Array<{ id: string; name: string; accountNumber: string | null; status: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = window.setTimeout(() => start(async () => {
      const r = await searchAccountsAction(q);
      if (!r.ok) { setError(r.error); return; }
      setError(null); setHits(r.accounts);
    }), 250);
    return () => window.clearTimeout(t);
  }, [q]);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="nt-acct">Account{optional ? ' (optional)' : ''}</Label>
      <Input id="nt-acct" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Account name or number" autoComplete="off" />
      {error ? <Notice tone="alert">{error}</Notice> : null}
      {hits.length ? (
        <ul className="flex flex-col divide-y rounded-[6px] border">
          {hits.map((a) => (
            <li key={a.id}>
              <button type="button" disabled={a.status !== 'active'} onClick={() => onPick(a)} className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:opacity-60">
                <span className="font-medium">{a.name}</span> <span className="text-xs text-muted-foreground">{a.accountNumber}{a.status !== 'active' ? ` · ${a.status}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
