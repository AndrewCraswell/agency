import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  legislativeTerms,
  organizationMemberships,
  organizations,
  people,
  syncCheckpoints
} from "@repo/legislation-core/database/schema/schema"
import {
  canonicalCivicFoundationRecordSchema,
  isMembershipCivicFoundationComplete,
  isOrganizationCivicFoundationComplete,
  isPersonCivicFoundationComplete,
  isTermCivicFoundationComplete,
  type CanonicalCivicFoundationRecord,
  type CanonicalCivicFoundationAudit
} from "@repo/legislation-core/domain/civic-foundation"
import { and, eq } from "drizzle-orm"
import { parseCanonicalFoundationContentHash } from "./canonical-foundation.js"
import { createJobCounts, type JobCounts } from "./job.js"

export const canonicalCivicFoundationCheckpointSource = "canonical-civic-foundation"
export const canonicalCivicFoundationCheckpointStream = "people-organizations-terms-memberships"

/**
 * Audits the minimum source-backed facts needed before civic routes can expose
 * a record. Missing source categories remain incomplete rather than guessed.
 */
export async function auditCanonicalCivicFoundation(
  database: LegislationDatabase
): Promise<CanonicalCivicFoundationAudit> {
  const [personRows, organizationRows, termRows, membershipRows] = await Promise.all([
    database
      .select({
        id: people.id,
        isActive: people.isActive,
        jurisdictionId: people.jurisdictionId,
        name: people.name,
        provenanceComplete: people.provenanceComplete,
        sourceIsOfficial: people.sourceIsOfficial,
        sourceProvider: people.sourceProvider,
        sourceRetrievedAt: people.sourceRetrievedAt,
        sourceUrl: people.sourceUrl
      })
      .from(people)
      .orderBy(people.id),
    database
      .select({
        chamber: organizations.chamber,
        classification: organizations.classification,
        id: organizations.id,
        isActive: organizations.isActive,
        name: organizations.name,
        parentOrganizationId: organizations.parentOrganizationId,
        provenanceComplete: organizations.provenanceComplete,
        sourceIsOfficial: organizations.sourceIsOfficial,
        sourceProvider: organizations.sourceProvider,
        sourceRetrievedAt: organizations.sourceRetrievedAt,
        sourceUrl: organizations.sourceUrl,
        upstreamIds: organizations.upstreamIds
      })
      .from(organizations)
      .orderBy(organizations.id),
    database
      .select({
        chamber: legislativeTerms.chamber,
        id: legislativeTerms.id,
        isActive: legislativeTerms.isActive,
        jurisdictionId: legislativeTerms.jurisdictionId,
        officeTitle: legislativeTerms.officeTitle,
        personId: legislativeTerms.personId,
        provenanceComplete: legislativeTerms.provenanceComplete,
        sourceIsOfficial: legislativeTerms.sourceIsOfficial,
        sourceProvider: legislativeTerms.sourceProvider,
        sourceRetrievedAt: legislativeTerms.sourceRetrievedAt,
        sourceUrl: legislativeTerms.sourceUrl
      })
      .from(legislativeTerms)
      .orderBy(legislativeTerms.id),
    database
      .select({
        id: organizationMemberships.id,
        isActive: organizationMemberships.isActive,
        organizationId: organizationMemberships.organizationId,
        personId: organizationMemberships.personId,
        role: organizationMemberships.role,
        provenanceComplete: organizationMemberships.provenanceComplete,
        sourceIsOfficial: organizationMemberships.sourceIsOfficial,
        sourceProvider: organizationMemberships.sourceProvider,
        sourceRetrievedAt: organizationMemberships.sourceRetrievedAt,
        sourceUrl: organizationMemberships.sourceUrl
      })
      .from(organizationMemberships)
      .orderBy(organizationMemberships.id)
  ])
  const incompletePersonIds = personRows.filter((row) => !isPersonCivicFoundationComplete(row)).map((row) => row.id)
  const incompleteOrganizationIds = organizationRows
    .filter((row) => !isOrganizationCivicFoundationComplete(row))
    .map((row) => row.id)
  const incompleteTermIds = termRows.filter((row) => !isTermCivicFoundationComplete(row)).map((row) => row.id)
  const incompleteMembershipIds = membershipRows
    .filter((row) => !isMembershipCivicFoundationComplete(row))
    .map((row) => row.id)
  return {
    complete:
      incompletePersonIds.length === 0 &&
      incompleteOrganizationIds.length === 0 &&
      incompleteTermIds.length === 0 &&
      incompleteMembershipIds.length === 0,
    incompleteMembershipIds,
    incompleteOrganizationIds,
    incompletePersonIds,
    incompleteTermIds
  }
}

function sourceUpdate(source: CanonicalCivicFoundationRecord["source"]) {
  return {
    provenanceComplete: true,
    sourceIsOfficial: source.isOfficial,
    sourceProvider: source.provider,
    sourceRetrievedAt: new Date(source.retrievedAt),
    sourceUpdatedAt: source.sourceUpdatedAt === null ? null : new Date(source.sourceUpdatedAt),
    sourceUrl: source.url,
    updatedAt: new Date()
  }
}

async function requireOrganizationInJurisdiction(
  database: LegislationDatabase,
  organizationId: string | null,
  jurisdictionId: string
): Promise<void> {
  if (organizationId === null) {
    return
  }
  const organization = await database.query.organizations.findFirst({
    columns: { jurisdictionId: true },
    where: eq(organizations.id, organizationId)
  })
  if (organization === undefined || organization.jurisdictionId !== jurisdictionId) {
    throw new Error(
      `Canonical foundation organization is not authoritative in the required jurisdiction: ${organizationId}`
    )
  }
}

async function requireTermScope(
  database: LegislationDatabase,
  personId: string,
  jurisdictionId: string,
  organizationId: string | null
): Promise<void> {
  const person = await database.query.people.findFirst({
    columns: { jurisdictionId: true },
    where: eq(people.id, personId)
  })
  if (person === undefined || person.jurisdictionId !== jurisdictionId) {
    throw new Error(`Canonical foundation term person is not in jurisdiction: ${personId}`)
  }
  await requireOrganizationInJurisdiction(database, organizationId, jurisdictionId)
}

/**
 * Applies an explicit source artifact only to an existing canonical record.
 * Provider identities never become relationships: parent IDs must already be
 * canonical foreign keys in the same jurisdiction.
 */
export async function applyCanonicalCivicFoundationRecord(
  database: LegislationDatabase,
  record: CanonicalCivicFoundationRecord
): Promise<void> {
  const source = sourceUpdate(record.source)
  if (record.kind === "person") {
    const updated = await database
      .update(people)
      .set({ ...source, isActive: record.isActive, name: record.name })
      .where(and(eq(people.id, record.id), eq(people.jurisdictionId, record.jurisdictionId)))
      .returning({ id: people.id })
    if (updated.length === 0) {
      throw new Error(`Canonical civic foundation source referenced unknown person: ${record.id}`)
    }
    return
  }
  if (record.kind === "organization") {
    await requireOrganizationInJurisdiction(database, record.parentOrganizationId, record.jurisdictionId)
    const updated = await database
      .update(organizations)
      .set({
        ...source,
        chamber: record.chamber,
        classification: record.classification,
        isActive: record.isActive,
        name: record.name,
        parentOrganizationId: record.parentOrganizationId
      })
      .where(and(eq(organizations.id, record.id), eq(organizations.jurisdictionId, record.jurisdictionId)))
      .returning({ id: organizations.id })
    if (updated.length === 0) {
      throw new Error(`Canonical civic foundation source referenced unknown organization: ${record.id}`)
    }
    return
  }
  if (record.kind === "term") {
    await requireTermScope(database, record.personId, record.jurisdictionId, record.organizationId)
    const updated = await database
      .update(legislativeTerms)
      .set({
        ...source,
        chamber: record.chamber,
        isActive: record.isActive,
        officeTitle: record.officeTitle,
        organizationId: record.organizationId
      })
      .where(
        and(
          eq(legislativeTerms.id, record.id),
          eq(legislativeTerms.jurisdictionId, record.jurisdictionId),
          eq(legislativeTerms.personId, record.personId)
        )
      )
      .returning({ id: legislativeTerms.id })
    if (updated.length === 0) {
      throw new Error(`Canonical civic foundation source referenced unknown term: ${record.id}`)
    }
    return
  }
  const [organization, person] = await Promise.all([
    database.query.organizations.findFirst({
      columns: { jurisdictionId: true },
      where: eq(organizations.id, record.organizationId)
    }),
    database.query.people.findFirst({ columns: { jurisdictionId: true }, where: eq(people.id, record.personId) })
  ])
  if (
    organization === undefined ||
    person === undefined ||
    person.jurisdictionId === null ||
    organization.jurisdictionId !== person.jurisdictionId
  ) {
    throw new Error(`Canonical civic foundation membership links are not authoritative: ${record.id}`)
  }
  const updated = await database
    .update(organizationMemberships)
    .set({ ...source, isActive: record.isActive, label: record.label, role: record.role })
    .where(
      and(
        eq(organizationMemberships.id, record.id),
        eq(organizationMemberships.organizationId, record.organizationId),
        eq(organizationMemberships.personId, record.personId)
      )
    )
    .returning({ id: organizationMemberships.id })
  if (updated.length === 0) {
    throw new Error(`Canonical civic foundation source referenced unknown membership: ${record.id}`)
  }
}

export type CanonicalCivicFoundationImportResult = Readonly<{
  audit: CanonicalCivicFoundationAudit
  checkpoint: Readonly<Record<string, unknown>>
  counts: JobCounts
  failures: ReadonlyArray<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
}>

/**
 * Checkpointed, ordered application of an authoritative civic snapshot. On an
 * unresolved relationship the checkpoint remains before that record, so a
 * corrected snapshot resumes without duplicating completed work.
 */
export async function importCanonicalCivicFoundationRecords(
  database: LegislationDatabase,
  records: readonly unknown[],
  options: Readonly<{ contentHash: string; stream?: string }>
): Promise<CanonicalCivicFoundationImportResult> {
  const stream = options.stream ?? canonicalCivicFoundationCheckpointStream
  const contentHash = parseCanonicalFoundationContentHash(options.contentHash)
  const counts = createJobCounts({ discovered: records.length })
  const failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>> = []
  const existing = await database.query.syncCheckpoints.findFirst({
    where: and(eq(syncCheckpoints.source, canonicalCivicFoundationCheckpointSource), eq(syncCheckpoints.stream, stream))
  })
  const cursor = existing?.cursor
  const startingIndex =
    cursor?.contentHash === contentHash &&
    typeof cursor.index === "number" &&
    Number.isSafeInteger(cursor.index) &&
    cursor.index >= 0
      ? Math.min(cursor.index, records.length)
      : 0
  counts.skipped = startingIndex
  let index = startingIndex
  for (const rawRecord of records.slice(startingIndex)) {
    const parsed = canonicalCivicFoundationRecordSchema.safeParse(rawRecord)
    if (!parsed.success) {
      counts.failed += 1
      failures.push({ message: parsed.error.issues.map((issue) => issue.message).join("; "), retryable: false })
      break
    }
    try {
      await applyCanonicalCivicFoundationRecord(database, parsed.data)
      counts.read += 1
      counts.updated += 1
      index += 1
      await saveCivicFoundationCheckpoint(database, stream, contentHash, index, false)
    } catch (error) {
      counts.failed += 1
      failures.push({
        identifier: `${parsed.data.kind}:${parsed.data.id}`,
        message: error instanceof Error ? error.message : "Unknown canonical civic foundation persistence failure",
        retryable: false
      })
      break
    }
  }
  const audit = await auditCanonicalCivicFoundation(database)
  const complete = failures.length === 0 && index === records.length && audit.complete
  const checkpoint = {
    complete,
    contentHash,
    incompleteMembershipCount: audit.incompleteMembershipIds.length,
    incompleteOrganizationCount: audit.incompleteOrganizationIds.length,
    incompletePersonCount: audit.incompletePersonIds.length,
    incompleteTermCount: audit.incompleteTermIds.length,
    index
  }
  await saveCivicFoundationCheckpoint(database, stream, contentHash, index, complete, checkpoint)
  return { audit, checkpoint, counts, failures }
}

async function saveCivicFoundationCheckpoint(
  database: LegislationDatabase,
  stream: string,
  contentHash: string,
  index: number,
  complete: boolean,
  cursor: Readonly<Record<string, unknown>> = { complete, contentHash, index }
): Promise<void> {
  await database
    .insert(syncCheckpoints)
    .values({ cursor, source: canonicalCivicFoundationCheckpointSource, stream })
    .onConflictDoUpdate({
      set: { cursor, updatedAt: new Date() },
      target: [syncCheckpoints.source, syncCheckpoints.stream]
    })
}
