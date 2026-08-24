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
