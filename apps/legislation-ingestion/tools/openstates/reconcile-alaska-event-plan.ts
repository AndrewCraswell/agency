import { createDatabase } from "@repo/legislation-core/database/database"
import { syncCheckpoints } from "@repo/legislation-core/database/schema/schema"
import { and, eq, like } from "drizzle-orm"
import { z } from "zod"
import { LocalArtifactStore } from "../../src/ingestion/documents/artifact-store.js"
import { prepareAlaskaEventBatch } from "../../src/ingestion/openstates/scraper-event-batch.js"
import { reconcileEventSnapshotRelationships } from "../../src/persistence/events.js"

const [directory, inventoryId, approved, mode] = process.argv.slice(2)
if (
  !directory ||
  !inventoryId ||
  !approved ||
  ![undefined, "--refresh-readiness"].includes(mode) ||
  process.argv.length > 6
) {
  throw new Error("Expected archive directory, inventory digest and comma-separated approved build digests")
}
z.string()
  .regex(/^[a-f0-9]{64}$/)
  .parse(inventoryId)
const approvedBuilds = z.array(z.string().regex(/^[a-f0-9]{64}$/)).parse(approved.split(","))
const store = new LocalArtifactStore(directory)
const { database, pool } = createDatabase({
  url: "postgresql://legislation:legislation@127.0.0.1:55432/legislation_test",
  maxConnections: 2,
  connectionTimeoutMs: 5000,
  idleTimeoutMs: 10000
})
try {
  const receipts = await database
    .select()
    .from(syncCheckpoints)
    .where(and(eq(syncCheckpoints.source, "openstates"), like(syncCheckpoints.stream, `ak-events:34:${inventoryId}:%`)))
  let events = 0
  let billLinks = 0
  let organizationLinks = 0
  for (const receipt of receipts) {
    const cursor = z
      .object({
        status: z.literal("promoted"),
        inventoryId: z.literal(inventoryId),
        manifestPath: z.string(),
        build: z.string()
      })
      .parse(receipt.cursor)
    if (!approvedBuilds.includes(cursor.build)) {
      throw new Error("Unapproved archived event build")
    }
    const prepared = await prepareAlaskaEventBatch(store, cursor.manifestPath, cursor.build, new Date())
    const result = await reconcileEventSnapshotRelationships(database, prepared.snapshots, {
      refreshReadiness: mode === "--refresh-readiness"
    })
    events += result.events
    billLinks += result.billLinks
    organizationLinks += result.organizationLinks
  }
  process.stdout.write(
    JSON.stringify({
      batches: receipts.length,
      events,
      billLinks,
      organizationLinks,
      productionWrites: false,
      readinessRefreshed: mode === "--refresh-readiness"
    }) + "\n"
  )
} finally {
  await pool.end()
}
