import { createAmendmentReadRepository } from "../../api/amendment-read-repository.js"
import { createBillDetailReadRepository } from "../../api/bill-detail-read-repository.js"
import { createCalendarReadRepository } from "../../api/calendar-read-repository.js"
import { createChangeFeedApiHandler } from "../../api/change-feed-routes.js"
import { createCoreReadApiHandler, type CoreReadQueryApi } from "../../api/core-read.js"
import { createDocumentReadApiHandler, type DocumentReadApi } from "../../api/document-read-routes.js"
import { createCompositeHttpApiHandler, type HttpApiHandler } from "../../api/http.js"
import { createJurisdictionReadRepository } from "../../api/jurisdiction-read-repository.js"
import { createMeetingReadRepository } from "../../api/meeting-read-repository.js"
import type { MeetingReadApi } from "../../api/meeting-read-routes.js"
import { executeNextHttpApiHandler } from "../../api/next/node-handler.js"
import { createOrganizationDetailReadRepository } from "../../api/organization-detail-read-repository.js"
import { createPersonDetailReadRepository } from "../../api/person-detail-read-repository.js"
import { createResourceBatchReadRepositoryFromCanonicalReads } from "../../api/resource-batch-read-repository.js"
import { createResourceBatchReadApiHandler } from "../../api/resource-batch-read-routes.js"
import { createSessionRepository } from "../../api/session-read-repository.js"
import { createSupportingMaterialSectionReadApiHandler } from "../../api/supporting-material-section-read-routes.js"
import { createVoteReadRepository } from "../../api/vote-read-repository.js"
import type { LegislationDatabase } from "../../db/database.js"
import { listChangeFeed } from "../../db/queries/change-feed-reads.js"
import {
  assertSupportingMaterialExists,
  getDocumentDetail,
  getDocumentSection,
  listDocumentSections,
  listSupportingMaterialSections
} from "../../db/queries/document-reads.js"
import { listMeetingAgenda } from "../../db/queries/meeting-agenda-read.js"
import { listMeetingDocuments } from "../../db/queries/meeting-document-read.js"
import { listMeetingOutcomes } from "../../db/queries/meeting-outcome-read.js"
import { listMeetingParticipants } from "../../db/queries/meeting-participant-reads.js"
import { getNextLegislationApplication } from "./runtime.js"

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
  return await executeNextHttpApiHandler(request, documentResourceHandler)
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
            calendarReadApi: createCalendarReadRepository(database),
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
  | "listMeetingOutcomes"
  | "listMeetingParticipants"
> {
  const meetingRepository = createMeetingReadRepository(database)
  return {
    getMeetingRead: meetingRepository.getMeetingRead,
    listMeetingAgenda: async (input) => await listMeetingAgenda(database, input),
    listMeetingDocuments: async (input) => await listMeetingDocuments(database, input),
    listMeetingOrganizations: meetingRepository.listMeetingOrganizations,
    listMeetingOutcomes: async (input) => await listMeetingOutcomes(database, input),
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
  return request.method === "GET" && requestPathname(request) === "/api/changes"
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
