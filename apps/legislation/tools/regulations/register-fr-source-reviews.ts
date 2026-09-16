import { readFile, writeFile } from "node:fs/promises"
import { parseArgs } from "node:util"
import pg from "pg"
import { z } from "zod"
import { registerFrSourceReviews } from "../../src/ingestion/regulations/fr-source-review.js"
import { claimRegulatoryLease, releaseRegulatoryLease } from "../../src/ingestion/regulations/storage.js"

const { values } = parseArgs({
  options: {
    generation: { type: "string" },
    metadata: { type: "string" },
    pdf: { type: "string" },
    output: { type: "string" },
    apply: { type: "boolean", default: false }
  }
})
if (!values.apply) {
  process.stdout.write(JSON.stringify({ mode: "preview", fieldReviewOnly: true, publicationReady: false }))
} else {
  const connectionString = z.url().parse(process.env.REGULATORY_TEST_DATABASE_URL)
  const url = new URL(connectionString)
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.pathname !== "/regulations_test") {
    throw new Error("local_disposable_database_required")
  }
  const generation = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(values.generation)
  const metadata = JSON.parse(await readFile(z.string().min(1).parse(values.metadata), "utf8"))
  const issuePdfPath = z.string().min(1).parse(values.pdf)
  const output = z.string().min(1).parse(values.output)
  const pool = new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 10000 })
  try {
    const lease = await claimRegulatoryLease(pool, generation)
    try {
      const report = await registerFrSourceReviews(pool, lease, { metadata, issuePdfPath })
      await writeFile(output, JSON.stringify(report, null, 2), { flag: "wx" })
      process.stdout.write(
        JSON.stringify({
          generationId: generation,
          reviewed: report.reviews.length,
          reused: report.reviews.every((row) => row.reused),
          publicationReady: false
        })
      )
    } finally {
      await releaseRegulatoryLease(pool, lease)
    }
  } finally {
    await pool.end()
  }
}
