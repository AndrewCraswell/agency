import { createServer } from "node:http"
import { afterEach, describe, expect, it } from "vitest"
import { runWithRequestContext } from "../auth/request-context.js"
import { createSubscriptionApiHandler } from "./subscription-routes.js"
import { createWebhookSecretProtector, SubscriptionService, type SubscriptionRepository } from "./subscriptions.js"

const servers = new Set<ReturnType<typeof createServer>>()

afterEach(async () => {
  await Promise.all(
    [...servers].map(async (server) => await new Promise<void>((resolve) => server.close(() => resolve())))
  )
  servers.clear()
})

function unavailableRepository(): SubscriptionRepository {
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
