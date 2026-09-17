import { randomUUID } from "node:crypto"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const sourceSchema = z.enum(["ecfr", "govinfo-fr", "govinfo-cfr"])
export const legalDiscoveryStageSchema = z.enum(["acquisition", "parsing", "publication"])
const taskByStage = {
  acquisition: "regulatory-discovery-acquisition",
  parsing: "regulatory-discovery-parsing",
  publication: "regulatory-discovery-publication"
} as const
export function legalDiscoveryTaskIdentifier(stage: z.infer<typeof legalDiscoveryStageSchema>) {
  return taskByStage[stage]
}
export const legalDiscoveryDispatchPayloadSchema = z.strictObject({ manifestId: hashSchema, unitKey: hashSchema })
export const legalDiscoveryDispatchPlanSchema = z.strictObject({
  sourceId: sourceSchema,
  scopeKey: hashSchema,
  afterUnitKey: hashSchema.nullable().default(null),
  limit: z.int().min(1).max(100).default(25)
})

const candidateSchema = z.object({
  source_id: sourceSchema,
  scope_key: hashSchema,
  unit_key: hashSchema,
  manifest_id: hashSchema,
  state: z.enum(["registered", "acquired", "parsed"])
})
const stageByState = {
  registered: "acquisition",
  acquired: "parsing",
  parsed: "publication"
} as const

type Stage = z.infer<typeof legalDiscoveryStageSchema>
type Payload = z.infer<typeof legalDiscoveryDispatchPayloadSchema>
type Submit = (
  stage: Stage,
  payload: Payload,
  options: { idempotencyKey: string; idempotencyKeyTTL: "7d" }
) => Promise<{ id: string }>

function dispatchIdentity(stage: Stage, payload: Payload) {
  return digest(JSON.stringify(["legal-discovery-dispatch-2026-09-17", stage, payload]))
}

/** Registers a bounded keyset page of next-stage intents before any remote Trigger submission. */
export async function planLegalDiscoveryDispatchPage(pool: pg.Pool, value: unknown) {
  const input = legalDiscoveryDispatchPlanSchema.parse(value)
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='30s'")
    const selected = await client.query(
      `SELECT source_id,scope_key,unit_key,manifest_id,state
       FROM legislation.legal_discovery_units
       WHERE source_id=$1 AND scope_key=$2 AND unit_key>COALESCE($3,'')
         AND state IN ('registered','acquired','parsed')
       ORDER BY unit_key LIMIT $4 FOR UPDATE SKIP LOCKED`,
      [input.sourceId, input.scopeKey, input.afterUnitKey, input.limit]
    )
    const dispatches = []
    for (const value of selected.rows) {
      const candidate = candidateSchema.parse(value)
      const stage = stageByState[candidate.state]
      const payload = legalDiscoveryDispatchPayloadSchema.parse({
        manifestId: candidate.manifest_id,
        unitKey: candidate.unit_key
      })
      const payloadHash = digest(JSON.stringify(payload))
      const id = dispatchIdentity(stage, payload)
      const registered = await client.query(
        `INSERT INTO legislation.legal_discovery_dispatches
         (id,source_id,scope_key,unit_key,manifest_id,stage,payload_hash,payload)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
         ON CONFLICT(id) DO UPDATE SET id=EXCLUDED.id
         WHERE legislation.legal_discovery_dispatches.source_id=EXCLUDED.source_id
           AND legislation.legal_discovery_dispatches.scope_key=EXCLUDED.scope_key
           AND legislation.legal_discovery_dispatches.unit_key=EXCLUDED.unit_key
           AND legislation.legal_discovery_dispatches.manifest_id=EXCLUDED.manifest_id
           AND legislation.legal_discovery_dispatches.stage=EXCLUDED.stage
           AND legislation.legal_discovery_dispatches.payload_hash=EXCLUDED.payload_hash
         RETURNING id`,
        [
          id,
          candidate.source_id,
          candidate.scope_key,
          candidate.unit_key,
          candidate.manifest_id,
          stage,
          payloadHash,
          JSON.stringify(payload)
        ]
      )
      invariant(registered.rowCount === 1, "legal_discovery_dispatch_conflict")
      dispatches.push({ id, stage, payload, payloadHash })
    }
    await client.query("COMMIT")
    return {
      dispatches,
      selected: dispatches.length,
      afterUnitKey: selected.rows.at(-1)?.unit_key ?? input.afterUnitKey,
      exhausted: selected.rows.length < input.limit
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

/** Records canonical stage advancement before a worker admits its bounded controller continuation. */
export async function completeLegalDiscoveryDispatch(pool: pg.Pool, stageValue: unknown, payloadValue: unknown) {
  const stage = legalDiscoveryStageSchema.parse(stageValue)
  const payload = legalDiscoveryDispatchPayloadSchema.parse(payloadValue)
  const id = dispatchIdentity(stage, payload)
  const completed = await pool.query(
    `UPDATE legislation.legal_discovery_dispatches dispatch
     SET completed_at=COALESCE(completed_at,clock_timestamp()),last_observed_status='CANONICAL_COMPLETED',
       last_observed_at=clock_timestamp(),last_error=NULL,lease_token=NULL,lease_expires_at=NULL
     FROM legislation.legal_discovery_units unit
     WHERE dispatch.id=$1 AND dispatch.stage=$2 AND dispatch.manifest_id=$3 AND dispatch.unit_key=$4
       AND unit.source_id=dispatch.source_id AND unit.scope_key=dispatch.scope_key AND unit.unit_key=dispatch.unit_key
       AND (unit.state='quarantined'
         OR ($2='acquisition' AND unit.state IN ('acquired','parsed','published'))
         OR ($2='parsing' AND unit.state IN ('parsed','published'))
         OR ($2='publication' AND unit.state='published'))
     RETURNING dispatch.source_id,dispatch.scope_key`,
    [id, stage, payload.manifestId, payload.unitKey]
  )
  invariant(completed.rowCount === 1, "legal_discovery_dispatch_canonical_completion_missing")
  return z
    .object({ source_id: sourceSchema, scope_key: hashSchema })
    .transform((row) => ({ sourceId: row.source_id, scopeKey: row.scope_key }))
    .parse(completed.rows[0])
}

/** Claims and records one stable remote submission. Stage workers retain authority for canonical state changes. */
export async function submitLegalDiscoveryDispatch(pool: pg.Pool, dispatchId: string, submit: Submit) {
  const id = hashSchema.parse(dispatchId)
  const token = randomUUID()
  const claimed = await pool.query(
    `UPDATE legislation.legal_discovery_dispatches
     SET lease_token=$2,lease_expires_at=clock_timestamp()+interval '2 minutes',
       first_attempt_at=COALESCE(first_attempt_at,clock_timestamp()),state='submitting'
     WHERE id=$1 AND state IN ('pending','submitting')
       AND (lease_token IS NULL OR lease_expires_at<clock_timestamp())
       AND (first_attempt_at IS NULL OR first_attempt_at>clock_timestamp()-interval '6 days')
     RETURNING stage,payload_hash,payload,attempt`,
    [id, token]
  )
  if (claimed.rowCount !== 1) {
    const existing = z
      .object({
        state: z.string(),
        run_id: z.string().nullable(),
        attempt: z.int().nonnegative(),
        expired: z.boolean()
      })
      .parse(
        (
          await pool.query(
            `SELECT state,run_id,attempt,COALESCE(first_attempt_at<=clock_timestamp()-interval '6 days',false) expired
             FROM legislation.legal_discovery_dispatches WHERE id=$1`,
            [id]
          )
        ).rows[0]
      )
    if (existing.state === "submitted" && existing.run_id !== null) {
      return { dispatchId: id, runId: existing.run_id, attempt: existing.attempt, reused: true }
    }
    if (existing.expired) throw new Error("legal_discovery_dispatch_requires_reconciliation")
    throw new Error("legal_discovery_dispatch_busy")
  }
  const row = z
    .object({
      stage: legalDiscoveryStageSchema,
      payload_hash: hashSchema,
      payload: legalDiscoveryDispatchPayloadSchema,
      attempt: z.int().nonnegative()
    })
    .parse(claimed.rows[0])
  invariant(row.payload_hash === digest(JSON.stringify(row.payload)), "legal_discovery_dispatch_payload_changed")
  try {
    const run = z.object({ id: z.string().min(1).max(256) }).parse(
      await submit(row.stage, row.payload, {
        idempotencyKey: `legal-discovery:${id}:${row.attempt}`,
        idempotencyKeyTTL: "7d"
      })
    )
    const saved = await pool.query(
      `UPDATE legislation.legal_discovery_dispatches
       SET state='submitted',run_id=$3,lease_token=NULL,lease_expires_at=NULL,last_error=NULL
       WHERE id=$1 AND lease_token=$2 AND lease_expires_at>clock_timestamp() RETURNING id`,
      [id, token, run.id]
    )
    invariant(saved.rowCount === 1, "legal_discovery_dispatch_lease_lost")
    return { dispatchId: id, runId: run.id, attempt: row.attempt, reused: false }
  } catch (error) {
    await pool.query(
      `UPDATE legislation.legal_discovery_dispatches
       SET lease_token=NULL,lease_expires_at=NULL,last_error='submission_uncertain'
       WHERE id=$1 AND lease_token=$2`,
      [id, token]
    )
    throw error
  }
}
