import { createServer, request as sendRequest } from "node:http"
import { afterEach, describe, expect, it } from "vitest"
import { runWithRequestContext } from "../auth/request-context.js"
import type {
  IdempotentResponse,
  IdempotencyRequest,
  PreflightSubscriptionMutationExecutor,
  SubscriptionTransaction
} from "./subscription-repository.js"
import { SubscriptionRepositoryError } from "./subscription-repository.js"
import {
  createWebhookSecretProtector,
  type EncryptedWebhookSecret,
  SubscriptionService,
  type SubscriptionRepository,
  type Webhook,
  type WebhookRepository
} from "./subscriptions.js"
import type { WebhookVerificationRepository } from "./subscriptions.js"
import type { WebhookVerificationTransport } from "./webhook-challenge-transport.js"
import { createWebhookMutationApiHandler } from "./webhook-mutation-routes.js"
import { resolvePublicWebhookUrl } from "./webhook-security.js"

const servers = new Set<ReturnType<typeof createServer>>()
const fixtureRevision = "00000000-0000-4000-8000-000000000001"
const mutatedFixtureRevision = "00000000-0000-4000-8000-000000000002"

function webhookIdentifiers(): () => string {
  const values = ["test", "test", fixtureRevision]
  return () => values.shift() ?? fixtureRevision
}

afterEach(async () => {
  await Promise.all(
    [...servers].map(async (server) => await new Promise<void>((resolve) => server.close(() => resolve())))
  )
  servers.clear()
})

function mutationRepository(): SubscriptionTransaction & WebhookRepository & WebhookVerificationRepository {
  const webhooks = new Map<string, Webhook>()
  const secrets = new Map<string, EncryptedWebhookSecret>()
  const noSubscription = async () => undefined
  const noPage = async () => ({ items: [], truncated: false }) as const
  return {
    activateWebhook: async ({ id, when }) => {
      const current = webhooks.get(id)!
      const next = { ...current, revision: mutatedFixtureRevision, status: "active" as const, updatedAt: when }
      webhooks.set(id, next)
      return next
    },
    activeSigningSecret: async ({ id }) => secrets.get(id),
    appendDelivery: async () => {
      throw new Error("Not used")
    },
    appendSubscriptionEvent: async () => {
      throw new Error("Not used")
    },
    cancelSubscription: noSubscription,
    cancelWebhook: async ({ id, when }) => {
      const current = webhooks.get(id)!
      const next = {
        ...current,
        cancelledAt: when,
        revision: mutatedFixtureRevision,
        status: "cancelled" as const,
        updatedAt: when
      }
      webhooks.set(id, next)
      return next
    },
    createSubscription: async () => {
      throw new Error("Not used")
    },
    createWebhook: async ({ keyId, secretCiphertext, webhook }) => {
      webhooks.set(webhook.id, webhook)
      secrets.set(webhook.id, secretCiphertext)
      return { ...webhook, activeKeyIds: [keyId] }
    },
    findExactSubscription: noSubscription,
    getSubscription: noSubscription,
    getWebhook: async ({ id }) => webhooks.get(id),
    listDeliveries: noPage,
    listSubscriptionEvents: noPage,
    listSubscriptions: noPage,
    listWebhooks: noPage,
    rotateWebhookSecret: async ({ id, keyId, overlapEndsAt, secretCiphertext, secretLastFour, when }) => {
      const current = webhooks.get(id)!
      secrets.set(id, secretCiphertext)
      const next = {
        ...current,
        activeKeyIds: overlapEndsAt === null ? [keyId] : [...current.activeKeyIds, keyId],
        overlapEndsAt,
        revision: mutatedFixtureRevision,
        secretLastFour,
        updatedAt: when
      }
      webhooks.set(id, next)
      return next
    },
    updateSubscription: async () => {
      throw new Error("Not used")
    },
    updateWebhook: async ({ id, patch, when }) => {
      const current = webhooks.get(id)!
      const next: Webhook = {
        ...current,
        ...patch,
        revision: mutatedFixtureRevision,
        status: patch.url === undefined ? (patch.status ?? current.status) : "pending-verification",
        updatedAt: when
      }
      webhooks.set(id, next)
      return next
    }
  }
}

function executor(repository: SubscriptionTransaction): PreflightSubscriptionMutationExecutor {
  const responses = new Map<string, Readonly<{ requestHash: string; response: IdempotentResponse<unknown> }>>()
  function keyFor(request: IdempotencyRequest): string {
    return `${request.method}:${request.canonicalPath}:${request.key}`
  }
  function replay(request: IdempotencyRequest) {
    const value = responses.get(keyFor(request))
    if (value === undefined) {
      return undefined
    }
    if (value.requestHash !== request.requestHash) {
      throw new SubscriptionRepositoryError("idempotency_conflict", "idempotency conflict")
    }
    return { replayed: true, response: value.response as IdempotentResponse<never> }
  }
  return {
    execute: async (request: IdempotencyRequest, operation) => {
      const existing = replay(request)
      if (existing !== undefined) {
        return existing
      }
      const response = await operation(repository)
      responses.set(keyFor(request), { requestHash: request.requestHash, response })
      return { replayed: false, response }
    },
    executeWithPreflight: async (request, preflight, operation) => {
      const existing = replay(request)
      if (existing !== undefined) {
        return existing
      }
      const prepared = await preflight()
      const response = await operation(repository, prepared)
      responses.set(keyFor(request), { requestHash: request.requestHash, response })
      return { replayed: false, response }
    }
  }
}

async function start(
  options: Readonly<{
    resolvePublicUrl?: typeof resolvePublicWebhookUrl
    transport?: WebhookVerificationTransport
  }> = {}
) {
  const repository = mutationRepository()
  const service = new SubscriptionService(
    repository as SubscriptionRepository & WebhookRepository,
    createWebhookSecretProtector(
      async (secret) => `cipher:${secret}`,
      async (ciphertext) => ciphertext.slice("cipher:".length)
    ),
    () => new Date("2026-08-25T12:00:00.000Z"),
    webhookIdentifiers()
  )
  const handler = createWebhookMutationApiHandler(service, executor(repository), {
    apiBaseUrl: "https://api.example.test",
    ...options
  })
  const server = createServer(async (request, response) => {
    const handled = await runWithRequestContext(
      { correlationId: "webhook-test", identity: { userId: "user:test" } },
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

async function call(baseUrl: string, path: string, method: string, body: string, headers: Record<string, string>) {
  return await new Promise<Readonly<{ body: string; statusCode: number }>>((resolve, reject) => {
    const request = sendRequest(`${baseUrl}${path}`, { headers, method }, (response) => {
      const chunks: Buffer[] = []
      response.on("data", (chunk: Buffer) => chunks.push(chunk))
      response.on("end", () =>
        resolve({ body: Buffer.concat(chunks).toString("utf8"), statusCode: response.statusCode ?? 0 })
      )
    })
    request.on("error", reject)
    request.end(body)
  })
}

describe("webhook mutation routes", () => {
  it("creates a pending webhook and replays its one-time secret exactly", async () => {
    const baseUrl = await start()
    const headers = { "content-type": "application/json", "idempotency-key": "webhook-create-key" }
    const body = JSON.stringify({ eventTypes: ["vote-added"], name: "Pipeline", url: "https://8.8.8.8/hooks" })
    const first = await call(baseUrl, "/api/webhooks", "POST", body, headers)
    const replay = await call(baseUrl, "/api/webhooks", "POST", body, headers)
    expect(first.statusCode).toBe(201)
    expect(replay).toEqual(first)
    expect(JSON.parse(first.body).data.webhook.status).toBe("pending-verification")
  })

  it("rejects request query parameters before mutation work", async () => {
    const baseUrl = await start()
    const response = await call(
      baseUrl,
      "/api/webhooks?unexpected=true",
      "POST",
      JSON.stringify({ eventTypes: [], name: "Pipeline", url: "https://8.8.8.8/hooks" }),
      { "content-type": "application/json", "idempotency-key": "webhook-create-key" }
    )
    expect(response.statusCode).toBe(400)
  })

  it("does not resolve a create URL for an idempotency replay or body conflict", async () => {
    let resolverCalls = 0
    const baseUrl = await start({
      resolvePublicUrl: async (url) => {
        resolverCalls += 1
        return await resolvePublicWebhookUrl(url, async () => [{ address: "8.8.8.8", family: 4 }])
      }
    })
    const headers = { "content-type": "application/json", "idempotency-key": "webhook-create-key" }
    const body = JSON.stringify({
      eventTypes: ["vote-added"],
      name: "Pipeline",
      url: "https://webhooks.example.test/hooks"
    })
    const first = await call(baseUrl, "/api/webhooks", "POST", body, headers)
    const replay = await call(baseUrl, "/api/webhooks", "POST", body, headers)
    const conflict = await call(
      baseUrl,
      "/api/webhooks",
      "POST",
      JSON.stringify({
        eventTypes: ["vote-added"],
        name: "Different pipeline",
        url: "https://webhooks.example.test/hooks"
      }),
      headers
    )
    expect(first.statusCode).toBe(201)
    expect(replay).toEqual(first)
    expect(conflict.statusCode).toBe(409)
    expect(resolverCalls).toBe(1)
  })

  it("does not resolve a patched URL for an idempotency replay or body conflict", async () => {
    let resolverCalls = 0
    const baseUrl = await start({
      resolvePublicUrl: async (url) => {
        resolverCalls += 1
        return await resolvePublicWebhookUrl(url, async () => [{ address: "8.8.8.8", family: 4 }])
      }
    })
    const created = await call(
      baseUrl,
      "/api/webhooks",
      "POST",
      JSON.stringify({ eventTypes: [], name: "Pipeline", url: "https://webhooks.example.test/create" }),
      { "content-type": "application/json", "idempotency-key": "webhook-create-key" }
    )
    expect(created.statusCode).toBe(201)
    const webhook = JSON.parse(created.body).data.webhook as Readonly<{ id: string; revision: string }>
    resolverCalls = 0
    const path = `/api/webhooks/${encodeURIComponent(webhook.id)}`
    const headers = {
      "content-type": "application/merge-patch+json",
      "idempotency-key": "webhook-patch-key",
      "if-match": webhook.revision
    }
    const body = JSON.stringify({ url: "https://webhooks.example.test/patched" })
    const first = await call(baseUrl, path, "PATCH", body, headers)
    const replay = await call(baseUrl, path, "PATCH", body, headers)
    const conflict = await call(
      baseUrl,
      path,
      "PATCH",
      JSON.stringify({ url: "https://webhooks.example.test/different" }),
      headers
    )
    expect(first.statusCode).toBe(200)
    expect(replay).toEqual(first)
    expect(conflict.statusCode).toBe(409)
    expect(resolverCalls).toBe(1)
  })

  it("rejects duplicate webhook event types", async () => {
    let resolverCalls = 0
    const baseUrl = await start({
      resolvePublicUrl: async (url) => {
        resolverCalls += 1
        return await resolvePublicWebhookUrl(url, async () => [{ address: "8.8.8.8", family: 4 }])
      }
    })
    const response = await call(
      baseUrl,
      "/api/webhooks",
      "POST",
      JSON.stringify({
        eventTypes: ["vote-added", "vote-added"],
        name: "Pipeline",
        url: "https://webhooks.example.test/hooks"
      }),
      { "content-type": "application/json", "idempotency-key": "webhook-create-key" }
    )
    expect(response.statusCode).toBe(400)
    expect(resolverCalls).toBe(0)
  })

  it("checks replay and conflict before issuing a verification challenge", async () => {
    let requests = 0
    const repository = mutationRepository()
    const service = new SubscriptionService(
      repository as SubscriptionRepository & WebhookRepository,
      createWebhookSecretProtector(
        async (secret) => `cipher:${secret}`,
        async (ciphertext) => ciphertext.slice("cipher:".length)
      ),
      () => new Date("2026-08-25T12:00:00.000Z"),
      webhookIdentifiers()
    )
    const created = await service.createWebhook(
      { userId: "user:test" },
      { eventTypes: [], name: "Pipeline", url: "https://8.8.8.8/hooks" }
    )
    const handler = createWebhookMutationApiHandler(service, executor(repository), {
      apiBaseUrl: "https://api.example.test",
      transport: {
        verify: async () => {
          requests += 1
          return true
        }
      }
    })
    const server = createServer(async (request, response) => {
      const handled = await runWithRequestContext(
        { correlationId: "webhook-test", identity: { userId: "user:test" } },
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
    const baseUrl = `http://127.0.0.1:${address.port}`
    const path = `/api/webhooks/${encodeURIComponent(created.webhook.id)}/verify`
    const headers = {
      "content-type": "application/json",
      "idempotency-key": "webhook-verify-key",
      "if-match": created.webhook.revision
    }
    const first = await call(baseUrl, path, "POST", "{}", headers)
    const replay = await call(baseUrl, path, "POST", "{}", headers)
    const conflict = await call(baseUrl, path, "POST", "{}", { ...headers, "if-match": "different-revision" })
    expect(first.statusCode).toBe(200)
    expect(replay).toEqual(first)
    expect(conflict.statusCode).toBe(409)
    expect(requests).toBe(1)
  })

  it("does not invoke a verification preflight for a same-key body conflict", async () => {
    let preflights = 0
    const subject = executor(mutationRepository())
    const requestForBody = (body: Readonly<Record<string, unknown>>) => ({
      canonicalPath: "/api/webhooks/webhook:test/verify",
      key: "webhook-verify-key",
      method: "POST",
      principalScope: "a".repeat(64),
      // Mutation handlers persist the canonical request body as this digest.
      requestHash: JSON.stringify(body).padEnd(64, "_").slice(0, 64)
    })
    const request = requestForBody({ proof: "first" })
    await subject.executeWithPreflight(
      request,
      async () => {
        preflights += 1
      },
      async () => ({ body: { ok: true }, headers: {}, statusCode: 200 })
    )
    await expect(
      subject.executeWithPreflight(
        requestForBody({ proof: "different" }),
        async () => {
          preflights += 1
        },
        async () => ({ body: { ok: true }, headers: {}, statusCode: 200 })
      )
    ).rejects.toThrow("idempotency conflict")
    expect(preflights).toBe(1)
  })
})
