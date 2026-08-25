import { createCalendarReadRepository } from "../../api/calendar-read-repository.js"
import { createCalendarReadApiHandler } from "../../api/calendar-read-routes.js"
import { createCivicScopedReadApiHandler } from "../../api/civic-scoped-read-routes.js"
import { createCompositeHttpApiHandler, type HttpApiHandler } from "../../api/http.js"
import { createMeetingReadRepository } from "../../api/meeting-read-repository.js"
import { createMeetingReadApiHandler } from "../../api/meeting-read-routes.js"
import { executeNextHttpApiHandler } from "../../api/next/node-handler.js"
import { createOrganizationBillReadApiHandler } from "../../api/organization-bill-read-routes.js"
import { createOrganizationDetailReadRepository } from "../../api/organization-detail-read-repository.js"
import { createOrganizationDetailReadApiHandler } from "../../api/organization-detail-read-routes.js"
import { createOrganizationMembersRepository } from "../../api/organization-members-read-repository.js"
import { createOrganizationMembersReadApiHandler } from "../../api/organization-members-read-routes.js"
import { createOrganizationReadRepository } from "../../api/organization-read-repository.js"
import { createOrganizationReadApiHandler } from "../../api/organization-read-routes.js"
import { createPeopleReadApiHandler } from "../../api/people-read-routes.js"
import { createPersonAmendmentApiHandler } from "../../api/person-amendment-routes.js"
import { createPersonBillActivityApiHandler } from "../../api/person-bill-activity-routes.js"
import { createPersonDetailReadRepository } from "../../api/person-detail-read-repository.js"
import { createPersonDetailReadApiHandler } from "../../api/person-detail-read-routes.js"
import { createPersonMembershipsRepository } from "../../api/person-membership-read-repository.js"
import { createPersonMembershipReadApiHandler } from "../../api/person-membership-read-routes.js"
import { createVoteReadRepository } from "../../api/vote-read-repository.js"
import { createVoteReadApiHandler } from "../../api/vote-read-routes.js"
import type { LegislationDatabase } from "../../db/database.js"
import { getOrganizationMembership, getPersonTerm } from "../../db/queries/civic-scoped-reads.js"
import { assertOrganizationExists, listOrganizationBillReads } from "../../db/queries/organization-bill-read.js"
import { listPeople } from "../../db/queries/people-read.js"
import { listPersonAmendments } from "../../db/queries/person-amendments.js"
import { assertPersonExists, listPersonBillActivity } from "../../db/queries/person-bill-activity.js"
import { getNextLegislationApplication } from "./runtime.js"

type Nx03aApplication = Readonly<{
  config: Readonly<{ server: Readonly<{ publicApiBaseUrl: string | undefined }> }>
  database: LegislationDatabase
}>

type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

export type Nx03aRequestHandlerDependencies = Readonly<{
  createHandler: () => HttpApiHandler
  execute: NextHttpApiExecutor
}>

let nx03aHandler: HttpApiHandler | undefined

/** Handles only the NX-03A people and organization read routes. */
export async function handleNx03aRequest(request: Request): Promise<Response> {
  nx03aHandler ??= createNx03aHttpApiHandler(getNextLegislationApplication())
  return await executeNextHttpApiHandler(request, nx03aHandler)
}

export function createNx03aRequestHandler(
  dependencies: Nx03aRequestHandlerDependencies
): (request: Request) => Promise<Response> {
  let handler: HttpApiHandler | undefined
  return async (request) => {
    handler ??= dependencies.createHandler()
    return await dependencies.execute(request, handler)
  }
}

export function createNx03aHttpApiHandler(application: Nx03aApplication): HttpApiHandler {
  const options = { apiBaseUrl: requiredPublicApiBaseUrl(application) }
  const database = application.database
  const meetingRepository = createMeetingReadRepository(database)

  return rejectTrailingSlashApiPaths(
    createCompositeHttpApiHandler([
      restrictToRoutes(
        createPeopleReadApiHandler({ listPeople: async (input) => await listPeople(database, input) }, options),
        isPeopleCollectionRoute
      ),
      restrictToRoutes(
        createPersonDetailReadApiHandler(createPersonDetailReadRepository(database), options),
        isPersonDetailRoute
      ),
      restrictToRoutes(
        createPersonBillActivityApiHandler(
          {
            assertPersonExists: async (personId) => await assertPersonExists(database, personId),
            listPersonBillActivity: async (input) => await listPersonBillActivity(database, input)
          },
          options
        ),
        isPersonBillsRoute
      ),
      restrictToRoutes(
        createPersonAmendmentApiHandler(
          {
            assertPersonExists: async (personId) => await assertPersonExists(database, personId),
            listPersonAmendments: async (input) => await listPersonAmendments(database, input)
          },
          options
        ),
        isPersonAmendmentsRoute
      ),
      restrictToRoutes(createVoteReadApiHandler(createVoteReadRepository(database), options), isPersonVotesRoute),
      restrictToRoutes(
        createPersonMembershipReadApiHandler(createPersonMembershipsRepository(database), options),
        isPersonMembershipsRoute
      ),
      restrictToRoutes(
        createCivicScopedReadApiHandler(
          {
            getOrganizationMembership: async (input) => await getOrganizationMembership(database, input),
            getPersonTerm: async (input) => await getPersonTerm(database, input)
          },
          options
        ),
        isCivicScopedRoute
      ),
      restrictToRoutes(
        createOrganizationReadApiHandler(createOrganizationReadRepository(database), options),
        isOrganizationCollectionRoute
      ),
      restrictToRoutes(
        createOrganizationDetailReadApiHandler(createOrganizationDetailReadRepository(database, options.apiBaseUrl)),
        isOrganizationDetailRoute
      ),
      restrictToRoutes(
        createOrganizationMembersReadApiHandler(createOrganizationMembersRepository(database), options),
        isOrganizationMembersRoute
      ),
      restrictToRoutes(
        createMeetingReadApiHandler(
          {
            ...meetingRepository,
            listMeetingAgenda: unavailableMeetingChild,
            listMeetingDocuments: unavailableMeetingChild,
            listMeetingOutcomes: unavailableMeetingChild,
            listMeetingParticipants: unavailableMeetingChild
          },
          options
        ),
        isOrganizationMeetingsRoute
      ),
      restrictToRoutes(
        createOrganizationBillReadApiHandler(
          {
            assertOrganizationExists: async (organizationId) =>
              await assertOrganizationExists(database, organizationId),
            listOrganizationBillReads: async (input) => await listOrganizationBillReads(database, input)
          },
          options
        ),
        isOrganizationBillsRoute
      ),
      restrictToRoutes(
        createCalendarReadApiHandler(createCalendarReadRepository(database), options),
        isOrganizationCalendarsRoute
      )
    ])
  )
}

function requiredPublicApiBaseUrl(application: Nx03aApplication): string {
  const value = application.config.server.publicApiBaseUrl
  if (value === undefined) {
    throw new Error("LEGISLATION_PUBLIC_API_BASE_URL is required for Next API routes")
  }
  return value
}

async function unavailableMeetingChild(): Promise<never> {
  throw new Error("NX-03A does not compose meeting detail children")
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

function isPeopleCollectionRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return request.method === "GET" && requestPathname(request) === "/api/people"
}

function isPersonDetailRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return matchesSegments(request, ["api", "people", "id"])
}

function isPersonBillsRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return matchesSegments(request, ["api", "people", "id", "bills"])
}

function isPersonAmendmentsRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return matchesSegments(request, ["api", "people", "id", "amendments"])
}

function isPersonVotesRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return matchesSegments(request, ["api", "people", "id", "votes"])
}

function isPersonMembershipsRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return matchesSegments(request, ["api", "people", "id", "memberships"])
}

function isCivicScopedRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  const segments = requestPathSegments(request)
  return (
    request.method === "GET" &&
    ((segments.length === 6 &&
      segments[1] === "api" &&
      segments[2] === "people" &&
      hasDynamicRouteId(segments[3]) &&
      segments[4] === "terms" &&
      hasDynamicRouteId(segments[5])) ||
      (segments.length === 6 &&
        segments[1] === "api" &&
        segments[2] === "organizations" &&
        hasDynamicRouteId(segments[3]) &&
        segments[4] === "memberships" &&
        hasDynamicRouteId(segments[5])))
  )
}

function isOrganizationCollectionRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return request.method === "GET" && requestPathname(request) === "/api/organizations"
}

function isOrganizationDetailRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return matchesSegments(request, ["api", "organizations", "id"])
}

function isOrganizationMembersRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return matchesSegments(request, ["api", "organizations", "id", "members"])
}

function isOrganizationMeetingsRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return matchesSegments(request, ["api", "organizations", "id", "meetings"])
}

function isOrganizationBillsRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return matchesSegments(request, ["api", "organizations", "id", "bills"])
}

function isOrganizationCalendarsRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return matchesSegments(request, ["api", "organizations", "id", "calendars"])
}

function matchesSegments(
  request: Readonly<{ method?: string; url?: string }>,
  expected: readonly ("id" | string)[]
): boolean {
  const segments = requestPathSegments(request)
  return (
    request.method === "GET" &&
    segments.length === expected.length + 1 &&
    expected.every((segment, index) =>
      segment === "id" ? hasDynamicRouteId(segments[index + 1]) : segments[index + 1] === segment
    )
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
