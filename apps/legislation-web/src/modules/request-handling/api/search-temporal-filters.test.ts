import { createServer, type Server } from "node:http"
import { afterEach, describe, expect, it } from "vitest"
import { createAmendmentSearchApiHandler, type AmendmentSearchApi } from "./amendment-search"
import { createCivicSearchApiHandler, type CivicSearchApi } from "./civic-search"
import { createPassageSearchApiHandler, type PassageSearchApi } from "./passage-search"
import { createCanonicalResearchEvidenceRetriever } from "./research-answers"
import { createUniversalSearchApiHandler } from "./universal-search"
import { createProductionUniversalSearchApi } from "./universal-search-adapter"

const servers = new Set<Server>()
const endpoints = ["bills", "supporting-materials", "amendments", "passages", "all"] as const
const recordTypes = ["bill", "supporting-material", "amendment", "passage"]

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

async function start(overrides: Partial<CivicSearchApi> = {}) {
  const received: object[] = []
  async function collect(input: object) {
    received.push(input)
    return { items: [], search: { isReranked: false as const, models: [] }, truncated: false, warnings: [] }
  }
  const service: CivicSearchApi & AmendmentSearchApi & PassageSearchApi = {
    searchAmendmentHits: collect,
    searchBills: collect,
    searchBillText: collect,
    searchSupportingMaterialHits: collect,
    ...overrides
  }
  const options = { apiBaseUrl: "https://api.example.test" }
  const handlers = [
    createCivicSearchApiHandler(service, options),
    createAmendmentSearchApiHandler(service, options),
    createPassageSearchApiHandler(service, options),
    createUniversalSearchApiHandler(createProductionUniversalSearchApi(service, undefined, options.apiBaseUrl))
  ]
  const server = createServer(async (request, response) => {
    for (const handler of handlers) {
      if (await handler(request, response)) {
        return
      }
    }
    response.writeHead(404).end()
  })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("server address unavailable")
  }
  return {
    received,
    retriever: createCanonicalResearchEvidenceRetriever({ ...service, searchAmendments: collect }, options.apiBaseUrl),
    search: async (endpoint: string, filters: object) =>
      await fetch(`http://127.0.0.1:${address.port}/api/search/${endpoint}`, {
        body: JSON.stringify({ query: "housing", ...(endpoint === "all" ? { recordTypes } : {}), ...filters }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
  }
}

describe("search temporal filter wiring", () => {
  it("keeps research evidence within the full UTC date, excluding both adjacent days", async () => {
    const { retriever } = await start({
      searchBills: async () => ({
        items: ["2026-08-23T23:59:59.999Z", "2026-08-24T23:59:59.999Z", "2026-08-25T00:00:00.000Z"].map(
          (updatedAt, index) => ({
            classification: ["bill"],
            createdAt: new Date("2026-01-01"),
            id: `bill:wa:2026:hb:${index + 1}`,
            identifier: `HB ${index + 1}`,
            introducedAt: null,
            jurisdictionId: "jurisdiction:wa",
            latestActionAt: null,
            lexicalScore: 1,
            matchedFields: ["title"],
            rerankScore: null,
            score: 1,
            semanticScore: null,
            sessionId: "session:wa:2026",
            snippet: "Housing publication",
            sourceUpdatedAt: null,
            sourceUrl: `https://leg.wa.gov/bills/${index + 1}`,
            status: "introduced",
            subjects: ["housing"],
            summary: null,
            title: "Housing publication",
            updatedAt: new Date(updatedAt),
            upstreamIds: {}
          })
        ),
        search: { isReranked: false, models: [] },
        truncated: false
      })
    })
    const result = await retriever.retrieve({
      answerFormat: "concise",
      question: "housing",
      retrieval: { maxEvidence: 20, mode: "lexical", recordTypes: ["bill"] },
      scope: { from: "2026-08-24", to: "2026-08-24" }
    })
    expect(result.citations.map((citation) => citation.recordId)).toEqual(["bill:wa:2026:hb:2"])
  })

  it("normalizes research scope bounds for each compatible product with scope field attribution", async () => {
    const { received, retriever } = await start()
    const request = {
      answerFormat: "concise" as const,
      question: "housing",
      retrieval: {
        maxEvidence: 20,
        mode: "lexical" as const,
        recordTypes: ["bill", "passage", "supporting-material"] as const
      },
      scope: { from: "2026-12-01", to: "2026-12-31" }
    }
    await retriever.retrieve(request)
    expect(received).toHaveLength(3)
    for (const input of received) {
      expect(input).toMatchObject({
        updatedFrom: new Date("2026-12-01"),
        updatedTo: undefined,
        updatedToExclusive: new Date("2027-01-01")
      })
    }
    received.length = 0
    await expect(retriever.retrieve({ ...request, scope: { from: "2027-01-01", to: "2026-12-31" } })).rejects.toThrow(
      expect.objectContaining({ category: "invalid_request", message: "scope.from must not be after scope.to" })
    )
    expect(received).toHaveLength(0)
  })

  it.each(endpoints)("normalizes update bounds through %s without narrowing the full day", async (endpoint) => {
    const { received, search } = await start()
    const cases = [
      {
        filters: { from: null, to: "2024-02-29" },
        expected: { updatedFrom: undefined, updatedTo: undefined, updatedToExclusive: new Date("2024-03-01") }
      },
      {
        filters: { from: "2026-08-24T00:00:00.123-07:00", to: "2026-08-24T07:00:00.456Z" },
        expected: {
          updatedFrom: new Date("2026-08-24T07:00:00.123Z"),
          updatedTo: new Date("2026-08-24T07:00:00.456Z"),
          updatedToExclusive: undefined
        }
      },
      {
        filters: {},
        expected: { updatedFrom: undefined, updatedTo: undefined, updatedToExclusive: undefined }
      }
    ]
    for (const { filters, expected } of cases) {
      received.length = 0
      const response = await search(endpoint, filters)
      expect(response.status).toBe(200)
      expect(received).toHaveLength(endpoint === "all" ? 4 : 1)
      for (const input of received) {
        expect(input).toMatchObject(expected)
      }
    }
  })

  it.each(endpoints)("rejects invalid temporal controls in %s before retrieval", async (endpoint) => {
    const { received, search } = await start()
    for (const filters of [
      { from: "2026-08-25", to: "2026-08-24" },
      { from: "2026-08-24", to: "2026-08-25T00:00:00Z" },
      { from: "2026-02-30" }
    ]) {
      const response = await search(endpoint, filters)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ error: { category: "invalid_request" } })
    }
    expect(received).toHaveLength(0)
  })

  it.each([
    { endpoint: "bills", from: "introducedFrom", to: "introducedTo", group: "bill" },
    { endpoint: "amendments", from: "submittedFrom", to: "submittedTo", group: "amendment" },
    { endpoint: "supporting-materials", from: "documentFrom", to: "documentTo", group: "supportingMaterial" }
  ])(
    "keeps $from/$to publisher dates separate in $endpoint and universal search",
    async ({ endpoint, from, to, group }) => {
      const { received, search } = await start()
      const dates = { [from]: "2026-01-01", [to]: "2026-01-31" }
      for (const [path, filters] of [
        [endpoint, dates],
        ["all", { filters: { [group]: dates } }]
      ] as const) {
        received.length = 0
        const response = await search(path, filters)
        expect(response.status).toBe(200)
        expect(received).toContainEqual(expect.objectContaining(dates))
        for (const input of received) {
          expect(input).toMatchObject({ updatedFrom: undefined, updatedTo: undefined, updatedToExclusive: undefined })
        }
      }
      const reversed = { [from]: "2026-02-01", [to]: "2026-01-31" }
      for (const [path, filters] of [
        [endpoint, reversed],
        ["all", { filters: { [group]: reversed } }]
      ] as const) {
        received.length = 0
        const response = await search(path, filters)
        expect(response.status).toBe(400)
        expect(await response.json()).toMatchObject({
          error: { category: "invalid_request", message: `${from} must not be after ${to}` }
        })
        expect(received).toHaveLength(0)
      }
    }
  )
})
