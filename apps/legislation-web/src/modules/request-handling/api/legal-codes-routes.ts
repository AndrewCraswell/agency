import {
  legalCodesRequestSchema,
  validateLegalCodesResponse
} from "@repo/legislation-core/api-client/legal-codes-contract"
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
import type { createLegalCodesReader } from "./legal-codes-read"

export function createLegalCodesApiHandler(readCodes: ReturnType<typeof createLegalCodesReader>): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (request.method !== "GET" || url.pathname !== "/api/legal/codes") {
      return false
    }
    response.setHeader("cache-control", "private, no-store")
    try {
      assertAllowedQueryParameters(url, ["jurisdictionId", "kind", "cursor", "limit"])
      for (const key of url.searchParams.keys()) {
        if (url.searchParams.getAll(key).length !== 1) {
          throw new LegislationError("invalid_request", "Duplicate query parameter")
        }
      }
      const parsed = legalCodesRequestSchema.safeParse({
        ...Object.fromEntries(url.searchParams),
        limit: queryInteger(url, "limit", 20)
      })
      if (!parsed.success) {
        throw new LegislationError("invalid_request", "Invalid code filters or continuation")
      }
      const page = await readCodes(parsed.data)
      sendApiJson(response, 200, validateLegalCodesResponse(apiPage(request, page, parsed.data.limit), parsed.data))
    } catch (error) {
      sendApiError(request, response, error)
    }
    return true
  }
}
