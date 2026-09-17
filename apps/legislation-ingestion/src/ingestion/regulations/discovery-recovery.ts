import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { legalDiscoveryStageSchema, submitLegalDiscoveryDispatch } from "./discovery-dispatch.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const sourceSchema = z.enum(["ecfr", "govinfo-fr", "govinfo-cfr"])
export const legalDiscoveryRunStatusSchema = z.enum([
  "CANCELED",
  "COMPLETED",
  "CRASHED",
  "DELAYED",
  "DEQUEUED",
  "EXECUTING",
  "EXPIRED",
  "FAILED",
  "MISSING",
  "PENDING_VERSION",
  "QUEUED",
  "SYSTEM_FAILURE",
  "TIMED_OUT",
  "WAITING"
])
export const legalDiscoveryRecoverySchema = z.strictObject({
  sourceId: sourceSchema,
  scopeKey: hashSchema,
  afterDispatchId: hashSchema.nullable().default(null),
  limit: z.int().min(1).max(25).default(10)
})

type RunStatus = z.infer<typeof legalDiscoveryRunStatusSchema>
type Inspect = (runId: string) => Promise<{ status: RunStatus }>
type Submit = Parameters<typeof submitLegalDiscoveryDispatch>[2]
const failedStatuses = new Set<RunStatus>(["CANCELED", "CRASHED", "EXPIRED", "FAILED", "SYSTEM_FAILURE", "TIMED_OUT"])
const activeStatuses = new Set<RunStatus>(["DELAYED", "DEQUEUED", "EXECUTING", "PENDING_VERSION", "QUEUED", "WAITING"])
const candidateSchema = z.object({
  id: hashSchema,
  state: z.enum(["submitting", "submitted"]),
  run_id: z.string().nullable(),
  uncertain_expired: z.boolean(),
  missing_expired: z.boolean()
})
const unitStateSchema = z.enum(["pending", "registered", "acquired", "parsed", "published", "quarantined"])
const lockedSchema = z.object({
  stage: legalDiscoveryStageSchema,
  state: z.enum(["pending", "submitting", "submitted"]),
  run_id: z.string().nullable(),
  attempt: z.int().nonnegative(),
  unit_state: unitStateSchema
})

function stageAdvanced(stage: z.infer<typeof legalDiscoveryStageSchema>, state: z.infer<typeof unitStateSchema>) {
  if (stage === "acquisition") return ["acquired", "parsed", "published"].includes(state)
  if (stage === "parsing") return ["parsed", "published"].includes(state)
  return state === "published"
}

async function reconcileDisposition(
  pool: pg.Pool,
  dispatchId: string,
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
      `SELECT d.stage,d.state,d.run_id,d.attempt,u.state unit_state
       FROM legislation.legal_discovery_dispatches d
       JOIN legislation.legal_discovery_units u
         ON u.source_id=d.source_id AND u.scope_key=d.scope_key AND u.unit_key=d.unit_key
       WHERE d.id=$1 FOR UPDATE OF d,u`,
      [dispatchId]
    )
    invariant(selected.rowCount === 1, "legal_discovery_dispatch_missing")
    const row = lockedSchema.parse(selected.rows[0])
    invariant(row.run_id === expectedRunId, "legal_discovery_dispatch_run_changed")
    if (stageAdvanced(row.stage, row.unit_state) || row.unit_state === "quarantined") {
      await client.query(
        `UPDATE legislation.legal_discovery_dispatches
         SET completed_at=COALESCE(completed_at,clock_timestamp()),last_observed_status=$2,
           last_observed_at=clock_timestamp(),last_error=NULL
         WHERE id=$1`,
        [dispatchId, status]
      )
      await client.query("COMMIT")
      return {
        disposition: row.unit_state === "quarantined" ? "quarantined" : "completed",
        replacement: false
      }
    }
    if (status === "COMPLETED") {
      await client.query(
        `UPDATE legislation.legal_discovery_dispatches
         SET last_observed_status=$2,last_observed_at=clock_timestamp(),last_error='completed_without_stage_advance'
         WHERE id=$1`,
        [dispatchId, status]
      )
      await client.query("COMMIT")
      return { disposition: "state_mismatch", replacement: false }
    }
    if (activeStatuses.has(status) || !replaceEligible) {
      await client.query(
        `UPDATE legislation.legal_discovery_dispatches
         SET last_observed_status=$2,last_observed_at=clock_timestamp() WHERE id=$1`,
        [dispatchId, status]
      )
      await client.query("COMMIT")
      return { disposition: "retained", replacement: false }
    }
    invariant(failedStatuses.has(status) || status === "MISSING", "legal_discovery_run_status_unhandled")
    await client.query(
      `UPDATE legislation.legal_discovery_dispatches
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

/** Reconciles a bounded page of remote run dispositions and replaces only terminal or retention-expired work. */
export async function recoverLegalDiscoveryDispatchPage(
  pool: pg.Pool,
  value: unknown,
  inspect: Inspect,
  submit: Submit
) {
  const input = legalDiscoveryRecoverySchema.parse(value)
  const selected = await pool.query(
    `SELECT id,state,run_id,
       COALESCE(first_attempt_at<=clock_timestamp()-interval '6 days',false) uncertain_expired,
       COALESCE(first_attempt_at<=clock_timestamp()-interval '7 days',false) missing_expired
     FROM legislation.legal_discovery_dispatches
     WHERE source_id=$1 AND scope_key=$2 AND completed_at IS NULL AND id>COALESCE($3,'')
       AND state IN ('submitting','submitted') ORDER BY id LIMIT $4`,
    [input.sourceId, input.scopeKey, input.afterDispatchId, input.limit]
  )
  const results = []
  for (const value of selected.rows) {
    const candidate = candidateSchema.parse(value)
    const status =
      candidate.run_id === null
        ? "MISSING"
        : legalDiscoveryRunStatusSchema.parse((await inspect(candidate.run_id)).status)
    const replaceEligible =
      failedStatuses.has(status) ||
      (status === "MISSING" && (candidate.run_id === null ? candidate.uncertain_expired : candidate.missing_expired))
    const reconciled = await reconcileDisposition(pool, candidate.id, candidate.run_id, status, replaceEligible)
    const replacement = reconciled.replacement ? await submitLegalDiscoveryDispatch(pool, candidate.id, submit) : false
    results.push({ dispatchId: candidate.id, status, ...reconciled, replacement })
  }
  return {
    inspected: results.length,
    afterDispatchId: selected.rows.at(-1)?.id ?? input.afterDispatchId,
    exhausted: selected.rows.length < input.limit,
    results
  }
}
