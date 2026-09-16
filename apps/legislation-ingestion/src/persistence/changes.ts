import { createHash } from "node:crypto"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  amendments,
  bills,
  canonicalRecordFingerprints,
  changeEvents,
  jurisdictions,
  legislativeEvents,
  legislativeSessions,
  organizationMemberships,
  organizations,
  people,
  votes
} from "@repo/legislation-core/database/schema/schema"
import { and, eq, inArray, sql } from "drizzle-orm"
import { currentIngestionRunId } from "../ingestion/run-context.js"

export type CanonicalChangeType = "cancel" | "create" | "delete" | "relationship-change" | "reschedule" | "update"

export interface CanonicalChangeInput {
  changeType?: CanonicalChangeType
  fields: Readonly<Record<string, unknown>>
  jurisdictionId?: string
  organizationId?: string
  personId?: string
  recordId: string
  recordType: string
  sourceUpdatedAt?: Date
}

interface PlannedCanonicalChange {
  after: Record<string, unknown>
  before?: Record<string, unknown>
  changeType: CanonicalChangeType
  changedFields: string[]
  fingerprint: string
  id: string
}

const MAX_CANONICAL_SNAPSHOT_BYTES = 64 * 1024
const MAX_CANONICAL_FIELD_BYTES = 8 * 1024

interface SourceRecord {
  sourceIsOfficial?: boolean | null
  sourceProvider?: string | null
  sourceUrl?: string | null
}

interface CapturedSource {
  sourceIsOfficial: boolean
  sourceProvider: string
  sourceRetrievedAt: Date
  sourceUrl: string
}

function canonicalValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (Array.isArray(value)) {
    return value.map(canonicalValue)
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter((entry) => entry[1] !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)])
    )
  }
  return value
}

function canonicalFields(fields: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const canonical = Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => {
        const normalized = canonicalValue(value)
        const encoded = JSON.stringify(normalized)
        const byteLength = Buffer.byteLength(encoded, "utf8")
        return [
          key,
          byteLength > MAX_CANONICAL_FIELD_BYTES
            ? { representation: "sha256", byteLength, digest: hash(normalized) }
            : normalized
        ]
      })
  )
  const encoded = JSON.stringify(canonical)
  if (encoded === undefined || Buffer.byteLength(encoded, "utf8") > MAX_CANONICAL_SNAPSHOT_BYTES) {
    throw new Error(`Canonical change snapshot exceeds the ${MAX_CANONICAL_SNAPSHOT_BYTES} byte limit`)
  }
  return canonical
}

function hash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)) ?? "undefined")
    .digest("hex")
}

function changedFields(before: Record<string, unknown> | undefined, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after)])
  return [...keys].filter((key) => hash(before?.[key]) !== hash(after[key])).sort()
}

function inferredChangeType(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>
): CanonicalChangeType {
  if (before === undefined) {
    return "create"
  }
  if (after.isDeleted === true && before.isDeleted !== true) {
    return "delete"
  }
  const status = typeof after.status === "string" ? after.status.toLowerCase() : undefined
  const previousStatus = typeof before.status === "string" ? before.status.toLowerCase() : undefined
  if ((status === "cancelled" || status === "canceled") && status !== previousStatus) {
    return "cancel"
  }
  if (hash(before.startAt) !== hash(after.startAt) || hash(before.endAt) !== hash(after.endAt)) {
    return "reschedule"
  }
  const changed = changedFields(before, after)
  if (changed.length > 0 && changed.every((field) => field === "relationships")) {
    return "relationship-change"
  }
  return "update"
}

export function planCanonicalChange(
  input: CanonicalChangeInput,
  previous?: Readonly<{ fields: Record<string, unknown>; fingerprint: string }>
): PlannedCanonicalChange | undefined {
  const after = canonicalFields(input.fields)
  const fingerprint = hash(after)
  if (previous?.fingerprint === fingerprint) {
    return undefined
  }
  const before = previous?.fields
  const sourceUpdatedAt = input.sourceUpdatedAt?.toISOString() ?? ""
  const id = `change:${hash([input.recordType, input.recordId, previous?.fingerprint ?? "", fingerprint, sourceUpdatedAt])}`
  return {
    after,
    before,
    changeType: input.changeType ?? inferredChangeType(before, after),
    changedFields: changedFields(before, after),
    fingerprint,
    id
  }
}

export async function observeCanonicalRecord(
  database: Omit<LegislationDatabase, "$client">,
  input: CanonicalChangeInput
): Promise<"changed" | "unchanged" | "untracked"> {
  const ingestionRunId = currentIngestionRunId()
  if (ingestionRunId === undefined) {
    return "untracked"
  }
  const previous = await database
    .select({ fields: canonicalRecordFingerprints.fields, fingerprint: canonicalRecordFingerprints.fingerprint })
    .from(canonicalRecordFingerprints)
    .where(
      and(
        eq(canonicalRecordFingerprints.recordType, input.recordType),
        eq(canonicalRecordFingerprints.recordId, input.recordId)
      )
    )
    .limit(1)
  const planned = planCanonicalChange(input, previous[0])
  if (planned === undefined) {
    return "unchanged"
  }
  const observedAt = new Date()
  const source = await captureSource(database, input.recordType, input.recordId, observedAt)
  await database
    .insert(changeEvents)
    .values({
      after: planned.after,
      before: planned.before,
      changeType: planned.changeType,
      changedFields: planned.changedFields,
      id: planned.id,
      ingestionRunId,
      jurisdictionId: input.jurisdictionId,
      organizationId: input.organizationId,
      personId: input.personId,
      recordId: input.recordId,
      recordType: input.recordType,
      sourceUpdatedAt: input.sourceUpdatedAt,
      sourceIsOfficial: source?.sourceIsOfficial,
      sourceProvider: source?.sourceProvider,
      sourceRetrievedAt: source?.sourceRetrievedAt,
      sourceUrl: source?.sourceUrl,
      observedAt
    })
    .onConflictDoNothing({ target: changeEvents.id })
  await database
    .insert(canonicalRecordFingerprints)
    .values({
      fields: planned.after,
      fingerprint: planned.fingerprint,
      observedAt,
      recordId: input.recordId,
      recordType: input.recordType
    })
    .onConflictDoUpdate({
      set: { fields: planned.after, fingerprint: planned.fingerprint, observedAt },
      target: [canonicalRecordFingerprints.recordType, canonicalRecordFingerprints.recordId]
    })
  return "changed"
}

export type CanonicalSnapshotChangeInput = CanonicalChangeInput & { source: SourceRecord }

/** Caller supplies the snapshot transaction and its source rows. No per-record database round trips. */
export async function observeCanonicalSnapshot(
  database: Omit<LegislationDatabase, "$client">,
  inputs: readonly CanonicalSnapshotChangeInput[]
): Promise<void> {
  const ingestionRunId = currentIngestionRunId()
  if (ingestionRunId === undefined || inputs.length === 0) {
    return
  }
  const groups = new Map<string, CanonicalSnapshotChangeInput[]>()
  const identities = new Set<string>()
  for (const input of inputs) {
    const key = JSON.stringify([input.recordType, input.recordId])
    if (identities.has(key)) {
      throw new Error(`Duplicate canonical snapshot identity: ${key}`)
    }
    identities.add(key)
    const group = groups.get(input.recordType) ?? []
    group.push(input)
    groups.set(input.recordType, group)
  }
  for (const [recordType, group] of groups) {
    for (let offset = 0; offset < group.length; offset += 250) {
      const batch = group.slice(offset, offset + 250)
      const previous = await database
        .select()
        .from(canonicalRecordFingerprints)
        .where(
          and(
            eq(canonicalRecordFingerprints.recordType, recordType),
            inArray(
              canonicalRecordFingerprints.recordId,
              batch.map((input) => input.recordId)
            )
          )
        )
      const byId = new Map(previous.map((row) => [row.recordId, row]))
      const events: (typeof changeEvents.$inferInsert)[] = []
      const fingerprints: (typeof canonicalRecordFingerprints.$inferInsert)[] = []
      const observedAt = new Date()
      for (const input of batch) {
        const planned = planCanonicalChange(input, byId.get(input.recordId))
        if (planned === undefined) {
          continue
        }
        const source = capturedSource(input.source, observedAt)
        events.push({
          after: planned.after,
          before: planned.before,
          changeType: planned.changeType,
          changedFields: planned.changedFields,
          id: planned.id,
          ingestionRunId,
          jurisdictionId: input.jurisdictionId,
          organizationId: input.organizationId,
          personId: input.personId,
          recordId: input.recordId,
          recordType,
          sourceUpdatedAt: input.sourceUpdatedAt,
          ...source,
          observedAt
        })
        fingerprints.push({
          fields: planned.after,
          fingerprint: planned.fingerprint,
          observedAt,
          recordId: input.recordId,
          recordType
        })
      }
      if (events.length === 0) {
        continue
      }
      await database.insert(changeEvents).values(events).onConflictDoNothing({ target: changeEvents.id })
      await database
        .insert(canonicalRecordFingerprints)
        .values(fingerprints)
        .onConflictDoUpdate({
          target: [canonicalRecordFingerprints.recordType, canonicalRecordFingerprints.recordId],
          set: {
            fields: sql`excluded.fields`,
            fingerprint: sql`excluded.fingerprint`,
            observedAt: sql`excluded.observed_at`
          }
        })
    }
  }
}

async function captureSource(
  database: Omit<LegislationDatabase, "$client">,
  recordType: string,
  recordId: string,
  observedAt: Date
): Promise<CapturedSource | undefined> {
  const record = await sourceRecord(database, recordType, recordId)
  return capturedSource(record, observedAt)
}

function capturedSource(record: SourceRecord | undefined, observedAt: Date): CapturedSource | undefined {
  if (record === undefined || typeof record.sourceUrl !== "string") {
    return undefined
  }
  const sourceUrl = record.sourceUrl.trim()
  let host: string
  try {
    const parsed = new URL(sourceUrl)
    if (parsed.protocol !== "https:" || parsed.hostname.length === 0) {
      return undefined
    }
    host = parsed.hostname.toLowerCase()
  } catch {
    return undefined
  }
  const sourceProvider = record.sourceProvider?.trim() || inferredProvider(host)
  if (sourceProvider.length === 0) {
    return undefined
  }
  return {
    sourceIsOfficial: record.sourceIsOfficial ?? isOfficialHost(host),
    sourceProvider,
    sourceRetrievedAt: observedAt,
    sourceUrl
  }
}

async function sourceRecord(
  database: Omit<LegislationDatabase, "$client">,
  recordType: string,
  recordId: string
): Promise<SourceRecord | undefined> {
  switch (recordType) {
    case "amendment": {
      const rows = await database
        .select({ sourceUrl: amendments.sourceUrl })
        .from(amendments)
        .where(eq(amendments.id, recordId))
        .limit(1)
      return rows[0]
    }
    case "bill": {
      const rows = await database
        .select({ sourceUrl: bills.sourceUrl })
        .from(bills)
        .where(eq(bills.id, recordId))
        .limit(1)
      return rows[0]
    }
    case "event": {
      const rows = await database
        .select({
          sourceIsOfficial: legislativeEvents.sourceIsOfficial,
          sourceProvider: legislativeEvents.sourceProvider,
          sourceUrl: legislativeEvents.sourceUrl
        })
        .from(legislativeEvents)
        .where(eq(legislativeEvents.id, recordId))
        .limit(1)
      return rows[0]
    }
    case "jurisdiction": {
      const rows = await database
        .select({
          sourceIsOfficial: jurisdictions.sourceIsOfficial,
          sourceProvider: jurisdictions.sourceProvider,
          sourceUrl: jurisdictions.sourceUrl
        })
        .from(jurisdictions)
        .where(eq(jurisdictions.id, recordId))
        .limit(1)
      return rows[0]
    }
    case "organization": {
      const rows = await database
        .select({
          sourceIsOfficial: organizations.sourceIsOfficial,
          sourceProvider: organizations.sourceProvider,
          sourceUrl: organizations.sourceUrl
        })
        .from(organizations)
        .where(eq(organizations.id, recordId))
        .limit(1)
      return rows[0]
    }
    case "organization-membership": {
      const rows = await database
        .select({
          sourceIsOfficial: organizationMemberships.sourceIsOfficial,
          sourceProvider: organizationMemberships.sourceProvider,
          sourceUrl: organizationMemberships.sourceUrl
        })
        .from(organizationMemberships)
        .where(eq(organizationMemberships.id, recordId))
        .limit(1)
      return rows[0]
    }
    case "person": {
      const rows = await database
        .select({
          sourceIsOfficial: people.sourceIsOfficial,
          sourceProvider: people.sourceProvider,
          sourceUrl: people.sourceUrl
        })
        .from(people)
        .where(eq(people.id, recordId))
        .limit(1)
      return rows[0]
    }
    case "session": {
      const rows = await database
        .select({
          sourceIsOfficial: legislativeSessions.sourceIsOfficial,
          sourceProvider: legislativeSessions.sourceProvider,
          sourceUrl: legislativeSessions.sourceUrl
        })
        .from(legislativeSessions)
        .where(eq(legislativeSessions.id, recordId))
        .limit(1)
      return rows[0]
    }
    case "vote": {
      const rows = await database
        .select({
          sourceIsOfficial: votes.sourceIsOfficial,
          sourceProvider: votes.sourceProvider,
          sourceUrl: votes.sourceUrl
        })
        .from(votes)
        .where(eq(votes.id, recordId))
        .limit(1)
      return rows[0]
    }
    default:
      return undefined
  }
}

function inferredProvider(host: string): string {
  if (host === "api.congress.gov" || host.endsWith(".congress.gov")) {
    return "congress"
  }
  if (host === "api.govinfo.gov" || host.endsWith(".govinfo.gov")) {
    return "govinfo"
  }
  if (host === "v3.openstates.org" || host.endsWith(".openstates.org")) {
    return "openstates"
  }
  return host
}

function isOfficialHost(host: string): boolean {
  return (
    host === "api.congress.gov" ||
    host.endsWith(".congress.gov") ||
    host === "api.govinfo.gov" ||
    host.endsWith(".govinfo.gov")
  )
}
