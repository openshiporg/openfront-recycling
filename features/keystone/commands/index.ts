import { ticketMutationDefs, ticketQueryDefs, ticketResolvers, ticketTypeDefs } from './tickets'
import { moneyMutationDefs, moneyQueryDefs, moneyResolvers, moneyTypeDefs } from './money'

export type CommandModule = { typeDefs?: string; mutationDefs?: string; queryDefs?: string; resolvers: Record<string, Record<string, unknown>> }

export const commandModules: CommandModule[] = [
  { typeDefs: ticketTypeDefs, mutationDefs: ticketMutationDefs, queryDefs: ticketQueryDefs, resolvers: ticketResolvers },
  { typeDefs: moneyTypeDefs, mutationDefs: moneyMutationDefs, queryDefs: moneyQueryDefs, resolvers: moneyResolvers },
]
