import { LegislationError } from "@repo/legislation-core/domain/errors"
import type { OrganizationMembershipRead } from "../../legislation/persistence/queries/civic-scoped-reads.js"
import {
  projectMembership,
  projectOrganizationSummary,
  projectPersonSummary,
  type OrganizationSummary,
  type PersonSummary
} from "./canonical-projection.js"
import { sourceProjectionContext } from "./canonical-read.js"

/** Projects a persisted membership and both required embedded records fail-closed. */
export function projectOrganizationMembershipRead(read: OrganizationMembershipRead, apiBaseUrl: string) {
  const source = canonicalSource(read.membership, "membership")
  return projectMembership(
    {
      detectedEndDate: read.membership.detectedEndDate,
      detectedStartDate: read.membership.detectedStartDate,
      effectiveEndDate: read.membership.effectiveEndDate,
      effectiveStartDate: read.membership.effectiveStartDate,
      endedReason: read.membership.endedReason,
      id: requiredText(read.membership.id, "membership ID"),
      isCurrent: requiredBoolean(read.membership.isActive, "membership isActive"),
      label: read.membership.label,
      lastObservedDate: read.membership.lastObservedDate,
      legislativeSessionId: read.membership.legislativeSessionId,
      organization: projectOrganization(read.organization, apiBaseUrl),
      person: projectPerson(read.person, apiBaseUrl),
      role: requiredText(read.membership.role, "membership role"),
      sourceUrl: source.sourceUrl
    },
    sourceProjectionContext(source, apiBaseUrl)
  )
}

function projectPerson(read: OrganizationMembershipRead["person"], apiBaseUrl: string): PersonSummary {
  const source = canonicalSource(read, "person")
  return projectPersonSummary(
    {
      familyName: read.familyName,
      givenName: read.givenName,
      id: requiredText(read.id, "person ID"),
      imageUrl: null,
      isActive: requiredBoolean(read.isActive, "person isActive"),
      jurisdictionIds: [requiredText(read.jurisdictionId, "person jurisdictionId")],
      name: requiredText(read.name, "person name"),
      party: read.party,
      sourceUrl: source.sourceUrl
    },
    sourceProjectionContext(source, apiBaseUrl)
  )
}

function projectOrganization(
  read: OrganizationMembershipRead["organization"],
  apiBaseUrl: string
): OrganizationSummary {
  const source = canonicalSource(read, "organization")
  return projectOrganizationSummary(
    {
      chamber: canonicalChamber(read.chamber),
      classification: canonicalOrganizationClassification(read.classification),
      id: requiredText(read.id, "organization ID"),
      isActive: requiredBoolean(read.isActive, "organization isActive"),
      jurisdictionId: requiredText(read.jurisdictionId, "organization jurisdictionId"),
      name: requiredText(read.name, "organization name"),
      parentOrganizationId: read.parentOrganizationId,
      sourceUrl: source.sourceUrl
    },
    sourceProjectionContext(source, apiBaseUrl)
  )
}

function canonicalSource(
  record: Readonly<{
    createdAt: Date
    id: string
    provenanceComplete: boolean
    sourceIsOfficial: boolean | null
    sourceProvider: string | null
    sourceRetrievedAt: Date | null
    sourceUpdatedAt: Date | null
    sourceUrl: string | null
    updatedAt: Date
  }>,
  name: string
) {
  if (
    !record.provenanceComplete ||
    record.sourceIsOfficial === null ||
    !isNonemptyString(record.sourceProvider) ||
    record.sourceRetrievedAt === null ||
    !isNonemptyString(record.sourceUrl)
  ) {
    throw new LegislationError("unprocessable", `${name} canonical provenance is incomplete`)
  }
  return {
    createdAt: record.createdAt,
    id: record.id,
    sourceUpdatedAt: record.sourceUpdatedAt,
    sourceUrl: record.sourceUrl,
    updatedAt: record.updatedAt
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

function canonicalOrganizationClassification(value: string | null): OrganizationSummary["classification"] {
  switch (value) {
    case "legislature":
    case "chamber":
    case "committee":
    case "subcommittee":
    case "commission":
    case "agency":
    case "other":
      return value
    default:
      throw new LegislationError("unprocessable", "organization classification is not canonical")
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
