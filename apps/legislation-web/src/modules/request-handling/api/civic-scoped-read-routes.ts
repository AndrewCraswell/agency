import type { IncomingMessage, ServerResponse } from "node:http"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import type {
  OrganizationMembershipLookup,
  OrganizationMembershipRead,
  PersonTermLookup,
  PersonTermRead
} from "../../legislation/persistence/queries/civic-scoped-reads"
import { projectLegislativeTerm } from "./canonical-projection"
import { sourceProjectionContext, toProjectionLegislationError } from "./canonical-read"
import {
  assertAllowedQueryParameters,
  apiResource,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"
import { projectOrganizationMembershipRead } from "./membership-read-projection"

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
      sendApiJson(response, 200, apiResource(request, projectOrganizationMembershipRead(read, apiBaseUrl)))
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
