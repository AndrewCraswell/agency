import { randomUUID } from "node:crypto"
import { createServer } from "node:http"
import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { AmendmentSearchApi } from "./amendment-search"
import type { CivicSearchApi } from "./civic-search"
import type { CoreReadQueryApi } from "./core-read"
import { createLegislationApiHandler } from "./handlers"
import { prepareApiResponse } from "./http"
import {
  type IdempotentResponse,
  type IdempotencyRequest,
  type PreflightSubscriptionMutationExecutor,
  type SubscriptionTransaction,
  SubscriptionRepositoryError
} from "./subscription-repository"
import {
  createWebhookSecretProtector,
  type EncryptedWebhookSecret,
  type Webhook,
  type WebhookVerificationRepository
} from "./subscriptions"

vi.mock("./webhook-challenge-transport.js", () => ({
  createPinnedWebhookVerificationTransport: () => ({
    verify: async () => true
  })
}))

const servers = new Set<ReturnType<typeof createServer>>()
const owner = { organizationId: "organization:test", userId: "user:test" } as const

type DurableWebhookRepository = SubscriptionTransaction & WebhookVerificationRepository

type JsonResponse = Readonly<{
  body: unknown
  headers: Headers
  status: number
}>

afterEach(async () => {
  await Promise.all(
    [...servers].map(async (server) => await new Promise<void>((resolve) => server.close(() => resolve())))
  )
  servers.clear()
})

function queryService(): CoreReadQueryApi & CivicSearchApi & AmendmentSearchApi {
  const page = () => ({ items: [], truncated: false })
  const searchPage = () => ({ items: [], search: { isReranked: false as const, models: [] }, truncated: false })
  const amendmentSearchPage = () => ({
    items: [],
    search: { isReranked: false as const, models: [] },
    truncated: false,
    warnings: []
  })
  return {
    browseBills: async () => page(),
    compareBillVersions: async () => ({ changes: [] }),
    findRelatedBills: async () => page(),
    getAmendment: async () => ({}),
    getBill: async () => ({}),
    getBillText: async () => ({ sections: [], truncated: false }),
    getBillTimeline: async () => ({ events: [], truncated: false }),
    getBillVotes: async () => page(),
    getDocument: async () => ({}),
    getDocumentSections: async () => page(),
    getJurisdiction: async () => ({}),
    getSession: async () => ({}),
    getSupportingMaterial: async () => ({ material: {} }),
    getVote: async () => ({}),
    listJurisdictions: async () => page(),
    listSessions: async () => page(),
    searchAmendmentHits: async () => amendmentSearchPage(),
    searchAmendments: async () => page(),
    searchBillText: async () => searchPage(),
    searchBills: async () => searchPage(),
    searchChanges: async () => page(),
    searchSupportingMaterialHits: async () => amendmentSearchPage(),
    searchSupportingMaterials: async () => page(),
    searchVotes: async () => page()
  }
}

function createDurableWebhookRepository(): DurableWebhookRepository {
  const webhooks = new Map<string, Webhook>()
  const secrets = new Map<string, EncryptedWebhookSecret>()

  function visible(id: string, requestedOwner: Readonly<{ organizationId: string | null; userId: string }>) {
    const webhook = webhooks.get(id)
    return webhook !== undefined &&
      webhook.owner.organizationId === requestedOwner.organizationId &&
      webhook.owner.userId === requestedOwner.userId
      ? webhook
      : undefined
  }

  function requireVisible(id: string, requestedOwner: Readonly<{ organizationId: string | null; userId: string }>) {
    const webhook = visible(id, requestedOwner)
    if (webhook === undefined) {
      throw new Error(`Missing durable webhook ${id}`)
    }
    return webhook
  }

  const noSubscription = async () => {
    throw new Error("Subscription persistence is not part of this composed webhook fixture")
  }
  const noEvent = async () => {
    throw new Error("Subscription event persistence is not part of this composed webhook fixture")
  }

  return {
    activateWebhook: async ({ id, owner: requestedOwner, revision, when }) => {
      const current = requireVisible(id, requestedOwner)
      if (current.revision !== revision) {
        throw new Error("stale durable webhook revision")
      }
      const activated: Webhook = { ...current, revision: randomUUID(), status: "active", updatedAt: when }
      webhooks.set(id, activated)
      return activated
    },
    activeSigningSecret: async ({ id, owner: requestedOwner }) => {
      const current = visible(id, requestedOwner)
      return current === undefined ? undefined : secrets.get(id)
    },
    appendDelivery: noEvent,
    appendSubscriptionEvent: noEvent,
    cancelSubscription: noSubscription,
    cancelWebhook: async ({ id, owner: requestedOwner, revision, when }) => {
      const current = requireVisible(id, requestedOwner)
      if (current.revision !== revision) {
        throw new Error("stale durable webhook revision")
      }
      const cancelled: Webhook = {
        ...current,
        cancelledAt: when,
        revision: randomUUID(),
        status: "cancelled",
        updatedAt: when
      }
      webhooks.set(id, cancelled)
      return cancelled
    },
    createSubscription: noSubscription,
    createWebhook: async ({ keyId, secretCiphertext, webhook }) => {
      webhooks.set(webhook.id, { ...webhook, activeKeyIds: [keyId] })
      secrets.set(webhook.id, secretCiphertext)
      return webhooks.get(webhook.id)!
    },
    findExactSubscription: async () => undefined,
    getSubscription: async () => undefined,
    getWebhook: async ({ id, owner: requestedOwner }) => visible(id, requestedOwner),
    listDeliveries: async () => ({ items: [], truncated: false }),
    listSubscriptionEvents: async () => ({ items: [], truncated: false }),
    listSubscriptions: async () => ({ items: [], truncated: false }),
    listWebhooks: async ({ owner: requestedOwner }) => ({
      items: [...webhooks.values()].filter((webhook) => visible(webhook.id, requestedOwner) !== undefined),
      truncated: false
    }),
    rotateWebhookSecret: async ({
      id,
      keyId,
      overlapEndsAt,
      owner: requestedOwner,
      revision,
      secretCiphertext,
      secretLastFour,
      when
    }) => {
      const current = requireVisible(id, requestedOwner)
      if (current.revision !== revision) {
        throw new Error("stale durable webhook revision")
      }
      const rotated: Webhook = {
        ...current,
        activeKeyIds: overlapEndsAt === null ? [keyId] : [...current.activeKeyIds, keyId],
        overlapEndsAt,
        revision: randomUUID(),
        secretLastFour,
        updatedAt: when
      }
      webhooks.set(id, rotated)
      secrets.set(id, secretCiphertext)
      return rotated
    },
    updateSubscription: noSubscription,
    updateWebhook: async ({ id, owner: requestedOwner, patch, revision, when }) => {
      const current = requireVisible(id, requestedOwner)
      if (current.revision !== revision) {
        throw new Error("stale durable webhook revision")
      }
      const updated: Webhook = {
        ...current,
        ...patch,
        revision: randomUUID(),
        status: patch.url === undefined ? (patch.status ?? current.status) : "pending-verification",
        updatedAt: when
      }
      webhooks.set(id, updated)
      return updated
    }
  }
}

function createDurableMutationExecutor(repository: SubscriptionTransaction): PreflightSubscriptionMutationExecutor {
  const records = new Map<string, Readonly<{ requestHash: string; response: IdempotentResponse<unknown> }>>()
  const keyFor = (request: IdempotencyRequest) =>
    [request.principalScope, request.method, request.canonicalPath, request.key].join("\u0000")

  function replay(request: IdempotencyRequest) {
    const record = records.get(keyFor(request))
    if (record === undefined) {
      return undefined
    }
    if (record.requestHash !== request.requestHash) {
      throw new SubscriptionRepositoryError("idempotency_conflict", "different body for idempotency key", {
        reason: "idempotency_key_reused"
      })
    }
    return { replayed: true, response: record.response as IdempotentResponse<never> }
  }

  return {
    execute: async (request, operation) => {
      const existing = replay(request)
      if (existing !== undefined) {
        return existing
      }
      const response = await operation(repository)
      records.set(keyFor(request), { requestHash: request.requestHash, response })
      return { replayed: false, response }
    },
    executeWithPreflight: async (request, preflight, operation) => {
      const existing = replay(request)
      if (existing !== undefined) {
        return existing
      }
      const prepared = await preflight()
      const response = await operation(repository, prepared)
      records.set(keyFor(request), { requestHash: request.requestHash, response })
      return { replayed: false, response }
    }
  }
}

async function startApp(): Promise<string> {
  const repository = createDurableWebhookRepository()
  const handler = createLegislationApiHandler(queryService(), {
    apiBaseUrl: "https://api.example.test",
    subscriptionRepository: repository,
    webhookMutationExecutor: createDurableMutationExecutor(repository),
    webhookReadRepository: repository,
    webhookSecretProtector: createWebhookSecretProtector(
      async (secret) => `encrypted:${secret}`,
      async (ciphertext) => ciphertext.slice("encrypted:".length)
    )
  })
  const server = createServer(async (request, response) => {
    await runWithRequestContext({ correlationId: "composed-webhook-test", identity: owner }, async () => {
      prepareApiResponse(response, request)
      const handled = await handler(request, response)
      if (!handled) {
        response.writeHead(404).end()
      }
    })
  })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP server address")
  }
  return `http://127.0.0.1:${address.port}`
}

async function request(baseUrl: string, path: string, init: RequestInit = {}): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, init)
  const text = await response.text()
  return { body: text.length === 0 ? undefined : JSON.parse(text), headers: response.headers, status: response.status }
}

function resourceBody(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected an API resource envelope")
  }
  const data = (value as Record<string, unknown>).data
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Expected API resource data")
  }
  return data as Record<string, unknown>
}

function webhookFrom(value: unknown): Readonly<{ id: string; revision: string }> {
  const data = resourceBody(value)
  const webhook = data.webhook ?? data
  if (typeof webhook !== "object" || webhook === null || Array.isArray(webhook)) {
    throw new Error("Expected a webhook resource")
  }
  const record = webhook as Record<string, unknown>
  if (typeof record.id !== "string" || typeof record.revision !== "string") {
    throw new Error("Expected webhook identity and revision")
  }
  return { id: record.id, revision: record.revision }
}

function expectNoSecret(value: unknown): void {
  const serialized = JSON.stringify(value)
  expect(serialized).not.toContain("secretCiphertext")
  expect(serialized).not.toContain("encrypted:")
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected an API envelope")
  }
  const data = (value as Record<string, unknown>).data
  const dataRecord = typeof data === "object" && data !== null && !Array.isArray(data) ? data : {}
  expect(dataRecord).not.toHaveProperty("secret")
  expect(dataRecord).not.toHaveProperty("secretCiphertext")
}

const createBody = JSON.stringify({
  eventTypes: ["vote-added"],
  name: "Pipeline",
  url: "https://8.8.8.8/hooks"
})

describe("composed webhook routes", () => {
  it("composes exact collection and detail routes with resource/page envelopes and read-safe projections", async () => {
    const baseUrl = await startApp()

    const before = await request(baseUrl, "/api/webhooks")
    expect(before.status).toBe(200)
    expect(before.body).toMatchObject({
      data: [],
      links: { next: null, self: "/api/webhooks" },
      meta: { correlationId: "composed-webhook-test", limit: 20, nextCursor: null, truncated: false, warnings: [] }
    })

    const createHeaders = { "content-type": "application/json", "idempotency-key": "webhook-create-key" }
    const created = await request(baseUrl, "/api/webhooks", {
      body: createBody,
      headers: createHeaders,
      method: "POST"
    })
    expect(created.status).toBe(201)
    expect(created.headers.get("etag")).toBeTruthy()
    const createdData = resourceBody(created.body)
    expect(createdData).toHaveProperty("keyId")
    expect(createdData).toHaveProperty("secret")
    expect(createdData).not.toHaveProperty("secretCiphertext")
    const secret = createdData.secret
    expect(typeof secret).toBe("string")
    const createdWebhook = webhookFrom(created.body)
    const path = `/api/webhooks/${encodeURIComponent(createdWebhook.id)}`

    const replay = await request(baseUrl, "/api/webhooks", {
      body: createBody,
      headers: createHeaders,
      method: "POST"
    })
    expect(replay.status).toBe(201)
    expect(replay.body).toEqual(created.body)

    const detail = await request(baseUrl, path)
    expect(detail.status).toBe(200)
    expect(detail.headers.get("etag")).toBe(createdWebhook.revision)
    expectNoSecret(detail.body)
    expect(JSON.stringify(detail.body)).not.toContain(String(secret))

    const collection = await request(baseUrl, "/api/webhooks?status=pending-verification")
    expect(collection.status).toBe(200)
    expect(collection.body).toMatchObject({ links: { self: "/api/webhooks?status=pending-verification" } })
    expectNoSecret(collection.body)

    const unicodeCreate = await request(baseUrl, "/api/webhooks", {
      body: JSON.stringify({ eventTypes: [], name: "😀".repeat(120), url: "https://8.8.8.8/unicode" }),
      headers: { "content-type": "application/json", "idempotency-key": "unicode-create-key" },
      method: "POST"
    })
    expect(unicodeCreate.status).toBe(201)
    const unicodeWebhook = webhookFrom(unicodeCreate.body)
    const unicodeDetail = await request(baseUrl, `/api/webhooks/${encodeURIComponent(unicodeWebhook.id)}`)
    expect(unicodeDetail.status).toBe(200)
    expect(resourceBody(unicodeDetail.body).name).toBe("😀".repeat(120))
    const unicodeTooLong = await request(baseUrl, "/api/webhooks", {
      body: JSON.stringify({ eventTypes: [], name: "😀".repeat(121), url: "https://8.8.8.8/too-long" }),
      headers: { "content-type": "application/json", "idempotency-key": "unicode-too-long-key" },
      method: "POST"
    })
    expect(unicodeTooLong.status).toBe(400)

    for (const [id, key] of [
      ["opaque:id", "opaque-id-key"],
      ["opaque%2Fid", "encoded-slash-id-key"]
    ]) {
      const opaqueId = await request(baseUrl, `/api/webhooks/${id}`, {
        body: JSON.stringify({ name: "ignored" }),
        headers: { "content-type": "application/merge-patch+json", "idempotency-key": key },
        method: "PATCH"
      })
      expect(opaqueId.status).toBe(412)
    }

    for (const exactRouteMiss of ["/api/webhooks/", `${path}/`, `${path}/rotate-secret/`, `${path}/verify/`]) {
      const response = await request(baseUrl, exactRouteMiss)
      expect(response.status).toBe(404)
    }
  })

  it("covers every composed mutation route with durable replay, preconditions, and secret-safe envelopes", async () => {
    const baseUrl = await startApp()
    const create = await request(baseUrl, "/api/webhooks", {
      body: createBody,
      headers: { "content-type": "application/json", "idempotency-key": "mutation-create-key" },
      method: "POST"
    })
    const firstWebhook = webhookFrom(create.body)
    const path = `/api/webhooks/${encodeURIComponent(firstWebhook.id)}`
    const patchBody = JSON.stringify({ name: "Updated pipeline" })
    const patchHeaders = {
      "content-type": "application/merge-patch+json",
      "idempotency-key": "mutation-patch-key"
    }

    const missingIfMatch = await request(baseUrl, path, { body: patchBody, headers: patchHeaders, method: "PATCH" })
    expect(missingIfMatch.status).toBe(412)
    expect(JSON.stringify(missingIfMatch.body)).not.toContain("secret")

    const staleIfMatch = await request(baseUrl, path, {
      body: patchBody,
      headers: { ...patchHeaders, "if-match": "stale-revision" },
      method: "PATCH"
    })
    expect(staleIfMatch.status).toBe(412)

    const overlongPatch = await request(baseUrl, path, {
      body: JSON.stringify({ name: "😀".repeat(121) }),
      headers: { ...patchHeaders, "if-match": firstWebhook.revision, "idempotency-key": "overlong-patch-key" },
      method: "PATCH"
    })
    expect(overlongPatch.status).toBe(400)

    const patched = await request(baseUrl, path, {
      body: patchBody,
      headers: { ...patchHeaders, "if-match": firstWebhook.revision },
      method: "PATCH"
    })
    expect(patched.status).toBe(200)
    expectNoSecret(patched.body)
    const patchedWebhook = webhookFrom(patched.body)
    const patchReplay = await request(baseUrl, path, {
      body: patchBody,
      headers: { ...patchHeaders, "if-match": firstWebhook.revision },
      method: "PATCH"
    })
    expect(patchReplay.status).toBe(200)
    expect(patchReplay.body).toEqual(patched.body)

    const rotatePath = `${path}/rotate-secret`
    const rotateHeaders = { "content-type": "application/json", "idempotency-key": "mutation-rotate-key" }
    const rotateMissingIfMatch = await request(baseUrl, rotatePath, {
      body: "{}",
      headers: rotateHeaders,
      method: "POST"
    })
    expect(rotateMissingIfMatch.status).toBe(412)

    const rotated = await request(baseUrl, rotatePath, {
      body: JSON.stringify({ overlapSeconds: 0 }),
      headers: { ...rotateHeaders, "if-match": patchedWebhook.revision },
      method: "POST"
    })
    expect(rotated.status).toBe(200)
    const rotatedData = resourceBody(rotated.body)
    expect(rotatedData).toHaveProperty("keyId")
    expect(rotatedData).toHaveProperty("secret")
    expect(rotatedData).not.toHaveProperty("secretCiphertext")
    const rotatedWebhook = webhookFrom(rotated.body)
    const rotateReplay = await request(baseUrl, rotatePath, {
      body: JSON.stringify({ overlapSeconds: 0 }),
      headers: { ...rotateHeaders, "if-match": patchedWebhook.revision },
      method: "POST"
    })
    expect(rotateReplay.status).toBe(200)
    expect(rotateReplay.body).toEqual(rotated.body)

    const verifyPath = `${path}/verify`
    const verifyHeaders = { "content-type": "application/json", "idempotency-key": "mutation-verify-key" }
    const verify = await request(baseUrl, verifyPath, {
      body: "{}",
      headers: { ...verifyHeaders, "if-match": rotatedWebhook.revision },
      method: "POST"
    })
    expect(verify.status).toBe(200)
    expectNoSecret(verify.body)
    expect(webhookFrom(verify.body)).toMatchObject({ id: firstWebhook.id })
    const verifyReplay = await request(baseUrl, verifyPath, {
      body: "{}",
      headers: { ...verifyHeaders, "if-match": rotatedWebhook.revision },
      method: "POST"
    })
    expect(verifyReplay.status).toBe(200)
    expect(verifyReplay.body).toEqual(verify.body)

    const verifiedWebhook = webhookFrom(verify.body)
    const deletePath = path
    const deleteHeaders = { "idempotency-key": "mutation-delete-key", "if-match": verifiedWebhook.revision }
    const deleted = await request(baseUrl, deletePath, { headers: deleteHeaders, method: "DELETE" })
    expect(deleted.status).toBe(200)
    expectNoSecret(deleted.body)
    const deletedData = resourceBody(deleted.body)
    expect(deletedData).toMatchObject({ id: firstWebhook.id })
    expect(typeof deletedData.finalRevision).toBe("string")
    const deleteReplay = await request(baseUrl, deletePath, {
      headers: { ...deleteHeaders, "if-match": "later-revision" },
      method: "DELETE"
    })
    expect(deleteReplay.status).toBe(200)
    expect(deleteReplay.body).toEqual(deleted.body)

    const afterDelete = await request(baseUrl, path)
    expect(afterDelete.status).toBe(200)
    expectNoSecret(afterDelete.body)
    expect(resourceBody(afterDelete.body)).toMatchObject({ status: "cancelled" })
  })
})
