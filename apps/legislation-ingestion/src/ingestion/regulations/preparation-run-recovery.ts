import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { legalDiscoveryRunStatusSchema as triggerRunStatusSchema } from "./discovery-recovery.js"
import { legalPassagePreparationIdentity, legalPreparationScopeSchema } from "./passage-preparation.js"
import { submitLegalPreparation } from "./preparation-dispatch.js"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
export const preparationRunRecoverySchema = z.strictObject({
  waveId: z.uuid(),
  afterDispatchId: hash.nullable().default(null),
  limit: z.int().min(1).max(10).default(10)
})
type RunStatus = z.infer<typeof triggerRunStatusSchema>
type Inspect = (runId: string) => Promise<{ status: RunStatus }>
type Submit = Parameters<typeof submitLegalPreparation>[2]
const failedStatuses = new Set<RunStatus>(["CANCELED", "CRASHED", "EXPIRED", "FAILED", "SYSTEM_FAILURE", "TIMED_OUT"])
const activeStatuses = new Set<RunStatus>(["DELAYED", "DEQUEUED", "EXECUTING", "PENDING_VERSION", "QUEUED", "WAITING"])
const payloadSchema = z.strictObject({
  scope: legalPreparationScopeSchema,
  model: z.enum(["openai/text-embedding-3-small", "voyageai/voyage-4"]),
  limit: z.int().min(1).max(25),
  retryBlocked: z.boolean()
})
const candidateSchema = z.object({
  id: hash,
  preparation_id: hash,
  run_id: z.string().nullable(),
  payload: payloadSchema,
  uncertain_expired: z.boolean(),
  missing_expired: z.boolean()
})
const lockedSchema = z.object({
  state: z.enum(["pending", "submitting", "submitted"]),
  run_id: z.string().nullable(),
  attempt: z.int().nonnegative(),
  preparation_state: z.enum(["pending", "prepared", "blocked"]).nullable()
})

async function reconcileDisposition(
  pool: pg.Pool,
  dispatchId: string,
  preparationId: string,
  expectedRunId: string | null,
  status: RunStatus,
  replaceEligible: boolean
) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='30s'")
    const selected = await client.query(
      `SELECT d.state,d.run_id,d.attempt,
       (SELECT p.state FROM legislation.legal_passage_preparations p WHERE p.id=$2) preparation_state
       FROM legislation.legal_preparation_dispatches d WHERE d.id=$1 FOR UPDATE OF d`,
      [dispatchId, preparationId]
    )
    invariant(selected.rowCount === 1, "legal_preparation_dispatch_missing")
    const row = lockedSchema.parse(selected.rows[0])
    invariant(row.run_id === expectedRunId, "legal_preparation_dispatch_run_changed")
    if (row.preparation_state === "prepared" || row.preparation_state === "blocked") {
      await client.query(
        `UPDATE legislation.legal_preparation_dispatches
         SET completed_at=COALESCE(completed_at,clock_timestamp()),last_observed_status=$2,
           last_observed_at=clock_timestamp(),last_error=$3 WHERE id=$1`,
        [dispatchId, status, row.preparation_state === "blocked" ? "source_records_blocked" : null]
      )
      await client.query("COMMIT")
      return { disposition: row.preparation_state, replacement: false }
    }
    if (status === "COMPLETED") {
      await client.query(
        `UPDATE legislation.legal_preparation_dispatches
         SET last_observed_status=$2,last_observed_at=clock_timestamp(),last_error='completed_without_preparation'
         WHERE id=$1`,
        [dispatchId, status]
      )
      await client.query("COMMIT")
      return { disposition: "state_mismatch", replacement: false }
    }
    if (activeStatuses.has(status) || !replaceEligible) {
      await client.query(
        `UPDATE legislation.legal_preparation_dispatches
         SET last_observed_status=$2,last_observed_at=clock_timestamp() WHERE id=$1`,
        [dispatchId, status]
      )
      await client.query("COMMIT")
      return { disposition: "retained", replacement: false }
    }
    invariant(failedStatuses.has(status) || status === "MISSING", "legal_preparation_run_status_unhandled")
    await client.query(
      `UPDATE legislation.legal_preparation_dispatches
       SET state='pending',attempt=attempt+1,first_attempt_at=NULL,run_id=NULL,
         lease_token=NULL,lease_expires_at=NULL,last_observed_status=$2,last_observed_at=clock_timestamp(),
         last_error=NULL,run_history=run_history || jsonb_build_array(jsonb_build_object(
           'attempt',attempt,'runId',run_id,'status',$2::text,'observedAt',clock_timestamp()))
       WHERE id=$1`,
      [dispatchId, status]
    )
    await client.query("COMMIT")
    return { disposition: "replacement_ready", replacement: true }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

/** Reconciles one bounded wave page and replaces only terminal or retention-expired preparation runs. */
export async function recoverLegalPreparationRunPage(pool: pg.Pool, value: unknown, inspect: Inspect, submit: Submit) {
  const input = preparationRunRecoverySchema.parse(value)
  const selected = await pool.query(
    `SELECT id,preparation_id,run_id,payload,
       COALESCE(first_attempt_at<=clock_timestamp()-interval '6 days',false) uncertain_expired,
       COALESCE(first_attempt_at<=clock_timestamp()-interval '7 days',false) missing_expired
     FROM legislation.legal_preparation_dispatches
     WHERE wave_id=$1 AND completed_at IS NULL AND id>COALESCE($2,'')
       AND state IN ('submitting','submitted') ORDER BY id LIMIT $3`,
    [input.waveId, input.afterDispatchId, input.limit]
  )
  const results = []
  for (const value of selected.rows) {
    const candidate = candidateSchema.parse(value)
    const { id: preparationId } = await legalPassagePreparationIdentity(
      candidate.payload.scope,
      candidate.payload.model
    )
    invariant(preparationId === candidate.preparation_id, "legal_preparation_dispatch_identity_changed")
    const status =
      candidate.run_id === null ? "MISSING" : triggerRunStatusSchema.parse((await inspect(candidate.run_id)).status)
    const replaceEligible =
      failedStatuses.has(status) ||
      (status === "MISSING" && (candidate.run_id === null ? candidate.uncertain_expired : candidate.missing_expired))
    const reconciled = await reconcileDisposition(
      pool,
      candidate.id,
      preparationId,
      candidate.run_id,
      status,
      replaceEligible
    )
    const replacement = reconciled.replacement
      ? await submitLegalPreparation(pool, { waveId: input.waveId, ...candidate.payload }, submit)
      : false
    results.push({ dispatchId: candidate.id, preparationId, status, ...reconciled, replacement })
  }
  return {
    waveId: input.waveId,
    inspected: results.length,
    afterDispatchId: selected.rows.at(-1)?.id ?? input.afterDispatchId,
    exhausted: selected.rows.length < input.limit,
    results
  }
}
