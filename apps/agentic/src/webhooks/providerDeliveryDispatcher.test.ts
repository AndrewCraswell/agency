import { describe, expect, it, vi } from "vitest"
import type { ProviderDeliveryRecord, ProviderDeliveryStore } from "../persistence/providerDeliveryStore"
import { ProviderDeliveryDispatcher } from "./providerDeliveryDispatcher"

const deliveryKey = "a".repeat(64)

function delivery(attemptCount: number): ProviderDeliveryRecord {
  const now = new Date("2026-07-20T12:00:00.000Z")
  return {
    deliveryKey,
    provider: "nango",
    receipt: { webhookType: "forward" },
    rawPayloadDigest: deliveryKey,
    status: "dispatching",
    attemptCount,
    matchedCount: null,
    lastError: null,
    nextAttemptAt: null,
    dispatchStartedAt: now,
    dispatchedAt: null,
    failedAt: null,
    quarantinedAt: null,
    receivedAt: now,
    updatedAt: now
  }
}

function store(record: ProviderDeliveryRecord): ProviderDeliveryStore {
  return {
    insert: vi.fn(),
    listPending: vi.fn(async () => [deliveryKey]),
    claim: vi.fn(async () => record),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
    recover: vi.fn(async () => 0)
  }
}

describe("ProviderDeliveryDispatcher", () => {
  it("dispatches a claimed receipt and records its matched count", async () => {
    const deliveryStore = store(delivery(1))
    const receiveWebhook = vi.fn(async () => 2)
    const dispatcher = new ProviderDeliveryDispatcher(deliveryStore, receiveWebhook)

    await expect(dispatcher.dispatchPending()).resolves.toBe(1)

    expect(receiveWebhook).toHaveBeenCalledWith({ webhookType: "forward" }, deliveryKey)
    expect(deliveryStore.complete).toHaveBeenCalledWith(deliveryKey, 2)
    expect(deliveryStore.fail).not.toHaveBeenCalled()
  })

  it.each([
    [2, false],
    [3, true]
  ])("marks attempt %i as failed with quarantine=%s", async (attemptCount, quarantine) => {
    const deliveryStore = store(delivery(attemptCount))
    const dispatcher = new ProviderDeliveryDispatcher(deliveryStore, async () => {
      throw new Error("routing unavailable")
    })

    await dispatcher.dispatch(deliveryKey)

    expect(deliveryStore.fail).toHaveBeenCalledWith(deliveryKey, "routing unavailable", quarantine)
    expect(deliveryStore.complete).not.toHaveBeenCalled()
  })
})
