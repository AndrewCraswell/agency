import { and, asc, eq, gt, inArray, isNotNull, isNull, like, lt, lte, or } from "drizzle-orm"
import { z } from "zod"
import { billDocuments, bills, syncCheckpoints } from "../../db/schema/schema.js"
import { legislativeSessionId } from "../../legislation/identifiers.js"
import { drainBillDocuments, drainEmbeddings, type DerivedBackfillExecutionInput } from "../backfill/derived.js"
import type { ArtifactStore } from "../documents/artifact-store.js"
import type { OcrClient } from "../documents/ocr-client.js"
import { processOcrRequiredDocuments } from "../documents/ocr-jobs.js"
import { OCR_MAXIMUM_ATTEMPTS } from "../documents/ocr-retry.js"
import { createJobCounts, runIngestionJob } from "../job.js"
import { advanceStateContentCheckpoint, readStateContentCheckpoint } from "./state-content-checkpoint.js"
import { runStateContentBills } from "./state-content-concurrency.js"

export const stateContentScope = z.enum(["nc", "ak"])

/** Canonical pending/freshness state is the durable work source, including after a missed callback.
 * Scan rounds deliberately restart: late OCR and updated bills can sort before the last cursor.
 * A scan round is NOT an ingestion/search readiness verdict.
 */
export async function processStateContentBatch(
  input: DerivedBackfillExecutionInput,
  options: {
    state: "nc" | "ak"
    session?: string
    billLimit?: number
    documentLimit?: number
    billConcurrency?: number
    artifactStore: ArtifactStore
    ocr?: OcrClient
  }
) {
  const state = stateContentScope.parse(options.state)
  const billConcurrency = z
    .number()
    .int()
    .min(1)
    .max(4)
    .parse(options.billConcurrency ?? 1)
  const billLimit = z
    .number()
    .int()
    .min(1)
    .max(10)
    .parse(options.billLimit ?? 2)
  const documentLimit = z
    .number()
    .int()
    .min(1)
    .max(10)
    .parse(options.documentLimit ?? 2)
  const requestedSession = z
    .string()
    .regex(/^[A-Za-z0-9-]+$/)
    .parse(options.session ?? (state === "nc" ? "2025" : "34"))
  const session = legislativeSessionId(state, requestedSession).slice(`session:${state}:`.length)
  if (!input.config.model.apiKey) {
    throw new Error("State content processing requires an embedding provider key before starting")
  }
  const prefix = `bill:${state}:${session}:`
  const stream = `content:${state}:${session}`
  return runIngestionJob(
    input.database,
    {
      source: "openstates-content",
      operation: "process-state-content",
      scopeKey: `${state}:${session}`,
      checkpointStream: stream,
      correlationId: input.correlationId,
      workflowExecutionId: input.workflowExecutionId,
      leaseDurationMinutes: 60,
      scope: { state, session, billLimit, documentLimit, billConcurrency }
    },
    async (runId) => {
      const existing = await input.database.query.syncCheckpoints.findFirst({
        where: and(eq(syncCheckpoints.source, "openstates-content"), eq(syncCheckpoints.stream, stream))
      })
      const cursor = readStateContentCheckpoint(existing?.cursor, prefix)
      const previous = cursor.afterBillId
      const carried = cursor.pendingEmbeddingBillIds.slice(0, billLimit)
      // Give one free slot to due document work, including newly requeued files
      // behind the scan cursor. Do not move the discovery cursor for this work.
      if (carried.length < billLimit) {
        const due = await input.database
          .selectDistinct({ id: billDocuments.billId })
          .from(billDocuments)
          .where(
            and(
              like(billDocuments.billId, `${prefix}%`),
              eq(billDocuments.processingStatus, "pending"),
              lt(billDocuments.processingAttempts, input.config.ingestion.maxAttempts),
              or(isNull(billDocuments.nextAttemptAt), lte(billDocuments.nextAttemptAt, new Date()))
            )
          )
          .orderBy(asc(billDocuments.billId))
          .limit(billLimit)
        const priority = due.find((bill) => !carried.includes(bill.id))
        if (priority !== undefined) {
          carried.push(priority.id)
        }
      }
      const discoveryLimit = billLimit - carried.length
      const pending =
        carried.length === 0
          ? []
          : await input.database
              .select({ id: bills.id })
              .from(bills)
              .where(inArray(bills.id, carried))
              .orderBy(asc(bills.id))
      const discovered =
        discoveryLimit === 0
          ? []
          : await input.database
              .select({ id: bills.id })
              .from(bills)
              .where(and(like(bills.id, `${prefix}%`), gt(bills.id, previous)))
              .orderBy(asc(bills.id))
              .limit(discoveryLimit)
      const selected = [...pending, ...discovered.filter((bill) => !carried.includes(bill.id))]
      const pendingEmbeddingBillIds = cursor.pendingEmbeddingBillIds.slice(billLimit)
      const counts = createJobCounts()
      const outcomes: Array<Record<string, unknown>> = []
      await runStateContentBills(selected, billConcurrency, async (bill) => {
        const documents = await drainBillDocuments(
          input,
          { billId: bill.id, jurisdictionId: `jurisdiction:${state}`, batchSize: documentLimit, maxBatches: 1 },
          { artifactStore: options.artifactStore }
        )
        // Query durable OCR state, not only IDs returned by this document attempt.
        const required = await input.database
          .select({ id: billDocuments.id })
          .from(billDocuments)
          .where(
            and(
              eq(billDocuments.billId, bill.id),
              eq(billDocuments.processingStatus, "unsupported"),
              eq(billDocuments.processingErrorCategory, "ocr-required"),
              isNotNull(billDocuments.blobPath),
              lt(billDocuments.processingAttempts, Math.min(input.config.ocr.maximumAttempts, OCR_MAXIMUM_ATTEMPTS)),
              or(isNull(billDocuments.nextAttemptAt), lte(billDocuments.nextAttemptAt, new Date()))
            )
          )
          .orderBy(asc(billDocuments.id))
          .limit(documentLimit)
        const ocr =
          required.length > 0 && options.ocr
            ? await processOcrRequiredDocuments(input.database, {
                artifactStore: options.artifactStore,
                documentIds: required.map((document) => document.id),
                batchSize: documentLimit,
                concurrency: 1,
                maximumAttempts: input.config.ocr.maximumAttempts,
                ocr: options.ocr,
                ownerId: runId
              })
            : undefined
        const embeddings = await drainEmbeddings(input, {
          billId: bill.id,
          products: ["bills", "sections"],
          batchSize: 16,
          maxBatches: 1
        })
        if (embeddings.status !== "succeeded") {
          throw new Error("State content embedding batch did not succeed")
        }
        if (embeddings.checkpoint?.complete !== true) {
          pendingEmbeddingBillIds.push(bill.id)
        }
        counts.read += 1
        counts.updated += documents.counts.updated + embeddings.counts.inserted + (ocr?.processed ?? 0)
        outcomes.push({
          billId: bill.id,
          documents: documents.counts,
          documentFailures: documents.failures.length,
          ocrRequiredSample: required.length,
          ocrConfigurationMissing: required.length > 0 && !options.ocr,
          ocrProcessed: ocr?.processed ?? 0,
          ocrFailed: ocr?.failed ?? 0,
          embeddings: embeddings.counts,
          embeddingPassComplete: embeddings.checkpoint?.complete === true
        })
      })
      return {
        counts,
        failures: [],
        checkpoint: {
          ...advanceStateContentCheckpoint({
            previous,
            discovered: discovered.map((bill) => bill.id),
            discoveryLimit,
            pendingEmbeddingBillIds
          }),
          ingestionComplete: false,
          searchVerified: false,
          outcomes
        }
      }
    }
  )
}
