import type { LegislationQueryService } from "../legislation/query-service.js"
import { createCivicSearchApiHandler } from "./civic-search.js"
import { createCoreReadApiHandler } from "./core-read.js"
import { createCompositeHttpApiHandler, type HttpApiHandler } from "./http.js"
import { createSubscriptionReadApiHandler } from "./subscription-routes.js"
import { createWebhookSecretProtector, type SubscriptionRepository, SubscriptionService } from "./subscriptions.js"

/**
 * The sole composition point for public HTTP route slices. Domain slices add a
 * handler here; the HTTP server and CLI remain unaware of individual routes.
 */
export function createLegislationApiHandler(
  queryService: LegislationQueryService,
  options: Readonly<{ apiBaseUrl: string; subscriptionRepository?: SubscriptionRepository }>
): HttpApiHandler {
  return createCompositeHttpApiHandler([
    createCoreReadApiHandler(queryService, options),
    createCivicSearchApiHandler(queryService, options),
    ...(options.subscriptionRepository === undefined
      ? []
      : [
          createSubscriptionReadApiHandler(
            new SubscriptionService(
              options.subscriptionRepository,
              createWebhookSecretProtector(async () => {
                throw new Error("Webhook secret protection is not configured for this deployment.")
              })
            ),
            options
          )
        ])
  ])
}
