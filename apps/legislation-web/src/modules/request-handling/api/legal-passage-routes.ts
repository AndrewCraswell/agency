import {
  legalPassageRequestSchema,
  legalPassagesRequestSchema,
  validateLegalPassageResponse,
  validateLegalPassagesResponse
} from "@repo/legislation-core/api-client/legal-passage-contract"
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
import type { createLegalPassageReader } from "./legal-passage-read"

function uniqueQuery(url: URL) {
  for (const key of url.searchParams.keys()) {
    if (url.searchParams.getAll(key).length !== 1) {
      throw new LegislationError("invalid_request", "Duplicate query parameter")
    }
  }
}

export function createLegalPassageApiHandler(reader: ReturnType<typeof createLegalPassageReader>): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    const list = /^\/api\/legal\/versions\/([^/]+)\/passages$/.exec(url.pathname)
    const detail = /^\/api\/legal\/passages\/([^/]+)$/.exec(url.pathname)
    if (request.method !== "GET" || (!list?.[1] && !detail?.[1])) {
      return false
    }
    response.setHeader("cache-control", "private, no-store")
    try {
      uniqueQuery(url)
      if (list?.[1]) {
        assertAllowedQueryParameters(url, ["editionId", "sourceObservationId", "cursor", "limit"])
        let versionId: string
        try {
          versionId = z.uuid().parse(decodeURIComponent(list[1]))
        } catch {
          throw new LegislationError("invalid_request", "Invalid legal version ID")
        }
        const query = Object.fromEntries(url.searchParams)
        const parsed = legalPassagesRequestSchema.safeParse({ ...query, limit: queryInteger(url, "limit", 20) })
        if (!parsed.success) {
          throw new LegislationError("invalid_request", "Invalid passage selection or continuation")
        }
        const page = await reader.listPassages(versionId, parsed.data)
        sendApiJson(
          response,
          200,
          validateLegalPassagesResponse(apiPage(request, page, parsed.data.limit), versionId, parsed.data)
        )
        return true
      }
      assertAllowedQueryParameters(url, ["editionId", "sourceObservationId"])
      let passageId: string
      try {
        passageId = z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .parse(decodeURIComponent(detail![1]!))
      } catch {
        throw new LegislationError("invalid_request", "Invalid legal passage ID")
      }
      const parsed = legalPassageRequestSchema.safeParse(Object.fromEntries(url.searchParams))
      if (!parsed.success) {
        throw new LegislationError("invalid_request", "Invalid passage selection")
      }
      const passage = await reader.getPassage(passageId, parsed.data)
      sendApiJson(response, 200, validateLegalPassageResponse(apiResource(request, passage), passageId, parsed.data))
    } catch (error) {
      sendApiError(request, response, error)
    }
    return true
  }
}
