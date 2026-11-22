#!/usr/bin/env node
/**
 * Integration tests run in their own database, never the one the app reads.
 *
 *   npm run test:integration            # all tests/*.integration.ts
 *   npm run test:integration -- tests/ticket-flow.integration.ts
 *
 * The test database is TEST_DATABASE_URL, or DATABASE_URL with `_tests` appended to the database name
 * (scratch_openfront_recycling -> scratch_openfront_recycling_tests). It is created if missing and
 * migrated with `prisma migrate deploy` before the run. The guard in tests/db-guard.ts refuses any
 * database whose name does not end in `_tests`.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

function fail(message) {
  console.error(message)
  process.exit(1)
}

const appUrl = process.env.DATABASE_URL
let testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) {
  if (!appUrl) fail('Set DATABASE_URL (the app database) or TEST_DATABASE_URL.')
  const u = new URL(appUrl)
  const name = u.pathname.replace(/^\//, '')
  if (!name) fail('DATABASE_URL has no database name.')
  u.pathname = `/${name.endsWith('_tests') ? name : `${name}_tests`}`
  testUrl = u.toString()
}
const parsed = new URL(testUrl)
const dbName = parsed.pathname.replace(/^\//, '')
if (!dbName.endsWith('_tests')) fail(`The test database name must end in _tests (got "${dbName}").`)
if (appUrl && new URL(appUrl).pathname === parsed.pathname && new URL(appUrl).host === parsed.host) fail('The test database is the app database. Refusing.')
if (!parsed.searchParams.has('connection_limit')) parsed.searchParams.set('connection_limit', '3')
testUrl = parsed.toString()

const prisma = 'node_modules/.bin/prisma'
// Create the database if it does not exist (Postgres has no CREATE DATABASE IF NOT EXISTS).
const admin = new URL(testUrl)
admin.pathname = '/postgres'
admin.search = ''
const create = spawnSync(prisma, ['db', 'execute', '--url', admin.toString(), '--stdin'], { input: `CREATE DATABASE "${dbName}";`, encoding: 'utf8' })
const createOut = `${create.stdout || ''}${create.stderr || ''}`
if (create.status === 0) console.log(`Created test database ${dbName}.`)
else if (!/already exists/i.test(createOut)) fail(`Could not create ${dbName}: ${createOut.replaceAll(admin.toString(), '<server>').split('\n').slice(0, 3).join(' ')}`)

const env = { ...process.env, DATABASE_URL: testUrl, SHADOW_DATABASE_URL: '' }
try {
  execFileSync(prisma, ['migrate', 'deploy'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
} catch (error) {
  fail(`Migrating ${dbName} failed: ${String(error.stderr || error.message).replaceAll(testUrl, '<test db>').split('\n').slice(0, 5).join(' ')}`)
}
console.log(`Integration tests on ${dbName} (migrated).`)

const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync('tests').filter((f) => f.endsWith('.integration.ts')).sort().map((f) => `tests/${f}`)
const run = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', ...files], { env, stdio: 'inherit' })
process.exit(run.status ?? 1)
