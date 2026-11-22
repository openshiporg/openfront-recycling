import { Decimal } from 'decimal.js'
import { hasFlag } from '../access'
import { cleanKey, compareAndSet, lockRow, refuse, requireYard, runCommand, type CommandCtx } from '../lib/command'
import { averageCostCents, postMovement } from '../lib/inventory'
import { releaseDueHoldTags, refreshDuePayouts } from '../lib/domain'
import { dec } from '../../recycling/ticketMath'

/**
 * Inventory, processing, transfers and holds (dissertation §4.5, §5.3, §5.13).
 * Units are tagged pieces of bulk weight: their weight stays inside the (yard, material) balance.
 */

async function balanceRow(tx: any, yardId: string, materialId: string) {
  return tx.inventoryBalance.findFirst({ where: { yardId, materialId } })
}
function available(b: any) {
  if (!b) return new Decimal(0)
  return new Decimal(String(b.onHandWeight)).minus(String(b.heldWeight)).minus(String(b.reservedWeight))
}
function positive(value: unknown, label: string) {
  const d = dec(value as any)
  if (!d.gt(0)) refuse(`${label} must be above zero.`)
  return d
}

// --- Regrade (§4.5): move weight from one material to another at its average cost. ---
export async function regradeTx(ctx: CommandCtx, input: { yardId: string; fromMaterialId: string; toMaterialId: string; weight: string; reason: string }, key: string) {
  requireYard(ctx.session, input.yardId)
  if (input.fromMaterialId === input.toMaterialId) refuse('Choose a different material.')
  const weight = positive(input.weight, 'The weight')
  const reason = String(input.reason || '').trim() || 'Regrade'
  const out = await postMovement(ctx.tx, { yardId: input.yardId, materialId: input.fromMaterialId, kind: 'regrade_out', weightDelta: weight.negated(), referenceKey: `regrade:${key}:out`, reason, actorId: ctx.actorId })
  await postMovement(ctx.tx, { yardId: input.yardId, materialId: input.toMaterialId, kind: 'regrade_in', weightDelta: weight, costDeltaCents: -out.costDeltaCents, referenceKey: `regrade:${key}:in`, reason, actorId: ctx.actorId })
  await ctx.audit({ eventType: 'inventory.regraded', aggregateType: 'InventoryMovement', aggregateId: out.id, yardId: input.yardId, after: { from: input.fromMaterialId, to: input.toMaterialId, weight: weight.toFixed(2) }, reason })
  return { id: out.id }
}

// --- Manual adjustment (count correction). ---
export async function adjustInventoryTx(ctx: CommandCtx, input: { yardId: string; materialId: string; weightDelta: string; reason: string }, key: string) {
  requireYard(ctx.session, input.yardId)
  const reason = String(input.reason || '').trim()
  if (reason.length < 3) refuse('Give the reason for the adjustment.')
  const delta = dec(input.weightDelta)
  if (delta.isZero()) refuse('The change cannot be zero.')
  const result = await postMovement(ctx.tx, { yardId: input.yardId, materialId: input.materialId, kind: 'adjust', weightDelta: delta, costDeltaCents: delta.isNegative() ? undefined : 0, referenceKey: `adjust:${key}`, reason, actorId: ctx.actorId })
  await ctx.audit({ eventType: 'inventory.adjusted', aggregateType: 'InventoryMovement', aggregateId: result.id, yardId: input.yardId, after: { materialId: input.materialId, weightDelta: delta.toFixed(2) }, reason })
  return { id: result.id }
}

export async function reviewMovementTx(ctx: CommandCtx, input: { movementId: string }) {
  const movement = await ctx.tx.inventoryMovement.findUnique({ where: { id: input.movementId } })
  if (!movement || !movement.needsReview) refuse('Nothing to review.')
  requireYard(ctx.session, movement.yardId)
  // Review marks are kept apart from the append-only movement: an audit event records them.
  const existing = await ctx.tx.auditEvent.findFirst({ where: { eventType: 'inventory.reviewed', aggregateId: movement.id } })
  if (existing) return { id: movement.id }
  await ctx.audit({ eventType: 'inventory.reviewed', aggregateType: 'InventoryMovement', aggregateId: movement.id, yardId: movement.yardId, key: `inventory.reviewed:${movement.id}` })
  return { id: movement.id }
}

// --- Units (tags). ---
export async function createUnitTx(ctx: CommandCtx, input: { yardId: string; materialId: string; weight: string; form?: string; location?: string; tagNumber?: string | null }) {
  requireYard(ctx.session, input.yardId)
  const weight = positive(input.weight, 'The unit weight')
  const balance = await balanceRow(ctx.tx, input.yardId, input.materialId)
  const tagged = await ctx.tx.inventoryUnit.aggregate({ where: { yardId: input.yardId, materialId: input.materialId, status: { in: ['available', 'held', 'allocated'] } }, _sum: { weight: true } })
  const untagged = available(balance).minus(String(tagged._sum.weight ?? 0))
  if (weight.gt(untagged)) refuse(`Only ${untagged.toFixed(2)} of this material is untagged at the yard.`)
  const tagNumber = input.tagNumber?.trim() || `T${String(await ctx.sequence(`yard:${input.yardId}`, 'unit_tag', input.yardId)).padStart(6, '0')}`
  const cost = balance ? averageCostCents(new Decimal(String(balance.onHandWeight)), balance.totalCostCents, weight) : 0
  const unit = await ctx.tx.inventoryUnit.create({ data: { yardId: input.yardId, materialId: input.materialId, tagNumber, form: input.form || 'bale', weight: weight.toFixed(2), location: input.location || '', status: 'available', costCents: cost } })
  await ctx.audit({ eventType: 'unit.created', aggregateType: 'InventoryUnit', aggregateId: unit.id, yardId: input.yardId, after: { tagNumber, weight: weight.toFixed(2) } })
  return unit
}

// --- Processing runs (§4.5): inputs consumed, outputs made, cost spread by weight. ---
type RunLine = { materialId: string; weight: string; unitIds?: string[] | null; makeUnit?: boolean | null; form?: string | null }
export async function postProcessingRunTx(ctx: CommandCtx, input: { yardId: string; kind: string; inputs: RunLine[]; outputs: RunLine[]; processingCostCents?: number | null; notes?: string | null }) {
  const { tx } = ctx
  requireYard(ctx.session, input.yardId)
  if (!input.inputs?.length || !input.outputs?.length) refuse('A processing run needs inputs and outputs.')
  const inTotal = input.inputs.reduce((s, l) => s.plus(positive(l.weight, 'Each input weight')), new Decimal(0))
  const outTotal = input.outputs.reduce((s, l) => s.plus(positive(l.weight, 'Each output weight')), new Decimal(0))
  if (outTotal.gt(inTotal)) refuse('Outputs cannot weigh more than inputs.')
  const extraCost = Math.max(0, Math.trunc(Number(input.processingCostCents || 0)))
  const run = await tx.processingRun.create({ data: { yardId: input.yardId, kind: input.kind || 'other', status: 'posted', inputs: input.inputs, outputs: input.outputs, lossWeight: inTotal.minus(outTotal).toFixed(2), processingCostCents: extraCost, operatorId: ctx.actorId, postedAt: ctx.now, notes: input.notes || '' } })
  let pool = extraCost
  for (const [i, line] of input.inputs.entries()) {
    for (const unitId of line.unitIds || []) {
      const won = await tx.inventoryUnit.updateMany({ where: { id: unitId, status: 'available', yardId: input.yardId }, data: { status: 'consumed' } })
      if (won.count !== 1) refuse('A unit in this run is no longer available.')
    }
    const m = await postMovement(tx, { yardId: input.yardId, materialId: line.materialId, kind: 'process_in', weightDelta: dec(line.weight).negated(), processingRunId: run.id, referenceKey: `run:${run.id}:in:${i}`, actorId: ctx.actorId })
    pool += -m.costDeltaCents
  }
  // Spread the pooled cost over outputs by weight; the last line takes the remainder.
  let spent = 0
  for (const [i, line] of input.outputs.entries()) {
    const share = i === input.outputs.length - 1 ? pool - spent : new Decimal(pool).times(dec(line.weight)).div(outTotal).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
    spent += share
    await postMovement(tx, { yardId: input.yardId, materialId: line.materialId, kind: 'process_out', weightDelta: dec(line.weight), costDeltaCents: share, processingRunId: run.id, referenceKey: `run:${run.id}:out:${i}`, actorId: ctx.actorId })
    if (line.makeUnit) {
      const tagNumber = `T${String(await ctx.sequence(`yard:${input.yardId}`, 'unit_tag', input.yardId)).padStart(6, '0')}`
      await tx.inventoryUnit.create({ data: { yardId: input.yardId, materialId: line.materialId, tagNumber, form: line.form || 'bale', weight: dec(line.weight).toFixed(2), status: 'available', costCents: share, createdFromRunId: run.id } })
    }
  }
  await ctx.audit({ eventType: 'processing.posted', aggregateType: 'ProcessingRun', aggregateId: run.id, yardId: input.yardId, after: { inWeight: inTotal.toFixed(2), outWeight: outTotal.toFixed(2), costCents: pool } })
  return run
}

// --- Yard transfers (§4.5): send at cost, receive the weight actually weighed. ---
export async function sendTransferTx(ctx: CommandCtx, input: { fromYardId: string; toYardId: string; lines: Array<{ materialId: string; weight: string }>; unitIds?: string[] | null }) {
  const { tx } = ctx
  requireYard(ctx.session, input.fromYardId)
  if (input.fromYardId === input.toYardId) refuse('Choose another yard.')
  if (!input.lines?.length && !input.unitIds?.length) refuse('Add what is being sent.')
  const transfer = await tx.yardTransfer.create({ data: { fromYardId: input.fromYardId, toYardId: input.toYardId, status: 'in_transit', lines: [], sentAt: ctx.now, sentById: ctx.actorId } })
  const lines: any[] = []
  const byMaterial = new Map<string, Decimal>()
  for (const l of input.lines || []) byMaterial.set(l.materialId, (byMaterial.get(l.materialId) || new Decimal(0)).plus(positive(l.weight, 'Each weight')))
  for (const unitId of input.unitIds || []) {
    const unit = await tx.inventoryUnit.findUnique({ where: { id: unitId } })
    const won = await tx.inventoryUnit.updateMany({ where: { id: unitId, status: 'available', yardId: input.fromYardId }, data: { status: 'allocated', transferId: transfer.id } })
    if (!unit || won.count !== 1) refuse('A unit is no longer available to send.')
    byMaterial.set(unit.materialId, (byMaterial.get(unit.materialId) || new Decimal(0)).plus(String(unit.weight)))
  }
  for (const [materialId, weight] of byMaterial) {
    const m = await postMovement(tx, { yardId: input.fromYardId, materialId, kind: 'transfer_out', weightDelta: weight.negated(), transferId: transfer.id, referenceKey: `transfer:${transfer.id}:${materialId}:out`, actorId: ctx.actorId })
    lines.push({ materialId, weight: weight.toFixed(2), costCents: -m.costDeltaCents })
  }
  await tx.yardTransfer.update({ where: { id: transfer.id }, data: { lines } })
  await ctx.audit({ eventType: 'transfer.sent', aggregateType: 'YardTransfer', aggregateId: transfer.id, yardId: input.fromYardId, after: { lines } })
  return transfer
}

export async function receiveTransferTx(ctx: CommandCtx, input: { transferId: string; received: Array<{ materialId: string; weight: string }> }) {
  const { tx } = ctx
  const transfer = await lockRow(tx, 'YardTransfer', input.transferId)
  if (!transfer) refuse('Transfer not found.')
  requireYard(ctx.session, transfer.toYard)
  if (transfer.status !== 'in_transit') refuse('This transfer is not in transit.')
  const sent: any[] = Array.isArray(transfer.lines) ? transfer.lines : []
  const lines: any[] = []
  for (const line of sent) {
    const got = input.received?.find((r) => r.materialId === line.materialId)
    const weight = got ? dec(got.weight) : new Decimal(line.weight)
    if (weight.isNegative()) refuse('A received weight cannot be negative.')
    // Full cost moves with the material; a weight difference changes the average cost at the receiving yard.
    if (weight.gt(0)) await postMovement(tx, { yardId: transfer.toYard, materialId: line.materialId, kind: 'transfer_in', weightDelta: weight, costDeltaCents: line.costCents, transferId: transfer.id, referenceKey: `transfer:${transfer.id}:${line.materialId}:in`, actorId: ctx.actorId, reason: weight.equals(line.weight) ? '' : `Sent ${line.weight}, received ${weight.toFixed(2)}` })
    lines.push({ ...line, receivedWeight: weight.toFixed(2), differenceWeight: weight.minus(line.weight).toFixed(2) })
  }
  await tx.inventoryUnit.updateMany({ where: { transferId: transfer.id, status: 'allocated' }, data: { status: 'available', yardId: transfer.toYard } })
  await compareAndSet(tx, 'yardTransfer', transfer.id, 'in_transit', { status: 'received', receivedAt: ctx.now, receivedById: ctx.actorId, lines })
  await ctx.audit({ eventType: 'transfer.received', aggregateType: 'YardTransfer', aggregateId: transfer.id, yardId: transfer.toYard, after: { lines } })
  return tx.yardTransfer.findUnique({ where: { id: transfer.id } })
}

// --- Hold tags (§5.3). ---
async function lockTag(ctx: CommandCtx, id: string) {
  const tag = await lockRow(ctx.tx, 'HoldTag', id)
  if (!tag) refuse('Hold tag not found.')
  requireYard(ctx.session, tag.yard)
  return tag
}

export async function releaseHoldTagTx(ctx: CommandCtx, input: { holdTagId: string; reason: string; caseNumber?: string | null }) {
  const tag = await lockTag(ctx, input.holdTagId)
  const reason = String(input.reason || '').trim()
  if (reason.length < 3) refuse('Give a reason.')
  if (tag.status === 'held') {
    const ticket = await ctx.tx.scaleTicket.findUnique({ where: { id: tag.ticket }, include: { yard: { include: { rulesProfile: true } } } })
    if (!ticket?.yard?.rulesProfile?.allowEarlyRelease && new Date(tag.releaseAt) > ctx.now) refuse('The rules for this yard do not allow an early release.')
  } else if (tag.status === 'police_hold') {
    if (!input.caseNumber && !tag.caseNumber) refuse('Enter the case number from the agency.')
  } else refuse(`This hold is ${tag.status}.`)
  await compareAndSet(ctx.tx, 'holdTag', tag.id, ['held', 'police_hold'], { status: 'released', releasedAt: ctx.now, releasedById: ctx.actorId, releaseReason: reason, ...(input.caseNumber ? { caseNumber: input.caseNumber } : {}) })
  await postMovement(ctx.tx, { yardId: tag.yard, materialId: tag.material, kind: 'release', weightDelta: new Decimal(String(tag.weight)).negated(), bucket: 'held', referenceKey: `hold:${tag.id}:release`, ticketId: tag.ticket, actorId: ctx.actorId, reason })
  await refreshDuePayouts(ctx.tx, ctx.now, { ticketId: tag.ticket })
  await ctx.audit({ eventType: 'hold.released', aggregateType: 'HoldTag', aggregateId: tag.id, yardId: tag.yard, before: { status: tag.status }, reason })
  return ctx.tx.holdTag.findUnique({ where: { id: tag.id } })
}

export async function policeHoldTx(ctx: CommandCtx, input: { holdTagId?: string | null; ticketId?: string | null; agency: string; caseNumber?: string | null; reason: string }) {
  const reason = String(input.reason || '').trim()
  if (reason.length < 3 || !String(input.agency || '').trim()) refuse('Enter the agency and the reason.')
  let tags: any[] = []
  if (input.holdTagId) tags = [await lockTag(ctx, input.holdTagId)]
  else if (input.ticketId) {
    const ticket = await ctx.tx.scaleTicket.findUnique({ where: { id: input.ticketId }, include: { lines: true } })
    if (!ticket || !['completed', 'settled'].includes(ticket.status)) refuse('Only a completed ticket can be put on police hold.')
    requireYard(ctx.session, ticket.yardId)
    for (const line of ticket.lines) {
      let tag = await ctx.tx.holdTag.findFirst({ where: { lineId: line.id, status: { in: ['held', 'police_hold'] } } })
      if (!tag) {
        tag = await ctx.tx.holdTag.create({ data: { ticketId: ticket.id, lineId: line.id, yardId: ticket.yardId, materialId: line.materialId, weight: String(line.payWeight), kind: 'police', status: 'held' } })
        await postMovement(ctx.tx, { yardId: ticket.yardId, materialId: line.materialId, kind: 'hold', weightDelta: new Decimal(String(line.payWeight)), bucket: 'held', referenceKey: `hold:${tag.id}:place`, ticketId: ticket.id, ticketLineId: line.id, actorId: ctx.actorId, reason })
      }
      tags.push({ ...tag, yard: tag.yardId, ticket: tag.ticketId, material: tag.materialId })
    }
  } else refuse('Choose the hold tag or the ticket.')
  for (const tag of tags) {
    if (tag.status === 'police_hold') continue
    await compareAndSet(ctx.tx, 'holdTag', tag.id, 'held', { status: 'police_hold', kind: 'police', agency: input.agency, caseNumber: input.caseNumber || '', releaseAt: null })
  }
  const ticketId = tags[0]?.ticket || input.ticketId
  // Unpaid payouts on the ticket stay unpayable while the police hold lasts.
  if (ticketId) await ctx.tx.payout.updateMany({ where: { ticketId, status: 'ready' }, data: { status: 'held' } })
  await ctx.audit({ eventType: 'hold.police', aggregateType: 'ScaleTicket', aggregateId: ticketId, yardId: tags[0]?.yard, after: { tags: tags.map((t) => t.id), agency: input.agency, caseNumber: input.caseNumber }, reason })
  return { id: tags[0]?.id }
}

export async function seizeHoldTagTx(ctx: CommandCtx, input: { holdTagId: string; caseNumber: string; reason: string }) {
  const tag = await lockTag(ctx, input.holdTagId)
  if (tag.status !== 'police_hold') refuse('Only material on police hold can be seized.')
  if (!String(input.caseNumber || '').trim()) refuse('Enter the case number.')
  await compareAndSet(ctx.tx, 'holdTag', tag.id, 'police_hold', { status: 'seized', releasedAt: ctx.now, releasedById: ctx.actorId, releaseReason: input.reason || 'Seized', caseNumber: input.caseNumber })
  const weight = new Decimal(String(tag.weight))
  await postMovement(ctx.tx, { yardId: tag.yard, materialId: tag.material, kind: 'release', weightDelta: weight.negated(), bucket: 'held', referenceKey: `hold:${tag.id}:release`, ticketId: tag.ticket, actorId: ctx.actorId })
  await postMovement(ctx.tx, { yardId: tag.yard, materialId: tag.material, kind: 'adjust', weightDelta: weight.negated(), referenceKey: `hold:${tag.id}:seized`, ticketId: tag.ticket, actorId: ctx.actorId, reason: `Seized, case ${input.caseNumber}` })
  await ctx.audit({ eventType: 'hold.seized', aggregateType: 'HoldTag', aggregateId: tag.id, yardId: tag.yard, after: { caseNumber: input.caseNumber, weight: weight.toFixed(2) }, reason: input.reason })
  return ctx.tx.holdTag.findUnique({ where: { id: tag.id } })
}

// ---------------------------------------------------------------------------------------------

export const inventoryTypeDefs = `
  input RunLineInput { materialId: ID!, weight: String!, unitIds: [ID!], makeUnit: Boolean, form: String }
  input WeightLineInput { materialId: ID!, weight: String! }
  type InventoryResult { id: ID }
`
export const inventoryMutationDefs = `
  regradeInventory(yardId: ID!, fromMaterialId: ID!, toMaterialId: ID!, weight: String!, reason: String, idempotencyKey: String!): InventoryResult
  adjustInventory(yardId: ID!, materialId: ID!, weightDelta: String!, reason: String!, idempotencyKey: String!): InventoryResult
  reviewInventoryMovement(movementId: ID!): InventoryResult
  createInventoryUnit(yardId: ID!, materialId: ID!, weight: String!, form: String, location: String, tagNumber: String, idempotencyKey: String): InventoryUnit
  postProcessingRun(yardId: ID!, kind: String!, inputs: [RunLineInput!]!, outputs: [RunLineInput!]!, processingCostCents: Int, notes: String, idempotencyKey: String): ProcessingRun
  sendYardTransfer(fromYardId: ID!, toYardId: ID!, lines: [WeightLineInput!], unitIds: [ID!], idempotencyKey: String): YardTransfer
  receiveYardTransfer(transferId: ID!, received: [WeightLineInput!], idempotencyKey: String): YardTransfer
  releaseHoldTag(holdTagId: ID!, reason: String!, caseNumber: String, idempotencyKey: String): HoldTag
  placePoliceHold(holdTagId: ID, ticketId: ID, agency: String!, caseNumber: String, reason: String!, idempotencyKey: String): InventoryResult
  seizeHoldTag(holdTagId: ID!, caseNumber: String!, reason: String!, idempotencyKey: String): HoldTag
`
export const inventoryQueryDefs = `
  releaseDueHolds(yardId: ID): Int
`

const INV = 'canManageInventory' as const
const COMP = 'canManageCompliance' as const
export const inventoryResolvers = {
  Mutation: {
    regradeInventory: (_: unknown, a: any, c: any) => runCommand(c, { name: 'regradeInventory', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: [INV, 'canGradeTickets'] }, (ctx) => regradeTx(ctx, a, String(cleanKey(a.idempotencyKey)))),
    adjustInventory: (_: unknown, a: any, c: any) => runCommand(c, { name: 'adjustInventory', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: [INV] }, (ctx) => adjustInventoryTx(ctx, a, String(cleanKey(a.idempotencyKey)))),
    reviewInventoryMovement: (_: unknown, a: any, c: any) => runCommand(c, { name: 'reviewInventoryMovement', input: a, permission: ['canApproveVariances'] }, (ctx) => reviewMovementTx(ctx, a)),
    createInventoryUnit: (_: unknown, a: any, c: any) => runCommand(c, { name: 'createInventoryUnit', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: [INV] }, (ctx) => createUnitTx(ctx, a)).then((r: any) => c.db.InventoryUnit.findOne({ where: { id: r.id } })),
    postProcessingRun: (_: unknown, a: any, c: any) => runCommand(c, { name: 'postProcessingRun', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: [INV] }, (ctx) => postProcessingRunTx(ctx, a)).then((r: any) => c.db.ProcessingRun.findOne({ where: { id: r.id } })),
    sendYardTransfer: (_: unknown, a: any, c: any) => runCommand(c, { name: 'sendYardTransfer', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: [INV] }, (ctx) => sendTransferTx(ctx, a)).then((r: any) => c.db.YardTransfer.findOne({ where: { id: r.id } })),
    receiveYardTransfer: (_: unknown, a: any, c: any) => runCommand(c, { name: 'receiveYardTransfer', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: [INV, 'canManageTickets'] }, (ctx) => receiveTransferTx(ctx, a)).then((r: any) => c.db.YardTransfer.findOne({ where: { id: r.id } })),
    releaseHoldTag: (_: unknown, a: any, c: any) => runCommand(c, { name: 'releaseHoldTag', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: [COMP] }, (ctx) => releaseHoldTagTx(ctx, a)).then((r: any) => c.db.HoldTag.findOne({ where: { id: r.id } })),
    placePoliceHold: (_: unknown, a: any, c: any) => runCommand(c, { name: 'placePoliceHold', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: [COMP] }, (ctx) => policeHoldTx(ctx, a)),
    seizeHoldTag: (_: unknown, a: any, c: any) => runCommand(c, { name: 'seizeHoldTag', input: a, idempotencyKey: cleanKey(a.idempotencyKey), permission: [COMP] }, (ctx) => seizeHoldTagTx(ctx, a)).then((r: any) => c.db.HoldTag.findOne({ where: { id: r.id } })),
  },
  Query: {
    releaseDueHolds: async (_: unknown, a: any, c: any) => {
      if (!hasFlag(c.session, 'canAccessDashboard')) return 0
      const prisma = c.sudo().prisma
      const count = await prisma.$transaction((tx: any) => releaseDueHoldTags(tx, new Date(), a.yardId ? { yardId: a.yardId } : {}))
      return count
    },
  },
}
