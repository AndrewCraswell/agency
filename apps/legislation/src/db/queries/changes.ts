import { createHash } from "node:crypto"
import { and, desc, eq, lt, or } from "drizzle-orm"
import { currentIngestionRunId } from "../../ingestion/run-context.js"
import type { LegislationDatabase } from "../database.js"
import { canonicalRecordFingerprints, changeEvents } from "../schema/schema.js"

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
  return canonicalValue(fields) as Record<string, unknown>
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
      sourceUpdatedAt: input.sourceUpdatedAt
    })
    .onConflictDoNothing({ target: changeEvents.id })
  await database
    .insert(canonicalRecordFingerprints)
    .values({
      fields: planned.after,
      fingerprint: planned.fingerprint,
      observedAt: new Date(),
      recordId: input.recordId,
      recordType: input.recordType
    })
    .onConflictDoUpdate({
      set: { fields: planned.after, fingerprint: planned.fingerprint, observedAt: new Date() },
      target: [canonicalRecordFingerprints.recordType, canonicalRecordFingerprints.recordId]
    })
  return "changed"
}

export interface ChangeQuery {
  before?: Date
  beforeId?: string
  jurisdictionId?: string
  limit?: number
  organizationId?: string
  personId?: string
  recordId?: string
  recordType?: string
}

export async function findChangeEvents(database: LegislationDatabase, query: ChangeQuery) {
  const beforeCondition = (() => {
    if (query.before === undefined) {
      return undefined
    }
    if (query.beforeId === undefined) {
      return lt(changeEvents.observedAt, query.before)
    }
    return or(
      lt(changeEvents.observedAt, query.before),
      and(eq(changeEvents.observedAt, query.before), lt(changeEvents.id, query.beforeId))
    )
  })()
  const conditions = [
    beforeCondition,
    query.jurisdictionId === undefined ? undefined : eq(changeEvents.jurisdictionId, query.jurisdictionId),
    query.organizationId === undefined ? undefined : eq(changeEvents.organizationId, query.organizationId),
    query.personId === undefined ? undefined : eq(changeEvents.personId, query.personId),
    query.recordId === undefined ? undefined : eq(changeEvents.recordId, query.recordId),
    query.recordType === undefined ? undefined : eq(changeEvents.recordType, query.recordType)
  ].filter((condition) => condition !== undefined)
  return database
    .select()
    .from(changeEvents)
    .where(conditions.length === 0 ? undefined : and(...conditions))
    .orderBy(desc(changeEvents.observedAt), desc(changeEvents.id))
    .limit(Math.min(Math.max(query.limit ?? 50, 1), 101))
}
