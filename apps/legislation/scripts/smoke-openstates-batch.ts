import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"
import { createDatabase } from "../src/db/database.js"
import { bills, syncCheckpoints } from "../src/db/schema/schema.js"
import { LocalArtifactStore } from "../src/ingestion/documents/artifact-store.js"
import { RetryingHttpClient, readBounded } from "../src/ingestion/http-client.js"
import { archiveNcBillPlan } from "../src/ingestion/openstates/scraper-batches.js"
import { createScraperDockerAdapter, getLocalDockerRuntimeId } from "../src/ingestion/openstates/scraper-docker.js"
import { executeScraperBillBatch } from "../src/ingestion/openstates/scraper-execution.js"
import { prepareArchivedScraperBillBatch } from "../src/ingestion/openstates/scraper-normalize.js"
import { promoteArchivedScraperBillBatch } from "../src/ingestion/openstates/scraper-promotion.js"

const [imageId, approvedBuildInputsSha256, archiveDirectory] = process.argv.slice(2)
if (!imageId || !approvedBuildInputsSha256 || !archiveDirectory) {
  throw new Error("Usage: smoke-openstates-batch <sha256:image-id> <approved-build-sha256> <local-archive-directory>")
}
const url = process.env.LEGISLATION_TEST_DATABASE_URL
if (!url) {
  throw new Error("LEGISLATION_TEST_DATABASE_URL is required")
}
const target = new URL(url)
if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.pathname !== "/legislation_test") {
  throw new Error("Batch acceptance target must be local legislation_test")
}
const store = new LocalArtifactStore(archiveDirectory)
const client = new RetryingHttpClient({ maxAttempts: 2, requestTimeoutMs: 30_000, minimumIntervalMs: 1000 })
async function feed(chamber: "H" | "S") {
  const response = await client.get(new URL(`https://www.ncleg.gov/Legislation/Bills/FiledBillsFeed/2025/${chamber}`))
  return Buffer.from(await readBounded(response, 16 * 1024 * 1024)).toString("utf8")
}
const runId = `local-${randomUUID()}`
const frozen = await archiveNcBillPlan(store, { H: await feed("H"), S: await feed("S") }, runId)
const batch = frozen.plan.batches[0]
assert.ok(batch)
const { database, pool } = createDatabase({ url, maxConnections: 2, connectionTimeoutMs: 5000, idleTimeoutMs: 10_000 })
try {
  process.stdout.write(
    `${JSON.stringify({ status: "starting", runId, batchId: batch.id, billIds: batch.billIds, productionWrites: false })}\n`
  )
  const result = await executeScraperBillBatch(database, {
    store,
    planPath: frozen.path,
    batchId: batch.id,
    runId,
    approvedBuildInputsSha256,
    runtimeId: await getLocalDockerRuntimeId(),
    extractAndArchive: createScraperDockerAdapter({ store, imageId, network: "bridge" })
  })
  const preparation = {
    store,
    planPath: frozen.path,
    batchId: batch.id,
    approvedBuildInputsSha256,
    manifestPath: result.receipt.cursor.manifestPath,
    dispatchPath: result.receipt.cursor.dispatchPath,
    now: new Date(),
    retrievedAt: new Date()
  }
  const prepared = await prepareArchivedScraperBillBatch(preparation)
  const ids = prepared.rows.map((row) => row.aggregate.bill.id)
  const readBills = () =>
    database.select({ id: bills.id, title: bills.title }).from(bills).where(inArray(bills.id, ids)).orderBy(bills.id)
  const before = await readBills()
  assert.equal(before.length, ids.length)
  const [receipt] = await database
    .select({ cursor: syncCheckpoints.cursor })
    .from(syncCheckpoints)
    .where(and(eq(syncCheckpoints.source, result.receipt.source), eq(syncCheckpoints.stream, result.receipt.stream)))
  assert.deepEqual(receipt?.cursor, result.receipt.cursor)
  // Retry promotion of exactly the same evidence, not a second extraction or a new receipt.
  await promoteArchivedScraperBillBatch(database, preparation)
  assert.deepEqual(await readBills(), before)
  process.stdout.write(
    `${JSON.stringify({
      status: "passed",
      runId,
      manifestPath: preparation.manifestPath,
      promotedBills: ids.length,
      stableReplay: true,
      sessionComplete: false,
      productionWrites: false
    })}\n`
  )
} finally {
  await pool.end()
}
