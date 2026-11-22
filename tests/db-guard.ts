/**
 * Imported first by every integration test: refuse to write test records into the app's database.
 * Run the tests through `npm run test:integration`, which points DATABASE_URL at the `_tests` database.
 */
const url = process.env.DATABASE_URL || ''
let name = ''
try { name = new URL(url).pathname.replace(/^\//, '') } catch { /* not a URL */ }
if (!name.endsWith('_tests')) {
  throw new Error(`Integration tests only run against a database whose name ends in _tests (DATABASE_URL points at "${name || 'nothing'}"). Use npm run test:integration.`)
}
export {}
