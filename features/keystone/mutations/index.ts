import { mergeSchemas } from '@graphql-tools/schema'
import type { GraphQLSchema } from 'graphql'
import redirectToInit from './redirectToInit'
import { commandModules } from '../commands'

const graphql = String.raw

export function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  const typeDefs = commandModules.map((m) => m.typeDefs || '').join('\n')
  const mutations = commandModules.map((m) => m.mutationDefs || '').join('\n')
  const queries = commandModules.map((m) => m.queryDefs || '').join('\n')
  const resolvers: any = { Query: { redirectToInit }, Mutation: {} }
  for (const m of commandModules) {
    Object.assign(resolvers.Query, m.resolvers.Query || {})
    Object.assign(resolvers.Mutation, m.resolvers.Mutation || {})
    for (const [type, fields] of Object.entries(m.resolvers)) {
      if (type === 'Query' || type === 'Mutation') continue
      resolvers[type] = { ...(resolvers[type] || {}), ...(fields as object) }
    }
  }
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: graphql`
      ${typeDefs}
      type Query {
        redirectToInit: Boolean
        ${queries}
      }
      type Mutation {
        ${mutations}
      }
    `,
    resolvers,
  })
}
