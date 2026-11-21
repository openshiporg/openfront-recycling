import { list, graphql } from '@keystone-6/core'
import { virtual } from '@keystone-6/core/fields'
import { allowAll, anyOf, denyAll, isStaff, permissions, staffList, type AccessArgs } from '../access'
import { trackingFields } from './trackingFields'
import {
  checkbox, choice, commandCents, commandOnlyFieldText as cmd, image, integer, json, relationship, staffRead, status, text, timestamp, weight,
} from './shared'

const dispatchStaff = permissions.canManageDispatch

// §6.10 ContainerType. Public read (isPublic).
export const ContainerType = list({
  access: {
    operation: { query: allowAll, create: dispatchStaff, update: dispatchStaff, delete: denyAll },
    filter: { query: ({ session }: AccessArgs) => (isStaff(session) ? true : { isPublic: { equals: true } }) },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    slug: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    kind: choice(['roll_off', 'lugger', 'hopper', 'gaylord', 'drum', 'trailer'], 'roll_off'),
    capacityLabel: text(),
    dimensions: text(),
    description: text({ ui: { displayMode: 'textarea' } }),
    image: image({ storage: 'my_images' }),
    suitableFor: text({ ui: { displayMode: 'textarea' } }),
    deliveryFeeCents: integer({ defaultValue: 0, validation: { isRequired: true } }),
    haulFeeCents: integer({ defaultValue: 0, validation: { isRequired: true } }),
    rentalFeePerDayCents: integer({ defaultValue: 0, validation: { isRequired: true } }),
    freeRentalDays: integer({ defaultValue: 0, validation: { isRequired: true } }),
    dryRunFeeCents: integer({ defaultValue: 0, validation: { isRequired: true } }),
    isPublic: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})

// §6.10 Container. Status by compare-and-set; one open job per container (partial unique indexes).
export const Container = list({
  access: staffList({ create: dispatchStaff, update: dispatchStaff, delete: denyAll, yard: 'homeYard' }),
  ui: { labelField: 'number' },
  fields: {
    number: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    type: relationship({ ref: 'ContainerType' }),
    homeYard: relationship({ ref: 'Yard' }),
    status: status(['in_yard', 'assigned', 'in_transit', 'at_customer', 'maintenance', 'retired'], 'in_yard'),
    tareWeight: weight(),
    site: relationship({ ref: 'ServiceSite', ...cmd }),
    account: relationship({ ref: 'Account', ...cmd }),
    placedOn: timestamp({ ...cmd }),
    rentalChargedThrough: timestamp({ ...cmd }),
    currentMaterial: relationship({ ref: 'Material' }),
    notes: text({ ui: { displayMode: 'textarea' } }),
    daysOnSite: virtual({
      field: graphql.field({
        type: graphql.Int,
        resolve(item: any) {
          if (item.status !== 'at_customer' || !item.placedOn) return null
          return Math.max(0, Math.floor((Date.now() - new Date(item.placedOn).getTime()) / 86_400_000))
        },
      }),
    }),
    ...trackingFields,
  },
})

// §6.10 ServiceRequest
export const ServiceRequest = list({
  access: staffList({ read: anyOf('canManageDispatch', 'canManageAccounts', 'canManageFinance'), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    number: integer({ ...cmd }),
    yard: relationship({ ref: 'Yard', ...cmd }),
    account: relationship({ ref: 'Account', ...cmd }),
    seller: relationship({ ref: 'Seller', ...cmd }),
    requestedBy: relationship({ ref: 'User', ...cmd }),
    site: relationship({ ref: 'ServiceSite', ...cmd }),
    kind: choice(['deliver', 'swap', 'pickup', 'remove', 'live_load', 'public_pickup'], 'deliver', cmd),
    containerType: relationship({ ref: 'ContainerType', ...cmd }),
    container: relationship({ ref: 'Container', ...cmd }),
    material: relationship({ ref: 'Material', ...cmd }),
    itemsDescription: text({ ...cmd }),
    photos: json({ defaultValue: [], ...cmd }),
    preferredDate: timestamp({ ...cmd }),
    preferredWindow: choice(['morning', 'afternoon', 'any'], 'any', cmd),
    accessNotes: text({ ...cmd }),
    status: status(['requested', 'awaiting_payment', 'approved', 'scheduled', 'completed', 'declined', 'cancelled'], 'requested'),
    feeCents: commandCents(),
    quoteNote: text({ ...cmd }),
    quoteAcceptedAt: timestamp({ ...cmd }),
    chargeToAccount: checkbox({ defaultValue: false, ...cmd }),
    paymentSession: relationship({ ref: 'PaymentSession.serviceRequest', ...cmd }),
    invoice: relationship({ ref: 'Invoice', ...cmd }),
    decisionReason: text({ ...cmd }),
    job: relationship({ ref: 'DispatchJob.request', ...cmd }),
    ...trackingFields,
  },
})

// §6.10 Truck
export const Truck = list({
  access: staffList({ create: dispatchStaff, update: dispatchStaff, delete: denyAll, yard: 'yard' }),
  fields: {
    name: text({ validation: { isRequired: true } }),
    plate: text(),
    kind: choice(['roll_off', 'lugger', 'flatbed', 'box', 'tractor'], 'roll_off'),
    yard: relationship({ ref: 'Yard' }),
    isActive: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})

// §6.10 DispatchJob. Drivers read only their own jobs.
export const DispatchJob = list({
  access: {
    operation: { query: anyOf('canManageDispatch', 'canDriveJobs', 'canManageTickets'), create: denyAll, update: denyAll, delete: denyAll },
    filter: {
      query: ({ session }: AccessArgs) => {
        if (!isStaff(session)) return false
        const role = session!.data.role || {}
        if ((role as any).canManageDispatch || (role as any).canManageTickets || (role as any).canManageSettings) return true
        return { driver: { id: { equals: session!.itemId } } }
      },
    },
  },
  fields: {
    number: integer({ ...cmd }),
    yard: relationship({ ref: 'Yard', ...cmd }),
    request: relationship({ ref: 'ServiceRequest.job', ...cmd }),
    shipment: relationship({ ref: 'Shipment', ...cmd }),
    kind: choice(['deliver', 'swap', 'pickup', 'remove', 'live_load', 'public_pickup', 'deliver_to_buyer'], 'deliver', cmd),
    status: status(['planned', 'assigned', 'en_route', 'on_site', 'completed', 'failed', 'cancelled'], 'planned'),
    scheduledDate: timestamp({ ...cmd }),
    sequence: integer({ defaultValue: 0, ...cmd }),
    driver: relationship({ ref: 'User', ...cmd }),
    truck: relationship({ ref: 'Truck', ...cmd }),
    dropContainer: relationship({ ref: 'Container', ...cmd }),
    pickContainer: relationship({ ref: 'Container', ...cmd }),
    site: relationship({ ref: 'ServiceSite', ...cmd }),
    startedAt: timestamp({ ...cmd }),
    arrivedAt: timestamp({ ...cmd }),
    completedAt: timestamp({ ...cmd }),
    photos: json({ defaultValue: [], ...cmd }),
    signedName: text({ ...cmd }),
    failureReason: text({ ...cmd }),
    driverNotes: text({ ...cmd }),
    ...trackingFields,
  },
})

// §6.11 DonationCampaign. Public read (isPublic and active).
export const DonationCampaign = list({
  access: {
    operation: { query: allowAll, create: anyOf('canManageAccounts', 'canManageFinance'), update: anyOf('canManageAccounts', 'canManageFinance'), delete: denyAll },
    filter: { query: ({ session }: AccessArgs) => (isStaff(session) ? true : { isPublic: { equals: true }, status: { equals: 'active' } }) },
  },
  fields: {
    account: relationship({ ref: 'Account' }),
    name: text({ validation: { isRequired: true } }),
    slug: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    description: text({ ui: { displayMode: 'textarea' } }),
    image: image({ storage: 'my_images' }),
    goalWeight: weight(),
    goalCents: integer(),
    startsOn: timestamp(),
    endsOn: timestamp(),
    isPublic: checkbox({ defaultValue: true }),
    status: choice(['draft', 'active', 'ended'], 'draft'),
    raisedCents: virtual({
      field: graphql.field({
        type: graphql.Int,
        async resolve(item: any, _a, context) {
          const rows = await context.sudo().prisma.donation.aggregate({ where: { campaignId: item.id, status: { in: ['credited', 'disbursed'] } }, _sum: { amountCents: true } })
          return rows._sum.amountCents || 0
        },
      }),
    }),
    raisedWeight: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: any, _a, context) {
          const rows = await context.sudo().prisma.donation.aggregate({ where: { campaignId: item.id, status: { in: ['credited', 'disbursed'] } }, _sum: { weight: true } })
          return String(rows._sum.weight || '0')
        },
      }),
    }),
    donorCount: virtual({
      field: graphql.field({
        type: graphql.Int,
        async resolve(item: any, _a, context) {
          const rows = await context.sudo().prisma.donation.groupBy({ by: ['sellerId'], where: { campaignId: item.id, status: { in: ['credited', 'disbursed'] } } })
          return rows.length
        },
      }),
    }),
    ...trackingFields,
  },
})

// §6.11 Donation
export const Donation = list({
  access: staffList({ read: anyOf('canManageAccounts', 'canManageFinance', 'canManageTickets', 'canViewReports'), create: denyAll, update: denyAll, delete: denyAll }),
  fields: {
    ticket: relationship({ ref: 'ScaleTicket', ...cmd }),
    seller: relationship({ ref: 'Seller', ...cmd }),
    account: relationship({ ref: 'Account', ...cmd }),
    campaign: relationship({ ref: 'DonationCampaign', ...cmd }),
    amountCents: commandCents(),
    weight: weight({ ...cmd }),
    itemsSummary: json({ defaultValue: [], ...cmd }),
    kind: choice(['payout_donation', 'goods_donation'], 'payout_donation', cmd),
    status: status(['pledged', 'credited', 'disbursed', 'cancelled'], 'pledged'),
    receiptNumber: text({ isIndexed: 'unique', ...cmd }),
    receiptIssuedAt: timestamp({ ...cmd }),
    goodsOrServicesProvided: checkbox({ defaultValue: false, ...cmd }),
    showDonorName: checkbox({ defaultValue: false, ...cmd }),
    settlement: relationship({ ref: 'Settlement.donations', ...cmd }),
    ...trackingFields,
  },
})

export { staffRead }
