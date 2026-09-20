import { LegislationError } from "@repo/legislation-core/domain/errors"
import type { ProjectionContext, ProjectionSourceInput } from "./canonical-projection"

type PersistedSourceRecord = Readonly<{
  provenanceComplete: boolean
  sourceIsOfficial: boolean | null
  sourceProvider: string | null
  sourceRetrievedAt: Date | null
  sourceUpdatedAt: Date | null
  sourceUrl: string | null
  updatedAt: Date
}>

export function projectPersistedSource(record: PersistedSourceRecord, label: string): ProjectionSourceInput {
  if (
    record.provenanceComplete !== true ||
    typeof record.sourceIsOfficial !== "boolean" ||
    !isNonemptyString(record.sourceProvider) ||
    !(record.sourceRetrievedAt instanceof Date) ||
    !Number.isFinite(record.sourceRetrievedAt.getTime()) ||
    !isNonemptyString(record.sourceUrl)
  ) {
    throw new LegislationError("unprocessable", `${label} canonical provenance is incomplete`)
  }
  return {
    isOfficial: record.sourceIsOfficial,
    provider: record.sourceProvider,
    retrievedAt: record.sourceRetrievedAt,
    sourceUpdatedAt: record.sourceUpdatedAt,
    sourceUrl: record.sourceUrl
  }
}

export function persistedSourceProjectionContext(
  records: readonly [PersistedSourceRecord, ...PersistedSourceRecord[]],
  apiBaseUrl: string,
  label: string
): ProjectionContext {
  const [first, ...rest] = records
  return {
    apiBaseUrl,
    sources: [projectPersistedSource(first, label), ...rest.map((record) => projectPersistedSource(record, label))],
    updatedAt: first.updatedAt
  }
}

function isNonemptyString(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0
}
