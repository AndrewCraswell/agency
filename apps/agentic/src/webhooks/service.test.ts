import { createHmac } from "node:crypto"
import { describe, expect, it, vi } from "vitest"
import type { WebhookDeliveryRecord, WebhookDeliveryStore } from "../persistence/webhookStore"
import { DurableWebhookDispatcher, GitHubWebhookService } from "./service"

const deliveryId = "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1"

function signed(body: Buffer) {
  return `sha256=${createHmac("sha256", "webhook-secret").update(body).digest("hex")}`
}

describe("GitHubWebhookService", () => {
  it("persists once, acknowledges duplicates, and dispatches only a claimed delivery", async () => {
    let record: WebhookDeliveryRecord | null = null
    const store: WebhookDeliveryStore = {
      insert: vi.fn(async (envelope, rawPayload) => {
        if (record !== null) {
          return { created: false, record }
        }
        record = {
          deliveryId: envelope.deliveryId,
          provider: "github",
          correlationId: envelope.correlationId,
          eventName: envelope.eventName,
          action: envelope.action,
          installationId: envelope.installationId,
          repositoryOwner: envelope.repository?.owner ?? null,
          repositoryName: envelope.repository?.name ?? null,
          payloadDigest: envelope.payloadDigest,
          rawPayload,
          normalizedEnvelope: envelope,
          processingStatus: "normalized",
          attemptCount: 0,
          nextAttemptAt: null,
          lastError: null,
          receivedAt: new Date(envelope.receivedAt),
          updatedAt: new Date(envelope.receivedAt)
        }
        return { created: true, record }
      }),
      listDispatchable: vi.fn(async () => [deliveryId]),
      claim: vi.fn(async () => record),
      complete: vi.fn(async () => undefined),
      requeueRecoverable: vi.fn(async () => 0)
    }
    const router = { route: vi.fn(async () => undefined) }
    const service = new GitHubWebhookService({
      secret: "webhook-secret",
      assignmentLabel: "agency-agent",
      store,
      router,
      now: () => new Date("2026-07-19T12:00:00.000Z")
    })
    const body = Buffer.from(
      JSON.stringify({
        action: "labeled",
        repository: { name: "agency", owner: { login: "AndrewCraswell" } },
        sender: { login: "andrew", type: "User" },
        label: { name: "agency-agent" },
        issue: { number: 123, title: "Task", body: null }
      })
    )
    const request = { deliveryId, eventName: "issues", signature: signed(body), rawBody: body }

    await expect(service.receive(request)).resolves.toMatchObject({ created: true, dispatch: true })
    await expect(service.receive(request)).resolves.toMatchObject({ created: false, dispatch: false })
    expect(router.route).not.toHaveBeenCalled()

    await service.dispatch(deliveryId)

    expect(router.route).toHaveBeenCalledOnce()
    expect(store.complete).toHaveBeenCalledWith(deliveryId, "dispatched")
  })

  it("rejects invalid signatures before persistence", async () => {
    const store = {
      insert: vi.fn(),
      listDispatchable: vi.fn(),
      claim: vi.fn(),
      complete: vi.fn(),
      requeueRecoverable: vi.fn()
    }
    const service = new GitHubWebhookService({
      secret: "webhook-secret",
      assignmentLabel: "agency-agent",
      store,
      router: { route: vi.fn() }
    })

    await expect(
      service.receive({
        deliveryId,
        eventName: "issues",
        signature: "sha256=" + "0".repeat(64),
        rawBody: Buffer.from("{}")
      })
    ).rejects.toThrow("Invalid GitHub webhook signature")
    expect(store.insert).not.toHaveBeenCalled()
  })
})

describe("DurableWebhookDispatcher", () => {
  it("dispatches pending deliveries and tolerates a claim won elsewhere", async () => {
    const store = {
      listDispatchable: vi.fn(async () => [deliveryId]),
      claim: vi.fn(async () => null),
      complete: vi.fn()
    }
    const router = { route: vi.fn() }
    const dispatcher = new DurableWebhookDispatcher(store as never, router)

    await expect(dispatcher.dispatchPending()).resolves.toBe(1)
    expect(router.route).not.toHaveBeenCalled()
    expect(store.complete).not.toHaveBeenCalled()
  })

  it("records a bounded retryable failure when routing throws", async () => {
    const normalizedEnvelope = {
      schemaVersion: "1",
      provider: "github",
      deliveryId,
      operation: "ignore"
    }
    const store = {
      claim: vi.fn(async () => ({ normalizedEnvelope })),
      complete: vi.fn(async () => undefined)
    }
    const dispatcher = new DurableWebhookDispatcher(store as never, {
      route: vi.fn(async () => Promise.reject(new Error("routing failed")))
    })

    await dispatcher.dispatch(deliveryId)

    expect(store.complete).toHaveBeenCalledWith(deliveryId, "failed", "routing failed")
  })
})
