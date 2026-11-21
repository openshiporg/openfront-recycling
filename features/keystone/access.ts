/**
 * Access rules (dissertation §7).
 *
 * - Raw transactional lists are for staff only. Customers reach their records through custom
 *   operations that prove ownership before using `context.sudo()` (features/keystone/storefront).
 * - Append-only lists deny update and delete to every role, owners included.
 * - Staff who are not owners (no `canManageSettings`) see and act only on the yards in `user.yards`.
 */

export const ROLE_FLAGS = [
  'canAccessDashboard',
  'canManageTickets',
  'canGradeTickets',
  'canOverridePrices',
  'canVoidTickets',
  'canPaySellers',
  'canManageCashDrawers',
  'canApproveVariances',
  'canManagePricing',
  'canManageMaterials',
  'canManageSellers',
  'canManageAccounts',
  'canManageInventory',
  'canManageSales',
  'canManageDispatch',
  'canDriveJobs',
  'canManageCompliance',
  'canManageFinance',
  'canViewReports',
  'canManageSettings',
  'canManageStaff',
  'canManageOnboarding',
  'canSeeOtherPeople',
  'canEditOtherPeople',
  'canManagePeople',
  'canManageRoles',
] as const

export type RoleFlag = (typeof ROLE_FLAGS)[number]

export type Session = {
  itemId: string
  listKey: string
  data: {
    name: string
    email?: string
    yards?: { id: string }[]
    role: ({ id: string; name: string } & Partial<Record<RoleFlag, boolean>>) | null
  }
}

export type AccessArgs = { session?: Session | null; [key: string]: any }

export function isSignedIn({ session }: AccessArgs) {
  return Boolean(session)
}

export function hasFlag(session: Session | null | undefined, flag: RoleFlag) {
  return session?.data?.role?.[flag] === true
}

export function isStaff(session: Session | null | undefined) {
  return hasFlag(session, 'canAccessDashboard')
}

/** Owners (business settings) act on every yard; everyone else on their assigned yards. */
export function seesAllYards(session: Session | null | undefined) {
  return hasFlag(session, 'canManageSettings')
}

export function sessionYardIds(session: Session | null | undefined): string[] {
  return (session?.data?.yards || []).map((yard) => yard.id)
}

export function canActOnYard(session: Session | null | undefined, yardId: string | null | undefined) {
  if (!isStaff(session)) return false
  if (seesAllYards(session)) return true
  return Boolean(yardId) && sessionYardIds(session).includes(String(yardId))
}

function flag(name: RoleFlag) {
  return ({ session }: AccessArgs) => isStaff(session) && hasFlag(session, name)
}

export const permissions = Object.fromEntries(
  ROLE_FLAGS.map((name) => [name, name === 'canAccessDashboard' ? ({ session }: AccessArgs) => isStaff(session) : flag(name)])
) as Record<RoleFlag, (args: AccessArgs) => boolean>

/** Staff with any one of the flags. */
export function anyOf(...names: RoleFlag[]) {
  return ({ session }: AccessArgs) => isStaff(session) && names.some((name) => hasFlag(session, name))
}

export const denyAll = () => false
export const allowAll = () => true

/** A filter limiting rows to the session's yards. `path` is the relationship that names the yard. */
export function yardFilter(path: string | string[] = 'yard') {
  const paths = Array.isArray(path) ? path : [path]
  return ({ session }: AccessArgs) => {
    if (!isStaff(session)) return false
    if (seesAllYards(session)) return true
    const ids = sessionYardIds(session)
    const one = (p: string) => p.split('.').reduceRight<any>((inner, key) => ({ [key]: inner }), { id: { in: ids } })
    return paths.length === 1 ? one(paths[0]) : { OR: paths.map(one) }
  }
}

type Operation = (args: AccessArgs) => boolean
type ListAccessOptions = {
  read?: Operation
  create?: Operation
  update?: Operation
  delete?: Operation
  yard?: string | string[]
}

/**
 * Access for a staff-only list. Reading needs dashboard access (plus the given read flag);
 * writing needs the named flag. Rows are scoped to the session's yards when `yard` is set.
 */
export function staffList({ read, create, update, delete: del, yard }: ListAccessOptions) {
  const canRead = read || permissions.canAccessDashboard
  const filter = yard ? yardFilter(yard) : undefined
  return {
    operation: {
      query: canRead,
      create: create || denyAll,
      update: update || denyAll,
      delete: del || denyAll,
    },
    ...(filter
      ? { filter: { query: filter, update: filter, delete: filter } }
      : {}),
  }
}

/** Append-only lists (§7.6): nobody updates or deletes, through any route. */
export function appendOnlyList({ read, create, yard }: { read?: Operation; create?: Operation; yard?: string | string[] }) {
  return staffList({ read, create: create || denyAll, update: denyAll, delete: denyAll, yard })
}

/** A field only commands may write (status fields, totals, snapshots). */
export const commandOnlyField = {
  access: { create: denyAll, update: denyAll },
  ui: { createView: { fieldMode: 'hidden' as const }, itemView: { fieldMode: 'read' as const } },
}

/** A field never shown outside the server (hashes, provider secrets). */
export const serverOnlyField = {
  access: { read: denyAll, create: denyAll, update: denyAll },
  ui: { createView: { fieldMode: 'hidden' as const }, itemView: { fieldMode: 'hidden' as const }, listView: { fieldMode: 'hidden' as const } },
}

export const rules = {
  canReadPeople: ({ session }: AccessArgs) => {
    if (!session) return false
    if (hasFlag(session, 'canSeeOtherPeople') || hasFlag(session, 'canManageStaff')) return true
    return { id: { equals: session.itemId } }
  },
  canUpdatePeople: ({ session }: AccessArgs) => {
    if (!session) return false
    if (hasFlag(session, 'canEditOtherPeople') || hasFlag(session, 'canManageStaff')) return true
    return { id: { equals: session.itemId } }
  },
}
