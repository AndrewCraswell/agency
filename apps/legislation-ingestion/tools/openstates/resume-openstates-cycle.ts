import { createDatabase } from "@repo/legislation-core/database/database"
import { LocalArtifactStore } from "../../src/ingestion/documents/artifact-store.js"
import { processScraperBillCycle } from "../../src/ingestion/openstates/scraper-cycle-runner.js"
import { createScraperDockerAdapter, getLocalDockerRuntimeId } from "../../src/ingestion/openstates/scraper-docker.js"

const [
  imageId,
  approvedBuildInputsSha256,
  archiveDirectory,
  planPath,
  maxBatches = "1",
  budgetSeconds = "3600",
  concurrency = "1"
] = process.argv.slice(2)
const url = process.env.LEGISLATION_TEST_DATABASE_URL
if (!imageId || !approvedBuildInputsSha256 || !archiveDirectory || !planPath || !url) {
  throw new Error(
    "Usage: resume-openstates-cycle <sha256:image-id> <approved-build-sha256> <archive-directory> <plan-path> [max-batches] [admission-budget-seconds] [concurrency]; requires LEGISLATION_TEST_DATABASE_URL"
  )
}
const target = new URL(url)
if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.pathname !== "/legislation_test") {
  throw new Error("Cycle resume requires local legislation_test")
}
const store = new LocalArtifactStore(archiveDirectory)
const { database, pool } = createDatabase({ url, maxConnections: 10, connectionTimeoutMs: 5000, idleTimeoutMs: 10_000 })
try {
  const result = await processScraperBillCycle(database, {
    store,
    planPath,
    approvedBuildInputsSha256,
    runtimeId: await getLocalDockerRuntimeId(),
    maxBatches: Number(maxBatches),
    admissionBudgetSeconds: Number(budgetSeconds),
    concurrency: Number(concurrency),
    extractAndArchive: createScraperDockerAdapter({ store, imageId, network: "bridge" }),
    onProgress: async (step) => {
      process.stdout.write(
        `${JSON.stringify({ event: "cycle_step", status: step.status, batchId: step.batchId, promotedBills: step.state.promotedBills, pendingBatches: step.state.pending.length, productionWrites: false })}\n`
      )
    }
  })
  const { pending, ...summary } = result.state
  process.stdout.write(
    `${JSON.stringify({ reason: result.reason, completedSteps: result.completedSteps, ...summary, pendingBatches: pending.length, nextBatch: pending[0] ?? null, productionWrites: false })}\n`
  )
} finally {
  await pool.end()
}
