import { ticketMutationDefs, ticketQueryDefs, ticketResolvers, ticketTypeDefs } from './tickets'
import { moneyMutationDefs, moneyQueryDefs, moneyResolvers, moneyTypeDefs } from './money'
import { inventoryMutationDefs, inventoryQueryDefs, inventoryResolvers, inventoryTypeDefs } from './inventory'
import { accountMutationDefs, accountResolvers, accountTypeDefs } from './accounts'
import { dispatchMutationDefs, dispatchResolvers, dispatchTypeDefs } from './dispatch'
import { complianceMutationDefs, complianceQueryDefs, complianceResolvers, complianceTypeDefs } from './compliance'
import { nonprofitMutationDefs, nonprofitResolvers, nonprofitTypeDefs } from './nonprofits'
import { salesMutationDefs, salesResolvers, salesTypeDefs } from './sales'
import { publicQueryDefs, publicResolvers, publicTypeDefs } from './storefront-public'
import { onboardingMutationDefs, onboardingResolvers, onboardingTypeDefs } from './onboarding'
import { pricingMutationDefs, pricingResolvers, pricingTypeDefs } from './pricing'
import { staffBoardQueryDefs, staffBoardResolvers, staffBoardTypeDefs } from './staff-boards'
import { portalQueryDefs, portalResolvers, portalTypeDefs } from './storefront-account'
import { sellerMutationDefs, sellerQueryDefs, sellerResolvers, sellerTypeDefs } from './storefront-seller'

export type CommandModule = { typeDefs?: string; mutationDefs?: string; queryDefs?: string; resolvers: Record<string, Record<string, unknown>> }

export const commandModules: CommandModule[] = [
  { typeDefs: ticketTypeDefs, mutationDefs: ticketMutationDefs, queryDefs: ticketQueryDefs, resolvers: ticketResolvers },
  { typeDefs: moneyTypeDefs, mutationDefs: moneyMutationDefs, queryDefs: moneyQueryDefs, resolvers: moneyResolvers },
  { typeDefs: inventoryTypeDefs, mutationDefs: inventoryMutationDefs, queryDefs: inventoryQueryDefs, resolvers: inventoryResolvers },
  { typeDefs: accountTypeDefs, mutationDefs: accountMutationDefs, resolvers: accountResolvers },
  { typeDefs: dispatchTypeDefs, mutationDefs: dispatchMutationDefs, resolvers: dispatchResolvers },
  { typeDefs: salesTypeDefs, mutationDefs: salesMutationDefs, resolvers: salesResolvers },
  { typeDefs: complianceTypeDefs, mutationDefs: complianceMutationDefs, queryDefs: complianceQueryDefs, resolvers: complianceResolvers },
  { typeDefs: nonprofitTypeDefs, mutationDefs: nonprofitMutationDefs, resolvers: nonprofitResolvers },
  { typeDefs: publicTypeDefs, queryDefs: publicQueryDefs, resolvers: publicResolvers },
  { typeDefs: pricingTypeDefs, mutationDefs: pricingMutationDefs, resolvers: pricingResolvers },
  { typeDefs: onboardingTypeDefs, mutationDefs: onboardingMutationDefs, resolvers: onboardingResolvers },
  { typeDefs: staffBoardTypeDefs, queryDefs: staffBoardQueryDefs, resolvers: staffBoardResolvers },
  { typeDefs: portalTypeDefs, queryDefs: portalQueryDefs, resolvers: portalResolvers },
  { typeDefs: sellerTypeDefs, queryDefs: sellerQueryDefs, mutationDefs: sellerMutationDefs, resolvers: sellerResolvers },
]
