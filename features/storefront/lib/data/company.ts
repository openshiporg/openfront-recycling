import { cache } from 'react';
import { gql, type GqlResult } from './client';
import { RECEIPT_FIELDS, toReceipt, type RawReceipt, type Receipt } from './public';
import type { RequestView } from './requests';

/**
 * Company portal reads (dissertation §8.3, C1 to C11). Every query takes the account slug and the server
 * checks the signed-in user holds an active AccountContact on that account.
 */

export type MyAccount = { id: string; slug: string; name: string; role: string; status: string; isSupplier: boolean; isBuyer: boolean; isNonprofit: boolean };

export const getMyAccounts = cache(async (): Promise<GqlResult<MyAccount[]>> => {
  const r = await gql<{ myAccounts: MyAccount[] | null }>(`query { myAccounts { id slug name role status isSupplier isBuyer isNonprofit } }`);
  return r.ok ? { ok: true, data: r.data.myAccounts || [] } : r;
});

export type AccountOverview = {
  account: { id: string; slug: string; name: string; accountNumber: string | null; status: string; paymentTerms: string; hasCredit: boolean; settlementCycle: string | null };
  role: string;
  monthWeight: string;
  monthValueCents: number;
  openRequests: number;
  containersOnSite: number;
  unsettledCents: number;
  openInvoiceCents: number;
  currencyCode: string;
  weightUnit: 'lb' | 'kg';
};

export const getAccountOverview = cache(async (accountSlug: string): Promise<GqlResult<AccountOverview | null>> => {
  const r = await gql<{ accountOverview: AccountOverview | null }>(
    `query($accountSlug: String!) { accountOverview(accountSlug: $accountSlug) {
      account { id slug name accountNumber status paymentTerms hasCredit settlementCycle } role monthWeight monthValueCents openRequests containersOnSite unsettledCents openInvoiceCents currencyCode weightUnit
    } }`,
    { accountSlug },
  );
  if (!r.ok) return r.notFound ? { ok: true, data: null } : r;
  return { ok: true, data: r.data.accountOverview };
});

export type AccountPrice = { materialId: string; materialName: string; materialSlug: string; categoryName: string | null; unit: string; unitPrice: string; unitPriceHigh: string | null; effectiveFrom: string; effectiveTo: string | null; direction: string };

export const getAccountPrices = cache(async (accountSlug: string): Promise<GqlResult<{ priceListName: string | null; currencyCode: string; items: AccountPrice[] }>> => {
  const r = await gql<{ accountPrices: { priceListName: string | null; currencyCode: string; items: AccountPrice[] } | null }>(
    `query($accountSlug: String!) { accountPrices(accountSlug: $accountSlug) { priceListName currencyCode items { materialId materialName materialSlug categoryName unit unitPrice unitPriceHigh effectiveFrom effectiveTo direction } } }`,
    { accountSlug },
  );
  return r.ok ? { ok: true, data: r.data.accountPrices || { priceListName: null, currencyCode: 'USD', items: [] } } : r;
});

export type AccountTicketRow = { id: string; displayNumber: string; status: string; completedAt: string | null; createdAt: string; totalCents: number; netWeight: string | null; siteName: string | null; materials: string | null; yard: { name: string; timezone: string | null } | null };

export async function getAccountTickets(accountSlug: string, f: { siteId?: string | null; materialId?: string | null; from?: string | null; to?: string | null; take?: number; skip?: number }): Promise<GqlResult<{ count: number; currencyCode: string; items: AccountTicketRow[] }>> {
  const r = await gql<{ accountTickets: { count: number; currencyCode: string; items: AccountTicketRow[] } | null }>(
    `query($accountSlug: String!, $siteId: ID, $materialId: ID, $from: String, $to: String, $take: Int, $skip: Int) {
      accountTickets(accountSlug: $accountSlug, siteId: $siteId, materialId: $materialId, from: $from, to: $to, take: $take, skip: $skip) {
        count currencyCode items { id displayNumber status completedAt createdAt totalCents netWeight siteName materials yard { name timezone } }
      } }`,
    { accountSlug, siteId: f.siteId || null, materialId: f.materialId || null, from: f.from || null, to: f.to || null, take: f.take ?? 25, skip: f.skip ?? 0 },
  );
  return r.ok ? { ok: true, data: r.data.accountTickets || { count: 0, currencyCode: 'USD', items: [] } } : r;
}

export const getAccountTicket = cache(async (accountSlug: string, id: string): Promise<GqlResult<(Receipt & { id: string }) | null>> => {
  const r = await gql<{ accountTicket: RawReceipt | null }>(`query($accountSlug: String!, $id: ID!) { accountTicket(accountSlug: $accountSlug, id: $id) { ${RECEIPT_FIELDS} } }`, { accountSlug, id });
  if (!r.ok) return r.notFound ? { ok: true, data: null } : r;
  return { ok: true, data: r.data.accountTicket ? await toReceipt(r.data.accountTicket) : null };
});

export type SiteView = { id: string; name: string; addressLine1: string | null; addressLine2: string | null; city: string | null; region: string | null; postalCode: string | null; contactName: string | null; contactPhone: string | null; accessNotes: string | null; isActive: boolean };

export const getAccountSites = cache(async (accountSlug: string): Promise<GqlResult<SiteView[]>> => {
  const r = await gql<{ accountSites: SiteView[] | null }>(`query($accountSlug: String!) { accountSites(accountSlug: $accountSlug) { id name addressLine1 addressLine2 city region postalCode contactName contactPhone accessNotes isActive } }`, { accountSlug });
  return r.ok ? { ok: true, data: r.data.accountSites || [] } : r;
});

export type ContainerView = { id: string; number: string; status: string; placedOn: string | null; daysOnSite: number | null; rentalAccruingCents: number | null; type: { name: string; capacityLabel: string | null; freeRentalDays: number } | null; site: { id: string; name: string } | null; currentMaterial: { name: string } | null };

export const getAccountContainers = cache(async (accountSlug: string): Promise<GqlResult<ContainerView[]>> => {
  const r = await gql<{ accountContainers: ContainerView[] | null }>(`query($accountSlug: String!) { accountContainers(accountSlug: $accountSlug) {
    id number status placedOn daysOnSite rentalAccruingCents type { name capacityLabel freeRentalDays } site { id name } currentMaterial { name }
  } }`, { accountSlug });
  return r.ok ? { ok: true, data: r.data.accountContainers || [] } : r;
});

const REQUEST_FIELDS = `id number kind status feeCents quoteNote quoteAcceptedAt preferredDate preferredWindow itemsDescription accessNotes createdAt
  yard { name timezone phone } site { name addressLine1 city } job { scheduledDate status driverNotes }`;

export const getAccountRequests = cache(async (accountSlug: string): Promise<GqlResult<RequestView[]>> => {
  const r = await gql<{ accountServiceRequests: RequestView[] | null }>(`query($accountSlug: String!) { accountServiceRequests(accountSlug: $accountSlug) { ${REQUEST_FIELDS} } }`, { accountSlug });
  return r.ok ? { ok: true, data: r.data.accountServiceRequests || [] } : r;
});

export const getAccountRequest = cache(async (accountSlug: string, id: string): Promise<GqlResult<RequestView | null>> => {
  const r = await gql<{ accountServiceRequest: RequestView | null }>(`query($accountSlug: String!, $id: ID!) { accountServiceRequest(accountSlug: $accountSlug, id: $id) { ${REQUEST_FIELDS} } }`, { accountSlug, id });
  if (!r.ok) return r.notFound ? { ok: true, data: null } : r;
  return { ok: true, data: r.data.accountServiceRequest };
});

export type SettlementView = { id: string; number: number; status: string; periodStart: string; periodEnd: string; ticketTotalCents: number; chargeTotalCents: number; donationTotalCents: number; netCents: number; paidAt: string | null; payoutStatus: string | null };
export type ChargeView = { id: string; kind: string; description: string | null; amountCents: number; serviceDate: string | null; status: string; containerNumber: string | null };

export const getAccountStatements = cache(async (accountSlug: string): Promise<GqlResult<{ currencyCode: string; settlements: SettlementView[]; charges: ChargeView[] }>> => {
  const r = await gql<{ accountSettlements: SettlementView[] | null; accountCharges: ChargeView[] | null; accountOverview: { currencyCode: string } | null }>(
    `query($accountSlug: String!) {
      accountSettlements(accountSlug: $accountSlug) { id number status periodStart periodEnd ticketTotalCents chargeTotalCents donationTotalCents netCents paidAt payoutStatus }
      accountCharges(accountSlug: $accountSlug, unsettledOnly: true) { id kind description amountCents serviceDate status containerNumber }
      accountOverview(accountSlug: $accountSlug) { currencyCode }
    }`,
    { accountSlug },
  );
  return r.ok ? { ok: true, data: { currencyCode: r.data.accountOverview?.currencyCode || 'USD', settlements: r.data.accountSettlements || [], charges: r.data.accountCharges || [] } } : r;
});

export type InvoiceView = { id: string; number: number; kind: string; status: string; subtotalCents: number; taxCents: number; totalCents: number; paidCents: number; refundedCents: number; dueOn: string | null; createdAt: string; lines?: Array<{ description: string; quantity: string | null; amountCents: number }>; payments?: Array<{ id: string; amountCents: number; method: string; status: string; createdAt: string; refundedCents: number }> };

export const getAccountInvoices = cache(async (accountSlug: string): Promise<GqlResult<{ currencyCode: string; items: InvoiceView[] }>> => {
  const r = await gql<{ accountInvoices: InvoiceView[] | null; accountOverview: { currencyCode: string } | null }>(
    `query($accountSlug: String!) { accountInvoices(accountSlug: $accountSlug) { id number kind status subtotalCents taxCents totalCents paidCents refundedCents dueOn createdAt } accountOverview(accountSlug: $accountSlug) { currencyCode } }`,
    { accountSlug },
  );
  return r.ok ? { ok: true, data: { currencyCode: r.data.accountOverview?.currencyCode || 'USD', items: r.data.accountInvoices || [] } } : r;
});

export const getAccountInvoice = cache(async (accountSlug: string, id: string): Promise<GqlResult<{ currencyCode: string; invoice: InvoiceView | null }>> => {
  const r = await gql<{ accountInvoice: InvoiceView | null; accountOverview: { currencyCode: string } | null }>(
    `query($accountSlug: String!, $id: ID!) {
      accountInvoice(accountSlug: $accountSlug, id: $id) { id number kind status subtotalCents taxCents totalCents paidCents refundedCents dueOn createdAt lines { description quantity amountCents } payments { id amountCents method status createdAt refundedCents } }
      accountOverview(accountSlug: $accountSlug) { currencyCode }
    }`,
    { accountSlug, id },
  );
  if (!r.ok) return r.notFound ? { ok: true, data: { currencyCode: 'USD', invoice: null } } : r;
  return { ok: true, data: { currencyCode: r.data.accountOverview?.currencyCode || 'USD', invoice: r.data.accountInvoice } };
});

export type DiversionRow = { month: string; materialName: string; categoryName: string | null; weight: string; valueCents: number };

export const getDiversionReport = cache(async (accountSlug: string, year: number): Promise<GqlResult<{ weightUnit: string; currencyCode: string; rows: DiversionRow[] }>> => {
  const r = await gql<{ accountDiversionReport: { weightUnit: string; currencyCode: string; rows: DiversionRow[] } | null }>(
    `query($accountSlug: String!, $year: Int!) { accountDiversionReport(accountSlug: $accountSlug, year: $year) { weightUnit currencyCode rows { month materialName categoryName weight valueCents } } }`,
    { accountSlug, year },
  );
  return r.ok ? { ok: true, data: r.data.accountDiversionReport || { weightUnit: 'lb', currencyCode: 'USD', rows: [] } } : r;
});
