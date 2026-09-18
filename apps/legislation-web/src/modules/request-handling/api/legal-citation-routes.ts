import {
  legalCitationRequestSchema,
  validateLegalCitationResponse
} from "@repo/legislation-core/api-client/legal-citation-contract"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import {
  apiResource,
  assertAllowedQueryParameters,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"

export function createLegalCitationApiHandler(resolve: (input: unknown) => Promise<unknown>): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (request.method !== "POST" || url.pathname !== "/api/legal/provisions/resolve") {
      return false
    }
    response.setHeader("cache-control", "private, no-store")
    try {
      assertAllowedQueryParameters(url, [])
      const parsed = legalCitationRequestSchema.safeParse(await readJsonBody(request))
      if (!parsed.success) {
        throw new LegislationError("invalid_request", "Invalid legal citation or scope")
      }
      const result = await resolve(parsed.data)
      sendApiJson(response, 200, validateLegalCitationResponse(apiResource(request, result), parsed.data))
    } catch (error) {
      sendApiError(request, response, error)
    }
    return true
  }
}
