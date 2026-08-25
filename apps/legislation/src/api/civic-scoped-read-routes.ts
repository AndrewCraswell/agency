import type { IncomingMessage, ServerResponse } from "node:http"
import type {
  OrganizationMembershipLookup,
  OrganizationMembershipRead,
  PersonTermLookup,
  PersonTermRead
} from "../db/queries/civic-scoped-reads.js"
import { LegislationError } from "../legislation/errors.js"
import {
  projectLegislativeTerm,
  projectMembership,
  projectOrganizationSummary,
  projectPersonSummary,
  type OrganizationSummary,
  type PersonSummary
} from "./canonical-projection.js"
import { sourceProjectionContext, toProjectionLegislationError } from "./canonical-read.js"
import {
  assertAllowedQueryParameters,
  apiResource,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"

export interface CivicScopedReadApi {
  getOrganizationMembership: (input: OrganizationMembershipLookup) => Promise<OrganizationMembershipRead>
  getPersonTerm: (input: PersonTermLookup) => Promise<PersonTermRead>
}

export function createCivicScopedReadApiHandler(
  service: CivicScopedReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }
    try {
      return await handleCivicScopedReadRequest(service, request, response, url, options.apiBaseUrl)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handleCivicScopedReadRequest(
  service: CivicScopedReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  apiBaseUrl: string
): Promise<boolean> {
  const route = routeMatch(request.method, url.pathname)
  if (route === undefined) {
    return false
  }
  assertAllowedQueryParameters(url, [])

  switch (route.name) {
    case "getPersonTerm": {
      const read = await service.getPersonTerm({ personId: route.personId, termId: route.termId })
      sendApiJson(response, 200, apiResource(request, projectTerm(read, apiBaseUrl)))
      return true
    }
    case "getOrganizationMembership": {
      const read = await service.getOrganizationMembership({
        membershipId: route.membershipId,
        organizationId: route.organizationId
      })
      sendApiJson(response, 200, apiResource(request, projectMembershipRead(read, apiBaseUrl)))
      return true
    }
  }
}

function projectTerm(read: PersonTermRead, apiBaseUrl: string) {
  const source = canonicalSource(read.term, "term")
  return projectLegislativeTerm(
    {
      district: read.term.district,
      endDate: read.term.endDate,
      id: requiredText(read.term.id, "term ID"),
      isCurrent: requiredBoolean(read.term.isActive, "term isActive"),
      jurisdictionId: requiredText(read.term.jurisdictionId, "term jurisdictionId"),
      officeTitle: requiredText(read.term.officeTitle, "term officeTitle"),
      organizationId: read.term.organizationId,
      personId: requiredText(read.term.personId, "term personId"),
      sourceUrl: source.sourceUrl,
      startDate: read.term.startDate
    },
    sourceProjectionContext(source, apiBaseUrl)
  )
}

function projectMembershipRead(read: OrganizationMembershipRead, apiBaseUrl: string) {
  const source = canonicalSource(read.membership, "membership")
  return projectMembership(
    {
      endDate: read.membership.endDate,
      id: requiredText(read.membership.id, "membership ID"),
      isCurrent: requiredBoolean(read.membership.isActive, "membership isActive"),
      label: read.membership.label,
      organization: projectOrganization(read.organization, apiBaseUrl),
      person: projectPerson(read.person, apiBaseUrl),
      role: requiredText(read.membership.role, "membership role"),
      sourceUrl: source.sourceUrl,
      startDate: read.membership.startDate
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

type CivicScopedReadRoute =
  | { name: "getPersonTerm"; personId: string; termId: string }
  | { membershipId: string; name: "getOrganizationMembership"; organizationId: string }

function routeMatch(method: string | undefined, pathname: string): CivicScopedReadRoute | undefined {
  if (method !== "GET") {
    return undefined
  }
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
      }
    })
  if (segments[0] !== "api") {
    return undefined
  }
  if (segments[1] === "people" && segments[3] === "terms" && segments.length === 5) {
    return {
      name: "getPersonTerm",
      personId: canonicalPathId(segments[2], "personId"),
      termId: canonicalPathId(segments[4], "termId")
    }
  }
  if (segments[1] === "organizations" && segments[3] === "memberships" && segments.length === 5) {
    return {
      membershipId: canonicalPathId(segments[4], "membershipId"),
      name: "getOrganizationMembership",
      organizationId: canonicalPathId(segments[2], "organizationId")
    }
  }
  return undefined
}

function canonicalPathId(value: string | undefined, name: string): string {
  if (value === undefined || value.length < 1 || value.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return value
}
