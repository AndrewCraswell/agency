import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import { configuredRegulatoryEmbeddingRoute } from "@repo/legislation-core/embeddings/embedding-routing"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { registerLegalEmbeddingPlan, validateLegalEmbeddingPlan } from "../../src/ingestion/regulations/vector-plan.js"

const { values } = parseArgs({
  options: { apply: { type: "boolean", default: false }, input: { type: "string" } }
})
invariant(values.apply, "vector_plan_registration_requires_apply")
const path = resolve(z.string().min(1).parse(values.input))
const bytes = await readFile(path)
invariant(bytes.length <= 64 * 1024, "vector_plan_file_limit")
const plan = validateLegalEmbeddingPlan(JSON.parse(bytes.toString("utf8")))
const route = configuredRegulatoryEmbeddingRoute(process.env.REGULATORY_EMBEDDING_MODEL)
invariant(route?.model === plan.model, "legal_embedding_configured_model_mismatch")
const connectionString = z.url().parse(process.env.PASSAGE_SEARCH_DATABASE_URL)
const target = new URL(connectionString)
invariant(target.pathname === "/legislation_passage_search", "vector_plan_requires_search_database")
const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 })
try {
  process.stdout.write(`${JSON.stringify(await registerLegalEmbeddingPlan(pool, plan))}\n`)
} finally {
  await pool.end()
}
