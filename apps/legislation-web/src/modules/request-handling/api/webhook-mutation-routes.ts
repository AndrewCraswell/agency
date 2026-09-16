import { createHash } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"
import { getRequestContext } from "@repo/legislation-core/auth/request-context"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import {
  assertAllowedQueryParameters,
  apiResource,
  correlationId,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"
import {
  principalScopeForSubscriptionOwner,
  type PreflightSubscriptionMutationExecutor,
  SubscriptionRepositoryError,
  type IdempotentResponse,
  type SubscriptionMutationExecutor,
  type SubscriptionTransaction
} from "./subscription-repository.js"
import {
  type CreateWebhookInput,
  SubscriptionApiError,
  SubscriptionService,
  type UpdateWebhookInput,
  type Webhook,
  type WebhookWithSecret,
  type SubscriptionEventType
} from "./subscriptions.js"
import {
  createPinnedWebhookVerificationTransport,
  type WebhookVerificationTransport
} from "./webhook-challenge-transport.js"
import { assertWebhookReadModel } from "./webhook-read-repository.js"
import { resolvePublicWebhookUrl, UnsafeWebhookUrlError } from "./webhook-security.js"

const eventTypes = new Set([
  "action-added",
  "amendment-added",
  "document-added",
  "meeting-cancelled",
  "meeting-rescheduled",
  "meeting-scheduled",
  "query-match",
  "record-created",
  "record-updated",
  "relationship-changed",
  "status-changed",
  "vote-added"
])

type RouteOptions = Readonly<{
  apiBaseUrl: string
  resolvePublicUrl?: typeof resolvePublicWebhookUrl
  transport?: WebhookVerificationTransport
}>

/** Durable webhook mutations; the read handler remains separately composed. */
export function createWebhookMutationApiHandler(
  service: SubscriptionService,
  executor: SubscriptionMutationExecutor,
  options: RouteOptions
): HttpApiHandler {
  const resolvePublicUrl = options.resolvePublicUrl ?? resolvePublicWebhookUrl
  const transport = options.transport ?? createPinnedWebhookVerificationTransport()
  return async (request, response) => {
    const url = requestUrl(request)
    const match = /^\/api\/webhooks\/([^/]+)(?:\/(rotate-secret|verify))?$/.exec(url.pathname)
    const isCreate = url.pathname === "/api/webhooks" && request.method === "POST"
    const isUpdate = match !== null && match[2] === undefined && request.method === "PATCH"
    const isDelete = match !== null && match[2] === undefined && request.method === "DELETE"
    const isRotate = match !== null && match[2] === "rotate-secret" && request.method === "POST"
    const isVerify = match !== null && match[2] === "verify" && request.method === "POST"
    if (!isCreate && !isUpdate && !isDelete && !isRotate && !isVerify) {
      return false
    }
    const identity = getRequestContext()?.identity
    if (identity === undefined) {
      sendApiError(request, response, new LegislationError("forbidden", "An authenticated identity is required."))
      return true
    }
    try {
      assertAllowedQueryParameters(url, [])
      const idempotencyKey = requireIdempotencyKey(request)
      if (isCreate) {
        requireJsonContentType(request)
        const body = await readJsonBody(request)
        const input = parseCreate(body)
        const result = await executeWithPreflight(
          executor,
          identity,
          "POST",
          "/api/webhooks",
          idempotencyKey,
          { body },
          async () => await resolvePublicUrl(input.url),
          async (repository) => {
            const created = await service.withWebhookRepository(repository).createWebhook(identity, input)
            return resourceResponse(request, options, created, 201, {
              etag: created.webhook.revision,
              location: `/api/webhooks/${encodeURIComponent(created.webhook.id)}`
            })
          }
        )
        sendStored(request, response, result.response)
        return true
      }
      const id = webhookId(match![1]!)
      const canonicalPath = `/api/webhooks/${encodeURIComponent(id)}${match![2] === undefined ? "" : `/${match![2]}`}`
      const revision = requireIfMatch(request)
      if (isDelete) {
        await requireEmptyDeleteBody(request)
        const result = await execute(
          executor,
          identity,
          "DELETE",
          canonicalPath,
          idempotencyKey,
          // A replay key identifies the original cancellation request. The
          // later If-Match value is intentionally not part of its hash so the
          // durable receipt can be replayed after the resource revision moves.
          {},
          async (repository) => {
            const webhook = await service.withWebhookRepository(repository).cancelWebhook(identity, id, revision)
            if (webhook.cancelledAt === null) {
              throw new SubscriptionApiError("unprocessable", "Webhook cancellation did not persist its timestamp.")
            }
            return {
              body: apiResource(request, {
                cancelledAt: webhook.cancelledAt.toISOString(),
                finalRevision: webhook.revision,
                id: webhook.id
              }),
              headers: { etag: webhook.revision },
              statusCode: 200
            }
          }
        )
        sendStored(request, response, result.response)
        return true
      }
      if (isUpdate) {
        requireMergePatchContentType(request)
        const body = await readJsonBody(request)
        const patch = parsePatch(body)
        const updatedUrl = patch.url
        if (updatedUrl !== undefined) {
          const result = await executeWithPreflight(
            executor,
            identity,
            "PATCH",
            canonicalPath,
            idempotencyKey,
            { body, revision },
            async () => await resolvePublicUrl(updatedUrl),
            async (repository) => {
              const webhook = await service
                .withWebhookRepository(repository)
                .updateWebhook(identity, id, revision, patch)
              return resourceResponse(request, options, webhook, 200, { etag: webhook.revision })
            }
          )
          sendStored(request, response, result.response)
          return true
        }
        const result = await execute(
          executor,
          identity,
          "PATCH",
          canonicalPath,
          idempotencyKey,
          { body, revision },
          async (repository) => {
            const webhook = await service.withWebhookRepository(repository).updateWebhook(identity, id, revision, patch)
            return resourceResponse(request, options, webhook, 200, { etag: webhook.revision })
          }
        )
        sendStored(request, response, result.response)
        return true
      }
      requireJsonContentType(request)
      const body = await readJsonBody(request)
      if (isRotate) {
        const overlapSeconds = parseRotate(body)
        const result = await execute(
          executor,
          identity,
          "POST",
          canonicalPath,
          idempotencyKey,
          { body, revision },
          async (repository) => {
            const rotated = await service
              .withWebhookRepository(repository)
              .rotateWebhookSecret(identity, id, revision, overlapSeconds)
            return resourceResponse(request, options, rotated, 200, { etag: rotated.webhook.revision })
          }
        )
        sendStored(request, response, result.response)
        return true
      }
      assertEmptyObject(body)
      const verifiedExecutor = asPreflightExecutor(executor)
      const requestIdentity = mutationRequest(identity, "POST", canonicalPath, idempotencyKey, { body, revision })
      const result = await verifiedExecutor.executeWithPreflight(
        requestIdentity,
        async () => {
          // The executor holds the per-key advisory transaction lock through
          // this bounded preflight, preventing duplicate verification calls.
          const preflight = await service.verificationSecret(identity, id)
          const destination = await resolvePublicUrl(preflight.webhook.url)
          const keyId = preflight.webhook.activeKeyIds.at(-1)
          if (keyId === undefined) {
            throw new SubscriptionApiError("unprocessable", "Webhook verification has no active signing key.")
          }
          const verified = await transport.verify({
            destination,
            keyId,
            secret: preflight.secret,
            webhookId: preflight.webhook.id
          })
          if (!verified) {
            throw new SubscriptionApiError("conflict", "Webhook verification did not complete successfully.")
          }
        },
        async (repository) => {
          const activated = await service.withWebhookRepository(repository).activateWebhook(identity, id, revision)
          return resourceResponse(request, options, activated, 200, { etag: activated.revision })
        }
      )
      sendStored(request, response, result.response)
      return true
    } catch (error) {
      sendApiError(request, response, safeError(error))
      return true
    }
  }
}

async function execute<T>(
  executor: SubscriptionMutationExecutor,
  identity: NonNullable<ReturnType<typeof getRequestContext>>["identity"] & {},
  method: string,
  canonicalPath: string,
  key: string,
  value: unknown,
  operation: (repository: SubscriptionTransaction) => Promise<IdempotentResponse<T>>
) {
  return await executor.execute(mutationRequest(identity, method, canonicalPath, key, value), operation)
}

async function executeWithPreflight<T, Preflight>(
  executor: SubscriptionMutationExecutor,
  identity: NonNullable<ReturnType<typeof getRequestContext>>["identity"] & {},
  method: string,
  canonicalPath: string,
  key: string,
  value: unknown,
  preflight: () => Promise<Preflight>,
  operation: (repository: SubscriptionTransaction, preflight: Preflight) => Promise<IdempotentResponse<T>>
) {
  return await asPreflightExecutor(executor).executeWithPreflight(
    mutationRequest(identity, method, canonicalPath, key, value),
    preflight,
    operation
  )
}

function mutationRequest(
  identity: NonNullable<ReturnType<typeof getRequestContext>>["identity"] & {},
  method: string,
  canonicalPath: string,
  key: string,
  value: unknown
) {
  return {
    canonicalPath,
    key,
    method,
    principalScope: principalScopeForSubscriptionOwner({
      organizationId: identity.organizationId ?? null,
      userId: identity.userId
    }),
    requestHash: createHash("sha256").update(canonicalJson(value)).digest("hex")
  }
}

function asPreflightExecutor(executor: SubscriptionMutationExecutor): PreflightSubscriptionMutationExecutor {
  if (typeof (executor as Partial<PreflightSubscriptionMutationExecutor>).executeWithPreflight !== "function") {
    throw new SubscriptionApiError(
      "unprocessable",
      "Webhook verification is unavailable until durable replay preflight is configured."
    )
  }
  return executor as PreflightSubscriptionMutationExecutor
}

function resourceResponse(
  request: IncomingMessage,
  options: RouteOptions,
  value: Webhook | WebhookWithSecret,
  statusCode: number,
  headers: Readonly<Record<string, string>>
): IdempotentResponse<unknown> {
  if ("webhook" in value) {
    return { body: apiResource(request, { ...value, webhook: project(value.webhook, options) }), headers, statusCode }
  }
  return { body: apiResource(request, project(value, options)), headers, statusCode }
}

function project(webhook: Webhook, options: RouteOptions) {
  assertWebhookReadModel(webhook)
  return {
    ...webhook,
    canonicalUrl: new URL(`/api/webhooks/${encodeURIComponent(webhook.id)}`, options.apiBaseUrl).toString(),
    cancelledAt: date(webhook.cancelledAt),
    createdAt: webhook.createdAt.toISOString(),
    lastFailedAt: date(webhook.lastFailedAt),
    lastSucceededAt: date(webhook.lastSucceededAt),
    overlapEndsAt: date(webhook.overlapEndsAt),
    updatedAt: webhook.updatedAt.toISOString()
  }
}

function date(value: Date | null): string | null {
  return value === null ? null : value.toISOString()
}

function parseCreate(body: Readonly<Record<string, unknown>>): CreateWebhookInput {
  assertFields(body, ["eventTypes", "name", "url"])
  return {
    eventTypes: parseEvents(body.eventTypes),
    name: boundedStringField(body.name, "name", 120),
    url: stringField(body.url, "url")
  }
}

function parsePatch(body: Readonly<Record<string, unknown>>): UpdateWebhookInput {
  assertFields(body, ["eventTypes", "name", "status", "url"])
  if (Object.keys(body).length === 0) {
    throw new SubscriptionApiError("invalid_request", "A merge patch must contain at least one mutable field.")
  }
  const status = body.status
  if (status !== undefined && status !== "paused" && status !== "active") {
    throw new SubscriptionApiError("invalid_request", "status is invalid.")
  }
  return {
    ...(body.eventTypes === undefined ? {} : { eventTypes: parseEvents(body.eventTypes) }),
    ...(body.name === undefined ? {} : { name: boundedStringField(body.name, "name", 120) }),
    ...(status === undefined ? {} : { status }),
    ...(body.url === undefined ? {} : { url: stringField(body.url, "url") })
  }
}

function parseRotate(body: Readonly<Record<string, unknown>>): number | undefined {
  assertFields(body, ["overlapSeconds"])
  const value = body.overlapSeconds
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 86_400) {
    throw new SubscriptionApiError("invalid_request", "overlapSeconds must be an integer from 0 through 86400.")
  }
  return value
}

function parseEvents(value: unknown): readonly SubscriptionEventType[] {
  if (!Array.isArray(value)) {
    throw new SubscriptionApiError("invalid_request", "eventTypes must be an array of supported event types.")
  }
  const parsed: SubscriptionEventType[] = []
  for (const eventType of value) {
    if (!isEventType(eventType)) {
      throw new SubscriptionApiError("invalid_request", "eventTypes must contain only supported event types.")
    }
    if (parsed.includes(eventType)) {
      throw new SubscriptionApiError("invalid_request", "eventTypes must not contain duplicate values.")
    }
    parsed.push(eventType)
  }
  return parsed
}

function isEventType(value: unknown): value is SubscriptionEventType {
  return typeof value === "string" && eventTypes.has(value)
}

function stringField(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SubscriptionApiError("invalid_request", `${field} must be a non-empty string.`)
  }
  return value.trim()
}

function boundedStringField(value: unknown, field: string, maximumCodePoints: number): string {
  const result = stringField(value, field)
  if ([...result].length > maximumCodePoints) {
    throw new SubscriptionApiError("invalid_request", `${field} must contain at most ${maximumCodePoints} characters.`)
  }
  return result
}

function assertFields(body: Readonly<Record<string, unknown>>, fields: readonly string[]): void {
  const allowed = new Set(fields)
  const unknown = Object.keys(body).find((key) => !allowed.has(key))
  if (unknown !== undefined) {
    throw new SubscriptionApiError("invalid_request", `Unknown field: ${unknown}.`)
  }
}

function assertEmptyObject(body: Readonly<Record<string, unknown>>): void {
  if (Object.keys(body).length !== 0) {
    throw new SubscriptionApiError("invalid_request", "Webhook verification accepts only an empty JSON object.")
  }
}

function webhookId(raw: string): string {
  let id: string
  try {
    id = decodeURIComponent(raw)
  } catch {
    throw new SubscriptionApiError("invalid_request", "webhookId is invalid.")
  }
  if (id.length === 0 || id.trim() !== id || [...id].length > 256) {
    throw new SubscriptionApiError("invalid_request", "webhookId is invalid.")
  }
  return id
}

function requireIdempotencyKey(request: IncomingMessage): string {
  const value = request.headers["idempotency-key"]
  if (
    Array.isArray(value) ||
    request.headersDistinct["idempotency-key"]?.length !== 1 ||
    value === undefined ||
    !/^[\x20-\x7e]{8,128}$/.test(value)
  ) {
    throw new SubscriptionApiError(
      "invalid_request",
      "Idempotency-Key must contain 8 to 128 printable ASCII characters and appear once."
    )
  }
  return value
}

function requireIfMatch(request: IncomingMessage): string {
  const value = request.headers["if-match"]
  if (Array.isArray(value) || (request.headersDistinct["if-match"]?.length ?? 0) > 1) {
    throw new SubscriptionApiError("invalid_request", "If-Match must appear once.")
  }
  if (value === undefined || value.length === 0) {
    throw new SubscriptionApiError("precondition_failed", "If-Match is required for this mutation.")
  }
  return value
}

function requireJsonContentType(request: IncomingMessage): void {
  const value = request.headers["content-type"]
  if (
    Array.isArray(value) ||
    request.headersDistinct["content-type"]?.length !== 1 ||
    value?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json"
  ) {
    throw new SubscriptionApiError("invalid_request", "POST requires Content-Type application/json.")
  }
}

function requireMergePatchContentType(request: IncomingMessage): void {
  const value = request.headers["content-type"]
  if (
    Array.isArray(value) ||
    request.headersDistinct["content-type"]?.length !== 1 ||
    value?.split(";", 1)[0]?.trim().toLowerCase() !== "application/merge-patch+json"
  ) {
    throw new SubscriptionApiError("invalid_request", "PATCH requires Content-Type application/merge-patch+json.")
  }
}

async function requireEmptyDeleteBody(request: IncomingMessage): Promise<void> {
  if (request.headers["content-length"] !== undefined && request.headers["content-length"] !== "0") {
    throw new SubscriptionApiError("invalid_request", "DELETE requests must not include a request body.")
  }
  let bytes = 0
  for await (const chunk of request) {
    bytes += Buffer.isBuffer(chunk) ? chunk.byteLength : Buffer.byteLength(chunk)
    if (bytes > 0) {
      throw new SubscriptionApiError("invalid_request", "DELETE requests must not include a request body.")
    }
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`
  }
  const result = JSON.stringify(value)
  if (result === undefined) {
    throw new Error("Idempotency requests must be JSON-serializable.")
  }
  return result
}

function isJsonRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function withCurrentCorrelation(value: unknown, currentCorrelationId: string): unknown {
  if (!isJsonRecord(value) || !isJsonRecord(value.meta)) {
    return value
  }
  return { ...value, meta: { ...value.meta, correlationId: currentCorrelationId } }
}

function sendStored(request: IncomingMessage, response: ServerResponse, result: IdempotentResponse<unknown>): void {
  for (const [name, value] of Object.entries(result.headers)) {
    response.setHeader(name, value)
  }
  const currentCorrelationId = correlationId(request)
  response.setHeader("x-correlation-id", currentCorrelationId)
  sendApiJson(response, result.statusCode, withCurrentCorrelation(result.body, currentCorrelationId))
}

function safeError(error: unknown): LegislationError {
  if (error instanceof LegislationError) {
    return error
  }
  if (error instanceof SubscriptionApiError) {
    return new LegislationError(error.category, error.message, { details: error.details })
  }
  if (error instanceof UnsafeWebhookUrlError) {
    return new LegislationError("unprocessable", "Webhook URL does not resolve to a public delivery destination.")
  }
  if (error instanceof SubscriptionRepositoryError) {
    return new LegislationError(
      error.category === "idempotency_conflict" || error.category === "conflict" ? "conflict" : "internal",
      error.category === "conflict"
        ? "The request conflicts with existing state"
        : "The request could not be completed",
      { details: error.details }
    )
  }
  return new LegislationError("internal", "The request could not be completed")
}
