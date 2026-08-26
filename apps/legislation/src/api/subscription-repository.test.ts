import { createHash } from "node:crypto"
import { resolve } from "node:path"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import * as schema from "../db/schema/schema.js"
import {
  createAes256GcmIdempotencyCipher,
  principalScopeForSubscriptionOwner,
  createEncryptedIdempotencyCipher,
  PostgresSubscriptionRepository,
  SubscriptionIdempotencyTransaction,
  type SubscriptionTransaction
} from "./subscription-repository.js"
import {
  createWebhookSecretProtector,
  SubscriptionService,
  type Subscription,
  type SubscriptionOwner
} from "./subscriptions.js"

const databaseUrl = process.env.LEGISLATION_TEST_DATABASE_URL
const describePostgres = databaseUrl === undefined ? describe.skip : describe
const migrationsFolder = resolve(process.cwd(), "src/db/migrations")
const fixedNow = new Date("2026-08-24T12:00:00.000Z")

function owner(userId: string, organizationId: string | null): SubscriptionOwner {
  return { organizationId, userId }
}

function subscription(id: string, subscriptionOwner: SubscriptionOwner, revision: string): Subscription {
  return {
    cancelledAt: null,
    createdAt: fixedNow,
    delivery: [{ channel: "in-app", destinationId: null, isEnabled: true }],
    eventTypes: ["record-updated"],
    frequency: "immediate",
    id,
    name: id,
    owner: subscriptionOwner,
    revision,
    status: "active",
    target: { recordId: "bill:us:119:hr:1", recordType: "bill", type: "record" },
    timezone: "America/Los_Angeles",
    updatedAt: fixedNow
  }
}

describe("subscription repository primitives", () => {
  it("derives a stable scope that separates organization and personal ownership", () => {
    const organizationOwner = owner("user:one", "org:one")
    expect(principalScopeForSubscriptionOwner(organizationOwner)).toHaveLength(64)
    expect(principalScopeForSubscriptionOwner(organizationOwner)).toBe(
      principalScopeForSubscriptionOwner(organizationOwner)
    )
    expect(
      principalScopeForSubscriptionOwner(organizationOwner) ===
        principalScopeForSubscriptionOwner(owner("user:one", null))
    ).toBe(false)
  })

  it("rejects an idempotency cipher that would persist plaintext", async () => {
    const cipher = createEncryptedIdempotencyCipher(
      async (plaintext) => plaintext,
      async (ciphertext) => ciphertext
    )
    await expect(cipher.encrypt("response")).rejects.toThrow("distinct from plaintext")
  })

  it("protects idempotency responses with versioned authenticated AES-256-GCM ciphertext", async () => {
    const cipher = createAes256GcmIdempotencyCipher(Buffer.alloc(32, 7))
    const encrypted = await cipher.encrypt('{"response":"protected"}')

    expect(encrypted).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    await expect(cipher.decrypt(encrypted)).resolves.toBe('{"response":"protected"}')
    const replacement = encrypted.endsWith("A") ? "B" : "A"
    await expect(cipher.decrypt(`${encrypted.slice(0, -1)}${replacement}`)).rejects.toMatchObject({
      category: "invalid_persistence"
    })
    expect(() => createAes256GcmIdempotencyCipher(Buffer.alloc(31))).toThrow("exactly 32 bytes")
  })
})

describePostgres.sequential("PostgreSQL subscription repository", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 })
  const database = drizzle(pool, { schema })

  beforeAll(async () => {
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")
    await migrate(database, {
      migrationsFolder,
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
  })

  afterAll(async () => {
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")
    await pool.end()
  })

  it("enforces organization sharing, personal isolation, revisions, keyset pages, and event delivery reads", async () => {
    const repository = new PostgresSubscriptionRepository(database, () => fixedNow)
    const sharedOwner = owner("user:one", "org:one")
    const sharedRevision = "00000000-0000-0000-0000-000000000001"
    const personalOwner = owner("user:one", null)
    const personalRevision = "00000000-0000-0000-0000-000000000002"
    const shared = await repository.createSubscription({
      fingerprint: "a".repeat(64),
      subscription: subscription("subscription:shared", sharedOwner, sharedRevision)
    })
    await repository.createSubscription({
      fingerprint: "b".repeat(64),
      subscription: subscription("subscription:personal", personalOwner, personalRevision)
    })
    await repository.createSubscription({
      fingerprint: "c".repeat(64),
      subscription: subscription(
        "subscription:shared-two",
        owner("user:two", "org:one"),
        "00000000-0000-0000-0000-000000000005"
      )
    })

    await expect(
      repository.getSubscription({ id: shared.id, owner: owner("user:two", "org:one") })
    ).resolves.toMatchObject({ id: shared.id })
    await expect(
      repository.getSubscription({ id: "subscription:personal", owner: owner("user:two", "org:one") })
    ).resolves.toBeUndefined()

    const firstPage = await repository.listSubscriptions({ owner: owner("user:two", "org:one"), limit: 1 })
    expect(firstPage.items).toMatchObject([{ id: "subscription:shared" }])
    expect(firstPage.nextCursor).toBeDefined()
    await expect(
      repository.listSubscriptions({ cursor: firstPage.nextCursor, owner: owner("user:two", "org:one"), limit: 1 })
    ).resolves.toMatchObject({ items: [{ id: "subscription:shared-two" }], truncated: false })
    await expect(
      repository.listSubscriptions({
        cursor: firstPage.nextCursor,
        owner: owner("user:two", "org:one"),
        limit: 1,
        status: "paused"
      })
    ).rejects.toMatchObject({ category: "invalid_cursor" })
    await expect(
      repository.listSubscriptions({ cursor: firstPage.nextCursor, owner: owner("user:two", "org:two"), limit: 1 })
    ).rejects.toMatchObject({ category: "invalid_cursor" })

    const updated = await repository.updateSubscription({
      id: shared.id,
      owner: owner("user:two", "org:one"),
      patch: { name: "Updated shared subscription" },
      revision: shared.revision,
      when: new Date(fixedNow.getTime() + 1000)
    })
    expect(updated).toMatchObject({ name: "Updated shared subscription" })
    await expect(
      repository.updateSubscription({
        id: shared.id,
        owner: owner("user:two", "org:one"),
        patch: { name: "Stale" },
        revision: shared.revision,
        when: fixedNow
      })
    ).resolves.toBeUndefined()

    await repository.appendSubscriptionEvent({
      changeEventId: null,
      eventType: "record-updated",
      id: "subscription-event:shared:1",
      occurredAt: fixedNow,
      recordId: "bill:us:119:hr:1",
      recordType: "bill",
      sourceUrls: ["https://example.test/bill"],
      subscriptionId: shared.id,
      summary: "A bill changed",
      title: "Bill updated"
    })
    await repository.appendSubscriptionEvent({
      changeEventId: null,
      eventType: "status-changed",
      id: "subscription-event:shared:2",
      occurredAt: new Date(fixedNow.getTime() + 1000),
      recordId: "bill:us:119:hr:1",
      recordType: "bill",
      sourceUrls: ["https://example.test/bill"],
      subscriptionId: shared.id,
      summary: "A bill status changed",
      title: "Bill status changed"
    })
    await repository.appendDelivery({
      attemptCount: 0,
      channel: "in-app",
      createdAt: fixedNow,
      deliveredAt: null,
      destinationId: null,
      failureCategory: null,
      id: "delivery:shared:1",
      nextAttemptAt: null,
      status: "pending",
      subscriptionEventIds: ["subscription-event:shared:1"],
      subscriptionId: shared.id
    })
    await repository.appendDelivery({
      attemptCount: 1,
      channel: "in-app",
      createdAt: new Date(fixedNow.getTime() + 1000),
      deliveredAt: new Date(fixedNow.getTime() + 1000),
      destinationId: null,
      failureCategory: null,
      id: "delivery:shared:2",
      nextAttemptAt: null,
      status: "delivered",
      subscriptionEventIds: ["subscription-event:shared:2"],
      subscriptionId: shared.id
    })
    const allEvents = await repository.listSubscriptionEvents({
      owner: owner("user:two", "org:one"),
      subscriptionId: shared.id,
      limit: 20
    })
    expect(allEvents).toMatchObject({ truncated: false })
    expect(allEvents.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "subscription-event:shared:1" })])
    )
    const allDeliveries = await repository.listDeliveries({
      owner: owner("user:two", "org:one"),
      subscriptionId: shared.id,
      limit: 20
    })
    expect(allDeliveries).toMatchObject({ truncated: false })
    expect(allDeliveries.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: "delivery:shared:1" })]))
    const eventPage = await repository.listSubscriptionEvents({
      owner: owner("user:two", "org:one"),
      subscriptionId: shared.id,
      limit: 1
    })
    await expect(
      repository.listSubscriptionEvents({
        cursor: eventPage.nextCursor,
        eventType: "record-updated",
        owner: owner("user:two", "org:one"),
        subscriptionId: shared.id,
        limit: 1
      })
    ).rejects.toMatchObject({ category: "invalid_cursor" })
    const deliveryPage = await repository.listDeliveries({
      owner: owner("user:two", "org:one"),
      subscriptionId: shared.id,
      limit: 1
    })
    await expect(
      repository.listDeliveries({
        cursor: deliveryPage.nextCursor,
        owner: owner("user:two", "org:one"),
        status: "pending",
        subscriptionId: shared.id,
        limit: 1
      })
    ).rejects.toMatchObject({ category: "invalid_cursor" })
  })

  it("replays an encrypted idempotent response and rolls back mutation work on failure", async () => {
    const repository = new PostgresSubscriptionRepository(database, () => fixedNow)
    const cipher = createEncryptedIdempotencyCipher(
      async (plaintext) => Buffer.from(plaintext, "utf8").toString("base64url"),
      async (ciphertext) => Buffer.from(ciphertext, "base64url").toString("utf8")
    )
    const executor = new SubscriptionIdempotencyTransaction(database, cipher, () => fixedNow)
    const request = {
      canonicalPath: "/api/subscriptions",
      key: "replay-key",
      method: "POST",
      principalScope: principalScopeForSubscriptionOwner(owner("user:one", "org:one")),
      requestHash: "c".repeat(64)
    }
    const first = await executor.execute(request, async (transactionRepository) => {
      const created = await transactionRepository.createSubscription({
        fingerprint: "d".repeat(64),
        subscription: subscription(
          "subscription:replayed",
          owner("user:one", "org:one"),
          "00000000-0000-0000-0000-000000000003"
        )
      })
      await transactionRepository.appendSubscriptionEvent({
        changeEventId: null,
        eventType: "record-created",
        id: "subscription-event:replayed:1",
        occurredAt: fixedNow,
        recordId: created.id,
        recordType: "subscription",
        sourceUrls: [],
        subscriptionId: created.id,
        summary: "Subscription created",
        title: "Subscription created"
      })
      return {
        body: { data: { id: created.id }, links: { self: "/api/subscriptions" } },
        headers: {
          etag: created.revision,
          location: `/api/subscriptions/${encodeURIComponent(created.id)}`
        },
        statusCode: 201
      }
    })
    expect(first).toEqual({
      replayed: false,
      response: {
        body: { data: { id: "subscription:replayed" }, links: { self: "/api/subscriptions" } },
        headers: {
          etag: "00000000-0000-0000-0000-000000000003",
          location: "/api/subscriptions/subscription%3Areplayed"
        },
        statusCode: 201
      }
    })

    await expect(
      executor.execute(request, async () => {
        throw new Error("replay must not execute the mutation")
      })
    ).resolves.toEqual({ ...first, replayed: true })

    await expect(
      executor.execute({ ...request, requestHash: "a".repeat(64) }, async () => {
        throw new Error("conflicting idempotency key must not execute the mutation")
      })
    ).rejects.toMatchObject({
      category: "idempotency_conflict",
      details: { reason: "idempotency_key_reused" }
    })

    const isolatedOwner = owner("user:two", "org:one")
    await expect(
      executor.execute({ ...request, principalScope: principalScopeForSubscriptionOwner(isolatedOwner) }, async () => ({
        body: { owner: isolatedOwner.userId },
        headers: {},
        statusCode: 201
      }))
    ).resolves.toEqual({
      replayed: false,
      response: { body: { owner: "user:two" }, headers: {}, statusCode: 201 }
    })

    const staleSubscription = await repository.createSubscription({
      fingerprint: "9".repeat(64),
      subscription: subscription(
        "subscription:stale-revision",
        owner("user:one", "org:one"),
        "00000000-0000-0000-0000-000000000006"
      )
    })
    const staleService = (transactionRepository: SubscriptionTransaction) =>
      new SubscriptionService(
        transactionRepository,
        createWebhookSecretProtector(async (plaintext) => `encrypted:${plaintext}`),
        () => fixedNow
      )
    const updateRequest = {
      canonicalPath: `/api/subscriptions/${encodeURIComponent(staleSubscription.id)}`,
      key: "current-revision-key",
      method: "PATCH",
      principalScope: principalScopeForSubscriptionOwner(staleSubscription.owner),
      requestHash: "1".repeat(64)
    }
    await executor.execute(updateRequest, async (transactionRepository) => {
      const updated = await staleService(transactionRepository).updateSubscription(
        { organizationId: "org:one", userId: "user:one" },
        staleSubscription.id,
        staleSubscription.revision,
        { name: "Current revision" }
      )
      return { body: { id: updated.id }, headers: { etag: updated.revision }, statusCode: 200 }
    })
    await expect(
      executor.execute(
        { ...updateRequest, key: "stale-revision-key", requestHash: "2".repeat(64) },
        async (transactionRepository) => {
          await staleService(transactionRepository).updateSubscription(
            { organizationId: "org:one", userId: "user:one" },
            staleSubscription.id,
            staleSubscription.revision,
            { name: "Stale revision" }
          )
          return { body: {}, headers: {}, statusCode: 200 }
        }
      )
    ).rejects.toMatchObject({ category: "precondition_failed" })

    const failingRequest = { ...request, key: "rollback-key", requestHash: "e".repeat(64) }
    await expect(
      executor.execute(failingRequest, async (transactionRepository) => {
        await transactionRepository.createSubscription({
          fingerprint: "f".repeat(64),
          subscription: subscription(
            "subscription:rolled-back",
            owner("user:one", "org:one"),
            "00000000-0000-0000-0000-000000000004"
          )
        })
        throw new Error("controlled rollback")
      })
    ).rejects.toThrow("controlled rollback")
    await expect(
      repository.getSubscription({ id: "subscription:rolled-back", owner: owner("user:one", "org:one") })
    ).resolves.toBeUndefined()
  })

  it("checks durable idempotency before a verification preflight", async () => {
    const cipher = createEncryptedIdempotencyCipher(
      async (plaintext) => Buffer.from(plaintext, "utf8").toString("base64url"),
      async (ciphertext) => Buffer.from(ciphertext, "base64url").toString("utf8")
    )
    const executor = new SubscriptionIdempotencyTransaction(database, cipher, () => fixedNow)
    const requestForBody = (body: Readonly<Record<string, unknown>>) => ({
      canonicalPath: "/api/webhooks/webhook%3Atest/verify",
      key: "webhook-verify-key",
      method: "POST",
      principalScope: principalScopeForSubscriptionOwner(owner("user:one", "org:one")),
      requestHash: createHash("sha256").update(JSON.stringify(body)).digest("hex")
    })
    const request = requestForBody({ proof: "first" })
    let preflightCalls = 0
    const preflight = async () => {
      preflightCalls += 1
      return { challenge: "verified" }
    }
    const response = { body: { verified: true }, headers: { etag: "revision" }, statusCode: 200 }

    await expect(executor.executeWithPreflight(request, preflight, async () => response)).resolves.toEqual({
      replayed: false,
      response
    })
    await expect(
      executor.executeWithPreflight(
        request,
        async () => {
          throw new Error("a durable replay must not make a network preflight")
        },
        async () => {
          throw new Error("a durable replay must not execute the mutation")
        }
      )
    ).resolves.toEqual({ replayed: true, response })
    await expect(
      executor.executeWithPreflight(
        requestForBody({ proof: "different" }),
        async () => {
          throw new Error("a same-key request conflict must not make a network preflight")
        },
        async () => {
          throw new Error("a same-key request conflict must not execute the mutation")
        }
      )
    ).rejects.toMatchObject({ category: "idempotency_conflict" })
    expect(preflightCalls).toBe(1)
  })

  it("runs a same-key preflight exactly once for concurrent callers", async () => {
    const cipher = createEncryptedIdempotencyCipher(
      async (plaintext) => Buffer.from(plaintext, "utf8").toString("base64url"),
      async (ciphertext) => Buffer.from(ciphertext, "base64url").toString("utf8")
    )
    const executor = new SubscriptionIdempotencyTransaction(database, cipher, () => fixedNow)
    const request = {
      canonicalPath: "/api/webhooks/webhook%3Atest/verify",
      key: "concurrent-webhook-verify-key",
      method: "POST",
      principalScope: principalScopeForSubscriptionOwner(owner("user:one", "org:one")),
      requestHash: "b".repeat(64)
    }
    let preflightCalls = 0
    let releasePreflight: () => void = () => undefined
    const preflightReleased = new Promise<void>((resolve) => {
      releasePreflight = resolve
    })
    let signalPreflightStarted: () => void = () => undefined
    const preflightStarted = new Promise<void>((resolve) => {
      signalPreflightStarted = resolve
    })
    const response = { body: { verified: true }, headers: { etag: "revision" }, statusCode: 200 }
    const preflight = async () => {
      preflightCalls += 1
      signalPreflightStarted()
      await preflightReleased
    }
    const first = executor.executeWithPreflight(request, preflight, async () => response)
    await preflightStarted
    const second = executor.executeWithPreflight(request, preflight, async () => response)
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(preflightCalls).toBe(1)
    releasePreflight()
    const [firstResult, secondResult] = await Promise.all([first, second])
    expect(firstResult.response).toEqual(response)
    expect(secondResult.response).toEqual(response)
    expect(preflightCalls).toBe(1)
  })
})
