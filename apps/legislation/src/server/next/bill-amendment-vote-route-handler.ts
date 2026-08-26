import { createAmendmentReadRepository } from "../../api/amendment-read-repository.js"
import { createAmendmentReadApiHandler } from "../../api/amendment-read-routes.js"
import { createBillDetailReadRepository } from "../../api/bill-detail-read-repository.js"
import { createBillDetailReadApiHandler } from "../../api/bill-detail-read-routes.js"
import { createBillRelatedReadApiHandler } from "../../api/bill-related-read-routes.js"
import { createBillTextReadApiHandler } from "../../api/bill-text-read-routes.js"
import { createBillTimelineReadApiHandler } from "../../api/bill-timeline-read-routes.js"
import { createChangeFeedApiHandler } from "../../api/change-feed-routes.js"
import { createCoreReadApiHandler, type CoreReadQueryApi } from "../../api/core-read.js"
import { createDocumentReadApiHandler } from "../../api/document-read-routes.js"
import { createCompositeHttpApiHandler, type HttpApiHandler } from "../../api/http.js"
import { createVoteReadRepository } from "../../api/vote-read-repository.js"
import { createVoteReadApiHandler } from "../../api/vote-read-routes.js"
import type { LegislationDatabase } from "../../db/database.js"
import { assertBillRelatedParentExists, listBillRelatedBills } from "../../db/queries/bill-related-read.js"
import { listBillTextSections } from "../../db/queries/bill-text-read.js"
import { listBillTimeline } from "../../db/queries/bill-timeline-read.js"
import { listChangeFeed } from "../../db/queries/change-feed-reads.js"
import { assertBillExists, listBillDocuments } from "../../db/queries/document-reads.js"
import { executeAuthenticatedApiRequest } from "./authenticated-api-request.js"
import { getNextLegislationApplication } from "./runtime.js"

type BillAmendmentVoteRouteApplication = Readonly<{
  config: Readonly<{ server: Readonly<{ publicApiBaseUrl: string | undefined }> }>
  database: LegislationDatabase
  queryService: CoreReadQueryApi
}>

type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

export type BillAmendmentVoteRequestHandlerDependencies = Readonly<{
  createHandler: () => HttpApiHandler
  execute: NextHttpApiExecutor
}>

let billAmendmentVoteHandler: HttpApiHandler | undefined

/**
 * Handles bills, amendments, and votes routes. Other API routes remain
 * unhandled by this request handler.
 */
export async function handleBillAmendmentVoteRequest(request: Request): Promise<Response> {
  billAmendmentVoteHandler ??= createBillAmendmentVoteHttpApiHandler(getNextLegislationApplication())
  return await executeAuthenticatedApiRequest(request, billAmendmentVoteHandler)
}

export function createBillAmendmentVoteRequestHandler(
  dependencies: BillAmendmentVoteRequestHandlerDependencies
): (request: Request) => Promise<Response> {
  let handler: HttpApiHandler | undefined
  return async (request) => {
    handler ??= dependencies.createHandler()
    return await dependencies.execute(request, handler)
  }
}

export function createBillAmendmentVoteHttpApiHandler(application: BillAmendmentVoteRouteApplication): HttpApiHandler {
  const options = { apiBaseUrl: requiredPublicApiBaseUrl(application) }
  const database = application.database

  return rejectTrailingSlashApiPaths(
    createCompositeHttpApiHandler([
      restrictToRoutes(createCoreReadApiHandler(application.queryService, options), isBillCollectionRoute),
      restrictToRoutes(
        createBillDetailReadApiHandler(createBillDetailReadRepository(database, options.apiBaseUrl)),
        isBillDetailRoute
      ),
      restrictToRoutes(
        createAmendmentReadApiHandler(createAmendmentReadRepository(database, options.apiBaseUrl)),
        isAmendmentRoute
      ),
      restrictToRoutes(createVoteReadApiHandler(createVoteReadRepository(database), options), isVoteRoute),
      restrictToRoutes(
        createDocumentReadApiHandler(
          {
            assertBillExists: async (billId) => await assertBillExists(database, billId),
            getDocumentDetail: unavailableDocumentRead,
            getDocumentSection: unavailableDocumentRead,
            listBillDocuments: async (input) => await listBillDocuments(database, input),
            listDocumentSections: unavailableDocumentRead
          },
          options
        ),
        isBillDocumentRoute
      ),
      restrictToRoutes(
        createChangeFeedApiHandler(
          {
            assertBillExists: async (billId) => await assertBillExists(database, billId),
            listChanges: async (input) => await listChangeFeed(database, input)
          },
          options
        ),
        isBillChangeRoute
      ),
      restrictToRoutes(
        createBillTextReadApiHandler(
          {
            assertBillExists: async (billId) => await assertBillExists(database, billId),
            listBillTextSections: async (input) => await listBillTextSections(database, input)
          },
          options
        ),
        isBillSectionRoute
      ),
      restrictToRoutes(
        createBillRelatedReadApiHandler(
          {
            assertBillExists: async (billId) => await assertBillRelatedParentExists(database, billId),
            listBillRelatedBills: async (input) => await listBillRelatedBills(database, input)
          },
          options
        ),
        isBillRelatedRoute
      ),
      restrictToRoutes(
        createBillTimelineReadApiHandler(
          {
            assertBillTimelineParentExists: async (billId) => await assertBillExists(database, billId),
            listBillTimeline: async (input) => await listBillTimeline(database, input)
          },
          options
        ),
        isBillTimelineRoute
      )
    ])
  )
}

function requiredPublicApiBaseUrl(application: BillAmendmentVoteRouteApplication): string {
  const value = application.config.server.publicApiBaseUrl
  if (value === undefined) {
    throw new Error("LEGISLATION_PUBLIC_API_BASE_URL is required for Next API routes")
  }
  return value
}

async function unavailableDocumentRead(): Promise<never> {
  throw new Error("This handler does not compose top-level document reads")
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

function isBillCollectionRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return request.method === "GET" && requestPathname(request) === "/api/bills"
}

function isBillDetailRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  const segments = requestPathSegments(request)
  if (request.method === "POST") {
    return segments.length === 4 && segments[1] === "api" && segments[2] === "bills" && segments[3] === "batch"
  }
  return (
    request.method === "GET" &&
    segments[1] === "api" &&
    segments[2] === "bills" &&
    ((segments.length === 4 && hasDynamicRouteId(segments[3])) ||
      (segments.length === 5 && hasDynamicRouteId(segments[3]) && segments[4] === "votes"))
  )
}

function isAmendmentRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  const segments = requestPathSegments(request)
  if (request.method === "POST") {
    return (
      (segments.length === 4 && segments[1] === "api" && segments[2] === "amendments" && segments[3] === "batch") ||
      (segments.length === 5 &&
        segments[1] === "api" &&
        segments[2] === "bills" &&
        segments[3] === "amendments" &&
        segments[4] === "batch")
    )
  }
  return (
    request.method === "GET" &&
    segments[1] === "api" &&
    ((segments.length === 3 && segments[2] === "amendments") ||
      (segments.length === 4 && segments[2] === "amendments" && hasDynamicRouteId(segments[3])) ||
      (segments.length === 5 &&
        segments[2] === "bills" &&
        hasDynamicRouteId(segments[3]) &&
        segments[4] === "amendments"))
  )
}

function isVoteRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  const segments = requestPathSegments(request)
  if (request.method === "POST") {
    return segments.length === 4 && segments[1] === "api" && segments[2] === "votes" && segments[3] === "batch"
  }
  return (
    request.method === "GET" &&
    segments[1] === "api" &&
    segments[2] === "votes" &&
    (segments.length === 3 ||
      (segments.length === 4 && hasDynamicRouteId(segments[3])) ||
      (segments.length === 5 && hasDynamicRouteId(segments[3]) && segments[4] === "positions"))
  )
}

function isBillDocumentRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return isNamedBillChildRoute(request, "documents")
}

function isBillChangeRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return isNamedBillChildRoute(request, "changes")
}

function isBillSectionRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return isNamedBillChildRoute(request, "sections")
}

function isBillRelatedRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return isNamedBillChildRoute(request, "related")
}

function isBillTimelineRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return isNamedBillChildRoute(request, "timeline")
}

function isNamedBillChildRoute(request: Readonly<{ method?: string; url?: string }>, child: string): boolean {
  const segments = requestPathSegments(request)
  return (
    request.method === "GET" &&
    segments.length === 5 &&
    segments[1] === "api" &&
    segments[2] === "bills" &&
    hasDynamicRouteId(segments[3]) &&
    segments[4] === child
  )
}

function hasDynamicRouteId(value: string | undefined): value is string {
  if (value === undefined || value.length === 0) {
    return false
  }
  try {
    return decodeURIComponent(value) !== "batch"
  } catch {
    // Delegate malformed escapes to the route handler so it can return the
    // canonical invalid-request envelope instead of a framework error.
    return true
  }
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
