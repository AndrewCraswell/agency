import { and, eq } from "drizzle-orm"
import { z } from "zod"
import type { LegislationDatabase } from "../db/database.js"
import {
  legislativeTerms,
  organizationMemberships,
  organizations,
  people,
  syncCheckpoints
} from "../db/schema/schema.js"
import { parseCanonicalFoundationContentHash } from "./canonical-foundation.js"
import { createJobCounts, type JobCounts } from "./job.js"

export const canonicalChamberSchema = z.enum(["lower", "upper", "unicameral", "legislature"])
export const canonicalOrganizationClassificationSchema = z.enum([
  "legislature",
  "chamber",
  "committee",
  "subcommittee",
  "commission",
  "agency",
  "other"
])

const identifierSchema = z.string().trim().min(1).max(200)
const canonicalOrganizationIdSchema = identifierSchema.regex(/^organization:/, "organization ID must be canonical")
const sourceSchema = z
  .object({
    isOfficial: z.boolean(),
    provider: z.string().trim().min(1).max(120),
    retrievedAt: z.iso.datetime({ offset: true }),
    sourceUpdatedAt: z.iso.datetime({ offset: true }).nullable(),
    url: z.url({ protocol: /^https$/ })
  })
  .strict()

const personRecordSchema = z
  .object({
    id: identifierSchema,
    isActive: z.boolean(),
    jurisdictionId: identifierSchema,
    kind: z.literal("person"),
    name: z.string().trim().min(1).max(1000),
    source: sourceSchema
  })
  .strict()

const organizationRecordSchema = z
  .object({
    chamber: canonicalChamberSchema.nullable(),
    classification: canonicalOrganizationClassificationSchema.nullable(),
    id: identifierSchema,
    isActive: z.boolean(),
    jurisdictionId: identifierSchema,
    kind: z.literal("organization"),
    name: z.string().trim().min(1).max(1000),
    /** An authoritative parent must be supplied as a canonical organization ID, never a provider ID. */
    parentOrganizationId: canonicalOrganizationIdSchema.nullable(),
    source: sourceSchema
  })
  .strict()

const termRecordSchema = z
  .object({
    chamber: canonicalChamberSchema,
    id: identifierSchema,
    isActive: z.boolean(),
    jurisdictionId: identifierSchema,
    kind: z.literal("term"),
    officeTitle: z.string().trim().min(1).max(1000),
    organizationId: canonicalOrganizationIdSchema.nullable(),
    personId: identifierSchema,
    source: sourceSchema
  })
  .strict()

const membershipRecordSchema = z
  .object({
    id: identifierSchema,
    isActive: z.boolean(),
    kind: z.literal("membership"),
    label: z.string().trim().min(1).max(1000).nullable(),
    organizationId: canonicalOrganizationIdSchema,
    personId: identifierSchema,
    role: z.string().trim().min(1).max(240),
    source: sourceSchema
  })
  .strict()

export const canonicalCivicFoundationRecordSchema = z.discriminatedUnion("kind", [
  personRecordSchema,
  organizationRecordSchema,
  termRecordSchema,
  membershipRecordSchema
])

export type CanonicalCivicFoundationRecord = z.output<typeof canonicalCivicFoundationRecordSchema>

export const canonicalCivicFoundationCheckpointSource = "canonical-civic-foundation"
export const canonicalCivicFoundationCheckpointStream = "people-organizations-terms-memberships"

type ProvenanceRow = Readonly<{
  provenanceComplete: boolean
  sourceIsOfficial: boolean | null
  sourceProvider: string | null
  sourceRetrievedAt: Date | null
  sourceUrl: string | null
}>

function hasCompleteProvenance(row: ProvenanceRow): boolean {
  return (
    row.provenanceComplete &&
    row.sourceIsOfficial !== null &&
    row.sourceProvider !== null &&
    row.sourceProvider.trim().length > 0 &&
    row.sourceRetrievedAt !== null &&
    row.sourceUrl !== null &&
    row.sourceUrl.startsWith("https://")
  )
}

export type CanonicalCivicFoundationAudit = Readonly<{
  complete: boolean
  incompleteMembershipIds: readonly string[]
  incompleteOrganizationIds: readonly string[]
  incompletePersonIds: readonly string[]
  incompleteTermIds: readonly string[]
}>

export function isPersonCivicFoundationComplete(
  row: ProvenanceRow & Readonly<{ isActive: boolean | null; jurisdictionId: string | null; name: string }>
): boolean {
  return (
    hasCompleteProvenance(row) && row.isActive !== null && row.jurisdictionId !== null && row.name.trim().length > 0
  )
}

export function isOrganizationCivicFoundationComplete(
  row: ProvenanceRow &
    Readonly<{
      classification: string | null
      chamber: string | null
      isActive: boolean | null
      name: string
      parentOrganizationId: string | null
      upstreamIds: Record<string, string>
    }>
): boolean {
  const unresolvedOpenStatesParent =
    typeof row.upstreamIds.openstatesParent === "string" &&
    row.upstreamIds.openstatesParent.trim().length > 0 &&
    row.parentOrganizationId === null
  return (
    hasCompleteProvenance(row) &&
    row.isActive !== null &&
    canonicalOrganizationClassificationSchema.safeParse(row.classification).success &&
    (row.chamber === null || canonicalChamberSchema.safeParse(row.chamber).success) &&
    row.name.trim().length > 0 &&
    !unresolvedOpenStatesParent
  )
}

export function isTermCivicFoundationComplete(
  row: ProvenanceRow &
    Readonly<{
      chamber: string | null
      isActive: boolean | null
      jurisdictionId: string
      officeTitle: string | null
      personId: string
    }>
): boolean {
  return (
    hasCompleteProvenance(row) &&
    row.isActive !== null &&
    row.officeTitle !== null &&
    row.officeTitle.trim().length > 0 &&
    row.personId.length > 0 &&
    row.jurisdictionId.length > 0 &&
    canonicalChamberSchema.safeParse(row.chamber).success
  )
}

export function isMembershipCivicFoundationComplete(
  row: ProvenanceRow &
    Readonly<{ isActive: boolean | null; organizationId: string; personId: string; role: string | null }>
): boolean {
  return (
    hasCompleteProvenance(row) &&
    row.isActive !== null &&
    row.organizationId.length > 0 &&
    row.personId.length > 0 &&
    row.role !== null &&
    row.role.trim().length > 0
  )
}

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

function sourceUpdate(source: z.output<typeof sourceSchema>) {
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
