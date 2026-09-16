import { createServer, type Server } from "node:http"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { afterEach, describe, expect, it } from "vitest"
import {
  encodePassageSearchCursor,
  type PassageSearchInput,
  type PassageSearchResultPage
} from "../../search/search.js"
import { createPassageSearchApiHandler, type PassageSearchApi } from "./passage-search.js"

const servers = new Set<Server>()

afterEach(async () => {
  await Promise.all(
    [...servers].map(
      async (server) =>
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error === undefined ? resolve() : reject(error)))
        })
    )
  )
  servers.clear()
})

function candidate(): PassageSearchResultPage["items"][number] {
  return {
    bill: {
      classification: ["bill"],
      createdAt: new Date("2026-08-25T00:00:00.000Z"),
      id: "bill:ca:2025:ab:1",
      identifier: "A.B. 1",
      introducedAt: "2026-01-01",
      jurisdictionId: "jurisdiction:ca",
      sessionId: "session:ca:2025",
      sourceUpdatedAt: null,
      sourceUrl: "https://leginfo.ca.gov/bills/ab-1",
      status: "introduced",
      subjects: ["housing"],
      title: "Housing appropriations",
      updatedAt: new Date("2026-08-25T00:00:00.000Z"),
      upstreamIds: { openstates: "ab-1" }
    },
    document: {
      billId: "bill:ca:2025:ab:1",
      classification: "version",
      contentHash: "b".repeat(64),
      contentType: "text/plain",
      createdAt: new Date("2026-08-25T00:00:00.000Z"),
      documentDate: "2026-01-01",
      id: "document:ca:ab-1:introduced",
      ocrCompletedAt: new Date("2026-08-25T00:00:00.000Z"),
      ocrPageCount: 4,
      ocrProvider: "azure-document-intelligence",
      ocrStatus: "processed",
      processingErrorCategory: null,
      processingStatus: "processed",
      sourceUrl: "https://leginfo.ca.gov/bills/ab-1/text",
      title: "Introduced bill text",
      updatedAt: new Date("2026-08-25T00:00:00.000Z"),
      versionCode: "introduced"
    },
    latestActionAt: null,
    lexicalScore: 0.75,
    matchedFields: ["heading", "text"],
    rerankScore: null,
    rerankText: "Housing\nHousing fund text",
    score: 0.75,
    section: {
      contentHash: "a".repeat(64),
      documentId: "document:ca:ab-1:introduced",
      heading: "Housing funds",
      id: "section:ca:ab-1:1",
      ordinal: 1,
      pageEnd: 2,
      pageStart: 1,
      sourceEndOffset: 18,
      sourceStartOffset: 0,
      text: "Housing fund text"
    },
    semanticScore: null,
    snippet: "<b>Housing</b> fund text"
  }
}

function service(overrides: Partial<PassageSearchApi> = {}): PassageSearchApi {
  return {
    searchBillText: async () => ({
      items: [candidate()],
      search: { isReranked: false, models: [] },
      truncated: false
    }),
    ...overrides
  }
}

async function start(api: PassageSearchApi, rankedPassageGeneration?: string): Promise<string> {
  const handler = createPassageSearchApiHandler(api, {
    apiBaseUrl: "https://api.example.test",
    rankedPassageGeneration
  })
  const server = createServer(async (request, response) => {
    if (!(await handler(request, response))) {
      response.writeHead(404)
      response.end()
    }
  })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP address")
  }
  return `http://127.0.0.1:${address.port}`
}

async function post(baseUrl: string, body: unknown) {
  return await fetch(`${baseUrl}/api/search/passages`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST"
  })
}

describe("passage search HTTP API", () => {
  it("projects canonical section, document, bill, exact highlights, and lexical model metadata", async () => {
    const baseUrl = await start(service())
    const response = await post(baseUrl, { explain: true, query: "Housing" })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          match: { lexicalScore: 0.75, mode: "lexical", semanticScore: null },
          rank: 1,
          record: {
            bill: { id: "bill:ca:2025:ab:1", type: "bill" },
            document: { id: "document:ca:ab-1:introduced", ocrStatus: "processed", type: "document" },
            highlightRanges: [{ end: 7, kind: "exact", start: 0 }],
            id: "section:ca:ab-1:1",
            type: "document-section"
          },
          recordType: "passage"
        }
      ],
      meta: { isReranked: false, mode: "lexical", models: [] }
    })
  })

  it("binds the cursor to the exact normalized request and advances rank", async () => {
    const observed: PassageSearchInput[] = []
    const input = { limit: 1, mode: "lexical" as const, query: "housing" }
    const cursor = encodePassageSearchCursor(1, input)
    const baseUrl = await start(
      service({
        searchBillText: async (value) => {
          observed.push(value)
          return { items: [candidate()], search: { isReranked: false, models: [] }, truncated: false }
        }
      })
    )

    const accepted = await post(baseUrl, { ...input, cursor })
    const rejected = await post(baseUrl, { ...input, cursor, documentIds: ["document:other"] })

    expect(accepted.status).toBe(200)
    await expect(accepted.json()).resolves.toMatchObject({ data: [{ rank: 2 }] })
    expect(rejected.status).toBe(400)
    expect(observed).toHaveLength(1)
  })

  it("binds ranked lexical cursors to the configured full-corpus generation", async () => {
    const observed: PassageSearchInput[] = []
    const generation = "full-corpus-2026-09-12"
    const input = { limit: 1, mode: "lexical" as const, query: "housing", rankingGeneration: generation }
    const cursor = encodePassageSearchCursor(1, input)
    const baseUrl = await start(
      service({
        searchBillText: async (value) => {
          observed.push(value)
          return { items: [], search: { isReranked: false, models: [] }, truncated: false }
        }
      }),
      generation
    )

    expect((await post(baseUrl, { cursor, limit: 1, mode: "lexical", query: "housing" })).status).toBe(200)
    expect(observed).toEqual([expect.objectContaining(input)])
    expect(
      (
        await post(baseUrl, {
          cursor: encodePassageSearchCursor(1, { ...input, rankingGeneration: "old-generation" }),
          limit: 1,
          mode: "lexical",
          query: "housing"
        })
      ).status
    ).toBe(400)
  })

  it("rejects unsupported fields, invalid page ranges, and an oversized semantic request before invoking search", async () => {
    let calls = 0
    const baseUrl = await start(
      service({
        searchBillText: async () => {
          calls += 1
          return { items: [], search: { isReranked: false, models: [] }, truncated: false }
        }
      })
    )
    const [unknown, pages, limit] = await Promise.all([
      post(baseUrl, { query: "housing", ignored: true }),
      post(baseUrl, { pageFrom: 3, pageTo: 2, query: "housing" }),
      post(baseUrl, { limit: 26, mode: "semantic", query: "housing" })
    ])

    expect([unknown.status, pages.status, limit.status]).toEqual([400, 400, 400])
    expect(calls).toBe(0)
  })

  it("uses only the actual configured OpenAI and Cohere model metadata", async () => {
    const baseUrl = await start(
      service({
        searchBillText: async () => ({
          items: [
            {
              ...candidate(),
              lexicalScore: null,
              matchedFields: ["semantic"],
              rerankScore: 0.9,
              score: 0.9,
              semanticScore: 0.7
            }
          ],
          search: {
            isReranked: true,
            models: [
              { model: "openai/text-embedding-3-small", purpose: "embedding" as const },
              { model: "cohere/rerank-v3.5", purpose: "reranking" as const }
            ]
          },
          truncated: false
        })
      })
    )
    const response = await post(baseUrl, { mode: "semantic", query: "housing" })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      meta: {
        isReranked: true,
        models: [
          { dimensions: 1536, model: "openai/text-embedding-3-small", provider: "openai", purpose: "embedding" },
          { dimensions: null, model: "cohere/rerank-v3.5", provider: "cohere", purpose: "reranking" }
        ]
      }
    })
  })

  it("returns the typed unavailable-dependency response without lexical fallback", async () => {
    const baseUrl = await start(
      service({
        searchBillText: async () => {
          throw new LegislationError("dependency_unavailable", "Semantic search is not configured")
        }
      })
    )

    const response = await post(baseUrl, { mode: "semantic", query: "housing" })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "dependency_unavailable" } })
  })
})
