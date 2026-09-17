import { isLegalSearchDatabaseName } from "@repo/legislation-core/legal-text/search-database-role"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { legalPreparationScopeSchema, requireLegalPreparationRights } from "./passage-preparation.js"

export const legalPreparationStatusRequestSchema = z.strictObject({
  preparationId: z.string().regex(/^[a-f0-9]{64}$/),
  afterOrdinal: z.int().min(-1).default(-1),
  limit: z.int().min(1).max(100).default(25)
})

/** Operator checkpoint inspection only. Never acknowledges indexing or certifies passage/embedding integrity. */
export async function inspectLegalPreparationStatus(pool: pg.Pool, unparsed: unknown) {
  const input = legalPreparationStatusRequestSchema.parse(unparsed)
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='15s'")
    invariant(
      !isLegalSearchDatabaseName((await client.query("SELECT current_database() AS name")).rows[0]?.name),
      "legal_preparation_wrong_database"
    )
    const result = await client.query(
      `SELECT edition_id,observation_id,state,expected_count,left(tokenizer_id,257) AS tokenizer_id,
      inventory_hash,fence,left(last_error,129) AS last_error,
      lease_token IS NOT NULL AND lease_expires_at>transaction_timestamp() AS lease_active,
      lease_expires_at,retry_at,retry_at>transaction_timestamp() AS retry_delayed,
      transaction_timestamp() AS inspected_at
      FROM legislation.legal_passage_preparations WHERE id=$1 FOR SHARE`,
      [input.preparationId]
    )
    invariant(result.rows.length === 1, "legal_preparation_not_found")
    const job = z
      .object({
        edition_id: z.uuid().nullable(),
        observation_id: z.uuid().nullable(),
        state: z.enum(["pending", "prepared", "blocked"]),
        expected_count: z.int().positive(),
        tokenizer_id: z.string().max(256),
        inventory_hash: z.string().regex(/^[a-f0-9]{64}$/),
        fence: z.int().nonnegative(),
        last_error: z
          .string()
          .max(128)
          .regex(/^[a-z_]+$/)
          .nullable(),
        lease_active: z.boolean(),
        lease_expires_at: z.date().nullable(),
        retry_at: z.date(),
        retry_delayed: z.boolean(),
        inspected_at: z.date()
      })
      .parse(result.rows[0])
    invariant((job.edition_id === null) !== (job.observation_id === null), "legal_preparation_scope_mismatch")
    const scope = legalPreparationScopeSchema.parse(
      job.edition_id === null
        ? { kind: "publication", id: job.observation_id }
        : { kind: "edition", id: job.edition_id }
    )
    await requireLegalPreparationRights(client, scope)
    // Rights are held before reading counts or failure identities. No source bodies or lease tokens are returned.
    const counts = z
      .object({ present: z.int().nonnegative(), prepared: z.int().nonnegative(), blocked: z.int().nonnegative() })
      .parse(
        (
          await client.query(
            `SELECT count(*)::integer AS present,count(generation_id)::integer AS prepared,count(failure_code)::integer AS blocked
        FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1`,
            [input.preparationId]
          )
        ).rows[0]
      )
    const failures = z
      .array(
        z.object({
          ordinal: z.int().nonnegative(),
          version_id: z.uuid(),
          failure_code: z
            .string()
            .max(128)
            .regex(/^[a-z_]+$/),
          failed_at: z.date()
        })
      )
      .parse(
        (
          await client.query(
            `SELECT ordinal,version_id,left(failure_code,129) AS failure_code,failed_at
      FROM legislation.legal_passage_preparation_items
      WHERE preparation_id=$1 AND failure_code IS NOT NULL AND ordinal>$2 ORDER BY ordinal LIMIT $3`,
            [input.preparationId, input.afterOrdinal, input.limit + 1]
          )
        ).rows
      )
    const page = failures.slice(0, input.limit)
    const missing = Math.max(0, job.expected_count - counts.present)
    const unexpected = Math.max(0, counts.present - job.expected_count)
    const unattempted = counts.present - counts.prepared - counts.blocked
    invariant(unattempted >= 0, "legal_preparation_invalid_counts")
    await client.query("COMMIT")
    return {
      preparationId: input.preparationId,
      scope,
      inspectedAt: job.inspected_at.toISOString(),
      checkpointState: job.state,
      tokenizerId: job.tokenizer_id,
      inventoryHash: job.inventory_hash,
      counts: { expected: job.expected_count, ...counts, unattempted, missing, unexpected },
      lease: { active: job.lease_active, expiresAt: job.lease_expires_at?.toISOString() ?? null, fence: job.fence },
      retry: { delayed: job.retry_delayed, at: job.retry_at.toISOString(), lastError: job.last_error },
      failures: page.map((row) => ({
        ordinal: row.ordinal,
        versionId: row.version_id,
        reason: row.failure_code,
        failedAt: row.failed_at.toISOString()
      })),
      nextAfterOrdinal: failures.length > input.limit ? (page.at(-1)?.ordinal ?? null) : null,
      canonicalWrites: false as const,
      dispatched: false as const,
      publicSearchReady: false as const
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
