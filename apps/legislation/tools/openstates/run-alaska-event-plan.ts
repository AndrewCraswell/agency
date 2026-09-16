import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { hostname } from "node:os"
import { promisify } from "node:util"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { createDatabase } from "../../src/db/database.js"
import { claimBillBatchOwnership, releaseBillBatchOwnership } from "../../src/db/queries/bill-batch-ownership.js"
import { upsertEventSnapshots } from "../../src/db/queries/events.js"
import { syncCheckpoints } from "../../src/db/schema/schema.js"
import { LocalArtifactStore } from "../../src/ingestion/documents/artifact-store.js"
import { extractAlaskaEventsDocker, getLocalDockerRuntimeId } from "../../src/ingestion/openstates/scraper-docker.js"
import { prepareAlaskaEventBatch } from "../../src/ingestion/openstates/scraper-event-batch.js"
import { ScraperWorkerStopUnconfirmedError } from "../../src/ingestion/openstates/scraper-worker-error.js"

const [sourcePath, planPath, archiveDirectory, imageId, buildInput, limit = "1"] = process.argv.slice(2)
if (!sourcePath || !planPath || !archiveDirectory || !imageId || !buildInput) {
  throw new Error(
    "Expected source XML, frozen plan, archive directory, image digest, build digest and optional batch limit"
  )
}
const maximum = z.coerce.number().int().min(1).max(1000).parse(limit)
z.string()
  .regex(/^sha256:[a-f0-9]{64}$/)
  .parse(imageId)
const approvedBuilds = z
  .array(z.string().regex(/^[a-f0-9]{64}$/))
  .min(1)
  .parse(buildInput.split(","))
const build = approvedBuilds[0]!
await promisify(execFile)("python", ["python/plan_alaska_events.py", sourcePath, planPath, "--verify"], {
  timeout: 30000,
  windowsHide: true,
  maxBuffer: 1024 * 1024
})
const plan = z
  .object({
    source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    batches: z.array(
      z.object({ id: z.string().regex(/^[a-f0-9]{64}$/), event_keys: z.array(z.string()).min(1).max(10) })
    )
  })
  .parse(JSON.parse(await readFile(planPath, "utf8")))
const store = new LocalArtifactStore(archiveDirectory)
const runtimeId = await getLocalDockerRuntimeId()
const { database, pool } = createDatabase({
  url: "postgresql://legislation:legislation@127.0.0.1:55432/legislation_test",
  maxConnections: 2,
  connectionTimeoutMs: 5000,
  idleTimeoutMs: 10000
})
let completed = 0
try {
  for (const batch of plan.batches) {
    const stream = `ak-events:34:${plan.source_sha256}:${batch.id}`
    const exists = async () => {
      const [previous] = await database
        .select()
        .from(syncCheckpoints)
        .where(and(eq(syncCheckpoints.source, "openstates"), eq(syncCheckpoints.stream, stream)))
      if (!previous) {
        return false
      }
      const cursor = previous.cursor
      if (
        cursor.status !== "promoted" ||
        cursor.inventoryId !== plan.source_sha256 ||
        cursor.batchId !== batch.id ||
        !approvedBuilds.includes(String(cursor.build)) ||
        cursor.events !== batch.event_keys.length
      ) {
        throw new Error("Frozen event batch has an incompatible receipt")
      }
      return true
    }
    if (await exists()) {
      continue
    }
    if (completed >= maximum) {
      break
    }
    const runId = `ak-event-${randomUUID()}`
    const group = { stream: "ownership:ak-events:34", cohort: plan.source_sha256 }
    const owner = { source: "openstates", stream: `${group.stream}:${group.cohort}:${batch.id}`, token: runId }
    const claimed = await claimBillBatchOwnership(database, owner, 1800, {
      requireConfirmedRelease: true,
      group,
      executor: { host: hostname(), pid: process.pid, runtimeId }
    })
    if (!claimed) {
      throw new Error("Duplicate event worker ownership")
    }
    let stopped = true
    try {
      if (await exists()) {
        continue
      }
      const dispatchPath = `openstates/event-dispatches/${runId}.json`
      await store.put(
        dispatchPath,
        Buffer.from(JSON.stringify({ sourcePath, planPath, batch, build, imageId, runtimeId, runId }))
      )
      const archive = await extractAlaskaEventsDocker(
        { store, imageId, network: "bridge" },
        {
          runId,
          runtimeId,
          maxDurationSeconds: 300,
          eventKeys: batch.event_keys
        }
      )
      const prepared = await prepareAlaskaEventBatch(store, archive.manifestPath, build, new Date())
      if (
        JSON.stringify(prepared.snapshots.map((item) => item.event.sourceId).sort()) !==
        JSON.stringify([...batch.event_keys].sort())
      ) {
        throw new Error("Extraction does not match frozen event batch")
      }
      await upsertEventSnapshots(database, prepared.snapshots, {
        ownership: owner,
        receipt: {
          source: "openstates",
          stream,
          cursor: {
            status: "promoted",
            manifestPath: archive.manifestPath,
            dispatchPath,
            build,
            events: prepared.snapshots.length,
            inventoryId: plan.source_sha256,
            batchId: batch.id
          }
        }
      })
      completed++
      process.stdout.write(
        JSON.stringify({
          status: "promoted",
          batchId: batch.id,
          events: prepared.snapshots.length,
          completed,
          productionWrites: false
        }) + "\n"
      )
    } catch (error) {
      stopped = !(error instanceof ScraperWorkerStopUnconfirmedError)
      throw error
    } finally {
      if (stopped) {
        await releaseBillBatchOwnership(database, owner)
      }
    }
  }
} finally {
  await pool.end()
}
