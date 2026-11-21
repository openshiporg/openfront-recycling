import { list } from '@keystone-6/core'
import { checkbox, password, relationship, text } from '@keystone-6/core/fields'
import { ROLE_FLAGS, denyAll, isSignedIn, permissions, rules, type AccessArgs } from '../access'
import { trackingFields } from './trackingFields'

const canManageStaff = ({ session }: AccessArgs) =>
  permissions.canManageStaff({ session }) || permissions.canManagePeople({ session })

// §6.1 User. Customers register through the `registerCustomer` mutation, never raw create.
export const User = list({
  access: {
    operation: {
      query: isSignedIn,
      create: canManageStaff,
      update: isSignedIn,
      delete: canManageStaff,
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdatePeople,
    },
  },
  ui: {
    hideCreate: (args) => !canManageStaff(args),
    hideDelete: (args) => !canManageStaff(args),
    listView: { initialColumns: ['name', 'email', 'role', 'yards'] },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    email: text({ isFilterable: false, isOrderable: false, isIndexed: 'unique', validation: { isRequired: true } }),
    password: password({
      access: {
        read: denyAll,
        update: ({ session, item }) => canManageStaff({ session }) || session?.itemId === item.id,
      },
      validation: { isRequired: true },
    }),
    phone: text(),
    role: relationship({
      ref: 'Role.assignedTo',
      access: { create: canManageStaff, update: canManageStaff },
      ui: { itemView: { fieldMode: (args) => (canManageStaff(args) ? 'edit' : 'read') } },
    }),
    yards: relationship({
      ref: 'Yard.staff',
      many: true,
      access: { create: canManageStaff, update: canManageStaff },
      ui: { itemView: { fieldMode: (args) => (canManageStaff(args) ? 'edit' : 'read') } },
    }),
    sellerProfile: relationship({
      ref: 'Seller.user',
      access: { create: denyAll, update: denyAll },
      ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } },
    }),
    accountContacts: relationship({
      ref: 'AccountContact.user',
      many: true,
      access: { create: denyAll, update: denyAll },
      ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } },
    }),
    ...trackingFields,
  },
})

// §6.1 Role
export const Role = list({
  access: {
    operation: {
      query: isSignedIn,
      create: permissions.canManageRoles,
      update: permissions.canManageRoles,
      delete: permissions.canManageRoles,
    },
  },
  ui: {
    hideCreate: (args) => !permissions.canManageRoles(args),
    hideDelete: (args) => !permissions.canManageRoles(args),
    listView: { initialColumns: ['name', 'assignedTo'] },
    itemView: { defaultFieldMode: (args) => (permissions.canManageRoles(args) ? 'edit' : 'read') },
  },
  fields: {
    name: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    ...Object.fromEntries(ROLE_FLAGS.map((flag) => [flag, checkbox({ defaultValue: false })])),
    assignedTo: relationship({ ref: 'User.role', many: true, ui: { itemView: { fieldMode: 'read' } } }),
    ...trackingFields,
  },
})
