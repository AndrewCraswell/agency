import { createServer, type Server } from "node:http"
import { afterEach, describe, expect, it } from "vitest"
import { createCivicSearchApiHandler, type CivicSearchApi } from "./civic-search.js"

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
    searchBillText: async () => ({ items: [], truncated: false }),
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
    const baseUrl = await startApi(
      createService({
        searchBills: async (input) => {
          observedModes.push(input.mode ?? "missing")
          return { items: [{ id: "bill:ca:2025:ab:1" }], truncated: false }
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
    await expect(lexical.json()).resolves.toMatchObject({
      meta: { isReranked: false, mode: "lexical", models: [] }
    })
    await expect(semantic.json()).resolves.toMatchObject({
      meta: {
        isReranked: false,
        mode: "semantic",
        models: []
      }
    })
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
    const lexical = await fetch(`${baseUrl}/api/search/bills`, {
      body: JSON.stringify({ limit: 100, mode: "lexical", query: "housing" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(semantic.status).toBe(400)
    await expect(semantic.json()).resolves.toMatchObject({
      error: { message: "limit must be between 1 and 25 for semantic or hybrid search" }
    })
    expect(lexical.status).toBe(200)
    expect(observedLimits).toEqual([100])
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
          return { items: [], truncated: false }
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
    const response = await fetch(`${baseUrl}/api/search/supporting-materials`, {
      body: JSON.stringify({ documentFrom: "2026-08-24", documentTo: "2026-08-01", query: "budget" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { message: "documentFrom must not be after documentTo" }
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
