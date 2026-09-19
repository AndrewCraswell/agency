import { sql } from "drizzle-orm"
import { z } from "zod"
import type { DerivedBackfillExecutionInput } from "../backfill/derived.js"
import { OCR_MAXIMUM_ATTEMPTS } from "../documents/ocr-retry.js"

export const stateContentNextWork = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("continue") }),
  z.object({ kind: z.literal("deferred"), retryAt: z.iso.datetime() }),
  z.object({ kind: z.literal("drained") }),
  z.object({ kind: z.literal("blocked"), records: z.int().positive() })
])

const inventory = z.object({
  due: z.coerce.number().int().nonnegative(),
  processing: z.coerce.number().int().nonnegative(),
  blocked: z.coerce.number().int().nonnegative(),
  retry_at: z.coerce.date().nullable(),
  checked_at: z.coerce.date()
})

export function nextStateContentWork(value: unknown): z.infer<typeof stateContentNextWork> {
  const row = inventory.parse(value)
  if (row.due > 0) return { kind: "continue" }
  if (row.processing > 0 || row.retry_at !== null) {
    const retry = row.processing > 0 ? row.checked_at.getTime() + 60_000 : Infinity
    return { kind: "deferred", retryAt: new Date(Math.min(retry, row.retry_at?.getTime() ?? Infinity)).toISOString() }
  }
  if (row.blocked > 0) return { kind: "blocked", records: row.blocked }
  return { kind: "drained" }
}

/** Only called after every bill in a scan has had its embedding freshness checked. */
export async function inspectStateContentBacklog(input: DerivedBackfillExecutionInput, state: string, session: string) {
  const result = await input.database.execute(sql`
    WITH work AS (
      SELECT d.*,
        (d.processing_status='pending' AND d.processing_attempts < ${input.config.ingestion.maxAttempts}) OR
        (d.processing_status='unsupported' AND d.processing_error_category='ocr-required'
          AND d.blob_path IS NOT NULL
          AND d.processing_attempts < ${Math.min(input.config.ocr.maximumAttempts, OCR_MAXIMUM_ATTEMPTS)}) AS eligible
      FROM legislation.bills b JOIN legislation.bill_documents d ON d.bill_id=b.id
      WHERE b.jurisdiction_id=${`jurisdiction:${state}`} AND b.session_id=${`session:${state}:${session}`}
    )
    SELECT count(*) FILTER (WHERE eligible AND (next_attempt_at IS NULL OR next_attempt_at<=now())) AS due,
      count(*) FILTER (WHERE processing_status='processing') AS processing,
      count(*) FILTER (WHERE processing_status='failed' OR
        (NOT eligible AND (processing_status='pending' OR processing_error_category='ocr-required'))) AS blocked,
      min(next_attempt_at) FILTER (WHERE eligible AND next_attempt_at>now()) AS retry_at,
      now() AS checked_at FROM work
  `)
  return nextStateContentWork(result.rows[0])
}
