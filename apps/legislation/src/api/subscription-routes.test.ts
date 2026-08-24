import { createServer } from "node:http"
import { afterEach, describe, expect, it } from "vitest"
import { runWithRequestContext } from "../auth/request-context.js"
import { SubscriptionRepositoryError } from "./subscription-repository.js"
import { createSubscriptionApiHandler, createSubscriptionReadApiHandler } from "./subscription-routes.js"
import {
  createWebhookSecretProtector,
  type Delivery,
  type SubscriptionEvent,
  SubscriptionService,
  type Subscription,
  type SubscriptionRepository,
  type WebhookRepository
} from "./subscriptions.js"

const servers = new Set<ReturnType<typeof createServer>>()

afterEach(async () => {
  await Promise.all(
    [...servers].map(async (server) => await new Promise<void>((resolve) => server.close(() => resolve())))
  )
  servers.clear()
})

function unavailableRepository(): SubscriptionRepository & WebhookRepository {
  const unavailable = async () => {
    throw new Error("Repository must not be reached by validation tests")
  }
  return {
    activateWebhook: unavailable,
    cancelSubscription: unavailable,
    cancelWebhook: unavailable,
    createSubscription: unavailable,
    createWebhook: unavailable,
    findExactSubscription: unavailable,
    getSubscription: unavailable,
    getWebhook: unavailable,
    listDeliveries: unavailable,
    listSubscriptionEvents: unavailable,
    listSubscriptions: unavailable,
    listWebhooks: unavailable,
    rotateWebhookSecret: unavailable,
    updateSubscription: unavailable,
    updateWebhook: unavailable
  }
}

async function start() {
  const service = new SubscriptionService(
    unavailableRepository(),
    createWebhookSecretProtector(async () => "encrypted")
  )
  const handler = createSubscriptionApiHandler(service)
  const server = createServer(async (request, response) => {
    const handled = await runWithRequestContext(
      { correlationId: "route-test", identity: { userId: "user:test" } },
      async () => await handler(request, response)
    )
    if (!handled) {
      response.writeHead(404).end()
    }
  })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP server address")
  }
  return `http://127.0.0.1:${address.port}`
}

const subscription: Subscription = {
  cancelledAt: null,
  createdAt: new Date("2026-08-24T12:00:00.000Z"),
  delivery: [{ channel: "in-app", destinationId: null, isEnabled: true }],
  eventTypes: ["vote-added"],
  frequency: "immediate",
  id: "subscription:one",
  name: "Floor votes",
  owner: { organizationId: "org:one", userId: "user:one" },
  revision: "revision:one",
  status: "active",
  target: { recordId: "bill:us:119:hr:1", recordType: "bill", type: "record" },
  timezone: "America/Los_Angeles",
  updatedAt: new Date("2026-08-24T12:01:00.000Z")
}

const event: SubscriptionEvent = {
  changeEventId: null,
  eventType: "vote-added",
  id: "subscription-event:one",
  matchedAt: new Date("2026-08-24T12:02:00.000Z"),
  occurredAt: new Date("2026-08-24T12:01:30.000Z"),
  recordId: "bill:us:119:hr:1",
  recordType: "bill",
  sourceUrls: ["https://example.test/bill"],
  subscriptionId: subscription.id,
  summary: "A floor vote was added.",
  title: "Floor vote"
}

const delivery: Delivery = {
  attemptCount: 1,
  channel: "in-app",
  createdAt: new Date("2026-08-24T12:03:00.000Z"),
  deliveredAt: null,
  destinationId: null,
  failureCategory: null,
  id: "delivery:one",
  nextAttemptAt: null,
  status: "delivered",
  subscriptionEventIds: [event.id],
  subscriptionId: subscription.id
}

async function startRead(
  repository: SubscriptionRepository,
  identity: Readonly<{ organizationId?: string; userId: string }> | null = {
    organizationId: "org:one",
    userId: "user:one"
  }
) {
  const service = new SubscriptionService(
    repository,
    createWebhookSecretProtector(async () => "encrypted")
  )
  const handler = createSubscriptionReadApiHandler(service, { apiBaseUrl: "https://api.example.test" })
  const server = createServer(async (request, response) => {
    const context =
      identity === null ? { correlationId: "read-route-test" } : { correlationId: "read-route-test", identity }
    const handled = await runWithRequestContext(context, async () => await handler(request, response))
    if (!handled) {
      response.writeHead(404).end()
    }
  })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP server address")
  }
  return `http://127.0.0.1:${address.port}`
}

describe("createSubscriptionApiHandler", () => {
  it("does not claim lookalike route prefixes", async () => {
    const baseUrl = await start()
    const response = await fetch(`${baseUrl}/api/subscriptions-evil`)
    expect(response.status).toBe(404)
  })

  it("rejects unknown create fields before reaching persistence", async () => {
    const baseUrl = await start()
    const response = await fetch(`${baseUrl}/api/subscriptions`, {
      body: JSON.stringify({ unexpected: true }),
      headers: { "content-type": "application/json", "idempotency-key": "unknown-create-field" },
      method: "POST"
    })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "invalid_request" } })
  })

  it("rejects unknown merge-patch fields before reaching persistence", async () => {
    const baseUrl = await start()
    const response = await fetch(`${baseUrl}/api/subscriptions/subscription%3Atest`, {
      body: JSON.stringify({ unexpected: true }),
      headers: {
        "content-type": "application/merge-patch+json",
        "idempotency-key": "unknown-patch-field",
        "if-match": "revision:test"
      },
      method: "PATCH"
    })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "invalid_request" } })
  })

  it("rejects unknown webhook create and patch fields before DNS or persistence", async () => {
    const baseUrl = await start()
    const createResponse = await fetch(`${baseUrl}/api/webhooks`, {
      body: JSON.stringify({ unexpected: true }),
      headers: { "content-type": "application/json", "idempotency-key": "unknown-webhook-create" },
      method: "POST"
    })
    expect(createResponse.status).toBe(400)

    const patchResponse = await fetch(`${baseUrl}/api/webhooks/webhook%3Atest`, {
      body: JSON.stringify({ unexpected: true }),
      headers: {
        "content-type": "application/merge-patch+json",
        "idempotency-key": "unknown-webhook-patch",
        "if-match": "revision:test"
      },
      method: "PATCH"
    })
    expect(patchResponse.status).toBe(400)
  })
})

describe("createSubscriptionReadApiHandler", () => {
  it("returns a canonical, scope-authorized subscription with its ETag", async () => {
    const baseUrl = await startRead({
      ...unavailableRepository(),
      getSubscription: async ({ id, owner }) =>
        id === subscription.id && owner.organizationId === subscription.owner.organizationId ? subscription : undefined
    })

    const response = await fetch(`${baseUrl}/api/subscriptions/${encodeURIComponent(subscription.id)}`)

    expect(response.status).toBe(200)
    expect(response.headers.get("etag")).toBe(subscription.revision)
    await expect(response.json()).resolves.toEqual({
      data: {
        ...subscription,
        canonicalUrl: "https://api.example.test/api/subscriptions/subscription%3Aone",
        createdAt: "2026-08-24T12:00:00.000Z",
        updatedAt: "2026-08-24T12:01:00.000Z"
      },
      links: { self: `/api/subscriptions/${encodeURIComponent(subscription.id)}` },
      meta: { correlationId: "read-route-test", warnings: [] }
    })
  })

  it("does not expose a subscription owned by another organization", async () => {
    const baseUrl = await startRead({
      ...unavailableRepository(),
      getSubscription: async () => undefined
    })

    const response = await fetch(`${baseUrl}/api/subscriptions/${encodeURIComponent(subscription.id)}`)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "not_found" } })
  })

  it("rejects a missing request identity before reading subscription data", async () => {
    const baseUrl = await startRead(unavailableRepository(), null)

    const response = await fetch(`${baseUrl}/api/subscriptions/${encodeURIComponent(subscription.id)}`)

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "forbidden" } })
  })

  it("passes each documented subscription-list filter and accepts RFC 3339 timestamps", async () => {
    const received: unknown[] = []
    const baseUrl = await startRead({
      ...unavailableRepository(),
      listSubscriptions: async (input) => {
        received.push(input)
        return { items: [subscription], truncated: false }
      }
    })

    const zTimestamp = await fetch(
      `${baseUrl}/api/subscriptions?channel=in-app&eventType=vote-added&recordType=bill&status=active&targetType=record&updatedFrom=2026-08-24T12%3A00%3A00Z`
    )
    const offsetTimestamp = await fetch(`${baseUrl}/api/subscriptions?updatedFrom=2026-08-24T05%3A00%3A00-07%3A00`)
    const dateOnly = await fetch(`${baseUrl}/api/subscriptions?updatedFrom=2026-08-24`)

    expect(zTimestamp.status).toBe(200)
    expect(offsetTimestamp.status).toBe(200)
    expect(dateOnly.status).toBe(400)
    expect(received).toEqual([
      {
        channel: "in-app",
        cursor: undefined,
        eventType: "vote-added",
        limit: 20,
        owner: subscription.owner,
        recordType: "bill",
        status: "active",
        targetType: "record",
        updatedFrom: new Date("2026-08-24T12:00:00.000Z")
      },
      {
        channel: undefined,
        cursor: undefined,
        eventType: undefined,
        limit: 20,
        owner: subscription.owner,
        recordType: undefined,
        status: undefined,
        targetType: undefined,
        updatedFrom: new Date("2026-08-24T12:00:00.000Z")
      }
    ])
  })

  it("applies event and delivery filters, then rejects invalid query ranges and unsupported parameters", async () => {
    const eventInputs: unknown[] = []
    const deliveryInputs: unknown[] = []
    const baseUrl = await startRead({
      ...unavailableRepository(),
      getSubscription: async () => subscription,
      listDeliveries: async (input) => {
        deliveryInputs.push(input)
        return { items: [delivery], truncated: false }
      },
      listSubscriptionEvents: async (input) => {
        eventInputs.push(input)
        return { items: [event], truncated: false }
      }
    })
    const escapedId = encodeURIComponent(subscription.id)
    const [events, deliveries, invalidRange, dateOnly, invalidRecordType, unsupported] = await Promise.all([
      fetch(
        `${baseUrl}/api/subscriptions/${escapedId}/events?eventType=vote-added&recordType=bill&recordId=bill%3Aus%3A119%3Ahr%3A1`
      ),
      fetch(`${baseUrl}/api/subscriptions/${escapedId}/deliveries?channel=in-app&status=delivered`),
      fetch(
        `${baseUrl}/api/subscriptions/${escapedId}/events?from=2026-08-25T00%3A00%3A00Z&to=2026-08-24T00%3A00%3A00Z`
      ),
      fetch(`${baseUrl}/api/subscriptions/${escapedId}/events?from=2026-08-24`),
      fetch(`${baseUrl}/api/subscriptions/${escapedId}/events?recordType=unknown`),
      fetch(`${baseUrl}/api/subscriptions?unsupported=true`)
    ])

    expect(events.status).toBe(200)
    expect(deliveries.status).toBe(200)
    expect(invalidRange.status).toBe(400)
    expect(dateOnly.status).toBe(400)
    expect(invalidRecordType.status).toBe(400)
    expect(unsupported.status).toBe(400)
    expect(eventInputs).toEqual([
      {
        cursor: undefined,
        eventType: "vote-added",
        from: undefined,
        limit: 20,
        owner: subscription.owner,
        recordId: "bill:us:119:hr:1",
        recordType: "bill",
        subscriptionId: subscription.id,
        to: undefined
      }
    ])
    expect(deliveryInputs).toEqual([
      {
        channel: "in-app",
        cursor: undefined,
        from: undefined,
        limit: 20,
        owner: subscription.owner,
        status: "delivered",
        subscriptionId: subscription.id,
        to: undefined
      }
    ])
    const eventBody = await events.json()
    expect(eventBody).toMatchObject({
      data: [
        {
          id: event.id,
          matchedAt: "2026-08-24T12:02:00.000Z",
          occurredAt: "2026-08-24T12:01:30.000Z"
        }
      ]
    })
    expect(eventBody).not.toHaveProperty("data.0.canonicalUrl")
    const deliveryBody = await deliveries.json()
    expect(deliveryBody).toMatchObject({
      data: [{ createdAt: "2026-08-24T12:03:00.000Z", id: delivery.id }]
    })
    expect(deliveryBody).not.toHaveProperty("data.0.canonicalUrl")
  })

  it("uses the shared safe error envelope for repository errors", async () => {
    const invalidCursorBaseUrl = await startRead({
      ...unavailableRepository(),
      listSubscriptions: async () => {
        throw new SubscriptionRepositoryError("invalid_cursor", "private cursor diagnostic")
      }
    })
    const persistenceBaseUrl = await startRead({
      ...unavailableRepository(),
      getSubscription: async () => {
        throw new SubscriptionRepositoryError("invalid_persistence", "private storage diagnostic")
      }
    })

    const [invalidCursor, invalidPersistence] = await Promise.all([
      fetch(`${invalidCursorBaseUrl}/api/subscriptions`),
      fetch(`${persistenceBaseUrl}/api/subscriptions/${encodeURIComponent(subscription.id)}`)
    ])

    expect(invalidCursor.status).toBe(400)
    await expect(invalidCursor.json()).resolves.toEqual({
      error: {
        category: "invalid_request",
        correlationId: "read-route-test",
        message: "Cursor is invalid for this request",
        retryable: false
      }
    })
    expect(invalidPersistence.status).toBe(500)
    await expect(invalidPersistence.json()).resolves.toEqual({
      error: {
        category: "internal",
        correlationId: "read-route-test",
        message: "The request could not be completed",
        retryable: false
      }
    })
  })

  it("does not register subscription mutations until encrypted replay is configured", async () => {
    const baseUrl = await startRead(unavailableRepository())
    const response = await fetch(`${baseUrl}/api/subscriptions`, {
      body: JSON.stringify({}),
      headers: { "content-type": "application/json", "idempotency-key": "not-configured" },
      method: "POST"
    })

    expect(response.status).toBe(404)
  })
})
