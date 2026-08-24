import { afterEach, describe, expect, it } from "vitest"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
import { createCoreReadApiHandler, type CoreReadQueryApi } from "./core-read.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "legislation-api-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: CoreReadQueryApi) {
  const server = createLegislationServer({ apiHandler: createCoreReadApiHandler(service), logger })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP server address")
  }
  return `http://127.0.0.1:${address.port}`
}

function bill(id = "bill:us:119:hr:1") {
  return {
    classification: ["bill"],
    createdAt: new Date("2026-08-20T15:00:00Z"),
    id,
    identifier: "HR 1",
    introducedAt: new Date("2026-01-01T00:00:00Z"),
    jurisdictionId: "jurisdiction:us",
    latestActionAt: new Date("2026-02-01T00:00:00Z"),
    sessionId: "session:us:119",
    sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1",
    status: "introduced",
    subjects: ["Government"],
    title: "Test bill",
    updatedAt: new Date("2026-08-20T15:00:00Z"),
    upstreamIds: { congress: "119-hr-1" }
  }
}

function service(): CoreReadQueryApi {
  return {
    browseBills: async () => ({ items: [bill()], truncated: false }),
    findRelatedBills: async () => ({ items: [], truncated: false }),
    getAmendment: async ({ id }) => ({ amendment: { id } }),
    getBill: async ({ id }) => ({ bill: { id } }),
    getBillText: async () => ({ sections: [{ id: "section:1" }], truncated: false }),
    getBillTimeline: async () => ({ events: [{ id: "action:1" }], truncated: false }),
    getBillVotes: async ({ billId }) => ({ items: [], billId, truncated: false }),
    getDocument: async ({ id }) => ({ document: { id } }),
    getDocumentSection: async ({ documentId, sectionId }) => ({
      document: {
        billId: "bill:us:119:hr:1",
        createdAt: new Date("2026-08-20T15:00:00Z"),
        id: documentId,
        sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1/text",
        updatedAt: new Date("2026-08-20T15:00:00Z"),
        upstreamIds: { congress: "119-hr-1" }
      },
      section: {
        contentHash: "a".repeat(64),
        heading: null,
        id: sectionId,
        ordinal: 0,
        sourceEndOffset: 10,
        sourceStartOffset: 0,
        text: "Text"
      }
    }),
    getDocumentSections: async () => ({ items: [], truncated: false }),
    getJurisdiction: async (id) => ({ id }),
    getSession: async (id) => ({ id }),
    getSupportingMaterial: async ({ id }) => ({ material: { id } }),
    getSupportingMaterialSection: async ({ materialId, sectionId }) => ({
      material: {
        createdAt: new Date("2026-08-20T15:00:00Z"),
        id: materialId,
        sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1/text",
        updatedAt: new Date("2026-08-20T15:00:00Z"),
        upstreamIds: { congress: "119-hr-1" }
      },
      section: { contentHash: "b".repeat(64), heading: null, id: sectionId, ordinal: 0, text: "Text" }
    }),
    getVote: async ({ id }) => ({ vote: { id } }),
    listJurisdictions: async () => ({ items: [{ id: "jurisdiction:us" }], truncated: false }),
    listSessions: async () => ({ items: [{ id: "session:us:119" }], truncated: false }),
    searchAmendments: async () => ({ items: [], truncated: false, warnings: [] }),
    searchChanges: async () => ({ items: [], truncated: false }),
    searchSupportingMaterials: async () => ({ items: [], truncated: false }),
    searchVotes: async () => ({ items: [], truncated: false })
  }
}

describe("core read API handler", () => {
  it("leaves BillDetail, batch, and timeline routes unregistered until the query service preserves their contract facts", async () => {
    const baseUrl = await startServer(service())
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1`),
      fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/timeline`),
      fetch(`${baseUrl}/api/bills/batch`, { body: JSON.stringify({ ids: ["bill:us:119:hr:1"] }), method: "POST" })
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404])
  })

  it("leaves jurisdiction and session canonical routes unregistered until persisted contract provenance exists", async () => {
    const baseUrl = await startServer(service())
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/jurisdictions?limit=10`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/sessions`),
      fetch(`${baseUrl}/api/sessions/session%3Aus%3A119`)
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404])
  })

  it("leaves vote routes unregistered until persisted canonical vote facts exist", async () => {
    let billVoteReads = 0
    let voteReads = 0
    let voteSearches = 0
    const voteService = Object.assign(service(), {
      getBillVotes: async () => {
        billVoteReads += 1
        return { items: [], truncated: false }
      },
      getVote: async () => {
        voteReads += 1
        return {}
      },
      searchVotes: async () => {
        voteSearches += 1
        return { items: [], truncated: false }
      }
    })
    const baseUrl = await startServer(voteService)
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/votes`),
      fetch(`${baseUrl}/api/votes/vote%3Aus%3A119%3Ahouse%3A1`),
      fetch(`${baseUrl}/api/votes/batch`, {
        body: JSON.stringify({ ids: ["vote:us:119:house:1"] }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/votes`)
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404])
    expect({ billVoteReads, voteReads, voteSearches }).toEqual({ billVoteReads: 0, voteReads: 0, voteSearches: 0 })
  })

  it("keeps absent route slices absent instead of manufacturing a placeholder response", async () => {
    const baseUrl = await startServer(service())
    const response = await fetch(`${baseUrl}/api/subscriptions`)

    expect(response.status).toBe(404)
  })

  it("keeps incomplete canonical amendment routes unregistered", async () => {
    let amendmentReads = 0
    let amendmentSearches = 0
    const baseUrl = await startServer({
      ...service(),
      getAmendment: async ({ id }) => {
        amendmentReads += 1
        return { amendment: { id } }
      },
      searchAmendments: async () => {
        amendmentSearches += 1
        return { items: [], truncated: false }
      }
    })

    const responses = await Promise.all([
      fetch(`${baseUrl}/api/amendments`),
      fetch(`${baseUrl}/api/amendments/amendment%3Aus%3A119%3Ahr%3A1`),
      fetch(`${baseUrl}/api/amendments/batch`, {
        body: JSON.stringify({ ids: ["amendment:us:119:hr:1"] }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404])
    expect(amendmentReads).toBe(0)
    expect(amendmentSearches).toBe(0)
  })

  it("projects jurisdiction and session bill pages with trusted canonical URLs and source provenance", async () => {
    const baseUrl = await startServer(service())
    const [jurisdiction, session] = await Promise.all([
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/bills`, { headers: { host: "untrusted.example" } }),
      fetch(`${baseUrl}/api/sessions/session%3Aus%3A119/bills`, { headers: { host: "untrusted.example" } })
    ])

    for (const response of [jurisdiction, session]) {
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({
        data: [
          {
            canonicalUrl: "http://127.0.0.1:3100/api/bills/bill%3Aus%3A119%3Ahr%3A1",
            latestActionAt: "2026-02-01T00:00:00.000Z",
            sources: [{ isOfficial: true, provider: "congress" }],
            type: "bill"
          }
        ]
      })
    }
  })

  it("preserves a persisted null bill status without manufacturing one", async () => {
    const baseUrl = await startServer({
      ...service(),
      browseBills: async () => ({ items: [{ ...bill(), status: null }], truncated: false })
    })

    const response = await fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/bills`)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: [{ status: null }] })
  })

  it("returns 422 instead of an incomplete bill projection when persisted provenance is malformed", async () => {
    const baseUrl = await startServer({
      ...service(),
      browseBills: async () => ({ items: [{ ...bill(), sourceUrl: "not a URL" }], truncated: false })
    })

    const response = await fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/bills`)
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
  })

  it("returns canonical parent-scoped section resources without trusting the Host header", async () => {
    const baseUrl = await startServer(service())
    const [document, material] = await Promise.all([
      fetch(`${baseUrl}/api/documents/document%3A1/sections/section%3A1`, { headers: { host: "untrusted.example" } }),
      fetch(`${baseUrl}/api/supporting-materials/material%3A1/sections/section%3A1`, {
        headers: { host: "untrusted.example" }
      })
    ])

    expect(document.status).toBe(200)
    expect(material.status).toBe(200)
    await expect(document.json()).resolves.toMatchObject({
      data: { canonicalUrl: "http://127.0.0.1:3100/api/documents/document%3A1/sections/section%3A1" }
    })
    await expect(material.json()).resolves.toMatchObject({
      data: {
        canonicalUrl: "http://127.0.0.1:3100/api/supporting-materials/material%3A1/sections/section%3A1"
      }
    })
  })

  it("uses an observed unknown hostname as a conservative non-official provider", async () => {
    const baseUrl = await startServer({
      ...service(),
      getDocumentSection: async ({ documentId, sectionId }) => ({
        document: {
          billId: "bill:1",
          createdAt: new Date("2026-08-20T15:00:00Z"),
          id: documentId,
          sourceUrl: "https://publisher.example/document",
          updatedAt: new Date("2026-08-20T15:00:00Z")
        },
        section: {
          contentHash: "a".repeat(64),
          heading: null,
          id: sectionId,
          ordinal: 0,
          sourceEndOffset: 1,
          sourceStartOffset: 0,
          text: "Text"
        }
      })
    })

    const response = await fetch(`${baseUrl}/api/documents/document%3A1/sections/section%3A1`)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: { sources: [{ isOfficial: false, provider: "publisher.example" }] }
    })
  })

  it("fails closed with 422 when persisted section provenance has a malformed source URL", async () => {
    const baseUrl = await startServer({
      ...service(),
      getDocumentSection: async ({ documentId, sectionId }) => ({
        document: {
          billId: "bill:1",
          createdAt: new Date("2026-08-20T15:00:00Z"),
          id: documentId,
          sourceUrl: "not a URL",
          updatedAt: new Date("2026-08-20T15:00:00Z")
        },
        section: {
          contentHash: "a".repeat(64),
          heading: null,
          id: sectionId,
          ordinal: 0,
          sourceEndOffset: 1,
          sourceStartOffset: 0,
          text: "Text"
        }
      })
    })

    const response = await fetch(`${baseUrl}/api/documents/document%3A1/sections/section%3A1`)
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
  })

  it("uses page envelopes for registered related-bill and bill-section routes", async () => {
    const baseUrl = await startServer(service())
    const billId = "bill%3Aus%3A119%3Ahr%3A1"
    const [timeline, related, sections, votes] = await Promise.all([
      fetch(`${baseUrl}/api/bills/${billId}/timeline`),
      fetch(`${baseUrl}/api/bills/${billId}/related?mode=explicit`),
      fetch(`${baseUrl}/api/bills/${billId}/sections`),
      fetch(`${baseUrl}/api/bills/${billId}/votes`)
    ])

    expect(timeline.status).toBe(404)
    for (const response of [related, sections]) {
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({
        data: expect.any(Array),
        links: { next: null },
        meta: { limit: expect.any(Number), truncated: false }
      })
    }
    expect(votes.status).toBe(404)
  })

  it("scopes bill changes and validates the contract filters", async () => {
    let received: Parameters<CoreReadQueryApi["searchChanges"]>[0] | undefined
    const baseUrl = await startServer({
      ...service(),
      searchChanges: async (input) => {
        received = input
        return { items: [{ id: "change:1" }], truncated: false }
      }
    })
    const response = await fetch(
      `${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/changes?classification=update&limit=2&observedFrom=2026-01-01T00%3A00%3A00Z&observedTo=2026-01-31T23%3A59%3A59Z`
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [{ id: "change:1" }],
      links: { next: null },
      meta: { limit: 2, truncated: false }
    })
    expect(received).toMatchObject({
      billId: "bill:us:119:hr:1",
      changeType: "update",
      limit: 2,
      observedFrom: new Date("2026-01-01T00:00:00.000Z"),
      observedTo: new Date("2026-01-31T23:59:59.000Z")
    })
  })

  it("rejects invalid bill-change filters and route suffixes", async () => {
    const baseUrl = await startServer(service())
    const [classification, range, ambiguousDate, duplicateDate, suffix, typo] = await Promise.all([
      fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/changes?classification=not-a-change`),
      fetch(
        `${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/changes?observedFrom=2026-02-01T00%3A00%3A00Z&observedTo=2026-01-01T00%3A00%3A00Z`
      ),
      fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/changes?observedFrom=01%2F02%2F2026`),
      fetch(
        `${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/changes?observedFrom=2026-01-01T00%3A00%3A00Z&observedFrom=2026-01-02T00%3A00%3A00Z`
      ),
      fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/changes/extra`),
      fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/changes?limti=20`)
    ])

    expect(classification.status).toBe(400)
    expect(range.status).toBe(400)
    expect(ambiguousDate.status).toBe(400)
    expect(duplicateDate.status).toBe(400)
    expect(suffix.status).toBe(404)
    expect(typo.status).toBe(400)
    await expect(classification.json()).resolves.toMatchObject({ error: { category: "invalid_request" } })
    await expect(range.json()).resolves.toMatchObject({ error: { category: "invalid_request" } })
    await expect(typo.json()).resolves.toMatchObject({ error: { category: "invalid_request" } })
  })

  it("rejects route suffixes and unsupported query parameters", async () => {
    const baseUrl = await startServer(service())
    const [extraSegment, typo] = await Promise.all([
      fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/votes/extra`),
      fetch(`${baseUrl}/api/bills?limti=20`)
    ])

    expect(extraSegment.status).toBe(404)
    expect(typo.status).toBe(400)
    await expect(typo.json()).resolves.toMatchObject({ error: { category: "invalid_request" } })
  })

  it("maps jurisdiction and session bill collection filters into scoped service calls", async () => {
    const billInputs: Parameters<CoreReadQueryApi["browseBills"]>[0][] = []
    const baseUrl = await startServer({
      ...service(),
      browseBills: async (input) => {
        billInputs.push(input)
        return { items: [bill("bill:1")], truncated: false }
      }
    })

    const responses = await Promise.all([
      fetch(
        `${baseUrl}/api/jurisdictions/jurisdiction%3Aus/bills?classification=bill&status=introduced&subject=budget&introducedFrom=2026-01-01&introducedTo=2026-01-31&sessionId=session%3Aus%3A119&sort=introduced-desc&limit=7`
      ),
      fetch(
        `${baseUrl}/api/sessions/session%3Aus%3A119/bills?classification=resolution&status=passed&subject=education&sort=identifier-asc&limit=8`
      )
    ])

    expect(responses.map((response) => response.status)).toEqual([200, 200])
    for (const response of responses) {
      await expect(response.json()).resolves.toMatchObject({
        data: expect.any(Array),
        links: { next: null },
        meta: { truncated: false }
      })
    }
    expect(billInputs).toEqual([
      {
        classification: ["bill"],
        cursor: undefined,
        introducedFrom: "2026-01-01",
        introducedTo: "2026-01-31",
        jurisdictionId: "jurisdiction:us",
        limit: 7,
        sessionId: "session:us:119",
        sort: "introduced-desc",
        status: ["introduced"],
        subject: ["budget"]
      },
      {
        classification: ["resolution"],
        cursor: undefined,
        introducedFrom: undefined,
        introducedTo: undefined,
        jurisdictionId: undefined,
        limit: 8,
        sessionId: "session:us:119",
        sort: "identifier-asc",
        status: ["passed"],
        subject: ["education"]
      }
    ])
  })

  it("rejects invalid scoped collection filters and non-exact routes", async () => {
    const baseUrl = await startServer(service())
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/bills?status=introduced&status=introduced`),
      fetch(`${baseUrl}/api/sessions/session%3Aus%3A119/bills?introducedFrom=2026-02-01&introducedTo=2026-01-01`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/bills?sort=unknown`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/meetings`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/meetings?from=2026-02-01&from=2026-02-02`),
      fetch(`${baseUrl}/api/sessions/session%3Aus%3A119/meetings`),
      fetch(`${baseUrl}/api/sessions/session%3Aus%3A119/meetings/extra`)
    ])

    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 404, 404, 404, 404])
    for (const response of responses.slice(0, 3)) {
      await expect(response.json()).resolves.toMatchObject({ error: { category: "invalid_request" } })
    }
  })

  it("reports invalid batch limits as a client error", async () => {
    const baseUrl = await startServer(service())
    const response = await fetch(`${baseUrl}/api/bills/amendments/batch`, {
      body: JSON.stringify({ billIds: ["bill:us:119:hr:1"], limitPerBill: 0 }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "invalid_request" } })
  })
})
