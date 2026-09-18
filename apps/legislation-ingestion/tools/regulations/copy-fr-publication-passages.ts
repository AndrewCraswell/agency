import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { runLegalPassageCopyBatch } from "../../src/ingestion/regulations/passage-copy-batch.js"
import { acknowledgeLegalPassageCopy } from "../../src/ingestion/regulations/passage-copy-readiness.js"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const modelSchema = z.enum(["openai/text-embedding-3-small", "voyageai/voyage-4"])
const { values } = parseArgs({
  options: {
    generation: { type: "string" },
    model: { type: "string" },
    output: { type: "string" },
    apply: { type: "boolean", default: false }
  }
})
const generationId = hash.parse(values.generation)
const model = modelSchema.parse(values.model)
const output = resolve(z.string().min(1).parse(values.output))
const sourceUrl = new URL(z.url().parse(process.env.REGULATORY_TEST_DATABASE_URL))
const targetUrl = new URL(z.url().parse(process.env.PASSAGE_SEARCH_DATABASE_URL))
invariant(
  ["127.0.0.1", "localhost", "[::1]"].includes(sourceUrl.hostname) && sourceUrl.pathname === "/regulations_test",
  "local_disposable_source_required"
)
invariant(
  ["127.0.0.1", "localhost", "[::1]"].includes(targetUrl.hostname) &&
    targetUrl.pathname === "/legislation_passage_search" &&
    targetUrl.host !== sourceUrl.host,
  "isolated_local_search_target_required"
)

const source = new pg.Pool({
  connectionString: sourceUrl.href,
  max: 3,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 180_000
})
const target = new pg.Pool({
  connectionString: targetUrl.href,
  max: 3,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 180_000
})
try {
  const identity = await Promise.all([
    source.query<{ name: string }>("SELECT current_database() AS name"),
    target.query<{ name: string }>("SELECT current_database() AS name")
  ])
  invariant(identity[0].rows[0]?.name === "regulations_test", "local_disposable_source_required")
  invariant(identity[1].rows[0]?.name === "legislation_passage_search", "isolated_local_search_target_required")

  const generation = await source.query<{ state: string; source_id: string }>(
    "SELECT state,source_id FROM legislation.legal_import_generations WHERE id=$1",
    [generationId]
  )
  invariant(
    generation.rows[0]?.state === "published" && generation.rows[0]?.source_id === "govinfo-fr",
    "fr_lexical_pilot_generation_not_published"
  )
  const tokenizerPattern = model === "openai/text-embedding-3-small" ? "tiktoken:%" : "huggingface-tokenizers:%"
  const preparations = z
    .array(
      z.object({
        id: hash,
        observation_id: z.uuid(),
        document_number: z.string().min(1),
        expected_count: z.int().positive()
      })
    )
    .parse(
      (
        await source.query(
          `SELECT p.id,p.observation_id,d.native_number AS document_number,p.expected_count
           FROM legislation.legal_passage_preparations p
           JOIN legislation.regulatory_document_observations o ON o.id=p.observation_id
           JOIN legislation.regulatory_documents d ON d.id=o.document_id
           WHERE o.generation_id=$1 AND p.state='prepared' AND p.tokenizer_id LIKE $2
           ORDER BY d.native_number,p.id`,
          [generationId, tokenizerPattern]
        )
      ).rows
    )
  const observationIds = preparations.map((item) => item.observation_id)
  invariant(preparations.length > 0, "fr_lexical_pilot_preparations_missing")
  invariant(new Set(observationIds).size === preparations.length, "fr_lexical_pilot_duplicate_preparation")
  const expected = await source.query<{ observations: number; pending_outbox: number }>(
    `SELECT count(*)::integer AS observations,
     count(*) FILTER (WHERE x.state<>'acknowledged')::integer AS pending_outbox
     FROM legislation.regulatory_document_observations o
     JOIN legislation.regulatory_publication_outbox x ON x.observation_id=o.id AND x.operation='lexical'
     WHERE o.generation_id=$1`,
    [generationId]
  )
  invariant(expected.rows[0]?.observations === preparations.length, "fr_lexical_pilot_inventory_mismatch")

  const results = []
  if (values.apply === true) {
    for (const preparation of preparations) {
      let afterOrdinal = -1
      let traversed = 0
      while (true) {
        const copied = await runLegalPassageCopyBatch(source, target, {
          preparationId: preparation.id,
          afterOrdinal,
          limit: 25
        })
        traversed += copied.copied
        afterOrdinal = copied.afterOrdinal
        if (copied.exhausted) break
      }
      invariant(traversed === preparation.expected_count, "fr_lexical_pilot_copy_incomplete")
      const acknowledged = await acknowledgeLegalPassageCopy(source, target, preparation.id)
      invariant(
        acknowledged.acknowledged &&
          acknowledged.copyComplete &&
          acknowledged.copiedGenerations === preparation.expected_count,
        "fr_lexical_pilot_acknowledgement_failed"
      )
      results.push({
        preparationId: preparation.id,
        observationId: preparation.observation_id,
        documentNumber: preparation.document_number,
        traversed,
        copiedGenerations: acknowledged.copiedGenerations,
        copiedPassages: acknowledged.copiedPassages,
        removedMemberships: acknowledged.removedMemberships,
        removedGenerations: acknowledged.removedGenerations
      })
      process.stdout.write(
        `${JSON.stringify({ documentNumber: preparation.document_number, passages: acknowledged.copiedPassages })}\n`
      )
    }
  }

  const [canonical, projected] = await Promise.all([
    source.query<{ acknowledged: number; passages: number }>(
      `SELECT count(*) FILTER (WHERE x.state='acknowledged')::integer AS acknowledged,
       coalesce(sum(g.passage_count),0)::integer AS passages
       FROM legislation.legal_passage_preparations p
       JOIN legislation.regulatory_document_observations o ON o.id=p.observation_id
       JOIN legislation.regulatory_publication_outbox x ON x.observation_id=o.id AND x.operation='lexical'
       JOIN legislation.legal_passage_preparation_items i ON i.preparation_id=p.id
       JOIN legislation.legal_passage_generations g ON g.id=i.generation_id
       WHERE o.generation_id=$1 AND p.tokenizer_id LIKE $2`,
      [generationId, tokenizerPattern]
    ),
    target.query<{ scopes: number; generations: number; passages: number }>(
      `SELECT count(*)::integer AS scopes,coalesce(sum(generation_count),0)::integer AS generations,
       coalesce(sum(passage_count),0)::integer AS passages
       FROM legislation.legal_search_scopes WHERE scope_kind='publication' AND scope_id=ANY($1::uuid[])`,
      [observationIds]
    )
  ])
  const sourceAudit = z.object({ acknowledged: z.int(), passages: z.int() }).parse(canonical.rows[0])
  const targetAudit = z.object({ scopes: z.int(), generations: z.int(), passages: z.int() }).parse(projected.rows[0])
  if (values.apply === true) {
    invariant(
      sourceAudit.acknowledged === preparations.length &&
        targetAudit.scopes === preparations.length &&
        targetAudit.generations === preparations.reduce((sum, item) => sum + item.expected_count, 0) &&
        targetAudit.passages === sourceAudit.passages,
      "fr_lexical_pilot_projection_mismatch"
    )
  }

  const report = {
    contract: "fr-publication-lexical-pilot-2026-09-18",
    observedAt: new Date().toISOString(),
    mode: values.apply === true ? "applied" : "preview",
    sourceDatabase: "local-disposable-regulations_test",
    targetDatabase: "local-isolated-legislation_passage_search",
    generationId,
    model,
    tokenizerPattern,
    preparations: preparations.length,
    pendingOutboxBefore: expected.rows[0]?.pending_outbox,
    source: sourceAudit,
    target: targetAudit,
    results,
    embeddingModelSelected: false,
    vectorWrites: false,
    recurringIngestionEnabled: false
  }
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" })
  process.stdout.write(`${JSON.stringify({ output, source: sourceAudit, target: targetAudit })}\n`)
} finally {
  await Promise.allSettled([source.end(), target.end()])
}
