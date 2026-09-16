import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { getOrganizationMembership, getPersonTerm } from "../../legislation/persistence/queries/civic-scoped-reads"
import {
  assertOrganizationExists,
  listOrganizationBillReads
} from "../../legislation/persistence/queries/organization-bill-read"
import { listPeople } from "../../legislation/persistence/queries/people-read"
import { listPersonAmendments } from "../../legislation/persistence/queries/person-amendments"
import { assertPersonExists, listPersonBillActivity } from "../../legislation/persistence/queries/person-bill-activity"
import { getNextLegislationApplication } from "../../legislation/runtime/runtime"
import { createCivicScopedReadApiHandler } from "../api/civic-scoped-read-routes"
import { createCompositeHttpApiHandler, type HttpApiHandler } from "../api/http"
import { createMeetingReadRepository } from "../api/meeting-read-repository"
import { createMeetingReadApiHandler } from "../api/meeting-read-routes"
import { createOrganizationBillReadApiHandler } from "../api/organization-bill-read-routes"
import { createOrganizationDetailReadRepository } from "../api/organization-detail-read-repository"
import { createOrganizationDetailReadApiHandler } from "../api/organization-detail-read-routes"
import { createOrganizationMembersRepository } from "../api/organization-members-read-repository"
import { createOrganizationMembersReadApiHandler } from "../api/organization-members-read-routes"
import { createOrganizationReadRepository } from "../api/organization-read-repository"
import { createOrganizationReadApiHandler } from "../api/organization-read-routes"
import { createPeopleReadApiHandler } from "../api/people-read-routes"
import { createPersonAmendmentApiHandler } from "../api/person-amendment-routes"
import { createPersonBillActivityApiHandler } from "../api/person-bill-activity-routes"
import { createPersonDetailReadRepository } from "../api/person-detail-read-repository"
import { createPersonDetailReadApiHandler } from "../api/person-detail-read-routes"
import { createPersonMembershipsRepository } from "../api/person-membership-read-repository"
import { createPersonMembershipReadApiHandler } from "../api/person-membership-read-routes"
import { createVoteReadRepository } from "../api/vote-read-repository"
import { createVoteReadApiHandler } from "../api/vote-read-routes"
import { executeAuthenticatedApiRequest } from "./authenticated-api-request"

type CivicEntityApplication = Readonly<{
  config: Readonly<{ server: Readonly<{ publicApiBaseUrl: string | undefined }> }>
  database: LegislationDatabase
}>

type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

export type CivicEntityRequestHandlerDependencies = Readonly<{
  createHandler: () => HttpApiHandler
  execute: NextHttpApiExecutor
}>

let civicEntityHandler: HttpApiHandler | undefined

/** Handles people and organization entity read routes. */
export async function handleCivicEntityRequest(request: Request): Promise<Response> {
  civicEntityHandler ??= createCivicEntityHttpApiHandler(getNextLegislationApplication())
  return await executeAuthenticatedApiRequest(request, civicEntityHandler)
}

export function createCivicEntityRequestHandler(
  dependencies: CivicEntityRequestHandlerDependencies
): (request: Request) => Promise<Response> {
  let handler: HttpApiHandler | undefined
  return async (request) => {
    handler ??= dependencies.createHandler()
    return await dependencies.execute(request, handler)
  }
}

export function createCivicEntityHttpApiHandler(application: CivicEntityApplication): HttpApiHandler {
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
      )
    ])
  )
}

function requiredPublicApiBaseUrl(application: CivicEntityApplication): string {
  const value = application.config.server.publicApiBaseUrl
  if (value === undefined) {
    throw new Error("LEGISLATION_PUBLIC_API_BASE_URL is required for Next API routes")
  }
  return value
}

async function unavailableMeetingChild(): Promise<never> {
  throw new Error("Civic entity routes do not compose meeting detail children")
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
