import { randomUUID } from "node:crypto"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { embeddingTokenizer } from "../../models/embedding-tokenizer.js"
import { digest } from "./contracts.js"
import { materializeLegalPassages } from "./passage-storage.js"
import { legalPassageContract } from "./passages.js"
import { requireRights } from "./storage.js"

export const legalPreparationScopeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("edition"), id: z.uuid() }),
  z.strictObject({ kind: z.literal("publication"), id: z.uuid() })
])
type Scope = z.infer<typeof legalPreparationScopeSchema>
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
export async function readLegalPassageInventory(client: pg.PoolClient, scope: Scope, preparationId?: string) {
  const plan: z.infer<typeof itemSchema>[] = []
  let after = -1
  let bytes = 0
  while (true) {
    let result: pg.QueryResult
    if (preparationId) {
      result = await client.query(
        "SELECT ordinal,version_id,left(context,16001) AS context FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1 AND ordinal>$2 ORDER BY ordinal LIMIT 100",
        [preparationId, after]
      )
    } else if (scope.kind === "edition") {
      result = await client.query(
        `SELECT m.ordinal,m.version_id,left(concat_ws(E'\n',c.jurisdiction_id,c.name,m.native_id,v.heading),16001) AS context
      FROM legislation.legal_edition_provisions m JOIN legislation.legal_codes c ON c.id=m.code_id
      JOIN legislation.legal_provision_versions v ON v.id=m.version_id WHERE m.edition_id=$1 AND m.ordinal>$2 ORDER BY m.ordinal LIMIT 100 FOR SHARE OF m,v,c`,
        [scope.id, after]
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
    if ((!preparationId && scope.kind === "publication") || page.length < 100) {
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
  input: { scope: Scope; model: "openai/text-embedding-3-small" | "voyageai/voyage-4"; limit?: number }
) {
  const scope = legalPreparationScopeSchema.parse(input.scope)
  const limit = z
    .int()
    .min(1)
    .max(25)
    .parse(input.limit ?? 10)
  const tokenizer = await embeddingTokenizer(input.model)
  const id = digest(JSON.stringify(["legal-passage-preparation", scope, tokenizer.id, legalPassageContract]))
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
      "SELECT ordinal,version_id,context FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1 AND generation_id IS NULL ORDER BY ordinal LIMIT $2",
      [id, limit]
    )
    const items = z.array(itemSchema).parse(pending.rows)
    for (const item of items) {
      const prepared = await materializeLegalPassages(pool, {
        scope:
          scope.kind === "edition"
            ? { kind: "provision", versionId: item.version_id, editionId: scope.id }
            : { kind: "publication", versionId: item.version_id, observationId: scope.id },
        model: input.model,
        context: item.context
      })
      await transaction(pool, async (client) => {
        await check(client)
        const written = await client.query(
          `UPDATE legislation.legal_passage_preparation_items SET generation_id=$3
          WHERE preparation_id=$1 AND ordinal=$2 AND generation_id IS NULL`,
          [id, item.ordinal, prepared.generationId]
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
        `SELECT count(*)::integer AS total,count(generation_id)::integer AS complete
        FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1`,
        [id]
      )
      const counts = z.object({ total: z.int(), complete: z.int() }).parse(result.rows[0])
      const job = await client.query(
        "SELECT expected_count,inventory_hash FROM legislation.legal_passage_preparations WHERE id=$1",
        [id]
      )
      invariant(counts.total === job.rows[0].expected_count, "legal_preparation_inventory_missing")
      const isPrepared = counts.complete === counts.total
      if (isPrepared) {
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
      const released = await client.query(
        "UPDATE legislation.legal_passage_preparations SET state=$2,lease_token=NULL,lease_expires_at=NULL,last_error=NULL WHERE id=$1 AND lease_token=$3 AND fence=$4 AND lease_expires_at>clock_timestamp()",
        [id, isPrepared ? "prepared" : "pending", token, claim]
      )
      invariant(released.rowCount === 1, "legal_preparation_lease_lost")
      return {
        preparationId: id,
        state: isPrepared ? ("prepared" as const) : ("pending" as const),
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
