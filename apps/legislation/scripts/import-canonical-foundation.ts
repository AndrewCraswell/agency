import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { loadConfig } from "../src/config/config.js"
import { createDatabase } from "../src/db/database.js"
import { importCanonicalFoundationRecords } from "../src/ingestion/canonical-foundation.js"

const snapshotArgument = process.argv[2]?.trim()
const streamArgument = process.argv[3]?.trim()

if (snapshotArgument === undefined || snapshotArgument.length === 0) {
  throw new Error("Usage: pnpm foundation:import -- <snapshot.json> [checkpoint-stream]")
}
if (process.argv.length > 4) {
  throw new Error("foundation:import accepts one snapshot path and an optional checkpoint stream")
}

const snapshotPath = resolve(snapshotArgument)
const snapshotBytes = await readFile(snapshotPath)
const parsed: unknown = JSON.parse(snapshotBytes.toString("utf8"))
if (!Array.isArray(parsed)) {
  throw new Error("Canonical foundation snapshot must be a JSON array")
}

const contentHash = createHash("sha256").update(snapshotBytes).digest("hex")
const config = loadConfig()
const { database, pool } = createDatabase({ ...config.database, maxConnections: 1 })

try {
  const result = await importCanonicalFoundationRecords(database, parsed, {
    contentHash,
    ...(streamArgument === undefined || streamArgument.length === 0 ? {} : { stream: streamArgument })
  })
  let status: "failed" | "processed_partial" | "succeeded" = "processed_partial"
  if (result.failures.length > 0) {
    status = "failed"
  } else if (result.audit.complete) {
    status = "succeeded"
  }
  process.stdout.write(
    `${JSON.stringify({
      audit: {
        complete: result.audit.complete,
        incompleteJurisdictionCount: result.audit.incompleteJurisdictionIds.length,
        incompleteSessionCount: result.audit.incompleteSessionIds.length
      },
      checkpoint: result.checkpoint,
      contentHash,
      counts: result.counts,
      failures: result.failures,
      snapshotPath,
      status
    })}\n`
  )
  if (result.failures.length > 0) {
    process.exitCode = 1
  }
} finally {
  await pool.end()
}
