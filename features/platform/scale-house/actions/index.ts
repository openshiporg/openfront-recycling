'use server';

import { revalidatePath } from 'next/cache';
import { platformRequest, platformUpload, trimmed, formImage } from '@/features/platform/lib/platformRequest';
import type { ActionResult, Board, SellerHit, TicketDetail, YardChoice, ScaleChoice, MaterialChoice } from '../types';

const BOARD_PATH = '/dashboard/platform/scale-house';
const ticketPath = (id: string) => `${BOARD_PATH}/${id}`;
const key = (value: unknown) => trimmed(value, 200) || undefined;
const str = (value: unknown) => { const t = trimmed(value, 200); return t === '' ? undefined : t; };

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

/** Yards the signed-in staff member works at (all yards for a settings manager). */
export async function getStaffContext() {
  const r = await platformRequest<{ authenticatedItem: any; yards: YardChoice[] }>(`
    query ScaleHouseContext {
      authenticatedItem { ... on User { id name role { canManageTickets canGradeTickets canPaySellers canVoidTickets canApproveVariances canOverridePrices canManageSettings canManageSellers } yards(orderBy: [{ name: asc }]) { id name code timezone } } }
      yards(where: { status: { equals: "active" } }, orderBy: [{ name: asc }]) { id name code timezone }
    }`);
  if (!r.ok) return { ok: false as const, error: r.error };
  const user = r.data.authenticatedItem;
  if (!user) return { ok: false as const, error: 'Sign in to use the scale house.' };
  const role = user.role || {};
  const yards: YardChoice[] = role.canManageSettings ? r.data.yards : user.yards || [];
  return { ok: true as const, user: { id: user.id as string, name: user.name as string }, role: role as Record<string, boolean>, yards };
}

export async function getBoard(yardId: string) {
  const r = await platformRequest<{ scaleHouseBoard: Board }>(`
    query ScaleHouseBoard($yardId: ID!) {
      scaleHouseBoard(yardId: $yardId) {
        yardId yardName generatedAt
        checkedIn { visitId code status sellerId sellerName plannedDate vehiclePlate expectedItems }
        weighing { ticketId number direction sellerId sellerName accountId accountName vehiclePlate lineCount totalCents payWeight openedAt minutesOpen missing { code message lineId overridable } }
        readyToComplete { ticketId number direction sellerId sellerName accountId accountName vehiclePlate lineCount totalCents payWeight openedAt minutesOpen missing { code message lineId overridable } }
        readyToPay { payoutId ticketId number sellerName accountName amountCents status releaseAt allowedMethods completedAt }
      }
    }`, { yardId });
  return r.ok ? { ok: true as const, board: r.data.scaleHouseBoard } : { ok: false as const, error: r.error };
}

export async function searchSellersAction(q: string): Promise<{ ok: true; sellers: SellerHit[] } | { ok: false; error: string }> {
  const query = trimmed(q, 80);
  if (query.length < 2) return { ok: true, sellers: [] };
  const r = await platformRequest<{ searchSellers: SellerHit[] }>(`
    query SearchSellers($q: String!) { searchSellers(q: $q, limit: 12) { id name phone city status idVerification matchedOn idKind idLast4 idExpiresOn plates lastTicketAt ticketCount } }`, { q: query });
  return r.ok ? { ok: true, sellers: r.data.searchSellers } : { ok: false, error: r.error };
}

export async function searchAccountsAction(q: string) {
  const query = trimmed(q, 80);
  if (query.length < 2) return { ok: true as const, accounts: [] as Array<{ id: string; name: string; accountNumber: string | null; status: string }> };
  const r = await platformRequest<{ accounts: Array<{ id: string; name: string; accountNumber: string | null; status: string }> }>(`
    query SearchAccounts($q: String!) { accounts(where: { isSupplier: { equals: true }, OR: [{ name: { contains: $q, mode: insensitive } }, { accountNumber: { contains: $q, mode: insensitive } }] }, take: 10, orderBy: [{ name: asc }]) { id name accountNumber status } }`, { q: query });
  return r.ok ? { ok: true as const, accounts: r.data.accounts } : { ok: false as const, error: r.error };
}

const TICKET_FIELDS = `
  id displayNumber direction status paymentMode isAdjustment vehiclePlate vehiclePlateRegion vehicleDescription notes overrideReason
  materialTotalCents feeTotalCents taxCents totalCents donatePercent completedAt voidedAt voidReason createdAt fees
  yard { id name code timezone }
  seller { id firstName lastName status idVerification phone }
  account { id name accountNumber }
  vehicle { id plate plateRegion }
  openedBy { name }
  completedBy { name }
  lines(orderBy: [{ sortOrder: asc }]) {
    id sortOrder materialName direction grossWeight tareWeight netWeight deductionWeight deductionPercent deductionReason payWeight quantity unit unitPrice priceSource overrideReason amountCents
    material { id name code defaultUnit }
  }
  weighEvents(orderBy: [{ capturedAt: asc }]) { id kind weight captureMethod capturedAt scale { name } line { id } }
  attachments(orderBy: [{ capturedAt: asc }]) { id kind signedName capturedAt line { id } image { url width height } }
  payouts { id amountCents status method releaseAt allowedMethods paidAt }
`;

export async function getTicket(ticketId: string) {
  const r = await platformRequest<{ scaleTicket: TicketDetail | null; ticketComplianceChecklist: TicketDetail['checklist'] | null }>(`
    query ScaleTicketDetail($id: ID!) {
      scaleTicket(where: { id: $id }) { ${TICKET_FIELDS} }
      ticketComplianceChecklist(ticketId: $id) { code message lineId overridable }
    }`, { id: ticketId });
  if (!r.ok) return { ok: false as const, error: r.error };
  if (!r.data.scaleTicket) return { ok: false as const, error: 'Ticket not found.' };
  return { ok: true as const, ticket: { ...r.data.scaleTicket, checklist: r.data.ticketComplianceChecklist || [] } };
}

export async function getWeighChoices(yardId: string) {
  const r = await platformRequest<{ scales: ScaleChoice[]; materials: MaterialChoice[] }>(`
    query WeighChoices($yardId: ID!) {
      scales(where: { yard: { id: { equals: $yardId } }, isActive: { equals: true } }, orderBy: [{ name: asc }]) { id name kind lastReadingWeight lastReadingAt lastReadingStable }
      materials(where: { isActive: { equals: true } }, orderBy: [{ sortOrder: asc }, { name: asc }], take: 500) { id name code defaultUnit direction category { name } }
    }`, { yardId });
  return r.ok ? { ok: true as const, ...r.data } : { ok: false as const, error: r.error, scales: [], materials: [] };
}

/** The latest reading of one scale, for the "read scale" button. */
export async function readScaleAction(scaleId: string) {
  const r = await platformRequest<{ scale: ScaleChoice | null }>(`query ReadScale($id: ID!) { scale(where: { id: $id }) { id name kind lastReadingWeight lastReadingAt lastReadingStable } }`, { id: scaleId });
  if (!r.ok) return { ok: false as const, error: r.error };
  return { ok: true as const, scale: r.data.scale };
}

// ---------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------

function done<T>(r: { ok: true; data: T } | { ok: false; error: string }, paths: string[]): ActionResult<T> {
  if (!r.ok) return { ok: false, error: r.error };
  paths.forEach((p) => revalidatePath(p));
  return { ok: true, data: r.data };
}

export async function createSellerAction(input: { firstName: string; lastName: string; phone?: string; dateOfBirth?: string; idKind?: string; idNumber?: string; idIssuer?: string; idExpiresOn?: string; plate?: string; plateRegion?: string }): Promise<ActionResult<{ id: string; name: string }>> {
  const firstName = trimmed(input.firstName, 80);
  const lastName = trimmed(input.lastName, 80);
  if (!firstName || !lastName) return { ok: false, error: 'Enter the seller’s first and last name.' };
  const data: Record<string, unknown> = { firstName, lastName };
  if (str(input.phone)) data.phone = str(input.phone);
  if (str(input.dateOfBirth)) data.dateOfBirth = new Date(`${input.dateOfBirth}T12:00:00Z`).toISOString();
  if (str(input.idNumber)) {
    data.identityDocuments = { create: [{ kind: str(input.idKind) || 'drivers_license', number: str(input.idNumber), issuer: str(input.idIssuer), ...(str(input.idExpiresOn) ? { expiresOn: new Date(`${input.idExpiresOn}T12:00:00Z`).toISOString() } : {}) }] };
  }
  if (str(input.plate)) data.vehicles = { create: [{ plate: str(input.plate)!.toUpperCase(), plateRegion: str(input.plateRegion)?.toUpperCase() }] };
  const r = await platformRequest<{ createSeller: { id: string; firstName: string; lastName: string } }>(`mutation CreateSeller($data: SellerCreateInput!) { createSeller(data: $data) { id firstName lastName } }`, { data });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: { id: r.data.createSeller.id, name: `${r.data.createSeller.firstName} ${r.data.createSeller.lastName}` } };
}

export async function openTicketAction(input: { yardId: string; direction?: string; sellerId?: string; accountId?: string; vehiclePlate?: string; vehiclePlateRegion?: string; visitCode?: string; paymentMode?: string; notes?: string; overrideReason?: string; idempotencyKey: string }): Promise<ActionResult<{ id: string }>> {
  const data: Record<string, unknown> = { yardId: input.yardId };
  for (const k of ['direction', 'sellerId', 'accountId', 'vehiclePlate', 'vehiclePlateRegion', 'visitCode', 'paymentMode', 'notes', 'overrideReason'] as const) {
    const v = str(input[k]);
    if (v) data[k] = k === 'vehiclePlate' || k === 'vehiclePlateRegion' ? v.toUpperCase() : v;
  }
  const r = await platformRequest<{ openTicket: { id: string } }>(`mutation OpenTicket($data: OpenTicketInput!, $key: String) { openTicket(data: $data, idempotencyKey: $key) { id } }`, { data, key: key(input.idempotencyKey) });
  const out = done(r, [BOARD_PATH]);
  return out.ok ? { ok: true, data: { id: r.ok ? r.data.openTicket.id : '' } } : out;
}

export async function addLineAction(input: { ticketId: string; materialId: string; grossWeight?: string; tareWeight?: string; quantity?: string; deductionWeight?: string; deductionPercent?: string; deductionReason?: string; unitPrice?: string; overrideReason?: string; scaleId?: string; grossFromScale?: boolean; tareFromScale?: boolean; idempotencyKey: string }): Promise<ActionResult<unknown>> {
  if (!input.materialId) return { ok: false, error: 'Pick the material.' };
  const data: Record<string, unknown> = { ticketId: input.ticketId, materialId: input.materialId };
  for (const k of ['grossWeight', 'tareWeight', 'deductionWeight', 'deductionPercent', 'deductionReason', 'unitPrice', 'overrideReason', 'scaleId'] as const) {
    const v = str(input[k]);
    if (v) data[k] = v;
  }
  if (str(input.quantity)) data.quantity = Math.trunc(Number(input.quantity));
  if (input.grossFromScale) { data.grossFromScale = true; delete data.grossWeight; }
  if (input.tareFromScale) { data.tareFromScale = true; delete data.tareWeight; }
  const r = await platformRequest(`mutation AddTicketLine($data: TicketLineInput!, $key: String) { addTicketLine(data: $data, idempotencyKey: $key) { id } }`, { data, key: key(input.idempotencyKey) });
  return done(r, [ticketPath(input.ticketId), BOARD_PATH]);
}

export async function truckWeightAction(input: { ticketId: string; weight?: string; scaleId?: string; fromScale?: boolean; materialId?: string; deductionWeight?: string; deductionPercent?: string; deductionReason?: string; idempotencyKey: string }): Promise<ActionResult<unknown>> {
  const data: Record<string, unknown> = { ticketId: input.ticketId };
  for (const k of ['weight', 'scaleId', 'materialId', 'deductionWeight', 'deductionPercent', 'deductionReason'] as const) {
    const v = str(input[k]);
    if (v) data[k] = v;
  }
  if (input.fromScale) { data.fromScale = true; delete data.weight; }
  const r = await platformRequest(`mutation RecordTruckWeight($data: TruckWeightInput!, $key: String) { recordTruckWeight(data: $data, idempotencyKey: $key) { weighEventId line { id } } }`, { data, key: key(input.idempotencyKey) });
  return done(r, [ticketPath(input.ticketId), BOARD_PATH]);
}

export async function gradeLineAction(input: { ticketId: string; lineId: string; materialId?: string; deductionWeight?: string; deductionPercent?: string; deductionReason?: string; unitPrice?: string; overrideReason?: string; quantity?: string; idempotencyKey: string }): Promise<ActionResult<unknown>> {
  const data: Record<string, unknown> = { lineId: input.lineId };
  for (const k of ['materialId', 'deductionReason', 'unitPrice', 'overrideReason'] as const) {
    const v = str(input[k]);
    if (v) data[k] = v;
  }
  // An emptied deduction clears it; an untouched one is left out.
  if (input.deductionWeight !== undefined) data.deductionWeight = str(input.deductionWeight) ?? null;
  if (input.deductionPercent !== undefined) data.deductionPercent = str(input.deductionPercent) ?? null;
  if (str(input.quantity)) data.quantity = Math.trunc(Number(input.quantity));
  const r = await platformRequest(`mutation GradeTicketLine($data: GradeTicketLineInput!, $key: String) { gradeTicketLine(data: $data, idempotencyKey: $key) { id } }`, { data, key: key(input.idempotencyKey) });
  return done(r, [ticketPath(input.ticketId), BOARD_PATH]);
}

export async function splitLineAction(input: { ticketId: string; lineId: string; weight: string; materialId: string; idempotencyKey: string }): Promise<ActionResult<unknown>> {
  if (!str(input.weight) || !input.materialId) return { ok: false, error: 'Enter the weight to split off and its material.' };
  const r = await platformRequest(`mutation SplitTicketLine($lineId: ID!, $weight: String!, $materialId: ID!, $key: String) { splitTicketLine(lineId: $lineId, weight: $weight, materialId: $materialId, idempotencyKey: $key) { id } }`, { lineId: input.lineId, weight: str(input.weight), materialId: input.materialId, key: key(input.idempotencyKey) });
  return done(r, [ticketPath(input.ticketId)]);
}

export async function removeLineAction(input: { ticketId: string; lineId: string; reason?: string; idempotencyKey: string }): Promise<ActionResult<unknown>> {
  const r = await platformRequest(`mutation RemoveTicketLine($lineId: ID!, $reason: String, $key: String) { removeTicketLine(lineId: $lineId, reason: $reason, idempotencyKey: $key) { id } }`, { lineId: input.lineId, reason: str(input.reason), key: key(input.idempotencyKey) });
  return done(r, [ticketPath(input.ticketId), BOARD_PATH]);
}

export async function updateDetailsAction(input: { ticketId: string; vehiclePlate?: string; vehiclePlateRegion?: string; vehicleDescription?: string; paymentMode?: string; notes?: string; idempotencyKey: string }): Promise<ActionResult<unknown>> {
  const data: Record<string, unknown> = { ticketId: input.ticketId };
  for (const k of ['vehiclePlate', 'vehiclePlateRegion', 'vehicleDescription', 'paymentMode', 'notes'] as const) {
    if (input[k] !== undefined) data[k] = k === 'vehiclePlate' || k === 'vehiclePlateRegion' ? trimmed(input[k]).toUpperCase() : trimmed(input[k], 2000);
  }
  const r = await platformRequest(`mutation UpdateTicketDetails($data: TicketDetailsInput!, $key: String) { updateTicketDetails(data: $data, idempotencyKey: $key) { id } }`, { data, key: key(input.idempotencyKey) });
  return done(r, [ticketPath(input.ticketId), BOARD_PATH]);
}

export async function completeTicketAction(input: { ticketId: string; overrideReason?: string; idempotencyKey: string }): Promise<ActionResult<unknown>> {
  const r = await platformRequest(`mutation CompleteTicket($id: ID!, $reason: String, $key: String) { completeTicket(ticketId: $id, overrideReason: $reason, idempotencyKey: $key) { id status } }`, { id: input.ticketId, reason: str(input.overrideReason), key: key(input.idempotencyKey) });
  return done(r, [ticketPath(input.ticketId), BOARD_PATH]);
}

export async function voidTicketAction(input: { ticketId: string; reason: string; idempotencyKey: string }): Promise<ActionResult<unknown>> {
  if (trimmed(input.reason).length < 3) return { ok: false, error: 'Give a reason for voiding the ticket.' };
  const r = await platformRequest(`mutation VoidTicket($id: ID!, $reason: String!, $key: String) { voidTicket(ticketId: $id, reason: $reason, idempotencyKey: $key) { id status } }`, { id: input.ticketId, reason: trimmed(input.reason), key: key(input.idempotencyKey) });
  return done(r, [ticketPath(input.ticketId), BOARD_PATH]);
}

export async function adjustmentTicketAction(input: { ticketId: string; reason: string; idempotencyKey: string }): Promise<ActionResult<{ id: string }>> {
  if (trimmed(input.reason).length < 3) return { ok: false, error: 'Give a reason for the adjustment.' };
  const r = await platformRequest<{ createAdjustmentTicket: { id: string } }>(`mutation AdjustTicket($id: ID!, $reason: String!, $key: String) { createAdjustmentTicket(ticketId: $id, reason: $reason, idempotencyKey: $key) { id } }`, { id: input.ticketId, reason: trimmed(input.reason), key: key(input.idempotencyKey) });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(BOARD_PATH);
  return { ok: true, data: { id: r.data.createAdjustmentTicket.id } };
}

const ATTACHMENT_KINDS = new Set(['seller_photo', 'material_photo', 'vehicle_photo', 'signature', 'thumbprint', 'ownership_document', 'bol', 'other']);

/** A photo, signature or document image on an open ticket (private storage). */
export async function addAttachmentAction(form: FormData): Promise<ActionResult<unknown>> {
  const ticketId = trimmed(form.get('ticketId'), 64);
  const kind = trimmed(form.get('kind'), 40);
  const lineId = trimmed(form.get('lineId'), 64);
  const signedName = trimmed(form.get('signedName'), 120);
  if (!ticketId || !ATTACHMENT_KINDS.has(kind)) return { ok: false, error: 'Pick what the image shows.' };
  const image = formImage(form, 'image');
  if (!image) return { ok: false, error: kind === 'signature' ? 'The seller must sign first.' : 'Take or choose a photo.' };
  if ('error' in image) return { ok: false, error: image.error };
  if (kind === 'signature' && !signedName) return { ok: false, error: 'Type the seller’s name under the signature.' };
  const data: Record<string, unknown> = { ticket: { connect: { id: ticketId } }, kind, image: { upload: null } };
  if (lineId) data.line = { connect: { id: lineId } };
  if (signedName) data.signedName = signedName;
  const r = await platformUpload(`mutation AddTicketAttachment($data: TicketAttachmentCreateInput!) { createTicketAttachment(data: $data) { id } }`, { data }, { 'data.image.upload': image });
  return done(r, [ticketPath(ticketId)]);
}
