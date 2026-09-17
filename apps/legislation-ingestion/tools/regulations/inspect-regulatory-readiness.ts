import { parseArgs } from "node:util"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import {
  inspectLegalPreparationStatus,
  legalPreparationStatusRequestSchema
} from "../../src/ingestion/regulations/preparation-status.js"
import {
  inspectLegalPreparationWaveCompletion,
  legalPreparationWaveCompletionSchema
} from "../../src/ingestion/regulations/preparation-wave-completion.js"

/** Read-only preparation checkpoint or planned-wave completion inspection. */
async function main() {
  const { values } = parseArgs({
    options: {
      preparation: { type: "string" },
      wave: { type: "string" },
      after: { type: "string" },
      limit: { type: "string" }
    }
  })
  const request = z
    .union([
      z.strictObject({
        kind: z.literal("preparation"),
        value: legalPreparationStatusRequestSchema
      }),
      z.strictObject({ kind: z.literal("wave"), value: legalPreparationWaveCompletionSchema })
    ])
    .parse(
      values.preparation !== undefined && values.wave === undefined
        ? {
            kind: "preparation",
            value: {
              preparationId: values.preparation,
              afterOrdinal: values.after === undefined ? -1 : z.coerce.number().int().parse(values.after),
              limit: values.limit === undefined ? 25 : z.coerce.number().int().parse(values.limit)
            }
          }
        : values.wave !== undefined &&
            values.preparation === undefined &&
            values.after === undefined &&
            values.limit === undefined
          ? { kind: "wave", value: { waveId: values.wave } }
          : { kind: "invalid" }
    )
  const url = new URL(z.url().parse(process.env.DATABASE_URL))
  invariant(
    ["postgres:", "postgresql:"].includes(url.protocol) &&
      url.pathname !== "/" &&
      url.pathname !== "/legislation_passage_search",
    "legal_preparation_wrong_database"
  )
  const pool = new pg.Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 10_000 })
  try {
    if (request.kind === "wave") {
      const report = await inspectLegalPreparationWaveCompletion(pool, request.value)
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
      if (!report.ready) process.exitCode = 1
      return
    }
    const report = await inspectLegalPreparationStatus(pool, request.value)
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
