import { createDatabase } from "@repo/legislation-core/database/database"
import { loadConfig } from "../../src/config/config.js"
import { LocalArtifactStore } from "../../src/ingestion/documents/artifact-store.js"
import { prepareAlaskaEventBatch } from "../../src/ingestion/openstates/scraper-event-batch.js"
import { upsertEventSnapshots } from "../../src/persistence/events.js"

const [directory, manifestPath, approvedBuild, mode] = process.argv.slice(2)
if (!directory || !manifestPath || !approvedBuild || ![undefined, "--apply-local"].includes(mode)) {
  throw new Error(
    "Usage: import-alaska-event-batch <archive-directory> <manifest-path> <approved-build-sha256> [--apply-local]"
  )
}
const store = new LocalArtifactStore(directory)
const result = await prepareAlaskaEventBatch(store, manifestPath, approvedBuild, new Date())
const manifestSha256 = createHash("sha256")
  .update(await store.read(manifestPath))
  .digest("hex")
if (mode === "--apply-local") {
  const { database, pool } = createDatabase(
    loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://legislation:legislation@127.0.0.1:55432/legislation_test"
    }).database
  )
  try {
    await upsertEventSnapshots(database, result.snapshots, {
      receipt: {
        source: "openstates",
        stream: `ak-events:34:archive:${manifestPath}`,
        cursor: { status: "promoted", manifestSha256, approvedBuild, events: result.snapshots.length }
      }
    })
  } finally {
    await pool.end()
  }
}
process.stdout.write(
  JSON.stringify({
    events: result.snapshots.length,
    agendas: result.snapshots.reduce((n, item) => n + item.agendaItems.length, 0),
    quarantinedOccurrences: result.quarantinedOccurrences,
    completeSnapshot: false,
    appliedLocally: mode === "--apply-local",
    productionWrites: false
  }) + "\n"
)
import { createHash } from "node:crypto"
