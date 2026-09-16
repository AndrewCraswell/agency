import { open } from "node:fs/promises"
import { parseArgs } from "node:util"
import pg from "pg"
import { z } from "zod"
import { publishAnnualCfrEdition } from "../../src/ingestion/regulations/annual-cfr-publication.js"

const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    year: { type: "string" },
    title: { type: "string" },
    generations: { type: "string" },
    output: { type: "string" },
    apply: { type: "boolean", default: false }
  }
})
if (!values.apply) {
  process.stdout.write(JSON.stringify({ mode: "preview", atomicAnnualTitle: true, recurringIngestionEnabled: false }))
} else {
  const connectionString = z.url().parse(process.env.REGULATORY_TEST_DATABASE_URL)
  const url = new URL(connectionString)
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.pathname !== "/regulations_test") {
    throw new Error("local_disposable_database_required")
  }
  const input = {
    manifestId: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(values.manifest),
    year: z.coerce.number().int().min(1996).max(9999).parse(values.year),
    title: z.coerce.number().int().min(1).max(50).parse(values.title),
    generationIds: z.string().min(1).parse(values.generations).split(",")
  }
  const output = await open(z.string().min(1).parse(values.output), "wx")
  const pool = new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 10000 })
  try {
    const result = await publishAnnualCfrEdition(pool, input)
    await output.writeFile(JSON.stringify(result, null, 2))
    process.stdout.write(JSON.stringify(result))
  } finally {
    await output.close()
    await pool.end()
  }
}
