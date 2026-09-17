import { createHash, randomUUID } from "node:crypto"
import { hostname } from "node:os"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { syncCheckpoints } from "@repo/legislation-core/database/schema/schema"
import { and, eq, like } from "drizzle-orm"
import { z } from "zod"
import { claimBillBatchOwnership, releaseBillBatchOwnership } from "../../persistence/bill-batch-ownership.js"
import { reconcileEventSnapshotRelationships, upsertEventSnapshots } from "../../persistence/events.js"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { alaskaEventCloudRequest, dispatchCloudScraperAttempt } from "./scraper-cloud.js"
import { prepareAlaskaEventBatch } from "./scraper-event-batch.js"
import { ScraperWorkerStopUnconfirmedError } from "./scraper-worker-error.js"

const digest = z.string().regex(/^[a-f0-9]{64}$/)
const eventKey = z.string().regex(/^[HSJ]:[A-Z0-9&]+:[0-9T:+.-]+$/)
const planSchema = z.strictObject({
  jurisdiction: z.literal("ak"),
  session: z.literal("34"),
  source_sha256: digest,
  partition: z
    .object({
      accepted_occurrences: z.number().int().positive(),
      quarantined: z.array(z.object({ occurrence_key: eventKey }).passthrough())
    })
    .passthrough(),
  batches: z.array(z.strictObject({ id: digest, event_keys: z.array(eventKey).min(1).max(10) })).min(1),
  complete_snapshot: z.literal(false)
})

export type AlaskaEventPlan = z.infer<typeof planSchema>

export function parseAlaskaEventPlan(value: unknown) {
  return planSchema.parse(value)
}

export async function readAlaskaEventPlan(store: Pick<ArtifactStore, "read">, planPath: string) {
  const raw: unknown = JSON.parse(Buffer.from(await store.read(planPath)).toString("utf8"))
  const plan = parseAlaskaEventPlan(raw)
  const selected = plan.batches.flatMap((batch) => batch.event_keys)
  if (selected.length !== plan.partition.accepted_occurrences || new Set(selected).size !== selected.length) {
    throw new Error("Alaska event plan does not exactly partition accepted occurrences")
  }
  const quarantined = new Set(plan.partition.quarantined.map((item) => item.occurrence_key))
  if (selected.some((key) => quarantined.has(key))) {
    throw new Error("Alaska event plan admits a quarantined occurrence")
  }
  for (const batch of plan.batches) {
    const identity = JSON.stringify([plan.source_sha256, batch.event_keys])
    if (createHash("sha256").update(identity).digest("hex") !== batch.id) {
      throw new Error("Alaska event batch identity mismatch")
    }
  }
  return plan
}

function receiptStream(plan: AlaskaEventPlan, batchId: string) {
  return `ak-events:34:${plan.source_sha256}:${batchId}`
}

async function readAlaskaEventReceipt(database: LegislationDatabase, plan: AlaskaEventPlan, batchId: string) {
  const rows = await database
    .select({ cursor: syncCheckpoints.cursor })
    .from(syncCheckpoints)
    .where(and(eq(syncCheckpoints.source, "openstates"), eq(syncCheckpoints.stream, receiptStream(plan, batchId))))
  if (rows.length !== 1) throw new Error("Alaska event batch does not have exactly one promotion receipt")
  return z
    .object({
      status: z.literal("promoted"),
      inventoryId: z.literal(plan.source_sha256),
      batchId: z.literal(batchId),
      manifestPath: z.string(),
      build: digest
    })
    .parse(rows[0]!.cursor)
}

/** Rebuild relationship readiness from immutable promoted evidence after organization foundations change. */
export async function reconcileAlaskaEventCycleBatch(
  database: LegislationDatabase,
  input: {
    store: Pick<ArtifactStore, "read">
    planPath: string
    batchIndex: number
    approvedBuildInputsSha256: string
  },
  dependencies = {
    readPlan: readAlaskaEventPlan,
    readReceipt: readAlaskaEventReceipt,
    prepare: prepareAlaskaEventBatch,
    reconcile: reconcileEventSnapshotRelationships
  }
) {
  const build = digest.parse(input.approvedBuildInputsSha256)
  const plan = await dependencies.readPlan(input.store, input.planPath)
  const batchIndex = z
    .number()
    .int()
    .nonnegative()
    .max(plan.batches.length - 1)
    .parse(input.batchIndex)
  const batch = plan.batches[batchIndex]!
  const receipt = await dependencies.readReceipt(database, plan, batch.id)
  if (receipt.build !== build) throw new Error("Alaska event receipt build is not approved")
  const prepared = await dependencies.prepare(input.store, receipt.manifestPath, build, new Date())
  if (
    JSON.stringify(prepared.snapshots.map((item) => item.event.sourceId).sort()) !==
    JSON.stringify([...batch.event_keys].sort())
  ) {
    throw new Error("Promoted archive does not match frozen Alaska event batch")
  }
  const result = await dependencies.reconcile(database, prepared.snapshots, { refreshReadiness: true })
  return {
    status: "reconciled" as const,
    inventoryId: plan.source_sha256,
    batchId: batch.id,
    batchIndex,
    totalBatches: plan.batches.length,
    ...result
  }
}

export async function inspectAlaskaEventCycle(
  database: LegislationDatabase,
  store: Pick<ArtifactStore, "read">,
  planPath: string
) {
  const plan = await readAlaskaEventPlan(store, planPath)
  const receipts = await database
    .select({ stream: syncCheckpoints.stream, cursor: syncCheckpoints.cursor })
    .from(syncCheckpoints)
    .where(
      and(
        eq(syncCheckpoints.source, "openstates"),
        like(syncCheckpoints.stream, `ak-events:34:${plan.source_sha256}:%`)
      )
    )
  const completed = new Set(
    receipts.map(({ stream, cursor }) => {
      const value = z
        .object({ status: z.literal("promoted"), inventoryId: z.literal(plan.source_sha256), batchId: digest })
        .parse(cursor)
      if (stream !== receiptStream(plan, value.batchId)) throw new Error("Alaska event receipt identity mismatch")
      return value.batchId
    })
  )
  return {
    plan,
    completed: plan.batches.filter((batch) => completed.has(batch.id)),
    pending: plan.batches.filter((batch) => !completed.has(batch.id))
  }
}

export async function executeAlaskaEventCloudBatch(
  database: LegislationDatabase,
  input: {
    store: ArtifactStore
    planPath: string
    batchId: string
    approvedBuildInputsSha256: string
    storageAccount: string
    queueName: string
    runId?: string
  },
  dependencies = {
    inspect: inspectAlaskaEventCycle,
    dispatch: dispatchCloudScraperAttempt,
    claim: claimBillBatchOwnership,
    release: releaseBillBatchOwnership,
    promote: upsertEventSnapshots,
    prepare: prepareAlaskaEventBatch,
    now: () => new Date()
  }
) {
  digest.parse(input.approvedBuildInputsSha256)
  const state = await dependencies.inspect(database, input.store, input.planPath)
  const batch = state.pending.find((candidate) => candidate.id === input.batchId)
  if (!batch) {
    const completed = state.completed.find((candidate) => candidate.id === input.batchId)
    if (completed) {
      return { status: "already_promoted" as const, events: completed.event_keys.length }
    }
    throw new Error("Alaska event batch is not pending in the frozen plan")
  }
  const runId = z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,100}$/)
    .parse(input.runId ?? `ak-event-${randomUUID()}`)
  const group = { stream: "ownership:ak-events:34", cohort: state.plan.source_sha256 }
  const owner = { source: "openstates", stream: `${group.stream}:${group.cohort}:${batch.id}`, token: runId }
  const claimed = await dependencies.claim(database, owner, 1800, {
    requireConfirmedRelease: true,
    group,
    executor: { host: hostname(), pid: process.pid, runtimeId: "azure-container-apps-queue" }
  })
  if (!claimed) throw new Error("Duplicate Alaska event cloud attempt")
  let settled = true
  try {
    const request = alaskaEventCloudRequest(batch.event_keys)
    const archive = await dependencies.dispatch({
      store: input.store,
      runId,
      request,
      storageAccount: input.storageAccount,
      queueName: input.queueName,
      maxWaitSeconds: 1800
    })
    const prepared = await dependencies.prepare(
      input.store,
      archive.manifestPath,
      input.approvedBuildInputsSha256,
      dependencies.now()
    )
    if (
      JSON.stringify(prepared.snapshots.map((item) => item.event.sourceId).sort()) !==
      JSON.stringify([...batch.event_keys].sort())
    ) {
      throw new Error("Cloud extraction does not match frozen Alaska event batch")
    }
    await dependencies.promote(database, prepared.snapshots, {
      ownership: owner,
      receipt: {
        source: "openstates",
        stream: receiptStream(state.plan, batch.id),
        cursor: {
          status: "promoted",
          manifestPath: archive.manifestPath,
          settlementPath: archive.settlementPath,
          build: input.approvedBuildInputsSha256,
          events: prepared.snapshots.length,
          inventoryId: state.plan.source_sha256,
          batchId: batch.id
        }
      }
    })
    return { status: "promoted" as const, events: prepared.snapshots.length, batchId: batch.id, runId }
  } catch (error) {
    settled = !(error instanceof ScraperWorkerStopUnconfirmedError)
    throw error
  } finally {
    if (settled) await dependencies.release(database, owner)
  }
}
