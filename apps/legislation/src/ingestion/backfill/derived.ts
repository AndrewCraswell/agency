import { createHash } from "node:crypto"
import { resolve } from "node:path"
import { and, eq } from "drizzle-orm"
import type { LegislationConfig } from "../../config/config.js"
import type { LegislationDatabase } from "../../db/database.js"
import { syncCheckpoints } from "../../db/schema/schema.js"
import { embeddingRouteFor, type EmbeddingRouteProduct } from "../../models/embedding-routing.js"
import { OpenRouterEmbeddingClient } from "../../models/openrouter-embeddings.js"
import { AzureBlobArtifactStore, LocalArtifactStore, type ArtifactStore } from "../documents/artifact-store.js"
import {
  createDatabaseDocumentHostLimiter,
  type DocumentHostLimiter,
  type DocumentHostLimiterOptions
} from "../documents/host-limiter.js"
import {
  classifyKnownUnavailableCaliforniaBillPdfs,
  nextDocumentBackfillAttempt,
  processPendingDocuments,
  requeueInterruptedDocuments,
  type DocumentJobResult
} from "../documents/jobs.js"
import { type DocumentFailureCategory } from "../documents/process.js"
import {
  nextSupportingMaterialBackfillAttempt,
  processPendingSupportingMaterials,
  requeueInterruptedSupportingMaterials,
  type SupportingMaterialJobResult
} from "../documents/supporting-material-jobs.js"
import {
  embedAmendments,
  embedBills,
  embedDocumentSections,
  embedSupportingMaterialSections,
  type EmbeddingClient,
  type EmbeddingJobResult
} from "../embeddings/jobs.js"
import { createJobCounts, runIngestionJob, type JobCounts, type JobResult } from "../job.js"

const MAX_REPORTED_FAILURES = 20
// A bounded document batch can spend more than 15 minutes inside a slow
// publisher download or PDF extraction while the worker's single database
// connection is occupied. The lease must cover that bounded unit because its
// heartbeat cannot borrow a second connection from the intentionally one-slot
// pool. Trigger still provides the outer task timeout and retry boundary.
const DERIVED_JOB_LEASE_DURATION_MINUTES = 30
// Supporting-material PDF extraction is serialized per worker, and unusually
// long PDFs are handed to managed OCR before page-by-page local extraction.
// Keep a separate lease window for material download, extraction, and OCR
// handoff without changing bill-document or embedding leases.
const SUPPORTING_MATERIAL_JOB_LEASE_DURATION_MINUTES = 60

/**
 * A document continuation is deliberately longer than ordinary sync work, but
 * is still bounded. The same window guards recovery of claims left behind by a
 * hard-killed Trigger worker: another lane must never reclaim them while the
 * original worker could still be making publisher calls.
 */
export const DERIVED_DOCUMENT_WORKER_MAX_DURATION_SECONDS = 14_400
export const DERIVED_DOCUMENT_BATCH_SIZE = 100
export const DERIVED_SUPPORTING_MATERIAL_BATCH_SIZE = 25
const DOCUMENT_INTERRUPTION_RECOVERY_MARGIN_MS = 5 * 60 * 1000

export const DERIVED_BACKFILL_KINDS = ["bill-documents", "supporting-materials", "embeddings"] as const
export type DerivedBackfillKind = (typeof DERIVED_BACKFILL_KINDS)[number]

type ProcessingStatus = "failed" | "pending" | "unsupported"

export interface DerivedBackfillExecutionInput {
  config: LegislationConfig
  correlationId: string
  database: LegislationDatabase
  workflowExecutionId?: string
}

export interface BillDocumentDrainOptions {
  batchSize?: number
  billId?: string
  documentPartitionCount?: number
  documentPartitionIndex?: number
  documentId?: string
  failureCategory?: DocumentFailureCategory
  force?: boolean
  jurisdictionId?: string
  maxBatches?: number
  shardCount?: number
  shardIndex?: number
  status?: ProcessingStatus
}

export interface SupportingMaterialDrainOptions {
  batchSize?: number
  force?: boolean
  jurisdictionId?: string
  materialId?: string
  maxBatches?: number
  shardCount?: number
  shardIndex?: number
  status?: ProcessingStatus
}

export interface EmbeddingDrainOptions {
  amendmentId?: string
  batchSize?: number
  billId?: string
  documentId?: string
  materialId?: string
  maxBatches?: number
  products?: EmbeddingJobKind[]
  persistenceBatchSize?: number
  providerBatchSize?: number
  shardCount?: number
  shardIndex?: number
}

export type DerivedBackfillRequest =
  | Readonly<{ kind: "bill-documents"; options?: BillDocumentDrainOptions }>
  | Readonly<{ kind: "supporting-materials"; options?: SupportingMaterialDrainOptions }>
  | Readonly<{ kind: "embeddings"; options?: EmbeddingDrainOptions }>

export const EMBEDDING_JOB_KINDS = ["amendments", "bills", "materials", "sections"] as const
export type EmbeddingJobKind = (typeof EMBEDDING_JOB_KINDS)[number]

export interface DerivedBackfillDependencies {
  artifactStore?: ArtifactStore
  embedAmendments?: typeof embedAmendments
  embedBills?: typeof embedBills
  embedDocumentSections?: typeof embedDocumentSections
  embedSupportingMaterialSections?: typeof embedSupportingMaterialSections
  embeddingClients?: Partial<Record<EmbeddingJobKind, EmbeddingClient>>
  loadEmbeddingCheckpoint?: (database: LegislationDatabase, stream: string) => Promise<EmbeddingDrainCheckpoint>
  documentHostLimiter?: DocumentHostLimiter
  classifyKnownUnavailableCaliforniaBillPdfs?: typeof classifyKnownUnavailableCaliforniaBillPdfs
  nextDocumentBackfillAttempt?: typeof nextDocumentBackfillAttempt
  nextSupportingMaterialBackfillAttempt?: typeof nextSupportingMaterialBackfillAttempt
  processBillDocuments?: typeof processPendingDocuments
  processSupportingMaterials?: typeof processPendingSupportingMaterials
  requeueInterruptedDocuments?: typeof requeueInterruptedDocuments
  requeueInterruptedSupportingMaterials?: typeof requeueInterruptedSupportingMaterials
  runIngestionJob?: typeof runIngestionJob
}

export function createDerivedDocumentHostLimiter(
  database: LegislationDatabase,
  config: LegislationConfig,
  onEvent?: DocumentHostLimiterOptions["onEvent"]
): DocumentHostLimiter {
  return createDatabaseDocumentHostLimiter(database, { ...documentHostLimiterOptions(config), onEvent })
}

export interface EmbeddingDrainCheckpoint {
  amendments: Readonly<{ complete: boolean; cursor: string }>
  bills: Readonly<{ complete: boolean; cursor: string }>
  materials: Readonly<{ complete: boolean; cursor: string }>
  sections: Readonly<{ complete: boolean; cursor: string }>
}

const initialEmbeddingCheckpoint: EmbeddingDrainCheckpoint = {
  amendments: { complete: false, cursor: "" },
  bills: { complete: false, cursor: "" },
  materials: { complete: false, cursor: "" },
  sections: { complete: false, cursor: "" }
}

/**
 * Executes one finite unit of derived-data work without launching the CLI.
 *
 * Source ingestion checkpoints stay untouched: documents and embeddings resume from
 * their durable processing state, while the ingestion job lease prevents overlapping
 * drains for the same legacy operation and shard.
 */
export async function executeDerivedBackfill(
  input: DerivedBackfillExecutionInput,
  request: DerivedBackfillRequest,
  dependencies: DerivedBackfillDependencies = {}
): Promise<JobResult> {
  if (request.kind === "bill-documents") {
    return drainBillDocuments(input, request.options, dependencies)
  }
  if (request.kind === "supporting-materials") {
    return drainSupportingMaterials(input, request.options, dependencies)
  }
  return drainEmbeddings(input, request.options, dependencies)
}

export async function drainBillDocuments(
  input: DerivedBackfillExecutionInput,
  options: BillDocumentDrainOptions = {},
  dependencies: DerivedBackfillDependencies = {}
): Promise<JobResult> {
  const batchSize = boundedPositiveInteger(options.batchSize ?? 1_000, "batch size", 1_000)
  const maxBatches = boundedPositiveInteger(options.maxBatches ?? 1, "max batches")
  const shard = normalizeShard(options)
  const documentPartition = normalizeDocumentPartition(options)
  if (shard.count > 1 && (options.billId !== undefined || options.documentId !== undefined)) {
    throw new Error("Document sharding cannot be combined with targeted document or bill IDs")
  }
  if (options.failureCategory !== undefined && options.status !== "failed") {
    throw new Error("A document failure category requires failed status")
  }
  const { operation, scopeKey } = documentJobIdentity(options, shard, documentPartition)
  const process = dependencies.processBillDocuments ?? processPendingDocuments
  const classifyUnavailableCaliforniaPdfs =
    dependencies.classifyKnownUnavailableCaliforniaBillPdfs ?? classifyKnownUnavailableCaliforniaBillPdfs
  const recoverInterruptedDocuments =
    dependencies.requeueInterruptedDocuments ??
    (dependencies.processBillDocuments === undefined ? requeueInterruptedDocuments : async () => 0)
  const getNextDocumentBackfillAttempt: typeof nextDocumentBackfillAttempt =
    dependencies.nextDocumentBackfillAttempt ??
    (dependencies.processBillDocuments === undefined
      ? nextDocumentBackfillAttempt
      : async () => ({ hasWork: false as const }))
  const artifactStore = dependencies.artifactStore ?? createDocumentArtifactStore(input.config)
  const hostLimiter = dependencies.documentHostLimiter ?? createDerivedDocumentHostLimiter(input.database, input.config)
  const documentScope =
    documentPartition === undefined && options.jurisdictionId === undefined
      ? undefined
      : {
          documentPartitionCount: documentPartition?.count,
          documentPartitionIndex: documentPartition?.index,
          jurisdictionId: options.jurisdictionId
        }

  return runBackfillJob(
    input,
    {
      batchSize,
      executionSettings: documentExecutionSettings(input.config, shard, documentPartition),
      kind: "bill-documents",
      leaseDurationMinutes: DERIVED_JOB_LEASE_DURATION_MINUTES,
      maxBatches,
      operation,
      scopeKey,
      source: "documents"
    },
    dependencies.runIngestionJob,
    async () => {
      const interruptedRecoveryDelayMs = interruptedDocumentRecoveryDelayMs(input.config)
      const interruptedCutoff = new Date(Date.now() - interruptedRecoveryDelayMs)
      const recovered =
        documentScope === undefined
          ? await recoverInterruptedDocuments(input.database, interruptedCutoff, Math.min(batchSize, 1_000), shard)
          : await recoverInterruptedDocuments(
              input.database,
              interruptedCutoff,
              Math.min(batchSize, 1_000),
              shard,
              documentScope
            )
      const terminalClassification = shouldClassifyUnavailableCaliforniaPdfs(options)
        ? await classifyUnavailableCaliforniaPdfs(input.database, Math.min(batchSize * maxBatches, 100_000))
        : { classified: 0, identifiers: [] }
      const statuses: Array<NonNullable<BillDocumentDrainOptions["status"]>> =
        options.status === undefined ? ["pending", "failed"] : [options.status]
      let remainingBatches = maxBatches
      let drained: DrainResult = {
        batches: 0,
        counts: createJobCounts(),
        deferred: 0,
        failures: [],
        hasMore: false,
        ocrDocumentIds: [],
        ocrMaterialIds: []
      }
      for (const status of statuses) {
        if (remainingBatches === 0) {
          break
        }
        const result = await drainBatches<DocumentJobResult>(batchSize, remainingBatches, async () =>
          process(input.database, {
            artifactStore,
            billId: options.billId,
            concurrency: input.config.ingestion.concurrency,
            documentPartitionCount: documentPartition?.count,
            documentPartitionIndex: documentPartition?.index,
            documentId: options.documentId,
            failureCategory: options.failureCategory,
            force: options.force,
            hostLimiter,
            jurisdictionId: options.jurisdictionId,
            limit: batchSize,
            maximumAttempts: input.config.ingestion.maxAttempts,
            shardCount: shard.count,
            shardIndex: shard.index,
            status,
            timeoutMs: input.config.ingestion.requestTimeoutMs
          })
        )
        drained = combineDrainResults(drained, result)
        // A status probe that finds no records is only a bounded check for the
        // next status; it must not spend this run's productive-work budget.
        // Otherwise a shard with no pending rows can never reach due failed
        // rows when maxBatches is one.
        remainingBatches -= productiveBatchCount(result)
        if (result.hasMore) {
          break
        }
      }
      const nextAttempt = await getNextDocumentBackfillAttempt(input.database, {
        interruptedDocumentRecoveryAfter: interruptedCutoff,
        interruptedDocumentRecoveryDelayMs: interruptedRecoveryDelayMs,
        documentPartitionCount: documentPartition?.count,
        documentPartitionIndex: documentPartition?.index,
        jurisdictionId: options.jurisdictionId,
        maximumAttempts: input.config.ingestion.maxAttempts,
        shardCount: shard.count,
        shardIndex: shard.index
      })
      return {
        checkpoint: {
          ...drainCheckpoint("bill-documents", drained, nextAttempt.hasWork),
          deferred: drained.deferred,
          ...(drained.ocrDocumentIds.length === 0 ? {} : { ocrDocumentIds: drained.ocrDocumentIds }),
          ...(nextAttempt.nextAttemptAt === undefined ? {} : { nextAttemptAt: nextAttempt.nextAttemptAt.toISOString() })
        },
        counts: {
          ...drained.counts,
          discovered: drained.counts.discovered + terminalClassification.classified + recovered,
          updated: drained.counts.updated + terminalClassification.classified + recovered
        },
        failures: drained.failures
      }
    }
  )
}

export async function drainSupportingMaterials(
  input: DerivedBackfillExecutionInput,
  options: SupportingMaterialDrainOptions = {},
  dependencies: DerivedBackfillDependencies = {}
): Promise<JobResult> {
  const batchSize = boundedPositiveInteger(options.batchSize ?? 100, "batch size", 1_000)
  const maxBatches = boundedPositiveInteger(options.maxBatches ?? 1, "max batches")
  const process = dependencies.processSupportingMaterials ?? processPendingSupportingMaterials
  const getNextAttempt = dependencies.nextSupportingMaterialBackfillAttempt ?? nextSupportingMaterialBackfillAttempt
  const recoverInterrupted =
    dependencies.requeueInterruptedSupportingMaterials ??
    (dependencies.processSupportingMaterials === undefined ? requeueInterruptedSupportingMaterials : async () => 0)
  const artifactStore = dependencies.artifactStore ?? createDocumentArtifactStore(input.config)
  const hostLimiter = dependencies.documentHostLimiter ?? createDerivedDocumentHostLimiter(input.database, input.config)
  const shard = normalizeShard(options)
  const jobIdentity =
    shard.count === 1
      ? { operation: "process-supporting-materials", scopeKey: "all" }
      : {
          operation: `process-supporting-materials-shard-${shard.index}`,
          scopeKey: `shard:${shard.index}-of-${shard.count}`
        }

  return runBackfillJob(
    input,
    {
      batchSize,
      executionSettings: documentExecutionSettings(input.config, shard),
      kind: "supporting-materials",
      leaseDurationMinutes: SUPPORTING_MATERIAL_JOB_LEASE_DURATION_MINUTES,
      maxBatches,
      operation: jobIdentity.operation,
      scopeKey: jobIdentity.scopeKey,
      source: "documents"
    },
    dependencies.runIngestionJob,
    async () => {
      const interruptedRecoveryDelayMs = interruptedDocumentRecoveryDelayMs(input.config)
      const interruptedCutoff = new Date(Date.now() - interruptedRecoveryDelayMs)
      const recovered = await recoverInterrupted(input.database, interruptedCutoff, Math.min(batchSize, 1_000), shard)
      const drained = await drainBatches<SupportingMaterialJobResult>(batchSize, maxBatches, async () =>
        process(input.database, {
          artifactStore,
          concurrency: input.config.ingestion.concurrency,
          force: options.force,
          hostLimiter,
          jurisdictionId: options.jurisdictionId,
          limit: batchSize,
          materialId: options.materialId,
          maximumAttempts: input.config.ingestion.maxAttempts,
          shardCount: shard.count,
          shardIndex: shard.index,
          status: options.status,
          timeoutMs: input.config.ingestion.requestTimeoutMs
        })
      )
      const nextAttempt = await getNextAttempt(input.database, {
        interruptedRecoveryAfter: interruptedCutoff,
        interruptedRecoveryDelayMs,
        maximumAttempts: input.config.ingestion.maxAttempts,
        maximumOcrAttempts: input.config.ocr.maximumAttempts,
        shardCount: shard.count,
        shardIndex: shard.index
      })
      return {
        checkpoint: {
          ...drainCheckpoint("supporting-materials", drained, nextAttempt.hasWork),
          ...(drained.ocrMaterialIds.length === 0 ? {} : { ocrMaterialIds: drained.ocrMaterialIds }),
          ...(nextAttempt.nextAttemptAt === undefined ? {} : { nextAttemptAt: nextAttempt.nextAttemptAt.toISOString() })
        },
        counts: {
          ...drained.counts,
          discovered: drained.counts.discovered + recovered,
          updated: drained.counts.updated + recovered
        },
        failures: drained.failures
      }
    }
  )
}

export async function drainEmbeddings(
  input: DerivedBackfillExecutionInput,
  options: EmbeddingDrainOptions = {},
  dependencies: DerivedBackfillDependencies = {}
): Promise<JobResult> {
  if (input.config.model.apiKey === undefined && dependencies.embeddingClients === undefined) {
    throw new Error("OPENROUTER_API_KEY is required for embedding backfill")
  }
  const batchSize = boundedPositiveInteger(options.batchSize ?? 64, "batch size")
  const maxBatches = boundedPositiveInteger(options.maxBatches ?? 1, "max batches")
  const bulkMode =
    maxBatches > 1 &&
    options.amendmentId === undefined &&
    options.billId === undefined &&
    options.documentId === undefined &&
    options.materialId === undefined
  const selectionBatchSize = bulkMode ? batchSize * maxBatches : batchSize
  const drainIterations = bulkMode ? 1 : maxBatches
  const providerBatchSize = options.providerBatchSize ?? batchSize
  const persistenceBatchSize =
    options.persistenceBatchSize ?? (bulkMode ? Math.min(selectionBatchSize, 128) : batchSize)
  const shard = normalizeShard(options)
  const targets = {
    amendmentId: options.amendmentId,
    billId: options.billId,
    documentId: options.documentId,
    materialId: options.materialId
  }
  const hasTarget = Object.values(targets).some((value) => value !== undefined)
  if (Object.values(targets).some((value) => value !== undefined && value.trim().length === 0)) {
    throw new Error("Embedding target IDs must not be empty")
  }
  const scopedProducts = EMBEDDING_JOB_KINDS.filter((product) => {
    if (!hasTarget) {
      return true
    }
    if (product === "amendments") {
      return options.amendmentId !== undefined
    }
    if (product === "bills") {
      return options.billId !== undefined
    }
    if (product === "materials") {
      return options.materialId !== undefined
    }
    return options.billId !== undefined || options.documentId !== undefined
  })
  const products = [...new Set(options.products ?? scopedProducts)].sort()
  if (products.some((product) => !scopedProducts.includes(product))) {
    throw new Error("Targeted embedding products require a matching target ID")
  }
  if (products.length === 0) {
    throw new Error("Embedding backfill requires at least one product")
  }
  if (
    shard.count > 1 &&
    (options.amendmentId !== undefined ||
      options.billId !== undefined ||
      options.documentId !== undefined ||
      options.materialId !== undefined)
  ) {
    throw new Error("Embedding sharding cannot be combined with targeted IDs")
  }
  const clients = dependencies.embeddingClients ?? createEmbeddingClients(input.config)
  const embedAmendmentRecords = dependencies.embedAmendments ?? embedAmendments
  const embedBillRecords = dependencies.embedBills ?? embedBills
  const embedDocumentSectionRecords = dependencies.embedDocumentSections ?? embedDocumentSections
  const embedSupportingMaterialSectionRecords =
    dependencies.embedSupportingMaterialSections ?? embedSupportingMaterialSections
  const productScope = products.join("+")
  const operation =
    shard.count === 1 ? `refresh-embeddings-${productScope}` : `refresh-embeddings-${productScope}-shard-${shard.index}`
  let scopeKey = shard.count === 1 ? productScope : `${productScope}:shard:${shard.index}-of-${shard.count}`
  if (hasTarget) {
    scopeKey = `${productScope}:target:${createHash("sha256").update(JSON.stringify(targets)).digest("hex")}`
  }
  const checkpointStream = `embeddings:${scopeKey}`

  return runBackfillJob(
    input,
    {
      batchSize: selectionBatchSize,
      checkpointStream,
      executionSettings: {
        databasePoolMaxConnections: input.config.backfill.derivedDatabaseMaxConnections,
        ...(bulkMode || options.persistenceBatchSize !== undefined ? { persistenceBatchSize } : {}),
        ...(bulkMode || options.providerBatchSize !== undefined ? { providerBatchSize } : {}),
        shardCount: shard.count,
        shardIndex: shard.index
      },
      kind: "embeddings",
      leaseDurationMinutes: DERIVED_JOB_LEASE_DURATION_MINUTES,
      maxBatches: drainIterations,
      operation,
      scopeKey,
      source: "openrouter"
    },
    dependencies.runIngestionJob,
    async () => {
      const persistedCheckpoint = await (dependencies.loadEmbeddingCheckpoint ?? loadEmbeddingCheckpoint)(
        input.database,
        checkpointStream
      )
      // A completed targeted pass must inspect freshness again after later source/OCR updates.
      // Incomplete passes retain their cursor so bounded continuations still make progress.
      const loadedCheckpoint =
        hasTarget && products.every((product) => persistedCheckpoint[product].complete)
          ? initialEmbeddingCheckpoint
          : persistedCheckpoint
      const enabled = new Set<EmbeddingJobKind>(products)
      const checkpoint: EmbeddingDrainCheckpoint = {
        amendments: enabled.has("amendments") ? loadedCheckpoint.amendments : { complete: true, cursor: "" },
        bills: enabled.has("bills") ? loadedCheckpoint.bills : { complete: true, cursor: "" },
        materials: enabled.has("materials") ? loadedCheckpoint.materials : { complete: true, cursor: "" },
        sections: enabled.has("sections") ? loadedCheckpoint.sections : { complete: true, cursor: "" }
      }
      const drained = await drainEmbeddingBatches(drainIterations, checkpoint, async (progress) => {
        const selection = {
          limit: selectionBatchSize,
          ...(bulkMode || options.persistenceBatchSize !== undefined ? { persistenceBatchSize } : {}),
          ...(bulkMode || options.providerBatchSize !== undefined ? { providerBatchSize } : {}),
          shardCount: shard.count,
          shardIndex: shard.index
        }
        const amendments = progress.amendments.complete
          ? completedEmbeddingJobResult()
          : await embedAmendmentRecords(input.database, requireEmbeddingClient(clients, "amendments"), {
              ...selection,
              afterId: progress.amendments.cursor,
              amendmentId: options.amendmentId,
              rolloutId: input.correlationId
            })
        const bills = progress.bills.complete
          ? completedEmbeddingJobResult()
          : await embedBillRecords(input.database, requireEmbeddingClient(clients, "bills"), {
              ...selection,
              afterId: progress.bills.cursor,
              billId: options.billId,
              rolloutId: input.correlationId
            })
        const sections = progress.sections.complete
          ? completedEmbeddingJobResult()
          : await embedDocumentSectionRecords(input.database, requireEmbeddingClient(clients, "sections"), {
              ...selection,
              afterId: progress.sections.cursor,
              billId: options.billId,
              documentId: options.documentId,
              rolloutId: input.correlationId
            })
        const materials = progress.materials.complete
          ? completedEmbeddingJobResult()
          : await embedSupportingMaterialSectionRecords(input.database, requireEmbeddingClient(clients, "materials"), {
              ...selection,
              afterId: progress.materials.cursor,
              materialId: options.materialId,
              rolloutId: input.correlationId
            })
        return { amendments, bills, materials, sections }
      })
      return {
        checkpoint: { ...drainCheckpoint("embeddings", drained), embedding: drained.checkpoint },
        counts: drained.counts,
        failures: []
      }
    }
  )
}

type DrainResult = Readonly<{
  batches: number
  counts: JobCounts
  deferred: number
  failures: JobResult["failures"]
  hasMore: boolean
  ocrDocumentIds: string[]
  ocrMaterialIds: string[]
}>

async function runBackfillJob(
  input: DerivedBackfillExecutionInput,
  details: Readonly<{
    batchSize: number
    checkpointStream?: string
    executionSettings?: Readonly<Record<string, number>>
    kind: DerivedBackfillKind
    leaseDurationMinutes?: number
    maxBatches: number
    operation: string
    scopeKey: string
    source: string
  }>,
  jobRunner: typeof runIngestionJob | undefined,
  execute: () => Promise<
    Parameters<typeof runIngestionJob>[2] extends (runId: string) => Promise<infer Result> ? Result : never
  >
): Promise<JobResult> {
  const run = jobRunner ?? runIngestionJob
  const jobInput = {
    checkpointStream: details.checkpointStream,
    correlationId: input.correlationId,
    leaseDurationMinutes: details.leaseDurationMinutes,
    operation: details.operation,
    scope: {
      batchSize: details.batchSize,
      ...(details.executionSettings === undefined ? {} : { executionSettings: details.executionSettings }),
      kind: details.kind,
      maxBatches: details.maxBatches
    },
    scopeKey: details.scopeKey,
    source: details.source
  }
  if (input.workflowExecutionId === undefined) {
    return run(input.database, jobInput, execute)
  }
  return run(input.database, { ...jobInput, workflowExecutionId: input.workflowExecutionId }, execute)
}

async function drainBatches<Result extends { counts: JobCounts; failures: JobResult["failures"] }>(
  batchSize: number,
  maxBatches: number,
  process: () => Promise<Result>
): Promise<DrainResult> {
  const counts = createJobCounts()
  const failures: Array<JobResult["failures"][number]> = []
  let batches = 0
  let deferred = 0
  let hasMore = true
  const ocrDocumentIds: string[] = []
  const ocrMaterialIds: string[] = []
  while (batches < maxBatches && hasMore) {
    const result = await process()
    addCounts(counts, result.counts)
    if ("deferred" in result && typeof result.deferred === "number") {
      deferred += result.deferred
    }
    failures.push(...result.failures.slice(0, Math.max(0, MAX_REPORTED_FAILURES - failures.length)))
    if ("ocrDocumentIds" in result && Array.isArray(result.ocrDocumentIds)) {
      ocrDocumentIds.push(...result.ocrDocumentIds.filter((id): id is string => typeof id === "string"))
    }
    if ("ocrMaterialIds" in result && Array.isArray(result.ocrMaterialIds)) {
      ocrMaterialIds.push(...result.ocrMaterialIds.filter((id): id is string => typeof id === "string"))
    }
    batches += 1
    hasMore = result.counts.discovered === batchSize
  }
  return { batches, counts, deferred, failures, hasMore, ocrDocumentIds, ocrMaterialIds }
}

function combineDrainResults(left: DrainResult, right: DrainResult): DrainResult {
  const counts = createJobCounts()
  addCounts(counts, left.counts)
  addCounts(counts, right.counts)
  return {
    batches: left.batches + right.batches,
    counts,
    deferred: left.deferred + right.deferred,
    failures: [...left.failures, ...right.failures].slice(0, MAX_REPORTED_FAILURES),
    hasMore: right.hasMore,
    ocrDocumentIds: [...left.ocrDocumentIds, ...right.ocrDocumentIds],
    ocrMaterialIds: [...left.ocrMaterialIds, ...right.ocrMaterialIds]
  }
}

function productiveBatchCount(result: DrainResult): number {
  return result.counts.discovered === 0 ? 0 : result.batches
}

async function drainEmbeddingBatches(
  maxBatches: number,
  initialCheckpoint: EmbeddingDrainCheckpoint,
  embed: (checkpoint: EmbeddingDrainCheckpoint) => Promise<
    Readonly<{
      amendments: EmbeddingJobResult
      bills: EmbeddingJobResult
      materials: EmbeddingJobResult
      sections: EmbeddingJobResult
    }>
  >
): Promise<DrainResult & { checkpoint: EmbeddingDrainCheckpoint }> {
  const counts = createJobCounts()
  let batches = 0
  let checkpoint = initialCheckpoint
  let hasMore = !embeddingCheckpointComplete(checkpoint)
  while (batches < maxBatches && hasMore) {
    const result = await embed(checkpoint)
    const embedded =
      result.amendments.embedded + result.bills.embedded + result.sections.embedded + result.materials.embedded
    const skipped =
      result.amendments.skipped + result.bills.skipped + result.sections.skipped + result.materials.skipped
    counts.inserted += embedded
    counts.skipped += skipped
    batches += 1
    checkpoint = {
      amendments: nextEmbeddingProgress(checkpoint.amendments, result.amendments),
      bills: nextEmbeddingProgress(checkpoint.bills, result.bills),
      materials: nextEmbeddingProgress(checkpoint.materials, result.materials),
      sections: nextEmbeddingProgress(checkpoint.sections, result.sections)
    }
    hasMore = !embeddingCheckpointComplete(checkpoint)
  }
  return { batches, checkpoint, counts, deferred: 0, failures: [], hasMore, ocrDocumentIds: [], ocrMaterialIds: [] }
}

function completedEmbeddingJobResult(): EmbeddingJobResult {
  return { complete: true, cursor: "", embedded: 0, scanned: 0, skipped: 0 }
}

function nextEmbeddingProgress(
  current: Readonly<{ complete: boolean; cursor: string }>,
  result: EmbeddingJobResult
): Readonly<{ complete: boolean; cursor: string }> {
  return current.complete ? current : { complete: result.complete, cursor: result.cursor }
}

function embeddingCheckpointComplete(checkpoint: EmbeddingDrainCheckpoint): boolean {
  return (
    checkpoint.amendments.complete &&
    checkpoint.bills.complete &&
    checkpoint.sections.complete &&
    checkpoint.materials.complete
  )
}

async function loadEmbeddingCheckpoint(
  database: LegislationDatabase,
  stream: string
): Promise<EmbeddingDrainCheckpoint> {
  const existing = await database.query.syncCheckpoints.findFirst({
    where: and(eq(syncCheckpoints.source, "openrouter"), eq(syncCheckpoints.stream, stream))
  })
  return parseEmbeddingCheckpoint(existing?.cursor)
}

function parseEmbeddingCheckpoint(value: unknown): EmbeddingDrainCheckpoint {
  if (!isRecord(value) || !("embedding" in value)) {
    return initialEmbeddingCheckpoint
  }
  const embedding = value.embedding
  if (!isRecord(embedding)) {
    return initialEmbeddingCheckpoint
  }
  return {
    amendments: parseEmbeddingProgress(embedding, "amendments"),
    bills: parseEmbeddingProgress(embedding, "bills"),
    materials: parseEmbeddingProgress(embedding, "materials"),
    sections: parseEmbeddingProgress(embedding, "sections")
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseEmbeddingProgress(
  value: Record<string, unknown>,
  key: "amendments" | "bills" | "materials" | "sections"
): Readonly<{ complete: boolean; cursor: string }> {
  const progress = value[key]
  if (typeof progress !== "object" || progress === null) {
    return { complete: false, cursor: "" }
  }
  const complete = "complete" in progress && progress.complete === true
  const cursor = "cursor" in progress && typeof progress.cursor === "string" ? progress.cursor : ""
  return { complete, cursor }
}

function createDocumentArtifactStore(config: LegislationConfig): ArtifactStore {
  if (config.azure.storageAccount !== undefined) {
    return new AzureBlobArtifactStore(config.azure.storageAccount, config.azure.normalizedDocumentContainer)
  }
  return new LocalArtifactStore(resolve(config.ingestion.sourceDirectory, "documents"))
}

function documentHostLimiterOptions(config: LegislationConfig) {
  // A lease must outlive the request it protects. The extra margin keeps a
  // publisher slot owned while response bytes are being finalized, while the
  // finally release returns it immediately in the ordinary path.
  return {
    acquireTimeoutMs: config.backfill.documentHostAcquireTimeoutMs,
    defaultSlots: config.backfill.documentHostDefaultSlots,
    leaseDurationMs: Math.max(config.backfill.documentHostLeaseMs, config.ingestion.requestTimeoutMs + 30_000)
  }
}

function interruptedDocumentRecoveryDelayMs(config: LegislationConfig): number {
  return Math.max(
    // The worker can still hold active publisher requests until its Trigger
    // execution window ends. A timed-out replacement waits for that complete
    // window before reclaiming `processing` records from the previous owner.
    DERIVED_DOCUMENT_WORKER_MAX_DURATION_SECONDS * 1_000 + DOCUMENT_INTERRUPTION_RECOVERY_MARGIN_MS,
    config.backfill.documentHostAcquireTimeoutMs + config.ingestion.requestTimeoutMs * 2 + 30_000
  )
}

function documentExecutionSettings(
  config: LegislationConfig,
  shard: Readonly<{ count: number; index: number }> = { count: 1, index: 0 },
  documentPartition?: Readonly<{ count: number; index: number }>
): Readonly<Record<string, number>> {
  return {
    databasePoolMaxConnections: config.backfill.derivedDatabaseMaxConnections,
    documentHostAcquireTimeoutMs: config.backfill.documentHostAcquireTimeoutMs,
    documentHostDefaultSlots: config.backfill.documentHostDefaultSlots,
    documentHostLeaseMs: Math.max(config.backfill.documentHostLeaseMs, config.ingestion.requestTimeoutMs + 30_000),
    downloadConcurrency: config.ingestion.concurrency,
    ...(documentPartition === undefined
      ? {}
      : {
          documentPartitionCount: documentPartition.count,
          documentPartitionIndex: documentPartition.index
        }),
    shardCount: shard.count,
    shardIndex: shard.index
  }
}

function createEmbeddingClients(config: LegislationConfig): Record<EmbeddingJobKind, EmbeddingClient> {
  const apiKey = config.model.apiKey
  if (apiKey === undefined) {
    throw new Error("OPENROUTER_API_KEY is required for embedding backfill")
  }
  const create = (product: EmbeddingRouteProduct) =>
    new OpenRouterEmbeddingClient({
      apiKey,
      baseUrl: new URL(config.model.baseUrl),
      maximumAttempts: config.ingestion.maxAttempts,
      route: embeddingRouteFor(product),
      timeoutMs: config.ingestion.requestTimeoutMs
    })
  return {
    amendments: create("structured-amendment"),
    bills: create("bill"),
    materials: create("supporting-material-section"),
    sections: create("document-section")
  }
}

function requireEmbeddingClient(
  clients: Partial<Record<EmbeddingJobKind, EmbeddingClient>>,
  kind: EmbeddingJobKind
): EmbeddingClient {
  const client = clients[kind]
  if (client === undefined) {
    throw new Error(`Embedding client for ${kind} is not configured`)
  }
  return client
}

function normalizeShard(input: Readonly<{ shardCount?: number; shardIndex?: number }>): {
  count: number
  index: number
} {
  const count = boundedPositiveInteger(input.shardCount ?? 1, "shard count")
  const index = input.shardIndex ?? 0
  if (!Number.isSafeInteger(index) || index < 0 || index >= count) {
    throw new Error("Shard index must be a zero-based integer smaller than shard count")
  }
  return { count, index }
}

function normalizeDocumentPartition(
  input: Readonly<{
    documentPartitionCount?: number
    documentPartitionIndex?: number
    jurisdictionId?: string
  }>
): Readonly<{ count: number; index: number }> | undefined {
  if (input.documentPartitionCount === undefined && input.documentPartitionIndex === undefined) {
    return undefined
  }
  if (input.documentPartitionCount === undefined || input.documentPartitionIndex === undefined) {
    throw new Error("Document partition count and index must be configured together")
  }
  if (input.jurisdictionId === undefined) {
    throw new Error("Document partitioning requires an exact jurisdiction ID")
  }
  const count = boundedPositiveInteger(input.documentPartitionCount, "document partition count", 8)
  const index = input.documentPartitionIndex
  if (!Number.isSafeInteger(index) || index < 0 || index >= count) {
    throw new Error("Document partition index must be a zero-based integer smaller than partition count")
  }
  return count === 1 ? undefined : { count, index }
}

function documentJobIdentity(
  options: Pick<BillDocumentDrainOptions, "jurisdictionId" | "billId" | "documentId">,
  shard: Readonly<{ count: number; index: number }>,
  documentPartition: Readonly<{ count: number; index: number }> | undefined
): Readonly<{ operation: string; scopeKey: string }> {
  if (options.billId !== undefined || options.documentId !== undefined) {
    const target = options.billId !== undefined ? `bill:${options.billId}` : `document:${options.documentId}`
    return { operation: "process-documents", scopeKey: `target:${createHash("sha256").update(target).digest("hex")}` }
  }
  if (documentPartition !== undefined) {
    return {
      operation: `process-documents-jurisdiction-${options.jurisdictionId}-partition-${documentPartition.index}-of-${documentPartition.count}`,
      scopeKey: `jurisdiction:${options.jurisdictionId}:partition:${documentPartition.index}-of-${documentPartition.count}`
    }
  }
  if (shard.count === 1) {
    return {
      operation: "process-documents",
      scopeKey: options.jurisdictionId === undefined ? "all" : `jurisdiction:${options.jurisdictionId}`
    }
  }
  return { operation: `process-documents-shard-${shard.index}`, scopeKey: `shard:${shard.index}-of-${shard.count}` }
}

function shouldClassifyUnavailableCaliforniaPdfs(options: BillDocumentDrainOptions): boolean {
  return (
    options.billId === undefined &&
    options.documentId === undefined &&
    options.failureCategory === undefined &&
    options.force !== true &&
    options.jurisdictionId === undefined &&
    options.status === undefined
  )
}

function boundedPositiveInteger(value: number, name: string, maximum?: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || (maximum !== undefined && value > maximum)) {
    throw new Error(`${name} must be a positive integer${maximum === undefined ? "" : ` no greater than ${maximum}`}`)
  }
  return value
}

function addCounts(target: JobCounts, source: JobCounts): void {
  target.discovered += source.discovered
  target.failed += source.failed
  target.inserted += source.inserted
  target.read += source.read
  target.skipped += source.skipped
  target.unchanged += source.unchanged
  target.updated += source.updated
}

function drainCheckpoint(
  kind: DerivedBackfillKind,
  result: DrainResult,
  hasOutstandingWork = result.hasMore
): Readonly<Record<string, unknown>> {
  return {
    batches: result.batches,
    complete: !hasOutstandingWork,
    kind
  }
}
