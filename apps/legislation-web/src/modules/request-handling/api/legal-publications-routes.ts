import {
  legalPublicationsRequestSchema,
  legalPublicationVersionsRequestSchema,
  validateLegalPublicationResponse,
  validateLegalPublicationsResponse,
  validateLegalPublicationVersionsResponse
} from "@repo/legislation-core/api-client/legal-publications-contract"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { z } from "zod"
import {
  apiPage,
  apiResource,
  assertAllowedQueryParameters,
  queryInteger,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"
import type { createLegalPublicationsReader } from "./legal-publications-read"

function oneValue(url: URL) {
  for (const key of url.searchParams.keys()) {
    if (url.searchParams.getAll(key).length !== 1) {
      throw new LegislationError("invalid_request", "Duplicate query parameter")
    }
  }
}

function uuidSegment(value: string, message: string) {
  const parsed = z.uuid().safeParse(decodeURIComponent(value))
  if (!parsed.success) {
    throw new LegislationError("invalid_request", message)
  }
  return parsed.data
}

export function createLegalPublicationsApiHandler(
  reader: ReturnType<typeof createLegalPublicationsReader>
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    const detail = /^\/api\/legal\/publications\/([^/]+)$/.exec(url.pathname)
    const versions = /^\/api\/legal\/publications\/([^/]+)\/versions$/.exec(url.pathname)
    if (request.method !== "GET" || (url.pathname !== "/api/legal/publications" && !detail && !versions)) {
      return false
    }
    response.setHeader("cache-control", "private, no-store")
    try {
      oneValue(url)
      if (detail?.[1]) {
        assertAllowedQueryParameters(url, ["versionId"])
        const documentId = uuidSegment(detail[1], "Invalid regulatory publication ID")
        const versionValue = url.searchParams.get("versionId") ?? undefined
        const versionId =
          versionValue === undefined
            ? undefined
            : uuidSegment(versionValue, "Invalid regulatory publication version ID")
        const item = await reader.getPublication(documentId, versionId)
        sendApiJson(response, 200, validateLegalPublicationResponse(apiResource(request, item), documentId, versionId))
        return true
      }
      if (versions?.[1]) {
        assertAllowedQueryParameters(url, ["cursor", "limit"])
        const documentId = uuidSegment(versions[1], "Invalid regulatory publication ID")
        const parsed = legalPublicationVersionsRequestSchema.safeParse({
          ...Object.fromEntries(url.searchParams),
          limit: queryInteger(url, "limit", 20)
        })
        if (!parsed.success) {
          throw new LegislationError("invalid_request", "Invalid publication version continuation")
        }
        const page = await reader.listVersions(documentId, parsed.data)
        sendApiJson(
          response,
          200,
          validateLegalPublicationVersionsResponse(apiPage(request, page, parsed.data.limit), documentId, parsed.data)
        )
        return true
      }
      assertAllowedQueryParameters(url, [
        "jurisdictionId",
        "sourceId",
        "sourceAgencyId",
        "agencyId",
        "kind",
        "publishedFrom",
        "publishedTo",
        "updatedSince",
        "cursor",
        "limit"
      ])
      const parsed = legalPublicationsRequestSchema.safeParse({
        ...Object.fromEntries(url.searchParams),
        limit: queryInteger(url, "limit", 20)
      })
      if (!parsed.success) {
        throw new LegislationError("invalid_request", "Invalid publication filters or continuation")
      }
      const page = await reader.listPublications(parsed.data)
      sendApiJson(
        response,
        200,
        validateLegalPublicationsResponse(apiPage(request, page, parsed.data.limit), parsed.data)
      )
    } catch (error) {
      sendApiError(request, response, error)
    }
    return true
  }
}
