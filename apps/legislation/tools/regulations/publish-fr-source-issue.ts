import { writeFile } from "node:fs/promises"
import { parseArgs } from "node:util"
import pg from "pg"
import { z } from "zod"
import {
  loadReviewedFrSourceIssue,
  publishReviewedFrSourceIssue
} from "../../src/ingestion/regulations/fr-source-publication.js"
import { claimRegulatoryLease, releaseRegulatoryLease } from "../../src/ingestion/regulations/storage.js"

const { values } = parseArgs({
  options: {
    generation: { type: "string" },
    metadata: { type: "string" },
    date: { type: "string" },
    html: { type: "string" },
    pdf: { type: "string" },
    validation: { type: "string" },
    "issue-pdf": { type: "string" },
    regions: { type: "string" },
    output: { type: "string" },
    apply: { type: "boolean", default: false }
  }
})
if (!values.apply) {
  process.stdout.write(JSON.stringify({ mode: "preview", atomicSourceIssuePublication: true }))
} else {
  const connectionString = z.url().parse(process.env.REGULATORY_TEST_DATABASE_URL)
  const url = new URL(connectionString)
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.pathname !== "/regulations_test") {
    throw new Error("local_disposable_database_required")
  }
  const required = (value: unknown) => z.string().min(1).parse(value)
  const generation = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(values.generation)
  const output = required(values.output)
  const data = await loadReviewedFrSourceIssue({
    metadata: required(values.metadata),
    date: required(values.date),
    html: required(values.html),
    pdf: required(values.pdf),
    validation: required(values.validation),
    issuePdf: required(values["issue-pdf"]),
    regions: required(values.regions)
  })
  const pool = new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 10000 })
  try {
    const lease = await claimRegulatoryLease(pool, generation)
    try {
      const report = await publishReviewedFrSourceIssue(pool, lease, data)
      await writeFile(output, JSON.stringify(report, null, 2), { flag: "wx" })
      process.stdout.write(JSON.stringify(report))
    } finally {
      await releaseRegulatoryLease(pool, lease)
    }
  } finally {
    await pool.end()
  }
}
