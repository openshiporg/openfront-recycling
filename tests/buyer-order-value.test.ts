import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accountSalesOrder, accountSalesOrders } from '../features/keystone/commands/storefront-buyer'

// Read-only projection contract: exercise both portal functions with explicit base-unit settings.
for (const [base, unit, weight, price, expected] of [
  ['lb', 'net_ton', '20000', '285', 285000],
  ['lb', 'gross_ton', '2240', '300', 30000],
  ['lb', 'cwt', '250', '12', 3000],
  ['lb', 'lb', '10', '3.125', 3125],
  ['kg', 'metric_tonne', '1500', '200', 30000],
  ['kg', 'kg', '10', '2.5', 2500],
  ['lb', 'each', '3', '45', 13500],
] as const) {
  test(`buyer order value uses ${unit} prices with ${base} base weights`, async () => {
    const order = { id: 'order', lines: [{ weight, unitPrice: price, unit, shippedWeight: '0' }], shipments: [] }
    const prisma: any = {
      account: { findFirst: async () => ({ id: 'buyer', isBuyer: true }) },
      accountContact: { findFirst: async () => ({ role: 'admin' }) },
      businessSettings: { findFirst: async () => ({ weightUnit: base }) },
      salesOrder: { findMany: async () => [order], findFirst: async () => order },
    }
    const session = { itemId: 'contact' }
    const rows = await accountSalesOrders(prisma, session, 'buyer')
    const detail = await accountSalesOrder(prisma, session, 'buyer', 'order')
    assert.equal(rows[0].valueCents, expected)
    assert.equal(detail.valueCents, expected)
    assert.equal(detail.orderedWeight, weight, 'weights remain in the business base unit')
  })
}

test('buyer order value sums half-up rounded lines; null prices contribute zero', async () => {
  const order = { lines: [{ weight: '1', unitPrice: '0.005', unit: 'lb' }, { weight: '1', unitPrice: '0.005', unit: 'lb' }, { weight: '100', unitPrice: null, unit: 'lb' }], shipments: [] }
  const prisma: any = {
    account: { findFirst: async () => ({ id: 'buyer', isBuyer: true }) },
    accountContact: { findFirst: async () => ({ role: 'admin' }) },
    businessSettings: { findFirst: async () => null },
    salesOrder: { findFirst: async () => order },
  }
  assert.equal((await accountSalesOrder(prisma, { itemId: 'contact' }, 'buyer', 'order')).valueCents, 2)
})
