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
  const r = await gql<{ createVisit: { id: string } }>(
    `mutation($data: CreateVisitInput!, $idempotencyKey: String) { createVisit(data: $data, idempotencyKey: $idempotencyKey) { id } }`,
    { data: { yardSlug, plannedDate, vehicleId, expectedItems }, idempotencyKey: str(form, 'idempotencyKey') || randomUUID() },
  );
  if (!r.ok) return { error: r.error, fields };
  revalidatePath('/account', 'layout');
  redirect(`/account/visits/${r.data.createVisit.id}?new=1`);
}

export async function cancelVisitAction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = str(form, 'id');
  const r = await gql(`mutation($id: ID!) { cancelVisit(id: $id) { id } }`, { id });
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
