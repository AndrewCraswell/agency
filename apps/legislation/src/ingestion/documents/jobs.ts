import { createHash } from "node:crypto"
import { and, asc, eq, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { billDocuments, bills } from "../../db/schema/schema.js"
import { createJobCounts, mapConcurrent, type JobCounts } from "../job.js"
import { artifactPath, type ArtifactStore } from "./artifact-store.js"
import { detectDocumentContentType, downloadDocument } from "./download.js"
import {
  classifyDocumentFailure,
  markDocumentProcessingFailure,
  persistProcessedDocument,
  type DocumentFailureCategory
} from "./process.js"

const MAX_REPORTED_FAILURES = 20
const MAX_UPDATE_BATCH_SIZE = 1000
const RETRY_BASE_DELAY_MS = 5 * 60 * 1000
const RETRY_MAX_DELAY_MS = 6 * 60 * 60 * 1000

export const DOCUMENT_REMEDIATION_COHORTS = [
  "alaska-pdf-label",
  "arkansas-ftp",
  "california-bill-pdf",
  "image-ocr",
  "inaccessible-hosts",
  "office-open-xml"
] as const
export type DocumentRemediationCohort = (typeof DOCUMENT_REMEDIATION_COHORTS)[number]

export interface DocumentJobResult {
  counts: JobCounts & { processed: number; unsupported: number }
  failures: Array<
    Readonly<{ category: DocumentFailureCategory; identifier?: string; message: string; retryable: boolean }>
  >
}

export function documentRetryAt(attempt: number, from = new Date()): Date {
  const exponent = Math.max(0, Math.min(attempt - 1, 30))
  const delay = Math.min(RETRY_BASE_DELAY_MS * 2 ** exponent, RETRY_MAX_DELAY_MS)
  return new Date(from.getTime() + delay)
}

export async function prepareDocumentRemediation(
  database: LegislationDatabase,
  cohort: DocumentRemediationCohort,
  limit = 10_000
): Promise<{ identifiers: string[]; prepared: number }> {
  const boundedLimit = Math.min(Math.max(limit, 1), 100_000)
  let result
  if (cohort === "california-bill-pdf") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
          with candidates as materialized (
            select id
            from legislation.bill_documents
            where source_url like 'https://leginfo.legislature.ca.gov/faces/billPdf.xhtml?%'
              and (
                (
                  processing_status = 'processed'
                  and (
                    lower(btrim(coalesce(text, ''))) = 'download bill pdf'
                    or lower(coalesce(text, '')) like '%for full functionality of this site it is necessary to enable javascript%california legislative information%'
                  )
                )
                or (
                  processing_status = 'unsupported'
                  and (
                    coalesce(processing_error, '') ilike '%invalid pdf structure%'
                    or coalesce(processing_error, '') ilike '%publisher navigation%'
                  )
                )
              )
            limit ${boundedLimit}
            for update skip locked
          ), removed_sections as (
            delete from legislation.document_sections sections
            using candidates
            where sections.document_id = candidates.id
          ), updated as (
            update legislation.bill_documents documents
            set blob_path = null,
              content_hash = null,
              content_type = null,
              last_attempt_at = null,
              next_attempt_at = null,
              processing_attempts = 0,
              processing_error = null,
              processing_error_category = null,
              processing_status = 'pending',
              text = null,
              updated_at = now()
            from candidates
            where documents.id = candidates.id
            returning documents.id
          )
          select count(*)::int as prepared,
            coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
          from updated
        `)
  } else if (cohort === "alaska-pdf-label") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'unsupported'
                and (
                  lower(coalesce(content_type, '')) = 'pdf'
                  or processing_error ilike '%unsupported document content type: pdf%'
                )
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "arkansas-ftp") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'unsupported'
                and processing_error_category = 'unsafe-url'
                and lower(source_url) like 'ftp://www.arkleg.state.ar.us/bills/%'
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                source_url = 'https://www.arkleg.state.ar.us/Home/FTPDocument?path='
                  || substring(documents.source_url from 'ftp://www.arkleg.state.ar.us(.*)$'),
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "office-open-xml") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'unsupported'
                and processing_error_category = 'unsupported-format'
                and (
                  lower(coalesce(content_type, '')) in (
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                  )
                  or coalesce(processing_error, '') ~* 'unsupported document content type: application/vnd\\.openxmlformats-officedocument\\.(presentationml\\.presentation|spreadsheetml\\.sheet|wordprocessingml\\.document)'
                )
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else {
    const terminalCategory = cohort === "image-ocr" ? "ocr-required" : "source-inaccessible"
    const terminalSelection =
      cohort === "image-ocr"
        ? sql`(
            coalesce(processing_error, '') ilike '%image-only%'
            or lower(coalesce(content_type, '')) like 'image/%'
            or coalesce(processing_error, '') ~* 'unsupported document content type: (image/)?(gif|jpe?g|png|tiff?|bmp|webp)'
          )`
        : sql`lower(split_part(split_part(source_url, '://', 2), '/', 1)) = 'alisondb.legislature.state.al.us'`
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status in ('failed', 'unsupported')
                and processing_error_category is distinct from ${terminalCategory}
                and ${terminalSelection}
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set next_attempt_at = null,
                processing_error_category = ${terminalCategory},
                processing_status = 'unsupported',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  }
  return result.rows[0] ?? { identifiers: [], prepared: 0 }
}

export async function classifyTerminalDocumentFailures(
  database: LegislationDatabase,
  limit = 100_000
): Promise<{ inspected: number; retryable: number; terminal: number; updated: number }> {
  const records = await database
    .select({
      id: billDocuments.id,
      processingError: billDocuments.processingError,
      sourceUrl: billDocuments.sourceUrl
    })
    .from(billDocuments)
    .where(
      and(
        inArray(billDocuments.processingStatus, ["failed", "unsupported"]),
        isNull(billDocuments.processingErrorCategory),
        isNotNull(billDocuments.processingError)
      )
    )
    .orderBy(asc(billDocuments.id))
    .limit(Math.min(Math.max(limit, 1), 100_000))
  const classifiedByDisposition = Map.groupBy(
    records.flatMap((record) => {
      if (record.processingError === null) {
        return []
      }
      const failure = classifyDocumentFailure(record.processingError, record.sourceUrl)
      return [{ category: failure.category, id: record.id, retryable: failure.retryable }]
    }),
    (record) => `${record.retryable ? "retryable" : "terminal"}:${record.category}`
  )
  let updated = 0
  let retryable = 0
  let terminal = 0
  for (const recordsForDisposition of classifiedByDisposition.values()) {
    const first = recordsForDisposition[0]
    if (first === undefined) {
      continue
    }
    const ids = recordsForDisposition.map((record) => record.id)
    for (let offset = 0; offset < ids.length; offset += MAX_UPDATE_BATCH_SIZE) {
      const batch = ids.slice(offset, offset + MAX_UPDATE_BATCH_SIZE)
      await database
        .update(billDocuments)
        .set({
          nextAttemptAt: null,
          processingErrorCategory: first.category,
          processingStatus: first.retryable ? "failed" : "unsupported",
          updatedAt: new Date()
        })
        .where(inArray(billDocuments.id, batch))
      updated += batch.length
      if (first.retryable) {
        retryable += batch.length
      } else {
        terminal += batch.length
      }
    }
  }
  return { inspected: records.length, retryable, terminal, updated }
}

export async function requeueInterruptedDocuments(database: LegislationDatabase, before: Date): Promise<number> {
  const result = await database.execute<{ requeued: number }>(sql`
    with requeued as (
      update legislation.bill_documents
      set next_attempt_at = null,
        processing_error = null,
        processing_error_category = null,
        processing_status = 'pending',
        updated_at = now()
      where processing_status = 'processing' and last_attempt_at < ${before}
      returning id
    )
    select count(*)::int as requeued from requeued
  `)
  return result.rows[0]?.requeued ?? 0
}

export async function processPendingDocuments(
  database: LegislationDatabase,
  options: Readonly<{
    artifactStore: ArtifactStore
    billId?: string
    concurrency: number
    documentId?: string
    failureCategory?: DocumentFailureCategory
    fetch?: typeof fetch
    force?: boolean
    jurisdictionId?: string
    limit?: number
    maximumAttempts: number
    shardCount?: number
    shardIndex?: number
    status?: "failed" | "pending" | "unsupported"
    timeoutMs?: number
  }>
): Promise<DocumentJobResult> {
  const limit = Math.min(options.limit ?? 100, 1000)
  const claimStartedAt = new Date()
  let processingSelection = inArray(billDocuments.processingStatus, ["pending", "failed"])
  if (options.documentId !== undefined) {
    processingSelection = eq(billDocuments.id, options.documentId)
  } else if (options.status !== undefined) {
    processingSelection = eq(billDocuments.processingStatus, options.status)
  }
  const records = await database.transaction(async (transaction) => {
    const selected = await transaction
      .select({
        blobPath: billDocuments.blobPath,
        contentType: billDocuments.contentType,
        id: billDocuments.id,
        processingAttempts: billDocuments.processingAttempts,
        processingStatus: billDocuments.processingStatus,
        sourceUrl: billDocuments.sourceUrl
      })
      .from(billDocuments)
      .where(
        and(
          processingSelection,
          options.billId === undefined ? undefined : eq(billDocuments.billId, options.billId),
          options.jurisdictionId === undefined
            ? undefined
            : sql`exists (select 1 from ${bills} where ${bills.id} = ${billDocuments.billId} and ${bills.jurisdictionId} = ${options.jurisdictionId})`,
          options.failureCategory === undefined
            ? undefined
            : eq(billDocuments.processingErrorCategory, options.failureCategory),
          options.force === true
            ? undefined
            : and(
                or(
                  eq(billDocuments.processingStatus, "processed"),
                  lt(billDocuments.processingAttempts, options.maximumAttempts)
                ),
                or(
                  sql`${billDocuments.processingStatus} <> 'failed'`,
                  isNull(billDocuments.nextAttemptAt),
                  lte(billDocuments.nextAttemptAt, claimStartedAt)
                )
              ),
          (options.shardCount ?? 1) === 1
            ? undefined
            : sql`((hashtextextended(${billDocuments.id}, 0) % ${options.shardCount ?? 1}) + ${options.shardCount ?? 1}) % ${options.shardCount ?? 1} = ${options.shardIndex ?? 0}`
        )
      )
      .orderBy(asc(billDocuments.id))
      .limit(limit)
      .for("update", { skipLocked: true })
    const claimedIds = selected
      .filter((record) => record.processingStatus !== "processed" || options.force === true)
      .map((record) => record.id)
    if (claimedIds.length > 0) {
      await transaction
        .update(billDocuments)
        .set({
          lastAttemptAt: claimStartedAt,
          nextAttemptAt: null,
          processingAttempts: sql`${billDocuments.processingAttempts} + 1`,
          processingError: null,
          processingErrorCategory: null,
          processingStatus: "processing",
          updatedAt: claimStartedAt
        })
        .where(inArray(billDocuments.id, claimedIds))
    }
    return selected
  })
  const counts = { ...createJobCounts({ discovered: records.length }), processed: 0, unsupported: 0 }
  const failures: DocumentJobResult["failures"] = []

  await mapConcurrent(records, options.concurrency, async (record) => {
    if (record.processingStatus === "processed" && options.force !== true) {
      counts.skipped += 1
      counts.unchanged += 1
      return
    }
    let persistedArtifact: { blobPath: string; contentType: string } | undefined
    try {
      const existingArtifactPath = options.force === true ? null : record.blobPath
      const hasArtifact = existingArtifactPath !== null && (await options.artifactStore.exists(existingArtifactPath))
      const downloaded = hasArtifact
        ? await options.artifactStore.read(existingArtifactPath).then((bytes) => ({
            bytes,
            contentType: detectDocumentContentType(bytes, record.contentType ?? ""),
            sourceUrl: record.sourceUrl
          }))
        : await downloadDocument(record.sourceUrl, { fetch: options.fetch, timeoutMs: options.timeoutMs })
      const contentHash = createHash("sha256").update(downloaded.bytes).digest("hex")
      const path = artifactPath("documents", record.id, contentHash, downloaded.sourceUrl)
      if (!hasArtifact) {
        await options.artifactStore.put(path, downloaded.bytes)
      }
      persistedArtifact = { blobPath: path, contentType: downloaded.contentType }
      const outcome = await persistProcessedDocument(
        database,
        {
          ...persistedArtifact,
          bytes: downloaded.bytes,
          documentId: record.id
        },
        { skipUnchangedCheck: true }
      )
      counts.read += 1
      if (outcome === "unchanged") {
        counts.unchanged += 1
      } else {
        counts.processed += 1
        counts.updated += 1
      }
    } catch (error) {
      const failure = classifyDocumentFailure(error, record.sourceUrl)
      const attempt = record.processingAttempts + 1
      const retryable = failure.retryable && attempt < options.maximumAttempts
      const unsupported = !failure.retryable
      await markDocumentProcessingFailure(database, record.id, {
        ...persistedArtifact,
        category: failure.category,
        nextAttemptAt: retryable ? documentRetryAt(attempt) : undefined,
        processingError: failure.message,
        status: unsupported ? "unsupported" : "failed"
      })
      counts.failed += 1
      if (unsupported) {
        counts.unsupported += 1
      }
      if (failures.length < MAX_REPORTED_FAILURES) {
        failures.push({
          category: failure.category,
          identifier: record.id,
          message: failure.message,
          retryable
        })
      }
    }
  })
  return { counts, failures }
}
