import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { runLegalPassagePreparationBatch } from "../../src/ingestion/regulations/passage-preparation.js"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const modelSchema = z.enum(["openai/text-embedding-3-small", "voyageai/voyage-4"])
const { values } = parseArgs({
  options: {
    generation: { type: "string" },
    model: { type: "string", multiple: true },
    output: { type: "string" },
    apply: { type: "boolean", default: false }
  }
})
const generationId = hash.parse(values.generation)
const models = z.array(modelSchema).min(1).max(2).parse(values.model)
invariant(new Set(models).size === models.length, "fr_passage_pilot_duplicate_model")
const output = resolve(z.string().min(1).parse(values.output))
const connectionString = z.url().parse(process.env.REGULATORY_TEST_DATABASE_URL)
const target = new URL(connectionString)
invariant(
  ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) && target.pathname === "/regulations_test",
  "local_disposable_database_required"
)

const pool = new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 10_000, statement_timeout: 60_000 })
try {
  const generation = await pool.query<{ state: string; source_id: string }>(
    "SELECT state,source_id FROM legislation.legal_import_generations WHERE id=$1",
    [generationId]
  )
  invariant(
    generation.rows[0]?.state === "published" && generation.rows[0]?.source_id === "govinfo-fr",
    "fr_passage_pilot_generation_not_published"
  )
  const observations = await pool.query<{ id: string; number: string }>(
    `SELECT o.id,d.native_number AS number
     FROM legislation.regulatory_document_observations o
     JOIN legislation.regulatory_documents d ON d.id=o.document_id
     WHERE o.generation_id=$1 ORDER BY d.native_number,o.id`,
    [generationId]
  )
  const inventory = z
    .array(z.object({ id: z.uuid(), number: z.string().min(1) }))
    .min(1)
    .max(1000)
    .parse(observations.rows)
  invariant(new Set(inventory.map(({ id }) => id)).size === inventory.length, "fr_passage_pilot_duplicate_observation")

  const results = []
  if (values.apply === true) {
    for (const model of models) {
      for (const observation of inventory) {
        const prepared = await runLegalPassagePreparationBatch(pool, {
          scope: { kind: "publication", id: observation.id },
          model,
          limit: 1
        })
        invariant(prepared.state === "prepared" && prepared.complete === 1, "fr_passage_pilot_preparation_failed")
        results.push({ model, observationId: observation.id, documentNumber: observation.number, ...prepared })
        process.stdout.write(
          `${JSON.stringify({ model, documentNumber: observation.number, state: prepared.state })}\n`
        )
      }
    }
  }

  const totals = await pool.query<{
    model: string
    preparations: number
    complete: number
    blocked: number
    passages: number
  }>(
    `SELECT CASE
       WHEN p.tokenizer_id LIKE 'tiktoken:%' THEN 'openai/text-embedding-3-small'
       WHEN p.tokenizer_id LIKE 'huggingface-tokenizers:%' THEN 'voyageai/voyage-4'
       ELSE p.tokenizer_id END AS model,
       count(DISTINCT p.id)::integer AS preparations,
       count(DISTINCT i.generation_id)::integer AS complete,
       count(DISTINCT CASE WHEN i.failure_code IS NOT NULL THEN p.id END)::integer AS blocked,
       coalesce(sum(g.passage_count),0)::integer AS passages
     FROM legislation.legal_passage_preparations p
     JOIN legislation.regulatory_document_observations o ON o.id=p.observation_id
     JOIN legislation.legal_passage_preparation_items i ON i.preparation_id=p.id
     LEFT JOIN legislation.legal_passage_generations g ON g.id=i.generation_id
     WHERE o.generation_id=$1 GROUP BY 1 ORDER BY 1`,
    [generationId]
  )
  const report = {
    contract: "fr-publication-passage-pilot-2026-09-17",
    observedAt: new Date().toISOString(),
    mode: values.apply === true ? "applied" : "preview",
    database: "local-disposable-regulations_test",
    generationId,
    observations: inventory.length,
    models,
    totals: totals.rows,
    results,
    providerRequests: false,
    vectorWrites: false,
    modelSelected: false,
    recurringIngestionEnabled: false
  }
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" })
  process.stdout.write(`${JSON.stringify({ output, observations: inventory.length, totals: totals.rows })}\n`)
} finally {
  await pool.end()
}
