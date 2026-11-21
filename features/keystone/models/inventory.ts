import { list, graphql } from '@keystone-6/core'
import { virtual } from '@keystone-6/core/fields'
import { Decimal } from 'decimal.js'
import { anyOf, appendOnlyList, denyAll, permissions, staffList } from '../access'
import { trackingFields } from './trackingFields'
import { UNITS } from './catalog'
import {
  checkbox, choice, commandCents, commandJson, commandOnlyFieldText as cmd, commandWeight, image, integer, json, relationship, status, text,
  timestamp, unitPrice, weight,
} from './shared'

const invRead = anyOf('canManageInventory', 'canGradeTickets', 'canManageSales', 'canViewReports')
const costRead = { access: { read: anyOf('canManageInventory', 'canManageSales', 'canManageFinance', 'canViewReports') } }

// §6.7 InventoryBalance. Unique (yard, material). Changed only in the same transaction as a movement.
export const InventoryBalance = list({
  access: staffList({ read: invRead, create: denyAll, update: denyAll, delete: denyAll, yard: 'yard' }),
  fields: {
    yard: relationship({ ref: 'Yard', ...cmd }),
    material: relationship({ ref: 'Material', ...cmd }),
    onHandWeight: commandWeight(),
    reservedWeight: commandWeight(),
    heldWeight: commandWeight(),
    totalCostCents: integer({ defaultValue: 0, validation: { isRequired: true }, ...cmd, ...costRead }),
    availableWeight: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve(item: any) {
          return new Decimal(String(item.onHandWeight ?? 0)).minus(String(item.reservedWeight ?? 0)).minus(String(item.heldWeight ?? 0)).toFixed(2)
        },
      }),
    }),
    averageCostPerUnit: virtual({
      ...costRead,
      field: graphql.field({
        type: graphql.String,
        resolve(item: any) {
          const onHand = new Decimal(String(item.onHandWeight ?? 0))
          if (onHand.lte(0)) return '0'
          return new Decimal(item.totalCostCents ?? 0).div(onHand).toFixed(5)
        },
      }),
    }),
    ...trackingFields,
  },
})

// §6.7 InventoryMovement (append-only, unique referenceKey)
export const InventoryMovement = list({
  access: appendOnlyList({ read: invRead, yard: 'yard' }),
  fields: {
    yard: relationship({ ref: 'Yard', ...cmd }),
    material: relationship({ ref: 'Material', ...cmd }),
    kind: choice(['receive', 'ship', 'regrade_out', 'regrade_in', 'process_in', 'process_out', 'transfer_out', 'transfer_in', 'adjust', 'reverse', 'hold', 'release'], 'receive', cmd),
    weightDelta: commandWeight(),
    costDeltaCents: integer({ defaultValue: 0, validation: { isRequired: true }, ...cmd, ...costRead }),
    weightAfter: commandWeight(),
    ticket: relationship({ ref: 'ScaleTicket', ...cmd }),
    ticketLine: relationship({ ref: 'TicketLine', ...cmd }),
    processingRun: relationship({ ref: 'ProcessingRun', ...cmd }),
    transfer: relationship({ ref: 'YardTransfer', ...cmd }),
    unit: relationship({ ref: 'InventoryUnit', ...cmd }),
    reason: text({ ...cmd }),
    needsReview: checkbox({ defaultValue: false, ...cmd }),
    reviewedBy: relationship({ ref: 'User', ...cmd }),
    reviewedAt: timestamp({ ...cmd }),
    referenceKey: text({ isIndexed: 'unique', validation: { isRequired: true }, ...cmd }),
    occurredAt: timestamp({ defaultValue: { kind: 'now' }, ...cmd }),
    createdBy: relationship({ ref: 'User', ...cmd }),
    ...trackingFields,
  },
})

// §6.7 InventoryUnit. Unique (yard, tagNumber). Status moves only by compare-and-set.
export const InventoryUnit = list({
  access: staffList({ read: invRead, create: denyAll, update: permissions.canManageInventory, delete: denyAll, yard: 'yard' }),
  ui: { labelField: 'tagNumber' },
  fields: {
    yard: relationship({ ref: 'Yard', ...cmd }),
    tagNumber: text({ validation: { isRequired: true }, ...cmd }),
    material: relationship({ ref: 'Material', ...cmd }),
    form: choice(['bale', 'box', 'gaylord', 'drum', 'pallet', 'bundle'], 'bale', cmd),
    weight: commandWeight(),
    location: text(),
    status: status(['available', 'held', 'allocated', 'shipped', 'consumed'], 'available'),
    costCents: integer({ defaultValue: 0, validation: { isRequired: true }, ...cmd, ...costRead }),
    shipment: relationship({ ref: 'Shipment.units', ...cmd }),
    listing: relationship({ ref: 'Listing.units', ...cmd }),
    transfer: relationship({ ref: 'YardTransfer.units', ...cmd }),
    photo: image({ storage: 'my_images' }),
    createdFromRun: relationship({ ref: 'ProcessingRun', ...cmd }),
    ...trackingFields,
  },
})

// §6.7 ProcessingRun
export const ProcessingRun = list({
  access: staffList({ read: invRead, create: denyAll, update: denyAll, delete: denyAll, yard: 'yard' }),
  fields: {
    yard: relationship({ ref: 'Yard', ...cmd }),
    kind: choice(['bale', 'shear', 'shred', 'strip', 'sort', 'torch', 'other'], 'other', cmd),
    status: status(['draft', 'posted', 'void'], 'draft'),
    inputs: commandJson({ defaultValue: [] }),
    outputs: commandJson({ defaultValue: [] }),
    lossWeight: commandWeight(),
    processingCostCents: commandCents(),
    operator: relationship({ ref: 'User', ...cmd }),
    postedAt: timestamp({ ...cmd }),
    notes: text({ ui: { displayMode: 'textarea' } }),
    ...trackingFields,
  },
})

// §6.7 YardTransfer
export const YardTransfer = list({
  access: staffList({ read: invRead, create: denyAll, update: denyAll, delete: denyAll, yard: ['fromYard', 'toYard'] }),
  fields: {
    fromYard: relationship({ ref: 'Yard', ...cmd }),
    toYard: relationship({ ref: 'Yard', ...cmd }),
    status: status(['draft', 'in_transit', 'received', 'cancelled'], 'draft'),
    lines: commandJson({ defaultValue: [] }),
    units: relationship({ ref: 'InventoryUnit.transfer', many: true, ...cmd }),
    sentAt: timestamp({ ...cmd }),
    receivedAt: timestamp({ ...cmd }),
    sentBy: relationship({ ref: 'User', ...cmd }),
    receivedBy: relationship({ ref: 'User', ...cmd }),
    ...trackingFields,
  },
})

// §6.8 Listing
export const Listing = list({
  access: staffList({ read: permissions.canAccessDashboard, create: denyAll, update: permissions.canManageSales, delete: denyAll, yard: 'yard' }),
  fields: {
    yard: relationship({ ref: 'Yard', ...cmd }),
    title: text({ validation: { isRequired: true } }),
    material: relationship({ ref: 'Material', ...cmd }),
    form: choice(['bale', 'loose', 'box', 'gaylord', 'drum', 'pallet', 'bundle'], 'loose'),
    description: text({ ui: { displayMode: 'textarea' } }),
    photos: json({ defaultValue: [] }),
    estimatedWeight: weight(),
    availableWeight: commandWeight(),
    units: relationship({ ref: 'InventoryUnit.listing', many: true, ...cmd }),
    askUnitPrice: unitPrice(),
    unit: choice([...UNITS], 'lb'),
    allowOffers: checkbox({ defaultValue: true }),
    buyNow: checkbox({ defaultValue: false }),
    minimumWeight: weight(),
    terms: choice(['fob_yard', 'delivered'], 'fob_yard'),
    closesAt: timestamp(),
    status: status(['draft', 'open', 'paused', 'sold_out', 'closed'], 'draft'),
    offers: relationship({ ref: 'Offer.listing', many: true, ...cmd }),
    ...trackingFields,
  },
})

// §6.8 Offer
export const Offer = list({
  access: staffList({ read: permissions.canManageSales, create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    listing: relationship({ ref: 'Listing.offers', ...cmd }),
    account: relationship({ ref: 'Account', ...cmd }),
    contact: relationship({ ref: 'User', ...cmd }),
    weight: commandWeight(),
    unitPrice: unitPrice({ ...cmd }),
    unit: choice([...UNITS], 'lb', cmd),
    pickupFrom: timestamp({ ...cmd }),
    pickupTo: timestamp({ ...cmd }),
    message: text({ ...cmd }),
    status: status(['submitted', 'countered', 'accepted', 'declined', 'withdrawn', 'expired'], 'submitted'),
    counterUnitPrice: unitPrice({ ...cmd }),
    counterWeight: weight({ ...cmd }),
    counterMessage: text({ ...cmd }),
    decisionReason: text({ ...cmd }),
    expiresAt: timestamp({ ...cmd }),
    decidedBy: relationship({ ref: 'User', ...cmd }),
    salesOrder: relationship({ ref: 'SalesOrder.offer', ...cmd }),
    ...trackingFields,
  },
})

// §6.8 SalesOrder
export const SalesOrder = list({
  access: staffList({ read: anyOf('canManageSales', 'canManageFinance'), create: denyAll, update: permissions.canManageSales, delete: denyAll, yard: 'yard' }),
  fields: {
    number: integer({ ...cmd }),
    yard: relationship({ ref: 'Yard', ...cmd }),
    account: relationship({ ref: 'Account', ...cmd }),
    status: status(['draft', 'confirmed', 'in_fulfilment', 'fulfilled', 'closed', 'cancelled'], 'draft'),
    terms: choice(['fob_yard', 'delivered'], 'fob_yard', cmd),
    paymentTerms: choice(['prepay', 'net'], 'net', cmd),
    netDays: integer({ defaultValue: 30, ...cmd }),
    weightBasis: choice(['shipped', 'received'], 'shipped', cmd),
    shipFrom: text(),
    shipTo: text(),
    shipWindowStart: timestamp(),
    shipWindowEnd: timestamp(),
    lines: relationship({ ref: 'SalesOrderLine.order', many: true, ...cmd }),
    shipments: relationship({ ref: 'Shipment.order', many: true, ...cmd }),
    offer: relationship({ ref: 'Offer.salesOrder', ...cmd }),
    buyerReference: text(),
    cancelReason: text({ ...cmd }),
    notes: text({ ui: { displayMode: 'textarea' } }),
    ...trackingFields,
  },
})

// §6.8 SalesOrderLine
export const SalesOrderLine = list({
  access: staffList({ read: anyOf('canManageSales', 'canManageFinance'), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    order: relationship({ ref: 'SalesOrder.lines', ...cmd }),
    material: relationship({ ref: 'Material', ...cmd }),
    materialName: text({ ...cmd }),
    weight: commandWeight(),
    tolerancePercent: weight({ defaultValue: '5', ...cmd }),
    unit: choice([...UNITS], 'lb', cmd),
    unitPrice: unitPrice({ ...cmd }),
    shippedWeight: commandWeight(),
    reservedWeight: commandWeight(),
    listing: relationship({ ref: 'Listing', ...cmd }),
    ...trackingFields,
  },
})

// §6.8 Shipment
export const Shipment = list({
  access: staffList({ read: anyOf('canManageSales', 'canManageTickets', 'canManageFinance'), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    order: relationship({ ref: 'SalesOrder.shipments', ...cmd }),
    number: integer({ ...cmd }),
    status: status(['scheduled', 'loading', 'loaded', 'released', 'delivered', 'reconciled', 'cancelled'], 'scheduled'),
    carrier: text({ ...cmd }),
    driverName: text({ ...cmd }),
    truckPlate: text({ ...cmd }),
    trailerNumber: text({ ...cmd }),
    sealNumber: text({ ...cmd }),
    bolNumber: text({ ...cmd }),
    scheduledFor: timestamp({ ...cmd }),
    ticket: relationship({ ref: 'ScaleTicket.shipment', ...cmd }),
    units: relationship({ ref: 'InventoryUnit.shipment', many: true, ...cmd }),
    lines: commandJson({ defaultValue: [] }),
    shippedWeight: commandWeight(),
    receivedWeight: weight({ ...cmd }),
    receivedGradeNote: text({ ...cmd }),
    freightCents: commandCents(),
    invoice: relationship({ ref: 'Invoice', ...cmd }),
    job: relationship({ ref: 'DispatchJob', ...cmd }),
    releasedAt: timestamp({ ...cmd }),
    deliveredAt: timestamp({ ...cmd }),
    ...trackingFields,
  },
})
