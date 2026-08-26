import { getRequestContext } from "../auth/request-context.js"
import { LegislationError } from "../legislation/errors.js"
import {
  assertAllowedQueryParameters,
  apiPage,
  apiResource,
  queryInteger,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"
import { SubscriptionRepositoryError } from "./subscription-repository.js"
import type { SubscriptionEventType, Webhook, WebhookStatus } from "./subscriptions.js"
import {
  assertWebhookReadModel,
  type WebhookReadListInput,
  type WebhookReadRepository
} from "./webhook-read-repository.js"

const eventTypes = new Set<SubscriptionEventType>([
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
const statuses = new Set<WebhookStatus>(["active", "cancelled", "paused", "pending-verification"])

export function createWebhookReadApiHandler(
  repository: WebhookReadRepository,
  options: Readonly<{ apiBaseUrl: string }>
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    const detail = /^\/api\/webhooks\/([^/]+)$/.exec(url.pathname)
    const collection = url.pathname === "/api/webhooks"
    if (request.method !== "GET" || (!collection && detail === null)) {
      return false
    }
    const identity = getRequestContext()?.identity
    if (identity === undefined) {
      sendApiError(request, response, new LegislationError("forbidden", "An authenticated identity is required."))
      return true
    }
    const owner = { organizationId: identity.organizationId ?? null, userId: identity.userId }
    try {
      if (collection) {
        const input = listInput(url)
        const page = await repository.listWebhooks({ ...input, owner })
        sendApiJson(response, 200, apiPage(request, projectPage(page, options), input.limit))
        return true
      }
      const id = pathId(detail![1]!)
      const webhook = await repository.getWebhook({ id, owner })
      if (webhook === undefined) {
        throw new LegislationError("not_found", "Webhook was not found.")
      }
      response.setHeader("etag", webhook.revision)
      sendApiJson(response, 200, apiResource(request, projectWebhook(webhook, options)))
      return true
    } catch (error) {
      sendApiError(request, response, safeError(error))
      return true
    }
  }
}

function listInput(url: URL): Omit<WebhookReadListInput, "owner"> {
  assertAllowedQueryParameters(url, ["cursor", "eventType", "limit", "status"])
  assertSingleQueryParameters(url, ["cursor", "eventType", "limit", "status"])
  return {
    cursor: singleOptional(url, "cursor"),
    eventType: enumQuery(url, "eventType", eventTypes),
    limit: queryInteger(url, "limit", 20),
    status: enumQuery(url, "status", statuses)
  }
}

function assertSingleQueryParameters(url: URL, names: readonly string[]): void {
  for (const name of names) {
    if (url.searchParams.getAll(name).length > 1) {
      throw new LegislationError("invalid_request", `${name} must appear once.`)
    }
  }
}

function enumQuery<Value extends string>(url: URL, name: string, values: ReadonlySet<Value>): Value | undefined {
  const value = singleOptional(url, name)
  if (value === undefined) {
    return undefined
  }
  if (!values.has(value as Value)) {
    throw new LegislationError("invalid_request", `${name} is invalid.`)
  }
  return value as Value
}

function singleOptional(url: URL, name: string): string | undefined {
  const values = url.searchParams.getAll(name)
  if (values.length === 0) {
    return undefined
  }
  if (values.length !== 1) {
    throw new LegislationError("invalid_request", `${name} must appear once.`)
  }
  const value = values[0]?.trim() ?? ""
  if (value.length === 0) {
    throw new LegislationError("invalid_request", `${name} must not be empty.`)
  }
  return value
}

function pathId(rawValue: string): string {
  let value: string
  try {
    value = decodeURIComponent(rawValue)
  } catch {
    throw new LegislationError("invalid_request", "webhookId is invalid.")
  }
  if (value.length === 0 || value.trim() !== value || [...value].length > 256) {
    throw new LegislationError("invalid_request", "webhookId is invalid.")
  }
  return value
}

function projectPage(
  page: Readonly<{ items: readonly Webhook[]; nextCursor?: string; truncated: boolean }>,
  options: Readonly<{ apiBaseUrl: string }>
) {
  return { ...page, items: page.items.map((webhook) => projectWebhook(webhook, options)) }
}

function projectWebhook(webhook: Webhook, options: Readonly<{ apiBaseUrl: string }>) {
  assertWebhookReadModel(webhook)
  return {
    ...webhook,
    canonicalUrl: new URL(`/api/webhooks/${encodeURIComponent(webhook.id)}`, options.apiBaseUrl).toString(),
    cancelledAt: timestamp(webhook.cancelledAt),
    createdAt: webhook.createdAt.toISOString(),
    lastFailedAt: timestamp(webhook.lastFailedAt),
    lastSucceededAt: timestamp(webhook.lastSucceededAt),
    overlapEndsAt: timestamp(webhook.overlapEndsAt),
    updatedAt: webhook.updatedAt.toISOString()
  }
}

function timestamp(value: Date | null): string | null {
  return value === null ? null : value.toISOString()
}

function safeError(error: unknown): LegislationError {
  if (error instanceof LegislationError) {
    return error
  }
  if (error instanceof SubscriptionRepositoryError && error.category === "invalid_cursor") {
    return new LegislationError("invalid_request", "Cursor is invalid for this request")
  }
  return new LegislationError("internal", "The request could not be completed")
}
