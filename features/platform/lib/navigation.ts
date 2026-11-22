import { Banknote, Boxes, Scale, Tags } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Staff screens (dissertation §9). Hrefs are relative to the dashboard basePath. An item shows when
 * the signed-in role has any of its flags; the server checks the same flags on every read and command.
 */
export interface PlatformNavItem {
  title: string
  href: string
  description: string
  icon: LucideIcon
  flags: string[]
}

export const platformNavItems: PlatformNavItem[] = [
  {
    title: 'Scale house',
    href: '/platform/scale-house',
    description: 'Open tickets, weigh, grade, check compliance and complete.',
    icon: Scale,
    flags: ['canManageTickets', 'canGradeTickets', 'canPaySellers'],
  },
  {
    title: 'Cashier',
    href: '/platform/cashier',
    description: 'Payout queue, cash drawers, collections and the check register.',
    icon: Banknote,
    flags: ['canPaySellers', 'canManageCashDrawers', 'canManageFinance'],
  },
  {
    title: 'Pricing',
    href: '/platform/pricing',
    description: 'Yard boards, customer tiers and contract lists; publish dated prices.',
    icon: Tags,
    flags: ['canManagePricing'],
  },
  {
    title: 'Materials',
    href: '/platform/materials',
    description: 'Categories and materials, photos, preparation tips and rules per profile.',
    icon: Boxes,
    flags: ['canManageMaterials', 'canManageCompliance'],
  },
]

export type NavRole = Record<string, boolean | null | undefined> | null | undefined

export function visibleNavItems(role: NavRole, basePath = '/dashboard') {
  if (!role || role.canAccessDashboard === false) return []
  return platformNavItems
    .filter((item) => item.flags.some((flag) => role[flag]))
    .map((item) => ({ ...item, href: `${basePath}${item.href}` }))
}
