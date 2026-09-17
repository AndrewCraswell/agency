import { LegislationError } from "@repo/legislation-core/domain/errors"
import type { Telemetry } from "@repo/legislation-core/observability/telemetry"
import { describeAnalytics } from "@repo/legislation-core/research/analytics-catalog"
import {
  analyticsQuerySchema,
  analyticsCatalogSchema,
  type AnalyticsQuery
} from "@repo/legislation-core/research/analytics-contract"
import {
  apiResource,
  assertAllowedQueryParameters,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"

export function createAnalyticsHandler(
  analyze: (input: AnalyticsQuery) => Promise<unknown>,
  telemetry?: Telemetry
): HttpApiHandler {
  return async (request, response) => {
    if (!["POST", "GET"].includes(request.method ?? "") || requestUrl(request).pathname !== "/api/analytics") {
      return false
    }
    let hasValidated = false
    try {
      if (request.method === "GET") {
        const url = requestUrl(request)
        assertAllowedQueryParameters(url, ["dataset"])
        const input = analyticsCatalogSchema.parse({ datasets: url.searchParams.getAll("dataset") })
        sendApiJson(
          response,
          200,
          apiResource(request, describeAnalytics(input.datasets?.length ? input.datasets : undefined))
        )
        return true
      }
      const parsed = analyticsQuerySchema.safeParse(await readJsonBody(request))
      if (!parsed.success) {
        throw new LegislationError("invalid_request", "Invalid analytics query")
      }
      hasValidated = true
      sendApiJson(response, 200, apiResource(request, await analyze(parsed.data)))
    } catch (error) {
      if (!hasValidated) {
        telemetry?.reportFailure?.("analytics.http", { stage: "validation" }, error)
      }
      sendApiError(request, response, error)
    }
    return true
  }
}
