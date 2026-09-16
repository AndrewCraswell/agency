import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import type {
  BillRelatedHitRead,
  BillRelatedPage,
  BillRelationRead
} from "../../legislation/persistence/queries/bill-related-read"
import { close, createLegislationServer } from "../test-http-server"
import { createBillRelatedReadApiHandler, type BillRelatedReadApi } from "./bill-related-read-routes"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "bill-related-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: BillRelatedReadApi) {
  const server = createLegislationServer({
    apiHandler: createBillRelatedReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
    logger
  })
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
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
    id,
    identifier: "H.R. 1",
    introducedAt: new Date("2026-01-03T00:00:00.000Z"),
    jurisdictionId: "jurisdiction:us",
    latestActionAt: new Date("2026-08-21T15:00:00.000Z"),
    sessionId: "session:us:119",
    sourceUrl: `https://api.example.test/bills/${encodeURIComponent(id)}`,
    status: "pending",
    subjects: ["Budget"],
    title: "Budget Act",
    updatedAt: new Date("2026-08-22T15:00:00.000Z"),
    upstreamIds: { congress: "119/hr/1" }
  }
}

function relation(overrides: Partial<BillRelationRead> = {}): BillRelationRead {
  return {
    canonicalFactsComplete: true,
    classification: "companion",
    direction: "outgoing",
    provenanceComplete: true,
    sourceIsOfficial: true,
    sourceProvider: "congress",
    sourceRetrievedAt: new Date("2026-08-22T15:00:00.000Z"),
    sourceUpdatedAt: new Date("2026-08-21T15:00:00.000Z"),
    sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1/related",
    ...overrides
  }
}

function relatedHit(overrides: Partial<BillRelatedHitRead> = {}): BillRelatedHitRead {
  return { bill: bill("bill:us:119:s:2"), relationship: relation(), similarityScore: null, ...overrides }
}

async function getPage(service: BillRelatedReadApi, path: string) {
  const baseUrl = await startServer(service)
  return await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "bill-related-test" } })
}

describe("bill related read API handler", () => {
  it("projects explicit relation provenance and preserves repeated classifications", async () => {
    let received: unknown
    const response = await getPage(
      {
        assertBillExists: async () => undefined,
        listBillRelatedBills: async (input) => {
          received = input
          return { items: [relatedHit()], nextCursor: "next", truncated: true }
        }
      },
      "/api/bills/bill%3Aus%3A119%3Ahr%3A1/related?classification=companion&classification=related&limit=1&mode=explicit"
    )

    expect(response.status).toBe(200)
    expect(received).toEqual({
      billId: "bill:us:119:hr:1",
      classifications: ["companion", "related"],
      cursor: undefined,
      limit: 1,
      mode: "explicit"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          bill: { id: "bill:us:119:s:2", type: "bill" },
          relationship: {
            classification: "companion",
            relatedBill: { id: "bill:us:119:s:2", type: "bill" },
            sources: [{ provider: "congress", isOfficial: true }]
          },
          similarityScore: null,
          sources: [{ provider: "congress", isOfficial: true }]
        }
      ],
      links: { next: expect.stringContaining("cursor=next") },
      meta: { correlationId: "bill-related-test", limit: 1, nextCursor: "next", truncated: true }
    })
  })

  it("returns semantic hits without inventing a relationship", async () => {
    const response = await getPage(
      {
        assertBillExists: async () => undefined,
        listBillRelatedBills: async () => ({
          items: [relatedHit({ relationship: null, similarityScore: 0.88 })],
          truncated: false
        })
      },
      "/api/bills/bill%3Aus%3A119%3Ahr%3A1/related?mode=similar"
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [{ relationship: null, similarityScore: 0.88, sources: [{ provider: "congress" }] }]
    })
  })

  it("returns typed dependency unavailable errors from semantic retrieval", async () => {
    const response = await getPage(
      {
        assertBillExists: async () => undefined,
        listBillRelatedBills: async () => {
          throw new LegislationError("dependency_unavailable", "The bill similarity index is not ready")
        }
      },
      "/api/bills/bill%3Aus%3A119%3Ahr%3A1/related?mode=similar"
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "dependency_unavailable", retryable: true }
    })
  })

  it("checks parent existence before querying related rows", async () => {
    let listed = false
    const response = await getPage(
      {
        assertBillExists: async () => {
          throw new LegislationError("not_found", "Bill was not found")
        },
        listBillRelatedBills: async (): Promise<BillRelatedPage> => {
          listed = true
          return { items: [], truncated: false }
        }
      },
      "/api/bills/bill%3Amissing/related"
    )

    expect(response.status).toBe(404)
    expect(listed).toBe(false)
  })

  it("rejects undocumented, duplicate, and invalid related filters", async () => {
    const service: BillRelatedReadApi = {
      assertBillExists: async () => undefined,
      listBillRelatedBills: async (input) => {
        if (input.cursor === "not-a-cursor") {
          throw new LegislationError("invalid_request", "Invalid related bills pagination cursor")
        }
        return { items: [], truncated: false }
      }
    }
    const baseUrl = await startServer(service)
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/bills/bill%3A1/related?unknown=1`),
      fetch(`${baseUrl}/api/bills/bill%3A1/related?mode=explicit&mode=similar`),
      fetch(`${baseUrl}/api/bills/bill%3A1/related?classification=not-a-classification`),
      fetch(`${baseUrl}/api/bills/bill%3A1/related?classification=related&classification=related`),
      fetch(`${baseUrl}/api/bills/bill%3A1/related?limit=101`),
      fetch(`${baseUrl}/api/bills/bill%3A1/related?cursor=not-a-cursor`)
    ])
    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 400, 400, 400])
  })

  it("does not treat doubled or trailing slashes as the canonical route", async () => {
    let called = false
    const baseUrl = await startServer({
      assertBillExists: async () => undefined,
      listBillRelatedBills: async () => {
        called = true
        return { items: [], truncated: false }
      }
    })
    const responses = await Promise.all([
      fetch(`${baseUrl}/api//bills/bill%3A1/related`),
      fetch(`${baseUrl}/api/bills//related`),
      fetch(`${baseUrl}/api/bills/bill%3A1/related/`)
    ])
    expect(responses.map((response) => response.status)).toEqual([404, 404, 404])
    expect(called).toBe(false)
  })

  it("fails closed when persisted relation provenance is incomplete", async () => {
    const response = await getPage(
      {
        assertBillExists: async () => undefined,
        listBillRelatedBills: async () => ({
          items: [relatedHit({ relationship: relation({ sourceUrl: null, provenanceComplete: false }) })],
          truncated: false
        })
      },
      "/api/bills/bill%3Aus%3A119%3Ahr%3A1/related?mode=explicit"
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
  })
})
