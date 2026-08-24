import { resolve } from "node:path"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import * as schema from "../db/schema/schema.js"
import {
  principalScopeForSubscriptionOwner,
  createEncryptedIdempotencyCipher,
  PostgresSubscriptionRepository,
  SubscriptionIdempotencyTransaction
} from "./subscription-repository.js"
import type { Subscription, SubscriptionOwner } from "./subscriptions.js"

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
    expect(firstPage.items).toHaveLength(1)
    expect(firstPage.nextCursor).toBeDefined()
    await expect(
      repository.listSubscriptions({ cursor: firstPage.nextCursor, owner: owner("user:two", "org:one"), limit: 1 })
    ).resolves.toMatchObject({ items: [{ id: "subscription:shared-two" }], truncated: false })

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
    await expect(
      repository.listSubscriptionEvents({ owner: owner("user:two", "org:one"), subscriptionId: shared.id, limit: 20 })
    ).resolves.toMatchObject({ items: [{ id: "subscription-event:shared:1" }], truncated: false })
    await expect(
      repository.listDeliveries({ owner: owner("user:two", "org:one"), subscriptionId: shared.id, limit: 20 })
    ).resolves.toMatchObject({ items: [{ id: "delivery:shared:1" }], truncated: false })
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
      return { body: { id: created.id }, headers: { etag: created.revision }, statusCode: 201 }
    })
    expect(first.replayed).toBe(false)

    await expect(
      executor.execute(request, async () => {
        throw new Error("replay must not execute the mutation")
      })
    ).resolves.toMatchObject({ replayed: true, response: { body: { id: "subscription:replayed" }, statusCode: 201 } })

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
})
