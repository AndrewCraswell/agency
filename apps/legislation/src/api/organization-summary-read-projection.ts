import type { OrganizationRow } from "../db/queries/organization-relationships.js"
import { LegislationError } from "../legislation/errors.js"
import { projectOrganizationSummary, type OrganizationSummary } from "./canonical-projection.js"
import { sourceProjectionContext } from "./canonical-read.js"

export function projectOrganizationRow(
  row: OrganizationRow,
  apiBaseUrl: string,
  expectedJurisdictionId?: string
): OrganizationSummary {
  if (expectedJurisdictionId !== undefined && row.jurisdictionId !== expectedJurisdictionId) {
    throw new LegislationError("unprocessable", "organization does not belong to its jurisdiction path")
  }
  const source = canonicalSource(row, "organization")
  return projectOrganizationSummary(
    {
      chamber: canonicalChamber(row.chamber),
      classification: canonicalOrganizationClassification(row.classification),
      id: requiredText(row.id, "organization ID"),
      isActive: requiredBoolean(row.isActive, "organization isActive"),
      jurisdictionId: requiredText(row.jurisdictionId, "organization jurisdictionId"),
      name: requiredText(row.name, "organization name"),
      parentOrganizationId: row.parentOrganizationId,
      sourceUrl: source.sourceUrl
    },
    sourceProjectionContext(source, apiBaseUrl)
  )
}

function canonicalSource(row: OrganizationRow, name: string) {
  if (
    !row.provenanceComplete ||
    row.sourceIsOfficial === null ||
    !isNonemptyString(row.sourceProvider) ||
    row.sourceRetrievedAt === null ||
    !isNonemptyString(row.sourceUrl)
  ) {
    throw new LegislationError("unprocessable", `${name} canonical provenance is incomplete`)
  }
  return {
    createdAt: row.createdAt,
    id: row.id,
    sourceUpdatedAt: row.sourceUpdatedAt,
    sourceUrl: row.sourceUrl,
    updatedAt: row.updatedAt,
    upstreamIds: row.upstreamIds
  }
}

function canonicalOrganizationClassification(value: string | null): OrganizationSummary["classification"] {
  switch (value) {
    case "agency":
    case "chamber":
    case "committee":
    case "commission":
    case "legislature":
    case "other":
    case "subcommittee":
      return value
    default:
      throw new LegislationError("unprocessable", "organization classification is not canonical")
  }
}

function canonicalChamber(value: string | null): OrganizationSummary["chamber"] {
  switch (value) {
    case "lower":
    case "upper":
    case "unicameral":
    case "legislature":
    case null:
      return value
    default:
      throw new LegislationError("unprocessable", "organization chamber is not canonical")
  }
}

function requiredBoolean(value: boolean | null, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new LegislationError("unprocessable", `${name} must be boolean`)
  }
  return value
}

function requiredText(value: string | null, name: string): string {
  if (!isNonemptyString(value)) {
    throw new LegislationError("unprocessable", `${name} must be non-empty`)
  }
  return value
}

function isNonemptyString(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0
}
