import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { parseArgs } from "node:util"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { inspectLegalEmbeddingGeneration } from "../../src/ingestion/regulations/vector-status.js"

const { values } = parseArgs({
  options: {
    generation: { type: "string" },
    output: { type: "string" }
  }
})
const generationId = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .parse(values.generation)
const connectionString = z.url().parse(process.env.PASSAGE_SEARCH_DATABASE_URL)
const target = new URL(connectionString)
invariant(
  ["postgres:", "postgresql:"].includes(target.protocol) && target.pathname === "/legislation_passage_search",
  "vector_inspection_requires_search_database"
)
const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  options: "-c default_transaction_read_only=on -c statement_timeout=30000"
})
try {
  const report = await inspectLegalEmbeddingGeneration(pool, generationId)
  const json = `${JSON.stringify(report, null, 2)}\n`
  if (values.output === undefined) {
    process.stdout.write(json)
  } else {
    const output = resolve(values.output)
    await mkdir(dirname(output), { recursive: true })
    await writeFile(output, json, { encoding: "utf8", flag: "wx" })
    process.stdout.write(`${output}\n`)
  }
} finally {
  await pool.end()
}
