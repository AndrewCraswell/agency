import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { getChangeEvent, listChangeFeed } from "../../legislation/persistence/queries/change-feed-reads"
import {
  assertSupportingMaterialExists,
  getDocumentDetail,
  getDocumentSection,
  listDocumentSections,
  listSupportingMaterialSections
} from "../../legislation/persistence/queries/document-reads"
import { listMeetingAgenda } from "../../legislation/persistence/queries/meeting-agenda-read"
import { listMeetingDocuments } from "../../legislation/persistence/queries/meeting-document-read"
import { listMeetingParticipants } from "../../legislation/persistence/queries/meeting-participant-reads"
import { getNextLegislationApplication } from "../../legislation/runtime/runtime"
import { createAmendmentReadRepository } from "../api/amendment-read-repository"
import { createBillDetailReadRepository } from "../api/bill-detail-read-repository"
import { createChangeFeedApiHandler } from "../api/change-feed-routes"
import { createCoreReadApiHandler, type CoreReadQueryApi } from "../api/core-read"
import { createDocumentReadApiHandler, type DocumentReadApi } from "../api/document-read-routes"
import { createCompositeHttpApiHandler, type HttpApiHandler } from "../api/http"
import { createJurisdictionReadRepository } from "../api/jurisdiction-read-repository"
import { createMeetingReadRepository } from "../api/meeting-read-repository"
import type { MeetingReadApi } from "../api/meeting-read-routes"
import { createOrganizationDetailReadRepository } from "../api/organization-detail-read-repository"
import { createPersonDetailReadRepository } from "../api/person-detail-read-repository"
import { createResourceBatchReadRepositoryFromCanonicalReads } from "../api/resource-batch-read-repository"
import { createResourceBatchReadApiHandler } from "../api/resource-batch-read-routes"
import { createSessionRepository } from "../api/session-read-repository"
import { createSupportingMaterialSectionReadApiHandler } from "../api/supporting-material-section-read-routes"
import { createVoteReadRepository } from "../api/vote-read-repository"
import { executeAuthenticatedApiRequest } from "./authenticated-api-request"

type DocumentResourceQueryService = CoreReadQueryApi & Required<Pick<CoreReadQueryApi, "getSupportingMaterialSection">>

type DocumentResourceRouteApplication = Readonly<{
  config: Readonly<{ server: Readonly<{ publicApiBaseUrl: string | undefined }> }>
  database: LegislationDatabase
  queryService: DocumentResourceQueryService
}>

type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

export type DocumentResourceRequestHandlerDependencies = Readonly<{
  createHandler: () => HttpApiHandler
  execute: NextHttpApiExecutor
}>

let documentResourceHandler: HttpApiHandler | undefined

/**
 * Handles top-level document, supporting-material, global change-feed, and
 * canonical-resource batch routes.
 */
export async function handleDocumentResourceRequest(request: Request): Promise<Response> {
  documentResourceHandler ??= createDocumentResourceHttpApiHandler(getNextLegislationApplication())
  return await executeAuthenticatedApiRequest(request, documentResourceHandler)
}

export function createDocumentResourceRequestHandler(
  dependencies: DocumentResourceRequestHandlerDependencies
): (request: Request) => Promise<Response> {
  let handler: HttpApiHandler | undefined
  return async (request) => {
    handler ??= dependencies.createHandler()
    return await dependencies.execute(request, handler)
  }
}

export function createDocumentResourceHttpApiHandler(application: DocumentResourceRouteApplication): HttpApiHandler {
  const options = { apiBaseUrl: requiredPublicApiBaseUrl(application) }
  const documentReadApi = createTopLevelDocumentReadApi(application.database)
  const database = application.database

  return rejectTrailingSlashApiPaths(
    createCompositeHttpApiHandler([
      restrictToRoutes(createDocumentReadApiHandler(documentReadApi, options), isTopLevelDocumentRoute),
      restrictToRoutes(createCoreReadApiHandler(application.queryService, options), isSupportingMaterialCoreRoute),
      restrictToRoutes(
        createSupportingMaterialSectionReadApiHandler(
          {
            assertSupportingMaterialExists: async (materialId) =>
              await assertSupportingMaterialExists(application.database, materialId),
            getSupportingMaterialSection: async (input) =>
              await application.queryService.getSupportingMaterialSection(input),
            listSupportingMaterialSections: async (input) =>
              await listSupportingMaterialSections(application.database, input)
          },
          options
        ),
        isSupportingMaterialSectionRoute
      ),
      restrictToRoutes(
        createChangeFeedApiHandler(
          {
            assertBillExists: unavailableBillRead,
            getChange: async (changeId) => await getChangeEvent(application.database, changeId),
            listChanges: async (input) => await listChangeFeed(application.database, input)
          },
          options
        ),
        isGlobalChangeRoute
      ),
      restrictToRoutes(
        createResourceBatchReadApiHandler(
          createResourceBatchReadRepositoryFromCanonicalReads({
            amendmentReadRepository: createAmendmentReadRepository(database, options.apiBaseUrl),
            apiBaseUrl: options.apiBaseUrl,
            billDetailReadRepository: createBillDetailReadRepository(database, options.apiBaseUrl),
            coreReadApi: application.queryService,
            documentReadApi,
            jurisdictionReadRepository: createJurisdictionReadRepository(database),
            meetingReadApi: createMeetingDetailReadApi(database),
            organizationDetailReadRepository: createOrganizationDetailReadRepository(database, options.apiBaseUrl),
            personDetailReadRepository: createPersonDetailReadRepository(database),
            sessionReadRepository: createSessionRepository(database),
            voteReadApi: createVoteReadRepository(database)
          })
        ),
        isResourceBatchRoute
      )
    ])
  )
}

function createTopLevelDocumentReadApi(database: LegislationDatabase): DocumentReadApi {
  return {
    assertBillExists: unavailableBillRead,
    getDocumentDetail: async (documentId) => await getDocumentDetail(database, documentId),
    getDocumentSection: async (input) => await getDocumentSection(database, input),
    listBillDocuments: unavailableBillRead,
    listDocumentSections: async (input) => await listDocumentSections(database, input)
  }
}

function createMeetingDetailReadApi(
  database: LegislationDatabase
): Pick<
  MeetingReadApi,
  | "getMeetingRead"
  | "listMeetingAgenda"
  | "listMeetingDocuments"
  | "listMeetingOrganizations"
  | "listMeetingParticipants"
> {
  const meetingRepository = createMeetingReadRepository(database)
  return {
    getMeetingRead: meetingRepository.getMeetingRead,
    listMeetingAgenda: async (input) => await listMeetingAgenda(database, input),
    listMeetingDocuments: async (input) => await listMeetingDocuments(database, input),
    listMeetingOrganizations: meetingRepository.listMeetingOrganizations,
    listMeetingParticipants: async (input) => await listMeetingParticipants(database, input)
  }
}

function requiredPublicApiBaseUrl(application: DocumentResourceRouteApplication): string {
  const value = application.config.server.publicApiBaseUrl
  if (value === undefined) {
    throw new Error("LEGISLATION_PUBLIC_API_BASE_URL is required for Next API routes")
  }
  return value
}

async function unavailableBillRead(): Promise<never> {
  throw new Error("This handler does not compose bill-child reads")
}

function restrictToRoutes(
  handler: HttpApiHandler,
  matches: (request: Readonly<{ method?: string; url?: string }>) => boolean
): HttpApiHandler {
  return async (request, response) => (matches(request) ? await handler(request, response) : false)
}

function rejectTrailingSlashApiPaths(handler: HttpApiHandler): HttpApiHandler {
  return async (request, response) => (isTrailingSlashApiPath(request) ? false : await handler(request, response))
}

function isTopLevelDocumentRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  const segments = requestPathSegments(request)
  return (
    request.method === "GET" &&
    segments[1] === "api" &&
    segments[2] === "documents" &&
    hasDynamicRouteId(segments[3]) &&
    (segments.length === 4 ||
      (segments.length === 5 && segments[4] === "sections") ||
      (segments.length === 6 && segments[4] === "sections" && hasDynamicRouteId(segments[5])))
  )
}

function isSupportingMaterialCoreRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  const segments = requestPathSegments(request)
  return (
    request.method === "GET" &&
    segments[1] === "api" &&
    segments[2] === "supporting-materials" &&
    (segments.length === 3 || (segments.length === 4 && hasDynamicRouteId(segments[3])))
  )
}

function isSupportingMaterialSectionRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  const segments = requestPathSegments(request)
  return (
    request.method === "GET" &&
    segments[1] === "api" &&
    segments[2] === "supporting-materials" &&
    hasDynamicRouteId(segments[3]) &&
    segments[4] === "sections" &&
    (segments.length === 5 || (segments.length === 6 && hasDynamicRouteId(segments[5])))
  )
}

function isGlobalChangeRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  const segments = requestPathSegments(request)
  return (
    request.method === "GET" &&
    segments[1] === "api" &&
    segments[2] === "changes" &&
    (segments.length === 3 || (segments.length === 4 && hasDynamicRouteId(segments[3])))
  )
}

function isResourceBatchRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return request.method === "POST" && requestPathname(request) === "/api/resources/batch"
}

function hasDynamicRouteId(value: string | undefined): value is string {
  return value !== undefined && value.length > 0
}

function requestPathSegments(request: Readonly<{ url?: string }>): readonly string[] {
  return requestPathname(request).split("/")
}

function isTrailingSlashApiPath(request: Readonly<{ url?: string }>): boolean {
  const pathname = requestPathname(request)
  return pathname.startsWith("/api/") && pathname.endsWith("/")
}

function requestPathname(request: Readonly<{ url?: string }>): string {
  const value = request.url ?? ""
  const queryStart = value.indexOf("?")
  return queryStart === -1 ? value : value.slice(0, queryStart)
}
