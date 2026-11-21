import { checkbox, decimal, file, image, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'
import { commandOnlyField, denyAll, isStaff, serverOnlyField, type AccessArgs } from '../access'

/** Spread into a field: only commands write it. */
export const commandOnlyFieldText = commandOnlyField

/** Spread into a field: only staff may read it (public lists that carry internal fields). */
export const staffRead = { access: { read: ({ session }: AccessArgs) => isStaff(session) } }

export { serverOnlyField }

export const opts = (...values: string[]) =>
  values.map((value) => ({ value, label: value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) }))

/** A status (or other command-owned) select: readable, never written through raw list CRUD. */
export function status(values: string[], defaultValue: string) {
  return select({
    type: 'string',
    options: opts(...values),
    defaultValue,
    validation: { isRequired: true },
    isIndexed: true,
    ...commandOnlyField,
  })
}

export function choice(values: string[], defaultValue?: string, extra: Record<string, any> = {}) {
  return select({
    type: 'string',
    options: opts(...values),
    ...(defaultValue ? { defaultValue } : {}),
    ...(defaultValue ? { validation: { isRequired: true } } : {}),
    ...extra,
  })
}

/** Integer cents. */
export const cents = (extra: Record<string, any> = {}) => integer({ defaultValue: 0, validation: { isRequired: true }, ...extra })
export const optionalCents = (extra: Record<string, any> = {}) => integer(extra)

/** Weight in the business base unit. */
export const weight = (extra: Record<string, any> = {}) => decimal({ precision: 14, scale: 2, ...extra })
export const weightRequired = (extra: Record<string, any> = {}) =>
  decimal({ precision: 14, scale: 2, defaultValue: '0', validation: { isRequired: true }, ...extra })

/** Unit price, five decimals. */
export const unitPrice = (extra: Record<string, any> = {}) => decimal({ precision: 14, scale: 5, ...extra })

export const commandText = (extra: Record<string, any> = {}) => text({ ...commandOnlyField, ...extra })
export const commandTimestamp = () => timestamp({ ...commandOnlyField })
export const commandCents = () => integer({ defaultValue: 0, validation: { isRequired: true }, ...commandOnlyField })
export const commandJson = (extra: Record<string, any> = {}) => json({ ...commandOnlyField, ...extra })
export const commandWeight = () => decimal({ precision: 14, scale: 2, defaultValue: '0', validation: { isRequired: true }, ...commandOnlyField })
export const commandCheckbox = () => checkbox({ defaultValue: false, ...commandOnlyField })

/** A relationship set only by commands. */
export const commandRel = (ref: string, extra: Record<string, any> = {}) =>
  relationship({ ref, ...extra, access: { create: denyAll, update: denyAll }, ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } } })

export const addressFields = () => ({
  addressLine1: text(),
  addressLine2: text(),
  city: text(),
  region: text(),
  postalCode: text(),
  country: text({ defaultValue: 'US' }),
})

export { checkbox, decimal, file, image, integer, json, relationship, select, text, timestamp }
