import type { FetchLike } from "@repo/legislation-core/api-client/client"
import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { createLegislationResearchTools } from "@repo/legislation-core/research/tools"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { requestSignals } from "../request-signal.js"
import { createMcpHttpQueryAdapter } from "./http-query-adapter.js"

const correlationId = "mcp-correlation-id"

function resourceResponse(data: unknown): Response {
  return jsonResponse({ data, links: { self: "/api/resource" }, meta: { correlationId, warnings: [] } })
}

function pageResponse(data: readonly unknown[] = [], nextCursor: string | null = null, limit = 20): Response {
  return jsonResponse({
    data,
    links: { next: null, self: "/api/page" },
    meta: { correlationId, limit, nextCursor, truncated: nextCursor !== null, warnings: [] }
  })
}

function votePositions(voteId = "vote:1", count = 430) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${voteId}:position:${index}`,
    type: "vote-position",
    voteId,
    person: null,
    option: index % 2 === 0 ? "yes" : "no",
    sourceName: `Member ${index}`,
    sourcePersonId: `publisher:${index}`,
    sources: [{ url: `https://publisher.example.test/votes/${index}`, isOfficial: true }]
  }))
}

function voteDetail(id = "vote:1", positions = votePositions(id)) {
  return {
    id,
    type: "vote",
    counts: { yes: 215, no: 200, absent: 0, abstain: 0, notVoting: 12, present: 3, proxy: 0, paired: 0, other: 0 },
    positions: positions.slice(0, 25),
    positionsPageInfo: {
      limit: 25,
      nextCursor: positions.length > 25 ? "positions:25" : null,
      truncated: positions.length > 25
    }
  }
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
  it("uses the identity-bound credential for passage list and detail reads", async () => {
    const versionId = "00000000-0000-4000-8000-000000000001"
    const editionId = "00000000-0000-4000-8000-000000000002"
    const passageId = "a".repeat(64)
    const passage = {
      id: passageId,
      generationId: "b".repeat(64),
      versionId,
      ordinal: 0,
      start: 0,
      end: 4,
      text: "Rule",
      tokenCount: 1,
      readerSpans: [{ blockId: "c".repeat(64), start: 0, end: 4 }],
      contextSpans: [],
      inputHash: "d".repeat(64),
      rowContinuation: null,
      selectedContext: {
        kind: "provision",
        editionId,
        provisionId: "00000000-0000-4000-8000-000000000003",
        versionId,
        sourceObservationId: "e".repeat(64),
        sourceId: "ecfr",
        rightsPolicyHash: "f".repeat(64),
        parentId: null,
        sourceLocator: "/ECFR[1]",
        sourceCurrencyDate: "2026-09-17",
        selectedDate: null,
        basis: "observed_snapshot",
        legalStatus: "unknown"
      },
      textUrl: `/api/legal/versions/${versionId}/text?editionId=${editionId}`
    }
    const fetch = vi.fn<FetchLike>(async (request, init) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer legal-api-token")
      return new URL(String(request)).pathname.includes("/versions/")
        ? pageResponse([passage])
        : resourceResponse(passage)
    })
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://api.example.test",
      fetch,
      getApiAccessToken: () => "general-token",
      legalText: { allowedOrganizationIds: ["org"], getApiAccessToken: () => "legal-api-token" }
    })
    await runWithRequestContext({ correlationId, identity: { organizationId: "org", userId: "user" } }, async () => {
      expect(await adapter.listLegalPassages?.({ versionId, editionId })).toMatchObject({ data: [passage] })
      expect(await adapter.getLegalPassage?.({ passageId, editionId })).toMatchObject({ data: passage })
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("uses a separate API credential for exact provision retrieval", async () => {
    const provisionId = "00000000-0000-4000-8000-000000000001"
    const versionId = "00000000-0000-4000-8000-000000000002"
    const codeId = "00000000-0000-4000-8000-000000000003"
    const fetch = vi.fn<FetchLike>(async () =>
      resourceResponse({
        id: provisionId,
        codeId,
        identityKey: "section:1",
        identityBasis: "citation",
        selectedVersion: {
          id: versionId,
          provisionId,
          codeId,
          contentHash: "a".repeat(64),
          inputContract: "reader",
          heading: "Purpose",
          nodeKind: "section",
          language: "en"
        },
        selectedContext: null,
        textPreview: "Source evidence",
        previewTruncated: false
      })
    )
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://api.example.test",
      fetch,
      getApiAccessToken: () => "general-token",
      legalText: { allowedOrganizationIds: ["org"], getApiAccessToken: () => "legal-api-token" }
    })
    const result = await runWithRequestContext(
      { correlationId, identity: { organizationId: "org", userId: "user" } },
      () => adapter.getLegalProvision?.({ provisionId, versionId })
    )
    expect(result).toMatchObject({ data: { id: provisionId, selectedVersion: { id: versionId } } })
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(String(url)).toBe(`https://api.example.test/api/legal/provisions/${provisionId}?versionId=${versionId}`)
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer legal-api-token")
  })

  it("forwards analytics plans in one correlated authenticated HTTP request", async () => {
    const fetch = vi.fn<FetchLike>(async () =>
      resourceResponse({ rows: [{ total: 12 }], receipt: { queryHash: "analytics-query" } })
    )
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://api.example.test",
      fetch,
      getApiAccessToken: () => "api-token"
    })
    const tool = createLegislationResearchTools(
      adapter,
      createLogger({ service: "analytics-test", level: "error" })
    ).find((tool) => tool.name === "analyze_legislation")
    expect(tool).toBeDefined()
    const result = await runWithRequestContext(
      { correlationId },
      async () =>
        await tool?.execute({ dataset: "bills", metrics: [{ name: "total", operation: "countDistinct", field: "id" }] })
    )
    expect(result).toHaveProperty("structuredContent.data.rows.0.total", 12)
    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(String(url)).toBe("https://api.example.test/api/analytics")
    expect(init?.method).toBe("POST")
    expect(new Headers(init?.headers).get("x-correlation-id")).toBe(correlationId)
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer api-token")
    expect(JSON.parse(String(init?.body))).toMatchObject({ dataset: "bills", limit: 20 })
  })
  it("gathers all 430 positions through the typed HTTP client and preserves published counts", async () => {
    const positions = votePositions()
    const detail = voteDetail()
    const fetch = vi.fn<FetchLike>(async (input) => {
      const url = new URL(String(input))
      if (!url.pathname.endsWith("/positions")) {
        return resourceResponse(detail)
      }
      expect(url.pathname).toBe("/api/votes/vote%3A1/positions")
      expect(url.searchParams.get("limit")).toBe("100")
      const offset = Number(url.searchParams.get("cursor")?.split(":")[1])
      const end = Math.min(offset + 100, positions.length)
      return pageResponse(positions.slice(offset, end), end < positions.length ? `positions:${end}` : null, 100)
    })
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://api.example.test",
      fetch,
      getApiAccessToken: () => "api-token"
    })

    const result = await runWithRequestContext({ correlationId }, () => adapter.getVote({ id: "vote:1" }))

    expect(result).toEqual({
      ...detail,
      positions,
      positionsPageInfo: { limit: 430, nextCursor: null, truncated: false }
    })
    expect(fetch).toHaveBeenCalledTimes(6)
    expect(fetch.mock.calls.slice(1).map(([input]) => new URL(String(input)).searchParams.get("cursor"))).toEqual([
      "positions:25",
      "positions:125",
      "positions:225",
      "positions:325",
      "positions:425"
    ])
    for (const [, init] of fetch.mock.calls) {
      expect(init?.method).toBe("GET")
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer api-token")
      expect(new Headers(init?.headers).get("x-correlation-id")).toBe(correlationId)
    }
  })

  it("expands each bill vote by its own ID and child cursor without consuming the outer continuation", async () => {
    const first = votePositions("vote:1", 26)
    const second = votePositions("vote:2", 26)
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(
        pageResponse([voteDetail("vote:1", first), voteDetail("vote:2", second)], "bill-votes:next")
      )
      .mockResolvedValueOnce(pageResponse(first.slice(25), null, 100))
      .mockResolvedValueOnce(pageResponse(second.slice(25), null, 100))
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://api.example.test",
      fetch,
      getApiAccessToken: () => "api-token"
    })

    await expect(
      runWithRequestContext({ correlationId }, () =>
        adapter.getBillVotes({ billId: "bill:1", cursor: "bill-votes:start", limit: 2 })
      )
    ).resolves.toEqual({
      items: [
        {
          ...voteDetail("vote:1", first),
          positions: first,
          positionsPageInfo: { limit: 26, nextCursor: null, truncated: false }
        },
        {
          ...voteDetail("vote:2", second),
          positions: second,
          positionsPageInfo: { limit: 26, nextCursor: null, truncated: false }
        }
      ],
      nextCursor: "bill-votes:next",
      truncated: true,
      warnings: []
    })
    expect(fetch.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
      "/api/bills/bill%3A1/votes",
      "/api/votes/vote%3A1/positions",
      "/api/votes/vote%3A2/positions"
    ])
    expect(new URL(String(fetch.mock.calls[0]?.[0])).searchParams.get("cursor")).toBe("bill-votes:start")
    expect(fetch.mock.calls.slice(1).map(([input]) => new URL(String(input)).searchParams.get("cursor"))).toEqual([
      "positions:25",
      "positions:25"
    ])
  })

  it.each([
    ["duplicate positions", () => pageResponse(votePositions().slice(0, 1), null, 100)],
    ["mismatched votes", () => pageResponse(votePositions("vote:other", 1), null, 100)],
    ["repeated cursors", () => pageResponse(votePositions().slice(25, 26), "positions:25", 100)],
    ["no progress", () => pageResponse([], "positions:next", 100)],
    ["empty terminal pages", () => pageResponse([], null, 100)],
    ["invalid positions", () => pageResponse([{}], null, 100)],
    [
      "inconsistent page flags",
      () =>
        jsonResponse({
          data: votePositions().slice(25, 26),
          links: { self: "/api/page", next: null },
          meta: { correlationId, limit: 100, nextCursor: null, truncated: true, warnings: [] }
        })
    ]
  ])("fails explicitly on %s during continuation", async (_name, continuation) => {
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(resourceResponse(voteDetail()))
      .mockImplementationOnce(async () => continuation())
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://api.example.test",
      fetch,
      getApiAccessToken: () => "api-token"
    })

    await expect(
      runWithRequestContext({ correlationId }, () => adapter.getVote({ id: "vote:1" }))
    ).rejects.toMatchObject({ category: "dependency_unavailable", details: { retryable: false } })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("propagates invalid snapshot cursor errors instead of returning initial positions", async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(resourceResponse(voteDetail()))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              category: "invalid_request",
              correlationId,
              message: "Invalid vote position pagination cursor",
              retryable: false
            }
          },
          400
        )
      )
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://api.example.test",
      fetch,
      getApiAccessToken: () => "api-token"
    })
    await expect(
      runWithRequestContext({ correlationId }, () => adapter.getVote({ id: "vote:1" }))
    ).rejects.toMatchObject({ category: "invalid_request", details: { retryable: false, status: 400 } })
  })

  it("cancels position continuation when the MCP request is cancelled", async () => {
    const controller = new AbortController()
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(resourceResponse(voteDetail()))
      .mockImplementationOnce(async (_input, init) => {
        controller.abort()
        init?.signal?.throwIfAborted()
        return pageResponse()
      })
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://api.example.test",
      fetch,
      getApiAccessToken: () => "api-token"
    })
    await expect(
      runWithRequestContext({ correlationId }, () =>
        requestSignals.run(controller.signal, () => adapter.getVote({ id: "vote:1" }))
      )
    ).rejects.toMatchObject({ category: "dependency_unavailable", details: { retryable: true } })
  })

  it("applies the configured read deadline to position continuation", async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(resourceResponse(voteDetail()))
      .mockImplementationOnce(async (_input, init) => {
        const signal = init?.signal
        if (!signal) throw new Error("Expected the API request signal")
        signal.throwIfAborted()
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true })
        })
      })
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://api.example.test",
      fetch,
      getApiAccessToken: () => "api-token",
      timeoutMs: 10
    })
    await expect(
      runWithRequestContext({ correlationId }, () => adapter.getVote({ id: "vote:1" }))
    ).rejects.toMatchObject({ category: "dependency_unavailable", details: { retryable: true } })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it.each([
    { name: "get_vote", input: { id: "vote:1" } },
    { name: "get_votes", input: { ids: ["vote:1"] } },
    { name: "get_bill_votes", input: { billId: "bill:us:119:house:hr-1" } }
  ])("delivers all 430 HTTP positions through $name pages below 180,000 bytes", async ({ name, input }) => {
    const positions = votePositions().map((position) => ({
      ...position,
      sources: [
        { url: `https://publisher.example.test/${"source-record/".repeat(50)}${position.id}`, isOfficial: true }
      ]
    }))
    const detail = voteDetail("vote:1", positions)
    const fetch = vi.fn<FetchLike>(async (input) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith("/positions")) {
        const offset = Number(url.searchParams.get("cursor")?.split(":")[1])
        const end = Math.min(offset + 100, positions.length)
        return pageResponse(positions.slice(offset, end), end < positions.length ? `positions:${end}` : null, 100)
      }
      expect(url.searchParams.has("cursor")).toBe(false)
      if (url.pathname.startsWith("/api/bills/")) return pageResponse([detail])
      return resourceResponse(detail)
    })
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://api.example.test",
      fetch,
      getApiAccessToken: () => "api-token"
    })
    const logger = createLogger({ level: "error", service: "mcp-vote-test", write: () => undefined })
    const tool = createLegislationResearchTools(adapter, logger).find((definition) => definition.name === name)
    if (!tool) throw new Error(`Missing tool ${name}`)
    const collected: unknown[] = []
    const cursors = new Set<string>()
    let cursor: string | undefined
    let pageCount = 0
    do {
      const result = await runWithRequestContext({ correlationId }, () => tool.execute({ ...input, cursor }))
      expect("isError" in result && result.isError).toBe(false)
      if (!("structuredContent" in result)) throw new Error("Expected vote result data")
      expect(Buffer.byteLength(JSON.stringify(result.structuredContent), "utf8")).toBeLessThanOrEqual(180_000)
      const data = result.structuredContent.data
      let records: unknown[] = [data]
      if (name !== "get_vote") records = z.object({ items: z.array(z.unknown()) }).parse(data).items
      for (const record of records) {
        const value = name === "get_votes" ? z.object({ data: z.unknown() }).parse(record).data : record
        const parsed = z.object({ counts: z.unknown(), positions: z.array(z.unknown()) }).parse(value)
        expect(parsed.counts).toEqual(detail.counts)
        collected.push(...parsed.positions)
      }
      const page = z.object({ nextCursor: z.string().nullish(), truncated: z.boolean().optional() }).parse(data)
      cursor = page.nextCursor ?? undefined
      expect(page.truncated).toBe(cursor !== undefined)
      if (cursor !== undefined) {
        expect(cursors.has(cursor)).toBe(false)
        cursors.add(cursor)
      }
      pageCount++
      expect(pageCount).toBeLessThan(10)
    } while (cursor !== undefined)
    expect(pageCount).toBeGreaterThan(1)
    expect(collected).toEqual(positions)
  })

  it("cancels the outbound API request when the MCP request is cancelled", async () => {
    const signal = AbortSignal.abort()
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      init?.signal?.throwIfAborted()
      return resourceResponse({})
    })
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://api.example.test",
      fetch,
      getApiAccessToken: () => "api-token"
    })
    await expect(requestSignals.run(signal, () => adapter.getBill({ id: "bill:us:119:hr:1" }))).rejects.toMatchObject({
      category: "dependency_unavailable"
    })
  })
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
      nextCursor: null,
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
          billIds: ["bill:ca:2025:ab:1"],
          documentClassifications: ["version"],
          mode: "lexical",
          query: "housing"
        })
    )

    expect(new URL(String(fetch.mock.calls[0]?.[0])).pathname).toBe("/api/search/passages")
    expect(fetch.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({
        billIds: ["bill:ca:2025:ab:1"],
        documentClassifications: ["version"],
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
      { limit: "5", mode: "explicit" },
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
      resourceResponse(voteDetail("vote:1", [])),
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
    if (_name === "get_supporting_material") {
      fetch.mockReset().mockResolvedValueOnce(response).mockResolvedValueOnce(pageResponse())
    }
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

  it("forwards supporting-material section cursors and limits", async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(resourceResponse({ id: "material:1" }))
      .mockResolvedValueOnce(pageResponse())
    const adapter = createMcpHttpQueryAdapter({
      apiBaseUrl: "https://legislation.example.test",
      fetch,
      getApiAccessToken: () => "api-m2m-token"
    })
    await runWithRequestContext(
      { correlationId },
      async () => await adapter.getSupportingMaterial({ id: "material:1", cursor: "next-sections", limit: 2 })
    )
    const target = new URL(String(fetch.mock.calls[1]?.[0]))
    expect(target.pathname).toBe("/api/supporting-materials/material%3A1/sections")
    expect(Object.fromEntries(target.searchParams)).toEqual({ cursor: "next-sections", limit: "2" })
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
