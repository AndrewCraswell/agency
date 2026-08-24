import { LegislationApiClient, type FetchLike } from "../api-client/client.js"
import type { LegislationConfig } from "../config/config.js"
import { HttpLegislationQueryAdapter } from "./http-query-adapter.js"
import type { LegislationQueryApi } from "./tools.js"

export function createMcpQueryApi(
  config: LegislationConfig["mcp"],
  inProcess: LegislationQueryApi,
  fetch?: FetchLike
): LegislationQueryApi {
  if (config.transport === "in-process") {
    return inProcess
  }
  return new HttpLegislationQueryAdapter(
    new LegislationApiClient({
      baseUrl: config.apiBaseUrl,
      bearerToken: config.bearerToken,
      fetch,
      timeoutMs: config.timeoutMs
    })
  )
}
