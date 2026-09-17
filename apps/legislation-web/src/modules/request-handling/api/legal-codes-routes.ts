import {
  legalCodesRequestSchema,
  validateLegalCodesResponse,
  validateLegalCodeResponse
} from "@repo/legislation-core/api-client/legal-codes-contract"
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
import type { createLegalCodesReader } from "./legal-codes-read"

export function createLegalCodesApiHandler(reader: ReturnType<typeof createLegalCodesReader>): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    const detail = /^\/api\/legal\/codes\/([^/]+)$/.exec(url.pathname)
    if (request.method !== "GET" || (url.pathname !== "/api/legal/codes" && !detail)) {
      return false
    }
    response.setHeader("cache-control", "private, no-store")
    try {
      if (detail?.[1]) {
        assertAllowedQueryParameters(url, [])
        let codeId: string
        try {
          codeId = z.uuid().parse(decodeURIComponent(detail[1]))
        } catch {
          throw new LegislationError("invalid_request", "Invalid legal code ID")
        }
        const code = await reader.getCode(codeId)
        sendApiJson(response, 200, validateLegalCodeResponse(apiResource(request, code), codeId))
        return true
      }
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
      const page = await reader.listCodes(parsed.data)
      sendApiJson(response, 200, validateLegalCodesResponse(apiPage(request, page, parsed.data.limit), parsed.data))
    } catch (error) {
      sendApiError(request, response, error)
    }
    return true
  }
}
