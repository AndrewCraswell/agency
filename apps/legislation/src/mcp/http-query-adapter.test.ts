import { describe, expect, it, vi } from "vitest"
import type { FetchLike } from "../api-client/client.js"
import { runWithRequestContext } from "../auth/request-context.js"
import { LegislationError } from "../legislation/errors.js"
import { createMcpHttpQueryAdapter } from "./http-query-adapter.js"

const correlationId = "mcp-correlation-id"

function resourceResponse(data: unknown): Response {
  return jsonResponse({ data, links: { self: "/api/resource" }, meta: { correlationId, warnings: [] } })
}

function pageResponse(data: readonly unknown[] = []): Response {
  return jsonResponse({
    data,
    links: { next: null, self: "/api/page" },
    meta: { correlationId, limit: 20, nextCursor: null, truncated: false, warnings: [] }
  })
}

function searchResponse(data: readonly unknown[] = []): Response {
  return jsonResponse({
    data,
    links: { next: null, self: "/api/search" },
    meta: {
      correlationId,
      isReranked: false,
      limit: 20,
      mode: "lexical",
      models: [],
      nextCursor: null,
      truncated: false,
      warnings: []
    }
  })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "x-correlation-id": correlationId },
    status
  })
}

describe("createMcpHttpQueryAdapter", () => {
  it("uses the API M2M credential and keeps the MCP bearer token out of API requests", async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue(resourceResponse({ id: "bill:ca:2025:ab:1" }))
    const getApiAccessToken = vi.fn<() => Promise<string>>(async () => "api-m2m-token")
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://legislation.example.test",
      fetch,
      getApiAccessToken
    })

    const result = await runWithRequestContext(
      { bearerToken: "mcp-resource-token", correlationId },
      async () => await adapter.getBill({ id: "bill:ca:2025:ab:1" })
    )

    const [url, init] = fetch.mock.calls[0] ?? []
    expect(result).toEqual({ id: "bill:ca:2025:ab:1" })
    expect(String(url)).toBe("https://legislation.example.test/api/bills/bill%3Aca%3A2025%3Aab%3A1")
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer api-m2m-token")
    expect(new Headers(init?.headers).get("authorization")).not.toContain("mcp-resource-token")
    expect(new Headers(init?.headers).get("x-correlation-id")).toBe(correlationId)
    expect(getApiAccessToken).toHaveBeenCalledOnce()
  })

  it("maps search and timeline tools onto documented public API paths and public output pages", async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(searchResponse([{ id: "bill:ca:2025:ab:1" }]))
      .mockResolvedValueOnce(pageResponse([{ id: "timeline:1" }]))
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://legislation.example.test",
      fetch,
      getApiAccessToken: () => "api-m2m-token"
    })

    const [search, timeline] = await runWithRequestContext({ correlationId }, async () =>
      Promise.all([
        adapter.searchBills({ mode: "lexical", query: "housing" }),
        adapter.getBillTimeline({ id: "bill:ca:2025:ab:1" })
      ])
    )

    expect(search).toEqual({
      items: [{ id: "bill:ca:2025:ab:1" }],
      nextCursor: undefined,
      search: { isReranked: false, mode: "lexical", models: [] },
      truncated: false,
      warnings: []
    })
    expect(timeline).toEqual({
      billId: "bill:ca:2025:ab:1",
      events: [{ id: "timeline:1" }],
      nextChildCursor: null,
      truncated: false,
      warnings: []
    })
    expect(fetch.mock.calls.map(([url, init]) => [new URL(String(url)).pathname, init?.method, init?.body])).toEqual([
      ["/api/search/bills", "POST", JSON.stringify({ mode: "lexical", query: "housing" })],
      ["/api/bills/bill%3Aca%3A2025%3Aab%3A1/timeline", "GET", undefined]
    ])
  })

  it("converts singular MCP amendment filters to public API search arrays", async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue(searchResponse())
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://legislation.example.test",
      fetch,
      getApiAccessToken: () => "api-m2m-token"
    })

    await runWithRequestContext(
      { correlationId },
      async () =>
        await adapter.searchAmendments({
          billId: "bill:ca:2025:ab:1",
          jurisdictionId: "jurisdiction:ca",
          mode: "lexical",
          query: "housing",
          sponsorPersonId: "person:1"
        })
    )

    expect(new URL(String(fetch.mock.calls[0]?.[0])).pathname).toBe("/api/search/amendments")
    expect(fetch.mock.calls[0]?.[1]?.method).toBe("POST")
    expect(fetch.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({
        billIds: ["bill:ca:2025:ab:1"],
        jurisdictionIds: ["jurisdiction:ca"],
        mode: "lexical",
        query: "housing",
        sponsorPersonIds: ["person:1"]
      })
    )
  })

  it("maps MCP bill-text filter names onto the public passage-search schema", async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue(searchResponse())
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://legislation.example.test",
      fetch,
      getApiAccessToken: () => "api-m2m-token"
    })

    await runWithRequestContext(
      { correlationId },
      async () =>
        await adapter.searchBillText({
          billId: "bill:ca:2025:ab:1",
          classifications: ["bill"],
          mode: "lexical",
          query: "housing"
        })
    )

    expect(new URL(String(fetch.mock.calls[0]?.[0])).pathname).toBe("/api/search/passages")
    expect(fetch.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({
        billIds: ["bill:ca:2025:ab:1"],
        documentClassifications: ["bill"],
        mode: "lexical",
        query: "housing"
      })
    )
  })

  it.each([
    [
      "compare_bill_versions",
      resourceResponse({}),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) =>
        adapter.compareBillVersions({
          billId: "bill:ca:2025:ab:1",
          documentIds: ["document:left", "document:right"]
        }),
      "/api/document-diffs",
      "POST",
      {},
      { billId: "bill:ca:2025:ab:1", leftDocumentId: "document:left", rightDocumentId: "document:right" }
    ],
    [
      "find_related_bills",
      pageResponse(),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) =>
        adapter.findRelatedBills({ id: "bill:ca:2025:ab:1", limit: 5 }),
      "/api/bills/bill%3Aca%3A2025%3Aab%3A1/related",
      "GET",
      { limit: "5" },
      undefined
    ],
    [
      "get_amendment",
      resourceResponse({}),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) => adapter.getAmendment({ id: "amendment:1" }),
      "/api/amendments/amendment%3A1",
      "GET",
      {},
      undefined
    ],
    [
      "get_bill",
      resourceResponse({}),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) =>
        adapter.getBill({ childLimit: 5, id: "bill:ca:2025:ab:1" }),
      "/api/bills/bill%3Aca%3A2025%3Aab%3A1",
      "GET",
      { childLimit: "5" },
      undefined
    ],
    [
      "get_bill_votes",
      pageResponse(),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) =>
        adapter.getBillVotes({ billId: "bill:ca:2025:ab:1", cursor: "next", limit: 5 }),
      "/api/bills/bill%3Aca%3A2025%3Aab%3A1/votes",
      "GET",
      { cursor: "next", limit: "5" },
      undefined
    ],
    [
      "get_bill_text",
      pageResponse(),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) =>
        adapter.getBillText({ documentId: "document:1", id: "bill:ca:2025:ab:1", versionCode: "v1" }),
      "/api/bills/bill%3Aca%3A2025%3Aab%3A1/sections",
      "GET",
      { documentId: "document:1", versionCode: "v1" },
      undefined
    ],
    [
      "get_bill_timeline",
      pageResponse(),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) =>
        adapter.getBillTimeline({ id: "bill:ca:2025:ab:1", limit: 5 }),
      "/api/bills/bill%3Aca%3A2025%3Aab%3A1/timeline",
      "GET",
      { limit: "5" },
      undefined
    ],
    [
      "get_event",
      resourceResponse({}),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) => adapter.getEvent({ id: "event:1" }),
      "/api/meetings/event%3A1",
      "GET",
      {},
      undefined
    ],
    [
      "get_organization",
      resourceResponse({}),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) => adapter.getOrganization({ id: "organization:1" }),
      "/api/organizations/organization%3A1",
      "GET",
      {},
      undefined
    ],
    [
      "get_person",
      resourceResponse({}),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) => adapter.getPerson({ id: "person:1" }),
      "/api/people/person%3A1",
      "GET",
      {},
      undefined
    ],
    [
      "get_supporting_material",
      resourceResponse({}),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) => adapter.getSupportingMaterial({ id: "material:1" }),
      "/api/supporting-materials/material%3A1",
      "GET",
      {},
      undefined
    ],
    [
      "get_vote",
      resourceResponse({}),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) => adapter.getVote({ id: "vote:1" }),
      "/api/votes/vote%3A1",
      "GET",
      {},
      undefined
    ],
    [
      "search_amendments",
      searchResponse(),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) =>
        adapter.searchAmendments({ billId: "bill:ca:2025:ab:1", mode: "lexical", query: "housing" }),
      "/api/search/amendments",
      "POST",
      {},
      { billIds: ["bill:ca:2025:ab:1"], mode: "lexical", query: "housing" }
    ],
    [
      "search_bills",
      searchResponse(),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) => adapter.searchBills({ query: "housing" }),
      "/api/search/bills",
      "POST",
      {},
      { query: "housing" }
    ],
    [
      "search_bill_text",
      searchResponse(),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) => adapter.searchBillText({ query: "housing" }),
      "/api/search/passages",
      "POST",
      {},
      { query: "housing" }
    ],
    [
      "search_changes",
      pageResponse(),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) =>
        adapter.searchChanges({ classification: "update", observedFrom: new Date("2026-01-01T00:00:00.000Z") }),
      "/api/changes",
      "GET",
      { classification: "update", observedFrom: "2026-01-01T00:00:00.000Z" },
      undefined
    ],
    [
      "search_events",
      pageResponse(),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) =>
        adapter.searchEvents({ from: new Date("2026-01-01T00:00:00.000Z"), jurisdictionId: "jurisdiction:ca" }),
      "/api/meetings",
      "GET",
      { from: "2026-01-01T00:00:00.000Z", jurisdictionId: "jurisdiction:ca" },
      undefined
    ],
    [
      "search_organizations",
      pageResponse(),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) => adapter.searchOrganizations({ query: "housing" }),
      "/api/organizations",
      "GET",
      { q: "housing" },
      undefined
    ],
    [
      "search_people",
      pageResponse(),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) => adapter.searchPeople({ query: "Ada" }),
      "/api/people",
      "GET",
      { q: "Ada" },
      undefined
    ],
    [
      "search_supporting_materials",
      searchResponse(),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) =>
        adapter.searchSupportingMaterials({ billId: "bill:ca:2025:ab:1", mode: "lexical", query: "housing" }),
      "/api/search/supporting-materials",
      "POST",
      {},
      { billIds: ["bill:ca:2025:ab:1"], mode: "lexical", query: "housing" }
    ],
    [
      "search_votes",
      pageResponse(),
      (adapter: ReturnType<typeof createMcpHttpQueryAdapter>) => adapter.searchVotes({ personId: "person:1" }),
      "/api/votes",
      "GET",
      { personId: "person:1" },
      undefined
    ]
  ])("maps %s to its documented HTTP operation", async (_name, response, invoke, path, method, parameters, body) => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue(response)
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://legislation.example.test",
      fetch,
      getApiAccessToken: () => "api-m2m-token"
    })

    await runWithRequestContext({ correlationId }, async () => await invoke(adapter))

    const [url, init] = fetch.mock.calls[0] ?? []
    expect(new URL(String(url)).pathname).toBe(path)
    expect(init?.method).toBe(method)
    expect(Object.fromEntries(new URL(String(url)).searchParams)).toEqual(parameters)
    expect(init?.body === undefined ? undefined : JSON.parse(String(init.body))).toEqual(body)
  })

  it("maps API error categories and retryability for MCP tool responses", async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse(
        {
          error: {
            category: "not_found",
            correlationId,
            message: "Bill not found",
            retryable: false,
            details: { reason: "record_not_visible" }
          }
        },
        404
      )
    )
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://legislation.example.test",
      fetch,
      getApiAccessToken: () => "api-m2m-token"
    })

    await expect(
      runWithRequestContext({ correlationId }, async () => await adapter.getBill({ id: "bill:ca:2025:ab:404" }))
    ).rejects.toMatchObject({
      category: "not_found",
      details: { correlationId, retryable: false, status: 404, reason: "record_not_visible" },
      name: LegislationError.name
    })
  })
})
