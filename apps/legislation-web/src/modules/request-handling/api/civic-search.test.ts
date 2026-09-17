import { createServer, type Server } from "node:http"
import { afterEach, describe, expect, it } from "vitest"
import { encodeSupportingMaterialSearchCursor } from "../../legislation/query-service"
import { encodeSearchCursor } from "../../search/search"
import { createCivicSearchApiHandler, type CivicSearchApi } from "./civic-search"

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

function createService(overrides: Partial<CivicSearchApi> = {}): CivicSearchApi {
  return {
    compareBillVersions: async () => ({ changes: [], truncated: false }),
    searchAmendments: async () => ({ items: [], truncated: false }),
    searchBillText: async () => ({ items: [], search: { isReranked: false, models: [] }, truncated: false }),
    searchBills: async () => ({ items: [], truncated: false }),
    searchSupportingMaterialHits: async () => ({
      items: [],
      search: { isReranked: false, models: [] },
      truncated: false,
      warnings: []
    }),
    searchSupportingMaterials: async () => ({ items: [], truncated: false }),
    ...overrides
  }
}

async function startApi(service: CivicSearchApi): Promise<string> {
  const handler = createCivicSearchApiHandler(service, { apiBaseUrl: "https://api.example.test" })
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
    throw new Error("Expected a TCP server address")
  }
  return `http://127.0.0.1:${address.port}`
}

function materialSearchCandidate() {
  return {
    amendmentIds: ["amendment:fixture"],
    billIds: ["bill:fixture"],
    blobPath: null,
    classification: "committee-report",
    contentHash: null,
    contentType: "application/pdf",
    createdAt: new Date("2026-08-24T00:00:00.000Z"),
    documentDate: "2026-08-20",
    hearingDates: null,
    sessionId: null,
    pageCount: null,
    id: "material:fixture",
    jurisdictionId: "jurisdiction:fixture",
    lastAttemptAt: null,
    lexicalScore: 0.8,
    matchedFields: ["sectionText", "title"] as const,
    meetingIds: ["meeting:fixture"],
    nextAttemptAt: null,
    organizationIds: ["organization:fixture"],
    processingStatus: "processed",
    processingAttempts: 0,
    processingError: null,
    processingErrorCategory: null,
    rerankScore: null,
    score: 0.8,
    section: {
      contentHash: "a".repeat(64),
      createdAt: new Date("2026-08-24T00:00:00.000Z"),
      embeddedAt: null,
      embedding: null,
      embeddingInputHash: null,
      embeddingModel: null,
      heading: "Summary",
      id: "material:fixture:section:0",
      materialId: "material:fixture",
      ordinal: 0,
      pageEnd: null,
      pageStart: null,
      searchVector: null,
      sectionIdentifier: null,
      sourceEndOffset: 32,
      sourceStartOffset: 0,
      text: "A bounded matching material section.",
      updatedAt: new Date("2026-08-24T00:00:00.000Z")
    },
    semanticScore: null,
    snippet: "A bounded <b>matching</b> material section.",
    sourceUpdatedAt: null,
    sourceId: "fixture-material",
    sourceUrl: "https://source.example.test/material",
    text: null,
    title: "Matching committee report",
    updatedAt: new Date("2026-08-24T01:00:00.000Z"),
    upstreamIds: { fixture: "material" }
  }
}

function billSearchCandidate() {
  return {
    classification: ["bill"],
    createdAt: new Date("2026-08-24T00:00:00.000Z"),
    id: "bill:ca:2025:ab:1",
    identifier: "A.B. 1",
    introducedAt: "2026-01-01",
    jurisdictionId: "jurisdiction:fixture",
    latestActionAt: null,
    lexicalScore: 0.8,
    matchedFields: ["identifier", "title"] as const,
    rerankScore: null,
    score: 0.8,
    semanticScore: null,
    sessionId: "session:fixture",
    snippet: "<b>A.B. 1</b> provides matching housing funds.",
    sourceUpdatedAt: null,
    sourceUrl: "https://source.example.test/bills/ab-1",
    status: "introduced",
    subjects: ["housing"],
    summary: "Matching housing funds.",
    title: "Housing funds",
    updatedAt: new Date("2026-08-24T01:00:00.000Z"),
    upstreamIds: { fixture: "ab-1" }
  }
}

describe("civic and search HTTP API handler", () => {
  it("leaves civic list and detail routes unregistered without calling the query service", async () => {
    const calls: string[] = []
    const service = {
      ...createService(),
      getEvent: async () => {
        calls.push("getEvent")
        return { event: { id: "meeting:ca:budget" } }
      },
      getOrganization: async () => {
        calls.push("getOrganization")
        return { organization: { id: "organization:ca:budget" } }
      },
      getPerson: async () => {
        calls.push("getPerson")
        return { person: { id: "person:ca:ada" } }
      },
      searchEvents: async () => {
        calls.push("searchEvents")
        return { items: [], truncated: false }
      },
      searchOrganizations: async () => {
        calls.push("searchOrganizations")
        return { items: [], truncated: false }
      },
      searchPeople: async () => {
        calls.push("searchPeople")
        return { items: [], truncated: false }
      }
    }
    const baseUrl = await startApi(service)

    const responses = await Promise.all([
      fetch(`${baseUrl}/api/people?limit=1`),
      fetch(`${baseUrl}/api/people/person%3Aca%3Aada`),
      fetch(`${baseUrl}/api/organizations?limit=1`),
      fetch(`${baseUrl}/api/organizations/organization%3Aca%3Abudget`),
      fetch(`${baseUrl}/api/meetings?limit=1`),
      fetch(`${baseUrl}/api/meetings/meeting%3Aca%3Abudget`)
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404, 404, 404])
    expect(calls).toEqual([])
  })

  it("uses the documented lexical default without claiming unreported model execution", async () => {
    const observedModes: string[] = []
    const observedLimits: number[] = []
    const baseUrl = await startApi(
      createService({
        searchBills: async (input) => {
          observedModes.push(input.mode ?? "missing")
          observedLimits.push(input.limit ?? 0)
          return {
            items: [],
            search:
              input.mode === "semantic"
                ? { isReranked: false, models: [{ model: "voyageai/voyage-4", purpose: "embedding" as const }] }
                : { isReranked: false, models: [] },
            truncated: false
          }
        }
      })
    )

    const lexical = await fetch(`${baseUrl}/api/search/bills`, {
      body: JSON.stringify({ query: "housing" }),
      headers: { "content-type": "application/json", host: "hostile.example.test" },
      method: "POST"
    })
    const semantic = await fetch(`${baseUrl}/api/search/bills`, {
      body: JSON.stringify({ mode: "semantic", query: "housing" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(observedModes).toEqual(["lexical", "semantic"])
    expect(observedLimits).toEqual([20, 20])
    await expect(lexical.json()).resolves.toMatchObject({
      meta: { isReranked: false, mode: "lexical", models: [] }
    })
    await expect(semantic.json()).resolves.toMatchObject({
      meta: {
        isReranked: false,
        mode: "semantic",
        models: [
          {
            dimensions: 1024,
            model: "voyageai/voyage-4",
            provider: "voyageai",
            purpose: "embedding"
          }
        ]
      }
    })
  })

  it("only exposes complete model metadata consistent with each search mode and product", async () => {
    const baseUrl = await startApi(
      createService({
        searchBills: async (input) => ({
          items: [],
          search:
            input.mode === "hybrid"
              ? {
                  isReranked: true,
                  models: [
                    { model: "voyageai/voyage-4", purpose: "embedding" as const },
                    { model: "cohere/rerank-v3.5", purpose: "reranking" as const }
                  ]
                }
              : { isReranked: true, models: [{ model: "cohere/rerank-v3.5", purpose: "reranking" as const }] },
          truncated: false
        }),
        searchSupportingMaterialHits: async (input) => ({
          items: [],
          search:
            input.mode === "semantic"
              ? { isReranked: false, models: [{ model: "voyageai/voyage-4", purpose: "embedding" as const }] }
              : JSON.parse('{"isReranked":true,"models":[{"model":"cohere/rerank-v3.5","purpose":"reranking"}]}'),
          truncated: false,
          warnings: []
        })
      })
    )

    const [hybridBills, semanticMaterials, lexicalBills, rerankedMaterials] = await Promise.all([
      fetch(`${baseUrl}/api/search/bills`, {
        body: JSON.stringify({ mode: "hybrid", query: "housing" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/search/supporting-materials`, {
        body: JSON.stringify({ mode: "semantic", query: "housing" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/search/bills`, {
        body: JSON.stringify({ query: "housing" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/search/supporting-materials`, {
        body: JSON.stringify({ mode: "hybrid", query: "housing" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    ])

    expect(hybridBills.status).toBe(200)
    await expect(hybridBills.json()).resolves.toMatchObject({
      meta: {
        isReranked: true,
        models: [
          { dimensions: 1024, model: "voyageai/voyage-4", provider: "voyageai", purpose: "embedding" },
          { dimensions: null, model: "cohere/rerank-v3.5", provider: "cohere", purpose: "reranking" }
        ]
      }
    })
    expect(semanticMaterials.status).toBe(200)
    await expect(semanticMaterials.json()).resolves.toMatchObject({
      meta: {
        isReranked: false,
        models: [{ dimensions: 1024, model: "voyageai/voyage-4", provider: "voyageai", purpose: "embedding" }]
      }
    })
    expect(lexicalBills.status).toBe(422)
    await expect(lexicalBills.json()).resolves.toMatchObject({ error: { category: "unprocessable" } })
    expect(rerankedMaterials.status).toBe(422)
    await expect(rerankedMaterials.json()).resolves.toMatchObject({ error: { category: "unprocessable" } })
  })

  it("enforces the semantic candidate ceiling while retaining the lexical maximum", async () => {
    const observedLimits: number[] = []
    const baseUrl = await startApi(
      createService({
        searchBills: async (input) => {
          observedLimits.push(input.limit ?? 0)
          return { items: [], truncated: false }
        }
      })
    )

    const semantic = await fetch(`${baseUrl}/api/search/bills`, {
      body: JSON.stringify({ limit: 26, mode: "semantic", query: "housing" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    const hybrid = await fetch(`${baseUrl}/api/search/bills`, {
      body: JSON.stringify({ limit: 26, mode: "hybrid", query: "housing" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    const lexical = await fetch(`${baseUrl}/api/search/bills`, {
      body: JSON.stringify({ limit: 100, mode: "lexical", query: "housing" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(semantic.status).toBe(400)
    await expect(semantic.json()).resolves.toMatchObject({
      error: { message: "limit must be between 1 and 25 for semantic or hybrid search" }
    })
    expect(hybrid.status).toBe(400)
    await expect(hybrid.json()).resolves.toMatchObject({
      error: { message: "limit must be between 1 and 25 for semantic or hybrid search" }
    })
    expect(lexical.status).toBe(200)
    expect(observedLimits).toEqual([100])
  })

  it("binds semantic cursors to their original bill and material searches", async () => {
    let billCalls = 0
    let materialCalls = 0
    const baseUrl = await startApi(
      createService({
        searchBills: async () => {
          billCalls += 1
          return {
            items: [],
            search: { isReranked: false, models: [{ model: "voyageai/voyage-4", purpose: "embedding" as const }] },
            truncated: false
          }
        },
        searchSupportingMaterialHits: async () => {
          materialCalls += 1
          return {
            items: [],
            search: { isReranked: false, models: [{ model: "voyageai/voyage-4", purpose: "embedding" as const }] },
            truncated: false,
            warnings: []
          }
        }
      })
    )
    const billCursor = encodeSearchCursor(1, { mode: "semantic", query: "housing" })
    const materialCursor = encodeSupportingMaterialSearchCursor(1, {
      limit: 20,
      mode: "semantic",
      query: "housing"
    })

    const [bill, material] = await Promise.all([
      fetch(`${baseUrl}/api/search/bills`, {
        body: JSON.stringify({ cursor: billCursor, mode: "semantic", query: "transport" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/search/supporting-materials`, {
        body: JSON.stringify({ cursor: materialCursor, mode: "semantic", query: "transport" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    ])

    expect([bill.status, material.status]).toEqual([400, 400])
    expect(billCalls).toBe(0)
    expect(materialCalls).toBe(0)
  })

  it("projects canonical bill hits and forwards every BillSearchRequest control", async () => {
    let received: unknown
    const searchInput = {
      classifications: ["bill"],
      introducedFrom: "2026-01-01",
      introducedTo: "2026-01-31",
      jurisdictionIds: ["jurisdiction:fixture"],
      query: "housing",
      sessionIds: ["session:fixture"],
      sponsorIds: ["person:fixture"],
      statuses: ["introduced"],
      subjects: ["housing"],
      updatedFrom: new Date("2026-08-01T00:00:00.000Z"),
      updatedTo: new Date("2026-08-24T01:00:00.000Z")
    }
    const cursor = encodeSearchCursor(20, searchInput)
    const nextCursor = encodeSearchCursor(25, searchInput)
    const baseUrl = await startApi(
      createService({
        searchBills: async (input) => {
          received = input
          return {
            items: [billSearchCandidate()],
            nextCursor,
            search: {
              isReranked: false,
              models: []
            },
            truncated: true
          }
        }
      })
    )

    const response = await fetch(`${baseUrl}/api/search/bills`, {
      body: JSON.stringify({
        classifications: ["bill"],
        cursor,
        explain: true,
        from: "2026-08-01T00:00:00.000Z",
        introducedFrom: "2026-01-01",
        introducedTo: "2026-01-31",
        jurisdictionIds: ["jurisdiction:fixture"],
        limit: 5,
        query: "housing",
        sessionIds: ["session:fixture"],
        sponsorIds: ["person:fixture"],
        statuses: ["introduced"],
        subjects: ["housing"],
        to: "2026-08-24T01:00:00.000Z"
      }),
      headers: { "content-type": "application/json", host: "hostile.example.test" },
      method: "POST"
    })

    expect(response.status).toBe(200)
    expect(received).toMatchObject({
      classifications: ["bill"],
      cursor,
      introducedFrom: "2026-01-01",
      introducedTo: "2026-01-31",
      jurisdictionIds: ["jurisdiction:fixture"],
      limit: 5,
      mode: "lexical",
      sessionIds: ["session:fixture"],
      sponsorIds: ["person:fixture"],
      statuses: ["introduced"],
      subjects: ["housing"],
      updatedFrom: new Date("2026-08-01T00:00:00.000Z"),
      updatedTo: new Date("2026-08-24T01:00:00.000Z"),
      updatedToExclusive: undefined
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          match: {
            explanation:
              "lexical search matched identifier, title; lexical score 0.8, semantic score null, rerank score null; response score 0.8.",
            mode: "lexical"
          },
          record: {
            canonicalUrl: "https://api.example.test/api/bills/bill%3Aca%3A2025%3Aab%3A1",
            id: "bill:ca:2025:ab:1",
            type: "bill"
          },
          rank: 21,
          recordType: "bill"
        }
      ],
      meta: {
        isReranked: false,
        limit: 5,
        mode: "lexical",
        models: [],
        nextCursor
      }
    })
  })

  it("treats date-only updated bounds as an inclusive UTC day and rejects invalid bill search controls", async () => {
    let calls = 0
    let received: unknown
    const baseUrl = await startApi(
      createService({
        searchBills: async (input) => {
          calls += 1
          received = input
          return { items: [], truncated: false }
        }
      })
    )
    const valid = await fetch(`${baseUrl}/api/search/bills`, {
      body: JSON.stringify({ from: "2026-08-01", query: "housing", to: "2026-08-24" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    const invalid = await Promise.all([
      fetch(`${baseUrl}/api/search/bills`, {
        body: JSON.stringify({ from: "2026-08-25", query: "housing", to: "2026-08-24" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/search/bills`, {
        body: JSON.stringify({ cursor: "not-a-cursor", query: "housing" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/search/bills`, {
        body: JSON.stringify({ from: "2026-02-30", query: "housing" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/search/bills`, {
        body: JSON.stringify({ query: "housing", unsupported: true }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/search/bills?unsupported=true`, {
        body: JSON.stringify({ query: "housing" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/search/bills`, {
        body: JSON.stringify({ cursor: encodeSearchCursor(1, { query: "housing" }), query: "transport" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    ])

    expect(valid.status).toBe(200)
    expect(received).toMatchObject({
      updatedFrom: new Date("2026-08-01T00:00:00.000Z"),
      updatedTo: undefined,
      updatedToExclusive: new Date("2026-08-25T00:00:00.000Z")
    })
    expect(invalid.map((response) => response.status)).toEqual([400, 400, 400, 400, 400, 400])
    expect(calls).toBe(1)
  })

  it("fails closed instead of returning incomplete bill candidates", async () => {
    const baseUrl = await startApi(
      createService({
        searchBills: async () => ({ items: [{ ...billSearchCandidate(), sourceUrl: "" }], truncated: false })
      })
    )

    const response = await fetch(`${baseUrl}/api/search/bills`, {
      body: JSON.stringify({ query: "housing" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable" } })
  })

  it("leaves blocked amendment, passage, and document-diff routes unregistered without calling the query service", async () => {
    const calls: string[] = []
    const baseUrl = await startApi(
      createService({
        compareBillVersions: async () => {
          calls.push("compareBillVersions")
          return { changes: [], truncated: false }
        },
        searchAmendments: async () => {
          calls.push("searchAmendments")
          return { items: [], truncated: false }
        },
        searchBillText: async () => {
          calls.push("searchBillText")
          return { items: [], search: { isReranked: false, models: [] }, truncated: false }
        }
      })
    )

    const responses = await Promise.all([
      fetch(`${baseUrl}/api/search/amendments`, {
        body: JSON.stringify({ query: "budget" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/search/passages`, {
        body: JSON.stringify({ query: "budget" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/document-diffs`, {
        body: JSON.stringify({
          billId: "bill:ca:2025:ab:1",
          leftDocumentId: "document:ca:ab1:introduced",
          rightDocumentId: "document:ca:ab1:enrolled"
        }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404])
    expect(calls).toEqual([])
  })

  it("rejects reversed document date bounds", async () => {
    const baseUrl = await startApi(createService())
    const [response, unsupportedQuery] = await Promise.all([
      fetch(`${baseUrl}/api/search/supporting-materials`, {
        body: JSON.stringify({ documentFrom: "2026-08-24", documentTo: "2026-08-01", query: "budget" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/search/supporting-materials?unexpected=true`, {
        body: JSON.stringify({ query: "budget" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    ])

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { message: "documentFrom must not be after documentTo" }
    })
    expect(unsupportedQuery.status).toBe(400)
    await expect(unsupportedQuery.json()).resolves.toMatchObject({
      error: { category: "invalid_request", message: "Unsupported query parameter: unexpected" }
    })
  })

  it("returns canonical material search hits and forwards every supported material filter", async () => {
    let received: unknown
    const baseUrl = await startApi(
      createService({
        searchSupportingMaterialHits: async (input) => {
          received = input
          return {
            items: [materialSearchCandidate()],
            search: { isReranked: false, models: [] },
            truncated: false,
            warnings: []
          }
        }
      })
    )
    const response = await fetch(`${baseUrl}/api/search/supporting-materials`, {
      body: JSON.stringify({
        amendmentIds: ["amendment:fixture"],
        billIds: ["bill:fixture"],
        classifications: ["committee-report"],
        documentFrom: "2026-08-01",
        documentTo: "2026-08-20",
        explain: true,
        from: "2026-08-01T00:00:00.000Z",
        jurisdictionIds: ["jurisdiction:fixture"],
        meetingIds: ["meeting:fixture"],
        organizationIds: ["organization:fixture"],
        query: "matching",
        sessionIds: ["session:fixture"],
        to: "2026-08-20T00:00:00.000Z"
      }),
      headers: { "content-type": "application/json", host: "hostile.example.test" },
      method: "POST"
    })

    expect(response.status).toBe(200)
    expect(received).toMatchObject({
      amendmentIds: ["amendment:fixture"],
      billIds: ["bill:fixture"],
      classifications: ["committee-report"],
      documentFrom: "2026-08-01",
      documentTo: "2026-08-20",
      eventIds: ["meeting:fixture"],
      jurisdictionIds: ["jurisdiction:fixture"],
      organizationIds: ["organization:fixture"],
      sessionIds: ["session:fixture"],
      updatedFrom: expect.any(Date),
      updatedTo: expect.any(Date)
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          match: {
            explanation: "lexical search matched sectionText, title; response score 0.8.",
            lexicalScore: 0.8,
            mode: "lexical",
            rerankScore: null
          },
          record: {
            material: {
              canonicalUrl: "https://api.example.test/api/supporting-materials/material%3Afixture",
              id: "material:fixture",
              type: "supporting-material"
            },
            relatedRecordIds: ["amendment:fixture", "bill:fixture", "meeting:fixture", "organization:fixture"],
            section: { id: "material:fixture:section:0", materialId: "material:fixture" }
          },
          recordType: "supporting-material"
        }
      ],
      meta: { isReranked: false, mode: "lexical", models: [] }
    })
  })

  it("keeps explanations null unless requested", async () => {
    const baseUrl = await startApi(
      createService({
        searchSupportingMaterialHits: async () => ({
          items: [materialSearchCandidate()],
          search: { isReranked: false, models: [] },
          truncated: false,
          warnings: []
        })
      })
    )
    const response = await fetch(`${baseUrl}/api/search/supporting-materials`, {
      body: JSON.stringify({ query: "matching" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    await expect(response.json()).resolves.toMatchObject({ data: [{ match: { explanation: null } }] })
  })

  it("fails closed for incomplete canonical candidates", async () => {
    const baseUrl = await startApi(
      createService({
        searchSupportingMaterialHits: async () => ({
          items: [
            { ...materialSearchCandidate(), section: { ...materialSearchCandidate().section, materialId: "wrong" } }
          ],
          search: { isReranked: false, models: [] },
          truncated: false,
          warnings: []
        })
      })
    )
    const incomplete = await fetch(`${baseUrl}/api/search/supporting-materials`, {
      body: JSON.stringify({ query: "matching" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    expect(incomplete.status).toBe(422)
    await expect(incomplete.json()).resolves.toMatchObject({ error: { category: "unprocessable" } })
  })

  it("leaves organization meeting routes unregistered until exact canonical projection facts exist", async () => {
    const baseUrl = await startApi(createService())
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/organizations/organization%3Aca%3Abudget/meetings`),
      fetch(`${baseUrl}/api/organizations/organization%3Aca%3Abudget/meetings?sort=starts-desc`),
      fetch(`${baseUrl}/api/organizations/organization%3Aca%3Abudget/meetings/extra`)
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404])
  })
})
