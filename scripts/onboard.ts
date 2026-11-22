/**
 * Run onboarding from the command line (dissertation §11), for a fresh database before the first owner
 * signs in. Same command as the dashboard's runOnboarding; every step is safe to run again.
 *   node --import tsx scripts/onboard.ts path/to/onboarding.json
 * The JSON is a RunOnboardingInput: { template, rulesTemplate, cardProvider, business: {...}, yard: {...} }.
 */
import { readFileSync } from 'node:fs'
import { keystoneContext } from '../features/keystone/context'
import { ROLE_FLAGS } from '../features/keystone/access'
import { runOnboarding } from '../features/keystone/commands/onboarding'

;(async () => {
  const file = process.argv[2]
  if (!file) throw new Error('Pass the path to the onboarding JSON.')
  const input = JSON.parse(readFileSync(file, 'utf8'))
  const flags = Object.fromEntries(ROLE_FLAGS.map((f) => [f, true]))
  const ctx: any = keystoneContext.withSession({ listKey: 'User', data: { name: 'Onboarding', role: { name: 'Owner', ...flags }, yards: [] } } as any)
  const r = await runOnboarding(ctx, input, `cli:${input?.yard?.code || 'MAIN'}`)
  console.log(JSON.stringify(r))
  process.exit(0)
})().catch((e) => { console.error(e?.message || e); process.exit(1) })
