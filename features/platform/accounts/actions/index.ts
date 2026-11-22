'use server';

import { revalidatePath } from 'next/cache';
import { platformRequest, trimmed } from '@/features/platform/lib/platformRequest';
import { newServerKey } from '@/features/platform/lib/serverKey';
import type { AccountDetail, AccountRow, Application, Charge, ContainerRow, InvoiceRow, SettlementRow } from '../types';
import { CONTACT_ROLES, CYCLES, TERMS } from '../types';

const PATH = '/dashboard/platform/accounts';
type R<T> = { ok: true; data: T } | { ok: false; error: string };
function done<T>(r: R<T>, ...paths: string[]) {
  if (!r.ok) return r;
  revalidatePath(PATH);
  paths.forEach((p) => revalidatePath(p));
  return r;
}
const ROW = 'id name accountNumber status isSupplier isBuyer isNonprofit paymentTerms netDays billingCity billingRegion phone priceList { id name } sitesCount createdAt';

export async function listAccounts(input: { tab: string; q: string; page: number; perPage: number }) {
  const and: any[] = [];
  if (input.tab === 'suppliers') and.push({ isSupplier: { equals: true } });
  if (input.tab === 'buyers') and.push({ isBuyer: { equals: true } });
  if (input.tab === 'nonprofits') and.push({ isNonprofit: { equals: true } });
  if (input.tab === 'suspended') and.push({ status: { equals: 'suspended' } });
  else and.push({ status: { equals: 'active' } });
  const q = trimmed(input.q, 80);
  if (q) and.push({ OR: [{ name: { contains: q, mode: 'insensitive' } }, { accountNumber: { contains: q, mode: 'insensitive' } }, { legalName: { contains: q, mode: 'insensitive' } }] });
  const r = await platformRequest<{ accounts: AccountRow[]; count: number; suppliers: number; buyers: number; nonprofits: number; suspended: number; applications: number }>(`
    query Accounts($where: AccountWhereInput!, $take: Int!, $skip: Int!) {
      accounts(where: $where, orderBy: [{ name: asc }], take: $take, skip: $skip) { ${ROW} }
      count: accountsCount(where: $where)
      suppliers: accountsCount(where: { status: { equals: "active" }, isSupplier: { equals: true } })
      buyers: accountsCount(where: { status: { equals: "active" }, isBuyer: { equals: true } })
      nonprofits: accountsCount(where: { status: { equals: "active" }, isNonprofit: { equals: true } })
      suspended: accountsCount(where: { status: { equals: "suspended" } })
      applications: accountApplicationsCount(where: { status: { equals: "submitted" } })
    }`, { where: { AND: and }, take: input.perPage, skip: (input.page - 1) * input.perPage });
  return r.ok ? { ok: true as const, ...r.data } : r;
}

const APP = 'id kind businessName legalName taxId addressLine1 addressLine2 city region postalCode country phone email materials monthlyVolume containerNeeds message w9 { filename url } status decisionReason decidedAt decidedBy { name } account { id name } applicant { name email } createdAt';

export async function listApplications(status: string) {
  const r = await platformRequest<{ accountApplications: Application[]; submitted: number; approved: number; declined: number; withdrawn: number }>(`
    query Applications($status: String!) {
      accountApplications(where: { status: { equals: $status } }, orderBy: [{ createdAt: asc }], take: 100) { ${APP} }
      submitted: accountApplicationsCount(where: { status: { equals: "submitted" } })
      approved: accountApplicationsCount(where: { status: { equals: "approved" } })
      declined: accountApplicationsCount(where: { status: { equals: "declined" } })
      withdrawn: accountApplicationsCount(where: { status: { equals: "withdrawn" } })
    }`, { status });
  return r.ok ? { ok: true as const, ...r.data } : r;
}

export async function getApplication(id: string) {
  const r = await platformRequest<{ accountApplication: Application | null; priceLists: Array<{ id: string; name: string; kind: string }> }>(`
    query Application($id: ID!) {
      accountApplication(where: { id: $id }) { ${APP} }
      priceLists(where: { isActive: { equals: true } }, orderBy: [{ name: asc }]) { id name kind }
    }`, { id });
  if (!r.ok) return r;
  if (!r.data.accountApplication) return { ok: false as const, error: 'Application not found.' };
  return { ok: true as const, application: r.data.accountApplication, priceLists: r.data.priceLists || [] };
}

export async function decideApplicationAction(input: { applicationId: string; decision: 'approve' | 'decline'; reason?: string; accountId?: string; paymentTerms?: string; netDays?: number; weightBasis?: string; hasCredit?: boolean; priceListId?: string }) {
  if (input.decision === 'decline' && trimmed(input.reason).length < 3) return { ok: false as const, error: 'Give the applicant a reason.' };
  if (input.decision === 'approve' && input.paymentTerms && !TERMS[input.paymentTerms]) return { ok: false as const, error: 'Choose valid payment terms.' };
  const r = await platformRequest<{ decideAccountApplication: { id: string; status: string; account: { id: string } | null } }>(`
    mutation Decide($id: ID!, $decision: String!, $reason: String, $accountId: ID, $terms: String, $netDays: Int, $basis: String, $credit: Boolean, $priceListId: ID, $key: String) {
      decideAccountApplication(applicationId: $id, decision: $decision, reason: $reason, accountId: $accountId, paymentTerms: $terms, netDays: $netDays, weightBasis: $basis, hasCredit: $credit, priceListId: $priceListId, idempotencyKey: $key) { id status account { id } }
    }`, {
    id: input.applicationId, decision: input.decision, reason: trimmed(input.reason, 1000) || null, accountId: input.accountId || null,
    terms: input.paymentTerms || null, netDays: input.netDays ?? null, basis: input.weightBasis || null, credit: input.hasCredit ?? null, priceListId: input.priceListId || null,
    key: newServerKey('decide-application', input.applicationId, input.decision),
  });
  return done(r.ok ? { ok: true as const, data: r.data.decideAccountApplication } : r, `${PATH}/applications`, `${PATH}/applications/${input.applicationId}`);
}

export async function getAccount(id: string) {
  const r = await platformRequest<{ account: AccountDetail | null; scaleTickets: AccountDetail['tickets']; ticketsCount: number; priceLists: Array<{ id: string; name: string; kind: string }> }>(`
    query Account($id: ID!) {
      account(where: { id: $id }) {
        ${ROW} legalName statusReason taxId billingAddressLine1 billingAddressLine2 billingPostalCode billingCountry billingEmail settlementCycle weightBasis hasCredit notes
        contacts(where: { status: { not: { equals: "removed" } } }, orderBy: [{ createdAt: asc }]) { id role status inviteEmail user { name email phone } createdAt }
        sites(orderBy: [{ name: asc }]) { id name addressLine1 addressLine2 city region postalCode contactName contactPhone accessNotes isActive }
        documents(orderBy: [{ createdAt: desc }], take: 50) { id kind title file { filename url } visibleToAccount createdAt }
      }
      scaleTickets(where: { account: { id: { equals: $id } } }, orderBy: [{ createdAt: desc }], take: 25) { id displayNumber status direction totalCents completedAt createdAt site { name } yard { code timezone } }
      ticketsCount: scaleTicketsCount(where: { account: { id: { equals: $id } } })
      priceLists(where: { isActive: { equals: true } }, orderBy: [{ name: asc }]) { id name kind }
    }`, { id });
  if (!r.ok) return r;
  if (!r.data.account) return { ok: false as const, error: 'Account not found.' };
  // Money and containers are readable by finance, accounts and dispatch roles; each part loads on its own.
  const [money, containers] = await Promise.all([
    platformRequest<{ accountChargeItems: Charge[]; settlements: SettlementRow[]; invoices: InvoiceRow[] }>(`
      query AccountMoney($id: ID!) {
        accountChargeItems(where: { account: { id: { equals: $id } } }, orderBy: [{ createdAt: desc }], take: 50) { id kind description amountCents status serviceDate createdAt }
        settlements(where: { account: { id: { equals: $id } } }, orderBy: [{ periodEnd: desc }], take: 25) { id number status periodStart periodEnd netCents approvedAt paidAt }
        invoices(where: { account: { id: { equals: $id } } }, orderBy: [{ createdAt: desc }], take: 25) { id number kind status totalCents paidCents dueOn createdAt }
      }`, { id }),
    platformRequest<{ containers: ContainerRow[] }>(`
      query AccountContainers($id: ID!) { containers(where: { account: { id: { equals: $id } } }, orderBy: [{ number: asc }]) { id number status daysOnSite placedOn type { name } site { name } currentMaterial { name } } }`, { id }),
  ]);
  return {
    ok: true as const, account: { ...r.data.account, tickets: r.data.scaleTickets || [], ticketsCount: r.data.ticketsCount ?? 0 }, priceLists: r.data.priceLists || [],
    money: money.ok ? { charges: money.data.accountChargeItems, settlements: money.data.settlements, invoices: money.data.invoices } : null, containers: containers.ok ? containers.data.containers : null,
  };
}

export async function updateTermsAction(id: string, input: { paymentTerms: string; netDays: string; settlementCycle: string; weightBasis: string; hasCredit: boolean; priceListId: string; billingEmail: string; phone: string; notes: string }) {
  if (!TERMS[input.paymentTerms]) return { ok: false as const, error: 'Choose the payment terms.' };
  if (!CYCLES[input.settlementCycle]) return { ok: false as const, error: 'Choose the settlement cycle.' };
  const net = Number.parseInt(input.netDays || '0', 10);
  if (!Number.isFinite(net) || net < 0 || net > 180) return { ok: false as const, error: 'Net days must be between 0 and 180.' };
  const email = trimmed(input.billingEmail, 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, error: 'Check the billing email.' };
  const data = {
    paymentTerms: input.paymentTerms, netDays: net, settlementCycle: input.settlementCycle, weightBasis: input.weightBasis === 'received' ? 'received' : 'shipped',
    hasCredit: Boolean(input.hasCredit), priceList: input.priceListId ? { connect: { id: input.priceListId } } : { disconnect: true },
    billingEmail: email, phone: trimmed(input.phone, 40), notes: trimmed(input.notes, 4000),
  };
  return done(await platformRequest(`mutation AccountTerms($id: ID!, $data: AccountUpdateInput!) { updateAccount(where: { id: $id }, data: $data) { id } }`, { id, data }), `${PATH}/${id}`);
}

export async function setAccountStatusAction(input: { accountId: string; status: string; reason: string }) {
  const reason = trimmed(input.reason, 500);
  if (reason.length < 3) return { ok: false as const, error: 'Give a reason.' };
  return done(await platformRequest(`mutation AccountStatus($id: ID!, $status: String!, $reason: String!) { setAccountStatus(accountId: $id, status: $status, reason: $reason) { id status } }`, { id: input.accountId, status: input.status, reason }), `${PATH}/${input.accountId}`);
}

export async function inviteContactAction(input: { accountId: string; email: string; role: string }) {
  if (!CONTACT_ROLES[input.role]) return { ok: false as const, error: 'Choose a role.' };
  const r = await platformRequest<{ inviteAccountContact: { contactId: string; token: string } }>(`mutation Invite($id: ID!, $email: String!, $role: String!) { inviteAccountContact(accountId: $id, email: $email, role: $role) { contactId token } }`, { id: input.accountId, email: trimmed(input.email, 160), role: input.role });
  return done(r.ok ? { ok: true as const, data: { contactId: r.data.inviteAccountContact.contactId, joinPath: `/account/company/join?token=${encodeURIComponent(r.data.inviteAccountContact.token)}` } } : r, `${PATH}/${input.accountId}`);
}

export async function updateContactAction(input: { accountId: string; contactId: string; role?: string; remove?: boolean }) {
  return done(await platformRequest(`mutation Contact($id: ID!, $role: String, $remove: Boolean) { updateAccountContact(contactId: $id, role: $role, remove: $remove) { id } }`, { id: input.contactId, role: input.role || null, remove: input.remove ?? null }), `${PATH}/${input.accountId}`);
}

export async function upsertSiteAction(input: { accountId: string; siteId?: string; name: string; addressLine1: string; addressLine2?: string; city: string; region?: string; postalCode?: string; contactName?: string; contactPhone?: string; accessNotes?: string; isActive?: boolean }) {
  const v = (s?: string, n = 160) => trimmed(s, n) || null;
  return done(await platformRequest(`
    mutation Site($accountId: ID!, $siteId: ID, $name: String!, $a1: String!, $a2: String, $city: String!, $region: String, $zip: String, $cn: String, $cp: String, $notes: String, $active: Boolean) {
      upsertAccountSite(accountId: $accountId, siteId: $siteId, name: $name, addressLine1: $a1, addressLine2: $a2, city: $city, region: $region, postalCode: $zip, country: "US", contactName: $cn, contactPhone: $cp, accessNotes: $notes, isActive: $active) { id }
    }`, {
    accountId: input.accountId, siteId: input.siteId || null, name: trimmed(input.name, 120), a1: trimmed(input.addressLine1, 160), a2: v(input.addressLine2), city: trimmed(input.city, 80),
    region: v(input.region, 4)?.toUpperCase() ?? null, zip: v(input.postalCode, 20), cn: v(input.contactName, 120), cp: v(input.contactPhone, 40), notes: v(input.accessNotes, 1000), active: input.isActive ?? true,
  }), `${PATH}/${input.accountId}`);
}

export async function buildSettlementAction(input: { accountId: string; periodStart: string; periodEnd: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(input.periodEnd)) return { ok: false as const, error: 'Choose the period.' };
  if (input.periodEnd < input.periodStart) return { ok: false as const, error: 'The period ends before it starts.' };
  return done(await platformRequest(`mutation Build($id: ID!, $s: String!, $e: String!, $key: String) { buildSettlement(accountId: $id, periodStart: $s, periodEnd: $e, idempotencyKey: $key) { id number netCents } }`, { id: input.accountId, s: input.periodStart, e: input.periodEnd, key: newServerKey('settlement', input.accountId, input.periodStart, input.periodEnd) }), `${PATH}/${input.accountId}`);
}

export async function invoiceChargesAction(input: { accountId: string; netDays?: number }) {
  return done(await platformRequest(`mutation InvoiceCharges($id: ID!, $net: Int, $key: String) { invoiceAccountCharges(accountId: $id, netDays: $net, idempotencyKey: $key) { id number totalCents } }`, { id: input.accountId, net: input.netDays ?? null, key: newServerKey('invoice-charges', input.accountId, String(Date.now())) }), `${PATH}/${input.accountId}`);
}
