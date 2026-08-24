import { describe, expect, it, vi } from "vitest"
import { LegislationApiClient, type FetchLike } from "../api-client/client.js"
import { runWithRequestContext } from "../auth/request-context.js"
import { LegislationError } from "../legislation/errors.js"
import { HttpLegislationQueryAdapter } from "./http-query-adapter.js"
import { createMcpQueryApi } from "./query-transport.js"

function jsonResponse(payload: unknown, correlationId: string, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json", "x-correlation-id": correlationId },
    status
  })
}

function resource(data: unknown, correlationId: string) {
  return {
    data,
    links: { self: "https://api.example.test/api/bills/bill%3Aus%3A119%3Ahr%3A1" },
    meta: { correlationId, warnings: [] }
  }
}

function page(data: unknown[], correlationId: string) {
  return {
    data,
    links: { next: null, self: "https://api.example.test/api/people" },
    meta: { correlationId, limit: 20, nextCursor: null, truncated: false, warnings: ["coverage"] }
  }
}

describe("HttpLegislationQueryAdapter", () => {
  it("keeps the in-process service as the default rollback transport", () => {
    const inProcess = new HttpLegislationQueryAdapter(
      new LegislationApiClient({ baseUrl: "https://unused.example", fetch: vi.fn<FetchLike>() })
    )

    expect(createMcpQueryApi({ transport: "in-process" }, inProcess)).toBe(inProcess)
  })

  it("targets a co-located API route once without recursively calling MCP", async () => {
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      const correlationId = new Headers(init?.headers).get("x-correlation-id") ?? "missing"
      return jsonResponse(resource({ id: "bill:us:119:hr:1" }, correlationId), correlationId)
    })
    const inProcess = new HttpLegislationQueryAdapter(
      new LegislationApiClient({ baseUrl: "https://unused.example", fetch: vi.fn<FetchLike>() })
    )
    const adapter = createMcpQueryApi(
      { apiBaseUrl: "http://127.0.0.1:3100", timeoutMs: 30_000, transport: "http" },
      inProcess,
      fetch
    )

    await adapter.getBill({ id: "bill:us:119:hr:1" })

    expect(fetch).toHaveBeenCalledOnce()
    expect(String(fetch.mock.calls[0]?.[0])).toBe("http://127.0.0.1:3100/api/bills/bill%3Aus%3A119%3Ahr%3A1")
    expect(String(fetch.mock.calls[0]?.[0])).not.toContain("/mcp")
  })

  it("preserves legacy resource/page results and propagates request-scoped auth and correlation", async () => {
    const requests: Array<{ authorization: string | null; body?: unknown; correlationId: string | null; url: string }> =
      []
    const fetch: FetchLike = vi.fn<FetchLike>(async (input, init) => {
      const headers = new Headers(init?.headers)
      const correlationId = headers.get("x-correlation-id") ?? "missing"
      requests.push({
        authorization: headers.get("authorization"),
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
        correlationId,
        url: String(input)
      })
      return requests.length === 1
        ? jsonResponse(resource({ id: "bill:us:119:hr:1" }, correlationId), correlationId)
        : jsonResponse(page([{ id: "person:congress:a1" }], correlationId), correlationId)
    })
    const adapter = new HttpLegislationQueryAdapter(
      new LegislationApiClient({ baseUrl: "https://api.example.test", bearerToken: "service-token", fetch })
    )

    const [bill, people] = await runWithRequestContext(
      { bearerToken: "caller-token", correlationId: "mcp-correlation", identity: { userId: "user-1" } },
      async () =>
        await Promise.all([
          adapter.getBill({ id: "bill:us:119:hr:1" }),
          adapter.searchPeople({ jurisdictionId: "jurisdiction:us", limit: 20, query: "Smith" })
        ])
    )

    expect(bill).toEqual({ id: "bill:us:119:hr:1" })
    expect(people).toEqual({
      items: [{ id: "person:congress:a1" }],
      nextCursor: undefined,
      truncated: false,
      warnings: ["coverage"]
    })
    expect(requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          authorization: "Bearer caller-token",
          correlationId: "mcp-correlation",
          url: "https://api.example.test/api/bills/bill%3Aus%3A119%3Ahr%3A1"
        }),
        expect.objectContaining({
          authorization: "Bearer caller-token",
          correlationId: "mcp-correlation",
          url: "https://api.example.test/api/people?jurisdictionId=jurisdiction%3Aus&limit=20&q=Smith"
        })
      ])
    )
  })

  it("uses the configured service token when no authenticated MCP token is in context", async () => {
    let authorization: string | null = null
    const fetch: FetchLike = async (_input, init) => {
      const headers = new Headers(init?.headers)
      authorization = headers.get("authorization")
      const correlationId = headers.get("x-correlation-id") ?? "missing"
      return jsonResponse(resource({ id: "vote:congress:1" }, correlationId), correlationId)
    }
    const adapter = new HttpLegislationQueryAdapter(
      new LegislationApiClient({ baseUrl: "https://api.example.test", bearerToken: "service-token", fetch })
    )

    await adapter.getVote({ id: "vote:congress:1" })

    expect(authorization).toBe("Bearer service-token")
  })

  it("translates search filters and dates to the HTTP contract", async () => {
    let body: unknown
    const fetch: FetchLike = async (_input, init) => {
      body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined
      const correlationId = new Headers(init?.headers).get("x-correlation-id") ?? "missing"
      return jsonResponse(
        {
          ...page([], correlationId),
          meta: {
            ...page([], correlationId).meta,
            isReranked: false,
            mode: "lexical",
            models: []
          }
        },
        correlationId
      )
    }
    const adapter = new HttpLegislationQueryAdapter(
      new LegislationApiClient({ baseUrl: "https://api.example.test", fetch })
    )

    await adapter.searchSupportingMaterials({
      billId: "bill:us:119:hr:1",
      eventId: "event:congress:1",
      jurisdictionId: "jurisdiction:us",
      mode: "lexical",
      query: "fiscal note"
    })

    expect(body).toEqual({
      billIds: ["bill:us:119:hr:1"],
      jurisdictionIds: ["jurisdiction:us"],
      meetingIds: ["event:congress:1"],
      mode: "lexical",
      query: "fiscal note"
    })
  })

  it("preserves the complete searchBills request body", async () => {
    let body: unknown
    const fetch: FetchLike = async (_input, init) => {
      body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined
      const correlationId = new Headers(init?.headers).get("x-correlation-id") ?? "missing"
      const base = page([], correlationId)
      return jsonResponse(
        {
          ...base,
          meta: { ...base.meta, isReranked: true, mode: "hybrid", models: [{ name: "test-model" }] }
        },
        correlationId
      )
    }
    const adapter = new HttpLegislationQueryAdapter(
      new LegislationApiClient({ baseUrl: "https://api.example.test", fetch })
    )

    await adapter.searchBills({
      classifications: ["bill"],
      cursor: "cursor-1",
      introducedFrom: "2026-01-01",
      introducedTo: "2026-12-31",
      jurisdictionIds: ["jurisdiction:us"],
      limit: 25,
      mode: "hybrid",
      query: "water infrastructure",
      sessionIds: ["session:us:119"],
      sponsorIds: ["person:congress:a1"],
      statuses: ["introduced"],
      subjects: ["water"]
    })

    expect(body).toEqual({
      classifications: ["bill"],
      cursor: "cursor-1",
      introducedFrom: "2026-01-01",
      introducedTo: "2026-12-31",
      jurisdictionIds: ["jurisdiction:us"],
      limit: 25,
      mode: "hybrid",
      query: "water infrastructure",
      sessionIds: ["session:us:119"],
      sponsorIds: ["person:congress:a1"],
      statuses: ["introduced"],
      subjects: ["water"]
    })
  })

  it("maps API errors without leaking configured credentials", async () => {
    const secret = "service-token-that-must-not-leak"
    const fetch: FetchLike = async (_input, init) => {
      const correlationId = new Headers(init?.headers).get("x-correlation-id") ?? "missing"
      return jsonResponse(
        { error: { category: "not_found", correlationId, message: "Bill was not found", retryable: false } },
        correlationId,
        404
      )
    }
    const adapter = new HttpLegislationQueryAdapter(
      new LegislationApiClient({ baseUrl: "https://api.example.test", bearerToken: secret, fetch })
    )

    const error = await adapter.getBill({ id: "bill:us:119:hr:missing" }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(LegislationError)
    expect(error).toMatchObject({ category: "not_found", message: "Bill was not found" })
    expect(String(error)).not.toContain(secret)
  })

  it("fails closed for MCP tools without an HTTP API parity route", async () => {
    const adapter = new HttpLegislationQueryAdapter(
      new LegislationApiClient({ baseUrl: "https://api.example.test", fetch: vi.fn<FetchLike>() })
    )

    await expect(adapter.getCalendar({ jurisdictionId: "jurisdiction:us" })).rejects.toMatchObject({
      category: "dependency_unavailable"
    })
    await expect(adapter.searchEvents({ classification: ["hearing"] })).rejects.toMatchObject({
      category: "dependency_unavailable"
    })
  })
})
