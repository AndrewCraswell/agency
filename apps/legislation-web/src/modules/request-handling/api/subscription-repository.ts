import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import * as schema from "@repo/legislation-core/database/schema/schema"
import { and, asc, desc, eq, gt, isNull, lt, lte, ne, or, sql } from "drizzle-orm"
import type { ExtractTablesWithRelations } from "drizzle-orm"
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres/session"
import type { PgTransaction } from "drizzle-orm/pg-core"
import {
  type Delivery,
  type RepositoryPage,
  type Subscription,
  type SubscriptionDeliveryListInput,
  type SubscriptionDeliveryPreference,
  type SubscriptionEvent,
  type SubscriptionEventListInput,
  type SubscriptionEventType,
  type SubscriptionListInput,
  type SubscriptionOwner,
  type SubscriptionRepository,
  type SubscriptionTarget,
  type UpdateSubscriptionInput,
  type UpdateWebhookInput,
  type Webhook,
  type WebhookRepository,
  type WebhookStatus,
  EncryptedWebhookSecret
} from "./subscriptions"

type LegislationTransaction = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>
type DatabaseHandle = LegislationDatabase | LegislationTransaction

type SubscriptionRow = typeof schema.subscriptions.$inferSelect
type SubscriptionEventRow = typeof schema.subscriptionEvents.$inferSelect
type SubscriptionDeliveryRow = typeof schema.subscriptionDeliveries.$inferSelect
type WebhookRow = typeof schema.webhooks.$inferSelect

const subscriptionEventTypes = new Set<SubscriptionEventType>([
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

const subscriptionRecordTypes = new Set([
  "amendment",
  "bill",
  "calendar",
  "meeting",
  "organization",
  "person",
  "supporting-material"
])

const subscriptionSearchTypes = new Set(["all", "amendments", "bills", "passages", "supporting-materials"])

const subscriptionFrequencies = new Set(["daily", "hourly", "immediate"])
const subscriptionStatuses = new Set(["active", "cancelled", "paused"])
const deliveryChannels = new Set(["email", "in-app", "webhook"])
const deliveryStatuses = new Set(["delivered", "failed", "pending", "processing", "suppressed"])

export class SubscriptionRepositoryError extends Error {
  readonly category: "conflict" | "invalid_cursor" | "invalid_persistence" | "idempotency_conflict"
  readonly details: Readonly<Record<string, unknown>> | undefined

  constructor(
    category: "conflict" | "invalid_cursor" | "invalid_persistence" | "idempotency_conflict",
    message: string,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(message)
    this.category = category
    this.details = details
    this.name = "SubscriptionRepositoryError"
  }
}

export type SubscriptionEventInput = Readonly<{
  changeEventId: string | null
  eventType: SubscriptionEventType
  id: string
  matchedAt?: Date
  occurredAt: Date
  recordId: string
  recordType: string
  sourceUrls: readonly string[]
  subscriptionId: string
  summary: string
  title: string
}>

export type SubscriptionDeliveryInput = Delivery

export type SubscriptionEventWriter = Readonly<{
  appendDelivery(input: SubscriptionDeliveryInput): Promise<Delivery>
  appendSubscriptionEvent(input: SubscriptionEventInput): Promise<SubscriptionEvent>
}>

export type EncryptedIdempotencyCipher = Readonly<{
  decrypt(ciphertext: string): Promise<string>
  encrypt(plaintext: string): Promise<string>
}>

export type IdempotencyRequest = Readonly<{
  canonicalPath: string
  key: string
  method: string
  principalScope: string
  requestHash: string
  retentionMs?: number
}>

export type IdempotentResponse<T> = Readonly<{
  body: T
  headers: Readonly<Record<string, string>>
  statusCode: number
}>

export type IdempotencyResult<T> = Readonly<{
  response: IdempotentResponse<T>
  replayed: boolean
}>

export type SubscriptionMutationExecutor = Readonly<{
  execute<T>(
    request: IdempotencyRequest,
    operation: (repository: SubscriptionTransaction) => Promise<IdempotentResponse<T>>
  ): Promise<IdempotencyResult<T>>
}>

/**
 * Performs an outbound preflight only after durable replay/conflict lookup.
 * It keeps the per-key advisory transaction lock through the bounded preflight
 * and mutation so concurrent callers cannot duplicate that side effect.
 */
export type PreflightSubscriptionMutationExecutor = SubscriptionMutationExecutor &
  Readonly<{
    executeWithPreflight<T, Preflight>(
      request: IdempotencyRequest,
      preflight: () => Promise<Preflight>,
      operation: (repository: SubscriptionTransaction, preflight: Preflight) => Promise<IdempotentResponse<T>>
    ): Promise<IdempotencyResult<T>>
  }>

export type SubscriptionTransaction = SubscriptionRepository & SubscriptionEventWriter

type IdempotencyRow = typeof schema.apiIdempotencyRecords.$inferSelect

type CursorKind = "deliveries" | "events" | "subscriptions"
type Cursor = Readonly<{
  filterFingerprint: string
  id: string
  kind: CursorKind
  owner: SubscriptionOwner
  timestamp: string
  version: 1
}>

export function principalScopeForSubscriptionOwner(owner: SubscriptionOwner): string {
  return createHash("sha256")
    .update(JSON.stringify({ organizationId: owner.organizationId, userId: owner.userId }))
    .digest("hex")
}

export function createEncryptedIdempotencyCipher(
  encrypt: (plaintext: string) => Promise<string>,
  decrypt: (ciphertext: string) => Promise<string>
): EncryptedIdempotencyCipher {
  return {
    decrypt,
    encrypt: async (plaintext) => {
      const ciphertext = await encrypt(plaintext)
      if (ciphertext.length === 0 || ciphertext === plaintext) {
        throw new Error("Idempotency response protection must return non-empty ciphertext distinct from plaintext.")
      }
      return ciphertext
    }
  }
}

const idempotencyCipherVersion = "v1"
const idempotencyCipherAad = Buffer.from("legislation:idempotency-response:v1", "utf8")

export function createAes256GcmIdempotencyCipher(key: Uint8Array): EncryptedIdempotencyCipher {
  const encryptionKey = Buffer.from(key)
  if (encryptionKey.byteLength !== 32) {
    throw new Error("Idempotency encryption key must contain exactly 32 bytes.")
  }
  return createEncryptedIdempotencyCipher(
    async (plaintext) => {
      const nonce = randomBytes(12)
      const cipher = createCipheriv("aes-256-gcm", encryptionKey, nonce)
      cipher.setAAD(idempotencyCipherAad)
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
      const tag = cipher.getAuthTag()
      return [
        idempotencyCipherVersion,
        nonce.toString("base64url"),
        tag.toString("base64url"),
        ciphertext.toString("base64url")
      ].join(".")
    },
    async (protectedValue) => {
      const [version, encodedNonce, encodedTag, encodedCiphertext, extra] = protectedValue.split(".")
      if (
        version !== idempotencyCipherVersion ||
        encodedNonce === undefined ||
        encodedTag === undefined ||
        encodedCiphertext === undefined ||
        extra !== undefined
      ) {
        throw new SubscriptionRepositoryError(
          "invalid_persistence",
          "Stored idempotency response has an invalid cipher format."
        )
      }
      const nonce = decodeBase64Url(encodedNonce, "nonce")
      const tag = decodeBase64Url(encodedTag, "authentication tag")
      const ciphertext = decodeBase64Url(encodedCiphertext, "ciphertext")
      if (nonce.byteLength !== 12 || tag.byteLength !== 16 || ciphertext.byteLength === 0) {
        throw new SubscriptionRepositoryError(
          "invalid_persistence",
          "Stored idempotency response has invalid cipher values."
        )
      }
      try {
        const decipher = createDecipheriv("aes-256-gcm", encryptionKey, nonce)
        decipher.setAAD(idempotencyCipherAad)
        decipher.setAuthTag(tag)
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
      } catch {
        throw new SubscriptionRepositoryError(
          "invalid_persistence",
          "Stored idempotency response could not be authenticated."
        )
      }
    }
  )
}

function decodeBase64Url(value: string, name: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new SubscriptionRepositoryError("invalid_persistence", `Stored idempotency ${name} is not base64url.`)
  }
  const decoded = Buffer.from(value, "base64url")
  if (decoded.byteLength === 0 || decoded.toString("base64url") !== value) {
    throw new SubscriptionRepositoryError(
      "invalid_persistence",
      `Stored idempotency ${name} is not canonical base64url.`
    )
  }
  return decoded
}

export class PostgresSubscriptionRepository
  implements SubscriptionRepository, SubscriptionEventWriter, WebhookRepository
{
  readonly #database: DatabaseHandle
  readonly #now: () => Date

  constructor(database: DatabaseHandle, now: () => Date = () => new Date()) {
    this.#database = database
    this.#now = now
  }

  async createSubscription(
    input: Readonly<{ fingerprint: string; subscription: Subscription }>
  ): Promise<Subscription> {
    try {
      const rows = await this.#database
        .insert(schema.subscriptions)
        .values({
          cancelledAt: input.subscription.cancelledAt,
          createdAt: input.subscription.createdAt,
          delivery: input.subscription.delivery.map(deliveryPreferenceToJson),
          eventTypes: [...input.subscription.eventTypes],
          frequency: input.subscription.frequency,
          id: input.subscription.id,
          name: input.subscription.name,
          ownerOrganizationId: input.subscription.owner.organizationId,
          ownerUserId: input.subscription.owner.userId,
          revision: input.subscription.revision,
          status: input.subscription.status,
          target: targetToJson(input.subscription.target),
          targetFingerprint: input.fingerprint,
          timezone: input.subscription.timezone,
          updatedAt: input.subscription.updatedAt
        })
        .returning()
      return toSubscription(requireRow(rows[0], "The subscription insert did not return a row."))
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new SubscriptionRepositoryError("conflict", "An identical active subscription already exists.")
      }
      throw error
    }
  }

  async findExactSubscription(owner: SubscriptionOwner, fingerprint: string): Promise<Subscription | undefined> {
    const rows = await this.#database
      .select()
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.ownerUserId, owner.userId),
          owner.organizationId === null
            ? isNull(schema.subscriptions.ownerOrganizationId)
            : eq(schema.subscriptions.ownerOrganizationId, owner.organizationId),
          eq(schema.subscriptions.targetFingerprint, fingerprint),
          ne(schema.subscriptions.status, "cancelled")
        )
      )
      .limit(1)
    return rows[0] === undefined ? undefined : toSubscription(rows[0])
  }

  async getSubscription(input: Readonly<{ id: string; owner: SubscriptionOwner }>): Promise<Subscription | undefined> {
    const rows = await this.#database
      .select()
      .from(schema.subscriptions)
      .where(and(eq(schema.subscriptions.id, input.id), ownerScope(schema.subscriptions, input.owner)))
      .limit(1)
    return rows[0] === undefined ? undefined : toSubscription(rows[0])
  }

  async listSubscriptions(input: SubscriptionListInput): Promise<RepositoryPage<Subscription>> {
    const limit = pageLimit(input.limit)
    const filterFingerprint = subscriptionFilterFingerprint(input)
    const cursor = decodeCursor(input.cursor, "subscriptions", input.owner, filterFingerprint)
    const rows = await this.#database
      .select()
      .from(schema.subscriptions)
      .where(
        and(
          ownerScope(schema.subscriptions, input.owner),
          input.status === undefined ? undefined : eq(schema.subscriptions.status, input.status),
          input.targetType === undefined
            ? undefined
            : sql<boolean>`${schema.subscriptions.target}->>'type' = ${input.targetType}`,
          input.recordType === undefined
            ? undefined
            : sql<boolean>`${schema.subscriptions.target}->>'recordType' = ${input.recordType}`,
          input.eventType === undefined
            ? undefined
            : sql<boolean>`${schema.subscriptions.eventTypes} @> ARRAY[${input.eventType}]::text[]`,
          input.channel === undefined
            ? undefined
            : sql<boolean>`exists (
                select 1
                from jsonb_array_elements(${schema.subscriptions.delivery}) as delivery_preference
                where delivery_preference->>'channel' = ${input.channel}
              )`,
          input.updatedFrom === undefined ? undefined : sql`${schema.subscriptions.updatedAt} >= ${input.updatedFrom}`,
          cursor === undefined
            ? undefined
            : or(
                lt(schema.subscriptions.updatedAt, new Date(cursor.timestamp)),
                and(
                  eq(schema.subscriptions.updatedAt, new Date(cursor.timestamp)),
                  gt(schema.subscriptions.id, cursor.id)
                )
              )
        )
      )
      .orderBy(desc(schema.subscriptions.updatedAt), asc(schema.subscriptions.id))
      .limit(limit + 1)
    const page = rows.slice(0, limit).map(toSubscription)
    const hasMore = rows.length > limit
    return {
      items: page,
      ...(hasMore && page.at(-1) !== undefined
        ? {
            nextCursor: encodeCursor({
              filterFingerprint,
              id: page.at(-1)!.id,
              kind: "subscriptions",
              owner: input.owner,
              timestamp: page.at(-1)!.updatedAt.toISOString(),
              version: 1
            })
          }
        : {}),
      truncated: hasMore
    }
  }

  async updateSubscription(
    input: Readonly<{
      id: string
      owner: SubscriptionOwner
      patch: UpdateSubscriptionInput
      revision: string
      when: Date
    }>
  ): Promise<Subscription | undefined> {
    const values: Partial<typeof schema.subscriptions.$inferInsert> = {
      revision: randomUUID(),
      updatedAt: input.when
    }
    if (input.patch.delivery !== undefined) {
      values.delivery = input.patch.delivery.map(deliveryPreferenceToJson)
    }
    if (input.patch.eventTypes !== undefined) {
      values.eventTypes = [...input.patch.eventTypes]
    }
    if (input.patch.frequency !== undefined) {
      values.frequency = input.patch.frequency
    }
    if (input.patch.name !== undefined) {
      values.name = input.patch.name.trim()
    }
    if (input.patch.status !== undefined) {
      values.status = input.patch.status
    }
    if (input.patch.timezone !== undefined) {
      values.timezone = input.patch.timezone
    }

    const rows = await this.#database
      .update(schema.subscriptions)
      .set(values)
      .where(
        and(
          eq(schema.subscriptions.id, input.id),
          ownerScope(schema.subscriptions, input.owner),
          eq(schema.subscriptions.revision, input.revision),
          ne(schema.subscriptions.status, "cancelled")
        )
      )
      .returning()
    return rows[0] === undefined ? undefined : toSubscription(rows[0])
  }

  async cancelSubscription(
    input: Readonly<{ id: string; owner: SubscriptionOwner; revision: string; when: Date }>
  ): Promise<Subscription | undefined> {
    const rows = await this.#database
      .update(schema.subscriptions)
      .set({ cancelledAt: input.when, revision: randomUUID(), status: "cancelled", updatedAt: input.when })
      .where(
        and(
          eq(schema.subscriptions.id, input.id),
          ownerScope(schema.subscriptions, input.owner),
          eq(schema.subscriptions.revision, input.revision),
          ne(schema.subscriptions.status, "cancelled")
        )
      )
      .returning()
    return rows[0] === undefined ? undefined : toSubscription(rows[0])
  }

  async listSubscriptionEvents(input: SubscriptionEventListInput): Promise<RepositoryPage<SubscriptionEvent>> {
    const limit = pageLimit(input.limit)
    const filterFingerprint = subscriptionEventFilterFingerprint(input)
    const cursor = decodeCursor(input.cursor, "events", input.owner, filterFingerprint)
    const rows = await this.#database
      .select({ event: schema.subscriptionEvents })
      .from(schema.subscriptionEvents)
      .innerJoin(schema.subscriptions, eq(schema.subscriptionEvents.subscriptionId, schema.subscriptions.id))
      .where(
        and(
          eq(schema.subscriptionEvents.subscriptionId, input.subscriptionId),
          ownerScope(schema.subscriptions, input.owner),
          input.eventType === undefined ? undefined : eq(schema.subscriptionEvents.eventType, input.eventType),
          input.recordType === undefined ? undefined : eq(schema.subscriptionEvents.recordType, input.recordType),
          input.recordId === undefined ? undefined : eq(schema.subscriptionEvents.recordId, input.recordId),
          input.from === undefined ? undefined : sql`${schema.subscriptionEvents.occurredAt} >= ${input.from}`,
          input.to === undefined ? undefined : sql`${schema.subscriptionEvents.occurredAt} <= ${input.to}`,
          cursor === undefined
            ? undefined
            : or(
                lt(schema.subscriptionEvents.matchedAt, new Date(cursor.timestamp)),
                and(
                  eq(schema.subscriptionEvents.matchedAt, new Date(cursor.timestamp)),
                  lt(schema.subscriptionEvents.id, cursor.id)
                )
              )
        )
      )
      .orderBy(desc(schema.subscriptionEvents.matchedAt), desc(schema.subscriptionEvents.id))
      .limit(limit + 1)
    const page = rows.slice(0, limit).map((row) => toSubscriptionEvent(row.event))
    const hasMore = rows.length > limit
    return {
      items: page,
      ...(hasMore && page.at(-1) !== undefined
        ? {
            nextCursor: encodeCursor({
              filterFingerprint,
              id: page.at(-1)!.id,
              kind: "events",
              owner: input.owner,
              timestamp: page.at(-1)!.matchedAt.toISOString(),
              version: 1
            })
          }
        : {}),
      truncated: hasMore
    }
  }

  async listDeliveries(input: SubscriptionDeliveryListInput): Promise<RepositoryPage<Delivery>> {
    const limit = pageLimit(input.limit)
    const filterFingerprint = subscriptionDeliveryFilterFingerprint(input)
    const cursor = decodeCursor(input.cursor, "deliveries", input.owner, filterFingerprint)
    const rows = await this.#database
      .select({ delivery: schema.subscriptionDeliveries })
      .from(schema.subscriptionDeliveries)
      .innerJoin(schema.subscriptions, eq(schema.subscriptionDeliveries.subscriptionId, schema.subscriptions.id))
      .where(
        and(
          eq(schema.subscriptionDeliveries.subscriptionId, input.subscriptionId),
          ownerScope(schema.subscriptions, input.owner),
          input.channel === undefined ? undefined : eq(schema.subscriptionDeliveries.channel, input.channel),
          input.status === undefined ? undefined : eq(schema.subscriptionDeliveries.status, input.status),
          input.from === undefined ? undefined : sql`${schema.subscriptionDeliveries.createdAt} >= ${input.from}`,
          input.to === undefined ? undefined : sql`${schema.subscriptionDeliveries.createdAt} <= ${input.to}`,
          cursor === undefined
            ? undefined
            : or(
                lt(schema.subscriptionDeliveries.createdAt, new Date(cursor.timestamp)),
                and(
                  eq(schema.subscriptionDeliveries.createdAt, new Date(cursor.timestamp)),
                  lt(schema.subscriptionDeliveries.id, cursor.id)
                )
              )
        )
      )
      .orderBy(desc(schema.subscriptionDeliveries.createdAt), desc(schema.subscriptionDeliveries.id))
      .limit(limit + 1)
    const page = rows.slice(0, limit).map((row) => toDelivery(row.delivery))
    const hasMore = rows.length > limit
    return {
      items: page,
      ...(hasMore && page.at(-1) !== undefined
        ? {
            nextCursor: encodeCursor({
              filterFingerprint,
              id: page.at(-1)!.id,
              kind: "deliveries",
              owner: input.owner,
              timestamp: page.at(-1)!.createdAt.toISOString(),
              version: 1
            })
          }
        : {}),
      truncated: hasMore
    }
  }

  async appendSubscriptionEvent(input: SubscriptionEventInput): Promise<SubscriptionEvent> {
    const rows = await this.#database
      .insert(schema.subscriptionEvents)
      .values({
        changeEventId: input.changeEventId,
        eventType: input.eventType,
        id: input.id,
        matchedAt: input.matchedAt ?? this.#now(),
        occurredAt: input.occurredAt,
        recordId: input.recordId,
        recordType: input.recordType,
        sourceUrls: [...input.sourceUrls],
        subscriptionId: input.subscriptionId,
        summary: input.summary,
        title: input.title
      })
      .returning()
    return toSubscriptionEvent(requireRow(rows[0], "The subscription event insert did not return a row."))
  }

  async appendDelivery(input: SubscriptionDeliveryInput): Promise<Delivery> {
    const rows = await this.#database
      .insert(schema.subscriptionDeliveries)
      .values({
        attemptCount: input.attemptCount,
        channel: input.channel,
        createdAt: input.createdAt,
        deliveredAt: input.deliveredAt,
        destinationId: input.destinationId,
        failureCategory: input.failureCategory,
        id: input.id,
        nextAttemptAt: input.nextAttemptAt,
        status: input.status,
        subscriptionEventIds: [...input.subscriptionEventIds],
        subscriptionId: input.subscriptionId
      })
      .returning()
    return toDelivery(requireRow(rows[0], "The subscription delivery insert did not return a row."))
  }

  async getWebhook(input: Readonly<{ id: string; owner: SubscriptionOwner }>): Promise<Webhook | undefined> {
    const rows = await this.#database
      .select()
      .from(schema.webhooks)
      .where(and(eq(schema.webhooks.id, input.id), webhookOwnerScope(input.owner)))
      .limit(1)
    const row = rows[0]
    return row === undefined ? undefined : await this.#toWebhook(row)
  }

  async listWebhooks(
    input: Readonly<{ cursor?: string; limit: number; owner: SubscriptionOwner }>
  ): Promise<RepositoryPage<Webhook>> {
    const limit = pageLimit(input.limit)
    const rows = await this.#database
      .select()
      .from(schema.webhooks)
      .where(webhookOwnerScope(input.owner))
      .orderBy(desc(schema.webhooks.updatedAt), desc(schema.webhooks.id))
      .limit(limit + 1)
    const visible = rows.slice(0, limit)
    return {
      items: await Promise.all(visible.map(async (row) => await this.#toWebhook(row))),
      truncated: rows.length > limit
    }
  }

  async createWebhook(
    input: Readonly<{ keyId: string; secretCiphertext: EncryptedWebhookSecret; webhook: Webhook }>
  ): Promise<Webhook> {
    const rows = await this.#database
      .insert(schema.webhooks)
      .values({
        cancelledAt: input.webhook.cancelledAt,
        createdAt: input.webhook.createdAt,
        eventTypes: [...input.webhook.eventTypes],
        id: input.webhook.id,
        lastFailedAt: input.webhook.lastFailedAt,
        lastSucceededAt: input.webhook.lastSucceededAt,
        name: input.webhook.name,
        overlapEndsAt: null,
        ownerOrganizationId: input.webhook.owner.organizationId,
        ownerUserId: input.webhook.owner.userId,
        revision: input.webhook.revision,
        secretLastFour: input.webhook.secretLastFour,
        status: input.webhook.status,
        updatedAt: input.webhook.updatedAt,
        url: input.webhook.url
      })
      .returning()
    const webhook = requireRow(rows[0], "The webhook insert did not return a row.")
    await this.#database.insert(schema.webhookSigningKeys).values({
      createdAt: input.webhook.createdAt,
      id: input.keyId,
      isActive: true,
      secretCiphertext: input.secretCiphertext.unwrapForPersistence(),
      webhookId: webhook.id
    })
    await this.#audit(webhook.id, input.webhook.owner, "created", input.webhook.createdAt, { keyId: input.keyId })
    return await this.#toWebhook(webhook)
  }

  async updateWebhook(
    input: Readonly<{ id: string; owner: SubscriptionOwner; patch: UpdateWebhookInput; revision: string; when: Date }>
  ): Promise<Webhook> {
    const values: Partial<typeof schema.webhooks.$inferInsert> = {
      revision: randomUUID(),
      updatedAt: input.when
    }
    if (input.patch.eventTypes !== undefined) {
      values.eventTypes = [...input.patch.eventTypes]
    }
    if (input.patch.name !== undefined) {
      values.name = input.patch.name.trim()
    }
    if (input.patch.status !== undefined) {
      values.status = input.patch.status
    }
    if (input.patch.url !== undefined) {
      values.status = "pending-verification"
      values.url = input.patch.url
    }
    const rows = await this.#database
      .update(schema.webhooks)
      .set(values)
      .where(
        and(
          eq(schema.webhooks.id, input.id),
          webhookOwnerScope(input.owner),
          eq(schema.webhooks.revision, input.revision),
          ne(schema.webhooks.status, "cancelled")
        )
      )
      .returning()
    const webhook = rows[0]
    if (webhook === undefined) {
      throw new SubscriptionRepositoryError("conflict", "Webhook update did not match a current row.")
    }
    await this.#audit(webhook.id, input.owner, "updated", input.when, {
      fields: Object.keys(input.patch).sort(),
      verificationReset: input.patch.url !== undefined
    })
    return await this.#toWebhook(webhook)
  }

  async cancelWebhook(
    input: Readonly<{ id: string; owner: SubscriptionOwner; revision: string; when: Date }>
  ): Promise<Webhook> {
    const rows = await this.#database
      .update(schema.webhooks)
      .set({ cancelledAt: input.when, revision: randomUUID(), status: "cancelled", updatedAt: input.when })
      .where(
        and(
          eq(schema.webhooks.id, input.id),
          webhookOwnerScope(input.owner),
          eq(schema.webhooks.revision, input.revision),
          ne(schema.webhooks.status, "cancelled")
        )
      )
      .returning()
    const webhook = rows[0]
    if (webhook === undefined) {
      throw new SubscriptionRepositoryError("conflict", "Webhook cancellation did not match a current row.")
    }
    await this.#database
      .update(schema.subscriptionDeliveries)
      .set({ failureCategory: "webhook_cancelled", nextAttemptAt: null, status: "suppressed" })
      .where(
        and(
          eq(schema.subscriptionDeliveries.channel, "webhook"),
          eq(schema.subscriptionDeliveries.destinationId, input.id),
          or(
            eq(schema.subscriptionDeliveries.status, "pending"),
            eq(schema.subscriptionDeliveries.status, "processing")
          )
        )
      )
    await this.#database.execute(sql`
      update ${schema.subscriptions}
      set delivery = (
        select jsonb_agg(
          case
            when preference->>'channel' = 'webhook' and preference->>'destinationId' = ${input.id}
            then jsonb_set(preference, '{isEnabled}', 'false'::jsonb)
            else preference
          end
        )
        from jsonb_array_elements(${schema.subscriptions.delivery}) as preference
      ), updated_at = ${input.when}, revision = gen_random_uuid()
      where exists (
        select 1 from jsonb_array_elements(${schema.subscriptions.delivery}) as preference
        where preference->>'channel' = 'webhook' and preference->>'destinationId' = ${input.id}
      )
    `)
    await this.#database
      .update(schema.webhookSigningKeys)
      .set({ expiresAt: input.when, isActive: false })
      .where(and(eq(schema.webhookSigningKeys.webhookId, input.id), eq(schema.webhookSigningKeys.isActive, true)))
    await this.#audit(webhook.id, input.owner, "cancelled", input.when, { linkedDeliveriesSuppressed: true })
    return await this.#toWebhook(webhook)
  }

  async rotateWebhookSecret(
    input: Readonly<{
      id: string
      keyId: string
      overlapEndsAt: Date | null
      owner: SubscriptionOwner
      revision: string
      secretCiphertext: EncryptedWebhookSecret
      secretLastFour: string
      when: Date
    }>
  ): Promise<Webhook> {
    const rows = await this.#database
      .update(schema.webhooks)
      .set({
        overlapEndsAt: input.overlapEndsAt,
        revision: randomUUID(),
        secretLastFour: input.secretLastFour,
        updatedAt: input.when
      })
      .where(
        and(
          eq(schema.webhooks.id, input.id),
          webhookOwnerScope(input.owner),
          eq(schema.webhooks.revision, input.revision),
          ne(schema.webhooks.status, "cancelled")
        )
      )
      .returning()
    const webhook = rows[0]
    if (webhook === undefined) {
      throw new SubscriptionRepositoryError("conflict", "Webhook rotation did not match a current row.")
    }
    if (input.overlapEndsAt === null) {
      await this.#database
        .update(schema.webhookSigningKeys)
        .set({ expiresAt: input.when, isActive: false })
        .where(and(eq(schema.webhookSigningKeys.webhookId, input.id), eq(schema.webhookSigningKeys.isActive, true)))
    } else {
      await this.#database.execute(sql`
        update ${schema.webhookSigningKeys}
        set expires_at = case
          when expires_at is null then ${input.overlapEndsAt}
          when expires_at < ${input.overlapEndsAt} then expires_at
          else ${input.overlapEndsAt}
        end
        where webhook_id = ${input.id} and is_active = true
      `)
    }
    await this.#database.insert(schema.webhookSigningKeys).values({
      createdAt: input.when,
      id: input.keyId,
      isActive: true,
      secretCiphertext: input.secretCiphertext.unwrapForPersistence(),
      webhookId: input.id
    })
    await this.#audit(webhook.id, input.owner, "secret_rotated", input.when, {
      keyId: input.keyId,
      overlapEndsAt: input.overlapEndsAt?.toISOString() ?? null
    })
    return await this.#toWebhook(webhook)
  }

  async activateWebhook(
    input: Readonly<{ id: string; owner: SubscriptionOwner; revision: string; when: Date }>
  ): Promise<Webhook> {
    const rows = await this.#database
      .update(schema.webhooks)
      .set({ revision: randomUUID(), status: "active", updatedAt: input.when })
      .where(
        and(
          eq(schema.webhooks.id, input.id),
          webhookOwnerScope(input.owner),
          eq(schema.webhooks.revision, input.revision),
          ne(schema.webhooks.status, "cancelled")
        )
      )
      .returning()
    const webhook = rows[0]
    if (webhook === undefined) {
      throw new SubscriptionRepositoryError("conflict", "Webhook activation did not match a current row.")
    }
    await this.#audit(webhook.id, input.owner, "verified", input.when, {})
    return await this.#toWebhook(webhook)
  }

  async activeSigningSecret(
    input: Readonly<{ id: string; owner: SubscriptionOwner }>
  ): Promise<EncryptedWebhookSecret | undefined> {
    const rows = await this.#database
      .select({ ciphertext: schema.webhookSigningKeys.secretCiphertext })
      .from(schema.webhookSigningKeys)
      .innerJoin(schema.webhooks, eq(schema.webhookSigningKeys.webhookId, schema.webhooks.id))
      .where(
        and(
          eq(schema.webhooks.id, input.id),
          webhookOwnerScope(input.owner),
          eq(schema.webhookSigningKeys.isActive, true),
          or(isNull(schema.webhookSigningKeys.expiresAt), gt(schema.webhookSigningKeys.expiresAt, this.#now()))
        )
      )
      .orderBy(desc(schema.webhookSigningKeys.createdAt), desc(schema.webhookSigningKeys.id))
      .limit(1)
    const row = rows[0]
    return row === undefined ? undefined : EncryptedWebhookSecret.fromPersistence(row.ciphertext)
  }

  async #toWebhook(row: WebhookRow): Promise<Webhook> {
    const keys = await this.#database
      .select({ id: schema.webhookSigningKeys.id })
      .from(schema.webhookSigningKeys)
      .where(
        and(
          eq(schema.webhookSigningKeys.webhookId, row.id),
          eq(schema.webhookSigningKeys.isActive, true),
          or(isNull(schema.webhookSigningKeys.expiresAt), gt(schema.webhookSigningKeys.expiresAt, this.#now()))
        )
      )
      .orderBy(asc(schema.webhookSigningKeys.createdAt), asc(schema.webhookSigningKeys.id))
    return {
      activeKeyIds: keys.map((key) => key.id),
      cancelledAt: row.cancelledAt,
      createdAt: row.createdAt,
      eventTypes: row.eventTypes.map((eventType) => parseEventType(eventType)),
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
  }

  async #audit(
    webhookId: string,
    owner: SubscriptionOwner,
    action: string,
    occurredAt: Date,
    details: Record<string, unknown>
  ): Promise<void> {
    await this.#database.insert(schema.webhookAuditRecords).values({
      action,
      actorOrganizationId: owner.organizationId,
      actorUserId: owner.userId,
      details,
      occurredAt,
      webhookId
    })
  }

  async transaction<T>(operation: (repository: PostgresSubscriptionRepository) => Promise<T>): Promise<T> {
    return await this.#database.transaction(async (transaction) => {
      return await operation(new PostgresSubscriptionRepository(transaction, this.#now))
    })
  }
}

export class SubscriptionIdempotencyTransaction implements PreflightSubscriptionMutationExecutor {
  readonly #database: LegislationDatabase
  readonly #cipher: EncryptedIdempotencyCipher
  readonly #now: () => Date

  constructor(database: LegislationDatabase, cipher: EncryptedIdempotencyCipher, now: () => Date = () => new Date()) {
    this.#database = database
    this.#cipher = cipher
    this.#now = now
  }

  async execute<T>(
    request: IdempotencyRequest,
    operation: (repository: SubscriptionTransaction) => Promise<IdempotentResponse<T>>
  ): Promise<IdempotencyResult<T>> {
    const { expiresAt, now } = this.#validatedTiming(request)
    return await this.#database.transaction(async (transaction) => {
      const replay = await this.#replay<T>(transaction, request, now)
      if (replay !== undefined) {
        return replay
      }
      const repository = new PostgresSubscriptionRepository(transaction, this.#now)
      const response = await operation(repository)
      await this.#store(transaction, request, expiresAt, response)
      return { replayed: false, response }
    })
  }

  async executeWithPreflight<T, Preflight>(
    request: IdempotencyRequest,
    preflight: () => Promise<Preflight>,
    operation: (repository: SubscriptionTransaction, preflight: Preflight) => Promise<IdempotentResponse<T>>
  ): Promise<IdempotencyResult<T>> {
    const { expiresAt, now } = this.#validatedTiming(request)
    return await this.#database.transaction(async (transaction) => {
      const replay = await this.#replay<T>(transaction, request, now)
      if (replay !== undefined) {
        return replay
      }
      const prepared = await preflight()
      const response = await operation(new PostgresSubscriptionRepository(transaction, this.#now), prepared)
      await this.#store(transaction, request, expiresAt, response)
      return { replayed: false, response }
    })
  }

  #validatedTiming(request: IdempotencyRequest): Readonly<{ expiresAt: Date; now: Date }> {
    validateIdempotencyRequest(request)
    const now = this.#now()
    const expiresAt = new Date(now.getTime() + (request.retentionMs ?? 24 * 60 * 60 * 1000))
    if (expiresAt <= now) {
      throw new SubscriptionRepositoryError("invalid_persistence", "Idempotency retention must be positive.")
    }
    return { expiresAt, now }
  }

  async #replay<T>(
    transaction: LegislationTransaction,
    request: IdempotencyRequest,
    now: Date
  ): Promise<IdempotencyResult<T> | undefined> {
    const lockKey = `${request.principalScope}:${request.method}:${request.canonicalPath}:${request.key}`
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`)
    await transaction
      .delete(schema.apiIdempotencyRecords)
      .where(
        and(
          eq(schema.apiIdempotencyRecords.principalScope, request.principalScope),
          eq(schema.apiIdempotencyRecords.method, request.method),
          eq(schema.apiIdempotencyRecords.canonicalPath, request.canonicalPath),
          eq(schema.apiIdempotencyRecords.key, request.key),
          lte(schema.apiIdempotencyRecords.expiresAt, now)
        )
      )
    const stored = (
      await transaction
        .select()
        .from(schema.apiIdempotencyRecords)
        .where(
          and(
            eq(schema.apiIdempotencyRecords.principalScope, request.principalScope),
            eq(schema.apiIdempotencyRecords.method, request.method),
            eq(schema.apiIdempotencyRecords.canonicalPath, request.canonicalPath),
            eq(schema.apiIdempotencyRecords.key, request.key)
          )
        )
        .limit(1)
    )[0]
    if (stored === undefined) {
      return undefined
    }
    if (stored.requestHash !== request.requestHash) {
      throw new SubscriptionRepositoryError(
        "idempotency_conflict",
        "The idempotency key was already used with a different request.",
        { reason: "idempotency_key_reused" }
      )
    }
    return { replayed: true, response: await decryptResponse<T>(this.#cipher, stored) }
  }

  async #store<T>(
    transaction: LegislationTransaction,
    request: IdempotencyRequest,
    expiresAt: Date,
    response: IdempotentResponse<T>
  ): Promise<void> {
    const responsePlaintext = JSON.stringify(response)
    const responseCiphertext = await this.#cipher.encrypt(responsePlaintext)
    if (responseCiphertext.length === 0 || responseCiphertext === responsePlaintext) {
      throw new Error("Idempotency response protection must return non-empty ciphertext distinct from plaintext.")
    }
    await transaction.insert(schema.apiIdempotencyRecords).values({
      canonicalPath: request.canonicalPath,
      expiresAt,
      key: request.key,
      method: request.method,
      principalScope: request.principalScope,
      requestHash: request.requestHash,
      responseCiphertext,
      responseHeaders: response.headers,
      statusCode: response.statusCode
    })
  }
}

async function decryptResponse<T>(
  cipher: EncryptedIdempotencyCipher,
  row: IdempotencyRow
): Promise<IdempotentResponse<T>> {
  const plaintext = await cipher.decrypt(row.responseCiphertext)
  let parsed: unknown
  try {
    parsed = JSON.parse(plaintext)
  } catch {
    throw new SubscriptionRepositoryError("invalid_persistence", "Stored idempotency response is not valid JSON.")
  }
  if (!isRecord(parsed) || typeof parsed.statusCode !== "number" || !isRecord(parsed.headers) || !("body" in parsed)) {
    throw new SubscriptionRepositoryError("invalid_persistence", "Stored idempotency response has an invalid shape.")
  }
  return {
    body: parsed.body as T,
    headers: stringRecord(parsed.headers),
    statusCode: parsed.statusCode
  }
}

function ownerScope(table: typeof schema.subscriptions, owner: SubscriptionOwner) {
  if (owner.organizationId === null) {
    return and(isNull(table.ownerOrganizationId), eq(table.ownerUserId, owner.userId))
  }
  return or(
    eq(table.ownerOrganizationId, owner.organizationId),
    and(isNull(table.ownerOrganizationId), eq(table.ownerUserId, owner.userId))
  )
}

function webhookOwnerScope(owner: SubscriptionOwner) {
  return owner.organizationId === null
    ? and(isNull(schema.webhooks.ownerOrganizationId), eq(schema.webhooks.ownerUserId, owner.userId))
    : or(
        eq(schema.webhooks.ownerOrganizationId, owner.organizationId),
        and(isNull(schema.webhooks.ownerOrganizationId), eq(schema.webhooks.ownerUserId, owner.userId))
      )
}

function pageLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new SubscriptionRepositoryError("invalid_persistence", "Page limit must be an integer from 1 through 100.")
  }
  return limit
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

function decodeCursor(
  value: string | undefined,
  kind: CursorKind,
  owner: SubscriptionOwner,
  filterFingerprint: string
): Cursor | undefined {
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
    !isRecord(parsed) ||
    parsed.version !== 1 ||
    parsed.kind !== kind ||
    parsed.filterFingerprint !== filterFingerprint ||
    typeof parsed.id !== "string" ||
    typeof parsed.timestamp !== "string" ||
    !isRecord(parsed.owner) ||
    parsed.owner.userId !== owner.userId ||
    parsed.owner.organizationId !== owner.organizationId ||
    Number.isNaN(new Date(parsed.timestamp).getTime())
  ) {
    throw new SubscriptionRepositoryError("invalid_cursor", "Cursor does not match this request scope.")
  }
  return {
    filterFingerprint,
    id: parsed.id,
    kind,
    owner,
    timestamp: parsed.timestamp,
    version: 1
  }
}

function subscriptionFilterFingerprint(input: SubscriptionListInput): string {
  return filterFingerprint({
    channel: input.channel ?? null,
    eventType: input.eventType ?? null,
    recordType: input.recordType ?? null,
    status: input.status ?? null,
    targetType: input.targetType ?? null,
    updatedFrom: timestampValue(input.updatedFrom)
  })
}

function subscriptionEventFilterFingerprint(input: SubscriptionEventListInput): string {
  return filterFingerprint({
    eventType: input.eventType ?? null,
    from: timestampValue(input.from),
    recordId: input.recordId ?? null,
    recordType: input.recordType ?? null,
    subscriptionId: input.subscriptionId,
    to: timestampValue(input.to)
  })
}

function subscriptionDeliveryFilterFingerprint(input: SubscriptionDeliveryListInput): string {
  return filterFingerprint({
    channel: input.channel ?? null,
    from: timestampValue(input.from),
    status: input.status ?? null,
    subscriptionId: input.subscriptionId,
    to: timestampValue(input.to)
  })
}

function filterFingerprint(filters: Readonly<Record<string, string | null>>): string {
  return createHash("sha256").update(JSON.stringify(filters)).digest("hex")
}

function timestampValue(value: Date | undefined): string | null {
  return value === undefined ? null : value.toISOString()
}

function validateIdempotencyRequest(request: IdempotencyRequest): void {
  if (!/^[0-9a-f]{64}$/.test(request.principalScope) || !/^[0-9a-f]{64}$/.test(request.requestHash)) {
    throw new SubscriptionRepositoryError(
      "invalid_persistence",
      "Idempotency scope and request hash must be SHA-256 hex."
    )
  }
  if (
    !/^[A-Z]+$/.test(request.method) ||
    request.canonicalPath.length === 0 ||
    !/^[\x20-\x7e]{8,128}$/.test(request.key)
  ) {
    throw new SubscriptionRepositoryError("invalid_persistence", "Idempotency request identity is invalid.")
  }
}

function targetToJson(target: SubscriptionTarget): Record<string, unknown> {
  if (target.type === "record") {
    return { recordId: target.recordId, recordType: target.recordType, type: target.type }
  }
  return { request: target.request, searchType: target.searchType, type: target.type }
}

function deliveryPreferenceToJson(preference: SubscriptionDeliveryPreference): Record<string, unknown> {
  return {
    channel: preference.channel,
    destinationId: preference.destinationId,
    isEnabled: preference.isEnabled
  }
}

function toSubscription(row: SubscriptionRow): Subscription {
  const target = parseTarget(row.target)
  const delivery = parseDelivery(row.delivery)
  if (!subscriptionFrequencies.has(row.frequency) || !subscriptionStatuses.has(row.status)) {
    throw new SubscriptionRepositoryError("invalid_persistence", `Subscription ${row.id} contains an invalid status.`)
  }
  const eventTypes = row.eventTypes.map(parseEventType)
  return {
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    delivery,
    eventTypes,
    frequency: row.frequency as Subscription["frequency"],
    id: row.id,
    name: row.name,
    owner: { organizationId: row.ownerOrganizationId, userId: row.ownerUserId },
    revision: row.revision,
    status: row.status as Subscription["status"],
    target,
    timezone: row.timezone,
    updatedAt: row.updatedAt
  }
}

function toSubscriptionEvent(row: SubscriptionEventRow): SubscriptionEvent {
  return {
    changeEventId: row.changeEventId,
    eventType: parseEventType(row.eventType),
    id: row.id,
    matchedAt: row.matchedAt,
    occurredAt: row.occurredAt,
    recordId: row.recordId,
    recordType: row.recordType,
    sourceUrls: [...row.sourceUrls],
    subscriptionId: row.subscriptionId,
    summary: row.summary,
    title: row.title
  }
}

function toDelivery(row: SubscriptionDeliveryRow): Delivery {
  if (!deliveryChannels.has(row.channel) || !deliveryStatuses.has(row.status)) {
    throw new SubscriptionRepositoryError("invalid_persistence", `Delivery ${row.id} contains an invalid enum.`)
  }
  return {
    attemptCount: row.attemptCount,
    channel: row.channel as Delivery["channel"],
    createdAt: row.createdAt,
    deliveredAt: row.deliveredAt,
    destinationId: row.destinationId,
    failureCategory: row.failureCategory,
    id: row.id,
    nextAttemptAt: row.nextAttemptAt,
    status: row.status as Delivery["status"],
    subscriptionEventIds: [...row.subscriptionEventIds],
    subscriptionId: row.subscriptionId
  }
}

function parseTarget(value: Record<string, unknown>): SubscriptionTarget {
  if (
    value.type === "record" &&
    typeof value.recordId === "string" &&
    typeof value.recordType === "string" &&
    subscriptionRecordTypes.has(value.recordType)
  ) {
    return {
      recordId: value.recordId,
      recordType: value.recordType as Extract<SubscriptionTarget, { type: "record" }>["recordType"],
      type: "record"
    }
  }
  if (
    value.type === "query" &&
    typeof value.searchType === "string" &&
    subscriptionSearchTypes.has(value.searchType) &&
    isRecord(value.request)
  ) {
    return {
      request: value.request,
      searchType: value.searchType as Extract<SubscriptionTarget, { type: "query" }>["searchType"],
      type: "query"
    }
  }
  throw new SubscriptionRepositoryError("invalid_persistence", "Subscription target is not canonical JSON.")
}

function parseDelivery(value: readonly Record<string, unknown>[]): readonly SubscriptionDeliveryPreference[] {
  return value.map((item) => {
    if (
      typeof item.channel !== "string" ||
      !deliveryChannels.has(item.channel) ||
      typeof item.isEnabled !== "boolean" ||
      (item.destinationId !== null && typeof item.destinationId !== "string")
    ) {
      throw new SubscriptionRepositoryError("invalid_persistence", "Subscription delivery is not canonical JSON.")
    }
    if (item.channel === "in-app" && item.destinationId !== null) {
      throw new SubscriptionRepositoryError("invalid_persistence", "In-app delivery must not have a destination.")
    }
    if (item.channel === "webhook" && (typeof item.destinationId !== "string" || item.destinationId.length === 0)) {
      throw new SubscriptionRepositoryError("invalid_persistence", "Webhook delivery must have a destination.")
    }
    return {
      channel: item.channel as SubscriptionDeliveryPreference["channel"],
      destinationId: item.destinationId as string | null,
      isEnabled: item.isEnabled
    } as SubscriptionDeliveryPreference
  })
}

function parseEventType(value: string): SubscriptionEventType {
  if (!subscriptionEventTypes.has(value as SubscriptionEventType)) {
    throw new SubscriptionRepositoryError("invalid_persistence", `Unsupported subscription event type: ${value}.`)
  }
  return value as SubscriptionEventType
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringRecord(value: Record<string, unknown>): Record<string, string> {
  const entries = Object.entries(value)
  if (entries.some(([, entry]) => typeof entry !== "string")) {
    throw new SubscriptionRepositoryError("invalid_persistence", "Stored idempotency headers are invalid.")
  }
  return Object.fromEntries(entries) as Record<string, string>
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (row === undefined) {
    throw new SubscriptionRepositoryError("invalid_persistence", message)
  }
  return row
}

function isUniqueViolation(error: unknown): boolean {
  return isRecord(error) && error.code === "23505"
}
