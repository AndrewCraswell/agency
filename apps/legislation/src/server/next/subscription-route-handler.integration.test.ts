import { describe, expect, it } from "vitest"
import { executeNextHttpApiHandler } from "../../api/next/node-handler.js"
import { createSubscriptionHttpApiHandler } from "./subscription-route-handler.js"

describe("subscription route production identity boundary", () => {
  it("returns forbidden without a resolver before accessing the subscription database", async () => {
    let databaseAccesses = 0
    const database = new Proxy(
      {},
      {
        get: () => {
          databaseAccesses += 1
          throw new Error("The database must not be accessed for an unauthenticated request")
        }
      }
    )
    const handler = createSubscriptionHttpApiHandler({
      config: {
        security: {},
        server: { publicApiBaseUrl: "https://api.example.test" }
      },
      database: database as never
    })
    const request = new Request("https://api.example.test/api/subscriptions", {
      headers: { "x-correlation-id": "subscription-fail-closed" }
    })

    const response = await executeNextHttpApiHandler(request, handler)

    expect(response.status).toBe(403)
    expect(response.headers.get("x-correlation-id")).toBe("subscription-fail-closed")
    await expect(response.json()).resolves.toEqual({
      error: {
        category: "forbidden",
        correlationId: "subscription-fail-closed",
        message: "An authenticated identity is required.",
        retryable: false
      }
    })
    expect(databaseAccesses).toBe(0)
  })
})
