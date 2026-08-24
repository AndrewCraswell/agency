import type { LegislationQueryService } from "../legislation/query-service.js"
import { createCivicSearchApiHandler } from "./civic-search.js"
import { createCoreReadApiHandler } from "./core-read.js"
import { createCompositeHttpApiHandler, type HttpApiHandler } from "./http.js"

/**
 * The sole composition point for public HTTP route slices. Domain slices add a
 * handler here; the HTTP server and CLI remain unaware of individual routes.
 */
export function createLegislationApiHandler(
  queryService: LegislationQueryService,
  options: Readonly<{ apiBaseUrl: string }>
): HttpApiHandler {
  return createCompositeHttpApiHandler([
    createCoreReadApiHandler(queryService, options),
    createCivicSearchApiHandler(queryService)
  ])
}
