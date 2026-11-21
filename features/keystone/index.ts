import { createAuth } from '@keystone-6/auth'
import { config } from '@keystone-6/core'
import 'dotenv/config'
import { models } from './models'
import { statelessSessions } from '@keystone-6/core/session'
import { extendGraphqlSchema } from './mutations'
import { sendPasswordResetEmail } from './lib/mail'
import { withMcpBearerSessions } from './mcp-oauth/session'
import { ROLE_FLAGS } from './access'
import { addDatabaseConstraints } from './prismaConstraints'
import { throwKeystonePrismaErrors } from './lib/keystonePrismaErrors'
import { pooledDatabaseUrl } from './lib/database-url'
import { storageConfig } from './lib/storage'

const databaseURL = process.env.DATABASE_URL || 'file:./keystone.db'

const sessionConfig = {
  maxAge: 60 * 60 * 24 * 30,
  secret: process.env.SESSION_SECRET || 'this secret should only be used in development',
}

const allFlags = Object.fromEntries(ROLE_FLAGS.map((flag) => [flag, true]))

const { withAuth } = createAuth({
  listKey: 'User',
  identityField: 'email',
  secretField: 'password',
  initFirstItem: {
    fields: ['name', 'email', 'password'],
    itemData: { role: { create: { name: 'Owner', ...allFlags } } },
  },
  passwordResetLink: {
    async sendToken(args) {
      await sendPasswordResetEmail(args.token, args.identity)
    },
  },
  sessionData: `
    name
    email
    yards { id }
    role {
      id
      name
      ${ROLE_FLAGS.join('\n      ')}
    }
  `,
})

export default withAuth(
  config({
    db: {
      provider: 'postgresql',
      url: pooledDatabaseUrl(databaseURL),
      // Keystone returns failed queries as values; this makes them throw so transactions roll back.
      extendPrismaClient: throwKeystonePrismaErrors,
      extendPrismaSchema: addDatabaseConstraints,
    },
    lists: models,
    storage: storageConfig(),
    ui: {
      isAccessAllowed: ({ session }) => session?.data.role?.canAccessDashboard ?? false,
    },
    server: { maxFileSize: 12 * 1024 * 1024 },
    // MCP OAuth bearer tokens resolve to the approving user; everything else is unchanged.
    session: withMcpBearerSessions(statelessSessions(sessionConfig)),
    graphql: {
      extendGraphqlSchema,
    },
  })
)
