import type { LegislationDatabase } from "../db/database.js"
import { assertBillRelatedParentExists, listBillRelatedBills } from "../db/queries/bill-related-read.js"
import { listBillTextSections } from "../db/queries/bill-text-read.js"
import { listBillTimeline } from "../db/queries/bill-timeline-read.js"
import { listChangeFeed } from "../db/queries/change-feed-reads.js"
import { getOrganizationMembership, getPersonTerm } from "../db/queries/civic-scoped-reads.js"
import { readDocumentDiff } from "../db/queries/document-diff-read.js"
import {
  assertBillExists,
  assertSupportingMaterialExists,
  getDocumentDetail,
  getDocumentSection,
  listBillDocuments,
  listDocumentSections,
  listSupportingMaterialSections
} from "../db/queries/document-reads.js"
import { getEventDocumentRead } from "../db/queries/event-document-read.js"
import {
  assertMeetingExists as assertMeetingAgendaParentExists,
  getMeetingAgendaItemRead,
  listMeetingAgenda
} from "../db/queries/meeting-agenda-read.js"
import { assertMeetingExists, listMeetingDocuments } from "../db/queries/meeting-document-read.js"
import {
  assertMeetingOutcomeParentExists,
  getMeetingOutcomeRead,
  listMeetingOutcomes
} from "../db/queries/meeting-outcome-read.js"
import { getMeetingParticipantRead } from "../db/queries/meeting-participant-read.js"
import {
  assertMeetingExists as assertMeetingParticipantParentExists,
  listMeetingParticipants
} from "../db/queries/meeting-participant-reads.js"
import { assertOrganizationExists, listOrganizationBillReads } from "../db/queries/organization-bill-read.js"
import { listPeople } from "../db/queries/people-read.js"
import { listPersonAmendments } from "../db/queries/person-amendments.js"
import { assertPersonExists, listPersonBillActivity } from "../db/queries/person-bill-activity.js"
import { getSupportingMaterialSectionRead } from "../db/queries/supporting-material-section-read.js"
import { createAmendmentReadRepository } from "./amendment-read-repository.js"
import { createAmendmentReadApiHandler } from "./amendment-read-routes.js"
import { createAmendmentSearchApiHandler, type AmendmentSearchApi } from "./amendment-search.js"
import { createBillDetailReadRepository } from "./bill-detail-read-repository.js"
import { createBillDetailReadApiHandler } from "./bill-detail-read-routes.js"
import { createBillRelatedReadApiHandler } from "./bill-related-read-routes.js"
import { createBillTextReadApiHandler } from "./bill-text-read-routes.js"
import { createBillTimelineReadApiHandler } from "./bill-timeline-read-routes.js"
import { createCalendarReadRepository } from "./calendar-read-repository.js"
import { createCalendarReadApiHandler } from "./calendar-read-routes.js"
import { createChangeFeedApiHandler } from "./change-feed-routes.js"
import { createCivicScopedReadApiHandler } from "./civic-scoped-read-routes.js"
import { createCivicSearchApiHandler, type CivicSearchApi } from "./civic-search.js"
import { createCoreReadApiHandler, type CoreReadQueryApi } from "./core-read.js"
import { createDocumentDiffApiHandler } from "./document-diff-routes.js"
import { createDocumentReadApiHandler, type DocumentReadApi } from "./document-read-routes.js"
import { createEventDocumentReadApiHandler } from "./event-document-read-routes.js"
import { createCompositeHttpApiHandler, type HttpApiHandler } from "./http.js"
import { createJurisdictionCollectionReadRepository } from "./jurisdiction-collection-read-repository.js"
import { createJurisdictionCollectionReadApiHandler } from "./jurisdiction-collection-read-routes.js"
import { createJurisdictionOrganizationRepository } from "./jurisdiction-organization-read-repository.js"
import { createJurisdictionOrganizationReadApiHandler } from "./jurisdiction-organization-read-routes.js"
import { createJurisdictionReadRepository } from "./jurisdiction-read-repository.js"
import { createJurisdictionReadApiHandler } from "./jurisdiction-read-routes.js"
import { createMeetingAgendaReadApiHandler } from "./meeting-agenda-read-routes.js"
import { createMeetingDocumentReadApiHandler } from "./meeting-document-read-routes.js"
import { createMeetingOutcomeReadApiHandler } from "./meeting-outcome-read-routes.js"
import { createMeetingParticipantListApiHandler } from "./meeting-participant-list-routes.js"
import { createMeetingParticipantReadApiHandler } from "./meeting-participant-read-routes.js"
import { createMeetingReadRepository } from "./meeting-read-repository.js"
import { createMeetingReadApiHandler } from "./meeting-read-routes.js"
import { createOrganizationBillReadApiHandler } from "./organization-bill-read-routes.js"
import { createOrganizationDetailReadRepository } from "./organization-detail-read-repository.js"
import { createOrganizationDetailReadApiHandler } from "./organization-detail-read-routes.js"
import { createOrganizationMembersRepository } from "./organization-members-read-repository.js"
import { createOrganizationMembersReadApiHandler } from "./organization-members-read-routes.js"
import { createOrganizationReadRepository } from "./organization-read-repository.js"
import { createOrganizationReadApiHandler } from "./organization-read-routes.js"
import { createPassageSearchApiHandler } from "./passage-search.js"
import { createPeopleReadApiHandler } from "./people-read-routes.js"
import { createPersonAmendmentApiHandler } from "./person-amendment-routes.js"
import { createPersonBillActivityApiHandler } from "./person-bill-activity-routes.js"
import { createPersonDetailReadRepository } from "./person-detail-read-repository.js"
import { createPersonDetailReadApiHandler } from "./person-detail-read-routes.js"
import { createPersonMembershipsRepository } from "./person-membership-read-repository.js"
import { createPersonMembershipReadApiHandler } from "./person-membership-read-routes.js"
import { createResourceBatchReadRepositoryFromCanonicalReads } from "./resource-batch-read-repository.js"
import { createResourceBatchReadApiHandler } from "./resource-batch-read-routes.js"
import { createSessionRepository } from "./session-read-repository.js"
import { createSessionReadApiHandler } from "./session-read-routes.js"
import type { SubscriptionMutationExecutor } from "./subscription-repository.js"
import { createSubscriptionMutationApiHandler, createSubscriptionReadApiHandler } from "./subscription-routes.js"
import {
  createWebhookSecretProtector,
  type SubscriptionRepository,
  type WebhookSecretProtector,
  SubscriptionService
} from "./subscriptions.js"
import { createSupportingMaterialSectionReadApiHandler } from "./supporting-material-section-read-routes.js"
import { createVoteReadRepository } from "./vote-read-repository.js"
import { createVoteReadApiHandler } from "./vote-read-routes.js"
import { createWebhookMutationApiHandler } from "./webhook-mutation-routes.js"
import type { WebhookReadRepository } from "./webhook-read-repository.js"
import { createWebhookReadApiHandler } from "./webhook-read-routes.js"

/**
 * The sole composition point for public HTTP route slices. Domain slices add a
 * handler here; the HTTP server and CLI remain unaware of individual routes.
 */
export function createLegislationApiHandler(
  queryService: CoreReadQueryApi & CivicSearchApi & AmendmentSearchApi,
  options: Readonly<{
    apiBaseUrl: string
    documentDatabase?: LegislationDatabase
    documentReadApi?: DocumentReadApi
    subscriptionMutationExecutor?: SubscriptionMutationExecutor
    subscriptionRepository?: SubscriptionRepository
    webhookMutationExecutor?: SubscriptionMutationExecutor
    webhookSecretProtector?: WebhookSecretProtector
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
  const resourceBatchReadRepository = createResourceBatchReadRepositoryFromCanonicalReads({
    apiBaseUrl: options.apiBaseUrl,
    coreReadApi: queryService,
    ...(documentReadApi === undefined ? {} : { documentReadApi })
  })
  return createCompositeHttpApiHandler([
    createResourceBatchReadApiHandler(resourceBatchReadRepository),
    ...(documentReadApi === undefined ? [] : [createDocumentReadApiHandler(documentReadApi, options)]),
    ...(documentDatabase === undefined
      ? []
      : [
          createDocumentDiffApiHandler(
            { readDocumentDiff: async (input) => await readDocumentDiff(documentDatabase, input) },
            options
          ),
          createAmendmentReadApiHandler(createAmendmentReadRepository(documentDatabase, options.apiBaseUrl)),
          createBillDetailReadApiHandler(createBillDetailReadRepository(documentDatabase, options.apiBaseUrl)),
          createVoteReadApiHandler(createVoteReadRepository(documentDatabase), options),
          createChangeFeedApiHandler(
            {
              assertBillExists: async (billId) => await assertBillExists(documentDatabase, billId),
              listChanges: async (input) => await listChangeFeed(documentDatabase, input)
            },
            options
          ),
          createBillTextReadApiHandler(
            {
              assertBillExists: async (billId) => await assertBillExists(documentDatabase, billId),
              listBillTextSections: async (input) => await listBillTextSections(documentDatabase, input)
            },
            options
          ),
          createBillRelatedReadApiHandler(
            {
              assertBillExists: async (billId) => await assertBillRelatedParentExists(documentDatabase, billId),
              listBillRelatedBills: async (input) => await listBillRelatedBills(documentDatabase, input)
            },
            options
          ),
          createCivicScopedReadApiHandler(
            {
              getOrganizationMembership: async (input) => await getOrganizationMembership(documentDatabase, input),
              getPersonTerm: async (input) => await getPersonTerm(documentDatabase, input)
            },
            options
          ),
          createBillTimelineReadApiHandler(
            {
              assertBillTimelineParentExists: async (billId) => await assertBillExists(documentDatabase, billId),
              listBillTimeline: async (input) => await listBillTimeline(documentDatabase, input)
            },
            options
          ),
          createEventDocumentReadApiHandler(
            {
              getEventDocument: async (input) => await getEventDocumentRead(documentDatabase, input)
            },
            options
          ),
          createJurisdictionOrganizationReadApiHandler(
            createJurisdictionOrganizationRepository(documentDatabase),
            options
          ),
          createJurisdictionCollectionReadApiHandler(
            createJurisdictionCollectionReadRepository(documentDatabase),
            options
          ),
          createJurisdictionReadApiHandler(createJurisdictionReadRepository(documentDatabase), options),
          createMeetingReadApiHandler(
            {
              ...createMeetingReadRepository(documentDatabase),
              listMeetingAgenda: async (input) => await listMeetingAgenda(documentDatabase, input),
              listMeetingDocuments: async (input) => await listMeetingDocuments(documentDatabase, input),
              listMeetingOutcomes: async (input) => await listMeetingOutcomes(documentDatabase, input),
              listMeetingParticipants: async (input) => await listMeetingParticipants(documentDatabase, input)
            },
            options
          ),
          createCalendarReadApiHandler(createCalendarReadRepository(documentDatabase), options),
          createMeetingAgendaReadApiHandler(
            {
              assertMeetingExists: async (meetingId) =>
                await assertMeetingAgendaParentExists(documentDatabase, meetingId),
              getMeetingAgendaItemRead: async (input) => await getMeetingAgendaItemRead(documentDatabase, input),
              listMeetingAgenda: async (input) => await listMeetingAgenda(documentDatabase, input)
            },
            options
          ),
          createMeetingParticipantReadApiHandler(
            {
              getMeetingParticipant: async (input) => await getMeetingParticipantRead(documentDatabase, input)
            },
            options
          ),
          createMeetingParticipantListApiHandler(
            {
              assertMeetingExists: async (meetingId) =>
                await assertMeetingParticipantParentExists(documentDatabase, meetingId),
              listMeetingParticipants: async (input) => await listMeetingParticipants(documentDatabase, input)
            },
            options
          ),
          createMeetingOutcomeReadApiHandler(
            {
              assertMeetingOutcomeParentExists: async (meetingId) =>
                await assertMeetingOutcomeParentExists(documentDatabase, meetingId),
              getMeetingOutcomeRead: async (input) => await getMeetingOutcomeRead(documentDatabase, input),
              listMeetingOutcomes: async (input) => await listMeetingOutcomes(documentDatabase, input)
            },
            options
          ),
          createMeetingDocumentReadApiHandler(
            {
              assertMeetingExists: async (meetingId) => await assertMeetingExists(documentDatabase, meetingId),
              listMeetingDocuments: async (input) => await listMeetingDocuments(documentDatabase, input)
            },
            options
          ),
          createOrganizationBillReadApiHandler(
            {
              assertOrganizationExists: async (organizationId) =>
                await assertOrganizationExists(documentDatabase, organizationId),
              listOrganizationBillReads: async (input) => await listOrganizationBillReads(documentDatabase, input)
            },
            options
          ),
          createOrganizationDetailReadApiHandler(
            createOrganizationDetailReadRepository(documentDatabase, options.apiBaseUrl)
          ),
          createOrganizationReadApiHandler(createOrganizationReadRepository(documentDatabase), options),
          createPeopleReadApiHandler(
            { listPeople: async (input) => await listPeople(documentDatabase, input) },
            options
          ),
          createPersonAmendmentApiHandler(
            {
              assertPersonExists: async (personId) => await assertPersonExists(documentDatabase, personId),
              listPersonAmendments: async (input) => await listPersonAmendments(documentDatabase, input)
            },
            options
          ),
          createPersonDetailReadApiHandler(createPersonDetailReadRepository(documentDatabase), options),
          createPersonBillActivityApiHandler(
            {
              assertPersonExists: async (personId) => await assertPersonExists(documentDatabase, personId),
              listPersonBillActivity: async (input) => await listPersonBillActivity(documentDatabase, input)
            },
            options
          ),
          createOrganizationMembersReadApiHandler(createOrganizationMembersRepository(documentDatabase), options),
          createPersonMembershipReadApiHandler(createPersonMembershipsRepository(documentDatabase), options),
          createSessionReadApiHandler(createSessionRepository(documentDatabase), options),
          createSupportingMaterialSectionReadApiHandler(
            {
              assertSupportingMaterialExists: async (materialId) =>
                await assertSupportingMaterialExists(documentDatabase, materialId),
              getSupportingMaterialSection: async (input) =>
                await getSupportingMaterialSectionRead(documentDatabase, input),
              listSupportingMaterialSections: async (input) =>
                await listSupportingMaterialSections(documentDatabase, input)
            },
            options
          )
        ]),
    createCoreReadApiHandler(queryService, options),
    createAmendmentSearchApiHandler(queryService, options),
    createCivicSearchApiHandler(queryService, options),
    createPassageSearchApiHandler(queryService, options),
    ...(options.subscriptionRepository === undefined
      ? []
      : (() => {
          const subscriptionService = new SubscriptionService(
            options.subscriptionRepository,
            options.webhookSecretProtector ??
              createWebhookSecretProtector(async () => {
                throw new Error("Webhook secret protection is not configured for this deployment.")
              })
          )
          return [
            createSubscriptionReadApiHandler(subscriptionService, options),
            ...(options.subscriptionMutationExecutor === undefined
              ? []
              : [
                  createSubscriptionMutationApiHandler(
                    subscriptionService,
                    options.subscriptionMutationExecutor,
                    options
                  )
                ]),
            ...(options.webhookMutationExecutor === undefined || options.webhookSecretProtector === undefined
              ? []
              : [createWebhookMutationApiHandler(subscriptionService, options.webhookMutationExecutor, options)])
          ]
        })()),
    ...(options.webhookReadRepository === undefined
      ? []
      : [createWebhookReadApiHandler(options.webhookReadRepository, options)])
  ])
}
