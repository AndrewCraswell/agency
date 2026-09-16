import { and, eq, sql } from "drizzle-orm"
import { z } from "zod"
import type { LegislationDatabase } from "../database.js"
import { syncCheckpoints } from "../schema/schema.js"

export type BillBatchOwnership = { source: string; stream: string; token: string }
const identity = z.object({
  source: z.string().min(1),
  stream: z.string().startsWith("ownership:"),
  token: z.string().min(1)
})
type Transaction = Omit<LegislationDatabase, "$client">
const condition = (owner: BillBatchOwnership) =>
  and(eq(syncCheckpoints.source, owner.source), eq(syncCheckpoints.stream, owner.stream))

/** Database time owns the deadline; retrying a token never extends its lifetime. */
export async function claimBillBatchOwnership(
  database: LegislationDatabase,
  owner: BillBatchOwnership,
  durationSeconds: number,
  options: {
    requireConfirmedRelease?: boolean
    executor?: { host: string; pid: number; runtimeId?: string }
    group?: { stream: string; cohort: string }
  } = {}
) {
  identity.parse(owner)
  if (options.group) {
    z.object({ stream: z.string().startsWith("ownership:"), cohort: z.string().regex(/^[a-f0-9]{64}$/) }).parse(
      options.group
    )
    if (!owner.stream.startsWith(`${options.group.stream}:${options.group.cohort}:`)) {
      throw new Error("Batch ownership does not belong to its admission group")
    }
  }
  z.number().int().min(1).max(1800).parse(durationSeconds)
  if (options.executor) {
    z.object({
      host: z.string().min(1),
      pid: z.number().int().positive(),
      runtimeId: z.string().min(1).optional()
    }).parse(options.executor)
  }
  return database.transaction(async (transaction) => {
    await transaction.execute(sql`select set_config('lock_timeout', '10000', true)`)
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([owner.source, options.group?.stream ?? owner.stream])}, 0))`
    )
    if (options.group) {
      const group = options.group
      const [blocked] = await transaction
        .select({ stream: syncCheckpoints.stream })
        .from(syncCheckpoints)
        .where(
          and(
            eq(syncCheckpoints.source, owner.source),
            sql`(${syncCheckpoints.stream} = ${group.stream} OR starts_with(${syncCheckpoints.stream}, ${group.stream + ":"}))`,
            sql`NOT starts_with(${syncCheckpoints.stream}, ${group.stream + ":" + group.cohort + ":"})`,
            sql`coalesce(${syncCheckpoints.cursor}->>'released', 'false') <> 'true'`
          )
        )
        .limit(1)
      if (blocked) {
        throw new Error("Another inventory or session hold blocks batch admission")
      }
    } else {
      const [child] = await transaction
        .select({ stream: syncCheckpoints.stream })
        .from(syncCheckpoints)
        .where(
          and(
            eq(syncCheckpoints.source, owner.source),
            sql`starts_with(${syncCheckpoints.stream}, ${owner.stream + ":"})`,
            sql`coalesce(${syncCheckpoints.cursor}->>'released', 'false') <> 'true'`
          )
        )
        .limit(1)
      if (child) {
        throw new Error("Batch holds block session-wide ownership")
      }
    }
    const [previous] = await transaction
      .select({
        token: sql<string>`${syncCheckpoints.cursor}->>'token'`,
        requiresConfirmation: sql<boolean>`coalesce(${syncCheckpoints.cursor}->>'requiresConfirmedRelease', 'false') = 'true' AND coalesce(${syncCheckpoints.cursor}->>'released', 'false') <> 'true'`,
        active: sql<boolean>`(${syncCheckpoints.cursor}->>'expiresAt')::timestamptz > clock_timestamp()`
      })
      .from(syncCheckpoints)
      .where(condition(owner))
      .for("update")
    if (previous?.token === owner.token) {
      if (!previous.active) {
        throw new Error("Expired ownership token cannot be renewed")
      }
      return false
    }
    if (previous?.active) {
      throw new Error("Bill batch already has an active owner")
    }
    if (previous?.requiresConfirmation) {
      throw new Error("Previous bill batch requires runtime shutdown confirmation before takeover")
    }
    const cursor = sql`jsonb_build_object('token', ${owner.token}::text, 'expiresAt', clock_timestamp() + make_interval(secs => ${durationSeconds}::int), 'requiresConfirmedRelease', ${options.requireConfirmedRelease === true}::boolean, 'released', false, 'executor', ${JSON.stringify(options.executor ?? null)}::jsonb)`
    await transaction
      .insert(syncCheckpoints)
      .values({ source: owner.source, stream: owner.stream, cursor })
      .onConflictDoUpdate({
        target: [syncCheckpoints.source, syncCheckpoints.stream],
        set: { cursor, updatedAt: sql`clock_timestamp()` }
      })
    return true
  })
}

/** Hold the row lock through commit so takeover cannot race with canonical writes. */
export async function assertBillBatchOwnership(transaction: Transaction, owner: BillBatchOwnership) {
  identity.parse(owner)
  const [record] = await transaction
    .select({
      valid: sql<boolean>`${syncCheckpoints.cursor}->>'token' = ${owner.token} AND (${syncCheckpoints.cursor}->>'expiresAt')::timestamptz > clock_timestamp()`
    })
    .from(syncCheckpoints)
    .where(condition(owner))
    .for("update")
  if (!record?.valid) {
    throw new Error("Bill batch ownership is missing, expired or superseded")
  }
}

/** Call only after the worker has stopped. Expire rather than delete so the same token cannot be renewed. */
export async function releaseBillBatchOwnership(database: LegislationDatabase, owner: BillBatchOwnership) {
  identity.parse(owner)
  return database.transaction(async (transaction) => {
    await transaction.execute(sql`select set_config('lock_timeout', '10000', true)`)
    const released = await transaction
      .update(syncCheckpoints)
      .set({
        cursor: sql`jsonb_set(${syncCheckpoints.cursor}, '{expiresAt}', to_jsonb(clock_timestamp())) || jsonb_build_object('released', true, 'releasedAt', clock_timestamp())`,
        updatedAt: sql`clock_timestamp()`
      })
      .where(and(condition(owner), sql`${syncCheckpoints.cursor}->>'token' = ${owner.token}`))
      .returning({ stream: syncCheckpoints.stream })
    return released.length === 1
  })
}
