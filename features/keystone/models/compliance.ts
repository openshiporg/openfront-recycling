import { list } from '@keystone-6/core'
import { anyOf, appendOnlyList, denyAll, permissions, staffList } from '../access'
import { trackingFields } from './trackingFields'
import {
  checkbox, choice, commandOnlyFieldText as cmd, commandWeight, file, integer, json, relationship, status, text, timestamp,
} from './shared'

const complianceStaff = permissions.canManageCompliance
const rulesEditors = anyOf('canManageCompliance', 'canManageSettings')

// §6.12 RulesProfile. Staff only; the storefront gets a summary through publicYardRules.
export const RulesProfile = list({
  access: staffList({ create: rulesEditors, update: rulesEditors, delete: denyAll }),
  fields: {
    name: text({ validation: { isRequired: true } }),
    region: text(),
    template: choice(['general', 'ohio', 'florida', 'custom'], 'general'),
    requireGovernmentId: checkbox({ defaultValue: true }),
    requireIdPhoto: checkbox({ defaultValue: true }),
    requireSellerPhoto: checkbox({ defaultValue: false }),
    requireMaterialPhoto: checkbox({ defaultValue: true }),
    requireVehiclePlate: checkbox({ defaultValue: true }),
    requireSignature: checkbox({ defaultValue: true }),
    requireThumbprint: checkbox({ defaultValue: false }),
    minimumSellerAge: integer({ defaultValue: 18, validation: { isRequired: true } }),
    cashLimitPerTicketCents: integer(),
    cashLimitPerDayCents: integer(),
    cashRounding: choice(['none', 'nickel_up'], 'none'),
    defaultPaymentHoldDays: integer({ defaultValue: 0, validation: { isRequired: true } }),
    defaultMaterialHoldDays: integer({ defaultValue: 0, validation: { isRequired: true } }),
    allowEarlyRelease: checkbox({ defaultValue: false }),
    retentionDays: integer({ defaultValue: 730, validation: { isRequired: true } }),
    dailyReport: checkbox({ defaultValue: false }),
    reportDueTime: text(),
    reportOmitsPrice: checkbox({ defaultValue: false }),
    ownershipStatement: text({
      ui: { displayMode: 'textarea' },
      defaultValue: 'I am the lawful owner of the material sold on this ticket, or I am authorised by the owner to sell it.',
    }),
    restrictions: relationship({ ref: 'MaterialRestriction.profile', many: true }),
    ...trackingFields,
  },
})

// §6.12 MaterialRestriction
export const MaterialRestriction = list({
  access: staffList({ create: rulesEditors, update: rulesEditors, delete: rulesEditors }),
  fields: {
    profile: relationship({ ref: 'RulesProfile.restrictions' }),
    material: relationship({ ref: 'Material' }),
    category: relationship({ ref: 'MaterialCategory' }),
    label: text({ validation: { isRequired: true } }),
    kind: choice(['prohibited', 'proof_of_ownership', 'commercial_only', 'payment_rule'], 'payment_rule'),
    requiredDocuments: json({ defaultValue: [] }),
    forbidCash: checkbox({ defaultValue: false }),
    allowedMethods: json(),
    paymentHoldDays: integer({ defaultValue: 0 }),
    materialHoldDays: integer({ defaultValue: 0 }),
    mailCheckOnly: checkbox({ defaultValue: false }),
    publicNote: text({ ui: { displayMode: 'textarea' } }),
    ...trackingFields,
  },
})

// §6.12 HoldTag
export const HoldTag = list({
  access: staffList({ read: anyOf('canManageCompliance', 'canManageInventory', 'canManageTickets', 'canPaySellers'), create: denyAll, update: denyAll, delete: denyAll, yard: 'yard' }),
  fields: {
    ticket: relationship({ ref: 'ScaleTicket.holdTags', ...cmd }),
    line: relationship({ ref: 'TicketLine', ...cmd }),
    yard: relationship({ ref: 'Yard', ...cmd }),
    material: relationship({ ref: 'Material', ...cmd }),
    weight: commandWeight(),
    kind: choice(['material', 'police'], 'material', cmd),
    status: status(['held', 'released', 'police_hold', 'seized', 'cancelled'], 'held'),
    releaseAt: timestamp({ ...cmd }),
    releasedBy: relationship({ ref: 'User', ...cmd }),
    releasedAt: timestamp({ ...cmd }),
    releaseReason: text({ ...cmd }),
    caseNumber: text({ ...cmd }),
    agency: text({ ...cmd }),
    ...trackingFields,
  },
})

// §6.12 DoNotBuyEntry (never exposed to customers)
export const DoNotBuyEntry = list({
  access: staffList({ read: anyOf('canManageCompliance', 'canManageTickets', 'canManageSellers'), create: complianceStaff, update: complianceStaff, delete: denyAll }),
  ui: { labelField: 'lastName' },
  fields: {
    firstName: text(),
    lastName: text(),
    nameNormalized: text({ isIndexed: true, ...cmd, ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } } }),
    dateOfBirth: timestamp(),
    idNumber: text(),
    idNumberNormalized: text({ isIndexed: true, ...cmd, ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } } }),
    plate: text(),
    plateNormalized: text({ isIndexed: true, ...cmd, ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } } }),
    source: choice(['yard', 'court', 'state_list', 'law_enforcement'], 'yard'),
    reason: text({ ui: { displayMode: 'textarea' } }),
    expiresOn: timestamp(),
    isActive: checkbox({ defaultValue: true }),
    seller: relationship({ ref: 'Seller' }),
    addedBy: relationship({ ref: 'User', ...cmd }),
    ...trackingFields,
  },
  hooks: {
    resolveInput: ({ resolvedData, item, context, operation }) => {
      const first = resolvedData.firstName ?? item?.firstName ?? ''
      const last = resolvedData.lastName ?? item?.lastName ?? ''
      resolvedData.nameNormalized = `${first} ${last}`.trim().toLowerCase().replace(/\s+/g, ' ')
      const id = resolvedData.idNumber ?? item?.idNumber
      resolvedData.idNumberNormalized = id ? String(id).replace(/[^a-z0-9]/gi, '').toUpperCase() : ''
      const plate = resolvedData.plate ?? item?.plate
      resolvedData.plateNormalized = plate ? String(plate).replace(/[^a-z0-9]/gi, '').toUpperCase() : ''
      if (operation === 'create' && context.session?.itemId) resolvedData.addedBy = { connect: { id: context.session.itemId } }
      return resolvedData
    },
  },
})

// §6.12 TheftAlert
export const TheftAlert = list({
  access: staffList({ create: complianceStaff, update: complianceStaff, delete: denyAll }),
  fields: {
    title: text({ validation: { isRequired: true } }),
    description: text({ ui: { displayMode: 'textarea' } }),
    materials: relationship({ ref: 'Material', many: true }),
    keywords: text(),
    reportedOn: timestamp({ defaultValue: { kind: 'now' } }),
    agency: text(),
    contact: text(),
    sourceUrl: text(),
    expiresOn: timestamp(),
    isActive: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})

// §6.12 ComplianceReport. Unique (yard, reportDate).
export const ComplianceReport = list({
  access: staffList({ read: complianceStaff, create: denyAll, update: denyAll, delete: denyAll, yard: 'yard' }),
  fields: {
    yard: relationship({ ref: 'Yard', ...cmd }),
    reportDate: text({ validation: { isRequired: true }, ...cmd, ui: { description: 'YYYY-MM-DD in the yard time zone' } }),
    status: status(['generated', 'submitted'], 'generated'),
    ticketCount: integer({ defaultValue: 0, ...cmd }),
    file: file({ storage: 'private_files', ...cmd }),
    csv: text({ ...cmd, ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } } }),
    fileHash: text({ ...cmd }),
    generatedBy: relationship({ ref: 'User', ...cmd }),
    submittedBy: relationship({ ref: 'User', ...cmd }),
    submittedAt: timestamp({ ...cmd }),
    submissionNote: text({ ...cmd }),
    ...trackingFields,
  },
})

// §6.12 AuditEvent (append-only; nobody can update or delete)
export const AuditEvent = list({
  access: appendOnlyList({ read: anyOf('canManageCompliance', 'canManageFinance', 'canManageSettings'), yard: undefined }),
  fields: {
    eventKey: text({ isIndexed: 'unique', validation: { isRequired: true }, ...cmd }),
    eventType: text({ validation: { isRequired: true }, isIndexed: true, ...cmd }),
    aggregateType: text({ ...cmd }),
    aggregateId: text({ isIndexed: true, ...cmd }),
    yard: relationship({ ref: 'Yard', ...cmd }),
    actor: relationship({ ref: 'User', ...cmd }),
    before: json({ ...cmd }),
    after: json({ ...cmd }),
    reason: text({ ...cmd }),
    occurredAt: timestamp({ defaultValue: { kind: 'now' }, ...cmd }),
    ...trackingFields,
  },
})

// §6.12 CommandReceipt (as in Barbershop): idempotency key, input hash and first result.
export const CommandReceipt = list({
  access: appendOnlyList({ read: permissions.canManageSettings }),
  fields: {
    eventKey: text({ isIndexed: 'unique', validation: { isRequired: true }, ...cmd }),
    eventType: text({ validation: { isRequired: true }, ...cmd }),
    aggregateType: text({ ...cmd }),
    aggregateId: text({ ...cmd }),
    payloadHash: text({ validation: { isRequired: true }, ...cmd }),
    result: json({ ...cmd }),
    actorId: text({ ...cmd }),
    occurredAt: timestamp({ defaultValue: { kind: 'now' }, ...cmd }),
    ...trackingFields,
  },
})
