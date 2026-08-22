import { idempotencyKeys, logger, queue, task, wait } from "@trigger.dev/sdk"
import { sql } from "drizzle-orm"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { generateCoverageReport } from "../../coverage/report.js"
import { createDatabase, type LegislationDatabase } from "../../db/database.js"
import {
  executeGovInfoHistoricalImport,
  executeOpenStatesArchiveImport,
  listOpenStatesHistoricalArchives
} from "../../ingestion/backfill/backfill.js"
import {
  createDerivedDocumentHostLimiter,
  DERIVED_BACKFILL_KINDS,
  DERIVED_DOCUMENT_BATCH_SIZE,
  DERIVED_DOCUMENT_WORKER_MAX_DURATION_SECONDS,
  DERIVED_SUPPORTING_MATERIAL_BATCH_SIZE,
  EMBEDDING_JOB_KINDS,
  executeDerivedBackfill
} from "../../ingestion/backfill/derived.js"
import { requeueInterruptedDocuments } from "../../ingestion/documents/jobs.js"
import {
  nextSupportingMaterialBackfillAttempt,
  requeueInterruptedSupportingMaterials
} from "../../ingestion/documents/supporting-material-jobs.js"
import { listOcrRequiredSupportingMaterialIds } from "../../ingestion/documents/supporting-material-ocr-jobs.js"
import {
  ingestionJobHandoffRetryAt,
  JobAlreadyRunningError,
  recoverRetriedIngestionJob,
  type JobResult
} from "../../ingestion/job.js"
import { executeSynchronization } from "../../ingestion/synchronization/synchronize.js"
import { validateCorpus } from "../../validation/corpus.js"
import {
  backfillControllerPayloadSchema,
  backfillExecutionPolicy,
  backfillIdempotencyKey,
  backfillPhases,
  createBackfillUnits,
  derivedBackfillShardCountFor,
  type BackfillPhase
} from "../backfill-contract.js"
import { parseSynchronizationIdentity } from "../identities.js"
import { congressWaveCoordinator } from "./congress-wave-coordinator.js"
import { reconcileDerivedShardBatch, runDerivedShardLoop } from "./derived-controller.js"
import { ocrDocumentWorker } from "./ocr-tasks.js"

const openStatesHistoryQueue = queue({ concurrencyLimit: 8, name: "legislation-openstates-history-backfill" })
const historyQueue = queue({ concurrencyLimit: 3, name: "legislation-history-backfill" })
const federalHistoryQueue = queue({ concurrencyLimit: 2, name: "legislation-federal-history-backfill" })
const derivedQueue = queue({
  // Documents use the bounded 64-lane jurisdiction drain. Four concurrent
  // 16-shard embedding products deliberately fill this queue during the
  // approved bulk pass; every worker retains a one-connection database pool.
  concurrencyLimit: backfillExecutionPolicy.derivedQueueConcurrencyLimit,
  name: "legislation-derived-backfill"
})
// Coordinators wait for child runs on the separate derived-worker queue. Keep
// them off that queue so no active coordinator can occupy a worker slot before
// it checkpoints at its child waitpoint.
const derivedShardControllerQueue = queue({
  concurrencyLimit: backfillExecutionPolicy.derivedShardControllerQueueConcurrencyLimit,
  name: "legislation-derived-shard-controller"
})
const materialPhaseGatePollIntervalMs = 15 * 60_000

export interface MaterialPhaseGateState extends Record<string, unknown> {
  ocrRequiredDocuments: number
  pendingDocuments: number
  processingDocuments: number
  retryableFailedDocuments: number
}

export function isMaterialPhaseGateOpen(state: MaterialPhaseGateState): boolean {
  return (
    state.pendingDocuments === 0 &&
    state.processingDocuments === 0 &&
    state.retryableFailedDocuments === 0 &&
    state.ocrRequiredDocuments === 0
  )
}

export function derivedWorkerMaxBatchesFor(kind: (typeof DERIVED_BACKFILL_KINDS)[number]): number {
  if (kind === "bill-documents") {
    return 1
  }
  if (kind === "supporting-materials") {
    // PDF extraction is serialized per worker, and PDFs above the local page
    // limit are handed to managed OCR. Keep each child to one bounded batch so
    // failures and deferrals return promptly to the shard controller.
    return 1
  }
  return 10
}

export function derivedDatabaseConnectionsFor(kind: (typeof DERIVED_BACKFILL_KINDS)[number]): number {
  return kind === "supporting-materials" ? 2 : 1
}

export function derivedBatchSizeFor(kind: (typeof DERIVED_BACKFILL_KINDS)[number]): number | undefined {
  if (kind === "bill-documents") {
    return DERIVED_DOCUMENT_BATCH_SIZE
  }
  return kind === "supporting-materials" ? DERIVED_SUPPORTING_MATERIAL_BATCH_SIZE : undefined
}

const baseWorkerSchema = z.object({
  correlationId: z.string().trim().min(1).max(500),
  rebuildId: z.string().trim().min(1).max(200)
})
const openStatesHistoryPayloadSchema = baseWorkerSchema
  .extend({
    jurisdiction: z.string().trim().min(2).max(3),
    session: z.string().trim().min(1).max(500),
    stream: z.string().trim().min(1).max(600),
    url: z.url({ protocol: /^https$/ })
  })
  .strict()
const govInfoHistoryPayloadSchema = baseWorkerSchema
  .extend({
    billTypes: z.array(z.string().trim().min(1).max(20)).min(1),
    endCongress: z.number().int().positive(),
    startCongress: z.number().int().positive()
  })
  .strict()
const currentCatchupPayloadSchema = baseWorkerSchema
  .extend({
    identity: z.string().trim().min(1).max(200)
  })
  .strict()
export const derivedPayloadSchema = baseWorkerSchema
  .extend({
    batchSize: z.number().int().positive().max(1_000).optional(),
    documentPartitionCount: z.number().int().positive().max(8).optional(),
    documentPartitionIndex: z.number().int().nonnegative().max(7).optional(),
    embeddingProducts: z.array(z.enum(EMBEDDING_JOB_KINDS)).min(1).optional(),
    jurisdictionId: z.string().trim().min(1).max(200).optional(),
    kind: z.enum(DERIVED_BACKFILL_KINDS),
    maxBatches: z.number().int().positive().max(100).default(10),
    shardCount: z.number().int().positive().max(backfillExecutionPolicy.documentBackfillShardCount).default(1),
    shardIndex: z
      .number()
      .int()
      .nonnegative()
      .max(backfillExecutionPolicy.documentBackfillShardCount - 1)
      .default(0)
  })
  .strict()
  .superRefine((payload, context) => {
    const maximumShardCount = derivedBackfillShardCountFor(payload.kind)
    if (payload.shardCount > maximumShardCount) {
      context.addIssue({
        code: "custom",
        message: `${payload.kind} supports at most ${maximumShardCount} backfill shards`,
        path: ["shardCount"]
      })
    }
    if (payload.shardIndex >= payload.shardCount) {
      context.addIssue({
        code: "custom",
        message: "shardIndex must be less than shardCount",
        path: ["shardIndex"]
      })
    }
    const partitionsConfigured =
      payload.documentPartitionCount !== undefined || payload.documentPartitionIndex !== undefined
    if (payload.jurisdictionId !== undefined && payload.kind !== "bill-documents") {
      context.addIssue({
        code: "custom",
        message: "jurisdictionId is supported only for bill-document backfills",
        path: ["jurisdictionId"]
      })
    }
    if (payload.embeddingProducts !== undefined && payload.kind !== "embeddings") {
      context.addIssue({
        code: "custom",
        message: "embeddingProducts is supported only for embedding backfills",
        path: ["embeddingProducts"]
      })
    }
    if (partitionsConfigured && payload.kind !== "bill-documents") {
      context.addIssue({
        code: "custom",
        message: "Document partitioning is supported only for bill-document backfills",
        path: ["documentPartitionCount"]
      })
    }
    if (payload.documentPartitionCount === undefined || payload.documentPartitionIndex === undefined) {
      if (partitionsConfigured) {
        context.addIssue({
          code: "custom",
          message: "documentPartitionCount and documentPartitionIndex must be configured together",
          path: ["documentPartitionCount"]
        })
      }
    } else {
      if (payload.jurisdictionId === undefined) {
        context.addIssue({
          code: "custom",
          message: "Document partitioning requires an exact jurisdictionId",
          path: ["jurisdictionId"]
        })
      }
      if (payload.documentPartitionIndex >= payload.documentPartitionCount) {
        context.addIssue({
          code: "custom",
          message: "documentPartitionIndex must be less than documentPartitionCount",
          path: ["documentPartitionIndex"]
        })
      }
    }
  })
const derivedShardControllerPayloadSchema = derivedPayloadSchema
  .extend({
    maxContinuations: z.number().int().positive().max(1_000).default(1_000)
  })
  .strict()
const validationPayloadSchema = baseWorkerSchema.strict()
const embeddingSyncPayloadSchema = baseWorkerSchema
  .extend({
    maxContinuations: z.number().int().positive().max(1_000).default(1_000),
    products: z
      .array(z.enum(EMBEDDING_JOB_KINDS))
      .min(1)
      .default([...EMBEDDING_JOB_KINDS]),
    shardCount: z.number().int().positive().max(16).default(derivedBackfillShardCountFor("embeddings"))
  })
  .strict()
  .superRefine((payload, context) => {
    const maximum = derivedBackfillShardCountFor("embeddings")
    if (payload.shardCount > maximum) {
      context.addIssue({
        code: "custom",
        message: `Embedding sync supports at most ${maximum} shards`,
        path: ["shardCount"]
      })
    }
  })
const embeddingShardPayloadSchema = embeddingSyncPayloadSchema
  .extend({ shardIndex: z.number().int().nonnegative().max(15) })
  .strict()
  .superRefine((payload, context) => {
    if (payload.shardIndex >= payload.shardCount) {
      context.addIssue({ code: "custom", message: "shardIndex must be less than shardCount", path: ["shardIndex"] })
    }
  })

export function createDerivedLeaseHandoffResult(
  payload: Pick<z.output<typeof derivedPayloadSchema>, "kind" | "shardCount" | "shardIndex">,
  retryAt: Date
) {
  return {
    checkpoint: { complete: false, handoff: "ingestion-lease", nextAttemptAt: retryAt.toISOString() },
    kind: payload.kind,
    shard: { shardCount: payload.shardCount, shardIndex: payload.shardIndex },
    status: "waiting-for-lease" as const
  }
}

export const openStatesHistoryBackfill = task({
  id: "backfill-openstates-history",
  // Each worker owns one historical archive stream. The queue fans out
  // independent streams without multiplying a worker's peak memory.
  machine: "medium-2x",
  maxDuration: 14_400,
  queue: openStatesHistoryQueue,
  retry: {
    outOfMemory: { machine: "large-1x" }
  },
  run: async (unparsedPayload: unknown, { ctx }) => {
    const payload = openStatesHistoryPayloadSchema.parse(unparsedPayload)
    return withDatabase(async (database) =>
      requireSuccessfulJobResult(
        await executeOpenStatesArchiveImport({
          archive: {
            jurisdictionCode: payload.jurisdiction,
            session: payload.session,
            stream: payload.stream,
            url: new URL(payload.url)
          },
          config: loadConfig(),
          correlationId: payload.correlationId,
          database,
          workflowExecutionId: ctx.run.id
        })
      )
    )
  }
})

export const govInfoHistoryBackfill = task({
  id: "backfill-govinfo-history",
  maxDuration: 3_600,
  queue: federalHistoryQueue,
  run: async (unparsedPayload: unknown, { ctx }) => {
    const payload = govInfoHistoryPayloadSchema.parse(unparsedPayload)
    return withDatabase(async (database) =>
      requireSuccessfulJobResult(
        await executeGovInfoHistoricalImport({
          billTypes: payload.billTypes,
          config: loadConfig(),
          correlationId: payload.correlationId,
          database,
          endCongress: payload.endCongress,
          startCongress: payload.startCongress,
          workflowExecutionId: ctx.run.id
        })
      )
    )
  }
})

export const currentCatchupBackfill = task({
  id: "backfill-current-catchup",
  maxDuration: 3_600,
  queue: historyQueue,
  run: async (unparsedPayload: unknown, { ctx }) => {
    const payload = currentCatchupPayloadSchema.parse(unparsedPayload)
    return withDatabase(async (database) =>
      requireSuccessfulJobResult(
        await executeSynchronization({
          config: loadConfig(),
          correlationId: payload.correlationId,
          database,
          identity: parseSynchronizationIdentity(payload.identity),
          workflowExecutionId: ctx.run.id
        })
      )
    )
  }
})

export const derivedCorpusBackfill = task({
  id: "backfill-derived-corpus",
  // A bounded 100-document continuation fits within this window even when a
  // publisher takes the full per-request timeout. The recovery delay in the
  // derived drain uses this same duration before reclaiming killed work.
  maxDuration: DERIVED_DOCUMENT_WORKER_MAX_DURATION_SECONDS,
  queue: derivedQueue,
  // PDF.js can still encounter an unusually complex but policy-compliant PDF.
  // Keep the normal worker economical and replay only an OOM continuation on
  // a larger machine; the controller's idempotency key and durable lease make
  // that replay safe.
  retry: {
    outOfMemory: { machine: "large-1x" }
  },
  run: async (unparsedPayload: unknown, { ctx }) => {
    const payload = derivedPayloadSchema.parse(unparsedPayload)
    return withDerivedBackfillDatabase(payload.kind, async (database) => {
      try {
        let result = await executeDerivedTask(database, ctx.run.id, payload)
        if (payload.kind !== "embeddings") {
          result = await triggerOcrWork(database, result, ctx.run.id, payload)
        }
        // Publisher failures retain durable retry state and hand their next
        // attempt back to the controller. A row-level retry must not abort
        // sibling document or supporting-material work.
        return payload.kind === "embeddings" ? requireSuccessfulJobResult(result) : result
      } catch (error) {
        if (!(error instanceof JobAlreadyRunningError)) {
          throw error
        }
        if (payload.kind !== "embeddings") {
          const recovered = await recoverRetriedIngestionJob(database, {
            operation: error.operation,
            scopeKey: error.scopeKey,
            source: error.source,
            workflowExecutionId: ctx.run.id
          })
          if (recovered.releasedLease && recovered.startedAt !== undefined) {
            const requeued =
              payload.kind === "bill-documents"
                ? await requeueInterruptedDocuments(
                    database,
                    new Date(),
                    10_000,
                    { count: payload.shardCount, index: payload.shardIndex },
                    {
                      documentPartitionCount: payload.documentPartitionCount,
                      documentPartitionIndex: payload.documentPartitionIndex,
                      jurisdictionId: payload.jurisdictionId
                    },
                    recovered.startedAt
                  )
                : await requeueInterruptedSupportingMaterials(
                    database,
                    new Date(),
                    10_000,
                    { count: payload.shardCount, index: payload.shardIndex },
                    recovered.startedAt
                  )
            logger.warn("Derived backfill retry recovered its own interrupted attempt", {
              kind: payload.kind,
              operation: error.operation,
              recoveredRunIds: recovered.runIds,
              requeued,
              scopeKey: error.scopeKey,
              shardIndex: payload.shardIndex,
              source: error.source
            })
            let result = await executeDerivedTask(database, ctx.run.id, payload)
            result = await triggerOcrWork(database, result, ctx.run.id, payload)
            return result
          }
        }
        const retryAt = await ingestionJobHandoffRetryAt(database, error)
        logger.warn("Derived backfill continuation is waiting for its prior lease", {
          kind: payload.kind,
          operation: error.operation,
          retryAt: retryAt.toISOString(),
          scopeKey: error.scopeKey,
          shardIndex: payload.shardIndex,
          source: error.source
        })
        return createDerivedLeaseHandoffResult(payload, retryAt)
      }
    })
  }
})

export const derivedShardBackfillController = task({
  id: "backfill-derived-shard-controller",
  // Each coordinator has one child-run waitpoint at a time. Waitpoints do not
  // consume the active-duration budget, allowing fast shards to continue while
  // slower shards wait on their own child runs or publisher deferrals.
  maxDuration: 14_400,
  queue: derivedShardControllerQueue,
  run: async (unparsedPayload: unknown) => {
    const payload = derivedShardControllerPayloadSchema.parse(unparsedPayload)
    await runDerivedShardLoop({
      maxContinuations: payload.maxContinuations,
      runContinuation: async (continuation) =>
        await derivedCorpusBackfill.triggerAndWait(
          {
            correlationId: payload.correlationId,
            batchSize: derivedBatchSizeFor(payload.kind),
            documentPartitionCount: payload.documentPartitionCount,
            documentPartitionIndex: payload.documentPartitionIndex,
            jurisdictionId: payload.jurisdictionId,
            kind: payload.kind,
            maxBatches: derivedWorkerMaxBatchesFor(payload.kind),
            rebuildId: payload.rebuildId,
            shardCount: payload.shardCount,
            shardIndex: payload.shardIndex
          },
          {
            idempotencyKey: await globalIdempotencyKey(
              payload.rebuildId,
              `${payload.kind}:${continuation}:${payload.shardIndex}:${derivedDocumentPartitionId(payload)}`
            )
          }
        ),
      shardCount: payload.shardCount,
      shardIndex: payload.shardIndex,
      waitUntil: async (date) => await wait.until({ date })
    })
    return {
      checkpoint: { complete: true },
      kind: payload.kind,
      shard: { shardCount: payload.shardCount, shardIndex: payload.shardIndex },
      status: "completed" as const
    }
  }
})

export const embeddingSyncShardWorker = task({
  id: "embedding-sync-shard-worker",
  maxDuration: DERIVED_DOCUMENT_WORKER_MAX_DURATION_SECONDS,
  queue: derivedQueue,
  run: async (unparsedPayload: unknown, { ctx }) => {
    const payload = embeddingShardPayloadSchema.parse(unparsedPayload)
    return withDerivedBackfillDatabase("embeddings", async (database) => {
      try {
        return requireSuccessfulJobResult(
          await executeDerivedTask(database, ctx.run.id, {
            batchSize: undefined,
            correlationId: payload.correlationId,
            documentPartitionCount: undefined,
            documentPartitionIndex: undefined,
            jurisdictionId: undefined,
            kind: "embeddings",
            embeddingProducts: payload.products,
            maxBatches: derivedWorkerMaxBatchesFor("embeddings"),
            rebuildId: payload.rebuildId,
            shardCount: payload.shardCount,
            shardIndex: payload.shardIndex
          })
        )
      } catch (error) {
        if (!(error instanceof JobAlreadyRunningError)) {
          throw error
        }
        const retryAt = await ingestionJobHandoffRetryAt(database, error)
        return createDerivedLeaseHandoffResult(
          { kind: "embeddings", shardCount: payload.shardCount, shardIndex: payload.shardIndex },
          retryAt
        )
      }
    })
  }
})

export const embeddingSyncShardController = task({
  id: "embedding-sync-shard-controller",
  maxDuration: 14_400,
  queue: derivedShardControllerQueue,
  run: async (unparsedPayload: unknown) => {
    const payload = embeddingShardPayloadSchema.parse(unparsedPayload)
    await runDerivedShardLoop({
      maxContinuations: payload.maxContinuations,
      runContinuation: async (continuation) =>
        await embeddingSyncShardWorker.triggerAndWait(payload, {
          idempotencyKey: await globalIdempotencyKey(
            payload.rebuildId,
            `embedding-sync:${payload.products.slice().sort().join("+")}:${continuation}:${payload.shardIndex}`
          )
        }),
      shardCount: payload.shardCount,
      shardIndex: payload.shardIndex,
      waitUntil: async (date) => await wait.until({ date })
    })
    return { checkpoint: { complete: true }, shardIndex: payload.shardIndex, status: "completed" as const }
  }
})

export const embeddingIndexMaintenance = task({
  id: "embedding-index-maintenance",
  maxDuration: 3_600,
  queue: { concurrencyLimit: 1, name: "legislation-embedding-index-maintenance" },
  run: async (unparsedPayload: unknown) => {
    const payload = baseWorkerSchema.strict().parse(unparsedPayload)
    await withDerivedBackfillDatabase("embeddings", async (database) => {
      await database.execute(sql.raw("analyze legislation.bill_embeddings"))
      await database.execute(sql.raw("analyze legislation.document_section_embeddings"))
      await database.execute(sql.raw("analyze legislation.amendment_embeddings"))
      await database.execute(sql.raw("analyze legislation.supporting_material_section_embeddings"))
    })
    return { rebuildId: payload.rebuildId, status: "completed" as const }
  }
})

export const embeddingSync = task({
  id: "embedding-sync",
  maxDuration: 14_400,
  queue: { concurrencyLimit: 4, name: "legislation-embedding-sync-controller" },
  run: async (unparsedPayload: unknown) => {
    const payload = embeddingSyncPayloadSchema.parse(unparsedPayload)
    const items = []
    for (let shardIndex = 0; shardIndex < payload.shardCount; shardIndex += 1) {
      items.push({
        options: {
          idempotencyKey: await globalIdempotencyKey(
            payload.rebuildId,
            `embedding-sync:${payload.products.slice().sort().join("+")}:controller:${shardIndex}`
          )
        },
        payload: { ...payload, shardIndex }
      })
    }
    const result = await embeddingSyncShardController.batchTriggerAndWait(items)
    await embeddingIndexMaintenance
      .triggerAndWait(payload, {
        idempotencyKey: await globalIdempotencyKey(
          payload.rebuildId,
          `embedding-index-maintenance:${payload.products.slice().sort().join("+")}`
        )
      })
      .unwrap()
    assertBatchSucceeded(result, "embedding sync")
    return { checkpoint: { complete: true }, shardCount: payload.shardCount, status: "completed" as const }
  }
})

export const validateBackfill = task({
  id: "backfill-validate",
  maxDuration: 3_600,
  queue: derivedQueue,
  run: async (unparsedPayload: unknown) => {
    const payload = validationPayloadSchema.parse(unparsedPayload)
    return withDatabase(async (database) => {
      const [coverage, validation] = await Promise.all([generateCoverageReport(database), validateCorpus(database)])
      if ((validation.metrics.totalBills ?? 0) === 0) {
        throw new Error("Backfill validation found no bills in the rebuilt corpus")
      }
      if (!validation.valid) {
        throw new Error(`Backfill validation found ${validation.criticalIssues} critical issues`)
      }
      return { coverage, rebuildId: payload.rebuildId, status: "validated" as const, validation }
    })
  }
})

export const legislationBackfill = task({
  id: "legislation-backfill",
  // Trigger waitpoints do not consume the CPU-duration budget. The controller
  // can therefore await every bounded derived continuation without timing out
  // merely because the corpus takes longer than one worker window.
  maxDuration: 14_400,
  queue: { concurrencyLimit: 1 },
  run: async (unparsedPayload: unknown) => {
    const payload = backfillControllerPayloadSchema.parse(unparsedPayload)
    const units = createBackfillUnits(payload)
    for (const phase of backfillPhases.filter((candidate) => payload.phases.includes(candidate))) {
      await runBackfillPhase(payload, phase)
    }
    return {
      phases: payload.phases,
      rebuildId: payload.rebuildId,
      status: "completed" as const,
      units: units.length
    }
  }
})

async function runBackfillPhase(
  payload: z.output<typeof backfillControllerPayloadSchema>,
  phase: BackfillPhase
): Promise<void> {
  const correlationId = `backfill:${payload.rebuildId}:${phase}`
  if (phase === "openstates-history") {
    const archives = await listOpenStatesHistoricalArchives({
      config: loadConfig(),
      jurisdictions: payload.jurisdictions,
      manifestBlob: payload.openStatesManifestBlob
    })
    const items = []
    for (const archive of archives) {
      items.push({
        options: { idempotencyKey: await globalIdempotencyKey(payload.rebuildId, `${phase}:${archive.stream}`) },
        payload: {
          correlationId,
          jurisdiction: archive.jurisdictionCode,
          rebuildId: payload.rebuildId,
          session: archive.session,
          stream: archive.stream,
          url: archive.url
        }
      })
    }
    assertBatchSucceeded(await openStatesHistoryBackfill.batchTriggerAndWait(items), phase)
    return
  }
  if (phase === "govinfo-history") {
    await govInfoHistoryBackfill
      .triggerAndWait(
        {
          billTypes: payload.billTypes,
          correlationId,
          endCongress: payload.endCongress,
          rebuildId: payload.rebuildId,
          startCongress: payload.startCongress
        },
        { idempotencyKey: await globalIdempotencyKey(payload.rebuildId, phase) }
      )
      .unwrap()
    return
  }
  if (phase === "congress-history") {
    // A history rebuild is one predeclared wave. Do not fan out independent
    // domain tasks here: that would create more than one hourly allocator.
    await congressWaveCoordinator
      .triggerAndWait(
        {
          endCongress: payload.endCongress,
          kind: "history",
          startCongress: payload.startCongress
        },
        { idempotencyKey: await globalIdempotencyKey(payload.rebuildId, phase) }
      )
      .unwrap()
    return
  }
  if (phase === "current-catchup") {
    const identities = payload.jurisdictions.flatMap((jurisdiction) =>
      (["bills", "entities", "events"] as const).map((domain) => `openstates:${domain}:${jurisdiction}`)
    )
    const items = []
    for (const identity of identities) {
      items.push({
        options: { idempotencyKey: await globalIdempotencyKey(payload.rebuildId, `${phase}:${identity}`) },
        payload: { correlationId, identity, rebuildId: payload.rebuildId }
      })
    }
    assertBatchSucceeded(await currentCatchupBackfill.batchTriggerAndWait(items), phase)
    await congressWaveCoordinator
      .triggerAndWait(
        { currentCongress: payload.endCongress, kind: "recurring" },
        { idempotencyKey: await globalIdempotencyKey(payload.rebuildId, `${phase}:congress-wave`) }
      )
      .unwrap()
    return
  }
  if (phase === "documents") {
    await runDerivedToCompletion(
      payload.rebuildId,
      correlationId,
      "bill-documents",
      derivedBackfillShardCountFor("bill-documents")
    )
    return
  }
  if (phase === "materials") {
    await waitForMaterialPhaseGate()
    await runDerivedToCompletion(
      payload.rebuildId,
      correlationId,
      "supporting-materials",
      derivedBackfillShardCountFor("supporting-materials")
    )
    return
  }
  if (phase === "embeddings") {
    await embeddingSync
      .triggerAndWait(
        {
          correlationId,
          maxContinuations: 1_000,
          rebuildId: payload.rebuildId,
          shardCount: derivedBackfillShardCountFor("embeddings")
        },
        { idempotencyKey: await globalIdempotencyKey(payload.rebuildId, "embedding-sync") }
      )
      .unwrap()
    return
  }
  await validateBackfill
    .triggerAndWait(
      { correlationId, rebuildId: payload.rebuildId },
      { idempotencyKey: await globalIdempotencyKey(payload.rebuildId, phase) }
    )
    .unwrap()
}

async function waitForMaterialPhaseGate(): Promise<void> {
  const config = loadConfig()
  while (true) {
    const state = await withDatabase(async (database) => {
      const result = await database.execute<MaterialPhaseGateState>(sql`
        select
          count(*) filter (where processing_status = 'pending')::int as "pendingDocuments",
          count(*) filter (where processing_status = 'processing')::int as "processingDocuments",
          count(*) filter (
            where processing_status = 'failed'
              and processing_attempts < ${config.ingestion.maxAttempts}
          )::int as "retryableFailedDocuments",
          count(*) filter (
            where processing_status = 'unsupported'
              and processing_error_category = 'ocr-required'
              and processing_attempts < ${config.ocr.maximumAttempts}
          )::int as "ocrRequiredDocuments"
        from legislation.bill_documents as documents
        inner join legislation.bills as bills on bills.id = documents.bill_id
        where bills.jurisdiction_id = 'jurisdiction:us'
      `)
      const row = result.rows[0]
      if (row === undefined) {
        throw new Error("Material phase gate could not read the bill-document corpus")
      }
      return row
    })
    if (isMaterialPhaseGateOpen(state)) {
      logger.info("Material phase gate opened", state)
      return
    }
    logger.info("Material phase waiting for federal bill-document and OCR completion", state)
    await wait.until({ date: new Date(Date.now() + materialPhaseGatePollIntervalMs) })
  }
}

async function runDerivedToCompletion(
  rebuildId: string,
  correlationId: string,
  kind: "bill-documents" | "supporting-materials" | "embeddings",
  shardCount: number
): Promise<void> {
  const items = []
  for (let shardIndex = 0; shardIndex < shardCount; shardIndex += 1) {
    items.push({
      options: { idempotencyKey: await globalIdempotencyKey(rebuildId, `${kind}:controller:${shardIndex}`) },
      payload: {
        correlationId,
        kind,
        maxContinuations: 1_000,
        rebuildId,
        shardCount,
        shardIndex
      }
    })
  }
  // Trigger supports one batch wait in the parent. The individual coordinators
  // each perform one child wait at a time, so their continuations progress
  // independently without unsupported parallel Trigger waitpoints.
  const result = await derivedShardBackfillController.batchTriggerAndWait(items)
  assertBatchSucceeded(result, kind)
  const progress = reconcileDerivedShardBatch(
    shardCount,
    Array.from({ length: shardCount }, (_, shardIndex) => shardIndex),
    result.runs
  )
  if (progress.activeShardIndexes.length > 0) {
    throw new Error(`${kind} backfill coordinators returned incomplete shards`)
  }
}

async function globalIdempotencyKey(rebuildId: string, unitKey: string) {
  return idempotencyKeys.create(backfillIdempotencyKey(rebuildId, unitKey), { scope: "global" })
}

function assertBatchSucceeded(result: { runs: Array<{ id: string; ok: boolean }> }, phase: string): void {
  const failed = result.runs.filter((run) => !run.ok)
  if (failed.length > 0) {
    throw new Error(`${phase} failed for ${failed.length} child runs: ${failed.map((run) => run.id).join(", ")}`)
  }
}

async function executeDerivedTask(
  database: LegislationDatabase,
  workflowExecutionId: string,
  payload: z.output<typeof derivedPayloadSchema>
): Promise<JobResult & Readonly<{ shard: Readonly<{ shardCount: number; shardIndex: number }> }>> {
  const input = {
    config: loadConfig(),
    correlationId: payload.correlationId,
    database,
    workflowExecutionId
  }
  const documentHostLimiter = createDerivedDocumentHostLimiter(database, input.config, (event) => {
    logger.info("Document host limiter event", { ...event })
  })
  const result =
    payload.kind === "supporting-materials"
      ? await executeDerivedBackfill(
          input,
          {
            kind: payload.kind,
            options: {
              batchSize: payload.batchSize,
              maxBatches: payload.maxBatches,
              shardCount: payload.shardCount,
              shardIndex: payload.shardIndex
            }
          },
          { documentHostLimiter }
        )
      : await executeDerivedBackfill(
          input,
          {
            kind: payload.kind,
            options: {
              batchSize:
                payload.kind === "bill-documents"
                  ? Math.min(payload.batchSize ?? DERIVED_DOCUMENT_BATCH_SIZE, DERIVED_DOCUMENT_BATCH_SIZE)
                  : payload.batchSize,
              ...(payload.kind === "bill-documents"
                ? {
                    documentPartitionCount: payload.documentPartitionCount,
                    documentPartitionIndex: payload.documentPartitionIndex,
                    jurisdictionId: payload.jurisdictionId
                  }
                : {}),
              ...(payload.kind === "embeddings" ? { products: payload.embeddingProducts } : {}),
              maxBatches: payload.maxBatches,
              shardCount: payload.shardCount,
              shardIndex: payload.shardIndex
            }
          },
          { documentHostLimiter }
        )
  return { ...result, shard: { shardCount: payload.shardCount, shardIndex: payload.shardIndex } }
}

function derivedDocumentPartitionId(
  payload: Pick<
    z.output<typeof derivedPayloadSchema>,
    "documentPartitionCount" | "documentPartitionIndex" | "jurisdictionId"
  >
): string {
  if (
    payload.documentPartitionCount === undefined ||
    payload.documentPartitionIndex === undefined ||
    payload.jurisdictionId === undefined
  ) {
    return "all"
  }
  return `${payload.jurisdictionId}:${payload.documentPartitionIndex}-of-${payload.documentPartitionCount}`
}

function checkpointOcrIds(checkpoint: JobResult["checkpoint"], key: "ocrDocumentIds" | "ocrMaterialIds"): string[] {
  const value = checkpoint?.[key]
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((id): id is string => typeof id === "string")
}

async function triggerOcrWork<Result extends JobResult>(
  database: LegislationDatabase,
  result: Result,
  workflowExecutionId: string,
  payload: z.output<typeof derivedPayloadSchema>
): Promise<Result> {
  const documentIds = checkpointOcrIds(result.checkpoint, "ocrDocumentIds")
  const checkpointMaterialIds = checkpointOcrIds(result.checkpoint, "ocrMaterialIds")
  const backlogMaterialIds =
    payload.kind === "supporting-materials"
      ? await listOcrRequiredSupportingMaterialIds(database, {
          limit: DERIVED_DOCUMENT_BATCH_SIZE,
          maximumAttempts: loadConfig().ocr.maximumAttempts,
          shardCount: payload.shardCount,
          shardIndex: payload.shardIndex
        })
      : []
  const materialIds = [...new Set([...checkpointMaterialIds, ...backlogMaterialIds])]
  const documentItems = chunkOcrIds(documentIds).map((ids, index) => ({
    options: { idempotencyKey: `ocr:${workflowExecutionId}:documents:${index}` },
    payload: { documentIds: ids }
  }))
  const materialItems = chunkOcrIds(materialIds).map((ids, index) => ({
    options: { idempotencyKey: `ocr:${workflowExecutionId}:materials:${index}` },
    payload: { materialIds: ids }
  }))
  // Bill-document OCR remains fire-and-forget: the material phase gate
  // independently waits for it to settle, while document drains should not
  // block on long Azure OCR retry windows.
  if (documentItems.length > 0) {
    await ocrDocumentWorker.batchTrigger(documentItems)
  }
  if (materialItems.length === 0) {
    return result
  }

  // Supporting-material OCR is part of the material phase's completion
  // contract. Waitpoint suspension costs no active compute, while ensuring a
  // missing-artifact reroute is visible to the same shard controller instead
  // of appearing after that controller has already declared completion.
  const ocrBatch = await ocrDocumentWorker.batchTriggerAndWait(materialItems)
  assertBatchSucceeded(ocrBatch, "supporting-material OCR")
  const nextAttempt = await nextSupportingMaterialBackfillAttempt(database, {
    maximumAttempts: loadConfig().ingestion.maxAttempts,
    maximumOcrAttempts: loadConfig().ocr.maximumAttempts,
    shardCount: payload.shardCount,
    shardIndex: payload.shardIndex
  })
  return reconcileSupportingMaterialOcrCheckpoint(result, nextAttempt)
}

export function reconcileSupportingMaterialOcrCheckpoint<Result extends JobResult>(
  result: Result,
  nextAttempt: Readonly<{ hasWork: boolean; nextAttemptAt?: Date }>
): Result & Readonly<{ checkpoint: Readonly<Record<string, unknown>> }> {
  return {
    ...result,
    checkpoint: {
      ...result.checkpoint,
      complete: !nextAttempt.hasWork,
      ...(nextAttempt.nextAttemptAt === undefined
        ? { nextAttemptAt: undefined }
        : { nextAttemptAt: nextAttempt.nextAttemptAt.toISOString() })
    }
  }
}

function chunkOcrIds(ids: readonly string[]): string[][] {
  return Array.from({ length: Math.ceil(ids.length / DERIVED_DOCUMENT_BATCH_SIZE) }, (_, index) =>
    ids.slice(index * DERIVED_DOCUMENT_BATCH_SIZE, (index + 1) * DERIVED_DOCUMENT_BATCH_SIZE)
  )
}

function requireSuccessfulJobResult(result: JobResult): JobResult {
  if (result.status !== "succeeded") {
    throw new Error(`Backfill ingestion run ${result.runId} finished with ${result.status}`)
  }
  return result
}

async function withDatabase<Result>(execute: (database: LegislationDatabase) => Promise<Result>): Promise<Result> {
  const config = loadConfig()
  const { database, pool } = createDatabase(config.database)
  try {
    return await execute(database)
  } finally {
    await pool.end()
  }
}

async function withDerivedBackfillDatabase<Result>(
  kind: (typeof DERIVED_BACKFILL_KINDS)[number],
  execute: (database: LegislationDatabase) => Promise<Result>
): Promise<Result> {
  const config = loadConfig()
  const { database, pool } = createDatabase({
    ...config.database,
    // Material workers use a second connection so their renewable ingestion
    // lease can heartbeat while the processing connection persists a batch.
    // The 24-shard ceiling bounds this at 48 material sessions. Documents and
    // embeddings retain the configured one-connection ceiling.
    connectionTimeoutMs: Math.max(config.database.connectionTimeoutMs, config.backfill.documentHostAcquireTimeoutMs),
    maxConnections: Math.max(config.backfill.derivedDatabaseMaxConnections, derivedDatabaseConnectionsFor(kind))
  })
  try {
    return await execute(database)
  } finally {
    await pool.end()
  }
}
