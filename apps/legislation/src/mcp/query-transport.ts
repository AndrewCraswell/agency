import { LegislationApiClient, type FetchLike } from "../api-client/client.js"
import type { LegislationConfig } from "../config/config.js"
import { HttpLegislationQueryAdapter } from "./http-query-adapter.js"
import { HybridLegislationQueryAdapter } from "./hybrid-query-adapter.js"
import type { LegislationQueryApi } from "./tools.js"

export function createMcpQueryApi(
  config: LegislationConfig["mcp"],
  inProcess: LegislationQueryApi,
  fetch?: FetchLike
): LegislationQueryApi {
  if (config.transport === "in-process") {
    return inProcess
  }
  const http = new HttpLegislationQueryAdapter(
    new LegislationApiClient({
      baseUrl: config.apiBaseUrl,
      bearerToken: config.bearerToken,
      fetch,
      timeoutMs: config.timeoutMs
    })
  )
  return config.transport === "hybrid" ? new HybridLegislationQueryAdapter(http, inProcess, config.httpMethods) : http
}
