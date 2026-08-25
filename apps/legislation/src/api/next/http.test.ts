import { describe, expect, it } from "vitest"
import { LegislationError } from "../../legislation/errors.js"
import { apiBatch, apiErrorResponse, apiPage, apiResource, apiSearchPage, jsonResponse, readJsonBody } from "./http.js"

describe("Web API response boundary", () => {
  it("builds resource, page, search, and batch envelopes with the caller correlation ID", async () => {
    const request = new Request("https://api.example.test/api/bills?limit=2", {
      headers: { "x-correlation-id": "caller-correlation" }
    })

    expect(apiResource(request, { id: "bill-1" })).toEqual({
      data: { id: "bill-1" },
      links: { self: "/api/bills" },
      meta: { correlationId: "caller-correlation", warnings: [] }
    })
    expect(apiPage(request, { items: [{ id: "bill-1" }], nextCursor: "next", truncated: false }, 2)).toMatchObject({
      links: { next: "/api/bills?limit=2&cursor=next", self: "/api/bills?limit=2" },
      meta: { correlationId: "caller-correlation", limit: 2, nextCursor: "next", truncated: false, warnings: [] }
    })
    expect(
      apiSearchPage(request, { items: [], truncated: false }, 2, { isReranked: true, mode: "hybrid", models: [] })
    ).toMatchObject({ meta: { correlationId: "caller-correlation", isReranked: true, mode: "hybrid" } })
    expect(apiBatch(request, [{ id: "bill-1", status: "ok" }], 2)).toMatchObject({
      meta: { correlationId: "caller-correlation", requested: 2, returned: 1, warnings: [] }
    })

    const generatedRequest = new Request("https://api.example.test/api/bills")
    const generatedResponse = jsonResponse(generatedRequest, 200, apiResource(generatedRequest, { id: "bill-1" }))
    expect(generatedResponse.headers.get("x-correlation-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
    await expect(generatedResponse.json()).resolves.toMatchObject({
      meta: { correlationId: generatedResponse.headers.get("x-correlation-id") }
    })
  })

  it("sends JSON with correlation and returns a bodyless 304 for a matching GET validator", async () => {
    const request = new Request("https://api.example.test/api/bills", {
      headers: { "if-none-match": 'W/"match"', "x-correlation-id": "caller-correlation" }
    })
    const response = jsonResponse(request, 200, { data: ["bill-1"] }, { headers: { etag: 'W/"match"' } })

    expect(response.status).toBe(304)
    expect(response.body).toBeNull()
    expect(response.headers.get("content-type")).toBeNull()
    expect(response.headers.get("etag")).toBe('W/"match"')
    expect(response.headers.get("x-correlation-id")).toBe("caller-correlation")

    const first = jsonResponse(new Request("https://api.example.test/api/bills"), 200, { data: ["bill-1"] })
    const second = jsonResponse(new Request("https://api.example.test/api/bills"), 200, { data: ["bill-1"] })
    expect(first.headers.get("etag")).toBe(second.headers.get("etag"))
    await expect(first.json()).resolves.toEqual({ data: ["bill-1"] })
  })

  it("maps errors and protects caller-provided retry-after values", async () => {
    const request = new Request("https://api.example.test/api/bills", {
      headers: { "x-correlation-id": "caller-correlation" }
    })
    const unavailable = apiErrorResponse(
      request,
      new LegislationError("dependency_unavailable", "Database is unavailable"),
      { headers: { "retry-after": "45" } }
    )
    const internal = apiErrorResponse(request, new Error("secret"))

    expect(unavailable.status).toBe(503)
    expect(unavailable.headers.get("retry-after")).toBe("45")
    await expect(unavailable.json()).resolves.toEqual({
      error: {
        category: "dependency_unavailable",
        correlationId: "caller-correlation",
        message: "Database is unavailable",
        retryable: true
      }
    })
    expect(internal.status).toBe(500)
    await expect(internal.json()).resolves.toMatchObject({ error: { category: "internal", retryable: false } })
  })

  it("reads bounded JSON request bodies and rejects aborted requests", async () => {
    const request = new Request("https://api.example.test/api/resources/batch", {
      body: JSON.stringify({ ids: ["bill-1"] }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    const oversized = new Request("https://api.example.test/api/resources/batch", {
      body: JSON.stringify({ ids: ["bill-1"] }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    const abortController = new AbortController()
    let bodyController: ReadableStreamDefaultController<Uint8Array> | undefined
    const aborted = new Request("https://api.example.test/api/resources/batch", {
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          bodyController = controller
        }
      }),
      duplex: "half",
      method: "POST",
      signal: abortController.signal
    })

    await expect(readJsonBody(request)).resolves.toEqual({ ids: ["bill-1"] })
    await expect(readJsonBody(oversized, 4)).rejects.toMatchObject({ category: "payload_too_large" })
    expect(bodyController).toBeDefined()
    abortController.abort(new DOMException("Cancelled", "AbortError"))
    await expect(readJsonBody(aborted)).rejects.toThrow("Cancelled")
  })

  it("preserves payload_too_large when cancelling an oversized body fails", async () => {
    const request = new Request("https://api.example.test/api/resources/batch", {
      body: new ReadableStream<Uint8Array>({
        cancel() {
          return Promise.reject(new Error("The stream could not be cancelled"))
        },
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"ids":["bill-1"]}'))
        }
      }),
      duplex: "half",
      method: "POST"
    })

    await expect(readJsonBody(request, 4)).rejects.toMatchObject({ category: "payload_too_large" })
  })
})
