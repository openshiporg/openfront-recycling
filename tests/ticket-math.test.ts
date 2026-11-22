import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeLine, computeTicketTotals, roundCashUpToNickel, sequentialLineWeights, unitFactor } from '../features/recycling/ticketMath'
import { splitPayouts, screenSeller, validateTicketCompliance, blockingItems, RULE_TEMPLATES } from '../features/recycling/compliance'

const line = (o: any) => computeLine({ grossWeight: '0', tareWeight: '0', unit: 'lb', unitPrice: '0', direction: 'pay_seller', ...o })

test('net, deduction by weight and percent, rounding half up', () => {
  assert.equal(line({ grossWeight: '152.5', tareWeight: '12.5', unitPrice: '3.40' }).amountCents, 47600)
  const w = line({ grossWeight: '100', tareWeight: '0', deductionWeight: '2.5', unitPrice: '1' })
  assert.equal(w.payWeight.toString(), '97.5')
  const p = line({ grossWeight: '33.33', tareWeight: '0', deductionPercent: '10', unitPrice: '1' })
  assert.equal(p.deduction.toString(), '3.33')
  assert.equal(p.amountCents, 3000)
  // 0.005 dollars rounds half up to a cent
  assert.equal(line({ grossWeight: '1', tareWeight: '0', unitPrice: '0.125' }).amountCents, 13)
  assert.throws(() => line({ grossWeight: '10', tareWeight: '10', unitPrice: '1' }), /more than tare/)
  assert.throws(() => line({ grossWeight: '10', tareWeight: '0', deductionWeight: '11', unitPrice: '1' }), /larger than the net/)
})

test('every unit', () => {
  assert.equal(unitFactor('lb', 'lb').toString(), '1')
  assert.equal(line({ grossWeight: '250', unit: 'cwt', unitPrice: '40' }).amountCents, 10000)
  assert.equal(line({ grossWeight: '4000', unit: 'net_ton', unitPrice: '210' }).amountCents, 42000)
  assert.equal(line({ grossWeight: '2240', unit: 'gross_ton', unitPrice: '200' }).amountCents, 20000)
  assert.equal(computeLine({ grossWeight: '1500', tareWeight: '0', unit: 'metric_tonne', unitPrice: '300', direction: 'pay_seller' }, 'kg').amountCents, 45000)
  assert.equal(line({ unit: 'each', quantity: 3, unitPrice: '45.50' }).amountCents, 13650)
  assert.throws(() => line({ unit: 'each', quantity: 0, unitPrice: '1' }), /whole quantity/)
})

test('charge items and ticket total with fee tax', () => {
  const buy = line({ grossWeight: '100', unitPrice: '2' })
  const tire = line({ unit: 'each', quantity: 2, unitPrice: '5', direction: 'charge_customer' })
  assert.equal(tire.signedAmountCents, -1000)
  const totals = computeTicketTotals([buy, tire], [{ label: 'Weigh fee', amountCents: -300 }], '10')
  assert.equal(totals.materialTotalCents, 19000)
  assert.equal(totals.taxCents, 130)
  assert.equal(totals.totalCents, 19000 - 300 - 130)
})

test('truck-scale sequential weights and nickel rounding', () => {
  const pairs = sequentialLineWeights(['40000', '38000', '36500'])
  assert.deepEqual(pairs.map((p) => [p.gross.toString(), p.tare.toString()]), [['40000', '38000'], ['38000', '36500']])
  assert.throws(() => sequentialLineWeights(['30000', '31000']))
  assert.equal(roundCashUpToNickel(213), 215)
  assert.equal(roundCashUpToNickel(215), 215)
})

test('payout split puts a fee on the payable-now group, never the held one', () => {
  const groups = splitPayouts({
    lines: [{ id: 'cat', signedAmountCents: 10000, materialId: 'm-cat' }, { id: 'iron', signedAmountCents: 3000, materialId: 'm-iron' }, { id: 'tire', signedAmountCents: -500, materialId: 'm-tire' }],
    restrictions: [{ materialId: 'm-cat', forbidCash: true, paymentHoldDays: 2 } as any],
    yardMethods: ['cash', 'check'], profile: { defaultPaymentHoldDays: 0 } as any, completedAt: new Date('2026-11-21T12:00:00Z'),
  })
  assert.equal(groups.length, 2)
  const now = groups.find((g) => !g.releaseAt)!
  const held = groups.find((g) => g.releaseAt)!
  assert.equal(now.amountCents, 2500)
  assert.equal(held.amountCents, 10000)
  assert.deepEqual(held.allowedMethods, ['check'])
})

test('compliance: missing items block; do_not_buy cannot be overridden', () => {
  const profile = { ...(RULE_TEMPLATES.ohio as any).profile }
  const items = validateTicketCompliance({
    direction: 'inbound', isCommercial: false, isAdjustment: false, now: new Date(),
    seller: { status: 'active', dateOfBirth: new Date('1990-01-01'), doNotBuyMatch: false },
    identity: { expiresOn: new Date(Date.now() + 1e10), hasFrontImage: true, hasThumbprint: false },
    vehiclePlate: '', attachments: [], lines: [{ id: 'l1', materialId: 'm', hasPrice: true, documents: [] }],
  } as any, profile, [])
  assert.ok(items.length > 0)
  assert.ok(blockingItems(items, null).length > 0)
  const dnb = screenSeller({ seller: { status: 'do_not_buy', dateOfBirth: new Date('1990-01-01'), doNotBuyMatch: true }, identity: { expiresOn: new Date(Date.now() + 1e10), hasFrontImage: true }, profile, isCommercial: false, now: new Date() } as any)
  assert.ok(dnb.some((i: any) => !i.overridable))
})
