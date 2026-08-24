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
import { SubscriptionRepositoryError } from "./subscription-repository.js"
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
      const id = decodeURIComponent(match![1]!)
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
    const id = decodeURIComponent(subscriptionMatch[1]!)
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
  const revision = Array.isArray(value) ? value[0] : value
  if (revision === undefined || revision.length === 0) {
    throw new SubscriptionApiError("precondition_failed", "If-Match is required for this mutation.")
  }
  return revision
}

function requireIdempotencyKey(request: IncomingMessage): string {
  const value = request.headers["idempotency-key"]
  const key = Array.isArray(value) ? value[0] : value
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
  const contentType = Array.isArray(value) ? value[0] : value
  if (contentType?.split(";", 1)[0]?.trim().toLowerCase() !== "application/merge-patch+json") {
    throw new SubscriptionApiError("invalid_request", "PATCH requires Content-Type application/merge-patch+json.")
  }
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
    apiError = new LegislationError(error.category, error.message)
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
      return new LegislationError("conflict", "The request conflicts with existing state")
    case "invalid_persistence":
      return new LegislationError("internal", "The request could not be completed")
    default:
      return new LegislationError("internal", "The request could not be completed")
  }
}
