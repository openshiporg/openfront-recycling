import { randomUUID } from 'node:crypto'
import { Decimal } from 'decimal.js'
import type { Tx } from './command'

/**
 * Inventory posting (dissertation §4.5, §5.13), adapted from Barbershop's recordInventoryMovement:
 * every movement has a unique referenceKey, and the (yard, material) balance row is locked and
 * changed in the same transaction. A second post with the same key is a no-op.
 *
 * Negative-stock rule: the truck on the scale is the truth. When a ship, process or transfer would
 * take a bulk balance below zero it still posts, and an `adjust` movement brings the balance back
 * to zero, flagged for manager review.
 */

export type MovementInput = {
  yardId: string
  materialId: string
  kind: string
  /** Signed weight change in the base unit. */
  weightDelta: Decimal | string | number
  /** Signed cost change in cents. When omitted for outflows, the current average cost is used. */
  costDeltaCents?: number
  referenceKey: string
  ticketId?: string | null
  ticketLineId?: string | null
  processingRunId?: string | null
  transferId?: string | null
  unitId?: string | null
  reason?: string
  actorId?: string | null
  /** Moves weight into or out of the held bucket instead of on-hand. */
  bucket?: 'onHand' | 'held' | 'reserved'
  allowNegative?: boolean
}

async function lockBalance(tx: Tx, yardId: string, materialId: string) {
  await tx.$executeRawUnsafe(
    `INSERT INTO "InventoryBalance" ("id", "yard", "material", "onHandWeight", "reservedWeight", "heldWeight", "totalCostCents", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 0, 0, 0, 0, NOW(), NOW()) ON CONFLICT ("yard", "material") DO NOTHING`,
    randomUUID(), yardId, materialId
  )
  const rows: any[] = await tx.$queryRawUnsafe(
    `SELECT "id", "onHandWeight"::text AS "onHand", "reservedWeight"::text AS "reserved", "heldWeight"::text AS "held", "totalCostCents" AS "cost"
     FROM "InventoryBalance" WHERE "yard" = $1 AND "material" = $2 FOR UPDATE`,
    yardId, materialId
  )
  const row = rows[0]
  return { id: row.id as string, onHand: new Decimal(row.onHand), reserved: new Decimal(row.reserved), held: new Decimal(row.held), cost: Number(row.cost) }
}

export function averageCostCents(onHand: Decimal, costCents: number, weight: Decimal) {
  if (onHand.lte(0)) return 0
  return new Decimal(costCents).times(weight).div(onHand).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
}

export async function postMovement(tx: Tx, input: MovementInput): Promise<{ id: string; created: boolean; costDeltaCents: number; adjusted?: boolean }> {
  const existing = await tx.inventoryMovement.findUnique({ where: { referenceKey: input.referenceKey } })
  if (existing) return { id: existing.id, created: false, costDeltaCents: existing.costDeltaCents }

  const balance = await lockBalance(tx, input.yardId, input.materialId)
  const delta = new Decimal(String(input.weightDelta))
  const bucket = input.bucket || 'onHand'
  let adjusted = false

  if (bucket === 'held' || bucket === 'reserved') {
    const field = bucket === 'held' ? 'heldWeight' : 'reservedWeight'
    const current = bucket === 'held' ? balance.held : balance.reserved
    const next = Decimal.max(0, current.plus(delta))
    await tx.inventoryBalance.update({ where: { id: balance.id }, data: { [field]: next.toFixed(2) } })
    const movement = await tx.inventoryMovement.create({
      data: {
        yardId: input.yardId, materialId: input.materialId, kind: input.kind, weightDelta: delta.toFixed(2), costDeltaCents: 0,
        weightAfter: balance.onHand.toFixed(2), ticketId: input.ticketId || null, ticketLineId: input.ticketLineId || null,
        unitId: input.unitId || null, reason: input.reason || '', referenceKey: input.referenceKey, createdById: input.actorId || null,
      },
    })
    return { id: movement.id, created: true, costDeltaCents: 0 }
  }

  let cost = input.costDeltaCents
  if (cost === undefined) cost = delta.isNegative() ? -averageCostCents(balance.onHand, balance.cost, delta.abs()) : 0
  let onHand = balance.onHand.plus(delta)
  let totalCost = balance.cost + cost

  const movement = await tx.inventoryMovement.create({
    data: {
      yardId: input.yardId, materialId: input.materialId, kind: input.kind, weightDelta: delta.toFixed(2), costDeltaCents: cost,
      weightAfter: onHand.toFixed(2), ticketId: input.ticketId || null, ticketLineId: input.ticketLineId || null,
      processingRunId: input.processingRunId || null, transferId: input.transferId || null, unitId: input.unitId || null,
      reason: input.reason || '', referenceKey: input.referenceKey, createdById: input.actorId || null,
    },
  })

  if (onHand.isNegative() && !input.allowNegative) {
    // Truck on the scale is the truth: bring the bulk balance back to zero for review.
    const fix = onHand.abs()
    await tx.inventoryMovement.create({
      data: {
        yardId: input.yardId, materialId: input.materialId, kind: 'adjust', weightDelta: fix.toFixed(2), costDeltaCents: 0, weightAfter: '0',
        reason: `Brought to zero after ${input.kind} (${input.referenceKey})`, needsReview: true, referenceKey: `${input.referenceKey}:zero`,
        ticketId: input.ticketId || null, processingRunId: input.processingRunId || null, transferId: input.transferId || null, createdById: input.actorId || null,
      },
    })
    onHand = new Decimal(0)
    totalCost = 0
    adjusted = true
  }
  if (onHand.isZero()) totalCost = 0
  if (totalCost < 0) totalCost = 0

  await tx.inventoryBalance.update({ where: { id: balance.id }, data: { onHandWeight: onHand.toFixed(2), totalCostCents: totalCost } })
  return { id: movement.id, created: true, costDeltaCents: cost, adjusted }
}

export async function balanceOf(tx: Tx, yardId: string, materialId: string) {
  const row = await tx.inventoryBalance.findFirst({ where: { yardId, materialId } })
  return row
}
