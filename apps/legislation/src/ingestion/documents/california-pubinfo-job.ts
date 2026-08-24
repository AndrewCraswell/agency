import { createHash } from "node:crypto"
import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { billDocuments, bills } from "../../db/schema/schema.js"
import type { ArtifactStore } from "./artifact-store.js"
import { artifactPath } from "./artifact-store.js"
import {
  californiaPubinfoDocumentKey,
  californiaPubinfoLobIndex,
  readCaliforniaPubinfoTables,
  visitCaliforniaPubinfoLobs
} from "./california-pubinfo.js"
import { detectDocumentContentType } from "./download.js"
import { documentRetryAt } from "./jobs.js"
import { classifyDocumentFailure, markDocumentProcessingFailure, persistProcessedDocument } from "./process.js"

export interface CaliforniaPubinfoJobResult {
  claimed: number
  failed: number
  missing: number
  processed: number
}

interface PubinfoCandidate {
  id: string
  processingAttempts: number
  sourceUrl: string
}

export async function processCaliforniaPubinfoArchive(
  database: LegislationDatabase,
  artifactStore: ArtifactStore,
  source: () => AsyncIterable<Uint8Array>,
  options: Readonly<{ concurrency?: number; limit?: number; maximumAttempts: number; sessionStartYear: number }>
): Promise<CaliforniaPubinfoJobResult> {
  const { sessionStartYear } = options
  if (!Number.isSafeInteger(sessionStartYear) || sessionStartYear < 1989 || sessionStartYear % 2 !== 1) {
    throw new Error("California PUBINFO session start year must be an odd year beginning with 1989")
  }
  const limit = Math.min(Math.max(options.limit ?? 50_000, 1), 50_000)
  const tables = await readCaliforniaPubinfoTables(source())
  const lobIndex = californiaPubinfoLobIndex(tables)
  const sessionId = `session:ca:${sessionStartYear}${sessionStartYear + 1}`
  const now = new Date()
  const available = await database
    .select({
      id: billDocuments.id,
      processingAttempts: billDocuments.processingAttempts,
      sourceUrl: billDocuments.sourceUrl
    })
    .from(billDocuments)
    .innerJoin(bills, eq(billDocuments.billId, bills.id))
    .where(
      and(
        eq(bills.jurisdictionId, "jurisdiction:ca"),
        eq(bills.sessionId, sessionId),
        inArray(billDocuments.processingStatus, ["failed", "pending"]),
        lt(billDocuments.processingAttempts, options.maximumAttempts),
        or(isNull(billDocuments.nextAttemptAt), lte(billDocuments.nextAttemptAt, now))
      )
    )
    .orderBy(asc(billDocuments.updatedAt), asc(billDocuments.id))
  const matched = available
    .map((record) => {
      const key = californiaPubinfoDocumentKey(record.sourceUrl)
      const lob = key === undefined ? undefined : lobIndex.get(key)
      return lob === undefined ? undefined : { ...record, lob }
    })
    .filter((record): record is PubinfoCandidate & { lob: string } => record !== undefined)
    .slice(0, limit)
  if (matched.length === 0) {
    return { claimed: 0, failed: 0, missing: 0, processed: 0 }
  }

  const claimed = await database.transaction(async (transaction) => {
    const records = await transaction
      .select({
        id: billDocuments.id,
        processingAttempts: billDocuments.processingAttempts,
        sourceUrl: billDocuments.sourceUrl
      })
      .from(billDocuments)
      .where(
        and(
          inArray(
            billDocuments.id,
            matched.map(({ id }) => id)
          ),
          inArray(billDocuments.processingStatus, ["failed", "pending"])
        )
      )
      .orderBy(asc(billDocuments.id))
      .for("update", { skipLocked: true })
    if (records.length > 0) {
      await transaction
        .update(billDocuments)
        .set({
          lastAttemptAt: now,
          nextAttemptAt: null,
          ocrCompletedAt: null,
          ocrPageCount: null,
          ocrProvider: null,
          // PUBINFO archival ingestion is source extraction, not OCR. An OCR
          // worker alone may claim the OCR processing lifecycle state.
          ocrStatus: null,
          processingAttempts: sql`${billDocuments.processingAttempts} + 1`,
          processingError: null,
          processingErrorCategory: null,
          processingStatus: "processing",
          updatedAt: now
        })
        .where(
          inArray(
            billDocuments.id,
            records.map(({ id }) => id)
          )
        )
    }
    return records
  })
  const matchedById = new Map(matched.map((record) => [record.id, record]))
  const recordsByLob = new Map<string, PubinfoCandidate[]>()
  for (const record of claimed) {
    const lob = matchedById.get(record.id)?.lob
    if (lob === undefined) {
      continue
    }
    const records = recordsByLob.get(lob) ?? []
    records.push(record)
    recordsByLob.set(lob, records)
  }

  let failed = 0
  let processed = 0
  const visited = await visitCaliforniaPubinfoLobs(
    source(),
    new Set(recordsByLob.keys()),
    async (lob, bytes) => {
      for (const record of recordsByLob.get(lob) ?? []) {
        let persistedArtifact: { blobPath: string; contentType: string } | undefined
        try {
          const contentType = detectDocumentContentType(bytes, "")
          const contentHash = createHash("sha256").update(bytes).digest("hex")
          const blobPath = artifactPath("documents", record.id, contentHash, record.sourceUrl)
          await artifactStore.put(blobPath, bytes)
          persistedArtifact = { blobPath, contentType }
          await persistProcessedDocument(
            database,
            { blobPath, bytes, contentType, documentId: record.id },
            { skipUnchangedCheck: true }
          )
          processed += 1
        } catch (error) {
          const failure = classifyDocumentFailure(error, record.sourceUrl)
          const attempt = record.processingAttempts + 1
          const retryable = failure.retryable && attempt < options.maximumAttempts
          await markDocumentProcessingFailure(database, record.id, {
            category: failure.category,
            ...persistedArtifact,
            ...(retryable ? { nextAttemptAt: documentRetryAt(attempt) } : {}),
            processingError: failure.message,
            status: retryable ? "failed" : "unsupported"
          })
          failed += 1
        }
      }
    },
    options.concurrency
  )
  const missingRecords = [...recordsByLob].filter(([lob]) => !visited.has(lob)).flatMap(([, records]) => records)
  if (missingRecords.length > 0) {
    await database
      .update(billDocuments)
      .set({
        lastAttemptAt: null,
        nextAttemptAt: null,
        ocrCompletedAt: null,
        ocrPageCount: null,
        ocrProvider: null,
        ocrStatus: null,
        processingAttempts: sql`greatest(${billDocuments.processingAttempts} - 1, 0)`,
        processingStatus: "pending",
        updatedAt: new Date()
      })
      .where(
        inArray(
          billDocuments.id,
          missingRecords.map(({ id }) => id)
        )
      )
  }
  return { claimed: claimed.length, failed, missing: missingRecords.length, processed }
}
