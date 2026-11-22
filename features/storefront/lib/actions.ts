'use server';

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { gql } from './data/client';

export type FormState = { error: string | null; success?: string | null; fields?: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/** Only same-site paths; staff go to the dashboard, everyone else to their account. */
function safeNext(value: string, fallback: string) {
  return value.startsWith('/') && !value.startsWith('//') && !/[\\\u0000-\u001f]/.test(value) ? value : fallback;
}

async function setSession(token: string) {
  (await cookies()).set('keystonejs-session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function authenticate(email: string, password: string) {
  const r = await gql<{ authenticateUserWithPassword: { sessionToken?: string; item?: { role: { canAccessDashboard: boolean | null } | null } } | null }>(
    `mutation($email: String!, $password: String!) { authenticateUserWithPassword(email: $email, password: $password) {
      ... on UserAuthenticationWithPasswordSuccess { sessionToken item { role { canAccessDashboard } } }
    } }`,
    { email, password },
    { token: '' },
  );
  if (!r.ok) return null;
  const a = r.data.authenticateUserWithPassword;
  return a?.sessionToken ? { token: a.sessionToken, isStaff: Boolean(a.item?.role?.canAccessDashboard) } : null;
}

export async function signInAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = str(form, 'email').toLowerCase();
  const password = String(form.get('password') || '');
  if (!EMAIL.test(email) || !password) return { error: 'Enter your email address and password.', fields: { email } };
  const auth = await authenticate(email, password);
  if (!auth) return { error: 'That email and password do not match an account. Check them and try again.', fields: { email } };
  await setSession(auth.token);
  revalidatePath('/', 'layout');
  redirect(auth.isStaff ? '/dashboard' : safeNext(str(form, 'next'), '/account'));
}

export async function registerAction(_prev: FormState, form: FormData): Promise<FormState> {
  const name = str(form, 'name');
  const email = str(form, 'email').toLowerCase();
  const phone = str(form, 'phone');
  const password = String(form.get('password') || '');
  const fields = { name, email, phone };
  if (!name || name.length > 120) return { error: 'Enter your full name.', fields };
  if (!EMAIL.test(email) || email.length > 254) return { error: 'Enter a valid email address.', fields };
  if (phone.replace(/\D/g, '').length < 7) return { error: 'Enter a phone number the yard can reach you on.', fields };
  if (password.length < 10) return { error: 'Choose a password of at least 10 characters.', fields };
  const r = await gql<{ registerCustomer: { id: string } | null }>(
    `mutation($name: String!, $email: String!, $phone: String, $password: String!) { registerCustomer(name: $name, email: $email, phone: $phone, password: $password) { id } }`,
    { name, email, phone, password },
    { token: '' },
  );
  if (!r.ok) return { error: r.code === 'COMMAND_REFUSED' || r.code === 'BAD_USER_INPUT' ? r.error : 'We couldn’t create an account with those details. If you already have one, sign in or reset your password.', fields };
  const auth = await authenticate(email, password);
  if (!auth) return { error: 'Your account was created. Sign in to continue.', fields };
  await setSession(auth.token);
  revalidatePath('/', 'layout');
  redirect(safeNext(str(form, 'next'), '/account/profile?welcome=1'));
}

export async function requestResetAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = str(form, 'email').toLowerCase();
  if (!EMAIL.test(email)) return { error: 'Enter the email address on your account.', fields: { email } };
  const r = await gql<{ sendUserPasswordResetLink: boolean }>(`mutation($email: String!) { sendUserPasswordResetLink(email: $email) }`, { email }, { token: '' });
  if (!r.ok || r.data.sendUserPasswordResetLink !== true) return { error: 'We couldn’t send a reset email right now. Call the yard and staff can reset it for you.', fields: { email } };
  return { error: null, success: 'If an account exists for that email, a reset link is on its way. It works once.' };
}

export async function redeemResetAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = str(form, 'email').toLowerCase();
  const token = str(form, 'token');
  const password = String(form.get('password') || '');
  if (!EMAIL.test(email) || !token) return { error: 'This reset link is not complete. Request a new one.' };
  if (password.length < 10) return { error: 'Choose a password of at least 10 characters.' };
  const r = await gql<{ redeemUserPasswordResetToken: { code: string } | null }>(
    `mutation($email: String!, $token: String!, $password: String!) { redeemUserPasswordResetToken(email: $email, token: $token, password: $password) { code } }`,
    { email, token, password },
    { token: '' },
  );
  if (!r.ok) return { error: 'Your password couldn’t be reset right now. Try again later.' };
  if (r.data.redeemUserPasswordResetToken?.code) return { error: 'This reset link has expired or was already used. Request a new one.' };
  return { error: null, success: 'Your password is reset. You can sign in now.' };
}

export async function signOutAction() {
  await gql('mutation { endSession }');
  (await cookies()).delete('keystonejs-session');
  revalidatePath('/', 'layout');
  redirect('/');
}

// ---- Seller profile (S2) ----
export async function saveProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const data = {
    firstName: str(form, 'firstName'),
    lastName: str(form, 'lastName'),
    dateOfBirth: str(form, 'dateOfBirth') || null,
    phone: str(form, 'phone') || null,
    email: str(form, 'email') || null,
    addressLine1: str(form, 'addressLine1') || null,
    addressLine2: str(form, 'addressLine2') || null,
    city: str(form, 'city') || null,
    region: str(form, 'region') || null,
    postalCode: str(form, 'postalCode') || null,
    preferredPayout: str(form, 'preferredPayout') || null,
  };
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? '']));
  if (!data.firstName || !data.lastName) return { error: 'Enter your first and last name as they appear on your ID.', fields };
  if (!data.dateOfBirth) return { error: 'Enter your date of birth. Yards must check sellers are old enough.', fields };
  const r = await gql(`mutation($data: MySellerProfileInput!) { upsertMySellerProfile(data: $data) { id } }`, { data });
  if (!r.ok) return { error: r.error, fields };
  revalidatePath('/account', 'layout');
  const next = str(form, 'next');
  if (next) redirect(safeNext(next, '/account'));
  return { error: null, success: 'Your details are saved.', fields };
}

// ---- Identity (S3) ----
export async function submitIdentityAction(_prev: FormState, form: FormData): Promise<FormState> {
  const front = form.get('frontImage');
  const back = form.get('backImage');
  const data: Record<string, unknown> = {
    kind: str(form, 'kind'),
    number: str(form, 'number'),
    issuer: str(form, 'issuer') || null,
    expiresOn: str(form, 'expiresOn') || null,
  };
  const fields = { kind: String(data.kind), issuer: String(data.issuer || ''), expiresOn: String(data.expiresOn || '') };
  if (!data.kind || !data.number) return { error: 'Choose the kind of ID and enter its number.', fields };
  if (!data.expiresOn) return { error: 'Enter the expiry date printed on the ID.', fields };
  if (new Date(String(data.expiresOn)).getTime() < Date.now()) return { error: 'This ID has expired. Yards cannot buy from an expired ID; add a current one.', fields };
  if (front instanceof File && front.size > 0) {
    if (front.size > 10 * 1024 * 1024) return { error: 'The photo is larger than 10 MB. Take it again at a lower size.', fields };
    data.frontImage = { upload: front };
  }
  if (back instanceof File && back.size > 0) {
    if (back.size > 10 * 1024 * 1024) return { error: 'The photo is larger than 10 MB. Take it again at a lower size.', fields };
    data.backImage = { upload: back };
  }
  const r = await gql(`mutation($data: MyIdentityDocumentInput!) { submitMyIdentityDocument(data: $data) { id } }`, { data });
  if (!r.ok) return { error: r.error, fields };
  revalidatePath('/account', 'layout');
  const next = str(form, 'next');
  if (next) redirect(safeNext(next, '/account/identity'));
  return { error: null, success: 'Your ID is on file. Staff will check the card itself on your first visit.' };
}

// ---- Vehicles (S4) ----
export async function saveVehicleAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, 'id') || null;
  const data = {
    plate: str(form, 'plate').toUpperCase(),
    plateRegion: str(form, 'plateRegion') || null,
    make: str(form, 'make') || null,
    model: str(form, 'model') || null,
    color: str(form, 'color') || null,
    kind: str(form, 'kind') || 'pickup',
  };
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? '']));
  if (!data.plate) return { error: 'Enter the licence plate.', fields };
  const r = await gql(`mutation($id: ID, $data: MyVehicleInput!) { upsertMyVehicle(id: $id, data: $data) { id } }`, { id, data });
  if (!r.ok) return { error: r.error, fields };
  revalidatePath('/account', 'layout');
  const next = str(form, 'next');
  if (next) redirect(safeNext(next, '/account/vehicles'));
  return { error: null, success: id ? 'Vehicle updated.' : 'Vehicle added.' };
}

export async function removeVehicleAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, 'id');
  const r = await gql(`mutation($id: ID!) { removeMyVehicle(id: $id) { id } }`, { id });
  if (!r.ok) return { error: r.error };
  revalidatePath('/account', 'layout');
  return { error: null, success: 'Vehicle removed.' };
}

// ---- Visits (S5, S6) ----
export async function createVisitAction(_prev: FormState, form: FormData): Promise<FormState> {
  const yardSlug = str(form, 'yardSlug');
  const plannedDate = str(form, 'plannedDate');
  const vehicleId = str(form, 'vehicleId') || null;
  const materialIds = form.getAll('materialId').map(String).filter(Boolean);
  const expectedItems = materialIds.map((materialId) => {
    const w = str(form, `weight_${materialId}`);
    return { materialId, estimatedWeight: w && Number(w) > 0 ? w : null };
  });
  const fields = { yardSlug, plannedDate, vehicleId: vehicleId || '' };
  if (!yardSlug) return { error: 'Choose the yard you are coming to.', fields };
  if (!plannedDate) return { error: 'Choose the day you are coming.', fields };
  const r = await gql<{ createMyVisit: { id: string } }>(
    `mutation($data: CreateMyVisitInput!, $idempotencyKey: String) { createMyVisit(data: $data, idempotencyKey: $idempotencyKey) { id } }`,
    { data: { yardSlug, plannedDate, vehicleId, expectedItems }, idempotencyKey: str(form, 'idempotencyKey') || randomUUID() },
  );
  if (!r.ok) return { error: r.error, fields };
  revalidatePath('/account', 'layout');
  redirect(`/account/visits/${r.data.createMyVisit.id}?new=1`);
}

export async function cancelVisitAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, 'id');
  const r = await gql(`mutation($id: ID!) { cancelMyVisit(id: $id) { id } }`, { id });
  if (!r.ok) return { error: r.error };
  revalidatePath('/account', 'layout');
  return { error: null, success: 'Your visit is cancelled.' };
}

// ---- Track a ticket (P17) ----
export async function trackAction(_prev: FormState, form: FormData): Promise<FormState> {
  const number = str(form, 'number').toUpperCase();
  const code = str(form, 'code').toUpperCase();
  if (!number || !code) return { error: 'Enter the ticket number and the lookup code from your receipt.', fields: { number, code } };
  redirect(`/track?number=${encodeURIComponent(number)}&code=${encodeURIComponent(code)}`);
}

// ---- Applications (P12, P13, S16) ----
const APPLY_KINDS = ['supplier', 'buyer', 'nonprofit'] as const;
export async function applyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const kind = str(form, 'kind');
  const a = {
    kind,
    businessName: str(form, 'businessName'),
    legalName: str(form, 'legalName') || null,
    taxId: str(form, 'taxId') || null,
    addressLine1: str(form, 'addressLine1') || null,
    addressLine2: str(form, 'addressLine2') || null,
    city: str(form, 'city') || null,
    region: str(form, 'region') || null,
    postalCode: str(form, 'postalCode') || null,
    phone: str(form, 'phone') || null,
    email: str(form, 'email').toLowerCase() || null,
    monthlyVolume: str(form, 'monthlyVolume') || null,
    containerNeeds: str(form, 'containerNeeds') || null,
    message: str(form, 'message') || null,
    materials: str(form, 'materials') ? str(form, 'materials').split(',').map((s) => s.trim()).filter(Boolean) : null,
  };
  const fields = Object.fromEntries(Object.entries(a).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v ?? '']));
  if (!APPLY_KINDS.includes(kind as (typeof APPLY_KINDS)[number])) return { error: 'Choose what kind of account you are applying for.', fields };
  if (a.businessName.length < 2) return { error: 'Enter the business name.', fields };
  if (kind === 'nonprofit' && !a.taxId) return { error: 'Enter the EIN of the nonprofit.', fields };
  if (a.email && !EMAIL.test(a.email)) return { error: 'Enter a valid email address, or leave it empty.', fields };
  const r = await gql<{ submitAccountApplication: { id: string } }>(
    `mutation($kind: String!, $businessName: String!, $legalName: String, $taxId: String, $addressLine1: String, $addressLine2: String, $city: String, $region: String, $postalCode: String, $phone: String, $email: String, $materials: JSON, $monthlyVolume: String, $containerNeeds: String, $message: String, $idempotencyKey: String) {
      submitAccountApplication(kind: $kind, businessName: $businessName, legalName: $legalName, taxId: $taxId, addressLine1: $addressLine1, addressLine2: $addressLine2, city: $city, region: $region, postalCode: $postalCode, phone: $phone, email: $email, materials: $materials, monthlyVolume: $monthlyVolume, containerNeeds: $containerNeeds, message: $message, idempotencyKey: $idempotencyKey) { id }
    }`,
    { ...a, idempotencyKey: str(form, 'idempotencyKey') || randomUUID() },
  );
  if (!r.ok) return { error: r.unauthenticated ? 'Sign in first, then send the application.' : r.error, fields };
  revalidatePath('/account', 'layout');
  redirect('/account/applications?sent=1');
}

export async function withdrawApplicationAction(_prev: FormState, form: FormData): Promise<FormState> {
  const r = await gql(`mutation($id: ID!) { withdrawApplication(applicationId: $id) { id } }`, { id: str(form, 'id') });
  if (!r.ok) return { error: r.error };
  revalidatePath('/account/applications');
  return { error: null, success: 'Application withdrawn.' };
}

// ---- Public pickups (P16, S14) ----
export async function requestPickupAction(_prev: FormState, form: FormData): Promise<FormState> {
  const address = {
    name: str(form, 'placeName') || null,
    addressLine1: str(form, 'addressLine1'),
    addressLine2: str(form, 'addressLine2') || null,
    city: str(form, 'city'),
    region: str(form, 'region') || null,
    postalCode: str(form, 'postalCode') || null,
    contactName: str(form, 'contactName') || null,
    contactPhone: str(form, 'contactPhone') || null,
  };
  const v = {
    yardId: str(form, 'yardId'),
    itemsDescription: str(form, 'itemsDescription'),
    materialId: str(form, 'materialId') || null,
    preferredDate: str(form, 'preferredDate') || null,
    preferredWindow: str(form, 'preferredWindow') || 'any',
    accessNotes: str(form, 'accessNotes') || null,
  };
  const fields = { ...Object.fromEntries(Object.entries({ ...address, ...v }).map(([k, x]) => [k, x ?? ''])), placeName: address.name || '' };
  if (!v.yardId) return { error: 'Choose the yard nearest you.', fields };
  if (!v.itemsDescription) return { error: 'Tell us what to pick up, for example “a washer and a dryer”.', fields };
  if (!address.addressLine1 || !address.city) return { error: 'Enter the street address and city for the pickup.', fields };
  const r = await gql<{ createServiceRequest: { id: string } }>(
    `mutation($yardId: ID!, $materialId: ID, $itemsDescription: String, $preferredDate: String, $preferredWindow: String, $accessNotes: String, $address: PickupAddressInput, $idempotencyKey: String) {
      createServiceRequest(yardId: $yardId, kind: "public_pickup", materialId: $materialId, itemsDescription: $itemsDescription, preferredDate: $preferredDate, preferredWindow: $preferredWindow, accessNotes: $accessNotes, address: $address, idempotencyKey: $idempotencyKey) { id }
    }`,
    { ...v, address, idempotencyKey: str(form, 'idempotencyKey') || randomUUID() },
  );
  if (!r.ok) return { error: r.unauthenticated ? 'Sign in first, then send the request.' : r.error, fields };
  revalidatePath('/account', 'layout');
  redirect(`/account/pickups/${r.data.createServiceRequest.id}?new=1`);
}

export async function acceptQuoteAction(_prev: FormState, form: FormData): Promise<FormState> {
  const r = await gql(`mutation($id: ID!) { acceptServiceQuote(requestId: $id) { id } }`, { id: str(form, 'id') });
  if (!r.ok) return { error: r.error };
  revalidatePath('/account', 'layout');
  return { error: null, success: 'Quote accepted.' };
}

export async function cancelRequestAction(_prev: FormState, form: FormData): Promise<FormState> {
  const r = await gql(`mutation($id: ID!, $reason: String) { cancelServiceRequest(requestId: $id, reason: $reason) { id } }`, { id: str(form, 'id'), reason: str(form, 'reason') || null });
  if (!r.ok) return { error: r.error };
  revalidatePath('/account', 'layout');
  return { error: null, success: 'Request cancelled. Any card payment is refunded in full.' };
}

// ---- Card payments (S12, S14, C6, C10): the provider's hosted checkout. ----
export async function payByCardAction(_prev: FormState, form: FormData): Promise<FormState> {
  const kind = str(form, 'kind');
  const id = str(form, 'id');
  const returnPath = safeNext(str(form, 'returnPath'), '/account');
  const key = str(form, 'idempotencyKey') || randomUUID();
  const r = kind === 'request'
    ? await gql<{ payServiceRequestByCard: { url: string | null } }>(`mutation($id: ID!, $returnPath: String, $key: String!) { payServiceRequestByCard(requestId: $id, returnPath: $returnPath, idempotencyKey: $key) { url } }`, { id, returnPath, key })
    : await gql<{ payInvoiceByCard: { url: string | null } }>(`mutation($id: ID!, $returnPath: String, $key: String!) { payInvoiceByCard(invoiceId: $id, returnPath: $returnPath, idempotencyKey: $key) { url } }`, { id, returnPath, key });
  if (!r.ok) return { error: r.error };
  const url = 'payServiceRequestByCard' in r.data ? r.data.payServiceRequestByCard.url : r.data.payInvoiceByCard.url;
  if (!url) return { error: 'Card payment is not set up for this business yet. Pay at the window, or call the yard.' };
  redirect(url);
}

// ---- Company portal (C4, C6) ----
export async function saveSiteAction(_prev: FormState, form: FormData): Promise<FormState> {
  const v = {
    accountId: str(form, 'accountId'),
    siteId: str(form, 'siteId') || null,
    name: str(form, 'name'),
    addressLine1: str(form, 'addressLine1'),
    addressLine2: str(form, 'addressLine2') || null,
    city: str(form, 'city'),
    region: str(form, 'region') || null,
    postalCode: str(form, 'postalCode') || null,
    contactName: str(form, 'contactName') || null,
    contactPhone: str(form, 'contactPhone') || null,
    accessNotes: str(form, 'accessNotes') || null,
    isActive: form.get('isActive') !== null || !str(form, 'siteId'),
  };
  const fields = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === null ? '' : String(x)]));
  if (!v.name || !v.addressLine1 || !v.city) return { error: 'Enter the site name, street address and city.', fields };
  const r = await gql(
    `mutation($accountId: ID!, $siteId: ID, $name: String!, $addressLine1: String!, $addressLine2: String, $city: String!, $region: String, $postalCode: String, $contactName: String, $contactPhone: String, $accessNotes: String, $isActive: Boolean) {
      upsertAccountSite(accountId: $accountId, siteId: $siteId, name: $name, addressLine1: $addressLine1, addressLine2: $addressLine2, city: $city, region: $region, postalCode: $postalCode, contactName: $contactName, contactPhone: $contactPhone, accessNotes: $accessNotes, isActive: $isActive) { id }
    }`,
    v,
  );
  if (!r.ok) return { error: r.error, fields };
  revalidatePath(`/account/company/${str(form, 'slug')}`, 'layout');
  return { error: null, success: v.siteId ? 'Site saved.' : 'Site added.' };
}

export async function companyRequestAction(_prev: FormState, form: FormData): Promise<FormState> {
  const slug = str(form, 'slug');
  const v = {
    yardId: str(form, 'yardId'),
    kind: str(form, 'kind'),
    accountId: str(form, 'accountId'),
    siteId: str(form, 'siteId') || null,
    containerTypeId: str(form, 'containerTypeId') || null,
    containerId: str(form, 'containerId') || null,
    preferredDate: str(form, 'preferredDate') || null,
    preferredWindow: str(form, 'preferredWindow') || 'any',
    accessNotes: str(form, 'accessNotes') || null,
    itemsDescription: str(form, 'itemsDescription') || null,
  };
  const fields = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x ?? '']));
  if (!v.kind) return { error: 'Choose what you need.', fields };
  if (['deliver', 'swap'].includes(v.kind) && !v.containerTypeId) return { error: 'Choose the container size.', fields };
  if (['pickup', 'remove', 'swap'].includes(v.kind) && !v.containerId) return { error: 'Choose the container on site.', fields };
  const r = await gql<{ createServiceRequest: { id: string } }>(
    `mutation($yardId: ID!, $kind: String!, $accountId: ID, $siteId: ID, $containerTypeId: ID, $containerId: ID, $preferredDate: String, $preferredWindow: String, $accessNotes: String, $itemsDescription: String, $idempotencyKey: String) {
      createServiceRequest(yardId: $yardId, kind: $kind, accountId: $accountId, siteId: $siteId, containerTypeId: $containerTypeId, containerId: $containerId, preferredDate: $preferredDate, preferredWindow: $preferredWindow, accessNotes: $accessNotes, itemsDescription: $itemsDescription, idempotencyKey: $idempotencyKey) { id }
    }`,
    { ...v, idempotencyKey: str(form, 'idempotencyKey') || randomUUID() },
  );
  if (!r.ok) return { error: r.error, fields };
  revalidatePath(`/account/company/${slug}`, 'layout');
  redirect(`/account/company/${slug}/requests/${r.data.createServiceRequest.id}?new=1`);
}

// ---- Market (B2) ----
export async function offerAction(_prev: FormState, form: FormData): Promise<FormState> {
  const listingId = str(form, 'listingId');
  const buyNow = str(form, 'mode') === 'buy';
  const v = { listingId, accountId: str(form, 'accountId'), weight: str(form, 'weight'), unitPrice: buyNow ? null : str(form, 'unitPrice') || null, pickupFrom: str(form, 'pickupFrom') || null, pickupTo: str(form, 'pickupTo') || null, message: str(form, 'message') || null, buyNow };
  const fields = { ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === null ? '' : String(x)])), mode: buyNow ? 'buy' : 'offer' };
  if (!(Number(v.weight) > 0)) return { error: 'Enter the weight you want.', fields };
  if (!buyNow && !(Number(v.unitPrice) > 0)) return { error: 'Enter your price.', fields };
  const r = await gql<{ submitOffer: { id: string } }>(
    `mutation($listingId: ID!, $accountId: ID!, $weight: String!, $unitPrice: String, $pickupFrom: String, $pickupTo: String, $message: String, $buyNow: Boolean, $idempotencyKey: String) {
      submitOffer(listingId: $listingId, accountId: $accountId, weight: $weight, unitPrice: $unitPrice, pickupFrom: $pickupFrom, pickupTo: $pickupTo, message: $message, buyNow: $buyNow, idempotencyKey: $idempotencyKey) { id }
    }`,
    { ...v, idempotencyKey: str(form, 'idempotencyKey') || randomUUID() },
  );
  if (!r.ok) return { error: r.error, fields };
  revalidatePath(`/market/${listingId}`);
  redirect(`/market/${listingId}?sent=${buyNow ? 'bought' : 'offer'}`);
}
