import {
  legalVersionRequestSchema,
  validateLegalVersionResponse
} from "@repo/legislation-core/api-client/legal-version-contract"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { z } from "zod"
import {
  apiResource,
  assertAllowedQueryParameters,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"
import type { createLegalVersionReader } from "./legal-version-read"

export function createLegalVersionApiHandler(readVersion: ReturnType<typeof createLegalVersionReader>): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    const match = /^\/api\/legal\/versions\/([^/]+)$/.exec(url.pathname)
    if (request.method !== "GET" || !match?.[1]) {
      return false
    }
    response.setHeader("cache-control", "private, no-store")
    try {
      assertAllowedQueryParameters(url, ["editionId", "sourceObservationId"])
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
      const parsed = legalVersionRequestSchema.safeParse(Object.fromEntries(url.searchParams))
      if (!parsed.success) {
        throw new LegislationError("invalid_request", "Invalid legal version selection")
      }
      const version = await readVersion(versionId, parsed.data)
      sendApiJson(response, 200, validateLegalVersionResponse(apiResource(request, version), versionId, parsed.data))
    } catch (error) {
      sendApiError(request, response, error)
    }
    return true
  }
}
