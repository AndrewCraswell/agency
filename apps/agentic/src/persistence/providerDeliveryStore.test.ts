import { describe, expect, it, vi } from "vitest"
import { PostgresProviderDeliveryStore } from "./providerDeliveryStore"

const deliveryKey = "a".repeat(64)
const now = new Date("2026-07-20T12:00:00.000Z")
const receipt = {
  webhookType: "forward" as const,
  from: "linear",
  providerConfigKey: "linear",
  connectionId: "linear-connection",
  providerEventAction: "create",
  providerObjectType: "Issue",
  providerResourceId: "team-1"
}

function record(overrides: Record<string, unknown> = {}) {
  return {
    deliveryKey,
    provider: "nango",
    receipt,
    rawPayloadDigest: deliveryKey,
    status: "pending",
    attemptCount: 0,
    matchedCount: null,
    lastError: null,
    nextAttemptAt: null,
    dispatchStartedAt: null,
    dispatchedAt: null,
    failedAt: null,
    quarantinedAt: null,
    receivedAt: now,
    updatedAt: now,
    ...overrides
  }
}

function insertDatabase(inserted: unknown[], selected: unknown[] = []) {
  const returning = vi.fn(async () => inserted)
  const onConflictDoNothing = vi.fn(() => ({ returning }))
  const values = vi.fn(() => ({ onConflictDoNothing }))
  const limit = vi.fn(async () => selected)
  const where = vi.fn(() => ({ limit }))
  const from = vi.fn(() => ({ where }))
  return {
    database: { insert: vi.fn(() => ({ values })), select: vi.fn(() => ({ from })) },
    values
  }
}

function updateDatabase(...results: unknown[][]) {
  const sets: unknown[] = []
  const update = vi.fn(() => ({
    set: vi.fn((value) => {
      sets.push(value)
      const rows = results.shift() ?? []
      return { where: vi.fn(() => ({ returning: vi.fn(async () => rows) })) }
    })
  }))
  return { database: { update }, sets }
}

describe("PostgresProviderDeliveryStore", () => {
  it("inserts a summarized receipt and returns the existing duplicate", async () => {
    const createdDatabase = insertDatabase([record()])
    const createdStore = new PostgresProviderDeliveryStore(createdDatabase.database as never, () => now)

    await expect(createdStore.insert(receipt, deliveryKey, deliveryKey)).resolves.toMatchObject({ created: true })
    expect(createdDatabase.values).toHaveBeenCalledWith({
      deliveryKey,
      provider: "nango",
      receipt,
      rawPayloadDigest: deliveryKey,
      status: "pending"
    })

    const duplicateDatabase = insertDatabase([], [record()])
    await expect(
      new PostgresProviderDeliveryStore(duplicateDatabase.database as never).insert(receipt, deliveryKey, deliveryKey)
    ).resolves.toMatchObject({ created: false, record: { deliveryKey } })
  })

  it("records dispatch completion and retry or quarantine outcomes", async () => {
    const database = updateDatabase()
    const store = new PostgresProviderDeliveryStore(database.database as never, () => now)

    await store.complete(deliveryKey, 2)
    await store.fail(deliveryKey, "temporary failure", false)
    await store.fail(deliveryKey, "permanent failure", true)

    expect(database.sets).toEqual([
      expect.objectContaining({ status: "dispatched", matchedCount: 2, dispatchedAt: now }),
      expect.objectContaining({ status: "failed", failedAt: now, nextAttemptAt: new Date(now.getTime() + 300_000) }),
      expect.objectContaining({ status: "quarantined", quarantinedAt: now, nextAttemptAt: null })
    ])
  })

  it("recovers stale or retryable rows and quarantines exhausted attempts", async () => {
    const database = updateDatabase([{ deliveryKey }], [{ deliveryKey: "b".repeat(64) }])
    const store = new PostgresProviderDeliveryStore(database.database as never, () => now)

    await expect(store.recover(new Date(now.getTime() - 300_000), 3)).resolves.toBe(2)
    expect(database.sets).toEqual([
      expect.objectContaining({ status: "quarantined", quarantinedAt: now }),
      expect.objectContaining({ status: "pending", dispatchStartedAt: null })
    ])
  })
})
