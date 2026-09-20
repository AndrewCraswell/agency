import { LegislationError } from "@repo/legislation-core/domain/errors"
import type { OrganizationMembershipRead } from "../../legislation/persistence/queries/civic-scoped-reads"
import {
  projectMembership,
  projectOrganizationSummary,
  projectPersonSummary,
  type OrganizationSummary,
  type PersonSummary
} from "./canonical-projection"
import { persistedSourceProjectionContext } from "./persisted-source-projection"

/** Projects a persisted membership and both required embedded records fail-closed. */
export function projectOrganizationMembershipRead(read: OrganizationMembershipRead, apiBaseUrl: string) {
  const context = persistedSourceProjectionContext([read.membership], apiBaseUrl, "membership")
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
      sourceUrl: context.sources[0].sourceUrl
    },
    context
  )
}

function projectPerson(read: OrganizationMembershipRead["person"], apiBaseUrl: string): PersonSummary {
  const context = persistedSourceProjectionContext([read], apiBaseUrl, "person")
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
      sourceUrl: context.sources[0].sourceUrl
    },
    context
  )
}

function projectOrganization(
  read: OrganizationMembershipRead["organization"],
  apiBaseUrl: string
): OrganizationSummary {
  const context = persistedSourceProjectionContext([read], apiBaseUrl, "organization")
  return projectOrganizationSummary(
    {
      chamber: canonicalChamber(read.chamber),
      classification: canonicalOrganizationClassification(read.classification),
      id: requiredText(read.id, "organization ID"),
      isActive: requiredBoolean(read.isActive, "organization isActive"),
      jurisdictionId: requiredText(read.jurisdictionId, "organization jurisdictionId"),
      name: requiredText(read.name, "organization name"),
      parentOrganizationId: read.parentOrganizationId,
      sourceUrl: context.sources[0].sourceUrl
    },
    context
  )
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
