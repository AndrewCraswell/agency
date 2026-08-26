import { createCoreReadApiHandler, type CoreReadQueryApi } from "../../api/core-read.js"
import { createCompositeHttpApiHandler, type HttpApiHandler } from "../../api/http.js"
import { createJurisdictionCollectionReadRepository } from "../../api/jurisdiction-collection-read-repository.js"
import { createJurisdictionCollectionReadApiHandler } from "../../api/jurisdiction-collection-read-routes.js"
import { createJurisdictionOrganizationRepository } from "../../api/jurisdiction-organization-read-repository.js"
import { createJurisdictionOrganizationReadApiHandler } from "../../api/jurisdiction-organization-read-routes.js"
import { createJurisdictionReadRepository } from "../../api/jurisdiction-read-repository.js"
import { createJurisdictionReadApiHandler } from "../../api/jurisdiction-read-routes.js"
import { createMeetingReadRepository } from "../../api/meeting-read-repository.js"
import { createMeetingReadApiHandler } from "../../api/meeting-read-routes.js"
import { createSessionRepository } from "../../api/session-read-repository.js"
import { createSessionReadApiHandler } from "../../api/session-read-routes.js"
import type { LegislationDatabase } from "../../db/database.js"
import { executeAuthenticatedApiRequest } from "./authenticated-api-request.js"
import { getNextLegislationApplication } from "./runtime.js"

type JurisdictionRouteApplication = Readonly<{
  config: Readonly<{ server: Readonly<{ publicApiBaseUrl: string | undefined }> }>
  database: LegislationDatabase
  queryService: CoreReadQueryApi
}>

type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

export type JurisdictionRequestHandlerDependencies = Readonly<{
  createHandler: () => HttpApiHandler
  execute: NextHttpApiExecutor
}>

let jurisdictionHandler: HttpApiHandler | undefined

/**
 * Handles jurisdiction and session routes, including their scoped bill and meeting
 * collections. Other API routes remain unhandled by this boundary.
 */
export async function handleJurisdictionRequest(request: Request): Promise<Response> {
  jurisdictionHandler ??= createJurisdictionHttpApiHandler(getNextLegislationApplication())
  return await executeAuthenticatedApiRequest(request, jurisdictionHandler)
}

export function createJurisdictionRequestHandler(
  dependencies: JurisdictionRequestHandlerDependencies
): (request: Request) => Promise<Response> {
  let handler: HttpApiHandler | undefined
  return async (request) => {
    handler ??= dependencies.createHandler()
    return await dependencies.execute(request, handler)
  }
}

export function createJurisdictionHttpApiHandler(application: JurisdictionRouteApplication): HttpApiHandler {
  const options = { apiBaseUrl: requiredPublicApiBaseUrl(application) }
  const database = application.database
  const meetingRepository = createMeetingReadRepository(database)

  return rejectTrailingSlashApiPaths(
    createCompositeHttpApiHandler([
      createJurisdictionCollectionReadApiHandler(createJurisdictionCollectionReadRepository(database), options),
      createJurisdictionReadApiHandler(createJurisdictionReadRepository(database), options),
      createSessionReadApiHandler(createSessionRepository(database), options),
      createJurisdictionOrganizationReadApiHandler(createJurisdictionOrganizationRepository(database), options),
      restrictToScopedBills(createCoreReadApiHandler(application.queryService, options)),
      restrictToScopedMeetings(
        createMeetingReadApiHandler(
          {
            ...meetingRepository,
            listMeetingAgenda: unavailableMeetingChild,
            listMeetingDocuments: unavailableMeetingChild,
            listMeetingOutcomes: unavailableMeetingChild,
            listMeetingParticipants: unavailableMeetingChild
          },
          options
        )
      )
    ])
  )
}

function requiredPublicApiBaseUrl(application: JurisdictionRouteApplication): string {
  const value = application.config.server.publicApiBaseUrl
  if (value === undefined) {
    throw new Error("LEGISLATION_PUBLIC_API_BASE_URL is required for Next API routes")
  }
  return value
}

async function unavailableMeetingChild(): Promise<never> {
  throw new Error("Jurisdiction routes do not compose meeting detail children")
}

function restrictToScopedBills(handler: HttpApiHandler): HttpApiHandler {
  return async (request, response) => (isScopedBillRoute(request) ? await handler(request, response) : false)
}

function restrictToScopedMeetings(handler: HttpApiHandler): HttpApiHandler {
  return async (request, response) => (isScopedMeetingRoute(request) ? await handler(request, response) : false)
}

function rejectTrailingSlashApiPaths(handler: HttpApiHandler): HttpApiHandler {
  return async (request, response) => (isTrailingSlashApiPath(request) ? false : await handler(request, response))
}

function isScopedBillRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  const segments = requestPathSegments(request)
  return (
    request.method === "GET" &&
    segments.length === 5 &&
    segments[1] === "api" &&
    (segments[2] === "jurisdictions" || segments[2] === "sessions") &&
    segments[4] === "bills"
  )
}

function isScopedMeetingRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  const segments = requestPathSegments(request)
  return (
    request.method === "GET" &&
    segments.length === 5 &&
    segments[1] === "api" &&
    (segments[2] === "jurisdictions" || segments[2] === "sessions") &&
    segments[4] === "meetings"
  )
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
