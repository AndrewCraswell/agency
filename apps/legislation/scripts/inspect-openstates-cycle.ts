import { createDatabase } from "../src/db/database.js"
import { LocalArtifactStore } from "../src/ingestion/documents/artifact-store.js"
import { inspectScraperBillCycle } from "../src/ingestion/openstates/scraper-cycle.js"

const [archiveDirectory, planPath] = process.argv.slice(2)
const url = process.env.LEGISLATION_TEST_DATABASE_URL
if (!archiveDirectory || !planPath || !url) {
  throw new Error(
    "Usage: inspect-openstates-cycle <local-archive-directory> <plan-path>; requires LEGISLATION_TEST_DATABASE_URL"
  )
}
const target = new URL(url)
if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.pathname !== "/legislation_test") {
  throw new Error("Cycle inspection requires local legislation_test")
}
const { database, pool } = createDatabase({ url, maxConnections: 1, connectionTimeoutMs: 5000, idleTimeoutMs: 10_000 })
try {
  const state = await inspectScraperBillCycle(database, new LocalArtifactStore(archiveDirectory), planPath)
  const { pending, ...summary } = state
  process.stdout.write(
    `${JSON.stringify({ ...summary, pendingBatches: pending.length, nextBatch: pending[0] ?? null, readOnly: true })}\n`
  )
} finally {
  await pool.end()
}
