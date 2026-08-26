import { describe, expect, it } from "vitest"
import * as route from "./[...path]/route"
import * as apiRoot from "./route"

const methods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"] as const
const bodyMethods = ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"] as const
const handlers = {
  DELETE: route.DELETE,
  GET: route.GET,
  HEAD: route.HEAD,
  OPTIONS: route.OPTIONS,
  PATCH: route.PATCH,
  POST: route.POST,
  PUT: route.PUT
} satisfies Readonly<Record<(typeof methods)[number], (request: Request) => Promise<Response>>>

describe("unknown API catch-all route", () => {
  it("returns the canonical not-found response for the exact /api path", async () => {
    const request = new Request("https://legislation.test/api", {
      headers: { "x-correlation-id": "api-root-test" }
    })
    const response = await apiRoot.GET(request)

    expect(response.status).toBe(404)
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-correlation-id")).toBe("api-root-test")
    await expect(response.json()).resolves.toEqual({
      error: {
        category: "not_found",
        correlationId: "api-root-test",
        message: "API route was not found",
        retryable: false
      }
    })
  })

  it.each(bodyMethods)("returns the canonical not-found response for %s", async (method) => {
    const request = new Request("https://legislation.test/api/unknown/resource?limit=1", {
      headers: { "x-correlation-id": "catch-all-test" },
      method
    })
    const response = await handlers[method](request)

    expect(response.status).toBe(404)
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-correlation-id")).toBe("catch-all-test")
    await expect(response.json()).resolves.toEqual({
      error: {
        category: "not_found",
        correlationId: "catch-all-test",
        message: "API route was not found",
        retryable: false
      }
    })
  })

  it("returns the canonical not-found headers for HEAD without a response body", async () => {
    const request = new Request("https://legislation.test/api/unknown/resource", {
      headers: { "x-correlation-id": "catch-all-head" },
      method: "HEAD"
    })
    const response = await handlers.HEAD(request)

    expect(response.status).toBe(404)
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-correlation-id")).toBe("catch-all-head")
    await expect(response.text()).resolves.toBe("")
  })

  it("exports the node runtime and all HTTP method handlers", () => {
    expect(route.runtime).toBe("nodejs")
    expect(Object.keys(route).sort()).toEqual([...methods, "runtime"].sort())
  })
})
