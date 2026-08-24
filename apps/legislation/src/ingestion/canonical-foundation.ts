import { and, eq } from "drizzle-orm"
import { z } from "zod"
import type { LegislationDatabase } from "../db/database.js"
import { jurisdictions, legislativeSessions, syncCheckpoints } from "../db/schema/schema.js"
import { createJobCounts, type JobCounts } from "./job.js"

const canonicalFoundationSourceSchema = z
  .object({
    isOfficial: z.boolean(),
    provider: z.string().trim().min(1).max(120),
    retrievedAt: z.iso.datetime({ offset: true }),
    sourceUpdatedAt: z.iso.datetime({ offset: true }).nullable(),
    url: z.url({ protocol: /^https$/ })
  })
  .strict()

const canonicalJurisdictionFoundationRecordSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    isActive: z.boolean(),
    kind: z.literal("jurisdiction"),
    source: canonicalFoundationSourceSchema,
    timezone: z.string().trim().min(1).max(120).nullable()
  })
  .strict()

const canonicalSessionFoundationRecordSchema = z
  .object({
    classification: z.string().trim().min(1).max(120),
    id: z.string().trim().min(1).max(200),
    isActive: z.boolean(),
    kind: z.literal("session"),
    source: canonicalFoundationSourceSchema
  })
  .strict()

export const canonicalFoundationRecordSchema = z.discriminatedUnion("kind", [
  canonicalJurisdictionFoundationRecordSchema,
  canonicalSessionFoundationRecordSchema
])

export type CanonicalFoundationRecord = z.output<typeof canonicalFoundationRecordSchema>

export const canonicalFoundationCheckpointSource = "canonical-foundation"
export const canonicalFoundationCheckpointStream = "jurisdictions-sessions"
const contentHashSchema = z.string().regex(/^[0-9a-f]{64}$/, "contentHash must be a lowercase SHA-256 hex digest")

export function parseCanonicalFoundationContentHash(value: unknown): string {
  return contentHashSchema.parse(value)
}

type FoundationRow = Readonly<{
  id: string
  isActive: boolean | null
  provenanceComplete: boolean
  sourceIsOfficial: boolean | null
  sourceProvider: string | null
  sourceRetrievedAt: Date | null
  sourceUrl: string | null
}>

type SessionFoundationRow = FoundationRow & Readonly<{ classification: string | null }>

export type CanonicalFoundationAudit = Readonly<{
  complete: boolean
  incompleteJurisdictionIds: readonly string[]
  incompleteSessionIds: readonly string[]
}>

export type CanonicalFoundationImportResult = Readonly<{
  audit: CanonicalFoundationAudit
  checkpoint: Readonly<Record<string, unknown>>
  counts: JobCounts
  failures: ReadonlyArray<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
}>

export function isJurisdictionFoundationComplete(row: FoundationRow): boolean {
  return (
    row.isActive !== null &&
    row.provenanceComplete &&
    row.sourceUrl !== null &&
    row.sourceProvider !== null &&
    row.sourceRetrievedAt !== null &&
    row.sourceIsOfficial !== null
  )
}

export function isSessionFoundationComplete(row: SessionFoundationRow): boolean {
  return isJurisdictionFoundationComplete(row) && row.classification !== null
}

/**
 * Audits the exact facts required by the jurisdiction and session projections.
 * This deliberately fails closed: a partial source record is not route-ready.
 */
export async function auditCanonicalFoundation(database: LegislationDatabase): Promise<CanonicalFoundationAudit> {
  const [jurisdictionRows, sessionRows] = await Promise.all([
    database
      .select({
        id: jurisdictions.id,
        isActive: jurisdictions.isActive,
        provenanceComplete: jurisdictions.provenanceComplete,
        sourceIsOfficial: jurisdictions.sourceIsOfficial,
        sourceProvider: jurisdictions.sourceProvider,
        sourceRetrievedAt: jurisdictions.sourceRetrievedAt,
        sourceUrl: jurisdictions.sourceUrl
      })
      .from(jurisdictions)
      .orderBy(jurisdictions.id),
    database
      .select({
        classification: legislativeSessions.classification,
        id: legislativeSessions.id,
        isActive: legislativeSessions.isActive,
        provenanceComplete: legislativeSessions.provenanceComplete,
        sourceIsOfficial: legislativeSessions.sourceIsOfficial,
        sourceProvider: legislativeSessions.sourceProvider,
        sourceRetrievedAt: legislativeSessions.sourceRetrievedAt,
        sourceUrl: legislativeSessions.sourceUrl
      })
      .from(legislativeSessions)
      .orderBy(legislativeSessions.id)
  ])
  const incompleteJurisdictionIds = jurisdictionRows
    .filter((row) => !isJurisdictionFoundationComplete(row))
    .map((row) => row.id)
  const incompleteSessionIds = sessionRows.filter((row) => !isSessionFoundationComplete(row)).map((row) => row.id)
  return {
    complete: incompleteJurisdictionIds.length === 0 && incompleteSessionIds.length === 0,
    incompleteJurisdictionIds,
    incompleteSessionIds
  }
}

/**
 * Persists only a complete source-backed foundation record. It updates an
 * existing canonical record and refuses to manufacture a jurisdiction or
 * session from a provider identity alone.
 */
export async function applyCanonicalFoundationRecord(
  database: LegislationDatabase,
  record: CanonicalFoundationRecord
): Promise<void> {
  const source = {
    provenanceComplete: true,
    sourceIsOfficial: record.source.isOfficial,
    sourceProvider: record.source.provider,
    sourceRetrievedAt: new Date(record.source.retrievedAt),
    sourceUpdatedAt: record.source.sourceUpdatedAt === null ? null : new Date(record.source.sourceUpdatedAt),
    sourceUrl: record.source.url,
    updatedAt: new Date()
  }
  if (record.kind === "jurisdiction") {
    const updated = await database
      .update(jurisdictions)
      .set({ ...source, isActive: record.isActive, timezone: record.timezone })
      .where(eq(jurisdictions.id, record.id))
      .returning({ id: jurisdictions.id })
    if (updated.length === 0) {
      throw new Error(`Canonical foundation source referenced unknown jurisdiction: ${record.id}`)
    }
    return
  }
  const updated = await database
    .update(legislativeSessions)
    .set({ ...source, classification: record.classification, isActive: record.isActive })
    .where(eq(legislativeSessions.id, record.id))
    .returning({ id: legislativeSessions.id })
  if (updated.length === 0) {
    throw new Error(`Canonical foundation source referenced unknown session: ${record.id}`)
  }
}

/**
 * Resumes a supplied authoritative source snapshot at its durable checkpoint.
 * It marks the stream complete only after every current canonical record passes
 * the same fail-closed audit used to gate jurisdiction and session routes.
 */
export async function importCanonicalFoundationRecords(
  database: LegislationDatabase,
  records: readonly unknown[],
  options: Readonly<{ contentHash: string; stream?: string }>
): Promise<CanonicalFoundationImportResult> {
  const stream = options.stream ?? canonicalFoundationCheckpointStream
  const contentHash = parseCanonicalFoundationContentHash(options.contentHash)
  const counts = createJobCounts({ discovered: records.length })
  const failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>> = []
  const existing = await database.query.syncCheckpoints.findFirst({
    where: and(eq(syncCheckpoints.source, canonicalFoundationCheckpointSource), eq(syncCheckpoints.stream, stream))
  })
  const existingCursor = existing?.cursor
  const startingIndex =
    existingCursor?.contentHash === contentHash &&
    typeof existingCursor.index === "number" &&
    Number.isSafeInteger(existingCursor.index) &&
    existingCursor.index >= 0
      ? Math.min(existingCursor.index, records.length)
      : 0
  counts.skipped = startingIndex
  let index = startingIndex

  for (const rawRecord of records.slice(startingIndex)) {
    const parsed = canonicalFoundationRecordSchema.safeParse(rawRecord)
    if (!parsed.success) {
      failures.push({
        message: parsed.error.issues.map((issue) => issue.message).join("; "),
        retryable: false
      })
      counts.failed += 1
      break
    }
    try {
      await applyCanonicalFoundationRecord(database, parsed.data)
      counts.read += 1
      counts.updated += 1
      index += 1
      await saveCanonicalFoundationCheckpoint(database, stream, contentHash, index, false)
    } catch (error) {
      failures.push({
        identifier: `${parsed.data.kind}:${parsed.data.id}`,
        message: error instanceof Error ? error.message : "Unknown canonical foundation persistence failure",
        retryable: false
      })
      counts.failed += 1
      break
    }
  }

  const audit = await auditCanonicalFoundation(database)
  const complete = failures.length === 0 && index === records.length && audit.complete
  const checkpoint = {
    complete,
    contentHash,
    incompleteJurisdictionCount: audit.incompleteJurisdictionIds.length,
    incompleteSessionCount: audit.incompleteSessionIds.length,
    index
  }
  await saveCanonicalFoundationCheckpoint(database, stream, contentHash, index, complete, checkpoint)
  return { audit, checkpoint, counts, failures }
}

async function saveCanonicalFoundationCheckpoint(
  database: LegislationDatabase,
  stream: string,
  contentHash: string,
  index: number,
  complete: boolean,
  cursor: Readonly<Record<string, unknown>> = { complete, contentHash, index }
): Promise<void> {
  await database
    .insert(syncCheckpoints)
    .values({ cursor, source: canonicalFoundationCheckpointSource, stream })
    .onConflictDoUpdate({
      set: { cursor, updatedAt: new Date() },
      target: [syncCheckpoints.source, syncCheckpoints.stream]
    })
}
