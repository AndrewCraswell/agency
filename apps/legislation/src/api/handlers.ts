import type { LegislationDatabase } from "../db/database.js"
import {
  assertBillExists,
  getDocumentDetail,
  listBillDocuments,
  listDocumentSections
} from "../db/queries/document-reads.js"
import type { LegislationQueryService } from "../legislation/query-service.js"
import { createCivicSearchApiHandler } from "./civic-search.js"
import { createCoreReadApiHandler } from "./core-read.js"
import { createDocumentReadApiHandler } from "./document-read-routes.js"
import { createCompositeHttpApiHandler, type HttpApiHandler } from "./http.js"
import { createSubscriptionReadApiHandler } from "./subscription-routes.js"
import { createWebhookSecretProtector, type SubscriptionRepository, SubscriptionService } from "./subscriptions.js"
import type { WebhookReadRepository } from "./webhook-read-repository.js"
import { createWebhookReadApiHandler } from "./webhook-read-routes.js"

/**
 * The sole composition point for public HTTP route slices. Domain slices add a
 * handler here; the HTTP server and CLI remain unaware of individual routes.
 */
export function createLegislationApiHandler(
  queryService: LegislationQueryService,
  options: Readonly<{
    apiBaseUrl: string
    documentDatabase?: LegislationDatabase
    subscriptionRepository?: SubscriptionRepository
    webhookReadRepository?: WebhookReadRepository
  }>
): HttpApiHandler {
  const documentDatabase = options.documentDatabase
  return createCompositeHttpApiHandler([
    ...(documentDatabase === undefined
      ? []
      : [
          createDocumentReadApiHandler(
            {
              assertBillExists: async (billId) => await assertBillExists(documentDatabase, billId),
              getDocumentDetail: async (documentId) => await getDocumentDetail(documentDatabase, documentId),
              listBillDocuments: async (input) => await listBillDocuments(documentDatabase, input),
              listDocumentSections: async (input) => await listDocumentSections(documentDatabase, input)
            },
            options
          )
        ]),
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
        ]),
    ...(options.webhookReadRepository === undefined
      ? []
      : [createWebhookReadApiHandler(options.webhookReadRepository, options)])
  ])
}
