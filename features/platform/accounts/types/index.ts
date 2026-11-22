export type AccountRow = {
  id: string; name: string; accountNumber: string | null; status: string; isSupplier: boolean; isBuyer: boolean; isNonprofit: boolean;
  paymentTerms: string; netDays: number; billingCity: string | null; billingRegion: string | null; phone: string | null; priceList: { name: string } | null;
  sitesCount: number; createdAt: string;
};
export type Application = {
  id: string; kind: string; businessName: string; legalName: string | null; taxId: string | null; addressLine1: string | null; addressLine2: string | null;
  city: string | null; region: string | null; postalCode: string | null; country: string | null; phone: string | null; email: string | null;
  materials: unknown; monthlyVolume: string | null; containerNeeds: string | null; message: string | null; w9: { filename: string; url: string } | null;
  status: string; decisionReason: string | null; decidedAt: string | null; decidedBy: { name: string } | null; account: { id: string; name: string } | null;
  applicant: { name: string; email: string } | null; createdAt: string;
};
export type Contact = { id: string; role: string; status: string; inviteEmail: string | null; user: { name: string; email: string; phone: string | null } | null; createdAt: string };
export type Site = { id: string; name: string; addressLine1: string; addressLine2: string | null; city: string; region: string | null; postalCode: string | null; contactName: string | null; contactPhone: string | null; accessNotes: string | null; isActive: boolean };
export type AccountDetail = AccountRow & {
  legalName: string | null; statusReason: string | null; taxId: string | null; billingAddressLine1: string | null; billingAddressLine2: string | null; billingPostalCode: string | null;
  billingCountry: string | null; billingEmail: string | null; settlementCycle: string; weightBasis: string; hasCredit: boolean; notes: string | null; priceList: { id: string; name: string } | null;
  contacts: Contact[]; sites: Site[];
  documents: Array<{ id: string; kind: string; title: string | null; file: { filename: string; url: string } | null; visibleToAccount: boolean; createdAt: string }>;
  ticketsCount: number;
  tickets: Array<{ id: string; displayNumber: string | null; status: string; direction: string; totalCents: number | null; completedAt: string | null; createdAt: string; site: { name: string } | null; yard: { code: string; timezone: string } | null }>;
};
export type Charge = { id: string; kind: string; description: string | null; amountCents: number; status: string; serviceDate: string | null; createdAt: string };
export type SettlementRow = { id: string; number: number | null; status: string; periodStart: string; periodEnd: string; netCents: number; approvedAt: string | null; paidAt: string | null };
export type InvoiceRow = { id: string; number: number | null; kind: string; status: string; totalCents: number; paidCents: number; dueOn: string | null; createdAt: string };
export type ContainerRow = { id: string; number: string | null; status: string; daysOnSite: number | null; placedOn: string | null; type: { name: string } | null; site: { name: string } | null; currentMaterial: { name: string } | null };
export const TERMS: Record<string, string> = { pay_at_scale: 'Paid at the scale', on_account: 'On account (settlements)', prepay: 'Prepay', net: 'Net terms' };
export const CYCLES: Record<string, string> = { weekly: 'Weekly', semi_monthly: 'Twice a month', monthly: 'Monthly' };
export const CONTACT_ROLES: Record<string, string> = { admin: 'Admin', member: 'Member', billing: 'Billing', driver: 'Driver' };
export const KIND_LABEL: Record<string, string> = { supplier: 'Supplier (sells to the yard)', buyer: 'Buyer (buys from the yard)', nonprofit: 'Nonprofit' };
