import { digest } from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import { z } from "zod"
import { preparationDispatchSchema, submitLegalPreparation } from "./preparation-dispatch.js"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
export const preparationRecoverySchema = z.strictObject({
  waveId: z.uuid(),
  afterId: hash.optional(),
  limit: z.int().min(1).max(10).default(10),
  execute: z.boolean().default(false)
})
const recordSchema = z.object({
  id: hash,
  wave_id: z.uuid(),
  scope_kind: z.enum(["edition", "publication"]),
  scope_id: z.uuid(),
  model: z.string(),
  payload_hash: hash,
  payload: preparationDispatchSchema.omit({ waveId: true }),
  state: z.enum(["pending", "submitting", "submitted"]),
  run_id: z.string().nullable(),
  busy: z.boolean(),
  expired: z.boolean()
})

/** One operator-driven keyset page. A finished page is not a finished wave or source preparation. */
export async function recoverLegalPreparationPage(
  pool: pg.Pool,
  unparsed: unknown,
  submit: Parameters<typeof submitLegalPreparation>[2]
) {
  const input = preparationRecoverySchema.parse(unparsed)
  const rows = z
    .array(recordSchema)
    .max(11)
    .parse(
      (
        await pool.query(
          `SELECT id,wave_id,scope_kind,scope_id,model,payload_hash,payload,state,run_id,
      COALESCE(lease_expires_at>clock_timestamp(),false) AS busy,
      COALESCE(first_attempt_at<=clock_timestamp()-interval '6 days',false) AS expired
     FROM legislation.legal_preparation_dispatches WHERE wave_id=$1 AND ($2::text IS NULL OR id>$2)
     ORDER BY id LIMIT $3`,
          [input.waveId, input.afterId ?? null, input.limit + 1]
        )
      ).rows
    )
  const selected = rows.slice(0, input.limit)
  // Validate the entire selected page before submitting any child. Never replay a corrupted payload.
  for (const row of selected) {
    if (
      row.wave_id !== input.waveId ||
      row.scope_kind !== row.payload.scope.kind ||
      row.scope_id !== row.payload.scope.id ||
      row.model !== row.payload.model ||
      row.id !== digest(JSON.stringify([row.wave_id, row.scope_kind, row.scope_id, row.model])) ||
      row.payload_hash !== digest(JSON.stringify(row.payload)) ||
      (row.state === "submitted") !== (row.run_id !== null)
    ) {
      throw new Error("legal_dispatch_stored_payload_mismatch")
    }
  }
  const results = []
  for (const row of selected) {
    if (row.state === "submitted") {
      results.push({ dispatchId: row.id, disposition: "already_submitted", runId: row.run_id })
      continue
    }
    if (row.expired || row.busy || !input.execute) {
      let disposition = "ready"
      if (row.expired) {
        disposition = "requires_reconciliation"
      } else if (row.busy) {
        disposition = "busy"
      }
      results.push({
        dispatchId: row.id,
        disposition,
        runId: null
      })
      continue
    }
    try {
      const result = await submitLegalPreparation(pool, { waveId: row.wave_id, ...row.payload }, submit)
      results.push({
        dispatchId: row.id,
        disposition: result.reused ? "already_submitted" : "submitted",
        runId: result.runId
      })
    } catch (error) {
      if (
        error instanceof Error &&
        ["legal_dispatch_busy", "legal_dispatch_requires_reconciliation"].includes(error.message)
      ) {
        results.push({
          dispatchId: row.id,
          disposition: error.message === "legal_dispatch_busy" ? "busy" : "requires_reconciliation",
          runId: null
        })
      } else {
        throw error
      }
    }
  }
  return {
    waveId: input.waveId,
    executed: input.execute,
    results,
    nextAfterId: rows.length > input.limit ? selected.at(-1)!.id : null
  }
}
