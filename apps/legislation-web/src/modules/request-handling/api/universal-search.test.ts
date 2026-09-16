import { createServer, type Server } from "node:http"
import { afterEach, describe, expect, it } from "vitest"
import {
  createUniversalSearchApiHandler,
  type UniversalProductSearchInput,
  type UniversalSearchApi
} from "./universal-search.js"

const servers = new Set<Server>()

type SearchResponse = {
  data: Array<{ match: Record<string, unknown>; rank: number; recordType: string; score: number }>
  meta: { groups: unknown; nextCursor: string | null }
}

afterEach(async () => {
  await Promise.all(
    [...servers].map(async (server) => await new Promise<void>((resolve) => server.close(() => resolve())))
  )
  servers.clear()
})

function candidate(recordType: UniversalProductSearchInput["recordType"], id: string) {
  return {
    lexicalScore: 1,
    matchedFields: ["name"],
    record: { id, type: recordType },
    recordId: id,
    recordType,
    rerankScore: null,
    semanticScore: null,
    snippet: id,
    sources: [{ sourceUrl: "https://source.example.test" }]
  } as const
}

function service(overrides: Partial<UniversalSearchApi> = {}): UniversalSearchApi {
  return {
    search: async (input) => ({
      items: [candidate(input.recordType, `${input.recordType}:1`)],
      models: [],
      truncated: false
    }),
    ...overrides
  }
}

async function start(api: UniversalSearchApi): Promise<string> {
  const handler = createUniversalSearchApiHandler(api)
  const server = createServer(async (request, response) => {
    if (!(await handler(request, response))) {
      response.writeHead(404).end()
    }
  })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("server address unavailable")
  }
  return `http://127.0.0.1:${address.port}`
}

async function search(baseUrl: string, body: unknown, suffix = "") {
  return await fetch(`${baseUrl}/api/search/all${suffix}`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST"
  })
}

async function searchResponse(response: Response): Promise<SearchResponse> {
  const value: unknown = await response.json()
  if (!isSearchResponse(value)) {
    throw new Error("Expected a universal search response")
  }
  return value
}

function isSearchResponse(value: unknown): value is SearchResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }
  const data = Reflect.get(value, "data")
  const meta = Reflect.get(value, "meta")
  if (!Array.isArray(data) || typeof meta !== "object" || meta === null) {
    return false
  }
  const nextCursor = Reflect.get(meta, "nextCursor")
  return typeof nextCursor === "string" || nextCursor === null
}

describe("POST /api/search/all", () => {
  it("uses lexical retrieval for people, organizations, and meetings in a hybrid request", async () => {
    const received: UniversalProductSearchInput[] = []
    const baseUrl = await start(
      service({
        search: async (input) => {
          received.push(input)
          return {
            items: [candidate(input.recordType, `${input.recordType}:1`)],
            models:
              input.recordType === "bill"
                ? [{ dimensions: 1_024, model: "voyageai/voyage-4", provider: "voyageai", purpose: "embedding" }]
                : [],
            truncated: false
          }
        }
      })
    )
    const response = await search(baseUrl, {
      mode: "hybrid",
      query: "budget",
      recordTypes: ["bill", "person", "organization", "meeting"]
    })
    expect(response.status).toBe(200)
    expect(received.map((input) => [input.recordType, input.mode])).toEqual([
      ["bill", "hybrid"],
      ["person", "lexical"],
      ["organization", "lexical"],
      ["meeting", "lexical"]
    ])
    const json = await searchResponse(response)
    expect(json.data.find((hit) => hit.recordType === "person")?.match).toMatchObject({
      lexicalScore: 1,
      semanticScore: null,
      mode: "lexical"
    })
  })

  it("rejects semantic requests selecting a lexical-only product before retrieval", async () => {
    let calls = 0
    const baseUrl = await start(
      service({
        search: async () => {
          calls += 1
          return { items: [], models: [], truncated: false }
        }
      })
    )
    const response = await search(baseUrl, { mode: "semantic", query: "budget", recordTypes: ["person"] })
    expect(response.status).toBe(422)
    expect(calls).toBe(0)
  })

  it("strictly validates the route, body, typed filters, and bounds", async () => {
    const baseUrl = await start(service())
    expect((await search(baseUrl, { query: "budget", unexpected: true })).status).toBe(400)
    expect(
      (await search(baseUrl, { query: "budget", filters: { person: { parties: ["Independent", "Independent"] } } }))
        .status
    ).toBe(400)
    expect((await search(baseUrl, { query: "budget", filters: { passage: { pageFrom: 3, pageTo: 2 } } })).status).toBe(
      400
    )
    expect((await search(baseUrl, { query: "budget" }, "?limit=5")).status).toBe(400)
  })

  it("merges normalized per-type ranks with RRF and binds continuation cursors to filters", async () => {
    const baseUrl = await start(
      service({
        search: async (input) => ({
          items: [
            candidate(input.recordType, `${input.recordType}:first`),
            candidate(input.recordType, `${input.recordType}:second`)
          ],
          models: [],
          truncated: false
        })
      })
    )
    const first = await search(baseUrl, { limit: 1, perTypeLimit: 2, query: "budget", recordTypes: ["bill", "person"] })
    expect(first.status).toBe(200)
    const firstJson = await searchResponse(first)
    expect(firstJson.data[0]).toMatchObject({ rank: 1, score: 1 / 61 })
    expect(firstJson.meta.groups).toEqual([
      { nextCursor: null, recordType: "bill", returned: 1 },
      { nextCursor: null, recordType: "person", returned: 0 }
    ])
    const continued = await search(baseUrl, {
      cursor: firstJson.meta.nextCursor,
      limit: 1,
      perTypeLimit: 2,
      query: "budget",
      recordTypes: ["bill", "person"]
    })
    expect(continued.status).toBe(200)
    const changed = await search(baseUrl, {
      cursor: firstJson.meta.nextCursor,
      limit: 1,
      perTypeLimit: 2,
      query: "different",
      recordTypes: ["bill", "person"]
    })
    expect(changed.status).toBe(400)
  })
})
