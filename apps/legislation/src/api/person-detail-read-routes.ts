import type { PersonDetailRead } from "../db/queries/person-detail-read.js"
import { LegislationError } from "../legislation/errors.js"
import {
  projectLegislativeTerm,
  projectPersonDetail,
  type ExternalIdentifier,
  type PersonDetail,
  type ProjectionContext,
  type ProjectionSourceInput
} from "./canonical-projection.js"
import { toProjectionLegislationError } from "./canonical-read.js"
import {
  apiResource,
  assertAllowedQueryParameters,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"
import { projectOrganizationMembershipRead } from "./membership-read-projection.js"

export interface PersonDetailReadApi {
  getPersonDetail(personId: string): Promise<PersonDetailRead>
}

export function createPersonDetailReadApiHandler(
  service: PersonDetailReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    try {
      const personId = routePersonId(request.method, url.pathname)
      if (personId === undefined) {
        return false
      }
      assertAllowedQueryParameters(url, [])
      const detail = await service.getPersonDetail(personId)
      sendApiJson(response, 200, apiResource(request, projectPersonDetailRead(detail, options.apiBaseUrl)))
      return true
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

export function projectPersonDetailRead(read: PersonDetailRead, apiBaseUrl: string): PersonDetail {
  const personContext = projectionContext([read.person, read.profile], apiBaseUrl, "person detail")
  const personSource = source(read.person, "person")
  return projectPersonDetail(
    {
      email: read.profile.sourceIsOfficial ? read.profile.publicEmail : null,
      externalIdentifiers: read.externalIdentifiers.map((identifier) => projectExternalIdentifier(identifier)),
      memberships: read.memberships.items.map((membership) =>
        projectOrganizationMembershipRead(membership, apiBaseUrl)
      ),
      membershipsPageInfo: {
        limit: 25,
        nextCursor: read.memberships.nextCursor ?? null,
        truncated: read.memberships.truncated
      },
      officialUrl: read.profile.officialUrl,
      otherNames: read.aliases.map((alias) => alias.name),
      person: {
        familyName: read.person.familyName,
        givenName: read.person.givenName,
        id: requiredCanonicalText(read.person.id, "person ID"),
        imageUrl: read.profile.imageUrl,
        isActive: requiredBoolean(read.person.isActive, "person isActive"),
        jurisdictionIds: uniqueSorted(read.jurisdictions.map((jurisdiction) => jurisdiction.jurisdictionId)),
        name: requiredCanonicalText(read.person.name, "person name"),
        party: read.person.party,
        sourceUrl: personSource.sourceUrl
      },
      terms: read.terms.map((term) => {
        const termSource = source(term, "person legislative term")
        return projectLegislativeTerm(
          {
            district: term.district,
            endDate: term.endDate,
            id: requiredCanonicalText(term.id, "person legislative term ID"),
            isCurrent: requiredBoolean(term.isActive, "person legislative term isActive"),
            jurisdictionId: requiredCanonicalText(term.jurisdictionId, "person legislative term jurisdictionId"),
            officeTitle: requiredCanonicalText(term.officeTitle, "person legislative term officeTitle"),
            organizationId: term.organizationId,
            personId: requiredCanonicalText(term.personId, "person legislative term personId"),
            sourceUrl: termSource.sourceUrl,
            startDate: term.startDate
          },
          projectionContext([term], apiBaseUrl, "person legislative term")
        )
      })
    },
    personContext
  )
}

function projectExternalIdentifier(identifier: PersonDetailRead["externalIdentifiers"][number]): ExternalIdentifier {
  source(identifier, "person external identifier")
  return {
    scheme: requiredCanonicalText(identifier.scheme, "person external identifier scheme"),
    sourceUrl: identifier.sourceUrl,
    value: requiredCanonicalText(identifier.value, "person external identifier value")
  }
}

function routePersonId(method: string | undefined, pathname: string): string | undefined {
  if (method !== "GET") {
    return undefined
  }
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length !== 3 || segments[0] !== "api" || segments[1] !== "people") {
    return undefined
  }
  const encodedPersonId = segments[2]
  try {
    return requiredPathId(decodeURIComponent(encodedPersonId ?? ""), "personId")
  } catch (error) {
    if (error instanceof LegislationError) {
      throw error
    }
    throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
  }
}

function projectionContext(
  records: readonly [PersistedSourceRecord, ...PersistedSourceRecord[]],
  apiBaseUrl: string,
  label: string
): ProjectionContext {
  const [first, ...rest] = records
  const sources: [ProjectionSourceInput, ...ProjectionSourceInput[]] = [
    source(first, label),
    ...rest.map((record) => source(record, label))
  ]
  return {
    apiBaseUrl,
    sources,
    updatedAt: first.updatedAt
  }
}

type PersistedSourceRecord = Readonly<{
  provenanceComplete: boolean
  sourceIsOfficial: boolean | null
  sourceProvider: string | null
  sourceRetrievedAt: Date | null
  sourceUpdatedAt: Date | null
  sourceUrl: string | null
  updatedAt: Date
}>

function source(record: PersistedSourceRecord, label: string): ProjectionSourceInput {
  if (
    !record.provenanceComplete ||
    record.sourceIsOfficial === null ||
    !isNonemptyString(record.sourceProvider) ||
    record.sourceRetrievedAt === null ||
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

function requiredBoolean(value: boolean | null, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new LegislationError("unprocessable", `${name} must be boolean`)
  }
  return value
}

function requiredCanonicalText(value: string | undefined | null, name: string): string {
  if (!isNonemptyString(value) || value.length > 256) {
    throw new LegislationError("unprocessable", `${name} must be a non-empty canonical string`)
  }
  return value
}

function requiredPathId(value: string | undefined | null, name: string): string {
  if (!isNonemptyString(value)) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  if (value.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return value
}

function isNonemptyString(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}
