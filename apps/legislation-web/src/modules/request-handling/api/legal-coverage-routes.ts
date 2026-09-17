import {
  legalCoverageRequestSchema,
  validateLegalCoverageResponse
} from "@repo/legislation-core/api-client/legal-coverage-contract"
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

type LegalCoveragePage = Readonly<{
  items: readonly unknown[]
  nextCursor?: string
  truncated: boolean
  warnings?: readonly string[]
}>

export function createLegalCoverageApiHandler(reader: (input: unknown) => Promise<LegalCoveragePage>): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (request.method !== "GET" || url.pathname !== "/api/legal/coverage") {
      return false
    }
    response.setHeader("cache-control", "private, no-store")
    try {
      assertAllowedQueryParameters(url, ["jurisdictionId", "codeId", "corpus", "sourceId", "cursor", "limit"])
      for (const key of url.searchParams.keys()) {
        if (url.searchParams.getAll(key).length !== 1) {
          throw new LegislationError("invalid_request", "Duplicate query parameter")
        }
      }
      const parsed = legalCoverageRequestSchema.safeParse({
        ...Object.fromEntries(url.searchParams),
        limit: queryInteger(url, "limit", 20)
      })
      if (!parsed.success) {
        throw new LegislationError("invalid_request", "Invalid coverage filters or continuation")
      }
      const page = await reader(parsed.data)
      sendApiJson(response, 200, validateLegalCoverageResponse(apiPage(request, page, parsed.data.limit), parsed.data))
    } catch (error) {
      sendApiError(request, response, error)
    }
    return true
  }
}
