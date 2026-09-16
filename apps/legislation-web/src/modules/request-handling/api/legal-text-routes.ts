import {
  legalTextRequestSchema,
  validateLegalTextResponse
} from "@repo/legislation-core/api-client/legal-text-contract"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { z } from "zod"
import {
  apiResource,
  assertAllowedQueryParameters,
  queryInteger,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"
import type { createLegalTextReader } from "./legal-text-read.js"

export function createLegalTextApiHandler(readText: ReturnType<typeof createLegalTextReader>): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    const match = /^\/api\/legal\/versions\/([^/]+)\/text$/.exec(url.pathname)
    if (request.method !== "GET" || !match?.[1]) {
      return false
    }
    response.setHeader("cache-control", "private, no-store")
    try {
      assertAllowedQueryParameters(url, ["editionId", "sourceObservationId", "anchor", "cursor", "limit"])
      for (const key of url.searchParams.keys()) {
        if (url.searchParams.getAll(key).length !== 1) {
          throw new LegislationError("invalid_request", "Duplicate query parameter")
        }
      }
      let versionId: string
      try {
        versionId = z.uuid().parse(decodeURIComponent(match[1]))
      } catch {
        throw new LegislationError("invalid_request", "Invalid legal version ID")
      }
      const query = Object.fromEntries(url.searchParams)
      const parsed = legalTextRequestSchema.safeParse({ ...query, limit: queryInteger(url, "limit", 20) })
      if (!parsed.success) {
        throw new LegislationError("invalid_request", "Invalid legal text selection or continuation")
      }
      const input = parsed.data
      const data = await readText(versionId, input)
      const body = validateLegalTextResponse(apiResource(request, data), versionId, input)
      sendApiJson(response, 200, body)
    } catch (error) {
      sendApiError(request, response, error)
    }
    return true
  }
}
