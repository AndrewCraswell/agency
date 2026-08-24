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

function service(): CoreReadQueryApi {
  return {
    browseBills: async () => ({ items: [{ id: "bill:us:119:hr:1" }], truncated: false }),
    findRelatedBills: async () => ({ items: [], truncated: false }),
    getAmendment: async ({ id }) => ({ amendment: { id } }),
    getBill: async ({ id }) => ({ bill: { id } }),
    getBillText: async () => ({ sections: [{ id: "section:1" }], truncated: false }),
    getBillTimeline: async () => ({ events: [{ id: "action:1" }], truncated: false }),
    getBillVotes: async ({ billId }) => ({ items: [], billId, truncated: false }),
    getDocument: async ({ id }) => ({ document: { id } }),
    getDocumentSections: async () => ({ items: [], truncated: false }),
    getJurisdiction: async (id) => ({ id }),
    getSession: async (id) => ({ id }),
    getSupportingMaterial: async ({ id }) => ({ material: { id } }),
    getVote: async ({ id }) => ({ vote: { id } }),
    listJurisdictions: async () => ({ items: [{ id: "jurisdiction:us" }], truncated: false }),
    listSessions: async () => ({ items: [{ id: "session:us:119" }], truncated: false }),
    searchAmendments: async () => ({ items: [], truncated: false, warnings: [] }),
    searchChanges: async () => ({ items: [], truncated: false }),
    searchEvents: async () => ({ items: [{ id: "event:1" }], truncated: false }),
    searchSupportingMaterials: async () => ({ items: [], truncated: false }),
    searchVotes: async () => ({ items: [], truncated: false })
  }
}

describe("core read API handler", () => {
  it("wraps canonical reads in the public resource envelope", async () => {
    const baseUrl = await startServer(service())
    const response = await fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1`, {
      headers: { "x-correlation-id": "core-read-test" }
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: { bill: { id: "bill:us:119:hr:1" } },
      links: { self: "/api/bills/bill%3Aus%3A119%3Ahr%3A1" },
      meta: { correlationId: "core-read-test", warnings: [] }
    })
  })

  it("returns pages with cursor metadata and a stable next link", async () => {
    const baseUrl = await startServer(service())
    const response = await fetch(`${baseUrl}/api/jurisdictions?limit=10`)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      data: [{ id: "jurisdiction:us" }],
      links: { next: null, self: "/api/jurisdictions?limit=10" },
      meta: { correlationId: expect.any(String), limit: 10, nextCursor: null, truncated: false, warnings: [] }
    })
    expect(body).toMatchObject({ meta: { correlationId: response.headers.get("x-correlation-id") } })
  })

  it("returns item-level errors for an otherwise valid batch", async () => {
    const baseUrl = await startServer({
      ...service(),
      getVote: async ({ id }) => {
        if (id === "vote:missing") {
          const { LegislationError } = await import("../legislation/errors.js")
          throw new LegislationError("not_found", "Vote vote:missing was not found")
        }
        return { vote: { id } }
      }
    })
    const response = await fetch(`${baseUrl}/api/votes/batch`, {
      body: JSON.stringify({ ids: ["vote:ok", "vote:missing"] }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [
        { data: { vote: { id: "vote:ok" } }, id: "vote:ok", status: "ok" },
        { error: { category: "not_found" }, id: "vote:missing", status: "error" }
      ]
    })
  })

  it("keeps absent route slices absent instead of manufacturing a placeholder response", async () => {
    const baseUrl = await startServer(service())
    const response = await fetch(`${baseUrl}/api/subscriptions`)

    expect(response.status).toBe(404)
  })

  it("uses page envelopes for timelines, bill sections, and bill votes", async () => {
    const baseUrl = await startServer(service())
    const billId = "bill%3Aus%3A119%3Ahr%3A1"
    const [timeline, sections, votes] = await Promise.all([
      fetch(`${baseUrl}/api/bills/${billId}/timeline`),
      fetch(`${baseUrl}/api/bills/${billId}/sections`),
      fetch(`${baseUrl}/api/bills/${billId}/votes`)
    ])

    for (const response of [timeline, sections, votes]) {
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({
        data: expect.any(Array),
        links: { next: null },
        meta: { limit: expect.any(Number), truncated: false }
      })
    }
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

  it("maps jurisdiction and session collection filters into scoped service calls", async () => {
    const billInputs: Parameters<CoreReadQueryApi["browseBills"]>[0][] = []
    const meetingInputs: Parameters<CoreReadQueryApi["searchEvents"]>[0][] = []
    const baseUrl = await startServer({
      ...service(),
      browseBills: async (input) => {
        billInputs.push(input)
        return { items: [{ id: "bill:1" }], truncated: false }
      },
      searchEvents: async (input) => {
        meetingInputs.push(input)
        return { items: [{ id: "meeting:1" }], truncated: false }
      }
    })

    const responses = await Promise.all([
      fetch(
        `${baseUrl}/api/jurisdictions/jurisdiction%3Aus/bills?classification=bill&status=introduced&subject=budget&introducedFrom=2026-01-01&introducedTo=2026-01-31&sessionId=session%3Aus%3A119&sort=introduced-desc&limit=7`
      ),
      fetch(
        `${baseUrl}/api/sessions/session%3Aus%3A119/bills?classification=resolution&status=passed&subject=education&sort=identifier-asc&limit=8`
      ),
      fetch(
        `${baseUrl}/api/jurisdictions/jurisdiction%3Aus/meetings?organizationId=organization%3Aus%3Ahouse&classification=hearing&status=scheduled&from=2026-02-01T00%3A00%3A00Z&to=2026-02-28T23%3A59%3A59Z&limit=9`
      )
    ])

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200])
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
    expect(meetingInputs).toEqual([
      {
        classification: ["hearing"],
        cursor: undefined,
        from: new Date("2026-02-01T00:00:00.000Z"),
        jurisdictionId: "jurisdiction:us",
        limit: 9,
        organizationId: "organization:us:house",
        sort: "starts-asc",
        status: ["scheduled"],
        to: new Date("2026-02-28T23:59:59.000Z")
      }
    ])
  })

  it("rejects invalid scoped collection filters and non-exact routes", async () => {
    const baseUrl = await startServer(service())
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/bills?status=introduced&status=introduced`),
      fetch(`${baseUrl}/api/sessions/session%3Aus%3A119/bills?introducedFrom=2026-02-01&introducedTo=2026-01-01`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/bills?sort=unknown`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/meetings?from=2026-02-30`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aus/meetings?from=2026-02-01&from=2026-02-02`),
      fetch(`${baseUrl}/api/sessions/session%3Aus%3A119/meetings`),
      fetch(`${baseUrl}/api/sessions/session%3Aus%3A119/meetings/extra`)
    ])

    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 400, 400, 404, 404])
    for (const response of responses.slice(0, 5)) {
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
