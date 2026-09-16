import { createServer, request as sendRequest } from "node:http"
import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import { afterEach, describe, expect, it } from "vitest"
import {
  type IdempotentResponse,
  type IdempotencyRequest,
  type SubscriptionMutationExecutor,
  SubscriptionRepositoryError,
  type SubscriptionTransaction
} from "./subscription-repository.js"
import {
  createSubscriptionApiHandler,
  createSubscriptionMutationApiHandler,
  createSubscriptionReadApiHandler
} from "./subscription-routes.js"
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

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

function createMutationRepository(): SubscriptionTransaction {
  const subscriptions = new Map<string, Subscription>()
  const unavailableEventWriter = async () => {
    throw new Error("Event persistence is not expected during subscription mutations")
  }
  return {
    appendDelivery: unavailableEventWriter,
    appendSubscriptionEvent: unavailableEventWriter,
    cancelSubscription: async ({ id, revision, when }) => {
      const existing = subscriptions.get(id)
      if (existing === undefined || existing.revision !== revision) {
        return undefined
      }
      const cancelled: Subscription = {
        ...existing,
        cancelledAt: when,
        revision: `${revision}:cancelled`,
        status: "cancelled",
        updatedAt: when
      }
      subscriptions.set(id, cancelled)
      return cancelled
    },
    createSubscription: async ({ subscription }) => {
      subscriptions.set(subscription.id, subscription)
      return subscription
    },
    findExactSubscription: async () => undefined,
    getSubscription: async ({ id }) => subscriptions.get(id),
    listDeliveries: async () => ({ items: [], truncated: false }),
    listSubscriptionEvents: async () => ({ items: [], truncated: false }),
    listSubscriptions: async () => ({ items: [], truncated: false }),
    updateSubscription: async ({ id, patch, revision, when }) => {
      const existing = subscriptions.get(id)
      if (existing === undefined || existing.revision !== revision || existing.status === "cancelled") {
        return undefined
      }
      const updated: Subscription = { ...existing, ...patch, revision: `${revision}:next`, updatedAt: when }
      subscriptions.set(id, updated)
      return updated
    }
  }
}

function replayingMutationExecutor(
  repository: SubscriptionTransaction,
  requests: IdempotencyRequest[]
): SubscriptionMutationExecutor {
  const responses = new Map<string, Readonly<{ requestHash: string; response: IdempotentResponse<unknown> }>>()
  return {
    execute: async (request, operation) => {
      requests.push(request)
      const recordKey = [request.principalScope, request.method, request.canonicalPath, request.key].join("\u0000")
      const existing = responses.get(recordKey)
      if (existing !== undefined) {
        if (existing.requestHash !== request.requestHash) {
          throw new SubscriptionRepositoryError(
            "idempotency_conflict",
            "The idempotency key was already used with a different request.",
            { reason: "idempotency_key_reused" }
          )
        }
        return { replayed: true, response: existing.response as IdempotentResponse<never> }
      }
      const response = await operation(repository)
      responses.set(recordKey, { requestHash: request.requestHash, response })
      return { replayed: false, response }
    }
  }
}

async function startMutation() {
  const repository = createMutationRepository()
  const requests: IdempotencyRequest[] = []
  const service = new SubscriptionService(
    repository,
    createWebhookSecretProtector(async () => "encrypted"),
    () => new Date("2026-08-25T12:00:00.000Z"),
    () => "test"
  )
  const handler = createSubscriptionMutationApiHandler(service, replayingMutationExecutor(repository, requests), {
    apiBaseUrl: "https://api.example.test"
  })
  const server = createServer(async (request, response) => {
    const requestedCorrelationId = request.headers["x-correlation-id"]
    const correlationId =
      typeof requestedCorrelationId === "string" && requestedCorrelationId.trim() !== ""
        ? requestedCorrelationId
        : "mutation-route-test"
    const handled = await runWithRequestContext(
      { correlationId, identity: { userId: "user:test" } },
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
  return { baseUrl: `http://127.0.0.1:${address.port}`, requests }
}

async function sendRawRequest(
  baseUrl: string,
  input: Readonly<{
    body?: string
    headers: Readonly<Record<string, string | string[]>>
    method: string
    path: string
  }>
): Promise<Readonly<{ body: unknown; status: number }>> {
  return await new Promise((resolve, reject) => {
    const request = sendRequest(
      new URL(input.path, baseUrl),
      { headers: input.headers, method: input.method },
      (response) => {
        const chunks: Buffer[] = []
        response.on("data", (chunk: Buffer) => chunks.push(chunk))
        response.on("end", () => {
          try {
            resolve({ body: JSON.parse(Buffer.concat(chunks).toString("utf8")), status: response.statusCode ?? 0 })
          } catch (error) {
            reject(error)
          }
        })
      }
    )
    request.on("error", reject)
    request.end(input.body)
  })
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

describe("createSubscriptionMutationApiHandler", () => {
  it("rejects invalid mutation metadata before calling the executor", async () => {
    const { baseUrl, requests } = await startMutation()
    const createBody = JSON.stringify({
      delivery: [{ channel: "in-app", destinationId: null, isEnabled: true }],
      eventTypes: ["vote-added"],
      frequency: "immediate",
      name: "Floor votes",
      target: { recordId: "bill:us:119:hr:1", recordType: "bill", type: "record" },
      timezone: "America/Los_Angeles"
    })
    const [queryCreate, contentTypeCreate, queryPatch, bodyDelete, repeatedIdempotencyKey, repeatedIfMatch] =
      await Promise.all([
        fetch(`${baseUrl}/api/subscriptions?unexpected=true`, {
          body: createBody,
          headers: { "content-type": "application/json", "idempotency-key": "query-create" },
          method: "POST"
        }),
        fetch(`${baseUrl}/api/subscriptions`, {
          body: createBody,
          headers: { "idempotency-key": "content-type-create" },
          method: "POST"
        }),
        fetch(`${baseUrl}/api/subscriptions/subscription%3Atest?unexpected=true`, {
          body: JSON.stringify({ name: "Updated" }),
          headers: {
            "content-type": "application/merge-patch+json",
            "idempotency-key": "query-patch",
            "if-match": "revision:test"
          },
          method: "PATCH"
        }),
        fetch(`${baseUrl}/api/subscriptions/subscription%3Atest`, {
          body: "unexpected",
          headers: { "idempotency-key": "body-delete", "if-match": "revision:test" },
          method: "DELETE"
        }),
        sendRawRequest(baseUrl, {
          headers: {
            "content-type": "application/merge-patch+json",
            "idempotency-key": ["repeated-key-one", "repeated-key-two"],
            "if-match": "revision:test"
          },
          method: "PATCH",
          path: "/api/subscriptions/subscription%3Atest"
        }),
        sendRawRequest(baseUrl, {
          headers: {
            "content-type": "application/merge-patch+json",
            "idempotency-key": "single-key",
            "if-match": ["revision:one", "revision:two"]
          },
          method: "PATCH",
          path: "/api/subscriptions/subscription%3Atest"
        })
      ])

    expect([
      queryCreate.status,
      contentTypeCreate.status,
      queryPatch.status,
      bodyDelete.status,
      repeatedIdempotencyKey.status,
      repeatedIfMatch.status
    ]).toEqual([400, 400, 400, 400, 400, 400])
    expect(repeatedIdempotencyKey.body).toMatchObject({ error: { category: "invalid_request" } })
    expect(repeatedIfMatch.body).toMatchObject({ error: { category: "invalid_request" } })
    expect(requests).toEqual([])
  })

  it("creates, revision-updates, and cancels a subscription without inventing deliveries", async () => {
    const { baseUrl, requests } = await startMutation()
    const created = await fetch(`${baseUrl}/api/subscriptions`, {
      body: JSON.stringify({
        delivery: [{ channel: "in-app", destinationId: null, isEnabled: true }],
        eventTypes: ["vote-added"],
        frequency: "immediate",
        name: "Floor votes",
        target: { recordId: "bill:us:119:hr:1", recordType: "bill", type: "record" },
        timezone: "America/Los_Angeles"
      }),
      headers: { "content-type": "application/json", "idempotency-key": "create-subscription" },
      method: "POST"
    })

    expect(created.status).toBe(201)
    expect(created.headers.get("location")).toBe("/api/subscriptions/subscription%3Atest")
    const createdRevision = created.headers.get("etag")
    expect(createdRevision).not.toBeNull()
    await expect(created.json()).resolves.toMatchObject({
      data: {
        canonicalUrl: "https://api.example.test/api/subscriptions/subscription%3Atest",
        delivery: [{ channel: "in-app", destinationId: null, isEnabled: true }],
        status: "active"
      },
      meta: { correlationId: "mutation-route-test" }
    })

    const encodedUpdate = await fetch(`${baseUrl}/api/subscriptions/subscription:test`, {
      body: JSON.stringify({ name: "Priority floor votes" }),
      headers: {
        "content-type": "application/merge-patch+json",
        "idempotency-key": "equivalent-path-update",
        "if-match": createdRevision!
      },
      method: "PATCH"
    })
    const encodedUpdateBody = await encodedUpdate.json()
    const encodedUpdateRevision = encodedUpdate.headers.get("etag")
    const equivalentReplay = await fetch(`${baseUrl}/api/subscriptions/subscription%3atest`, {
      body: JSON.stringify({ name: "Priority floor votes" }),
      headers: {
        "content-type": "application/merge-patch+json",
        "idempotency-key": "equivalent-path-update",
        "if-match": createdRevision!,
        "x-correlation-id": "mutation-replay-test"
      },
      method: "PATCH"
    })

    expect(encodedUpdate.status).toBe(200)
    expect(equivalentReplay.status).toBe(200)
    expect(equivalentReplay.headers.get("etag")).toBe(encodedUpdateRevision)
    const equivalentReplayBody = await equivalentReplay.json()
    if (!isRecord(encodedUpdateBody)) {
      throw new Error("Expected the initial mutation response to be a JSON object")
    }
    expect(equivalentReplayBody).toHaveProperty("data", encodedUpdateBody.data)
    expect(equivalentReplayBody).toHaveProperty("links", encodedUpdateBody.links)
    expect(equivalentReplayBody).toHaveProperty("meta.correlationId", "mutation-replay-test")

    const equivalentConflict = await fetch(`${baseUrl}/api/subscriptions/subscription%3Atest`, {
      body: JSON.stringify({ name: "Different request" }),
      headers: {
        "content-type": "application/merge-patch+json",
        "idempotency-key": "equivalent-path-update",
        "if-match": createdRevision!
      },
      method: "PATCH"
    })

    expect(equivalentConflict.status).toBe(409)
    await expect(equivalentConflict.json()).resolves.toMatchObject({
      error: { category: "conflict", details: { reason: "idempotency_key_reused" } }
    })

    const updated = await fetch(`${baseUrl}/api/subscriptions/subscription%3Atest`, {
      body: JSON.stringify({ name: "Priority floor votes" }),
      headers: {
        "content-type": "application/merge-patch+json",
        "idempotency-key": "update-subscription",
        "if-match": encodedUpdateRevision!
      },
      method: "PATCH"
    })

    expect(updated.status).toBe(200)
    const updatedRevision = updated.headers.get("etag")
    expect(updatedRevision).not.toBe(createdRevision)
    await expect(updated.json()).resolves.toMatchObject({ data: { name: "Priority floor votes" } })

    const repeatedPatch = await fetch(`${baseUrl}/api/subscriptions/subscription%3Atest`, {
      body: JSON.stringify({ name: "Priority floor votes" }),
      headers: {
        "content-type": "application/merge-patch+json",
        "idempotency-key": "repeat-update-subscription",
        "if-match": updatedRevision!
      },
      method: "PATCH"
    })

    expect(repeatedPatch.status).toBe(200)
    const repeatedPatchRevision = repeatedPatch.headers.get("etag")
    expect(repeatedPatchRevision).not.toBe(updatedRevision)
    expect(requests).toMatchObject([
      { canonicalPath: "/api/subscriptions", method: "POST" },
      { canonicalPath: "/api/subscriptions/subscription%3Atest", method: "PATCH" },
      { canonicalPath: "/api/subscriptions/subscription%3Atest", method: "PATCH" },
      { canonicalPath: "/api/subscriptions/subscription%3Atest", method: "PATCH" },
      { canonicalPath: "/api/subscriptions/subscription%3Atest", method: "PATCH" },
      { canonicalPath: "/api/subscriptions/subscription%3Atest", method: "PATCH" }
    ])
    expect(requests[1]?.requestHash).toBe(requests[2]?.requestHash)
    expect(requests[1]?.requestHash).not.toBe(requests[4]?.requestHash)

    const cancelled = await fetch(`${baseUrl}/api/subscriptions/subscription%3Atest`, {
      headers: { "idempotency-key": "delete-subscription", "if-match": repeatedPatchRevision! },
      method: "DELETE"
    })

    expect(cancelled.status).toBe(200)
    await expect(cancelled.json()).resolves.toMatchObject({
      data: {
        cancelledAt: "2026-08-25T12:00:00.000Z",
        finalRevision: cancelled.headers.get("etag"),
        id: "subscription:test"
      }
    })
  })
})

describe("createSubscriptionReadApiHandler", () => {
  it("rejects malformed percent-encoding in a subscription ID", async () => {
    const baseUrl = await startRead(unavailableRepository())

    const response = await fetch(`${baseUrl}/api/subscriptions/%E0%A4%A`)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "invalid_request" } })
  })

  it("rejects decoded separators, controls, and overlong subscription IDs", async () => {
    const baseUrl = await startRead(unavailableRepository())
    const overlongId = `subscription%3A${"a".repeat(129)}`
    const [separator, control, overlong] = await Promise.all([
      fetch(`${baseUrl}/api/subscriptions/subscription%3Aone%2Ftwo`),
      fetch(`${baseUrl}/api/subscriptions/subscription%3Aone%0Atwo`),
      fetch(`${baseUrl}/api/subscriptions/${overlongId}`)
    ])

    expect([separator.status, control.status, overlong.status]).toEqual([400, 400, 400])
  })

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
