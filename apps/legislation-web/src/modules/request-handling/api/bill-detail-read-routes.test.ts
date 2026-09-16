import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import {
  BILL_DETAIL_READ_LIMITS,
  requiredVoteSourceUrl
} from "../../legislation/persistence/queries/bill-detail-read.js"
import { close, createLegislationServer } from "../test-http-server.js"
import type { BillDetailReadRepository } from "./bill-detail-read-repository.js"
import { createBillDetailReadApiHandler } from "./bill-detail-read-routes.js"
import type { BillDetail } from "./canonical-projection.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "legislation-bill-detail-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(
  repository: Pick<BillDetailReadRepository, "getBillDetail"> & Partial<Omit<BillDetailReadRepository, "getBillDetail">>
) {
  const completeRepository: BillDetailReadRepository = {
    getBillDetail: repository.getBillDetail,
    listBillVotes: repository.listBillVotes ?? (async () => ({ items: [], truncated: false }))
  }
  const server = createLegislationServer({ apiHandler: createBillDetailReadApiHandler(completeRepository), logger })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP server address")
  }
  return `http://127.0.0.1:${address.port}`
}

function detail(id: string): BillDetail {
  const sources: BillDetail["sources"] = [
    {
      isOfficial: true,
      provider: "congress",
      retrievedAt: "2026-08-25T00:00:00.000Z",
      sourceUpdatedAt: null,
      sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1"
    }
  ]
  const relatedBill: BillDetail["relations"][number]["relatedBill"] = {
    canonicalUrl: "https://api.example.test/api/bills/bill%3Aus%3A119%3Ahr%3A2",
    classification: ["bill"],
    id: "bill:us:119:hr:2",
    identifier: "HR 2",
    introducedDate: "2026-01-04",
    jurisdictionId: "jurisdiction:us",
    latestActionAt: null,
    sessionId: "session:us:119",
    sources,
    status: null,
    subjects: [],
    title: "Related bill",
    type: "bill",
    updatedAt: "2026-08-25T00:00:00.000Z"
  }
  return {
    abstract: null,
    amendments: [
      {
        billId: id,
        canonicalUrl: "https://api.example.test/api/amendments/amendment%3A1",
        documentId: null,
        id: "amendment:1",
        identifier: "Amdt 1",
        jurisdictionId: "jurisdiction:us",
        recordType: "structured",
        sources,
        status: "introduced",
        submittedDate: "2026-02-01",
        title: "Test amendment",
        type: "amendment",
        updatedAt: "2026-08-25T00:00:00.000Z"
      }
    ],
    canonicalUrl: `https://api.example.test/api/bills/${encodeURIComponent(id)}`,
    childPageInfo: {
      amendments: { limit: 25, nextCursor: "amendment-cursor", truncated: true },
      documents: { limit: 25, nextCursor: "document-cursor", truncated: true },
      votes: { limit: 25, nextCursor: null, truncated: false }
    },
    classification: ["bill"],
    documents: [],
    id,
    identifier: "HR 1",
    introducedDate: "2026-01-03",
    jurisdictionId: "jurisdiction:us",
    latestActionAt: null,
    latestActions: [
      {
        billId: id,
        canonicalUrl: `https://api.example.test/api/bills/${encodeURIComponent(id)}/timeline#action%3A1`,
        classifications: ["passage"],
        date: "2026-02-01",
        description: "Passed committee",
        id: "action:1",
        occurredAt: null,
        organization: null,
        sequence: 0,
        sources,
        type: "bill-action",
        updatedAt: "2026-08-25T00:00:00.000Z"
      }
    ],
    organizations: [],
    relations: [{ classification: "related", relatedBill, sources }],
    sessionId: "session:us:119",
    sources,
    sponsors: [
      { classification: "primary", isPrimary: true, person: null, sourceName: "Representative Example", sources }
    ],
    status: null,
    subjects: [],
    title: "Test bill",
    type: "bill",
    updatedAt: "2026-08-25T00:00:00.000Z",
    voteSummaries: [
      {
        billId: id,
        canonicalUrl: "https://api.example.test/api/votes/vote%3A1",
        classification: "roll-call",
        counts: {
          absent: 0,
          abstain: 0,
          no: 1,
          notVoting: 0,
          other: 0,
          paired: 0,
          present: 0,
          proxy: 0,
          yes: 2
        },
        date: "2026-02-01",
        heldAt: "2026-02-01T12:00:00.000Z",
        id: "vote:1",
        motion: "Passage",
        organizationId: null,
        question: null,
        result: "passed",
        sources,
        type: "vote",
        updatedAt: "2026-08-25T00:00:00.000Z"
      }
    ]
  }
}

describe("bill detail read API handler", () => {
  it("serves the exact GET route with independently scoped child page information", async () => {
    let received: unknown
    const baseUrl = await startServer({
      getBillDetail: async (input) => {
        received = input
        return detail(input.id)
      }
    })

    const response = await fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1?childLimit=7`)

    expect(response.status).toBe(200)
    expect(received).toEqual({ childLimit: 7, id: "bill:us:119:hr:1" })
    await expect(response.json()).resolves.toMatchObject({
      data: {
        childPageInfo: { amendments: { nextCursor: "amendment-cursor" }, documents: { nextCursor: "document-cursor" } },
        latestActions: [{ id: "action:1" }],
        relations: [{ relatedBill: { id: "bill:us:119:hr:2" } }],
        sponsors: [{ sourceName: "Representative Example" }],
        voteSummaries: [{ counts: { yes: 2 }, id: "vote:1" }]
      },
      links: { self: "/api/bills/bill%3Aus%3A119%3Ahr%3A1" }
    })
  })

  it("deduplicates batches in first-occurrence order and isolates incomplete bill records", async () => {
    const baseUrl = await startServer({
      getBillDetail: async ({ id }) => {
        if (id === "bill:incomplete") {
          throw new LegislationError("unprocessable", "Bill relation canonical provenance is not persisted")
        }
        if (id === "bill:missing") {
          throw new LegislationError("not_found", "Bill bill:missing was not found")
        }
        return detail(id)
      }
    })

    const response = await fetch(`${baseUrl}/api/bills/batch`, {
      body: JSON.stringify({ ids: ["bill:ok", "bill:incomplete", "bill:ok", "bill:missing"] }),
      headers: { "content-type": "application/json", "x-correlation-id": "bill-batch-1" },
      method: "POST"
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [
        { id: "bill:ok", status: "ok" },
        { error: { category: "dependency_unavailable", retryable: false }, id: "bill:incomplete", status: "error" },
        { error: { category: "not_found", retryable: false }, id: "bill:missing", status: "error" }
      ],
      meta: { correlationId: "bill-batch-1", requested: 3, returned: 3 }
    })
  })

  it("caps concurrent batch reads while preserving item order", async () => {
    let active = 0
    let maximumActive = 0
    const baseUrl = await startServer({
      getBillDetail: async ({ id }) => {
        active += 1
        maximumActive = Math.max(maximumActive, active)
        await new Promise<void>((resolve) => setTimeout(resolve, 10))
        active -= 1
        return detail(id)
      }
    })

    const ids = Array.from({ length: 9 }, (_value, index) => `bill:${index}`)
    const response = await fetch(`${baseUrl}/api/bills/batch`, {
      body: JSON.stringify({ ids }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: ids.map((id) => ({ id, status: "ok" })) })
    expect(maximumActive).toBeLessThanOrEqual(4)
  })

  it("serves non-empty bill vote continuation pages with their own cursor", async () => {
    let voteInput: unknown
    const baseUrl = await startServer({
      getBillDetail: async ({ id }) => detail(id),
      listBillVotes: async (input) => {
        voteInput = input
        return {
          items: [
            {
              ...detail(input.billId).voteSummaries[0],
              positions: [],
              positionsPageInfo: { limit: 1, nextCursor: null, truncated: false }
            }
          ],
          nextCursor: "vote-next",
          truncated: true
        }
      }
    })

    const [votes, invalid] = await Promise.all([
      fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/votes?limit=25&result=passed`),
      fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/votes?unknown=value`)
    ])

    expect(votes.status).toBe(200)
    expect(invalid.status).toBe(400)
    expect(voteInput).toMatchObject({ billId: "bill:us:119:hr:1", limit: 25, result: "passed" })
    await expect(votes.json()).resolves.toMatchObject({
      data: [{ id: "vote:1", positions: [] }],
      meta: { nextCursor: "vote-next" }
    })
  })

  it("keeps detail child reads bounded and treats missing vote provenance as unprocessable", () => {
    expect(BILL_DETAIL_READ_LIMITS).toEqual({ actions: 101, organizations: 251, relations: 501, sponsors: 501 })
    expect(() => requiredVoteSourceUrl(null)).toThrowError(
      new LegislationError("unprocessable", "Vote canonical provenance is not persisted")
    )
  })

  it("rejects repeated vote relationship values and inverted date ranges", async () => {
    const baseUrl = await startServer({ getBillDetail: async ({ id }) => detail(id) })
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/bills/bill%3A1/votes?result=passed&result=failed`),
      fetch(`${baseUrl}/api/bills/bill%3A1/votes?from=2026-02-02T00%3A00%3A00Z&to=2026-02-01T00%3A00%3A00Z`)
    ])

    expect(responses.map((response) => response.status)).toEqual([400, 400])
  })

  it("rejects noncanonical paths, unsupported queries, and malformed batches", async () => {
    const baseUrl = await startServer({ getBillDetail: async ({ id }) => detail(id) })
    const [query, path, batch] = await Promise.all([
      fetch(`${baseUrl}/api/bills/bill%3A1?cursor=wrong`),
      fetch(`${baseUrl}/api/bills/bill%3A1/documents`),
      fetch(`${baseUrl}/api/bills/batch`, {
        body: JSON.stringify({ ids: ["bill:1"], ignored: true }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    ])

    expect(query.status).toBe(400)
    expect(path.status).toBe(404)
    expect(batch.status).toBe(400)
  })
})
