import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { LocalArtifactStore } from "../src/ingestion/documents/artifact-store.js"
import { readArchivedScraperAttempt } from "../src/ingestion/openstates/scraper-archive.js"
import { archiveNcBillPlan } from "../src/ingestion/openstates/scraper-batches.js"
import { archiveScraperBillDispatch } from "../src/ingestion/openstates/scraper-dispatch.js"
import { createScraperDockerAdapter, getLocalDockerRuntimeId } from "../src/ingestion/openstates/scraper-docker.js"

const [imageId, retainedFeedDirectory, archiveDirectory] = process.argv.slice(2)
if (!imageId || !retainedFeedDirectory || !archiveDirectory) {
  throw new Error(
    "Usage: smoke-openstates-docker <sha256:image-id> <retained-feed-directory> <local-archive-directory>"
  )
}
// Reuse retained discovery solely as an offline failure fixture, never as a claim of fresh source coverage.
const store = new LocalArtifactStore(archiveDirectory)
const runId = `offline-${randomUUID()}`
const { plan, path } = await archiveNcBillPlan(
  store,
  {
    H: await readFile(join(retainedFeedDirectory, "H.xml"), "utf8"),
    S: await readFile(join(retainedFeedDirectory, "S.xml"), "utf8")
  },
  runId
)
const batch = plan.batches[0]
assert.ok(batch)
const issuedAt = new Date()
const { path: dispatchPath } = await archiveScraperBillDispatch(store, {
  planPath: path,
  batchId: batch.id,
  runId,
  issuedAt,
  expiresAt: new Date(issuedAt.getTime() + 1800 * 1000)
})
const result = await createScraperDockerAdapter({ store, imageId, network: "none" })({
  runId,
  dispatchPath,
  billIds: batch.billIds,
  maxDurationSeconds: 30,
  runtimeId: await getLocalDockerRuntimeId()
})
const archived = await readArchivedScraperAttempt(store, result.manifestPath)
assert.notEqual(archived.attempt.status, "extracted", "Network-disabled extraction must not claim source success")
assert.equal(archived.attempt.canonical_writes, false)
process.stdout.write(
  `${JSON.stringify({
    ...result,
    status: archived.attempt.status,
    reason: archived.attempt.reason,
    containerRemovalVerified: true,
    network: "none",
    canonicalWrites: false,
    liveScrapeVerified: false
  })}\n`
)
