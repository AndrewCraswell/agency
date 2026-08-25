import type { LegislationDatabase } from "../db/database.js"
import { getOrganizationMembership, getPersonTerm } from "../db/queries/civic-scoped-reads.js"
import {
  assertBillExists,
  getDocumentDetail,
  getDocumentSection,
  listBillDocuments,
  listDocumentSections
} from "../db/queries/document-reads.js"
import { getEventDocumentRead } from "../db/queries/event-document-read.js"
import { getMeetingParticipantRead } from "../db/queries/meeting-participant-read.js"
import { getSupportingMaterialSectionRead } from "../db/queries/supporting-material-section-read.js"
import { createCivicScopedReadApiHandler } from "./civic-scoped-read-routes.js"
import { createCivicSearchApiHandler, type CivicSearchApi } from "./civic-search.js"
import { createCoreReadApiHandler, type CoreReadQueryApi } from "./core-read.js"
import { createDocumentReadApiHandler, type DocumentReadApi } from "./document-read-routes.js"
import { createEventDocumentReadApiHandler } from "./event-document-read-routes.js"
import { createCompositeHttpApiHandler, type HttpApiHandler } from "./http.js"
import { createMeetingParticipantReadApiHandler } from "./meeting-participant-read-routes.js"
import { createSubscriptionReadApiHandler } from "./subscription-routes.js"
import { createWebhookSecretProtector, type SubscriptionRepository, SubscriptionService } from "./subscriptions.js"
import { createSupportingMaterialSectionReadApiHandler } from "./supporting-material-section-read-routes.js"
import type { WebhookReadRepository } from "./webhook-read-repository.js"
import { createWebhookReadApiHandler } from "./webhook-read-routes.js"

/**
 * The sole composition point for public HTTP route slices. Domain slices add a
 * handler here; the HTTP server and CLI remain unaware of individual routes.
 */
export function createLegislationApiHandler(
  queryService: CoreReadQueryApi & CivicSearchApi,
  options: Readonly<{
    apiBaseUrl: string
    documentDatabase?: LegislationDatabase
    documentReadApi?: DocumentReadApi
    subscriptionRepository?: SubscriptionRepository
    webhookReadRepository?: WebhookReadRepository
  }>
): HttpApiHandler {
  const documentDatabase = options.documentDatabase
  if (options.documentReadApi !== undefined && documentDatabase !== undefined) {
    throw new Error("documentDatabase and documentReadApi cannot both be configured")
  }
  const documentReadApi =
    options.documentReadApi ??
    (documentDatabase === undefined
      ? undefined
      : {
          assertBillExists: async (billId: string) => await assertBillExists(documentDatabase, billId),
          getDocumentDetail: async (documentId: string) => await getDocumentDetail(documentDatabase, documentId),
          getDocumentSection: async (input) => await getDocumentSection(documentDatabase, input),
          listBillDocuments: async (input) => await listBillDocuments(documentDatabase, input),
          listDocumentSections: async (input) => await listDocumentSections(documentDatabase, input)
        })
  return createCompositeHttpApiHandler([
    ...(documentReadApi === undefined ? [] : [createDocumentReadApiHandler(documentReadApi, options)]),
    ...(documentDatabase === undefined
      ? []
      : [
          createCivicScopedReadApiHandler(
            {
              getOrganizationMembership: async (input) => await getOrganizationMembership(documentDatabase, input),
              getPersonTerm: async (input) => await getPersonTerm(documentDatabase, input)
            },
            options
          ),
          createEventDocumentReadApiHandler(
            {
              getEventDocument: async (input) => await getEventDocumentRead(documentDatabase, input)
            },
            options
          ),
          createMeetingParticipantReadApiHandler(
            {
              getMeetingParticipant: async (input) => await getMeetingParticipantRead(documentDatabase, input)
            },
            options
          ),
          createSupportingMaterialSectionReadApiHandler(
            {
              getSupportingMaterialSection: async (input) =>
                await getSupportingMaterialSectionRead(documentDatabase, input)
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
