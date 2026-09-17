import {
  legalAgenciesRequestSchema,
  validateLegalAgenciesResponse
} from "@repo/legislation-core/api-client/legal-agencies-contract"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import {
  apiPage,
  assertAllowedQueryParameters,
  queryInteger,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"
import type { createLegalAgenciesReader } from "./legal-agencies-read"

export function createLegalAgenciesApiHandler(reader: ReturnType<typeof createLegalAgenciesReader>): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (request.method !== "GET" || url.pathname !== "/api/legal/agencies") {
      return false
    }
    response.setHeader("cache-control", "private, no-store")
    try {
      assertAllowedQueryParameters(url, ["jurisdictionId", "sourceId", "q", "cursor", "limit"])
      for (const key of url.searchParams.keys()) {
        if (url.searchParams.getAll(key).length !== 1) {
          throw new LegislationError("invalid_request", "Duplicate query parameter")
        }
      }
      const parsed = legalAgenciesRequestSchema.safeParse({
        ...Object.fromEntries(url.searchParams),
        limit: queryInteger(url, "limit", 20)
      })
      if (!parsed.success) {
        throw new LegislationError("invalid_request", "Invalid agency filters or continuation")
      }
      const page = await reader(parsed.data)
      sendApiJson(response, 200, validateLegalAgenciesResponse(apiPage(request, page, parsed.data.limit), parsed.data))
    } catch (error) {
      sendApiError(request, response, error)
    }
    return true
  }
}
