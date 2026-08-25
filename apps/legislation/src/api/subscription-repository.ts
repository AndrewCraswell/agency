import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto"
import { and, desc, eq, isNull, lt, lte, ne, or, sql } from "drizzle-orm"
import type { ExtractTablesWithRelations } from "drizzle-orm"
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres/session"
import type { PgTransaction } from "drizzle-orm/pg-core"
import type { LegislationDatabase } from "../db/database.js"
import * as schema from "../db/schema/schema.js"
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
  type UpdateSubscriptionInput
} from "./subscriptions.js"

type LegislationTransaction = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>
type DatabaseHandle = LegislationDatabase | LegislationTransaction

type SubscriptionRow = typeof schema.subscriptions.$inferSelect
type SubscriptionEventRow = typeof schema.subscriptionEvents.$inferSelect
type SubscriptionDeliveryRow = typeof schema.subscriptionDeliveries.$inferSelect

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

export class PostgresSubscriptionRepository implements SubscriptionRepository, SubscriptionEventWriter {
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
                  lt(schema.subscriptions.id, cursor.id)
                )
              )
        )
      )
      .orderBy(desc(schema.subscriptions.updatedAt), desc(schema.subscriptions.id))
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

  async transaction<T>(operation: (repository: PostgresSubscriptionRepository) => Promise<T>): Promise<T> {
    return await this.#database.transaction(async (transaction) => {
      return await operation(new PostgresSubscriptionRepository(transaction, this.#now))
    })
  }
}

export class SubscriptionIdempotencyTransaction implements SubscriptionMutationExecutor {
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
    validateIdempotencyRequest(request)
    const now = this.#now()
    const expiresAt = new Date(now.getTime() + (request.retentionMs ?? 24 * 60 * 60 * 1000))
    if (expiresAt <= now) {
      throw new SubscriptionRepositoryError("invalid_persistence", "Idempotency retention must be positive.")
    }
    return await this.#database.transaction(async (transaction) => {
      const repository = new PostgresSubscriptionRepository(transaction, this.#now)
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
      const existing = await transaction
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
      const stored = existing[0]
      if (stored !== undefined) {
        if (stored.requestHash !== request.requestHash) {
          throw new SubscriptionRepositoryError(
            "idempotency_conflict",
            "The idempotency key was already used with a different request.",
            { reason: "idempotency_key_reused" }
          )
        }
        return { replayed: true, response: await decryptResponse<T>(this.#cipher, stored) }
      }

      const response = await operation(repository)
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
      return { replayed: false, response }
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
