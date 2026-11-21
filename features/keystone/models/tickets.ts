import { list, graphql } from '@keystone-6/core'
import { virtual } from '@keystone-6/core/fields'
import { anyOf, appendOnlyList, denyAll, permissions, staffList } from '../access'
import { trackingFields } from './trackingFields'
import { UNITS } from './catalog'
import {
  checkbox, choice, commandCents, commandJson, commandOnlyFieldText as cmd, commandWeight, file, image, integer, json, relationship,
  status, text, timestamp, unitPrice, weight,
} from './shared'

const ticketStaff = anyOf('canManageTickets', 'canGradeTickets')

// §6.5 Visit (pre-check-in)
export const Visit = list({
  access: staffList({ read: anyOf('canManageTickets', 'canManageSellers'), create: denyAll, update: denyAll, delete: denyAll, yard: 'yard' }),
  ui: { labelField: 'code' },
  fields: {
    seller: relationship({ ref: 'Seller', ...cmd }),
    yard: relationship({ ref: 'Yard', ...cmd }),
    plannedDate: timestamp({ validation: { isRequired: true }, ...cmd }),
    vehicle: relationship({ ref: 'Vehicle', ...cmd }),
    expectedItems: json({ ...cmd }),
    donatePercent: integer({ defaultValue: 0, ...cmd }),
    nonprofit: relationship({ ref: 'Account', ...cmd }),
    campaign: relationship({ ref: 'DonationCampaign', ...cmd }),
    code: text({ isIndexed: 'unique', ...cmd }),
    status: status(['booked', 'arrived', 'cancelled', 'expired'], 'booked'),
    ticket: relationship({ ref: 'ScaleTicket.visit', ...cmd }),
    ...trackingFields,
  },
})

// §6.5 ScaleTicket. Lines, weights, totals and statuses are written only by ticket commands.
export const ScaleTicket = list({
  access: staffList({
    read: permissions.canAccessDashboard,
    create: denyAll,
    update: ticketStaff, // notes only; every other field is command-owned
    delete: denyAll,
    yard: 'yard',
  }),
  ui: {
    labelField: 'lookupCode',
    listView: { initialColumns: ['displayNumber', 'yard', 'direction', 'status', 'seller', 'account', 'totalCents', 'completedAt'] },
  },
  fields: {
    yard: relationship({ ref: 'Yard', ...cmd }),
    direction: choice(['inbound', 'outbound'], 'inbound', cmd),
    number: integer({ validation: { isRequired: true }, ...cmd }),
    displayNumber: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: any, _args, context) {
          const yard = item.yardId ? await context.sudo().db.Yard.findOne({ where: { id: item.yardId } }) : null
          return formatTicketNumber(String(yard?.code || 'YARD'), item.direction, item.number)
        },
      }),
    }),
    status: status(['open', 'completed', 'settled', 'voided'], 'open'),
    seller: relationship({ ref: 'Seller.tickets', ...cmd }),
    account: relationship({ ref: 'Account', ...cmd }),
    site: relationship({ ref: 'ServiceSite', ...cmd }),
    vehicle: relationship({ ref: 'Vehicle', ...cmd }),
    vehiclePlate: text({ ...cmd, isIndexed: true }),
    vehiclePlateRegion: text({ ...cmd }),
    vehicleDescription: text({ ...cmd }),
    visit: relationship({ ref: 'Visit.ticket', ...cmd }),
    job: relationship({ ref: 'DispatchJob', ...cmd }),
    container: relationship({ ref: 'Container', ...cmd }),
    shipment: relationship({ ref: 'Shipment.ticket', ...cmd }),
    adjusts: relationship({ ref: 'ScaleTicket.adjustments', ...cmd }),
    adjustments: relationship({ ref: 'ScaleTicket.adjusts', many: true, ...cmd }),
    isAdjustment: checkbox({ defaultValue: false, ...cmd }),
    paymentMode: choice(['pay_now', 'on_account', 'donation_only', 'customer_pays'], 'pay_now', cmd),
    lines: relationship({ ref: 'TicketLine.ticket', many: true, ...cmd }),
    weighEvents: relationship({ ref: 'WeighEvent.ticket', many: true, ...cmd }),
    attachments: relationship({ ref: 'TicketAttachment.ticket', many: true, ...cmd }),
    fees: json({ defaultValue: [], ...cmd }),
    materialTotalCents: commandCents(),
    feeTotalCents: commandCents(),
    taxCents: commandCents(),
    totalCents: commandCents(),
    collectedCents: commandCents(),
    donatePercent: integer({ defaultValue: 0, ...cmd }),
    nonprofit: relationship({ ref: 'Account', ...cmd }),
    campaign: relationship({ ref: 'DonationCampaign', ...cmd }),
    complianceSnapshot: commandJson(),
    overrideReason: text({ ...cmd }),
    overrideBy: relationship({ ref: 'User', ...cmd }),
    lookupCode: text({ isIndexed: 'unique', ...cmd }),
    certificateRequested: checkbox({ defaultValue: false, ...cmd }),
    openedBy: relationship({ ref: 'User', ...cmd }),
    completedBy: relationship({ ref: 'User', ...cmd }),
    completedAt: timestamp({ ...cmd }),
    settledAt: timestamp({ ...cmd }),
    voidedBy: relationship({ ref: 'User', ...cmd }),
    voidedAt: timestamp({ ...cmd }),
    voidReason: text({ ...cmd }),
    payouts: relationship({ ref: 'Payout.ticket', many: true, ...cmd }),
    holdTags: relationship({ ref: 'HoldTag.ticket', many: true, ...cmd }),
    settlement: relationship({ ref: 'Settlement.tickets', ...cmd }),
    notes: text({ ui: { displayMode: 'textarea' } }),
    ...trackingFields,
  },
})

export function formatTicketNumber(yardCode: string, direction: string, number: number | null | undefined) {
  return `${yardCode}-${direction === 'outbound' ? 'O' : 'I'}-${String(number ?? 0).padStart(6, '0')}`
}

// §6.5 TicketLine
export const TicketLine = list({
  access: staffList({ create: denyAll, update: denyAll, delete: denyAll, yard: 'ticket.yard' }),
  ui: { labelField: 'materialName' },
  fields: {
    ticket: relationship({ ref: 'ScaleTicket.lines', ...cmd }),
    sortOrder: integer({ defaultValue: 0, ...cmd }),
    material: relationship({ ref: 'Material', ...cmd }),
    materialName: text({ ...cmd }),
    direction: choice(['pay_seller', 'charge_customer'], 'pay_seller', cmd),
    grossWeight: commandWeight(),
    tareWeight: commandWeight(),
    netWeight: commandWeight(),
    deductionWeight: weight({ ...cmd }),
    deductionPercent: weight({ ...cmd }),
    deductionReason: choice(['dirt', 'moisture', 'plastic', 'attachments', 'oil', 'other'], undefined, cmd),
    payWeight: commandWeight(),
    quantity: integer({ ...cmd }),
    unit: choice([...UNITS], 'lb', cmd),
    unitPrice: unitPrice({ ...cmd }),
    priceSource: choice(['contract', 'price_list', 'board', 'override'], undefined, cmd),
    priceEntry: relationship({ ref: 'PriceEntry', ...cmd }),
    overrideBy: relationship({ ref: 'User', ...cmd }),
    overrideReason: text({ ...cmd }),
    amountCents: commandCents(),
    restriction: relationship({ ref: 'MaterialRestriction', ...cmd }),
    documents: json({ defaultValue: [], ...cmd }),
    payout: relationship({ ref: 'Payout.lines', ...cmd }),
    inventoryUnit: relationship({ ref: 'InventoryUnit', ...cmd }),
    ...trackingFields,
  },
})

// §6.5 WeighEvent (append-only)
export const WeighEvent = list({
  access: appendOnlyList({ yard: 'ticket.yard' }),
  fields: {
    ticket: relationship({ ref: 'ScaleTicket.weighEvents', ...cmd }),
    line: relationship({ ref: 'TicketLine', ...cmd }),
    scale: relationship({ ref: 'Scale', ...cmd }),
    kind: choice(['gross', 'tare', 'sequential'], 'gross', cmd),
    weight: commandWeight(),
    captureMethod: choice(['scale', 'manual'], 'manual', cmd),
    capturedBy: relationship({ ref: 'User', ...cmd }),
    capturedAt: timestamp({ defaultValue: { kind: 'now' }, ...cmd }),
    photo: image({ storage: 'private_images', ...cmd }),
    ...trackingFields,
  },
})

// §6.5 TicketAttachment. Photos and signatures are uploaded by staff while the ticket is open.
export const TicketAttachment = list({
  access: {
    ...staffList({ create: ticketStaff, update: denyAll, delete: denyAll, yard: 'ticket.yard' }),
    item: {
      create: async ({ inputData, context }: any) => {
        const ticketId = inputData?.ticket?.connect?.id
        if (!ticketId) return false
        const ticket = await context.sudo().db.ScaleTicket.findOne({ where: { id: ticketId } })
        return ticket?.status === 'open'
      },
    },
  },
  fields: {
    ticket: relationship({ ref: 'ScaleTicket.attachments' }),
    line: relationship({ ref: 'TicketLine' }),
    kind: choice(['seller_photo', 'material_photo', 'vehicle_photo', 'signature', 'thumbprint', 'ownership_document', 'bol', 'other'], 'material_photo'),
    image: image({ storage: 'private_images' }),
    file: file({ storage: 'private_files' }),
    signedName: text(),
    capturedBy: relationship({ ref: 'User', ...cmd }),
    capturedAt: timestamp({ defaultValue: { kind: 'now' }, ...cmd }),
    ...trackingFields,
  },
  hooks: {
    resolveInput: ({ resolvedData, context, operation }) => {
      if (operation === 'create' && context.session?.itemId) resolvedData.capturedBy = { connect: { id: context.session.itemId } }
      return resolvedData
    },
  },
})
