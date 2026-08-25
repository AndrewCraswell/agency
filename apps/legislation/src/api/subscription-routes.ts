import { createHash } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"
import { getRequestContext } from "../auth/request-context.js"
import { LegislationError } from "../legislation/errors.js"
import {
  assertAllowedQueryParameters,
  apiPage,
  apiResource,
  queryInteger,
  queryOptionalDate,
  queryOptionalString,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"
import {
  type IdempotencyResult,
  type IdempotentResponse,
  principalScopeForSubscriptionOwner,
  SubscriptionRepositoryError,
  type SubscriptionMutationExecutor
} from "./subscription-repository.js"
import {
  type CreateSubscriptionInput,
  type CreateWebhookInput,
  type Delivery,
  type SubscriptionDeliveryPreference,
  SubscriptionApiError,
  type SubscriptionDeliveryListInput,
  type SubscriptionEvent,
  type SubscriptionEventListInput,
  type SubscriptionEventType,
  type SubscriptionListInput,
  type SubscriptionRepository,
  SubscriptionService,
  type Subscription,
  type SubscriptionTarget,
  type UpdateSubscriptionInput,
  type UpdateWebhookInput
} from "./subscriptions.js"
import { resolvePublicWebhookUrl, UnsafeWebhookUrlError } from "./webhook-security.js"

/**
 * Implementations must connect to one of `destination.addresses` while using
 * `destination.url.hostname` for TLS and Host, and must call
 * `destination.revalidate()` immediately before every attempt or retry.
 */
export type WebhookVerificationExecutor = (
  destination: Awaited<ReturnType<typeof resolvePublicWebhookUrl>>,
  input: Readonly<{ webhookId: string }>
) => Promise<boolean>

const subscriptionEvents = new Set<SubscriptionEventType>([
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

type SubscriptionRecordType = Extract<SubscriptionTarget, { type: "record" }>["recordType"]

const subscriptionRecordTypes = new Set<SubscriptionRecordType>([
  "amendment",
  "bill",
  "calendar",
  "meeting",
  "organization",
  "person",
  "supporting-material"
])

type SubscriptionReadApi = Pick<
  SubscriptionService,
  "getSubscription" | "listDeliveries" | "listSubscriptionEvents" | "listSubscriptions"
>

type SubscriptionReadRouteOptions = Readonly<{ apiBaseUrl: string }>

/**
 * Read-only subscription composition. Subscription mutations are deliberately
 * absent until a production encryption adapter can protect idempotent replay.
 */
export function createSubscriptionReadApiHandler(
  service: SubscriptionReadApi,
  options: SubscriptionReadRouteOptions
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    const match = /^\/api\/subscriptions\/([^/]+)(?:\/(events|deliveries))?$/.exec(url.pathname)
    const isCollection = url.pathname === "/api/subscriptions"
    if (request.method !== "GET" || (!isCollection && match === null)) {
      return false
    }
    const identity = getRequestContext()?.identity
    if (identity === undefined) {
      sendError(request, response, new SubscriptionApiError("forbidden", "An authenticated identity is required."))
      return true
    }
    try {
      if (isCollection) {
        const input = subscriptionListInput(url)
        const page = await service.listSubscriptions(identity, input)
        sendApiJson(response, 200, apiPage(request, projectPage(page, options, projectSubscription), input.limit))
        return true
      }
      const id = decodeSubscriptionId(match![1]!)
      const child = match![2]
      if (child === "events") {
        const input = subscriptionEventListInput(url)
        const page = await service.listSubscriptionEvents(identity, id, input)
        sendApiJson(response, 200, apiPage(request, projectPage(page, options, projectSubscriptionEvent), input.limit))
        return true
      }
      if (child === "deliveries") {
        const input = subscriptionDeliveryListInput(url)
        const page = await service.listDeliveries(identity, id, input)
        sendApiJson(response, 200, apiPage(request, projectPage(page, options, projectDelivery), input.limit))
        return true
      }
      const subscription = await service.getSubscription(identity, id)
      response.setHeader("etag", subscription.revision)
      sendApiJson(response, 200, apiResource(request, projectSubscription(subscription, options)))
      return true
    } catch (error) {
      sendError(request, response, error)
      return true
    }
  }
}

function subscriptionListInput(url: URL): Omit<SubscriptionListInput, "owner"> {
  assertAllowedQueryParameters(url, [
    "channel",
    "cursor",
    "eventType",
    "limit",
    "recordType",
    "status",
    "targetType",
    "updatedFrom"
  ])
  return {
    channel: queryEnum(url, "channel", new Set(["email", "in-app", "webhook"])),
    cursor: queryOptionalString(url, "cursor"),
    eventType: queryEnum(url, "eventType", subscriptionEvents),
    limit: queryInteger(url, "limit", 20),
    recordType: queryEnum(url, "recordType", subscriptionRecordTypes),
    status: queryEnum(url, "status", new Set(["active", "cancelled", "paused"])),
    targetType: queryEnum(url, "targetType", new Set(["query", "record"])),
    updatedFrom: queryOptionalDate(url, "updatedFrom")
  }
}

function subscriptionEventListInput(url: URL): Omit<SubscriptionEventListInput, "owner" | "subscriptionId"> {
  assertAllowedQueryParameters(url, ["cursor", "eventType", "from", "limit", "recordId", "recordType", "to"])
  const from = queryOptionalDate(url, "from")
  const to = queryOptionalDate(url, "to")
  assertTimeRange(from, to)
  return {
    cursor: queryOptionalString(url, "cursor"),
    eventType: queryEnum(url, "eventType", subscriptionEvents),
    from,
    limit: queryInteger(url, "limit", 20),
    recordId: queryOptionalString(url, "recordId"),
    recordType: queryEnum(url, "recordType", subscriptionRecordTypes),
    to
  }
}

function subscriptionDeliveryListInput(url: URL): Omit<SubscriptionDeliveryListInput, "owner" | "subscriptionId"> {
  assertAllowedQueryParameters(url, ["channel", "cursor", "from", "limit", "status", "to"])
  const from = queryOptionalDate(url, "from")
  const to = queryOptionalDate(url, "to")
  assertTimeRange(from, to)
  return {
    channel: queryEnum(url, "channel", new Set(["email", "in-app", "webhook"])),
    cursor: queryOptionalString(url, "cursor"),
    from,
    limit: queryInteger(url, "limit", 20),
    status: queryEnum(url, "status", new Set(["delivered", "failed", "pending", "processing", "suppressed"])),
    to
  }
}

function queryEnum<Value extends string>(url: URL, name: string, values: ReadonlySet<Value>): Value | undefined {
  const value = queryOptionalString(url, name)
  if (value === undefined) {
    return undefined
  }
  if (!values.has(value as Value)) {
    throw new SubscriptionApiError("invalid_request", `${name} is invalid.`)
  }
  return value as Value
}

function assertTimeRange(from: Date | undefined, to: Date | undefined): void {
  if (from !== undefined && to !== undefined && from > to) {
    throw new SubscriptionApiError("invalid_request", "from must not be after to.")
  }
}

function projectPage<Input, Output>(
  page: Readonly<{ items: readonly Input[]; nextCursor?: string; truncated: boolean }>,
  options: SubscriptionReadRouteOptions,
  project: (input: Input, options: SubscriptionReadRouteOptions) => Output
): Readonly<{ items: readonly Output[]; nextCursor?: string; truncated: boolean }> {
  return { ...page, items: page.items.map((item) => project(item, options)) }
}

function projectSubscription(subscription: Subscription, options: SubscriptionReadRouteOptions) {
  return {
    ...subscription,
    canonicalUrl: canonicalUrl(options, `/api/subscriptions/${encodeURIComponent(subscription.id)}`),
    cancelledAt: isoTimestamp(subscription.cancelledAt),
    createdAt: isoTimestamp(subscription.createdAt),
    updatedAt: isoTimestamp(subscription.updatedAt)
  }
}

function projectSubscriptionEvent(event: SubscriptionEvent) {
  return {
    ...event,
    matchedAt: isoTimestamp(event.matchedAt),
    occurredAt: isoTimestamp(event.occurredAt)
  }
}

function projectDelivery(delivery: Delivery) {
  return {
    ...delivery,
    createdAt: isoTimestamp(delivery.createdAt),
    deliveredAt: isoTimestamp(delivery.deliveredAt),
    nextAttemptAt: isoTimestamp(delivery.nextAttemptAt)
  }
}

function canonicalUrl(options: SubscriptionReadRouteOptions, path: string): string {
  return new URL(path, options.apiBaseUrl).toString()
}

function isoTimestamp(value: Date | null): string | null {
  return value === null ? null : value.toISOString()
}

export function createSubscriptionMutationApiHandler(
  service: SubscriptionService,
  executor: SubscriptionMutationExecutor,
  options: SubscriptionReadRouteOptions
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    const subscriptionMatch = /^\/api\/subscriptions\/([^/]+)$/.exec(url.pathname)
    const isCreate = url.pathname === "/api/subscriptions" && request.method === "POST"
    const isUpdate = subscriptionMatch !== null && request.method === "PATCH"
    const isDelete = subscriptionMatch !== null && request.method === "DELETE"
    if (!isCreate && !isUpdate && !isDelete) {
      return false
    }
    const identity = getRequestContext()?.identity
    if (identity === undefined) {
      sendError(request, response, new SubscriptionApiError("forbidden", "An authenticated identity is required."))
      return true
    }
    try {
      assertAllowedQueryParameters(url, [])
      const idempotencyKey = requireIdempotencyKey(request)
      if (isCreate) {
        requireJsonContentType(request)
        const body = await readJsonBody(request)
        const input = parseCreateSubscription(body)
        const result = await executeSubscriptionMutation(
          executor,
          identity,
          request.method!,
          url.pathname,
          idempotencyKey,
          { body },
          async (repository) => {
            const created = await service.withRepository(repository).createSubscription(identity, input)
            return {
              body: apiResource(request, projectSubscription(created, options)),
              headers: {
                etag: created.revision,
                location: `/api/subscriptions/${encodeURIComponent(created.id)}`
              },
              statusCode: 201
            }
          }
        )
        sendIdempotentResponse(response, result.response)
        return true
      }

      const id = decodeSubscriptionId(subscriptionMatch![1]!)
      const canonicalPath = `/api/subscriptions/${encodeURIComponent(id)}`
      const revision = requireIfMatch(request)
      if (isUpdate) {
        requireMergePatchContentType(request)
        const body = await readJsonBody(request)
        const patch = parseSubscriptionPatch(body)
        const result = await executeSubscriptionMutation(
          executor,
          identity,
          request.method!,
          canonicalPath,
          idempotencyKey,
          { body, revision },
          async (repository) => {
            const subscription = await service
              .withRepository(repository)
              .updateSubscription(identity, id, revision, patch)
            return {
              body: apiResource(request, projectSubscription(subscription, options)),
              headers: { etag: subscription.revision },
              statusCode: 200
            }
          }
        )
        sendIdempotentResponse(response, result.response)
        return true
      }

      await requireEmptyDeleteBody(request)
      const result = await executeSubscriptionMutation(
        executor,
        identity,
        request.method!,
        canonicalPath,
        idempotencyKey,
        { revision },
        async (repository) => {
          const subscription = await service.withRepository(repository).cancelSubscription(identity, id, revision)
          return {
            body: apiResource(request, { cancelledAt: isoTimestamp(subscription.cancelledAt), id: subscription.id }),
            headers: { etag: subscription.revision },
            statusCode: 200
          }
        }
      )
      sendIdempotentResponse(response, result.response)
      return true
    } catch (error) {
      sendError(request, response, addDuplicateSubscriptionCanonicalUrl(error, options))
      return true
    }
  }
}

async function executeSubscriptionMutation<T>(
  executor: SubscriptionMutationExecutor,
  identity: NonNullable<ReturnType<typeof getRequestContext>>["identity"] & {},
  method: string,
  canonicalPath: string,
  key: string,
  value: unknown,
  operation: (repository: SubscriptionRepository) => Promise<IdempotentResponse<T>>
): Promise<IdempotencyResult<T>> {
  return await executor.execute<T>(
    {
      canonicalPath,
      key,
      method,
      principalScope: principalScopeForSubscriptionOwner({
        organizationId: identity.organizationId ?? null,
        userId: identity.userId
      }),
      requestHash: requestHash(value)
    },
    operation
  )
}

function requestHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex")
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`
  }
  if (isJsonRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
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

function decodeSubscriptionId(value: string): string {
  let id: string
  try {
    id = decodeURIComponent(value)
  } catch {
    throw new SubscriptionApiError("invalid_request", "Subscription ID must use valid percent-encoding.")
  }
  if (!/^subscription:[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)) {
    throw new SubscriptionApiError("invalid_request", "Subscription ID must be a canonical subscription identifier.")
  }
  return id
}

function addDuplicateSubscriptionCanonicalUrl(error: unknown, options: SubscriptionReadRouteOptions): unknown {
  if (error instanceof SubscriptionApiError && error.category === "conflict") {
    const existingSubscriptionId = error.details?.existingSubscriptionId
    if (typeof existingSubscriptionId === "string" && error.details?.canonicalUrl === undefined) {
      return new SubscriptionApiError(error.category, error.message, {
        ...error.details,
        canonicalUrl: canonicalUrl(options, `/api/subscriptions/${encodeURIComponent(existingSubscriptionId)}`)
      })
    }
  }
  return error
}

function sendIdempotentResponse(
  response: ServerResponse,
  result: Readonly<{ body: unknown; headers: Readonly<Record<string, string>>; statusCode: number }>
): void {
  for (const [name, value] of Object.entries(result.headers)) {
    response.setHeader(name, value)
  }
  sendApiJson(response, result.statusCode, result.body)
}

export function createSubscriptionApiHandler(
  service: SubscriptionService,
  options: Readonly<{ verifyWebhook?: WebhookVerificationExecutor }> = {}
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!/^\/api\/(subscriptions|webhooks)(?:\/|$)/.test(url.pathname)) {
      return false
    }
    const identity = getRequestContext()?.identity
    if (identity === undefined) {
      sendError(request, response, new SubscriptionApiError("forbidden", "An authenticated identity is required."))
      return true
    }
    try {
      return await handleRequest(service, identity, request, response, url, options)
    } catch (error) {
      sendError(request, response, error)
      return true
    }
  }
}

async function handleRequest(
  service: SubscriptionService,
  identity: NonNullable<ReturnType<typeof getRequestContext>>["identity"] & {},
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  options: Readonly<{ verifyWebhook?: WebhookVerificationExecutor }>
): Promise<boolean> {
  const subscriptionMatch = /^\/api\/subscriptions\/([^/]+)(?:\/(events|deliveries))?$/.exec(url.pathname)
  const webhookMatch = /^\/api\/webhooks\/([^/]+)(?:\/(rotate-secret|verify))?$/.exec(url.pathname)

  if (url.pathname === "/api/subscriptions" && request.method === "GET") {
    const input = subscriptionListInput(url)
    const page = await service.listSubscriptions(identity, input)
    sendApiJson(response, 200, apiPage(request, page, input.limit))
    return true
  }
  if (url.pathname === "/api/subscriptions" && request.method === "POST") {
    requireIdempotencyKey(request)
    const created = await service.createSubscription(identity, parseCreateSubscription(await readJsonBody(request)))
    response.setHeader("etag", created.revision)
    response.setHeader("location", `/api/subscriptions/${encodeURIComponent(created.id)}`)
    sendApiJson(response, 201, apiResource(request, created))
    return true
  }
  if (subscriptionMatch !== null) {
    const id = decodeSubscriptionId(subscriptionMatch[1]!)
    const child = subscriptionMatch[2]
    if (child === "events" && request.method === "GET") {
      const input = subscriptionEventListInput(url)
      const page = await service.listSubscriptionEvents(identity, id, input)
      sendApiJson(response, 200, apiPage(request, page, input.limit))
      return true
    }
    if (child === "deliveries" && request.method === "GET") {
      const input = subscriptionDeliveryListInput(url)
      const page = await service.listDeliveries(identity, id, input)
      sendApiJson(response, 200, apiPage(request, page, input.limit))
      return true
    }
    if (child === undefined && request.method === "GET") {
      const subscription = await service.getSubscription(identity, id)
      response.setHeader("etag", subscription.revision)
      sendApiJson(response, 200, apiResource(request, subscription))
      return true
    }
    if (child === undefined && request.method === "PATCH") {
      requireIdempotencyKey(request)
      requireMergePatchContentType(request)
      const subscription = await service.updateSubscription(
        identity,
        id,
        requireIfMatch(request),
        parseSubscriptionPatch(await readJsonBody(request))
      )
      response.setHeader("etag", subscription.revision)
      sendApiJson(response, 200, apiResource(request, subscription))
      return true
    }
    if (child === undefined && request.method === "DELETE") {
      requireIdempotencyKey(request)
      const subscription = await service.cancelSubscription(identity, id, requireIfMatch(request))
      sendApiJson(response, 200, apiResource(request, { cancelledAt: subscription.cancelledAt, id: subscription.id }))
      return true
    }
  }
  if (url.pathname === "/api/webhooks" && request.method === "GET") {
    const limit = queryInteger(url, "limit", 20)
    const page = await service.listWebhooks(identity, {
      cursor: queryOptionalString(url, "cursor"),
      limit
    })
    sendApiJson(response, 200, apiPage(request, page, limit))
    return true
  }
  if (url.pathname === "/api/webhooks" && request.method === "POST") {
    requireIdempotencyKey(request)
    const input = parseCreateWebhook(await readJsonBody(request))
    await resolvePublicWebhookUrl(input.url)
    const created = await service.createWebhook(identity, input)
    response.setHeader("etag", created.webhook.revision)
    response.setHeader("location", `/api/webhooks/${encodeURIComponent(created.webhook.id)}`)
    sendApiJson(response, 201, apiResource(request, created))
    return true
  }
  if (webhookMatch !== null) {
    const id = decodeURIComponent(webhookMatch[1]!)
    const action = webhookMatch[2]
    if (action === "rotate-secret" && request.method === "POST") {
      requireIdempotencyKey(request)
      const body = await readJsonBody(request)
      assertKnownFields(body, ["overlapSeconds"])
      const overlapSeconds =
        body.overlapSeconds === undefined ? undefined : numberValue(body.overlapSeconds, "overlapSeconds")
      const rotated = await service.rotateWebhookSecret(identity, id, requireIfMatch(request), overlapSeconds)
      response.setHeader("etag", rotated.webhook.revision)
      sendApiJson(response, 200, apiResource(request, rotated))
      return true
    }
    if (action === "verify" && request.method === "POST") {
      requireIdempotencyKey(request)
      const revision = requireIfMatch(request)
      const body = await readJsonBody(request)
      if (Object.keys(body).length > 0) {
        throw new SubscriptionApiError("invalid_request", "Webhook verification accepts only an empty JSON object.")
      }
      const webhook = await service.getWebhook(identity, id)
      const destination = await resolvePublicWebhookUrl(webhook.url)
      if (options.verifyWebhook === undefined) {
        throw new SubscriptionApiError(
          "unprocessable",
          "Webhook verification is unavailable until the delivery transport is configured."
        )
      }
      const verified = await options.verifyWebhook(destination, { webhookId: webhook.id })
      if (!verified) {
        throw new SubscriptionApiError("conflict", "Webhook verification did not complete successfully.")
      }
      const activated = await service.activateWebhook(identity, id, revision)
      response.setHeader("etag", activated.revision)
      sendApiJson(response, 200, apiResource(request, activated))
      return true
    }
    if (action === undefined && request.method === "GET") {
      const webhook = await service.getWebhook(identity, id)
      response.setHeader("etag", webhook.revision)
      sendApiJson(response, 200, apiResource(request, webhook))
      return true
    }
    if (action === undefined && request.method === "PATCH") {
      requireIdempotencyKey(request)
      requireMergePatchContentType(request)
      const patch = parseWebhookPatch(await readJsonBody(request))
      if (patch.url !== undefined) {
        await resolvePublicWebhookUrl(patch.url)
      }
      const webhook = await service.updateWebhook(identity, id, requireIfMatch(request), patch)
      response.setHeader("etag", webhook.revision)
      sendApiJson(response, 200, apiResource(request, webhook))
      return true
    }
    if (action === undefined && request.method === "DELETE") {
      requireIdempotencyKey(request)
      const webhook = await service.cancelWebhook(identity, id, requireIfMatch(request))
      sendApiJson(response, 200, apiResource(request, { cancelledAt: webhook.cancelledAt, id: webhook.id }))
      return true
    }
  }
  return false
}

function requireIfMatch(request: IncomingMessage): string {
  const value = request.headers["if-match"]
  if (Array.isArray(value) || hasMultipleHeaderValues(request, "if-match")) {
    throw new SubscriptionApiError("invalid_request", "If-Match must appear once.")
  }
  const revision = value
  if (revision === undefined || revision.length === 0) {
    throw new SubscriptionApiError("precondition_failed", "If-Match is required for this mutation.")
  }
  return revision
}

function requireIdempotencyKey(request: IncomingMessage): string {
  const value = request.headers["idempotency-key"]
  if (Array.isArray(value) || hasMultipleHeaderValues(request, "idempotency-key")) {
    throw new SubscriptionApiError("invalid_request", "Idempotency-Key must appear once.")
  }
  const key = value
  if (key === undefined || !/^[\x20-\x7e]{8,128}$/.test(key)) {
    throw new SubscriptionApiError(
      "invalid_request",
      "Idempotency-Key must contain 8 to 128 printable ASCII characters."
    )
  }
  return key
}

function requireMergePatchContentType(request: IncomingMessage): void {
  const value = request.headers["content-type"]
  if (hasMultipleHeaderValues(request, "content-type")) {
    throw new SubscriptionApiError("invalid_request", "Content-Type must appear once.")
  }
  const contentType = value
  if (contentType?.split(";", 1)[0]?.trim().toLowerCase() !== "application/merge-patch+json") {
    throw new SubscriptionApiError("invalid_request", "PATCH requires Content-Type application/merge-patch+json.")
  }
}

function requireJsonContentType(request: IncomingMessage): void {
  const value = request.headers["content-type"]
  if (hasMultipleHeaderValues(request, "content-type")) {
    throw new SubscriptionApiError("invalid_request", "Content-Type must appear once.")
  }
  if (value?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    throw new SubscriptionApiError("invalid_request", "POST requires Content-Type application/json.")
  }
}

async function requireEmptyDeleteBody(request: IncomingMessage): Promise<void> {
  const contentLength = request.headers["content-length"]
  if (hasMultipleHeaderValues(request, "content-length")) {
    request.destroy()
    throw new SubscriptionApiError("invalid_request", "DELETE requests must not include a request body.")
  }
  let bytes = 0
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    request.destroy()
  }, 1000)
  timeout.unref()
  try {
    for await (const chunk of request) {
      bytes += Buffer.isBuffer(chunk) ? chunk.byteLength : Buffer.byteLength(chunk)
      if (bytes > 1024) {
        request.destroy()
        throw new SubscriptionApiError("invalid_request", "DELETE requests must not include a request body.")
      }
    }
    if (bytes > 0 || (contentLength !== undefined && contentLength !== "0")) {
      throw new SubscriptionApiError("invalid_request", "DELETE requests must not include a request body.")
    }
  } catch (error) {
    if (error instanceof SubscriptionApiError) {
      throw error
    }
    if (timedOut) {
      throw new SubscriptionApiError("invalid_request", "DELETE request body did not finish promptly.")
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function hasMultipleHeaderValues(request: IncomingMessage, name: string): boolean {
  const distinct = request.headersDistinct[name]
  return Array.isArray(request.headers[name]) || (distinct !== undefined && distinct.length > 1)
}

function parseCreateSubscription(body: Readonly<Record<string, unknown>>): CreateSubscriptionInput {
  assertKnownFields(body, ["delivery", "eventTypes", "frequency", "name", "target", "timezone"])
  return {
    delivery: parseDelivery(body.delivery),
    eventTypes: parseEventTypes(body.eventTypes),
    frequency: enumValue(body.frequency, "frequency", ["daily", "hourly", "immediate"]),
    name: stringValue(body.name, "name"),
    target: parseTarget(body.target),
    timezone: stringValue(body.timezone, "timezone")
  }
}

function parseSubscriptionPatch(body: Readonly<Record<string, unknown>>): UpdateSubscriptionInput {
  assertKnownFields(body, ["delivery", "eventTypes", "frequency", "name", "status", "timezone"])
  const patch: UpdateSubscriptionInput = {
    ...(body.delivery === undefined ? {} : { delivery: parseDelivery(body.delivery) }),
    ...(body.eventTypes === undefined ? {} : { eventTypes: parseEventTypes(body.eventTypes) }),
    ...(body.frequency === undefined
      ? {}
      : { frequency: enumValue(body.frequency, "frequency", ["daily", "hourly", "immediate"]) }),
    ...(body.name === undefined ? {} : { name: stringValue(body.name, "name") }),
    ...(body.status === undefined ? {} : { status: enumValue(body.status, "status", ["active", "paused"]) }),
    ...(body.timezone === undefined ? {} : { timezone: stringValue(body.timezone, "timezone") })
  }
  return patch
}

function parseCreateWebhook(body: Readonly<Record<string, unknown>>): CreateWebhookInput {
  assertKnownFields(body, ["eventTypes", "name", "url"])
  return {
    eventTypes: parseEventTypes(body.eventTypes ?? []),
    name: stringValue(body.name, "name"),
    url: stringValue(body.url, "url")
  }
}

function parseWebhookPatch(body: Readonly<Record<string, unknown>>): UpdateWebhookInput {
  assertKnownFields(body, ["eventTypes", "name", "status", "url"])
  return {
    ...(body.eventTypes === undefined ? {} : { eventTypes: parseEventTypes(body.eventTypes) }),
    ...(body.name === undefined ? {} : { name: stringValue(body.name, "name") }),
    ...(body.status === undefined ? {} : { status: enumValue(body.status, "status", ["paused"]) }),
    ...(body.url === undefined ? {} : { url: stringValue(body.url, "url") })
  }
}

function parseEventTypes(value: unknown): readonly SubscriptionEventType[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || !subscriptionEvents.has(item as SubscriptionEventType))
  ) {
    throw new SubscriptionApiError("invalid_request", "eventTypes must contain only supported event types.")
  }
  return [...new Set(value)] as SubscriptionEventType[]
}

function parseDelivery(value: unknown): readonly SubscriptionDeliveryPreference[] {
  if (!Array.isArray(value)) {
    throw new SubscriptionApiError("invalid_request", "delivery must be an array.")
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new SubscriptionApiError("invalid_request", "Each delivery preference must be an object.")
    }
    const preference = item as Readonly<Record<string, unknown>>
    assertKnownFields(preference, ["channel", "destinationId", "isEnabled"])
    const channel = enumValue(preference.channel, "delivery.channel", ["email", "in-app", "webhook"])
    const isEnabled = preference.isEnabled
    if (typeof isEnabled !== "boolean") {
      throw new SubscriptionApiError("invalid_request", "delivery.isEnabled must be boolean.")
    }
    if (channel === "in-app") {
      return { channel, destinationId: null, isEnabled }
    }
    const destinationId = preference.destinationId
    if (destinationId !== null && typeof destinationId !== "string") {
      throw new SubscriptionApiError("invalid_request", "delivery.destinationId must be a string or null.")
    }
    if (channel === "webhook" && (typeof destinationId !== "string" || destinationId.length === 0)) {
      throw new SubscriptionApiError("invalid_request", "Webhook delivery requires a destinationId.")
    }
    return { channel, destinationId, isEnabled }
  }) as SubscriptionDeliveryPreference[]
}

function parseTarget(value: unknown): SubscriptionTarget {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SubscriptionApiError("invalid_request", "target must be an object.")
  }
  const target = value as Readonly<Record<string, unknown>>
  if (target.type === "record") {
    assertKnownFields(target, ["recordId", "recordType", "type"])
    return {
      recordId: stringValue(target.recordId, "target.recordId"),
      recordType: enumValue(target.recordType, "target.recordType", [
        "amendment",
        "bill",
        "calendar",
        "meeting",
        "organization",
        "person",
        "supporting-material"
      ]),
      type: "record"
    }
  }
  if (
    target.type === "query" &&
    typeof target.request === "object" &&
    target.request !== null &&
    !Array.isArray(target.request)
  ) {
    assertKnownFields(target, ["request", "searchType", "type"])
    return {
      request: target.request as Readonly<Record<string, unknown>>,
      searchType: enumValue(target.searchType, "target.searchType", [
        "all",
        "amendments",
        "bills",
        "passages",
        "supporting-materials"
      ]),
      type: "query"
    }
  }
  throw new SubscriptionApiError("invalid_request", "target must be a supported record or query target.")
}

function assertKnownFields(body: Readonly<Record<string, unknown>>, fields: readonly string[]): void {
  const allowed = new Set(fields)
  const unknown = Object.keys(body).find((field) => !allowed.has(field))
  if (unknown !== undefined) {
    throw new SubscriptionApiError("invalid_request", `Unknown field: ${unknown}.`)
  }
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SubscriptionApiError("invalid_request", `${field} must be a non-empty string.`)
  }
  return value.trim()
}

function enumValue<const Value extends string>(value: unknown, field: string, values: readonly Value[]): Value {
  if (typeof value !== "string" || !values.includes(value as Value)) {
    throw new SubscriptionApiError("invalid_request", `${field} is invalid.`)
  }
  return value as Value
}

function numberValue(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new SubscriptionApiError("invalid_request", `${field} must be an integer.`)
  }
  return value
}

function sendError(request: IncomingMessage, response: ServerResponse, error: unknown): void {
  let apiError: LegislationError
  if (error instanceof LegislationError) {
    apiError = error
  } else if (error instanceof SubscriptionApiError) {
    apiError = new LegislationError(error.category, error.message, { details: error.details })
  } else if (error instanceof SubscriptionRepositoryError) {
    apiError = repositoryError(error)
  } else if (error instanceof UnsafeWebhookUrlError) {
    apiError = new LegislationError("unprocessable", "Webhook URL does not resolve to a public delivery destination.")
  } else {
    apiError = new LegislationError("internal", "The request could not be completed")
  }
  sendApiError(request, response, apiError)
}

function repositoryError(error: SubscriptionRepositoryError): LegislationError {
  switch (error.category) {
    case "invalid_cursor":
      return new LegislationError("invalid_request", "Cursor is invalid for this request")
    case "conflict":
    case "idempotency_conflict":
      return new LegislationError("conflict", "The request conflicts with existing state", { details: error.details })
    case "invalid_persistence":
      return new LegislationError("internal", "The request could not be completed")
    default:
      return new LegislationError("internal", "The request could not be completed")
  }
}
