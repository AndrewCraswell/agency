import pg from "pg"
import { afterEach, expect, it, vi } from "vitest"
import { LegislationApiClient } from "../api-client/client.js"
import { createLegalSearch } from "./legal-search-read.js"
import { createLegalSearchApiHandler } from "./legal-search-routes.js"
import { executeNextHttpApiHandler } from "./next/node-handler.js"

const pool = new pg.Pool()
afterEach(() => vi.restoreAllMocks())
const identity = { userId: "user", organizationId: "org" }
const context = { requestContext: { identity } }
const search = vi.fn<ReturnType<typeof createLegalSearch>>(async () => ({
  items: [],
  truncated: false,
  warnings: [],
  legal: {
    lexicalGeneration: "a".repeat(64),
    embeddingGeneration: null,
    effectiveMode: "lexical",
    degraded: false,
    candidateSetTruncated: false
  }
}))
const request = (body: unknown, path = "/api/search/legal") =>
  new Request(`https://api.example${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
it("serves parsed responses through the typed client and uses no shared cache", async () => {
  const api = new LegislationApiClient({
    baseUrl: "https://api.example",
    fetch: async (url, init) => {
      const response = await executeNextHttpApiHandler(
        new Request(url, init),
        createLegalSearchApiHandler(search, "https://api.example"),
        context
      )
      expect(response.headers.get("cache-control")).toBe("private, no-store")
      return response
    }
  })
  const result = await api.searchLegal({ query: " ethical ", corpora: ["regulation"] })
  expect(result.meta.legal.effectiveMode).toBe("lexical")
  expect(search).toHaveBeenLastCalledWith(
    expect.objectContaining({ query: "ethical", limit: 20 }),
    "https://api.example"
  )
})
it("rejects invalid bodies and URL filters before invoking search", async () => {
  search.mockClear()
  for (const value of [
    { query: "x", organizationId: "spoofed" },
    { query: "x", editionIds: ["e"] },
    { query: "x", limit: 101 }
  ]) {
    const result = await executeNextHttpApiHandler(
      request(value),
      createLegalSearchApiHandler(search, "https://api.example"),
      context
    )
    expect(result.status).toBe(400)
  }
  const result = await executeNextHttpApiHandler(
    request({ query: "x" }, "/api/search/legal?cursor=foo"),
    createLegalSearchApiHandler(search, "https://api.example"),
    context
  )
  expect(result.status).toBe(400)
  expect(search).not.toHaveBeenCalled()
})
it("denies identity and unavailable capabilities before database access", async () => {
  const connect = vi.spyOn(pool, "connect")
  const query = vi.spyOn(pool, "query")
  const handler = createLegalSearchApiHandler(createLegalSearch(pool, undefined, ["org"]), "https://api.example")
  expect((await executeNextHttpApiHandler(request({ query: "x" }), handler)).status).toBe(401)
  expect(
    (
      await executeNextHttpApiHandler(request({ query: "x" }), handler, {
        requestContext: { identity: { ...identity, organizationId: "other" } }
      })
    ).status
  ).toBe(403)
  for (const [body, status] of [
    [{ query: "x" }, 503],
    [{ query: "x", corpora: ["regulation"], agencyIds: ["agency"] }, 503],
    [{ query: "x", corpora: ["regulation"], mode: "semantic" }, 503],
    [{ query: "x", corpora: ["regulation"], asOf: "2024-01-01" }, 409],
    [{ query: "x", corpora: ["regulation"] }, 503]
  ] as const) {
    expect((await executeNextHttpApiHandler(request(body), handler, context)).status).toBe(status)
  }
  expect(connect).not.toHaveBeenCalled()
  expect(query).not.toHaveBeenCalled()
})
it("refuses a structurally valid response that changes requested limits", async () => {
  const api = new LegislationApiClient({
    baseUrl: "https://api.example",
    fetch: async () =>
      Response.json(
        {
          data: [],
          links: { self: "/api/search/legal", next: null },
          meta: {
            correlationId: "test",
            limit: 99,
            nextCursor: null,
            truncated: false,
            warnings: [],
            mode: "lexical",
            models: [],
            isReranked: false,
            legal: {
              lexicalGeneration: "a".repeat(64),
              embeddingGeneration: null,
              effectiveMode: "lexical",
              degraded: false,
              candidateSetTruncated: false
            }
          }
        },
        { headers: { "x-correlation-id": "test" } }
      )
  })
  await expect(api.searchLegal({ query: "x", limit: 20 }, { correlationId: "test" })).rejects.toThrow(
    "Invalid legal search response"
  )
})
