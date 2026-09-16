import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import type { LegislationConfig } from "../../configuration/config"
import { getEventDocumentRead } from "../../legislation/persistence/queries/event-document-read"
import {
  assertMeetingExists as assertMeetingAgendaParentExists,
  getMeetingAgendaItemRead,
  listMeetingAgenda
} from "../../legislation/persistence/queries/meeting-agenda-read"
import {
  assertMeetingExists as assertMeetingDocumentParentExists,
  listMeetingDocuments
} from "../../legislation/persistence/queries/meeting-document-read"
import { getMeetingParticipantRead } from "../../legislation/persistence/queries/meeting-participant-read"
import {
  assertMeetingExists as assertMeetingParticipantParentExists,
  listMeetingParticipants
} from "../../legislation/persistence/queries/meeting-participant-reads"
import { getNextLegislationApplication } from "../../legislation/runtime/runtime"
import { createEventDocumentReadApiHandler } from "../api/event-document-read-routes"
import { createCompositeHttpApiHandler, type HttpApiHandler } from "../api/http"
import { createMeetingAgendaReadApiHandler } from "../api/meeting-agenda-read-routes"
import { createMeetingDocumentReadApiHandler } from "../api/meeting-document-read-routes"
import { createMeetingParticipantListApiHandler } from "../api/meeting-participant-list-routes"
import { createMeetingParticipantReadApiHandler } from "../api/meeting-participant-read-routes"
import { createMeetingReadRepository } from "../api/meeting-read-repository"
import { createMeetingReadApiHandler, type MeetingReadApi } from "../api/meeting-read-routes"
import { executeAuthenticatedApiRequest } from "./authenticated-api-request"

type MeetingCalendarApplication = Readonly<{
  config: Pick<LegislationConfig, "server">
  database: LegislationDatabase
}>

type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

export type MeetingCalendarRequestHandlerDependencies = Readonly<{
  createHandler: () => HttpApiHandler
  execute: NextHttpApiExecutor
}>

let meetingCalendarHandler: HttpApiHandler | undefined

/** Handles supported meeting routes. */
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
