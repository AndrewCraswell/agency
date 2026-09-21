import { createDatabase, type LegislationDatabase } from "@repo/legislation-core/database/database"
import { billDocuments, bills } from "@repo/legislation-core/database/schema/schema"
import { idempotencyKeys, logger, queue, task, wait } from "@trigger.dev/sdk"
import { and, asc, eq, lt, sql } from "drizzle-orm"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { generateCoverageReport } from "../../coverage/collector.js"
import {
  executeGovInfoHistoricalImport,
  executeOpenStatesArchiveImport,
  listOpenStatesHistoricalArchives
} from "../../ingestion/backfill/backfill.js"
import {
  DERIVED_BACKFILL_KINDS,
  DERIVED_DOCUMENT_BATCH_SIZE,
  DERIVED_DOCUMENT_WORKER_MAX_DURATION_SECONDS,
  DERIVED_SUPPORTING_MATERIAL_BATCH_SIZE,
  EMBEDDING_JOB_KINDS
} from "../../ingestion/backfill/derived-policy.js"
import { createDerivedDocumentHostLimiter, executeDerivedBackfill } from "../../ingestion/backfill/derived.js"
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
import { createGovInfoProviderRequestAdmission } from "../../ingestion/provider-request-admission.js"
import { executeSynchronization } from "../../ingestion/synchronization/synchronize.js"
import { acquireIndexMaintenanceLock, releaseIndexMaintenanceLock } from "../../persistence/index-maintenance.js"
import { validateCorpus } from "../../validation/corpus.js"
import {
  backfillControllerPayloadSchema,
  backfillExecutionPolicy,
  backfillIdempotencyKey,
  backfillPhases,
  createBackfillUnits,
  derivedBackfillShardCountFor,
  EMBEDDING_BACKFILL_MAX_SHARD_COUNT,
  maximumDerivedBackfillShardCountFor,
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
  // embedding products share this queue during the approved bulk pass; every
  // embedding worker reserves a second PgBouncer client for lease heartbeats.
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
const SENATE_ROLL_CALL_START_CONGRESS = 101

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
  return kind === "supporting-materials" || kind === "embeddings" ? 2 : 1
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
    force: z.boolean().default(false),
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
    documentStatus: z.enum(["pending", "failed", "unsupported"]).optional(),
    documentPartitionCount: z.number().int().positive().max(8).optional(),
    documentPartitionIndex: z.number().int().nonnegative().max(7).optional(),
    embeddingProducts: z.array(z.enum(EMBEDDING_JOB_KINDS)).min(1).optional(),
    jurisdictionId: z.string().trim().min(1).max(200).optional(),
    kind: z.enum(DERIVED_BACKFILL_KINDS),
    maxBatches: z.number().int().positive().max(100).default(10),
    shardCount: z.number().int().positive().max(EMBEDDING_BACKFILL_MAX_SHARD_COUNT).default(1),
    shardIndex: z
      .number()
      .int()
      .nonnegative()
      .max(EMBEDDING_BACKFILL_MAX_SHARD_COUNT - 1)
      .default(0)
  })
  .strict()
  .superRefine((payload, context) => {
    const maximumShardCount = maximumDerivedBackfillShardCountFor(payload.kind)
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
    if (payload.documentStatus !== undefined && payload.kind !== "bill-documents") {
      context.addIssue({
        code: "custom",
        message: "documentStatus is supported only for bill-document backfills",
        path: ["documentStatus"]
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
    shardCount: z
      .number()
      .int()
      .positive()
      .max(EMBEDDING_BACKFILL_MAX_SHARD_COUNT)
      .default(derivedBackfillShardCountFor("embeddings"))
  })
  .strict()
  .superRefine((payload, context) => {
    const maximum = maximumDerivedBackfillShardCountFor("embeddings")
    if (payload.shardCount > maximum) {
      context.addIssue({
        code: "custom",
        message: `Embedding sync supports at most ${maximum} shards`,
        path: ["shardCount"]
      })
    }
  })
const embeddingShardPayloadSchema = embeddingSyncPayloadSchema
  .extend({
    shardIndex: z
      .number()
      .int()
      .nonnegative()
      .max(EMBEDDING_BACKFILL_MAX_SHARD_COUNT - 1)
  })
  .strict()
  .superRefine((payload, context) => {
    if (payload.shardIndex >= payload.shardCount) {
      context.addIssue({ code: "custom", message: "shardIndex must be less than shardCount", path: ["shardIndex"] })
    }
  })
const embeddingFullSyncPayloadSchema = baseWorkerSchema
  .extend({ maxContinuations: z.number().int().positive().max(1_000).default(1_000) })
  .strict()
const documentEmbeddingClassificationBackfillPayloadSchema = baseWorkerSchema
  .extend({ batchSize: z.number().int().positive().max(50_000).default(10_000) })
  .strict()

export const FULL_EMBEDDING_PRODUCT_ORDER = ["amendments", "bills", "materials", "sections"] as const

export function createFullEmbeddingSyncStages() {
  return FULL_EMBEDDING_PRODUCT_ORDER.map((product) => ({
    product,
    shardCount: backfillExecutionPolicy.derivedQueueConcurrencyLimit
  }))
}

export function embeddingIndexMaintenancePayload(
  payload: Pick<z.output<typeof embeddingSyncPayloadSchema>, "correlationId" | "rebuildId">
) {
  return baseWorkerSchema.strict().parse({ correlationId: payload.correlationId, rebuildId: payload.rebuildId })
}

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
    return withDatabase(async (database, pool) =>
      requireSuccessfulJobResult(
        await executeGovInfoHistoricalImport(
          {
            billTypes: payload.billTypes,
            config: loadConfig(),
            correlationId: payload.correlationId,
            database,
            endCongress: payload.endCongress,
            force: payload.force,
            startCongress: payload.startCongress,
            workflowExecutionId: ctx.run.id
          },
          { providerAdmission: createGovInfoProviderRequestAdmission(pool) }
        )
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
            documentStatus: payload.documentStatus,
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
            `embedding-sync:${payload.products.slice().sort().join("+")}:${continuation}:${payload.shardIndex}-of-${payload.shardCount}`
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
  maxDuration: 86_400,
  queue: { concurrencyLimit: 1, name: "legislation-embedding-index-maintenance" },
  run: async (unparsedPayload: unknown) => {
    const payload = baseWorkerSchema.strict().parse(unparsedPayload)
    await withDerivedBackfillDatabase("embeddings", async (_database, pool) => {
      const client = await pool.connect()
      let acquired = false
      try {
        await acquireIndexMaintenanceLock(client)
        acquired = true
        // Railway's PostgreSQL container has a 64 MiB POSIX shared-memory
        // segment. The default 64 MiB maintenance allocation consumed almost
        // all of it before indexing began. A 32 MiB session allocation leaves
        // headroom while retaining two bounded parallel maintenance workers.
        await client.query("set maintenance_work_mem = '32MB'")
        await client.query("set max_parallel_maintenance_workers = 2")
        const invalidIndexes = await client.query<{ index_name: string }>(INVALID_EMBEDDING_INDEX_QUERY)
        for (const statement of embeddingIndexMaintenanceStatements(
          invalidIndexes.rows.map(({ index_name }) => index_name)
        )) {
          await client.query(statement)
        }
        await client.query("analyze legislation.bill_embeddings")
        await client.query("analyze legislation.document_section_embeddings")
        await client.query("analyze legislation.amendment_embeddings")
        await client.query("analyze legislation.supporting_material_section_embeddings")
      } finally {
        try {
          if (acquired) {
            await releaseIndexMaintenanceLock(client)
          }
        } finally {
          client.release()
        }
      }
    })
    return { rebuildId: payload.rebuildId, status: "completed" as const }
  }
})

export function documentEmbeddingClassificationBackfillStatements() {
  return {
    configureSession: "set statement_timeout = 0",
    createHelperIndex:
      "create index concurrently if not exists bill_documents_amendment_classification_backfill_idx on legislation.bill_documents (id) where classification = 'amendment'",
    dropHelperIndex:
      "drop index concurrently if exists legislation.bill_documents_amendment_classification_backfill_idx",
    refreshStatistics: "analyze legislation.document_section_embeddings (document_classification)",
    updateBatch: `
      with candidates as (
        select
          embedding.ctid,
          document.id as document_id,
          embedding.section_id,
          embedding.model,
          embedding.input_contract,
          document.classification
        from legislation.document_section_embeddings embedding
        join legislation.document_sections section on section.id = embedding.section_id
        join legislation.bill_documents document on document.id = section.document_id
        where embedding.document_classification is null
          and document.classification = 'amendment'
          and (
            $2::text is null
            or (document.id, embedding.section_id, embedding.model, embedding.input_contract)
              > ($2::text, $3::text, $4::text, $5::text)
          )
        order by document.id, embedding.section_id, embedding.model, embedding.input_contract
        limit $1
        for update of embedding skip locked
      ), updated as (
        update legislation.document_section_embeddings embedding
        set document_classification = candidates.classification
        from candidates
        where embedding.ctid = candidates.ctid
        returning embedding.section_id
      )
      select
        (select count(*)::integer from updated) as updated_count,
        candidates.document_id,
        candidates.section_id,
        candidates.model,
        candidates.input_contract
      from candidates
      order by candidates.document_id desc, candidates.section_id desc, candidates.model desc, candidates.input_contract desc
      limit 1
    `,
    verify: `
      select
        count(*) filter (where embedding.document_classification is null)::integer as unclassified_count,
        count(*) filter (
          where embedding.document_classification is distinct from document.classification
        )::integer as mismatch_count
      from legislation.document_section_embeddings embedding
      join legislation.document_sections section on section.id = embedding.section_id
      join legislation.bill_documents document on document.id = section.document_id
      where document.classification = 'amendment'
    `
  } as const
}

interface DocumentEmbeddingClassificationMaintenanceClient {
  query(statement: string): Promise<unknown>
}

export async function prepareDocumentEmbeddingClassificationBackfill(
  client: DocumentEmbeddingClassificationMaintenanceClient,
  statements = documentEmbeddingClassificationBackfillStatements()
): Promise<void> {
  // Classification repair, helper-index maintenance, verification, and
  // constraint validation intentionally share this dedicated client. Disable
  // the normal request timeout for the entire maintenance session before any
  // of that work begins; individual batches remain restartable and bounded.
  await client.query(statements.configureSession)
  await client.query(statements.createHelperIndex)
  await client.query(statements.refreshStatistics)
}

export const documentEmbeddingClassificationBackfill = task({
  id: "document-embedding-classification-backfill",
  maxDuration: 86_400,
  queue: { concurrencyLimit: 1, name: "legislation-embedding-index-maintenance" },
  run: async (unparsedPayload: unknown) => {
    const payload = documentEmbeddingClassificationBackfillPayloadSchema.parse(unparsedPayload)
    const statements = documentEmbeddingClassificationBackfillStatements()
    let classifiedCount = 0
    await withDerivedBackfillDatabase("embeddings", async (_database, pool) => {
      const client = await pool.connect()
      let acquired = false
      let cursor: { document_id: string; input_contract: string; model: string; section_id: string } | undefined
      try {
        await acquireIndexMaintenanceLock(client)
        acquired = true
        await prepareDocumentEmbeddingClassificationBackfill(client, statements)
        while (true) {
          const result = await client.query<{
            document_id: string
            input_contract: string
            model: string
            section_id: string
            updated_count: number
          }>(statements.updateBatch, [
            payload.batchSize,
            cursor?.document_id ?? null,
            cursor?.section_id ?? null,
            cursor?.model ?? null,
            cursor?.input_contract ?? null
          ])
          const next = result.rows[0]
          if (next === undefined) {
            break
          }
          const updated = next.updated_count
          classifiedCount += updated
          cursor = next
          if (classifiedCount % 100_000 < payload.batchSize) {
            logger.info("Document embedding classifications backfilled", { classifiedCount })
          }
        }
        const verification = await client.query<{ mismatch_count: number; unclassified_count: number }>(
          statements.verify
        )
        const counts = verification.rows[0]
        if (counts === undefined || counts.unclassified_count !== 0 || counts.mismatch_count !== 0) {
          throw new Error(
            `Document embedding classification verification failed: ${counts?.unclassified_count ?? "unknown"} unclassified, ${counts?.mismatch_count ?? "unknown"} mismatched`
          )
        }
        await client.query(
          "alter table legislation.document_section_embeddings validate constraint document_section_embeddings_classification_check"
        )
        await client.query(statements.dropHelperIndex)
      } finally {
        try {
          if (acquired) {
            await releaseIndexMaintenanceLock(client)
          }
        } finally {
          client.release()
        }
      }
    })
    return { classifiedCount, rebuildId: payload.rebuildId, status: "completed" as const }
  }
})

const EMBEDDING_HNSW_INDEXES = [
  {
    create:
      "create index concurrently if not exists bill_embeddings_hnsw_idx on legislation.bill_embeddings using hnsw (embedding vector_cosine_ops)",
    name: "bill_embeddings_hnsw_idx"
  },
  {
    create:
      "create index concurrently if not exists document_section_embeddings_hnsw_idx on legislation.document_section_embeddings using hnsw (embedding vector_cosine_ops)",
    name: "document_section_embeddings_hnsw_idx"
  },
  {
    create:
      "create index concurrently if not exists document_section_embeddings_amendment_hnsw_idx on legislation.document_section_embeddings using hnsw (embedding vector_cosine_ops) where document_classification = 'amendment' and model = 'openai/text-embedding-3-small' and input_contract = 'document-section-heading-text'",
    name: "document_section_embeddings_amendment_hnsw_idx"
  },
  {
    create:
      "create index concurrently if not exists amendment_embeddings_hnsw_idx on legislation.amendment_embeddings using hnsw (embedding vector_cosine_ops)",
    name: "amendment_embeddings_hnsw_idx"
  },
  {
    create:
      "create index concurrently if not exists supporting_material_section_embeddings_hnsw_idx on legislation.supporting_material_section_embeddings using hnsw (embedding vector_cosine_ops)",
    name: "supporting_material_section_embeddings_hnsw_idx"
  }
] as const

const INVALID_EMBEDDING_INDEX_QUERY = `
  select index_class.relname as index_name
  from pg_index index_state
  join pg_class index_class on index_class.oid = index_state.indexrelid
  join pg_namespace index_namespace on index_namespace.oid = index_class.relnamespace
  where index_namespace.nspname = 'legislation'
    and not index_state.indisvalid
    and index_class.relname in (${EMBEDDING_HNSW_INDEXES.map(({ name }) => `'${name}'`).join(", ")})
`

export function embeddingIndexMaintenanceStatements(invalidIndexNames: readonly string[]): string[] {
  const invalid = new Set(invalidIndexNames)
  return EMBEDDING_HNSW_INDEXES.flatMap(({ create, name }) => [
    ...(invalid.has(name) ? [`drop index concurrently if exists legislation.${name}`] : []),
    create
  ])
}

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
            `embedding-sync:${payload.products.slice().sort().join("+")}:controller:${shardIndex}-of-${payload.shardCount}`
          )
        },
        payload: { ...payload, shardIndex }
      })
    }
    const result = await embeddingSyncShardController.batchTriggerAndWait(items)
    await embeddingIndexMaintenance
      .triggerAndWait(embeddingIndexMaintenancePayload(payload), {
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

export const embeddingFullSync = task({
  id: "embedding-full-sync",
  maxDuration: 14_400,
  queue: { concurrencyLimit: 1, name: "legislation-embedding-full-sync-controller" },
  run: async (unparsedPayload: unknown) => {
    const payload = embeddingFullSyncPayloadSchema.parse(unparsedPayload)
    const completedProducts = []
    for (const stage of createFullEmbeddingSyncStages()) {
      await embeddingSync
        .triggerAndWait(
          {
            correlationId: `${payload.correlationId}:${stage.product}`,
            maxContinuations: payload.maxContinuations,
            products: [stage.product],
            rebuildId: payload.rebuildId,
            shardCount: stage.shardCount
          },
          {
            idempotencyKey: await globalIdempotencyKey(
              payload.rebuildId,
              `embedding-full-sync:${stage.product}:${stage.shardCount}`
            )
          }
        )
        .unwrap()
      completedProducts.push(stage.product)
    }
    return { checkpoint: { complete: true }, completedProducts, status: "completed" as const }
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
          force: payload.forceGovInfo,
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
    // Senate roll-call XML begins with the 101st Congress; the current Congress is handled by current catch-up.
    const senateItems = []
    for (
      let congress = Math.max(payload.startCongress, SENATE_ROLL_CALL_START_CONGRESS);
      congress < payload.endCongress;
      congress += 1
    ) {
      const identity = `senate:votes:${congress}`
      senateItems.push({
        options: {
          concurrencyKey: "senate",
          idempotencyKey: await globalIdempotencyKey(payload.rebuildId, `${phase}:${identity}`)
        },
        payload: { correlationId, identity, rebuildId: payload.rebuildId }
      })
    }
    if (senateItems.length > 0) {
      assertBatchSucceeded(await currentCatchupBackfill.batchTriggerAndWait(senateItems), `${phase}:senate`)
    }
    return
  }
  if (phase === "current-catchup") {
    const identities = [
      ...payload.jurisdictions.flatMap((jurisdiction) =>
        (["bills", "entities", "events"] as const).map((domain) => `openstates:${domain}:${jurisdiction}`)
      ),
      `senate:votes:${payload.endCongress}`
    ]
    const items = []
    for (const identity of identities) {
      items.push({
        options: {
          ...(identity.startsWith("senate:") ? { concurrencyKey: "senate" } : {}),
          idempotencyKey: await globalIdempotencyKey(payload.rebuildId, `${phase}:${identity}`)
        },
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
    await embeddingFullSync
      .triggerAndWait(
        {
          correlationId,
          maxContinuations: 1_000,
          rebuildId: payload.rebuildId
        },
        { idempotencyKey: await globalIdempotencyKey(payload.rebuildId, "embedding-full-sync") }
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
                    jurisdictionId: payload.jurisdictionId,
                    status: payload.documentStatus
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
  if (
    payload.kind === "bill-documents" &&
    payload.documentStatus === "pending" &&
    payload.jurisdictionId !== undefined &&
    payload.documentPartitionCount === undefined &&
    payload.documentPartitionIndex === undefined
  ) {
    const nextAttempt = await nextPendingDocumentAttempt(database, {
      jurisdictionId: payload.jurisdictionId,
      maximumAttempts: input.config.ingestion.maxAttempts
    })
    return {
      ...reconcilePendingDocumentCheckpoint(result, nextAttempt),
      shard: { shardCount: payload.shardCount, shardIndex: payload.shardIndex }
    }
  }
  return { ...result, shard: { shardCount: payload.shardCount, shardIndex: payload.shardIndex } }
}

async function nextPendingDocumentAttempt(
  database: LegislationDatabase,
  options: Readonly<{ jurisdictionId: string; maximumAttempts: number }>
): Promise<Readonly<{ hasWork: boolean; nextAttemptAt?: Date }>> {
  const records = await database
    .select({ nextAttemptAt: billDocuments.nextAttemptAt })
    .from(billDocuments)
    .innerJoin(bills, eq(bills.id, billDocuments.billId))
    .where(
      and(
        eq(billDocuments.processingStatus, "pending"),
        lt(billDocuments.processingAttempts, options.maximumAttempts),
        eq(bills.jurisdictionId, options.jurisdictionId)
      )
    )
    .orderBy(sql`${billDocuments.nextAttemptAt} nulls first`, asc(billDocuments.updatedAt), asc(billDocuments.id))
    .limit(1)
  const record = records[0]
  if (record === undefined) {
    return { hasWork: false }
  }
  return record.nextAttemptAt === null ? { hasWork: true } : { hasWork: true, nextAttemptAt: record.nextAttemptAt }
}

export function reconcilePendingDocumentCheckpoint<Result extends JobResult>(
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

async function withDatabase<Result>(
  execute: (database: LegislationDatabase, pool: ReturnType<typeof createDatabase>["pool"]) => Promise<Result>
): Promise<Result> {
  const config = loadConfig()
  const { database, pool } = createDatabase(config.database)
  try {
    return await execute(database, pool)
  } finally {
    await pool.end()
  }
}

async function withDerivedBackfillDatabase<Result>(
  kind: (typeof DERIVED_BACKFILL_KINDS)[number],
  execute: (database: LegislationDatabase, pool: ReturnType<typeof createDatabase>["pool"]) => Promise<Result>
): Promise<Result> {
  const config = loadConfig()
  const { database, pool } = createDatabase({
    ...config.database,
    // Material and embedding workers use a second client connection so their
    // renewable ingestion lease can heartbeat while the processing connection
    // persists a batch. PgBouncer still caps aggregate PostgreSQL backends.
    connectionTimeoutMs: Math.max(config.database.connectionTimeoutMs, config.backfill.documentHostAcquireTimeoutMs),
    maxConnections: Math.max(config.backfill.derivedDatabaseMaxConnections, derivedDatabaseConnectionsFor(kind))
  })
  try {
    return await execute(database, pool)
  } finally {
    await pool.end()
  }
}
