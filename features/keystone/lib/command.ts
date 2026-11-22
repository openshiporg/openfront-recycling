import { createHash, randomUUID } from 'node:crypto'
import { GraphQLError } from 'graphql'
import { canActOnYard, hasFlag, isStaff, type RoleFlag, type Session } from '../access'

/**
 * The command runner every status-changing mutation goes through (dissertation §5, §5.13).
 * Adapted from Barbershop's commandReceipt + serializableTransaction:
 *
 * - permission check before anything runs;
 * - one database transaction for every effect;
 * - `idempotencyKey` through CommandReceipt: an advisory lock on the key, then the same key with the
 *   same input returns the first result, and the same key with different input is refused;
 * - audit events written in the same transaction;
 * - outside calls (Stripe) run only after commit, through `afterCommit`.
 */

export class CommandError extends GraphQLError {
  constructor(message: string, code = 'COMMAND_REFUSED', extra: Record<string, unknown> = {}) {
    super(message, { extensions: { code, ...extra } })
  }
}

export function refuse(message: string, extra: Record<string, unknown> = {}): never {
  throw new CommandError(message, 'COMMAND_REFUSED', extra)
}

export type Tx = any

export type CommandCtx = {
  tx: Tx
  session: Session | null
  actorId: string | null
  now: Date
  audit(event: AuditInput): Promise<void>
  afterCommit(fn: () => Promise<unknown>): void
  sequence(scopeKey: string, kind: string, yardId?: string | null): Promise<number>
}

export type AuditInput = {
  eventType: string
  aggregateType: string
  aggregateId: string
  yardId?: string | null
  before?: unknown
  after?: unknown
  reason?: string | null
  key?: string
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonicalize(child)])
    )
  }
  return value
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value))
}

export function hashInput(value: unknown) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

export function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)))
}

export type CommandOptions<I> = {
  name: string
  input: I
  idempotencyKey?: string | null
  /** Staff permission(s): any one is enough. Omit for customer commands that prove ownership themselves. */
  permission?: RoleFlag | RoleFlag[]
  /** Customer commands: a signed-in user is needed. */
  requireSignIn?: boolean
  aggregateType?: string
}

/** Next number for (scopeKey, kind): one atomic upsert, inside the caller's transaction. */
export async function nextSequence(tx: Tx, scopeKey: string, kind: string, yardId?: string | null): Promise<number> {
  const rows: Array<{ value: number }> = await tx.$queryRawUnsafe(
    `INSERT INTO "Sequence" ("id", "yard", "scopeKey", "kind", "next", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 2, NOW(), NOW())
     ON CONFLICT ("scopeKey", "kind") DO UPDATE SET "next" = "Sequence"."next" + 1, "updatedAt" = NOW()
     RETURNING "next" - 1 AS value`,
    randomUUID(),
    yardId || null,
    scopeKey,
    kind
  )
  return Number(rows[0].value)
}

export function requirePermission(session: Session | null, permission?: RoleFlag | RoleFlag[]) {
  if (!permission) return
  const list = Array.isArray(permission) ? permission : [permission]
  if (!isStaff(session) || !list.some((flag) => hasFlag(session, flag))) {
    throw new CommandError('You do not have permission to do this.', 'FORBIDDEN')
  }
}

export function requireYard(session: Session | null, yardId: string | null | undefined) {
  if (!canActOnYard(session, yardId)) throw new CommandError('You do not work at this yard.', 'FORBIDDEN')
}

function isRetryable(error: unknown) {
  const code = (error as any)?.code
  return code === 'P2034' || code === '40001' || code === '40P01' || /could not serialize|deadlock detected/i.test(String((error as any)?.message || ''))
}

export async function runCommand<I, R>(context: any, options: CommandOptions<I>, body: (ctx: CommandCtx) => Promise<R>): Promise<R> {
  const session: Session | null = context.session || null
  requirePermission(session, options.permission)
  if (options.requireSignIn && !session?.itemId) throw new CommandError('Sign in first.', 'UNAUTHENTICATED')

  const actorId = session?.itemId || null
  const key = options.idempotencyKey ? `${options.name}:${actorId || 'public'}:${options.idempotencyKey}` : null
  const payloadHash = hashInput({ name: options.name, input: options.input })
  const prisma = context.sudo().prisma

  for (let attempt = 1; ; attempt += 1) {
    const after: Array<() => Promise<unknown>> = []
    try {
      const result = await prisma.$transaction(async (tx: Tx) => {
        if (key) {
          await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'recycling-command', key)
          const existing = await tx.commandReceipt.findUnique({ where: { eventKey: key } })
          if (existing) {
            if (existing.payloadHash !== payloadHash || existing.eventType !== options.name) {
              throw new CommandError('This idempotency key was already used with different input.', 'IDEMPOTENCY_CONFLICT')
            }
            return { replay: true, value: existing.result as R }
          }
        }
        const now = new Date()
        let auditIndex = 0
        const ctx: CommandCtx = {
          tx,
          session,
          actorId,
          now,
          afterCommit: (fn) => after.push(fn),
          sequence: (scopeKey, kind, yardId) => nextSequence(tx, scopeKey, kind, yardId),
          audit: async (event) => {
            auditIndex += 1
            await tx.auditEvent.create({
              data: {
                eventKey: event.key || `${options.name}:${event.aggregateId}:${key || randomUUID()}:${auditIndex}`,
                eventType: event.eventType,
                aggregateType: event.aggregateType,
                aggregateId: event.aggregateId,
                yardId: event.yardId || null,
                actorId,
                before: event.before === undefined ? undefined : jsonSafe(event.before as any),
                after: event.after === undefined ? undefined : jsonSafe(event.after as any),
                reason: event.reason || '',
                occurredAt: now,
              },
            })
          },
        }
        const value = await body(ctx)
        if (key) {
          await tx.commandReceipt.create({
            data: {
              eventKey: key,
              eventType: options.name,
              aggregateType: options.aggregateType || '',
              aggregateId: String((value as any)?.id || ''),
              payloadHash,
              result: jsonSafe(value as any) ?? null,
              actorId: actorId || '',
              occurredAt: now,
            },
          })
        }
        return { replay: false, value }
      }, { maxWait: 10_000, timeout: 30_000 })
      if (!result.replay) {
        for (const fn of after) {
          try { await fn() } catch (error) { console.error(`[${options.name}] after-commit step failed`, error) }
        }
      }
      return result.value
    } catch (error) {
      if (attempt < 5 && isRetryable(error)) {
        await new Promise((resolve) => setTimeout(resolve, 10 * attempt + Math.floor(Math.random() * 20)))
        continue
      }
      throw error
    }
  }
}

/** Compare-and-set: UPDATE ... WHERE id AND status IN (...). Zero rows means another command won. */
export async function compareAndSet(tx: Tx, model: string, id: string, expected: string | string[], data: Record<string, unknown>, message?: string) {
  const statuses = Array.isArray(expected) ? expected : [expected]
  const result = await tx[model].updateMany({ where: { id, status: { in: statuses } }, data })
  if (result.count !== 1) refuse(message || `This ${model} is no longer ${statuses.join(' or ')}.`)
}

/** SELECT ... FOR UPDATE on one row of a table. */
export async function lockRow(tx: Tx, table: string, id: string) {
  const rows: any[] = await tx.$queryRawUnsafe(`SELECT * FROM "${table}" WHERE "id" = $1 FOR UPDATE`, id)
  return rows[0] || null
}

export function cleanKey(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (text.length > 200) refuse('The idempotency key is too long.')
  return text
}
