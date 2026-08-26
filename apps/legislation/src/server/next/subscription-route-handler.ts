import { createCompositeHttpApiHandler, type HttpApiHandler } from "../../api/http.js"
import {
  createAes256GcmIdempotencyCipher,
  PostgresSubscriptionRepository,
  SubscriptionIdempotencyTransaction
} from "../../api/subscription-repository.js"
import {
  createSubscriptionMutationApiHandler,
  createSubscriptionReadApiHandler
} from "../../api/subscription-routes.js"
import { createWebhookSecretProtector, SubscriptionService } from "../../api/subscriptions.js"
import { getRequestContext, runWithRequestContext, type RequestIdentity } from "../../auth/request-context.js"
import { decodeIdempotencyEncryptionKey } from "../../config/config.js"
import type { LegislationDatabase } from "../../db/database.js"
import { executeAuthenticatedApiRequest } from "./authenticated-api-request.js"
import { getNextLegislationApplication } from "./runtime.js"

type SubscriptionRouteApplication = Readonly<{
  config: Readonly<{
    security: Readonly<{ idempotencyEncryptionKey?: string | undefined }>
    server: Readonly<{ publicApiBaseUrl: string | undefined }>
  }>
  database: LegislationDatabase
}>

type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

export type SubscriptionRequestHandlerDependencies = Readonly<{
  createHandler: () => HttpApiHandler
  execute: NextHttpApiExecutor
}>

export type SubscriptionCompositionDependencies = Readonly<{
  resolveRequestIdentity?: () => RequestIdentity | undefined
}>

let subscriptionHandler: HttpApiHandler | undefined

/** Handles the public subscription API routes. */
export async function handleSubscriptionRequest(request: Request): Promise<Response> {
  subscriptionHandler ??= createSubscriptionHttpApiHandler(getNextLegislationApplication())
  return await executeAuthenticatedApiRequest(request, subscriptionHandler)
}

export function createSubscriptionRequestHandler(
  dependencies: SubscriptionRequestHandlerDependencies
): (request: Request) => Promise<Response> {
  let handler: HttpApiHandler | undefined
  return async (request) => {
    handler ??= dependencies.createHandler()
    return await dependencies.execute(request, handler)
  }
}

export function createSubscriptionHttpApiHandler(
  application: SubscriptionRouteApplication,
  dependencies: SubscriptionCompositionDependencies = {}
): HttpApiHandler {
  const apiBaseUrl = requiredPublicApiBaseUrl(application)
  const repository = new PostgresSubscriptionRepository(application.database)
  const service = new SubscriptionService(
    repository,
    createWebhookSecretProtector(async () => {
      throw new Error("Webhook secret protection is not configured for subscription routes.")
    })
  )
  const handlers: HttpApiHandler[] = [
    restrictToRoutes(createSubscriptionReadApiHandler(service, { apiBaseUrl }), isSubscriptionReadRoute)
  ]
  const encryptionKey = application.config.security.idempotencyEncryptionKey
  if (encryptionKey !== undefined) {
    handlers.push(
      restrictToRoutes(
        createSubscriptionMutationApiHandler(
          service,
          new SubscriptionIdempotencyTransaction(
            application.database,
            createAes256GcmIdempotencyCipher(decodeIdempotencyEncryptionKey(encryptionKey))
          ),
          { apiBaseUrl }
        ),
        isSubscriptionMutationRoute
      )
    )
  }

  const handler = rejectTrailingSlashApiPaths(createCompositeHttpApiHandler(handlers))
  return withRequestIdentity(handler, dependencies.resolveRequestIdentity)
}

function withRequestIdentity(
  handler: HttpApiHandler,
  resolveRequestIdentity: (() => RequestIdentity | undefined) | undefined
): HttpApiHandler {
  if (resolveRequestIdentity === undefined) {
    return handler
  }
  return async (request, response) => {
    const context = getRequestContext()
    const identity = resolveRequestIdentity()
    if (context === undefined || identity === undefined) {
      return await handler(request, response)
    }
    return await runWithRequestContext({ ...context, identity }, async () => await handler(request, response))
  }
}

function requiredPublicApiBaseUrl(application: SubscriptionRouteApplication): string {
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

function isSubscriptionReadRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  if (request.method !== "GET") {
    return false
  }
  const segments = requestPathSegments(request)
  return (
    segments[1] === "api" &&
    segments[2] === "subscriptions" &&
    (segments.length === 3 ||
      (segments.length === 4 && hasDynamicRouteId(segments[3])) ||
      (segments.length === 5 &&
        hasDynamicRouteId(segments[3]) &&
        (segments[4] === "events" || segments[4] === "deliveries")))
  )
}

function isSubscriptionMutationRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  const segments = requestPathSegments(request)
  if (segments[1] !== "api" || segments[2] !== "subscriptions") {
    return false
  }
  return (
    (request.method === "POST" && segments.length === 3) ||
    ((request.method === "PATCH" || request.method === "DELETE") &&
      segments.length === 4 &&
      hasDynamicRouteId(segments[3]))
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
