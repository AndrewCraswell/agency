import { createServer } from "node:http"
import { afterEach, describe, expect, it } from "vitest"
import { runWithRequestContext, type RequestIdentity } from "../auth/request-context.js"
import { SubscriptionRepositoryError } from "./subscription-repository.js"
import type { Webhook } from "./subscriptions.js"
import type { WebhookReadRepository } from "./webhook-read-repository.js"
import { createWebhookReadApiHandler } from "./webhook-read-routes.js"

const servers = new Set<ReturnType<typeof createServer>>()

const webhook: Webhook = {
  activeKeyIds: ["webhook-key:one"],
  cancelledAt: null,
  createdAt: new Date("2026-08-24T12:00:00.000Z"),
  eventTypes: ["vote-added"],
  id: "webhook:one",
  lastFailedAt: null,
  lastSucceededAt: new Date("2026-08-24T12:01:00.000Z"),
  name: "Legislation updates",
  overlapEndsAt: null,
  owner: { organizationId: "org:one", userId: "user:one" },
  revision: "00000000-0000-0000-0000-000000000001",
  secretLastFour: "1234",
  status: "active",
  updatedAt: new Date("2026-08-24T12:02:00.000Z"),
  url: "https://hooks.example.test/legislation"
}

afterEach(async () => {
  await Promise.all(
    [...servers].map(async (server) => await new Promise<void>((resolve) => server.close(() => resolve())))
  )
  servers.clear()
})

async function start(
  repository: WebhookReadRepository,
  identity: RequestIdentity | null = { organizationId: "org:one", userId: "user:one" }
): Promise<string> {
  const handler = createWebhookReadApiHandler(repository, { apiBaseUrl: "https://api.example.test" })
  const server = createServer(async (request, response) => {
    const handled = await runWithRequestContext(
      identity === null ? { correlationId: "webhook-read-test" } : { correlationId: "webhook-read-test", identity },
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

function repository(overrides: Partial<WebhookReadRepository> = {}): WebhookReadRepository {
  return {
    getWebhook: async ({ id, owner }) =>
      id === webhook.id && owner.organizationId === webhook.owner.organizationId ? webhook : undefined,
    listWebhooks: async () => ({ items: [webhook], truncated: false }),
    ...overrides
  }
}

describe("createWebhookReadApiHandler", () => {
  it("returns the canonical webhook detail with ETag and no secret", async () => {
    const baseUrl = await start(repository())

    const response = await fetch(`${baseUrl}/api/webhooks/${encodeURIComponent(webhook.id)}`)

    expect(response.status).toBe(200)
    expect(response.headers.get("etag")).toBe(webhook.revision)
    await expect(response.json()).resolves.toEqual({
      data: {
        ...webhook,
        canonicalUrl: "https://api.example.test/api/webhooks/webhook%3Aone",
        createdAt: "2026-08-24T12:00:00.000Z",
        lastSucceededAt: "2026-08-24T12:01:00.000Z",
        updatedAt: "2026-08-24T12:02:00.000Z"
      },
      links: { self: "/api/webhooks/webhook%3Aone" },
      meta: { correlationId: "webhook-read-test", warnings: [] }
    })
  })

  it("passes every documented collection filter and binds the request owner", async () => {
    const received: unknown[] = []
    const baseUrl = await start(
      repository({
        listWebhooks: async (input) => {
          received.push(input)
          return { items: [webhook], truncated: false }
        }
      })
    )

    const response = await fetch(
      `${baseUrl}/api/webhooks?cursor=cursor%3Aone&eventType=vote-added&limit=7&status=active`
    )

    expect(response.status).toBe(200)
    expect(received).toEqual([
      {
        cursor: "cursor:one",
        eventType: "vote-added",
        limit: 7,
        owner: { organizationId: "org:one", userId: "user:one" },
        status: "active"
      }
    ])
  })

  it("rejects unauthenticated, malformed, duplicate, and unsupported webhook reads", async () => {
    const baseUrl = await start(repository(), null)
    const unauthenticated = await fetch(`${baseUrl}/api/webhooks`)
    expect(unauthenticated.status).toBe(403)

    const authenticatedBaseUrl = await start(repository())
    for (const path of [
      "/api/webhooks?status=active&status=paused",
      "/api/webhooks?limit=1&limit=2",
      "/api/webhooks?eventType=unknown",
      "/api/webhooks?unexpected=true",
      "/api/webhooks/",
      "/api/webhooks/%2F"
    ]) {
      const response = await fetch(`${authenticatedBaseUrl}${path}`)
      expect(response.status).toBe(path === "/api/webhooks/" || path === "/api/webhooks/%2F" ? 404 : 400)
    }
    expect((await fetch(`${authenticatedBaseUrl}/api/webhooks`, { method: "POST" })).status).toBe(404)
  })

  it("maps cursor mismatch to a safe invalid-request response and hides persistence failures", async () => {
    const cursorBaseUrl = await start(
      repository({
        listWebhooks: async () => {
          throw new SubscriptionRepositoryError("invalid_cursor", "scope details must not leak")
        }
      })
    )
    const cursorResponse = await fetch(`${cursorBaseUrl}/api/webhooks?cursor=bad`)
    expect(cursorResponse.status).toBe(400)
    await expect(cursorResponse.json()).resolves.toMatchObject({ error: { category: "invalid_request" } })

    const persistenceBaseUrl = await start(
      repository({
        getWebhook: async () => {
          throw new SubscriptionRepositoryError("invalid_persistence", "database detail must not leak")
        }
      })
    )
    const persistenceResponse = await fetch(`${persistenceBaseUrl}/api/webhooks/${encodeURIComponent(webhook.id)}`)
    expect(persistenceResponse.status).toBe(500)
    await expect(persistenceResponse.json()).resolves.toMatchObject({
      error: { category: "internal", message: "The request could not be completed" }
    })
  })

  it("does not project a repository result that violates the persisted webhook contract", async () => {
    const baseUrl = await start(
      repository({ getWebhook: async () => ({ ...webhook, eventTypes: ["status-changed", "status-changed"] }) })
    )

    const response = await fetch(`${baseUrl}/api/webhooks/${encodeURIComponent(webhook.id)}`)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "internal", message: "The request could not be completed" }
    })
  })

  it("does not claim nested actions or expose another scope", async () => {
    const baseUrl = await start(repository({ getWebhook: async () => undefined }))
    expect((await fetch(`${baseUrl}/api/webhooks/${encodeURIComponent(webhook.id)}`)).status).toBe(404)
    expect((await fetch(`${baseUrl}/api/webhooks/${encodeURIComponent(webhook.id)}/verify`)).status).toBe(404)
  })
})
