import { createCompositeHttpApiHandler, type HttpApiHandler } from "../../api/http.js"
import { executeNextHttpApiHandler } from "../../api/next/node-handler.js"
import {
  createAes256GcmIdempotencyCipher,
  PostgresSubscriptionRepository,
  SubscriptionIdempotencyTransaction
} from "../../api/subscription-repository.js"
import { createAes256GcmWebhookSecretProtector, SubscriptionService } from "../../api/subscriptions.js"
import { createWebhookMutationApiHandler } from "../../api/webhook-mutation-routes.js"
import { PostgresWebhookReadRepository } from "../../api/webhook-read-repository.js"
import { createWebhookReadApiHandler } from "../../api/webhook-read-routes.js"
import { getRequestContext, runWithRequestContext, type RequestIdentity } from "../../auth/request-context.js"
import { decodeIdempotencyEncryptionKey } from "../../config/config.js"
import type { LegislationDatabase } from "../../db/database.js"
import { getNextLegislationApplication } from "./runtime.js"

type WebhookRouteApplication = Readonly<{
  config: Readonly<{
    security: Readonly<{
      idempotencyEncryptionKey?: string | undefined
      webhookSecretEncryptionKey?: string | undefined
    }>
    server: Readonly<{ publicApiBaseUrl: string | undefined }>
  }>
  database: LegislationDatabase
}>

type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

export type WebhookRequestHandlerDependencies = Readonly<{
  createHandler: () => HttpApiHandler
  execute: NextHttpApiExecutor
}>

export type WebhookCompositionDependencies = Readonly<{
  resolveRequestIdentity?: () => RequestIdentity | undefined
}>

let webhookHandler: HttpApiHandler | undefined

/** Handles the public webhook API routes. */
export async function handleWebhookRequest(request: Request): Promise<Response> {
  webhookHandler ??= createWebhookHttpApiHandler(getNextLegislationApplication())
  return await executeNextHttpApiHandler(request, webhookHandler)
}

export function createWebhookRequestHandler(
  dependencies: WebhookRequestHandlerDependencies
): (request: Request) => Promise<Response> {
  let handler: HttpApiHandler | undefined
  return async (request) => {
    handler ??= dependencies.createHandler()
    return await dependencies.execute(request, handler)
  }
}

export function createWebhookHttpApiHandler(
  application: WebhookRouteApplication,
  dependencies: WebhookCompositionDependencies = {}
): HttpApiHandler {
  const apiBaseUrl = requiredPublicApiBaseUrl(application)
  const handlers: HttpApiHandler[] = [
    restrictToRoutes(
      createWebhookReadApiHandler(new PostgresWebhookReadRepository(application.database), { apiBaseUrl }),
      isWebhookReadRoute
    )
  ]
  const { idempotencyEncryptionKey, webhookSecretEncryptionKey } = application.config.security
  if (idempotencyEncryptionKey !== undefined && webhookSecretEncryptionKey !== undefined) {
    const repository = new PostgresSubscriptionRepository(application.database)
    const service = new SubscriptionService(
      repository,
      createAes256GcmWebhookSecretProtector(decodeIdempotencyEncryptionKey(webhookSecretEncryptionKey))
    )
    handlers.push(
      restrictToRoutes(
        createWebhookMutationApiHandler(
          service,
          new SubscriptionIdempotencyTransaction(
            application.database,
            createAes256GcmIdempotencyCipher(decodeIdempotencyEncryptionKey(idempotencyEncryptionKey))
          ),
          { apiBaseUrl }
        ),
        isWebhookMutationRoute
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

function requiredPublicApiBaseUrl(application: WebhookRouteApplication): string {
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

function isWebhookReadRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  if (request.method !== "GET") {
    return false
  }
  const segments = requestPathSegments(request)
  return (
    segments[1] === "api" &&
    segments[2] === "webhooks" &&
    (segments.length === 3 || (segments.length === 4 && hasDynamicRouteId(segments[3])))
  )
}

function isWebhookMutationRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  const segments = requestPathSegments(request)
  if (segments[1] !== "api" || segments[2] !== "webhooks") {
    return false
  }
  return (
    (request.method === "POST" && segments.length === 3) ||
    ((request.method === "PATCH" || request.method === "DELETE") &&
      segments.length === 4 &&
      hasDynamicRouteId(segments[3])) ||
    (request.method === "POST" &&
      segments.length === 5 &&
      hasDynamicRouteId(segments[3]) &&
      (segments[4] === "rotate-secret" || segments[4] === "verify"))
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
