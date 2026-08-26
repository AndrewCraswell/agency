import { describe, expect, it } from "vitest"
import { getRequestContext } from "../../auth/request-context.js"
import { LegislationError } from "../../legislation/errors.js"
import { CanonicalProjectionError } from "../canonical-projection.js"
import { readJsonBody, sendApiError, sendApiJson, type HttpApiHandler } from "../http.js"
import { executeNextHttpApiHandler } from "./node-handler.js"

describe("Next Node HTTP handler bridge", () => {
  it("preserves a JSON success response and correlation ID", async () => {
    const handler: HttpApiHandler = async (request, response) => {
      sendApiJson(response, 200, {
        data: { id: "bill-1" },
        links: { self: "/api/bills/bill-1" },
        meta: { correlationId: request.headers["x-correlation-id"], warnings: [] }
      })
      return true
    }

    const response = await executeNextHttpApiHandler(
      new Request("https://api.example.test/api/bills/bill-1", { headers: { "x-correlation-id": "next-bridge" } }),
      handler
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("x-correlation-id")).toBe("next-bridge")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    await expect(response.json()).resolves.toMatchObject({ data: { id: "bill-1" } })
  })

  it("installs a verified identity for the complete Node handler execution", async () => {
    const identity = { organizationId: "organization:test", userId: "user:test" }
    const handler: HttpApiHandler = async (_request, response) => {
      sendApiJson(response, 200, { data: getRequestContext()?.identity })
      return true
    }

    const response = await executeNextHttpApiHandler(
      new Request("https://api.example.test/api/subscriptions"),
      handler,
      { requestContext: { identity } }
    )

    await expect(response.json()).resolves.toEqual({ data: identity })
  })

  it("preserves an ETag-driven 304 response", async () => {
    const handler: HttpApiHandler = async (_request, response) => {
      response.setHeader("etag", 'W/"bill-1"')
      sendApiJson(response, 200, { data: { id: "bill-1" } })
      return true
    }

    const response = await executeNextHttpApiHandler(
      new Request("https://api.example.test/api/bills/bill-1", { headers: { "if-none-match": 'W/"bill-1"' } }),
      handler
    )

    expect(response.status).toBe(304)
    expect(response.body).toBeNull()
    expect(response.headers.get("etag")).toBe('W/"bill-1"')
  })

  it("returns the canonical JSON not-found envelope when the handler declines a route", async () => {
    const handler: HttpApiHandler = async () => false

    const response = await executeNextHttpApiHandler(
      new Request("https://api.example.test/api/missing", { headers: { "x-correlation-id": "missing-route" } }),
      handler
    )

    expect(response.status).toBe(404)
    expect(response.headers.get("x-correlation-id")).toBe("missing-route")
    await expect(response.json()).resolves.toEqual({
      error: {
        category: "not_found",
        correlationId: "missing-route",
        message: "API route was not found",
        retryable: false
      }
    })
  })

  it("preserves Node error headers", async () => {
    const handler: HttpApiHandler = async (request, response) => {
      sendApiError(request, response, new LegislationError("dependency_unavailable", "Database is unavailable"))
      return true
    }

    const response = await executeNextHttpApiHandler(new Request("https://api.example.test/api/bills"), handler)

    expect(response.status).toBe(503)
    expect(response.headers.get("retry-after")).toBe("30")
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "dependency_unavailable", retryable: true }
    })
  })

  it("maps a thrown domain error into the canonical error envelope", async () => {
    const handler: HttpApiHandler = async () => {
      throw new LegislationError("invalid_request", "limit must be between 1 and 100")
    }

    const response = await executeNextHttpApiHandler(
      new Request("https://api.example.test/api/bills", { headers: { "x-correlation-id": "thrown-domain-error" } }),
      handler
    )

    expect(response.status).toBe(400)
    expect(response.headers.get("x-correlation-id")).toBe("thrown-domain-error")
    await expect(response.json()).resolves.toEqual({
      error: {
        category: "invalid_request",
        correlationId: "thrown-domain-error",
        message: "limit must be between 1 and 100",
        retryable: false
      }
    })
  })

  it("maps an unexpected handler error into the canonical internal envelope", async () => {
    const handler: HttpApiHandler = async () => {
      throw new Error("Database column is unavailable")
    }

    const response = await executeNextHttpApiHandler(
      new Request("https://api.example.test/api/jurisdictions?limit=1", {
        headers: { "x-correlation-id": "unexpected-handler-error" }
      }),
      handler
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: {
        category: "internal",
        correlationId: "unexpected-handler-error",
        message: "The request could not be completed",
        retryable: false
      }
    })
  })

  it("maps canonical projection and transient database failures without masking SQL bugs", async () => {
    const projection = await executeNextHttpApiHandler(
      new Request("https://api.example.test/api/search/amendments", {
        headers: { "x-correlation-id": "projection-error" }
      }),
      async () => {
        throw new CanonicalProjectionError("missing source")
      }
    )
    const database = await executeNextHttpApiHandler(
      new Request("https://api.example.test/api/search/bills", { headers: { "x-correlation-id": "database-error" } }),
      async () => {
        throw { cause: { code: "53100" }, code: "XX000" }
      }
    )
    const sqlBug = await executeNextHttpApiHandler(
      new Request("https://api.example.test/api/search/bills", { headers: { "x-correlation-id": "sql-bug" } }),
      async () => {
        throw { code: "42P01", message: "relation does not exist" }
      }
    )

    expect(projection.status).toBe(422)
    await expect(projection.json()).resolves.toMatchObject({ error: { category: "unprocessable" } })
    expect(database.status).toBe(503)
    await expect(database.json()).resolves.toMatchObject({ error: { category: "dependency_unavailable" } })
    expect(sqlBug.status).toBe(500)
    await expect(sqlBug.json()).resolves.toMatchObject({ error: { category: "internal" } })
  })

  it("streams a bounded request body into the existing Node handler", async () => {
    const handler: HttpApiHandler = async (request, response) => {
      const body = await readJsonBody(request)
      sendApiJson(response, 200, { data: body })
      return true
    }

    const response = await executeNextHttpApiHandler(
      new Request("https://api.example.test/api/resources/batch", {
        body: JSON.stringify({ ids: ["bill-1"] }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      handler
    )

    await expect(response.json()).resolves.toEqual({ data: { ids: ["bill-1"] } })
  })

  it("enforces the bridge body ceiling through the existing error envelope", async () => {
    const handler: HttpApiHandler = async (request, response) => {
      try {
        await readJsonBody(request)
        sendApiJson(response, 200, { data: "unexpected" })
      } catch (error) {
        sendApiError(request, response, error)
      }
      return true
    }

    const response = await executeNextHttpApiHandler(
      new Request("https://api.example.test/api/resources/batch", {
        body: JSON.stringify({ ids: ["bill-1"] }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      handler,
      { maximumBodyBytes: 4 }
    )

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "payload_too_large" } })
  })

  it("cancels the Node stream and rejects when the Web request is aborted", async () => {
    const abortController = new AbortController()
    const handler: HttpApiHandler = async (request) => {
      for await (const _chunk of request) {
        throw new Error("The body should not produce a chunk")
      }
      return true
    }
    const request = new Request("https://api.example.test/api/resources/batch", {
      body: new ReadableStream<Uint8Array>({}),
      duplex: "half",
      method: "POST",
      signal: abortController.signal
    })
    const pending = executeNextHttpApiHandler(request, handler)

    abortController.abort(new DOMException("Cancelled", "AbortError"))

    await expect(pending).rejects.toThrow("Cancelled")
  })
})
