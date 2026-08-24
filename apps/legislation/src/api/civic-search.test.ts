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
    getEvent: async ({ id }) => ({ event: { id } }),
    getOrganization: async ({ id }) => ({ organization: { id } }),
    getPerson: async ({ id }) => ({ person: { id } }),
    searchAmendments: async () => ({ items: [], truncated: false }),
    searchBillText: async () => ({ items: [], truncated: false }),
    searchBills: async () => ({ items: [], truncated: false }),
    searchEvents: async () => ({ items: [], truncated: false }),
    searchOrganizations: async () => ({ items: [], truncated: false }),
    searchPeople: async () => ({ items: [], truncated: false }),
    searchSupportingMaterials: async () => ({ items: [], truncated: false }),
    ...overrides
  }
}

async function startApi(service: CivicSearchApi): Promise<string> {
  const handler = createCivicSearchApiHandler(service)
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

describe("civic and search HTTP API handler", () => {
  it("maps people query parameters into the shared query service and returns a page envelope", async () => {
    let observed: unknown
    const baseUrl = await startApi(
      createService({
        searchPeople: async (input) => {
          observed = input
          return { items: [{ id: "person:ca:ada" }], truncated: false, warnings: [] }
        }
      })
    )

    const response = await fetch(
      `${baseUrl}/api/people?q=Ada&jurisdictionId=jurisdiction%3Aca&isActive=true&limit=10`,
      { headers: { "x-correlation-id": "people-query" } }
    )

    expect(response.status).toBe(200)
    expect(observed).toEqual({
      cursor: undefined,
      isActive: true,
      jurisdictionId: "jurisdiction:ca",
      limit: 10,
      organizationId: undefined,
      query: "Ada"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [{ id: "person:ca:ada" }],
      links: { next: null, self: "/api/people?q=Ada&jurisdictionId=jurisdiction%3Aca&isActive=true&limit=10" },
      meta: { correlationId: "people-query", limit: 10, nextCursor: null, truncated: false, warnings: [] }
    })
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
      headers: { "content-type": "application/json" },
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

  it("rejects duplicate IDs after input normalization", async () => {
    const baseUrl = await startApi(createService())
    const response = await fetch(`${baseUrl}/api/search/passages`, {
      body: JSON.stringify({ documentIds: ["document:a", " document:a "], query: "budget" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "invalid_request", message: "ID arrays must contain unique values" }
    })
  })

  it("validates bounds before rejecting currently unsupported passage filters", async () => {
    const baseUrl = await startApi(createService())
    const invalidBounds = await fetch(`${baseUrl}/api/search/passages`, {
      body: JSON.stringify({ pageFrom: 8, pageTo: 3, query: "budget" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    const unsupportedFilter = await fetch(`${baseUrl}/api/search/passages`, {
      body: JSON.stringify({ documentClassifications: ["version"], query: "budget" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(invalidBounds.status).toBe(400)
    await expect(invalidBounds.json()).resolves.toMatchObject({
      error: { message: "pageFrom must not be greater than pageTo" }
    })
    expect(unsupportedFilter.status).toBe(400)
    await expect(unsupportedFilter.json()).resolves.toMatchObject({
      error: { message: "documentClassifications is not implemented by the current query service" }
    })
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

  it("rejects filters that the current amendment service cannot fulfill without silently discarding them", async () => {
    const baseUrl = await startApi(createService())
    const response = await fetch(`${baseUrl}/api/search/amendments`, {
      body: JSON.stringify({ billIds: ["bill:a", "bill:b"], query: "budget" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "invalid_request", message: "billIds currently accepts exactly one value" }
    })
  })

  it("passes the selected document pair to the existing comparison service", async () => {
    let observed: unknown
    const baseUrl = await startApi(
      createService({
        compareBillVersions: async (input) => {
          observed = input
          return { changes: [{ classification: "changed" }], truncated: false }
        }
      })
    )

    const response = await fetch(`${baseUrl}/api/document-diffs`, {
      body: JSON.stringify({
        billId: "bill:ca:2025:ab:1",
        leftDocumentId: "document:ca:ab1:introduced",
        rightDocumentId: "document:ca:ab1:enrolled"
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(response.status).toBe(200)
    expect(observed).toEqual({
      billId: "bill:ca:2025:ab:1",
      documentIds: ["document:ca:ab1:introduced", "document:ca:ab1:enrolled"]
    })
    await expect(response.json()).resolves.toMatchObject({ data: { changes: [{ classification: "changed" }] } })
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
