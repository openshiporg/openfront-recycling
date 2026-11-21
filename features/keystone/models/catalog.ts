import { list } from '@keystone-6/core'
import { allowAll, appendOnlyList, denyAll, isStaff, permissions, type AccessArgs } from '../access'
import { trackingFields } from './trackingFields'
import { checkbox, choice, commandOnlyFieldText, image, integer, json, relationship, staffRead, text, timestamp, unitPrice, weight } from './shared'

export const UNITS = ['lb', 'cwt', 'net_ton', 'gross_ton', 'kg', 'metric_tonne', 'each'] as const

const publicOrStaff = (field: string) => ({ session }: AccessArgs) => (isStaff(session) ? true : { [field]: { equals: true } })

// §6.3 MaterialCategory. Public read.
export const MaterialCategory = list({
  access: {
    operation: { query: allowAll, create: permissions.canManageMaterials, update: permissions.canManageMaterials, delete: permissions.canManageMaterials },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    slug: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    kind: choice(['ferrous', 'non_ferrous', 'electronics', 'paper', 'plastic', 'glass', 'other'], 'non_ferrous'),
    sortOrder: integer({ defaultValue: 0 }),
    image: image({ storage: 'my_images' }),
    materials: relationship({ ref: 'Material.category', many: true }),
    ...trackingFields,
  },
})

// §6.3 Material. Public read of public materials.
export const Material = list({
  access: {
    operation: { query: allowAll, create: permissions.canManageMaterials, update: permissions.canManageMaterials, delete: permissions.canManageMaterials },
    filter: { query: publicOrStaff('isPublic') },
  },
  ui: { listView: { initialColumns: ['name', 'code', 'category', 'defaultUnit', 'direction', 'isPublic'] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    slug: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    code: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    category: relationship({ ref: 'MaterialCategory.materials' }),
    specName: text(),
    description: text({ ui: { displayMode: 'textarea' } }),
    preparationTips: text({ ui: { displayMode: 'textarea' } }),
    image: image({ storage: 'my_images' }),
    images: json(),
    defaultUnit: choice([...UNITS], 'lb'),
    direction: choice(['pay_seller', 'charge_customer'], 'pay_seller'),
    isPublic: checkbox({ defaultValue: true }),
    isActive: checkbox({ defaultValue: true }),
    acceptsFromPublic: checkbox({ defaultValue: true }),
    sortOrder: integer({ defaultValue: 0 }),
    minimumWeight: weight(),
    standardContainerTare: weight(),
    ...trackingFields,
  },
})

// §6.3 PriceList. Staff only; public prices come from the publicPriceBoard query.
export const PriceList = list({
  access: {
    operation: { query: permissions.canAccessDashboard, create: permissions.canManagePricing, update: permissions.canManagePricing, delete: denyAll },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    kind: choice(['board', 'tier', 'contract', 'sell'], 'board'),
    yard: relationship({ ref: 'Yard' }),
    isActive: checkbox({ defaultValue: true }),
    accounts: relationship({ ref: 'Account.priceList', many: true }),
    entries: relationship({ ref: 'PriceEntry.priceList', many: true, ui: { itemView: { fieldMode: 'read' } } }),
    ...trackingFields,
  },
})

// §6.3 PriceEntry (append-only). Written only by publishPrices.
export const PriceEntry = list({
  access: appendOnlyList({ read: permissions.canAccessDashboard }),
  fields: {
    priceList: relationship({ ref: 'PriceList.entries', ...commandOnlyFieldText }),
    material: relationship({ ref: 'Material', ...commandOnlyFieldText }),
    unit: choice([...UNITS], 'lb', commandOnlyFieldText),
    unitPrice: unitPrice({ validation: { isRequired: true }, defaultValue: '0', ...commandOnlyFieldText }),
    unitPriceHigh: unitPrice(commandOnlyFieldText),
    isPublic: checkbox({ defaultValue: true, ...commandOnlyFieldText }),
    effectiveFrom: timestamp({ validation: { isRequired: true }, defaultValue: { kind: 'now' }, ...commandOnlyFieldText }),
    effectiveTo: timestamp(commandOnlyFieldText),
    publishedBy: relationship({ ref: 'User', ...commandOnlyFieldText }),
    ...trackingFields,
  },
})

export { staffRead }
