import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { parseArgs } from "node:util"
import { configuredRegulatoryEmbeddingRoute } from "@repo/legislation-core/embeddings/embedding-routing"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { planLegalEmbeddingGeneration } from "../../src/ingestion/regulations/vector-plan.js"

const { values } = parseArgs({
  options: { generation: { type: "string" }, output: { type: "string" } }
})
const passageGenerationId = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .parse(values.generation)
const output = resolve(z.string().min(1).parse(values.output))
const route = configuredRegulatoryEmbeddingRoute(process.env.REGULATORY_EMBEDDING_MODEL)
invariant(route, "REGULATORY_EMBEDDING_MODEL is required for regulatory vector planning")
const connectionString = z.url().parse(process.env.PASSAGE_SEARCH_DATABASE_URL)
const target = new URL(connectionString)
invariant(target.pathname === "/legislation_passage_search", "vector_plan_requires_search_database")
const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  options: "-c default_transaction_read_only=on -c statement_timeout=60000"
})
try {
  const plan = await planLegalEmbeddingGeneration(pool, passageGenerationId, route.model)
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(plan, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
  process.stdout.write(`${output}\n`)
} finally {
  await pool.end()
}
