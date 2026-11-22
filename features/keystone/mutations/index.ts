import { mergeSchemas } from '@graphql-tools/schema'
import { MapperKind, mapSchema } from '@graphql-tools/utils'
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
  // Commands named in the spec (createServiceRequest, updateAccountContact, ...) replace the generated
  // list mutations of the same name; those raw mutations are denied to everyone anyway.
  const owned = new Set([...mutations.matchAll(/^\s*([A-Za-z0-9_]+)\s*\(/gm)].map((m) => m[1]))
  const base = mapSchema(baseSchema, {
    [MapperKind.MUTATION_ROOT_FIELD]: (field, name) => (owned.has(name) ? null : field),
  })
  return mergeSchemas({
    schemas: [base],
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
