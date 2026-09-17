import { digest } from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { legalDiscoveryDispatchPlanSchema } from "./discovery-dispatch.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const legalDiscoveryStartRequestSchema = z.strictObject({
  environment: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{0,63}$/),
  sourceId: z.enum(["ecfr", "govinfo-fr", "govinfo-cfr"]),
  scopeKey: hashSchema,
  limit: z.int().min(1).max(100).default(25)
})

const checkpointSchema = z.object({
  source_id: z.enum(["ecfr", "govinfo-fr", "govinfo-cfr"]),
  scope_key: hashSchema,
  query_hash: hashSchema,
  revision: z.coerce.number().int().nonnegative(),
  committed_cursor: z.json().nullable(),
  source_cutoff: z.json().nullable(),
  last_success_at: z.date().nullable()
})
const countsSchema = z.object({
  total: z.int().nonnegative(),
  pending: z.int().nonnegative(),
  registered: z.int().nonnegative(),
  acquired: z.int().nonnegative(),
  parsed: z.int().nonnegative(),
  published: z.int().nonnegative(),
  quarantined: z.int().nonnegative(),
  manifested: z.int().nonnegative()
})
const dispatchSchema = z.object({
  registered: z.int().nonnegative(),
  completed: z.int().nonnegative(),
  active: z.int().nonnegative(),
  uncertain: z.int().nonnegative()
})

/** Builds a stable, read-only operator plan for one already discovered source scope. */
export async function inspectLegalDiscoveryStart(pool: pg.Pool, value: unknown) {
  const input = legalDiscoveryStartRequestSchema.parse(value)
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='15s'")
    invariant(
      (await client.query("SELECT current_database() AS name")).rows[0]?.name !== "legislation_passage_search",
      "legal_discovery_start_wrong_database"
    )
    const checkpointResult = await client.query(
      `SELECT source_id,scope_key,query_hash,revision,committed_cursor,source_cutoff,last_success_at
       FROM legislation.legal_discovery_checkpoints WHERE source_id=$1 AND scope_key=$2`,
      [input.sourceId, input.scopeKey]
    )
    invariant(checkpointResult.rowCount === 1, "legal_discovery_start_scope_missing")
    const checkpoint = checkpointSchema.parse(checkpointResult.rows[0])
    const units = countsSchema.parse(
      (
        await client.query(
          `SELECT count(*)::integer total,
           count(*) FILTER (WHERE state='pending')::integer pending,
           count(*) FILTER (WHERE state='registered')::integer registered,
           count(*) FILTER (WHERE state='acquired')::integer acquired,
           count(*) FILTER (WHERE state='parsed')::integer parsed,
           count(*) FILTER (WHERE state='published')::integer published,
           count(*) FILTER (WHERE state='quarantined')::integer quarantined,
           count(*) FILTER (WHERE manifest_id IS NOT NULL)::integer manifested
           FROM legislation.legal_discovery_units WHERE source_id=$1 AND scope_key=$2`,
          [input.sourceId, input.scopeKey]
        )
      ).rows[0]
    )
    const dispatch = dispatchSchema.parse(
      (
        await client.query(
          `SELECT count(*)::integer registered,
           count(*) FILTER (WHERE completed_at IS NOT NULL)::integer completed,
           count(*) FILTER (WHERE lease_token IS NOT NULL AND lease_expires_at>transaction_timestamp())::integer active,
           count(*) FILTER (WHERE last_error='submission_uncertain')::integer uncertain
           FROM legislation.legal_discovery_dispatches WHERE source_id=$1 AND scope_key=$2`,
          [input.sourceId, input.scopeKey]
        )
      ).rows[0]
    )
    const payload = legalDiscoveryDispatchPlanSchema.parse({
      sourceId: input.sourceId,
      scopeKey: input.scopeKey,
      afterUnitKey: null,
      limit: input.limit
    })
    const runnable = units.pending + units.registered + units.acquired + units.parsed
    const planId = digest(
      JSON.stringify([
        "legal-discovery-start-2026-09-17",
        input.environment,
        payload,
        {
          queryHash: checkpoint.query_hash,
          revision: checkpoint.revision,
          committedCursor: checkpoint.committed_cursor,
          sourceCutoff: checkpoint.source_cutoff,
          lastSuccessAt: checkpoint.last_success_at?.toISOString() ?? null
        },
        units,
        dispatch
      ])
    )
    await client.query("COMMIT")
    return {
      planId,
      environment: input.environment,
      payload,
      checkpoint: {
        queryHash: checkpoint.query_hash,
        revision: checkpoint.revision,
        committedCursor: checkpoint.committed_cursor,
        sourceCutoff: checkpoint.source_cutoff,
        lastSuccessAt: checkpoint.last_success_at?.toISOString() ?? null
      },
      units: { ...units, runnable },
      dispatch,
      canApply: checkpoint.last_success_at !== null && runnable > 0,
      canonicalWrites: false as const,
      dispatched: false as const
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
