import { parseArgs } from "node:util"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import {
  inspectLegalPreparationStatus,
  legalPreparationStatusRequestSchema
} from "../../src/ingestion/regulations/preparation-status.js"

/** The current command inspects preparation checkpoints only; broader stage reconciliation remains separate work. */
async function main() {
  const { values } = parseArgs({
    options: {
      preparation: { type: "string" },
      after: { type: "string" },
      limit: { type: "string" }
    }
  })
  const request = legalPreparationStatusRequestSchema.parse({
    preparationId: values.preparation,
    afterOrdinal: values.after === undefined ? -1 : z.coerce.number().int().parse(values.after),
    limit: values.limit === undefined ? 25 : z.coerce.number().int().parse(values.limit)
  })
  const url = new URL(z.url().parse(process.env.DATABASE_URL))
  invariant(
    ["postgres:", "postgresql:"].includes(url.protocol) &&
      url.pathname !== "/" &&
      url.pathname !== "/legislation_passage_search",
    "legal_preparation_wrong_database"
  )
  const pool = new pg.Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 10_000 })
  try {
    const report = await inspectLegalPreparationStatus(pool, request)
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    const { blocked, unattempted, missing, unexpected } = report.counts
    if (
      report.checkpointState !== "prepared" ||
      blocked + unattempted + missing + unexpected > 0 ||
      report.lease.active ||
      report.retry.delayed
    ) {
      process.exitCode = 1
    }
  } finally {
    await pool.end()
  }
}
try {
  await main()
} catch (error) {
  const message = error instanceof Error ? error.message.replace(/^Invariant failed: /, "") : ""
  const reason = /^[a-z_]+$/.test(message) ? message : "legal_preparation_inspection_failed"
  process.stderr.write(`${JSON.stringify({ reason })}\n`)
  process.exitCode = 1
}
