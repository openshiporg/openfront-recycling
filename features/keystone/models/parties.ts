import { list } from '@keystone-6/core'
import { anyOf, denyAll, permissions, serverOnlyField, staffList } from '../access'
import { trackingFields } from './trackingFields'
import {
  addressFields, checkbox, choice, decimal, commandOnlyFieldText, file, image, integer, json, relationship, status, text, timestamp, weight,
} from './shared'

const sellerStaff = anyOf('canManageSellers', 'canManageTickets')
const accountStaff = permissions.canManageAccounts

// §6.4 Seller
export const Seller = list({
  access: staffList({ create: sellerStaff, update: sellerStaff, delete: denyAll }),
  ui: { labelField: 'lastName', listView: { initialColumns: ['firstName', 'lastName', 'phone', 'status', 'idVerification'] } },
  fields: {
    user: relationship({ ref: 'User.sellerProfile', isFilterable: true }),
    firstName: text({ validation: { isRequired: true } }),
    lastName: text({ validation: { isRequired: true } }),
    searchName: text({ ...commandOnlyFieldText, isIndexed: true, ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } } }),
    dateOfBirth: timestamp(),
    phone: text({ isIndexed: true }),
    email: text(),
    ...addressFields(),
    status: status(['active', 'flagged', 'do_not_buy'], 'active'),
    statusReason: text({ ...commandOnlyFieldText }),
    idVerification: status(['unverified', 'verified', 'expired'], 'unverified'),
    preferredPayout: choice(['cash', 'check', 'transfer'], 'cash'),
    priceList: relationship({ ref: 'PriceList' }),
    defaultNonprofit: relationship({ ref: 'Account' }),
    notes: text({ ui: { displayMode: 'textarea' } }),
    identityDocuments: relationship({ ref: 'IdentityDocument.seller', many: true }),
    vehicles: relationship({ ref: 'Vehicle.seller', many: true }),
    tickets: relationship({ ref: 'ScaleTicket.seller', many: true, ui: { itemView: { fieldMode: 'read' } } }),
    ...trackingFields,
  },
  hooks: {
    resolveInput: ({ resolvedData, item }) => {
      const first = resolvedData.firstName ?? item?.firstName
      const last = resolvedData.lastName ?? item?.lastName
      if (resolvedData.firstName !== undefined || resolvedData.lastName !== undefined) {
        resolvedData.searchName = `${first || ''} ${last || ''}`.trim().toLowerCase()
      }
      return resolvedData
    },
  },
})

// §6.4 IdentityDocument (staff only; images on private storage, served through an authorised route).
export const IdentityDocument = list({
  access: staffList({ read: sellerStaff, create: sellerStaff, update: sellerStaff, delete: denyAll }),
  fields: {
    seller: relationship({ ref: 'Seller.identityDocuments' }),
    kind: choice(['drivers_license', 'state_id', 'passport', 'military_id', 'other'], 'drivers_license'),
    number: text({ validation: { isRequired: true } }),
    numberNormalized: text({ ...serverOnlyField, isIndexed: true }),
    issuer: text(),
    expiresOn: timestamp(),
    frontImage: image({ storage: 'private_images' }),
    backImage: image({ storage: 'private_images' }),
    thumbprintImage: image({ storage: 'private_images' }),
    verifiedBy: relationship({ ref: 'User', ...commandOnlyFieldText }),
    verifiedAt: timestamp({ ...commandOnlyFieldText }),
    isCurrent: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
  hooks: {
    resolveInput: ({ resolvedData }) => {
      if (typeof resolvedData.number === 'string') resolvedData.numberNormalized = resolvedData.number.replace(/[^a-z0-9]/gi, '').toUpperCase()
      return resolvedData
    },
  },
})

// §6.4 Vehicle
export const Vehicle = list({
  access: staffList({ create: sellerStaff, update: sellerStaff, delete: sellerStaff }),
  ui: { labelField: 'plate' },
  fields: {
    seller: relationship({ ref: 'Seller.vehicles' }),
    account: relationship({ ref: 'Account.vehicles' }),
    plate: text({ isIndexed: true }),
    plateRegion: text(),
    make: text(),
    model: text(),
    color: text(),
    kind: choice(['car', 'pickup', 'box_truck', 'trailer', 'roll_off', 'semi', 'other'], 'pickup'),
    storedTare: weight(),
    storedTareExpiresOn: timestamp(),
    isRemoved: checkbox({ defaultValue: false }),
    ...trackingFields,
  },
  hooks: {
    resolveInput: ({ resolvedData }) => {
      if (typeof resolvedData.plate === 'string') resolvedData.plate = resolvedData.plate.replace(/\s+/g, '').toUpperCase()
      return resolvedData
    },
  },
})

// §6.4 Account
export const Account = list({
  access: staffList({ create: accountStaff, update: accountStaff, delete: denyAll }),
  ui: { listView: { initialColumns: ['name', 'accountNumber', 'status', 'isSupplier', 'isBuyer', 'isNonprofit'] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    legalName: text(),
    slug: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    accountNumber: text({ isIndexed: 'unique', ...commandOnlyFieldText , db: { isNullable: true } }),
    status: status(['active', 'suspended'], 'active'),
    statusReason: text({ ...commandOnlyFieldText }),
    isSupplier: checkbox({ defaultValue: false }),
    isBuyer: checkbox({ defaultValue: false }),
    isNonprofit: checkbox({ defaultValue: false }),
    taxId: text(),
    ein: text(),
    billingAddressLine1: text(),
    billingAddressLine2: text(),
    billingCity: text(),
    billingRegion: text(),
    billingPostalCode: text(),
    billingCountry: text({ defaultValue: 'US' }),
    billingEmail: text(),
    phone: text(),
    paymentTerms: choice(['pay_at_scale', 'on_account', 'prepay', 'net'], 'pay_at_scale'),
    netDays: integer({ defaultValue: 0 }),
    settlementCycle: choice(['weekly', 'semi_monthly', 'monthly'], 'monthly'),
    weightBasis: choice(['shipped', 'received'], 'shipped'),
    hasCredit: checkbox({ defaultValue: false }),
    priceList: relationship({ ref: 'PriceList.accounts' }),
    nonprofitSummary: text({ ui: { displayMode: 'textarea' } }),
    nonprofitWebsite: text(),
    nonprofitLogo: image({ storage: 'my_images' }),
    isPublicNonprofit: checkbox({ defaultValue: false }),
    contacts: relationship({ ref: 'AccountContact.account', many: true }),
    sites: relationship({ ref: 'ServiceSite.account', many: true }),
    documents: relationship({ ref: 'AccountDocument.account', many: true }),
    vehicles: relationship({ ref: 'Vehicle.account', many: true }),
    notes: text({ ui: { displayMode: 'textarea' } }),
    ...trackingFields,
  },
})

// §6.4 AccountContact. Unique (account, user) via prismaConstraints.
export const AccountContact = list({
  access: staffList({ create: accountStaff, update: accountStaff, delete: denyAll }),
  fields: {
    account: relationship({ ref: 'Account.contacts' }),
    user: relationship({ ref: 'User.accountContacts' }),
    role: choice(['admin', 'member', 'billing', 'driver'], 'member'),
    status: status(['active', 'invited', 'removed'], 'active'),
    inviteEmail: text(),
    inviteTokenHash: text({ ...serverOnlyField, isIndexed: 'unique' , db: { isNullable: true } }),
    ...trackingFields,
  },
})

// §6.4 AccountApplication
export const AccountApplication = list({
  access: staffList({ read: accountStaff, create: denyAll, update: accountStaff, delete: denyAll }),
  ui: { labelField: 'businessName' },
  fields: {
    applicant: relationship({ ref: 'User', ...commandOnlyFieldText }),
    kind: choice(['supplier', 'buyer', 'nonprofit'], 'supplier', commandOnlyFieldText),
    businessName: text({ validation: { isRequired: true } }),
    legalName: text(),
    taxId: text(),
    ...addressFields(),
    phone: text(),
    email: text(),
    materials: json(),
    monthlyVolume: text(),
    containerNeeds: text(),
    message: text({ ui: { displayMode: 'textarea' } }),
    w9: file({ storage: 'private_files' }),
    status: status(['submitted', 'approved', 'declined', 'withdrawn'], 'submitted'),
    decisionReason: text({ ...commandOnlyFieldText }),
    decidedBy: relationship({ ref: 'User', ...commandOnlyFieldText }),
    decidedAt: timestamp({ ...commandOnlyFieldText }),
    account: relationship({ ref: 'Account', ...commandOnlyFieldText }),
    ...trackingFields,
  },
})

// §6.4 AccountDocument
export const AccountDocument = list({
  // The portal read `accountDocuments` (C12) uses the plain name; the staff list query is accountDocumentItems.
  graphql: { plural: 'AccountDocumentItems' },
  access: staffList({ create: anyOf('canManageAccounts', 'canManageFinance'), update: anyOf('canManageAccounts', 'canManageFinance'), delete: accountStaff }),
  fields: {
    account: relationship({ ref: 'Account.documents' }),
    ticket: relationship({ ref: 'ScaleTicket' }),
    kind: choice(['w9', 'licence', 'insurance', 'contract', 'certificate', 'other'], 'other'),
    file: file({ storage: 'private_files' }),
    title: text({ validation: { isRequired: true } }),
    body: text({ ...commandOnlyFieldText, ui: { ...commandOnlyFieldText.ui, displayMode: 'textarea' } }),
    visibleToAccount: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})

// §6.4 ServiceSite
export const ServiceSite = list({
  access: staffList({ create: anyOf('canManageAccounts', 'canManageDispatch'), update: anyOf('canManageAccounts', 'canManageDispatch'), delete: denyAll }),
  fields: {
    account: relationship({ ref: 'Account.sites' }),
    seller: relationship({ ref: 'Seller' }),
    name: text({ validation: { isRequired: true } }),
    ...addressFields(),
    contactName: text(),
    contactPhone: text(),
    accessNotes: text({ ui: { displayMode: 'textarea' } }),
    latitude: decimal({ precision: 9, scale: 6 }),
    longitude: decimal({ precision: 9, scale: 6 }),
    isActive: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})
