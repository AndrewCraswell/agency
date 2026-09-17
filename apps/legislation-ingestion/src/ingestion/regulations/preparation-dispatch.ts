import { randomUUID } from "node:crypto"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import { z } from "zod"
import { legalPassagePreparationIdentity, legalPreparationScopeSchema } from "./passage-preparation.js"

export const preparationDispatchSchema = z.strictObject({
  waveId: z.uuid(),
  scope: legalPreparationScopeSchema,
  model: z.enum(["openai/text-embedding-3-small", "voyageai/voyage-4"]),
  limit: z.int().min(1).max(25).default(10),
  retryBlocked: z.boolean().default(false)
})
type Dispatch = z.output<typeof preparationDispatchSchema>
type Submit = (
  payload: Omit<Dispatch, "waveId">,
  options: { idempotencyKey: string; idempotencyKeyTTL: "7d" }
) => Promise<{ id: string }>

/** Register immutable intent before any remote submission. */
export async function registerLegalPreparationDispatch(pool: Pick<pg.Pool, "query">, unparsed: unknown) {
  const input = preparationDispatchSchema.parse(unparsed)
  const { waveId, ...payload } = input
  const id = digest(JSON.stringify([waveId, input.scope.kind, input.scope.id, input.model]))
  const { id: preparationId } = await legalPassagePreparationIdentity(input.scope, input.model)
  const payloadHash = digest(JSON.stringify(payload))
  const registered = await pool.query(
    `INSERT INTO legislation.legal_preparation_dispatches
    (id,wave_id,scope_kind,scope_id,model,preparation_id,payload_hash,payload)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT(id) DO UPDATE SET id=EXCLUDED.id
    WHERE legislation.legal_preparation_dispatches.payload_hash=EXCLUDED.payload_hash
      AND legislation.legal_preparation_dispatches.preparation_id=EXCLUDED.preparation_id RETURNING id`,
    [id, waveId, input.scope.kind, input.scope.id, input.model, preparationId, payloadHash, JSON.stringify(payload)]
  )
  if (registered.rows.length !== 1) {
    throw new Error("legal_dispatch_payload_changed")
  }
  return { id, preparationId, payload, payloadHash }
}

/** Submission bookkeeping only. Source workers still own canonical leases and completion checkpoints. */
export async function submitLegalPreparation(pool: pg.Pool, unparsed: unknown, submit: Submit) {
  const { id, payload, payloadHash } = await registerLegalPreparationDispatch(pool, unparsed)
  const token = randomUUID()
  const claimed = await pool.query(
    `UPDATE legislation.legal_preparation_dispatches SET lease_token=$3,
    lease_expires_at=clock_timestamp()+interval '2 minutes',
    first_attempt_at=COALESCE(first_attempt_at,clock_timestamp()),state='submitting'
    WHERE id=$1 AND payload_hash=$2 AND state IN ('pending','submitting')
      AND (lease_token IS NULL OR lease_expires_at<clock_timestamp())
      AND (first_attempt_at IS NULL OR first_attempt_at>clock_timestamp()-interval '6 days')
    RETURNING id,attempt`,
    [id, payloadHash, token]
  )
  if (claimed.rows.length === 0) {
    const row = z
      .object({
        payload_hash: z.string(),
        state: z.string(),
        run_id: z.string().nullable(),
        attempt: z.int().nonnegative(),
        expired: z.boolean()
      })
      .parse(
        (
          await pool.query(
            `SELECT payload_hash,state,run_id,attempt,
              COALESCE(first_attempt_at<=clock_timestamp()-interval '6 days',false) AS expired
        FROM legislation.legal_preparation_dispatches WHERE id=$1`,
            [id]
          )
        ).rows[0]
      )
    if (row.payload_hash !== payloadHash) {
      throw new Error("legal_dispatch_payload_changed")
    }
    if (row.state === "submitted" && row.run_id !== null) {
      return { dispatchId: id, runId: row.run_id, attempt: row.attempt, reused: true }
    }
    if (row.expired) {
      throw new Error("legal_dispatch_requires_reconciliation")
    }
    throw new Error("legal_dispatch_busy")
  }
  const attempt = z.int().nonnegative().parse(claimed.rows[0].attempt)
  try {
    const result = z
      .object({ id: z.string().min(1).max(256) })
      .parse(await submit(payload, { idempotencyKey: `legal-preparation:${id}:${attempt}`, idempotencyKeyTTL: "7d" }))
    const saved = await pool.query(
      `UPDATE legislation.legal_preparation_dispatches SET state='submitted',run_id=$3,
      lease_token=NULL,lease_expires_at=NULL,last_error=NULL WHERE id=$1 AND lease_token=$2
      AND lease_expires_at>clock_timestamp() RETURNING id`,
      [id, token, result.id]
    )
    if (saved.rows.length !== 1) {
      throw new Error("legal_dispatch_lease_lost")
    }
    return { dispatchId: id, runId: result.id, attempt, reused: false }
  } catch (error) {
    // Acceptance may have happened remotely. Never mint a replacement key based on an observation failure.
    await pool.query(
      `UPDATE legislation.legal_preparation_dispatches SET lease_token=NULL,lease_expires_at=NULL,
      last_error='submission_uncertain' WHERE id=$1 AND lease_token=$2`,
      [id, token]
    )
    throw error
  }
}
