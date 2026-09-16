import type { RequestIdentity } from "@repo/legislation-core/auth/request-context"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  assertBillRelatedParentExists,
  listBillRelatedBills
} from "../../legislation/persistence/queries/bill-related-read"
import { listBillTextSections } from "../../legislation/persistence/queries/bill-text-read"
import { listBillTimeline } from "../../legislation/persistence/queries/bill-timeline-read"
import { getChangeEvent, listChangeFeed } from "../../legislation/persistence/queries/change-feed-reads"
import { getOrganizationMembership, getPersonTerm } from "../../legislation/persistence/queries/civic-scoped-reads"
import { readDocumentDiff } from "../../legislation/persistence/queries/document-diff-read"
import {
  assertBillExists,
  assertSupportingMaterialExists,
  getDocumentDetail,
  getDocumentSection,
  listBillDocuments,
  listDocumentSections,
  listSupportingMaterialSections
} from "../../legislation/persistence/queries/document-reads"
import { getEventDocumentRead } from "../../legislation/persistence/queries/event-document-read"
import {
  assertMeetingExists as assertMeetingAgendaParentExists,
  getMeetingAgendaItemRead,
  listMeetingAgenda
} from "../../legislation/persistence/queries/meeting-agenda-read"
import { assertMeetingExists, listMeetingDocuments } from "../../legislation/persistence/queries/meeting-document-read"
import { getMeetingParticipantRead } from "../../legislation/persistence/queries/meeting-participant-read"
import {
  assertMeetingExists as assertMeetingParticipantParentExists,
  listMeetingParticipants
} from "../../legislation/persistence/queries/meeting-participant-reads"
import {
  assertOrganizationExists,
  listOrganizationBillReads
} from "../../legislation/persistence/queries/organization-bill-read"
import { listPeople } from "../../legislation/persistence/queries/people-read"
import { listPersonAmendments } from "../../legislation/persistence/queries/person-amendments"
import { assertPersonExists, listPersonBillActivity } from "../../legislation/persistence/queries/person-bill-activity"
import { getSupportingMaterialSectionRead } from "../../legislation/persistence/queries/supporting-material-section-read"
import { createAmendmentReadRepository } from "./amendment-read-repository"
import { createAmendmentReadApiHandler } from "./amendment-read-routes"
import { createAmendmentSearchApiHandler, type AmendmentSearchApi } from "./amendment-search"
import { createBillDetailReadRepository } from "./bill-detail-read-repository"
import { createBillDetailReadApiHandler } from "./bill-detail-read-routes"
import { createBillRelatedReadApiHandler } from "./bill-related-read-routes"
import { createBillTextReadApiHandler } from "./bill-text-read-routes"
import { createBillTimelineReadApiHandler } from "./bill-timeline-read-routes"
import { createChangeFeedApiHandler } from "./change-feed-routes"
import { createCivicScopedReadApiHandler } from "./civic-scoped-read-routes"
import { createCivicSearchApiHandler, type CivicSearchApi } from "./civic-search"
import { createCoreReadApiHandler, type CoreReadQueryApi } from "./core-read"
import { createDocumentDiffApiHandler } from "./document-diff-routes"
import { createDocumentReadApiHandler, type DocumentReadApi } from "./document-read-routes"
import { createEventDocumentReadApiHandler } from "./event-document-read-routes"
import { createCompositeHttpApiHandler, type HttpApiHandler } from "./http"
import { createJurisdictionCollectionReadRepository } from "./jurisdiction-collection-read-repository"
import { createJurisdictionCollectionReadApiHandler } from "./jurisdiction-collection-read-routes"
import { createJurisdictionOrganizationRepository } from "./jurisdiction-organization-read-repository"
import { createJurisdictionOrganizationReadApiHandler } from "./jurisdiction-organization-read-routes"
import { createJurisdictionReadRepository } from "./jurisdiction-read-repository"
import { createJurisdictionReadApiHandler } from "./jurisdiction-read-routes"
import { createMeetingAgendaReadApiHandler } from "./meeting-agenda-read-routes"
import { createMeetingDocumentReadApiHandler } from "./meeting-document-read-routes"
import { createMeetingParticipantListApiHandler } from "./meeting-participant-list-routes"
import { createMeetingParticipantReadApiHandler } from "./meeting-participant-read-routes"
import { createMeetingReadRepository } from "./meeting-read-repository"
import { createMeetingReadApiHandler } from "./meeting-read-routes"
import { createOrganizationBillReadApiHandler } from "./organization-bill-read-routes"
import { createOrganizationDetailReadRepository } from "./organization-detail-read-repository"
import { createOrganizationDetailReadApiHandler } from "./organization-detail-read-routes"
import { createOrganizationMembersRepository } from "./organization-members-read-repository"
import { createOrganizationMembersReadApiHandler } from "./organization-members-read-routes"
import { createOrganizationReadRepository } from "./organization-read-repository"
import { createOrganizationReadApiHandler } from "./organization-read-routes"
import { createPassageSearchApiHandler } from "./passage-search"
import { createPeopleReadApiHandler } from "./people-read-routes"
import { createPersonAmendmentApiHandler } from "./person-amendment-routes"
import { createPersonBillActivityApiHandler } from "./person-bill-activity-routes"
import { createPersonDetailReadRepository } from "./person-detail-read-repository"
import { createPersonDetailReadApiHandler } from "./person-detail-read-routes"
import { createPersonMembershipsRepository } from "./person-membership-read-repository"
import { createPersonMembershipReadApiHandler } from "./person-membership-read-routes"
import {
  createResearchAnswerApiHandler,
  createUnavailableResearchAnswerApi,
  type ResearchAnswerApi
} from "./research-answers"
import { createResourceBatchReadRepositoryFromCanonicalReads } from "./resource-batch-read-repository"
import { createResourceBatchReadApiHandler } from "./resource-batch-read-routes"
import { createSessionRepository } from "./session-read-repository"
import { createSessionReadApiHandler } from "./session-read-routes"
import type { SubscriptionMutationExecutor } from "./subscription-repository"
import { createSubscriptionMutationApiHandler, createSubscriptionReadApiHandler } from "./subscription-routes"
import {
  createWebhookSecretProtector,
  type SubscriptionRepository,
  type WebhookSecretProtector,
  SubscriptionService
} from "./subscriptions"
import { createSupportingMaterialSectionReadApiHandler } from "./supporting-material-section-read-routes"
import { createUniversalSearchApiHandler } from "./universal-search"
import { createProductionUniversalSearchApi } from "./universal-search-adapter"
import { createVoteReadRepository } from "./vote-read-repository"
import { createVoteReadApiHandler } from "./vote-read-routes"
import { createWebhookMutationApiHandler } from "./webhook-mutation-routes"
import type { WebhookReadRepository } from "./webhook-read-repository"
import { createWebhookReadApiHandler } from "./webhook-read-routes"

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
    hasGlobalResearchPermission?: (identity: RequestIdentity | undefined) => boolean
    researchAnswerApi?: ResearchAnswerApi
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
              getChange: async (changeId) => await getChangeEvent(documentDatabase, changeId),
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
              listMeetingParticipants: async (input) => await listMeetingParticipants(documentDatabase, input)
            },
            options
          ),
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
    createUniversalSearchApiHandler(
      createProductionUniversalSearchApi(queryService, documentDatabase, options.apiBaseUrl)
    ),
    createResearchAnswerApiHandler(options.researchAnswerApi ?? createUnavailableResearchAnswerApi(), {
      hasGlobalResearchPermission: options.hasGlobalResearchPermission
    }),
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
