import { searchPageSchema } from "../api-client/envelopes.js"
import { legalSearchRequestSchema, validateLegalSearchResponse } from "../api-client/legal-search-contract.js"
import { LegislationError } from "../legislation/errors.js"
import {
  apiSearchPage,
  assertAllowedQueryParameters,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"
import type { createLegalSearch } from "./legal-search-read.js"

export function createLegalSearchApiHandler(
  search: ReturnType<typeof createLegalSearch>,
  origin: string
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (request.method !== "POST" || url.pathname !== "/api/search/legal") {
      return false
    }
    response.setHeader("cache-control", "private, no-store")
    try {
      assertAllowedQueryParameters(url, [])
      const parsed = legalSearchRequestSchema.safeParse(await readJsonBody(request, 32768))
      if (!parsed.success) {
        throw new LegislationError("invalid_request", "Invalid legal search request")
      }
      const page = await search(parsed.data, origin)
      const envelope = searchPageSchema.parse(
        apiSearchPage(request, page, parsed.data.limit, { mode: parsed.data.mode, isReranked: false, models: [] })
      )
      // POST continuation reuses this endpoint and places nextCursor in the JSON body.
      const links = { self: url.pathname, next: page.nextCursor === undefined ? null : url.pathname }
      sendApiJson(
        response,
        200,
        validateLegalSearchResponse({ ...envelope, links, meta: { ...envelope.meta, legal: page.legal } }, parsed.data)
      )
    } catch (error) {
      sendApiError(request, response, error)
    }
    return true
  }
}
