import { randomUUID } from "node:crypto"
import { embeddingTokenizer } from "@repo/legislation-core/embeddings/embedding-tokenizer"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { requireRights } from "@repo/legislation-core/legal-text/rights"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { legalPassagePreparationBlocker } from "./passage-failure.js"
import { materializeLegalPassages } from "./passage-storage.js"
import { legalPassageContract } from "./passages.js"

export const legalPreparationScopeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("edition"), id: z.uuid() }),
  z.strictObject({ kind: z.literal("publication"), id: z.uuid() })
])
type Scope = z.infer<typeof legalPreparationScopeSchema>
type Model = "openai/text-embedding-3-small" | "voyageai/voyage-4"
const itemSchema = z.object({
  ordinal: z.int().nonnegative(),
  version_id: z.uuid(),
  context: z
    .string()
    .max(16000)
    .transform((value) => value.trim())
})
async function transaction<T>(pool: pg.Pool, action: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='60s'")
    const result = await action(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
export async function legalPassagePreparationIdentity(scopeValue: unknown, model: Model) {
  const scope = legalPreparationScopeSchema.parse(scopeValue)
  const tokenizer = await embeddingTokenizer(model)
  return {
    id: digest(JSON.stringify(["legal-passage-preparation", scope, tokenizer.id, legalPassageContract])),
    tokenizer
  }
}
export async function requireLegalPreparationRights(client: pg.PoolClient, scope: Scope) {
  const result =
    scope.kind === "edition"
      ? await client.query(
          "SELECT rights_profile_id FROM legislation.legal_editions WHERE id=$1 AND published_at IS NOT NULL FOR SHARE",
          [scope.id]
        )
      : await client.query(
          "SELECT rights_profile_id FROM legislation.regulatory_document_observations WHERE id=$1 FOR SHARE",
          [scope.id]
        )
  invariant(result.rows.length === 1, "legal_preparation_source_unavailable")
  const profile = z.string().parse(result.rows[0].rights_profile_id)
  await requireRights(client, profile, "displayText")
  await requireRights(client, profile, "localSearch")
}
export async function readLegalPassageInventory(
  client: pg.PoolClient,
  scope: Scope,
  preparationId?: string,
  pageSizeInput = 100
) {
  const pageSize = z.int().min(1).max(1000).parse(pageSizeInput)
  const plan: z.infer<typeof itemSchema>[] = []
  let after = -1
  let bytes = 0
  while (true) {
    let result: pg.QueryResult
    if (preparationId) {
      result = await client.query(
        "SELECT ordinal,version_id,left(context,16001) AS context FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1 AND ordinal>$2 ORDER BY ordinal LIMIT $3",
        [preparationId, after, pageSize]
      )
    } else if (scope.kind === "edition") {
      result = await client.query(
        `SELECT m.ordinal,m.version_id,left(concat_ws(E'\n',c.jurisdiction_id,c.name,m.native_id,v.heading),16001) AS context
      FROM legislation.legal_edition_provisions m JOIN legislation.legal_codes c ON c.id=m.code_id
      JOIN legislation.legal_provision_versions v ON v.id=m.version_id WHERE m.edition_id=$1 AND m.ordinal>$2 ORDER BY m.ordinal LIMIT $3 FOR SHARE OF m,v,c`,
        [scope.id, after, pageSize]
      )
    } else {
      result = await client.query(
        `SELECT 0 AS ordinal,o.version_id,left(concat_ws(E'\n',o.jurisdiction_id,s.publisher,o.metadata->>'document_number',v.publication_kind,v.heading),16001) AS context
      FROM legislation.regulatory_document_observations o JOIN legislation.regulatory_document_versions v ON v.id=o.version_id
      JOIN legislation.legal_sources s ON s.id=o.source_id WHERE o.id=$1 FOR SHARE OF o,v,s`,
        [scope.id]
      )
    }
    // One extra character makes over-limit source context fail validation instead of silently truncating it.
    const page = z.array(itemSchema).parse(result.rows)
    bytes += Buffer.byteLength(JSON.stringify(page))
    invariant(bytes <= 64 * 1024 * 1024 && plan.length + page.length <= 1_000_000, "legal_preparation_inventory_limit")
    plan.push(...page)
    if ((!preparationId && scope.kind === "publication") || page.length < pageSize) {
      break
    }
    const last = page.at(-1)
    invariant(last && last.ordinal > after, "legal_preparation_inventory_cursor")
    after = last.ordinal
  }
  invariant(plan.length > 0, "legal_preparation_empty_inventory")
  return plan
}

/** Restartable canonical preparation only. Isolated-index acknowledgements and embedding dispatch are separate gates. */
export async function runLegalPassagePreparationBatch(
  pool: pg.Pool,
  input: {
    scope: Scope
    model: Model
    limit?: number
    retryBlocked?: boolean
  }
) {
  const scope = legalPreparationScopeSchema.parse(input.scope)
  const retryBlocked = z.boolean().parse(input.retryBlocked ?? false)
  const limit = z
    .int()
    .min(1)
    .max(25)
    .parse(input.limit ?? 10)
  const { id, tokenizer } = await legalPassagePreparationIdentity(scope, input.model)
  const token = randomUUID()
  const claim = await transaction(pool, async (client) => {
    await requireLegalPreparationRights(client, scope)
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [id])
    const exists = await client.query("SELECT id FROM legislation.legal_passage_preparations WHERE id=$1", [id])
    if (!exists.rowCount) {
      const plan = await readLegalPassageInventory(client, scope)
      await client.query(
        `INSERT INTO legislation.legal_passage_preparations(id,edition_id,observation_id,tokenizer_id,inventory_hash,expected_count)
        VALUES($1,$2,$3,$4,$5,$6)`,
        [
          id,
          scope.kind === "edition" ? scope.id : null,
          scope.kind === "publication" ? scope.id : null,
          tokenizer.id,
          digest(JSON.stringify(plan)),
          plan.length
        ]
      )
      for (let offset = 0; offset < plan.length; offset += 100) {
        await client.query(
          `INSERT INTO legislation.legal_passage_preparation_items(preparation_id,ordinal,version_id,context)
          SELECT $1,x.ordinal,x.version_id,x.context FROM jsonb_to_recordset($2::jsonb) AS x(ordinal integer,version_id uuid,context text)`,
          [id, JSON.stringify(plan.slice(offset, offset + 100))]
        )
      }
    }
    const claimed = await client.query(
      `UPDATE legislation.legal_passage_preparations SET lease_token=$2,lease_expires_at=clock_timestamp()+interval '120 seconds',fence=fence+1
      WHERE id=$1 AND (lease_token IS NULL OR lease_expires_at<=clock_timestamp()) AND retry_at<=clock_timestamp() RETURNING fence`,
      [id, token]
    )
    invariant(claimed.rowCount === 1, "legal_preparation_busy_or_delayed")
    if (retryBlocked) {
      if (scope.kind === "edition") {
        await client.query(
          `UPDATE legislation.legal_passage_preparation_items item SET failure_code=NULL,failed_at=NULL
          WHERE item.preparation_id=$1 AND item.generation_id IS NULL AND item.failure_code IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM legislation.legal_provision_source_reviews review
            WHERE review.edition_id=$2 AND review.version_id=item.version_id
            AND review.disposition='quarantined_source_gap'
          )`,
          [id, scope.id]
        )
      } else {
        await client.query(
          "UPDATE legislation.legal_passage_preparation_items SET failure_code=NULL,failed_at=NULL WHERE preparation_id=$1 AND generation_id IS NULL AND failure_code IS NOT NULL",
          [id]
        )
      }
    }
    if (scope.kind === "edition") {
      await client.query(
        `UPDATE legislation.legal_passage_preparation_items item
        SET failure_code='source_review_quarantined',failed_at=clock_timestamp()
        WHERE item.preparation_id=$1 AND item.generation_id IS NULL
        AND (item.failure_code IS NULL OR item.failure_code='source_review_quarantined')
        AND EXISTS (
          SELECT 1 FROM legislation.legal_provision_source_reviews review
          WHERE review.edition_id=$2 AND review.version_id=item.version_id
          AND review.disposition='quarantined_source_gap'
        )`,
        [id, scope.id]
      )
    }
    return z.int().positive().parse(claimed.rows[0].fence)
  })
  const check = async (client: pg.PoolClient) => {
    const lease = await client.query(
      `SELECT id FROM legislation.legal_passage_preparations
      WHERE id=$1 AND lease_token=$2 AND fence=$3 AND lease_expires_at>clock_timestamp() FOR UPDATE`,
      [id, token, claim]
    )
    invariant(lease.rowCount === 1, "legal_preparation_lease_lost")
    await requireLegalPreparationRights(client, scope)
  }
  try {
    const pending = await pool.query(
      "SELECT ordinal,version_id,context FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1 AND generation_id IS NULL AND failure_code IS NULL ORDER BY ordinal LIMIT $2",
      [id, limit]
    )
    const items = z.array(itemSchema).parse(pending.rows)
    for (const item of items) {
      let generationId: string | null = null
      let failureCode: string | null = null
      try {
        const prepared = await materializeLegalPassages(pool, {
          scope:
            scope.kind === "edition"
              ? { kind: "provision", versionId: item.version_id, editionId: scope.id }
              : { kind: "publication", versionId: item.version_id, observationId: scope.id },
          model: input.model,
          context: item.context
        })
        generationId = prepared.generationId
      } catch (error) {
        failureCode = legalPassagePreparationBlocker(error)
        if (failureCode === null) {
          throw error
        }
      }
      await transaction(pool, async (client) => {
        await check(client)
        const written = await client.query(
          `UPDATE legislation.legal_passage_preparation_items SET generation_id=$3,failure_code=$4,
          failed_at=CASE WHEN $4::text IS NULL THEN NULL ELSE clock_timestamp() END
          WHERE preparation_id=$1 AND ordinal=$2 AND generation_id IS NULL AND failure_code IS NULL`,
          [id, item.ordinal, generationId, failureCode]
        )
        invariant(written.rowCount === 1, "legal_preparation_checkpoint_conflict")
        const renewed = await client.query(
          "UPDATE legislation.legal_passage_preparations SET lease_expires_at=clock_timestamp()+interval '120 seconds' WHERE id=$1 AND lease_token=$2 AND fence=$3 AND lease_expires_at>clock_timestamp()",
          [id, token, claim]
        )
        invariant(renewed.rowCount === 1, "legal_preparation_lease_lost")
      })
    }
    return await transaction(pool, async (client) => {
      await check(client)
      const result = await client.query(
        `SELECT count(*)::integer AS total,count(generation_id)::integer AS complete,count(failure_code)::integer AS blocked
        FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1`,
        [id]
      )
      const counts = z.object({ total: z.int(), complete: z.int(), blocked: z.int() }).parse(result.rows[0])
      const job = await client.query(
        "SELECT expected_count,inventory_hash FROM legislation.legal_passage_preparations WHERE id=$1",
        [id]
      )
      invariant(counts.total === job.rows[0].expected_count, "legal_preparation_inventory_missing")
      const isPrepared = counts.complete === counts.total
      const isFinished = counts.complete + counts.blocked === counts.total
      if (isFinished) {
        invariant(
          digest(JSON.stringify(await readLegalPassageInventory(client, scope, id))) === job.rows[0].inventory_hash,
          "legal_preparation_checkpoint_inventory_changed"
        )
        invariant(
          digest(JSON.stringify(await readLegalPassageInventory(client, scope))) === job.rows[0].inventory_hash,
          "legal_preparation_source_inventory_changed"
        )
        const missing = await client.query(
          `SELECT i.ordinal FROM legislation.legal_passage_preparation_items i
          JOIN legislation.legal_passage_generations g ON g.id=i.generation_id
          WHERE i.preparation_id=$1 AND (g.passage_count<>(SELECT count(*) FROM legislation.legal_passages p WHERE p.generation_id=g.id)
          OR coalesce(g.provision_version_id,g.document_version_id)<>i.version_id OR g.context<>i.context OR g.tokenizer_id<>$2) LIMIT 1`,
          [id, tokenizer.id]
        )
        invariant(missing.rowCount === 0, "legal_preparation_passage_inventory_mismatch")
      }
      let state: "pending" | "prepared" | "blocked" = "pending"
      if (isPrepared) {
        state = "prepared"
      } else if (isFinished) {
        state = "blocked"
      }
      const released = await client.query(
        "UPDATE legislation.legal_passage_preparations SET state=$2,lease_token=NULL,lease_expires_at=NULL,last_error=$5 WHERE id=$1 AND lease_token=$3 AND fence=$4 AND lease_expires_at>clock_timestamp()",
        [id, state, token, claim, counts.blocked > 0 ? "source_records_blocked" : null]
      )
      invariant(released.rowCount === 1, "legal_preparation_lease_lost")
      return {
        preparationId: id,
        state,
        processed: items.length,
        ...counts
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/^Invariant failed: /, "") : ""
    const reason = /^[a-z_]+$/.test(message) ? message : "preparation_failed"
    await pool.query(
      "UPDATE legislation.legal_passage_preparations SET lease_token=NULL,lease_expires_at=NULL,retry_at=clock_timestamp()+interval '5 seconds',last_error=$4,state='pending' WHERE id=$1 AND lease_token=$2 AND fence=$3",
      [id, token, claim, reason]
    )
    throw error
  }
}
