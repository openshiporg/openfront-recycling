import { list } from '@keystone-6/core'
import { allowAll, denyAll, isStaff, permissions, serverOnlyField, staffList, yardFilter, type AccessArgs } from '../access'
import { trackingFields } from './trackingFields'
import {
  addressFields, checkbox, choice, commandOnlyFieldText, decimal, image, integer, json, relationship, staffRead, text, timestamp,
} from './shared'

// §6.2 BusinessSettings (singleton). Public read of the public fields only (publicBusiness query).
export const BusinessSettings = list({
  isSingleton: true,
  graphql: { plural: 'BusinessSettingsItems' },
  access: {
    operation: {
      query: permissions.canAccessDashboard,
      create: permissions.canManageSettings,
      update: permissions.canManageSettings,
      delete: denyAll,
    },
  },
  fields: {
    name: text({ validation: { isRequired: true }, defaultValue: 'Recycling' }),
    legalName: text(),
    logo: image({ storage: 'my_images' }),
    weightUnit: choice(['lb', 'kg'], 'lb'),
    currencyCode: text({ defaultValue: 'USD', validation: { isRequired: true } }),
    timezone: text({ defaultValue: 'America/New_York', validation: { isRequired: true } }),
    isNonprofit: checkbox({ defaultValue: false }),
    ein: text(),
    supportEmail: text(),
    supportPhone: text(),
    about: text({ ui: { displayMode: 'textarea' } }),
    marketVisibility: choice(['buyers_only', 'public_without_prices', 'public'], 'public_without_prices'),
    storefrontTheme: json(),
    onboardingStatus: choice(['not_started', 'in_progress', 'completed'], 'not_started'),
    ...trackingFields,
  },
})

const publicYardFilter = ({ session }: AccessArgs) => (isStaff(session) ? true : { status: { equals: 'active' } })

// §6.2 Yard. Public read (active yards).
export const Yard = list({
  access: {
    operation: { query: allowAll, create: permissions.canManageSettings, update: permissions.canManageSettings, delete: permissions.canManageSettings },
    filter: { query: publicYardFilter },
  },
  ui: { labelField: 'name', listView: { initialColumns: ['name', 'slug', 'status', 'city'] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true }, isIndexed: 'unique', defaultValue: 'MAIN', ui: { description: 'Short code printed on ticket numbers, for example MAIN.' } }),
    slug: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    status: choice(['active', 'closed'], 'active'),
    ...addressFields(),
    latitude: decimal({ precision: 9, scale: 6 }),
    longitude: decimal({ precision: 9, scale: 6 }),
    phone: text(),
    email: text(),
    timezone: text({ defaultValue: 'America/New_York' }),
    hours: json({ ui: { description: 'Per weekday open and close, e.g. {"mon":{"open":"07:00","close":"16:30"}}' } }),
    closures: relationship({ ref: 'YardClosure.yard', many: true }),
    acceptsPublic: checkbox({ defaultValue: true }),
    scaleTypes: json(),
    publicNotes: text({ ui: { displayMode: 'textarea' } }),
    payoutMethods: json({ defaultValue: ['cash', 'check', 'transfer'] }),
    rulesProfile: relationship({ ref: 'RulesProfile', ...staffRead }),
    boardPriceList: relationship({ ref: 'PriceList' }),
    feeTaxRatePercent: decimal({ precision: 6, scale: 3, defaultValue: '0', validation: { isRequired: true } }),
    scales: relationship({ ref: 'Scale.yard', many: true, ...staffRead }),
    drawers: relationship({ ref: 'CashDrawer.yard', many: true, ...staffRead }),
    staff: relationship({ ref: 'User.yards', many: true, ...staffRead }),
    ...trackingFields,
  },
})

// §6.2 YardClosure. Public read.
export const YardClosure = list({
  access: {
    operation: { query: allowAll, create: permissions.canManageSettings, update: permissions.canManageSettings, delete: permissions.canManageSettings },
  },
  fields: {
    yard: relationship({ ref: 'Yard.closures' }),
    date: timestamp({ validation: { isRequired: true } }),
    reason: text(),
    isPartial: checkbox({ defaultValue: false }),
    openTime: text(),
    closeTime: text(),
    ...trackingFields,
  },
})

// §6.2 Scale. The API key is stored only as a hash (POST /api/scale-readings).
export const Scale = list({
  access: staffList({ create: permissions.canManageSettings, update: permissions.canManageSettings, delete: permissions.canManageSettings, yard: 'yard' }),
  fields: {
    yard: relationship({ ref: 'Yard.scales' }),
    name: text({ validation: { isRequired: true } }),
    kind: choice(['truck', 'floor', 'bench'], 'truck'),
    apiKeyHash: text({ ...serverOnlyField, isIndexed: 'unique' }),
    lastReadingWeight: decimal({ precision: 14, scale: 2, ...commandOnlyFieldText }),
    lastReadingAt: timestamp({ ...commandOnlyFieldText }),
    lastReadingStable: checkbox({ defaultValue: false, ...commandOnlyFieldText }),
    isActive: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})

// §6.2 Sequence. One row per (scope, kind); numbers are taken with one atomic UPDATE ... RETURNING.
export const Sequence = list({
  access: staffList({ read: permissions.canManageSettings, create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    yard: relationship({ ref: 'Yard', ...commandOnlyFieldText }),
    scopeKey: text({ validation: { isRequired: true }, ...commandOnlyFieldText, ui: { description: 'Yard id, or "business" for business-wide numbers.' } }),
    kind: choice(
      ['inbound_ticket', 'outbound_ticket', 'invoice', 'settlement', 'unit_tag', 'sales_order', 'job', 'shipment', 'service_request', 'receipt', 'account'],
      'inbound_ticket',
      commandOnlyFieldText
    ),
    next: integer({ defaultValue: 1, validation: { isRequired: true }, ...commandOnlyFieldText }),
    ...trackingFields,
  },
})

export { yardFilter }
