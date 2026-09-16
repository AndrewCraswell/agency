import { createHash } from "node:crypto"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import * as schema from "@repo/legislation-core/database/schema/schema"
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm"
import { isRfc3339Timestamp } from "./canonical-projection"
import { SubscriptionRepositoryError } from "./subscription-repository"
import type { RepositoryPage, SubscriptionEventType, SubscriptionOwner, Webhook, WebhookStatus } from "./subscriptions"

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

export type WebhookReadListInput = Readonly<{
  cursor?: string
  eventType?: SubscriptionEventType
  limit: number
  owner: SubscriptionOwner
  status?: WebhookStatus
}>

export type WebhookReadRepository = Readonly<{
  getWebhook(input: Readonly<{ id: string; owner: SubscriptionOwner }>): Promise<Webhook | undefined>
  listWebhooks(input: WebhookReadListInput): Promise<RepositoryPage<Webhook>>
}>

type WebhookRow = typeof schema.webhooks.$inferSelect

type WebhookCursor = Readonly<{
  filterFingerprint: string
  id: string
  owner: SubscriptionOwner
  timestamp: string
  version: 1
}>

/**
 * Read-only webhook persistence. It never selects signing-key ciphertext and
 * deliberately does not implement webhook mutations.
 */
export class PostgresWebhookReadRepository implements WebhookReadRepository {
  readonly #database: LegislationDatabase
  readonly #now: () => Date

  constructor(database: LegislationDatabase, now: () => Date = () => new Date()) {
    this.#database = database
    this.#now = now
  }

  async getWebhook(input: Readonly<{ id: string; owner: SubscriptionOwner }>): Promise<Webhook | undefined> {
    const rows = await this.#database
      .select()
      .from(schema.webhooks)
      .where(and(eq(schema.webhooks.id, input.id), ownerScope(input.owner)))
      .limit(1)
    const row = rows[0]
    if (row === undefined) {
      return undefined
    }
    const activeKeyIds = await this.#activeKeyIds([row.id])
    return toWebhook(row, parseWebhookEventTypes(row), activeKeyIds.get(row.id) ?? [])
  }

  async listWebhooks(input: WebhookReadListInput): Promise<RepositoryPage<Webhook>> {
    const limit = pageLimit(input.limit)
    const filterFingerprint = fingerprint(input)
    const cursor = decodeCursor(input.cursor, input.owner, filterFingerprint)
    const rows = await this.#database
      .select()
      .from(schema.webhooks)
      .where(
        and(
          ownerScope(input.owner),
          input.status === undefined ? undefined : eq(schema.webhooks.status, input.status),
          input.eventType === undefined
            ? undefined
            : sql<boolean>`${schema.webhooks.eventTypes} @> ARRAY[${input.eventType}]::text[]`,
          cursor === undefined
            ? undefined
            : or(
                lt(schema.webhooks.updatedAt, new Date(cursor.timestamp)),
                and(eq(schema.webhooks.updatedAt, new Date(cursor.timestamp)), lt(schema.webhooks.id, cursor.id))
              )
        )
      )
      .orderBy(desc(schema.webhooks.updatedAt), desc(schema.webhooks.id))
      .limit(limit + 1)
    const visibleRows = rows.slice(0, limit)
    const activeKeyIds = await this.#activeKeyIds(visibleRows.map((row) => row.id))
    const items = visibleRows.map((row) => toWebhook(row, parseWebhookEventTypes(row), activeKeyIds.get(row.id) ?? []))
    const last = visibleRows.at(-1)
    const truncated = rows.length > limit
    return {
      items,
      ...(truncated && last !== undefined
        ? {
            nextCursor: encodeCursor({
              filterFingerprint,
              id: last.id,
              owner: input.owner,
              timestamp: last.updatedAt.toISOString(),
              version: 1
            })
          }
        : {}),
      truncated
    }
  }

  async #activeKeyIds(webhookIds: readonly string[]): Promise<Map<string, readonly string[]>> {
    if (webhookIds.length === 0) {
      return new Map()
    }
    const rows = await this.#database
      .select({ id: schema.webhookSigningKeys.id, webhookId: schema.webhookSigningKeys.webhookId })
      .from(schema.webhookSigningKeys)
      .where(
        and(
          inArray(schema.webhookSigningKeys.webhookId, webhookIds),
          eq(schema.webhookSigningKeys.isActive, true),
          or(isNull(schema.webhookSigningKeys.expiresAt), gt(schema.webhookSigningKeys.expiresAt, this.#now()))
        )
      )
      .orderBy(asc(schema.webhookSigningKeys.createdAt), asc(schema.webhookSigningKeys.id))
    const result = new Map<string, string[]>()
    for (const row of rows) {
      const ids = result.get(row.webhookId) ?? []
      ids.push(row.id)
      result.set(row.webhookId, ids)
    }
    return result
  }
}

function ownerScope(owner: SubscriptionOwner) {
  return owner.organizationId === null
    ? and(isNull(schema.webhooks.ownerOrganizationId), eq(schema.webhooks.ownerUserId, owner.userId))
    : or(
        eq(schema.webhooks.ownerOrganizationId, owner.organizationId),
        and(isNull(schema.webhooks.ownerOrganizationId), eq(schema.webhooks.ownerUserId, owner.userId))
      )
}

function toWebhook(
  row: WebhookRow,
  parsedEventTypes: readonly SubscriptionEventType[],
  activeKeyIds: readonly string[]
): Webhook {
  const webhook: Webhook = {
    activeKeyIds,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    eventTypes: parsedEventTypes,
    id: row.id,
    lastFailedAt: row.lastFailedAt,
    lastSucceededAt: row.lastSucceededAt,
    name: row.name,
    overlapEndsAt: row.overlapEndsAt,
    owner: { organizationId: row.ownerOrganizationId, userId: row.ownerUserId },
    revision: row.revision,
    secretLastFour: row.secretLastFour,
    status: row.status as WebhookStatus,
    updatedAt: row.updatedAt,
    url: row.url
  }
  assertWebhookReadModel(webhook)
  return webhook
}

export function assertWebhookReadModel(webhook: Webhook): void {
  if (webhook.id.length === 0 || webhook.id.trim() !== webhook.id || [...webhook.id].length > 256) {
    throw invalidWebhook(webhook.id, "identifier")
  }
  if (webhook.owner.userId.length === 0 || webhook.owner.userId.trim() !== webhook.owner.userId) {
    throw invalidWebhook(webhook.id, "owner")
  }
  if (
    webhook.owner.organizationId !== null &&
    (webhook.owner.organizationId.length === 0 || webhook.owner.organizationId.trim() !== webhook.owner.organizationId)
  ) {
    throw invalidWebhook(webhook.id, "owner")
  }
  if (webhook.name.length === 0 || webhook.name.trim() !== webhook.name || [...webhook.name].length > 120) {
    throw invalidWebhook(webhook.id, "name")
  }
  validateWebhookUrl(webhook)
  if (new Set(webhook.eventTypes).size !== webhook.eventTypes.length) {
    throw invalidWebhook(webhook.id, "event types")
  }
  for (const eventType of webhook.eventTypes) {
    parseEventType(eventType, webhook.id)
  }
  if (!statuses.has(webhook.status) || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(webhook.revision)) {
    throw invalidWebhook(webhook.id, "status or revision")
  }
  if (!/^[A-Za-z0-9_-]{4}$/.test(webhook.secretLastFour)) {
    throw invalidWebhook(webhook.id, "secret suffix")
  }
  if (new Set(webhook.activeKeyIds).size !== webhook.activeKeyIds.length || webhook.activeKeyIds.some(isBlank)) {
    throw invalidWebhook(webhook.id, "active signing keys")
  }
  if ((webhook.status === "active" || webhook.status === "paused") && webhook.activeKeyIds.length === 0) {
    throw invalidWebhook(webhook.id, "active signing keys")
  }
  for (const timestamp of [
    webhook.cancelledAt,
    webhook.createdAt,
    webhook.lastFailedAt,
    webhook.lastSucceededAt,
    webhook.overlapEndsAt,
    webhook.updatedAt
  ]) {
    if (!isValidDate(timestamp)) {
      throw invalidWebhook(webhook.id, "timestamps")
    }
  }
  if (webhook.createdAt > webhook.updatedAt) {
    throw invalidWebhook(webhook.id, "timestamps")
  }
  if ((webhook.status === "cancelled") !== (webhook.cancelledAt !== null)) {
    throw invalidWebhook(webhook.id, "cancellation state")
  }
}

function validateWebhookUrl(webhook: Webhook): void {
  let url: URL
  try {
    url = new URL(webhook.url)
  } catch {
    throw invalidWebhook(webhook.id, "URL")
  }
  if (
    webhook.url.length > 2048 ||
    webhook.url.trim() !== webhook.url ||
    url.protocol !== "https:" ||
    url.hostname.length === 0 ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    throw invalidWebhook(webhook.id, "URL")
  }
}

function isBlank(value: string): boolean {
  return value.length === 0 || value.trim() !== value
}

function isValidDate(value: Date | null): boolean {
  return value === null || (value instanceof Date && !Number.isNaN(value.getTime()))
}

function invalidWebhook(id: string, field: string): SubscriptionRepositoryError {
  return new SubscriptionRepositoryError("invalid_persistence", `Webhook ${id} contains invalid ${field}.`)
}

function parseWebhookEventTypes(row: WebhookRow): readonly SubscriptionEventType[] {
  if (!statuses.has(row.status as WebhookStatus)) {
    throw new SubscriptionRepositoryError("invalid_persistence", `Webhook ${row.id} has an invalid status.`)
  }
  return row.eventTypes.map((eventType) => parseEventType(eventType, row.id))
}

function parseEventType(value: string, webhookId: string): SubscriptionEventType {
  if (!eventTypes.has(value as SubscriptionEventType)) {
    throw new SubscriptionRepositoryError(
      "invalid_persistence",
      `Webhook ${webhookId} contains an unsupported event type.`
    )
  }
  return value as SubscriptionEventType
}

function pageLimit(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new SubscriptionRepositoryError("invalid_persistence", "Page limit must be an integer from 1 through 100.")
  }
  return limit
}

function fingerprint(input: WebhookReadListInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        eventType: input.eventType ?? null,
        owner: input.owner,
        status: input.status ?? null
      })
    )
    .digest("hex")
}

function encodeCursor(cursor: WebhookCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

function decodeCursor(
  value: string | undefined,
  owner: SubscriptionOwner,
  filterFingerprint: string
): WebhookCursor | undefined {
  if (value === undefined) {
    return undefined
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
  } catch {
    throw new SubscriptionRepositoryError("invalid_cursor", "Cursor is not valid base64url JSON.")
  }
  if (
    !isWebhookCursor(parsed) ||
    parsed.filterFingerprint !== filterFingerprint ||
    parsed.owner.userId !== owner.userId ||
    parsed.owner.organizationId !== owner.organizationId ||
    !isRfc3339Timestamp(parsed.timestamp)
  ) {
    throw new SubscriptionRepositoryError("invalid_cursor", "Cursor does not match this request scope.")
  }
  return parsed
}

function isWebhookCursor(value: unknown): value is WebhookCursor {
  if (!isRecord(value) || value.version !== 1 || typeof value.id !== "string" || typeof value.timestamp !== "string") {
    return false
  }
  if (typeof value.filterFingerprint !== "string" || !isRecord(value.owner)) {
    return false
  }
  return (
    typeof value.owner.userId === "string" &&
    (typeof value.owner.organizationId === "string" || value.owner.organizationId === null)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
