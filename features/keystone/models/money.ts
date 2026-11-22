import { list } from '@keystone-6/core'
import { anyOf, appendOnlyList, denyAll, permissions, serverOnlyField, staffList } from '../access'
import { trackingFields } from './trackingFields'
import { UNITS } from './catalog'
import {
  checkbox, choice, commandCents, commandJson, commandOnlyFieldText as cmd, commandWeight, integer, json, relationship, status, text, timestamp,
  unitPrice, weight,
} from './shared'

const cashStaff = anyOf('canPaySellers', 'canManageCashDrawers')
const financeStaff = permissions.canManageFinance

// §6.6 Payout
export const Payout = list({
  access: staffList({ read: anyOf('canPaySellers', 'canManageFinance', 'canManageTickets', 'canViewReports'), create: denyAll, update: denyAll, delete: denyAll, yard: 'ticket.yard' }),
  fields: {
    ticket: relationship({ ref: 'ScaleTicket.payouts', ...cmd }),
    lines: relationship({ ref: 'TicketLine.payout', many: true, ...cmd }),
    settlement: relationship({ ref: 'Settlement', ...cmd }),
    seller: relationship({ ref: 'Seller', ...cmd }),
    account: relationship({ ref: 'Account', ...cmd }),
    amountCents: commandCents(),
    status: status(['pending', 'held', 'ready', 'paid', 'cancelled', 'returned'], 'pending'),
    allowedMethods: commandJson({ defaultValue: ['cash', 'check', 'transfer'] }),
    method: choice(['cash', 'check', 'transfer'], undefined, cmd),
    releaseAt: timestamp({ ...cmd }),
    checkNumber: text({ ...cmd , db: { isNullable: true } }),
    bankAccountLabel: text({ ...cmd , db: { isNullable: true } }),
    transferReference: text({ ...cmd }),
    mailToAddress: text({ ...cmd }),
    paidBy: relationship({ ref: 'User', ...cmd }),
    paidAt: timestamp({ ...cmd }),
    drawerSession: relationship({ ref: 'CashDrawerSession', ...cmd }),
    replaces: relationship({ ref: 'Payout', ...cmd }),
    returnReason: text({ ...cmd }),
    cancelReason: text({ ...cmd }),
    idempotencyKeyHash: text({ ...serverOnlyField, isIndexed: 'unique' , db: { isNullable: true } }),
    ...trackingFields,
  },
})

// §6.6 CashDrawer
export const CashDrawer = list({
  access: staffList({ create: permissions.canManageSettings, update: permissions.canManageSettings, delete: denyAll, yard: 'yard' }),
  fields: {
    yard: relationship({ ref: 'Yard.drawers' }),
    name: text({ validation: { isRequired: true } }),
    isActive: checkbox({ defaultValue: true }),
    sessions: relationship({ ref: 'CashDrawerSession.drawer', many: true, ui: { itemView: { fieldMode: 'read' } } }),
    ...trackingFields,
  },
})

// §6.6 CashDrawerSession. One open session per drawer and per cashier (partial unique indexes).
export const CashDrawerSession = list({
  access: staffList({ read: anyOf('canPaySellers', 'canManageCashDrawers', 'canApproveVariances', 'canManageFinance'), create: denyAll, update: denyAll, delete: denyAll, yard: 'drawer.yard' }),
  fields: {
    drawer: relationship({ ref: 'CashDrawer.sessions', ...cmd }),
    cashier: relationship({ ref: 'User', ...cmd }),
    status: status(['open', 'counting', 'closed'], 'open'),
    openingFloatCents: commandCents(),
    expectedCents: commandCents(),
    countedCents: integer({ ...cmd }),
    varianceCents: integer({ ...cmd }),
    openedAt: timestamp({ defaultValue: { kind: 'now' }, ...cmd }),
    closedAt: timestamp({ ...cmd }),
    approvedBy: relationship({ ref: 'User', ...cmd }),
    approvalNote: text({ ...cmd }),
    events: relationship({ ref: 'CashDrawerEvent.session', many: true, ...cmd }),
    ...trackingFields,
  },
})

// §6.6 CashDrawerEvent (append-only). referenceKey `payout:<id>` makes a payout's cash leave once.
export const CashDrawerEvent = list({
  access: appendOnlyList({ read: cashStaff, yard: 'session.drawer.yard' }),
  fields: {
    session: relationship({ ref: 'CashDrawerSession.events', ...cmd }),
    kind: choice(['open', 'payout', 'collect', 'add', 'drop'], 'add', cmd),
    amountCents: commandCents(),
    payout: relationship({ ref: 'Payout', ...cmd }),
    ticket: relationship({ ref: 'ScaleTicket', ...cmd }),
    note: text({ ...cmd }),
    referenceKey: text({ isIndexed: 'unique', validation: { isRequired: true }, ...cmd }),
    createdBy: relationship({ ref: 'User', ...cmd }),
    ...trackingFields,
  },
})

// §6.6 AccountCharge
export const AccountCharge = list({
  // The plain `accountCharges` query is the customer portal's (§8.3 C9); the list keeps its own name.
  graphql: { plural: 'AccountChargeItems' },
  access: staffList({ read: anyOf('canManageFinance', 'canManageAccounts', 'canManageDispatch'), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    account: relationship({ ref: 'Account', ...cmd }),
    kind: choice(['delivery', 'haul', 'rental', 'dry_run', 'processing', 'other'], 'other', cmd),
    description: text({ ...cmd }),
    amountCents: commandCents(),
    job: relationship({ ref: 'DispatchJob', ...cmd }),
    container: relationship({ ref: 'Container', ...cmd }),
    serviceDate: timestamp({ ...cmd }),
    referenceKey: text({ isIndexed: 'unique', ...cmd , db: { isNullable: true } }),
    settlement: relationship({ ref: 'Settlement.charges', ...cmd }),
    invoiceLine: relationship({ ref: 'InvoiceLine', ...cmd }),
    status: status(['open', 'settled', 'invoiced', 'waived'], 'open'),
    ...trackingFields,
  },
})

// §6.6 Settlement
export const Settlement = list({
  access: staffList({ read: anyOf('canManageFinance', 'canManageAccounts'), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    account: relationship({ ref: 'Account', ...cmd }),
    number: integer({ ...cmd }),
    status: status(['draft', 'approved', 'paid', 'void'], 'draft'),
    periodStart: timestamp({ ...cmd }),
    periodEnd: timestamp({ ...cmd }),
    tickets: relationship({ ref: 'ScaleTicket.settlement', many: true, ...cmd }),
    charges: relationship({ ref: 'AccountCharge.settlement', many: true, ...cmd }),
    donations: relationship({ ref: 'Donation.settlement', many: true, ...cmd }),
    ticketTotalCents: commandCents(),
    chargeTotalCents: commandCents(),
    donationTotalCents: commandCents(),
    netCents: commandCents(),
    payout: relationship({ ref: 'Payout', ...cmd }),
    invoice: relationship({ ref: 'Invoice', ...cmd }),
    approvedBy: relationship({ ref: 'User', ...cmd }),
    approvedAt: timestamp({ ...cmd }),
    paidAt: timestamp({ ...cmd }),
    voidReason: text({ ...cmd }),
    ...trackingFields,
  },
})

// §6.8 Invoice
export const Invoice = list({
  access: staffList({ read: anyOf('canManageFinance', 'canManageSales', 'canManageAccounts', 'canManageDispatch'), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    number: integer({ ...cmd }),
    account: relationship({ ref: 'Account', ...cmd }),
    seller: relationship({ ref: 'Seller', ...cmd }),
    kind: choice(['sale', 'settlement_balance', 'service', 'fee_ticket'], 'sale', cmd),
    status: status(['open', 'partially_paid', 'paid', 'void'], 'open'),
    lines: relationship({ ref: 'InvoiceLine.invoice', many: true, ...cmd }),
    subtotalCents: commandCents(),
    taxCents: commandCents(),
    totalCents: commandCents(),
    paidCents: commandCents(),
    refundedCents: commandCents(),
    dueOn: timestamp({ ...cmd }),
    shipment: relationship({ ref: 'Shipment', ...cmd }),
    settlement: relationship({ ref: 'Settlement', ...cmd }),
    serviceRequest: relationship({ ref: 'ServiceRequest', ...cmd }),
    ticket: relationship({ ref: 'ScaleTicket', ...cmd }),
    payments: relationship({ ref: 'Payment.invoice', many: true, ...cmd }),
    voidReason: text({ ...cmd }),
    ...trackingFields,
  },
})

// §6.8 InvoiceLine
export const InvoiceLine = list({
  access: staffList({ read: anyOf('canManageFinance', 'canManageSales', 'canManageAccounts'), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    invoice: relationship({ ref: 'Invoice.lines', ...cmd }),
    description: text({ ...cmd }),
    material: relationship({ ref: 'Material', ...cmd }),
    weight: weight({ ...cmd }),
    unit: choice([...UNITS], undefined, cmd),
    unitPrice: unitPrice({ ...cmd }),
    amountCents: commandCents(),
    kind: choice(['material', 'freight', 'fee', 'adjustment', 'credit'], 'material', cmd),
    claim: relationship({ ref: 'Claim', ...cmd }),
    ...trackingFields,
  },
})

// §6.8 Claim
export const Claim = list({
  access: staffList({ read: anyOf('canManageSales', 'canManageFinance'), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    shipment: relationship({ ref: 'Shipment', ...cmd }),
    account: relationship({ ref: 'Account', ...cmd }),
    openedBy: relationship({ ref: 'User', ...cmd }),
    kind: choice(['short_weight', 'contamination', 'wrong_grade', 'damage', 'other'], 'other', cmd),
    description: text({ ...cmd }),
    photos: json({ defaultValue: [], ...cmd }),
    claimedCents: commandCents(),
    status: status(['open', 'accepted', 'rejected', 'withdrawn'], 'open'),
    creditCents: commandCents(),
    decisionReason: text({ ...cmd }),
    decidedBy: relationship({ ref: 'User', ...cmd }),
    decidedAt: timestamp({ ...cmd }),
    ...trackingFields,
  },
})

// §6.9 PaymentProvider (adapted from Barbershop). Credentials never leave the server.
export const PaymentProvider = list({
  access: staffList({ read: anyOf('canManageSettings', 'canManageFinance'), create: permissions.canManageSettings, update: permissions.canManageSettings, delete: denyAll }),
  fields: {
    name: text({ validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    isInstalled: checkbox({ defaultValue: true }),
    credentials: json({ ...serverOnlyField }),
    metadata: json(),
    ...trackingFields,
  },
})

// §6.9 PaymentSession (adapted from Barbershop). Capture is idempotent on providerPaymentId.
export const PaymentSession = list({
  access: staffList({ read: anyOf('canManageFinance', 'canPaySellers'), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    provider: relationship({ ref: 'PaymentProvider', ...cmd }),
    invoice: relationship({ ref: 'Invoice', ...cmd }),
    serviceRequest: relationship({ ref: 'ServiceRequest.paymentSession', ...cmd }),
    ticket: relationship({ ref: 'ScaleTicket', ...cmd }),
    payer: relationship({ ref: 'User', ...cmd }),
    amountCents: commandCents(),
    currencyCode: text({ defaultValue: 'USD', ...cmd }),
    status: status(['pending', 'requires_action', 'authorized', 'captured', 'failed', 'cancelled', 'refunded', 'partially_refunded'], 'pending'),
    providerPaymentId: text({ isIndexed: 'unique', ...cmd , db: { isNullable: true } }),
    clientSecret: text({ ...serverOnlyField }),
    idempotencyKeyHash: text({ isIndexed: 'unique', ...serverOnlyField , db: { isNullable: true } }),
    capturedAt: timestamp({ ...cmd }),
    capturedCents: commandCents(),
    refundedCents: commandCents(),
    expiresAt: timestamp({ ...cmd }),
    metadata: json({ ...cmd }),
    ...trackingFields,
  },
})

// §6.9 Payment (money received against an invoice)
export const Payment = list({
  access: staffList({ read: permissions.canManageFinance, create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    invoice: relationship({ ref: 'Invoice.payments', ...cmd }),
    session: relationship({ ref: 'PaymentSession', ...cmd }),
    method: choice(['card', 'wire', 'ach', 'check', 'cash'], 'card', cmd),
    amountCents: commandCents(),
    reference: text({ ...cmd }),
    referenceKey: text({ isIndexed: 'unique', ...cmd , db: { isNullable: true } }),
    receivedAt: timestamp({ defaultValue: { kind: 'now' }, ...cmd }),
    recordedBy: relationship({ ref: 'User', ...cmd }),
    status: status(['succeeded', 'reversed'], 'succeeded'),
    refundedCents: commandCents(),
    ...trackingFields,
  },
})

// §6.9 Refund. Never more than captured less already refunded (checked under a row lock).
export const Refund = list({
  access: staffList({ read: permissions.canManageFinance, create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    payment: relationship({ ref: 'Payment', ...cmd }),
    session: relationship({ ref: 'PaymentSession', ...cmd }),
    amountCents: commandCents(),
    reason: text({ ...cmd }),
    status: status(['pending', 'succeeded', 'failed'], 'pending'),
    providerRefundId: text({ isIndexed: 'unique', ...cmd , db: { isNullable: true } }),
    failureMessage: text({ ...cmd }),
    claim: relationship({ ref: 'Claim', ...cmd }),
    serviceRequest: relationship({ ref: 'ServiceRequest', ...cmd }),
    createdBy: relationship({ ref: 'User', ...cmd }),
    idempotencyKeyHash: text({ isIndexed: 'unique', ...serverOnlyField , db: { isNullable: true } }),
    ...trackingFields,
  },
})

// §6.9 PaymentWebhookEvent (append-only, deduped by provider event id)
export const PaymentWebhookEvent = list({
  access: appendOnlyList({ read: permissions.canManageFinance }),
  fields: {
    provider: text({ validation: { isRequired: true }, ...cmd }),
    providerEventId: text({ isIndexed: 'unique', validation: { isRequired: true }, ...cmd }),
    type: text({ ...cmd }),
    payloadHash: text({ ...cmd }),
    processedAt: timestamp({ ...cmd }),
    result: json({ ...cmd }),
    ...trackingFields,
  },
})

export { commandWeight }
