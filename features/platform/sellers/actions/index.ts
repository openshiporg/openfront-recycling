'use server';

import { revalidatePath } from 'next/cache';
import { formImage, platformRequest, platformUpload, trimmed } from '@/features/platform/lib/platformRequest';
import type { DoNotBuy, SellerDetail, SellerHit, SellerPayout, SellerRow } from '../types';
import { ID_KINDS, VEHICLE_KINDS } from '../types';

const PATH = '/dashboard/platform/sellers';
type R<T> = { ok: true; data: T } | { ok: false; error: string };
function done<T>(r: R<T>, id?: string) {
  if (!r.ok) return r;
  revalidatePath(PATH);
  if (id) revalidatePath(`${PATH}/${id}`);
  return r;
}
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: string) => `${d}T12:00:00.000Z`;

export async function searchSellers(q: string) {
  const r = await platformRequest<{ searchSellers: SellerHit[] }>(`
    query SellerSearch($q: String!) { searchSellers(q: $q, limit: 50) { id name phone email city status idVerification matchedOn idKind idLast4 idExpiresOn plates lastTicketAt ticketCount } }`, { q: trimmed(q, 80) });
  return r.ok ? { ok: true as const, sellers: r.data.searchSellers } : r;
}

export async function listSellers(input: { status: string; page: number; perPage: number }) {
  const where: Record<string, unknown> = {};
  if (input.status === 'unverified') where.idVerification = { in: ['unverified', 'expired'] };
  else if (input.status !== 'all') where.status = { equals: input.status };
  const r = await platformRequest<{ sellers: SellerRow[]; count: number; active: number; flagged: number; dnb: number; unverified: number; all: number }>(`
    query Sellers($where: SellerWhereInput!, $take: Int!, $skip: Int!) {
      sellers(where: $where, orderBy: [{ updatedAt: desc }], take: $take, skip: $skip) { id firstName lastName phone email city region status idVerification createdAt ticketsCount vehicles(where: { isRemoved: { equals: false } }) { plate } }
      count: sellersCount(where: $where)
      all: sellersCount
      active: sellersCount(where: { status: { equals: "active" } })
      flagged: sellersCount(where: { status: { equals: "flagged" } })
      dnb: sellersCount(where: { status: { equals: "do_not_buy" } })
      unverified: sellersCount(where: { idVerification: { in: ["unverified", "expired"] } })
    }`, { where, take: input.perPage, skip: (input.page - 1) * input.perPage });
  return r.ok ? { ok: true as const, ...r.data } : r;
}

export async function getSeller(id: string) {
  const r = await platformRequest<{ seller: SellerDetail | null }>(`
    query Seller($id: ID!) {
      seller(where: { id: $id }) {
        id firstName lastName dateOfBirth phone email addressLine1 addressLine2 city region postalCode country status statusReason idVerification preferredPayout notes createdAt
        priceList { id name } user { id }
        identityDocuments(orderBy: [{ createdAt: desc }]) { id kind number issuer expiresOn isCurrent verifiedAt verifiedBy { name } frontImage { url } backImage { url } createdAt }
        vehicles(orderBy: [{ createdAt: desc }]) { id plate plateRegion make model color kind storedTare isRemoved }
        tickets(orderBy: [{ createdAt: desc }], take: 25) { id displayNumber status direction totalCents completedAt createdAt yard { name timezone } }
        ticketsCount
      }
    }`, { id });
  if (!r.ok) return r;
  if (!r.data.seller) return { ok: false as const, error: 'Seller not found.' };
  // Payouts and the do-not-buy list are readable only by some roles; the profile still loads without them.
  const pay = await platformRequest<{ payouts: SellerPayout[] }>(`query SellerPayouts($id: ID!) { payouts(where: { seller: { id: { equals: $id } } }, orderBy: [{ createdAt: desc }], take: 25) { id amountCents status method paidAt releaseAt checkNumber createdAt ticket { id displayNumber } } }`, { id });
  // The do-not-buy list is compliance-only; staff without it still see the seller's status and reason.
  const dnb = await platformRequest<{ doNotBuyEntries: DoNotBuy[] }>(`query SellerDnb($id: ID!) { doNotBuyEntries(where: { seller: { id: { equals: $id } } }, orderBy: [{ createdAt: desc }]) { id reason source expiresOn isActive createdAt } }`, { id });
  return { ok: true as const, seller: r.data.seller, payouts: pay.ok ? pay.data.payouts || [] : null, doNotBuy: dnb.ok ? dnb.data.doNotBuyEntries : null };
}

export async function updateSellerAction(id: string, input: Record<string, string>) {
  const firstName = trimmed(input.firstName, 80);
  const lastName = trimmed(input.lastName, 80);
  if (!firstName || !lastName) return { ok: false as const, error: 'Enter the first and last name.' };
  const dob = trimmed(input.dateOfBirth, 10);
  if (dob && !DATE.test(dob)) return { ok: false as const, error: 'Enter the date of birth as a date.' };
  const email = trimmed(input.email, 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, error: 'Check the email address.' };
  if (!['cash', 'check', 'transfer'].includes(input.preferredPayout)) return { ok: false as const, error: 'Choose how they like to be paid.' };
  const data = {
    firstName, lastName, dateOfBirth: dob ? iso(dob) : null, phone: trimmed(input.phone, 40), email,
    addressLine1: trimmed(input.addressLine1, 160), addressLine2: trimmed(input.addressLine2, 160), city: trimmed(input.city, 80), region: trimmed(input.region, 40).toUpperCase(),
    postalCode: trimmed(input.postalCode, 20), country: trimmed(input.country, 2).toUpperCase() || 'US', preferredPayout: input.preferredPayout, notes: trimmed(input.notes, 4000),
  };
  return done(await platformRequest(`mutation UpdateSeller($id: ID!, $data: SellerUpdateInput!) { updateSeller(where: { id: $id }, data: $data) { id } }`, { id, data }), id);
}

export async function setSellerStatusAction(input: { sellerId: string; status: string; reason: string }) {
  const reason = trimmed(input.reason, 500);
  if (reason.length < 3) return { ok: false as const, error: 'Give a reason.' };
  return done(await platformRequest(`mutation SetSellerStatus($sellerId: ID!, $status: String!, $reason: String!) { setSellerStatus(sellerId: $sellerId, status: $status, reason: $reason) { id status } }`, { sellerId: input.sellerId, status: input.status, reason }), input.sellerId);
}

export async function verifyIdAction(input: { sellerId: string; documentId: string }) {
  return done(await platformRequest(`mutation VerifyId($id: ID!) { verifySellerIdentity(identityDocumentId: $id) { id idVerification } }`, { id: input.documentId }), input.sellerId);
}

export async function addIdAction(input: { sellerId: string; kind: string; number: string; issuer: string; expiresOn: string }) {
  if (!ID_KINDS[input.kind]) return { ok: false as const, error: 'Choose the kind of ID.' };
  const number = trimmed(input.number, 40);
  if (number.length < 3) return { ok: false as const, error: 'Enter the ID number.' };
  const expires = trimmed(input.expiresOn, 10);
  if (expires && !DATE.test(expires)) return { ok: false as const, error: 'Enter the expiry as a date.' };
  const data = { seller: { connect: { id: input.sellerId } }, kind: input.kind, number, issuer: trimmed(input.issuer, 40).toUpperCase(), expiresOn: expires ? iso(expires) : null, isCurrent: true };
  return done(await platformRequest(`mutation AddId($data: IdentityDocumentCreateInput!) { createIdentityDocument(data: $data) { id } }`, { data }), input.sellerId);
}

export async function addVehicleAction(input: { sellerId: string; plate: string; plateRegion: string; make: string; model: string; color: string; kind: string }) {
  const plate = trimmed(input.plate, 12);
  if (plate.length < 2) return { ok: false as const, error: 'Enter the plate.' };
  if (!(VEHICLE_KINDS as readonly string[]).includes(input.kind)) return { ok: false as const, error: 'Choose the kind of vehicle.' };
  const data = { seller: { connect: { id: input.sellerId } }, plate, plateRegion: trimmed(input.plateRegion, 4).toUpperCase(), make: trimmed(input.make, 40), model: trimmed(input.model, 40), color: trimmed(input.color, 30), kind: input.kind };
  return done(await platformRequest(`mutation AddVehicle($data: VehicleCreateInput!) { createVehicle(data: $data) { id } }`, { data }), input.sellerId);
}

export async function removeVehicleAction(input: { sellerId: string; vehicleId: string; removed: boolean }) {
  return done(await platformRequest(`mutation RemoveVehicle($id: ID!, $removed: Boolean!) { updateVehicle(where: { id: $id }, data: { isRemoved: $removed }) { id } }`, { id: input.vehicleId, removed: input.removed }), input.sellerId);
}

/** Photo of an ID document (front or back), saved to private storage on the document itself. */
export async function uploadIdPhotoAction(form: FormData) {
  const documentId = trimmed(form.get('documentId'), 64);
  const sellerId = trimmed(form.get('sellerId'), 64);
  const side = form.get('side') === 'back' ? 'backImage' : 'frontImage';
  const image = formImage(form, 'image');
  if (!documentId) return { ok: false as const, error: 'ID not found.' };
  if (!image) return { ok: false as const, error: 'Take or choose a photo of the ID.' };
  if ('error' in image) return { ok: false as const, error: image.error };
  const r = await platformUpload(`mutation IdPhoto($id: ID!, $data: IdentityDocumentUpdateInput!) { updateIdentityDocument(where: { id: $id }, data: $data) { id } }`, { id: documentId, data: { [side]: { upload: null } } }, { [`data.${side}.upload`]: image });
  if (r.ok) revalidatePath('/dashboard/platform/scale-house', 'layout');
  return done(r, sellerId || undefined);
}
