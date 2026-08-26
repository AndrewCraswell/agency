import { createCalendarReadRepository } from "../../api/calendar-read-repository.js"
import { createCalendarReadApiHandler } from "../../api/calendar-read-routes.js"
import { createEventDocumentReadApiHandler } from "../../api/event-document-read-routes.js"
import { createCompositeHttpApiHandler, type HttpApiHandler } from "../../api/http.js"
import { createMeetingAgendaReadApiHandler } from "../../api/meeting-agenda-read-routes.js"
import { createMeetingDocumentReadApiHandler } from "../../api/meeting-document-read-routes.js"
import { createMeetingOutcomeReadApiHandler } from "../../api/meeting-outcome-read-routes.js"
import { createMeetingParticipantListApiHandler } from "../../api/meeting-participant-list-routes.js"
import { createMeetingParticipantReadApiHandler } from "../../api/meeting-participant-read-routes.js"
import { createMeetingReadRepository } from "../../api/meeting-read-repository.js"
import { createMeetingReadApiHandler, type MeetingReadApi } from "../../api/meeting-read-routes.js"
import { createRepresentativeLookupApi, createRepresentativeLookupApiHandler } from "../../api/representative-lookup.js"
import type { LegislationConfig } from "../../config/config.js"
import type { LegislationDatabase } from "../../db/database.js"
import { getEventDocumentRead } from "../../db/queries/event-document-read.js"
import {
  assertMeetingExists as assertMeetingAgendaParentExists,
  getMeetingAgendaItemRead,
  listMeetingAgenda
} from "../../db/queries/meeting-agenda-read.js"
import {
  assertMeetingExists as assertMeetingDocumentParentExists,
  listMeetingDocuments
} from "../../db/queries/meeting-document-read.js"
import {
  assertMeetingOutcomeParentExists,
  getMeetingOutcomeRead,
  listMeetingOutcomes
} from "../../db/queries/meeting-outcome-read.js"
import { getMeetingParticipantRead } from "../../db/queries/meeting-participant-read.js"
import {
  assertMeetingExists as assertMeetingParticipantParentExists,
  listMeetingParticipants
} from "../../db/queries/meeting-participant-reads.js"
import { executeAuthenticatedApiRequest } from "./authenticated-api-request.js"
import { createNextRepresentativeLookupProvider } from "./representative-lookup-provider.js"
import { getNextLegislationApplication } from "./runtime.js"

type MeetingCalendarApplication = Readonly<{
  config: Pick<LegislationConfig, "ingestion" | "server">
  database: LegislationDatabase
}>

type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

export type MeetingCalendarRequestHandlerDependencies = Readonly<{
  createHandler: () => HttpApiHandler
  execute: NextHttpApiExecutor
}>

let meetingCalendarHandler: HttpApiHandler | undefined

/** Handles meeting, calendar, and representative lookup routes. */
export async function handleMeetingCalendarRequest(request: Request): Promise<Response> {
  meetingCalendarHandler ??= createMeetingCalendarHttpApiHandler(getNextLegislationApplication())
  return await executeAuthenticatedApiRequest(request, meetingCalendarHandler)
}

export function createMeetingCalendarRequestHandler(
  dependencies: MeetingCalendarRequestHandlerDependencies
): (request: Request) => Promise<Response> {
  let handler: HttpApiHandler | undefined
  return async (request) => {
    handler ??= dependencies.createHandler()
    return await dependencies.execute(request, handler)
  }
}

export function createMeetingCalendarHttpApiHandler(application: MeetingCalendarApplication): HttpApiHandler {
  const options = { apiBaseUrl: requiredPublicApiBaseUrl(application) }
  const database = application.database

  return rejectTrailingSlashApiPaths(
    createCompositeHttpApiHandler([
      restrictToRoutes(createMeetingReadApiHandler(createMeetingDetailReadApi(database), options), isMeetingCoreRoute),
      restrictToRoutes(
        createMeetingAgendaReadApiHandler(
          {
            assertMeetingExists: async (meetingId) => await assertMeetingAgendaParentExists(database, meetingId),
            getMeetingAgendaItemRead: async (input) => await getMeetingAgendaItemRead(database, input),
            listMeetingAgenda: async (input) => await listMeetingAgenda(database, input)
          },
          options
        ),
        isMeetingAgendaRoute
      ),
      restrictToRoutes(
        createMeetingDocumentReadApiHandler(
          {
            assertMeetingExists: async (meetingId) => await assertMeetingDocumentParentExists(database, meetingId),
            listMeetingDocuments: async (input) => await listMeetingDocuments(database, input)
          },
          options
        ),
        isMeetingDocumentCollectionRoute
      ),
      restrictToRoutes(
        createEventDocumentReadApiHandler(
          { getEventDocument: async (input) => await getEventDocumentRead(database, input) },
          options
        ),
        isMeetingDocumentItemRoute
      ),
      restrictToRoutes(
        createMeetingOutcomeReadApiHandler(
          {
            assertMeetingOutcomeParentExists: async (meetingId) =>
              await assertMeetingOutcomeParentExists(database, meetingId),
            getMeetingOutcomeRead: async (input) => await getMeetingOutcomeRead(database, input),
            listMeetingOutcomes: async (input) => await listMeetingOutcomes(database, input)
          },
          options
        ),
        isMeetingOutcomeRoute
      ),
      restrictToRoutes(
        createMeetingParticipantListApiHandler(
          {
            assertMeetingExists: async (meetingId) => await assertMeetingParticipantParentExists(database, meetingId),
            listMeetingParticipants: async (input) => await listMeetingParticipants(database, input)
          },
          options
        ),
        isMeetingParticipantCollectionRoute
      ),
      restrictToRoutes(
        createMeetingParticipantReadApiHandler(
          { getMeetingParticipant: async (input) => await getMeetingParticipantRead(database, input) },
          options
        ),
        isMeetingParticipantItemRoute
      ),
      restrictToRoutes(createCalendarReadApiHandler(createCalendarReadRepository(database), options), isCalendarRoute),
      restrictToRoutes(
        createRepresentativeLookupApiHandler(
          createRepresentativeLookupApi(createNextRepresentativeLookupProvider(application.config))
        ),
        isRepresentativeLookupRoute
      )
    ])
  )
}

function createMeetingDetailReadApi(database: LegislationDatabase): MeetingReadApi {
  const meetingRepository = createMeetingReadRepository(database)
  return {
    ...meetingRepository,
    listMeetingAgenda: async (input) => await listMeetingAgenda(database, input),
    listMeetingDocuments: async (input) => await listMeetingDocuments(database, input),
    listMeetingOutcomes: async (input) => await listMeetingOutcomes(database, input),
    listMeetingParticipants: async (input) => await listMeetingParticipants(database, input)
  }
}

function requiredPublicApiBaseUrl(application: MeetingCalendarApplication): string {
  const value = application.config.server.publicApiBaseUrl
  if (value === undefined) {
    throw new Error("LEGISLATION_PUBLIC_API_BASE_URL is required for Next API routes")
  }
  return value
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

function isMeetingCoreRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  const segments = requestPathSegments(request)
  return (
    request.method === "GET" &&
    segments[1] === "api" &&
    segments[2] === "meetings" &&
    (segments.length === 3 || (segments.length === 4 && hasDynamicRouteId(segments[3])))
  )
}

function isMeetingAgendaRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return isNamedMeetingChildRoute(request, "agenda", true)
}

function isMeetingDocumentCollectionRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return isNamedMeetingChildRoute(request, "documents", false)
}

function isMeetingDocumentItemRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return isNamedMeetingChildRoute(request, "documents", true) && requestPathSegments(request).length === 6
}

function isMeetingOutcomeRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return isNamedMeetingChildRoute(request, "outcomes", true)
}

function isMeetingParticipantCollectionRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return isNamedMeetingChildRoute(request, "participants", false)
}

function isMeetingParticipantItemRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return isNamedMeetingChildRoute(request, "participants", true) && requestPathSegments(request).length === 6
}

function isNamedMeetingChildRoute(
  request: Readonly<{ method?: string; url?: string }>,
  child: string,
  includeItem: boolean
): boolean {
  const segments = requestPathSegments(request)
  return (
    request.method === "GET" &&
    segments[1] === "api" &&
    segments[2] === "meetings" &&
    hasDynamicRouteId(segments[3]) &&
    segments[4] === child &&
    (segments.length === 5 || (includeItem && segments.length === 6 && hasDynamicRouteId(segments[5])))
  )
}

function isCalendarRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  const segments = requestPathSegments(request)
  return (
    request.method === "GET" &&
    segments[1] === "api" &&
    segments[2] === "calendars" &&
    (segments.length === 3 ||
      (segments.length === 4 && hasDynamicRouteId(segments[3])) ||
      (segments.length === 5 && hasDynamicRouteId(segments[3]) && segments[4] === "meetings"))
  )
}

function isRepresentativeLookupRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return request.method === "POST" && requestPathname(request) === "/api/representative-lookups"
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
