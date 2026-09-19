import { LegislationError, normalizeLegislationError } from "@repo/legislation-core/domain/errors"
import { apiErrorResponse, apiResource, jsonResponse, readJsonBody } from "../request-handling/api/next/http"
import { representativeLookupRequestSchema, representativeLookupResultSchema } from "./contracts"
import type { createRepresentativeLookup } from "./representativeLookup"

type Lookup = ReturnType<typeof createRepresentativeLookup>
type Dependencies = Readonly<{
  environment: () => string | undefined
  getLookup: () => Lookup | Promise<Lookup>
  now?: () => number
}>

export function createRepresentativeRequestHandler({ environment, getLookup, now = Date.now }: Dependencies) {
  let windowStart = 0
  let requests = 0
  let isRunning = false
  return async (request: Request): Promise<Response> => {
    const headers = { "cache-control": "private, no-store", "referrer-policy": "no-referrer" }
    let ownsSlot = false
    try {
      if (environment() !== "development" || request.method !== "POST") {
        throw new LegislationError("not_found", "Not found")
      }
      const url = new URL(request.url)
      if (url.pathname !== "/api/dev/representatives" || url.search) {
        throw new LegislationError(
          "invalid_request",
          "Use the representative lookup endpoint without query parameters."
        )
      }
      const host = request.headers.get("host") ?? url.host
      const expectedOrigin = `${url.protocol}//${host}`
      if (request.headers.get("origin") !== expectedOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
        throw new LegislationError("forbidden", "Representative lookup must be requested from this app.")
      }
      if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") {
        throw new LegislationError("invalid_request", "Send the location as JSON.")
      }
      const bodySignal = AbortSignal.any([request.signal, AbortSignal.timeout(10_000)])
      const bodyRequest = new Request(request, { signal: bodySignal })
      const input = representativeLookupRequestSchema.safeParse(await readJsonBody(bodyRequest, 2048))
      if (!input.success) {
        throw new LegislationError("invalid_request", "Provide valid coordinates or one complete U.S. street address.")
      }
      request.signal.throwIfAborted()
      const time = now()
      if (time - windowStart >= 60_000) {
        windowStart = time
        requests = 0
      }
      if (isRunning || requests >= 30) {
        throw new LegislationError(
          "dependency_unavailable",
          "The development lookup limit was reached. Try again later."
        )
      }
      isRunning = true
      ownsSlot = true
      requests += 1
      const lookup = await getLookup()
      const result = representativeLookupResultSchema.parse(await lookup(input.data, request.signal))
      return jsonResponse(request, 200, apiResource(request, result), { headers })
    } catch (error) {
      // Only fixed public errors leave this boundary; input/provider payloads are never captured.
      const normalized = normalizeLegislationError(error)
      const safeError = request.signal.aborted
        ? new LegislationError("dependency_unavailable", "Representative lookup was cancelled.")
        : new LegislationError(normalized.category, normalized.message)
      return apiErrorResponse(request, safeError, { headers })
    } finally {
      if (ownsSlot) {
        isRunning = false
      }
    }
  }
}
