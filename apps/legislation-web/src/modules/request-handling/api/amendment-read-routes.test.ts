import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import {
  amendmentContinuationCursor,
  amendmentActionSourceUrl,
  compareAmendmentReadOrder,
  decodeAmendmentContinuationCursor,
  isStructuredAmendmentComplete
} from "../../legislation/persistence/queries/amendment-reads.js"
import { close, createLegislationServer } from "../test-http-server.js"
import type { AmendmentReadRepository } from "./amendment-read-repository.js"
import { createAmendmentReadApiHandler } from "./amendment-read-routes.js"
import type { AmendmentDetail, AmendmentSummary } from "./canonical-projection.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "legislation-amendment-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(
  repository: Omit<AmendmentReadRepository, "assertBill"> & Partial<Pick<AmendmentReadRepository, "assertBill">>
): Promise<string> {
  const completeRepository: AmendmentReadRepository = {
    assertBill: repository.assertBill ?? (async () => undefined),
    getAmendment: repository.getAmendment,
    listAmendments: repository.listAmendments
  }
  const server = createLegislationServer({ apiHandler: createAmendmentReadApiHandler(completeRepository), logger })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP address")
  }
  return `http://127.0.0.1:${address.port}`
}

function summary(id: string, billId = "bill:1"): AmendmentSummary {
  return {
    billId,
    canonicalUrl: `https://api.example.test/api/amendments/${encodeURIComponent(id)}`,
    documentId: null,
    id,
    identifier: "Amdt 1",
    jurisdictionId: "jurisdiction:us",
    recordType: "structured",
    sources: [
      {
        isOfficial: true,
        provider: "congress",
        retrievedAt: "2026-08-25T00:00:00.000Z",
        sourceUpdatedAt: null,
        sourceUrl: "https://api.congress.gov/v3/amendment/119/hamdt/1"
      }
    ],
    status: "introduced",
    submittedDate: "2026-02-01",
    title: "Amendment title",
    type: "amendment",
    updatedAt: "2026-08-25T00:00:00.000Z"
  }
}

function detail(id: string): AmendmentDetail {
  return { ...summary(id), actions: [], description: null, documents: [], sponsors: [] }
}

describe("amendment read API handler", () => {
  it("passes every exact collection filter to its repository and returns a canonical page", async () => {
    let received: unknown
    const baseUrl = await startServer({
      getAmendment: async (id) => detail(id),
      listAmendments: async (input) => {
        received = input
        return { items: [summary("amendment:1")], nextCursor: "next", truncated: true }
      }
    })

    const response = await fetch(
      `${baseUrl}/api/amendments?billId=bill%3A1&jurisdictionId=jurisdiction%3Aus&sponsorPersonId=person%3A1&recordType=structured&status=introduced&submittedFrom=2026-01-01&submittedTo=2026-02-01&sort=updated-desc&limit=7&cursor=cursor-1`
    )

    expect(response.status).toBe(200)
    expect(received).toEqual({
      billId: "bill:1",
      cursor: "cursor-1",
      jurisdictionId: "jurisdiction:us",
      limit: 7,
      recordType: "structured",
      sponsorPersonId: "person:1",
      status: "introduced",
      submittedFrom: "2026-01-01",
      submittedTo: "2026-02-01",
      sort: "updated-desc"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [{ id: "amendment:1" }],
      links: { next: expect.stringContaining("cursor=next") },
      meta: { limit: 7, nextCursor: "next", truncated: true }
    })
  })

  it("returns a resource detail and keeps individual amendment batch failures isolated", async () => {
    const baseUrl = await startServer({
      getAmendment: async (id) => {
        if (id === "amendment:missing") {
          throw new LegislationError("not_found", "Amendment amendment:missing was not found")
        }
        if (id === "amendment:incomplete") {
          throw new LegislationError("unprocessable", "Structured amendment has no canonical bill parent")
        }
        return detail(id)
      },
      listAmendments: async () => ({ items: [], truncated: false })
    })

    const [single, batch] = await Promise.all([
      fetch(`${baseUrl}/api/amendments/amendment%3Aok`),
      fetch(`${baseUrl}/api/amendments/batch`, {
        body: JSON.stringify({ ids: ["amendment:ok", "amendment:missing", "amendment:incomplete"] }),
        headers: { "content-type": "application/json", "x-correlation-id": "amendment-batch-1" },
        method: "POST"
      })
    ])

    expect(single.status).toBe(200)
    await expect(single.json()).resolves.toMatchObject({ data: { id: "amendment:ok" } })
    expect(batch.status).toBe(200)
    await expect(batch.json()).resolves.toMatchObject({
      data: [
        { id: "amendment:ok", status: "ok" },
        { error: { category: "not_found", retryable: false }, id: "amendment:missing", status: "error" },
        {
          error: { category: "dependency_unavailable", retryable: false },
          id: "amendment:incomplete",
          status: "error"
        }
      ],
      meta: { correlationId: "amendment-batch-1", requested: 3, returned: 3 }
    })
  })

  it("de-duplicates amendment batch IDs in first-occurrence order and accepts 25 unique IDs", async () => {
    const ids = Array.from({ length: 25 }, (_value, index) => `amendment:${index + 1}`)
    const baseUrl = await startServer({
      getAmendment: async (id) => detail(id),
      listAmendments: async () => ({ items: [], truncated: false })
    })

    const response = await fetch(`${baseUrl}/api/amendments/batch`, {
      body: JSON.stringify({ ids: [...ids, ids[0]] }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: ids.map((id) => ({ id, status: "ok" })),
      meta: { requested: 25, returned: 25 }
    })
  })

  it("accepts a batch body exactly at the 5 MiB limit and rejects one byte over", async () => {
    const baseUrl = await startServer({
      getAmendment: async (id) => detail(id),
      listAmendments: async () => ({ items: [], truncated: false })
    })
    const maximumBytes = 5 * 1024 * 1024
    const json = JSON.stringify({ ids: ["amendment:boundary"] })
    const padding = " ".repeat(maximumBytes - new TextEncoder().encode(json).byteLength)
    const atLimit = `${json}${padding}`

    const [accepted, rejected] = await Promise.all([
      fetch(`${baseUrl}/api/amendments/batch`, {
        body: atLimit,
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/amendments/batch`, {
        body: `${atLimit} `,
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    ])

    expect(accepted.status).toBe(200)
    await expect(accepted.json()).resolves.toMatchObject({
      data: [{ id: "amendment:boundary", status: "ok" }],
      meta: { requested: 1, returned: 1 }
    })
    expect(rejected.status).toBe(413)
    await expect(rejected.json()).resolves.toMatchObject({ error: { category: "payload_too_large" } })
  })

  it("gives every bill batch item a separately filtered page and isolates a missing bill", async () => {
    const received: unknown[] = []
    const baseUrl = await startServer({
      assertBill: async (billId) => {
        if (billId === "bill:missing") {
          throw new LegislationError("not_found", "Bill bill:missing was not found")
        }
      },
      getAmendment: async (id) => detail(id),
      listAmendments: async (input) => {
        received.push(input)
        return { items: [summary(`amendment:${input.billId}`, input.billId)], nextCursor: "bill-next", truncated: true }
      }
    })

    const response = await fetch(`${baseUrl}/api/bills/amendments/batch`, {
      body: JSON.stringify({
        billIds: ["bill:one", "bill:missing"],
        limitPerBill: 7,
        recordType: ["structured"],
        status: ["introduced"],
        submittedFrom: "2026-01-01",
        submittedTo: "2026-02-01"
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(response.status).toBe(200)
    expect(received).toEqual([
      {
        billId: "bill:one",
        limit: 7,
        recordTypes: ["structured"],
        statuses: ["introduced"],
        submittedFrom: "2026-01-01",
        submittedTo: "2026-02-01"
      }
    ])
    const body = (await response.json()) as { data: Array<{ page?: { links?: { next?: string } } }> }
    expect(body).toMatchObject({
      data: [
        { billId: "bill:one", page: { data: [{ billId: "bill:one" }] }, status: "ok" },
        { billId: "bill:missing", error: { category: "not_found" }, status: "error" }
      ]
    })
    const page = body.data[0]?.page
    expect(page?.links?.next).toContain("recordType=structured")
    expect(page?.links?.next).toContain("status=introduced")
    expect(page?.links?.next).toContain("limit=7")
  })

  it("owns repeated-filter bill amendment pages and rejects a missing bill before listing", async () => {
    let received: unknown
    const baseUrl = await startServer({
      assertBill: async (billId) => {
        if (billId === "bill:missing") {
          throw new LegislationError("not_found", "Bill bill:missing was not found")
        }
      },
      getAmendment: async (id) => detail(id),
      listAmendments: async (input) => {
        received = input
        return { items: [summary("amendment:1", input.billId)], nextCursor: "next", truncated: true }
      }
    })

    const [page, missing] = await Promise.all([
      fetch(
        `${baseUrl}/api/bills/bill%3A1/amendments?recordType=structured&recordType=document&status=introduced&status=engrossed&limit=7`
      ),
      fetch(`${baseUrl}/api/bills/bill%3Amissing/amendments`)
    ])

    expect(page.status).toBe(200)
    expect(received).toEqual({
      billId: "bill:1",
      cursor: undefined,
      limit: 7,
      recordTypes: ["structured", "document"],
      statuses: ["introduced", "engrossed"],
      submittedFrom: undefined,
      submittedTo: undefined
    })
    await expect(page.json()).resolves.toMatchObject({
      links: {
        next: expect.stringContaining(
          "recordType=structured&recordType=document&status=introduced&status=engrossed&limit=7"
        )
      },
      meta: { nextCursor: "next" }
    })
    expect(missing.status).toBe(404)
  })

  it("rejects malformed paths, repeated or blank values, unsupported filters, and invalid batch shapes", async () => {
    const baseUrl = await startServer({
      getAmendment: async (id) => detail(id),
      listAmendments: async () => ({ items: [], truncated: false })
    })
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/amendments?sort=updated-desc&sort=submitted-desc`),
      fetch(`${baseUrl}/api/amendments?status=`),
      fetch(`${baseUrl}/api/amendments?submittedFrom=2026-02-02&submittedTo=2026-02-01`),
      fetch(`${baseUrl}/api/amendments?unknown=true`),
      fetch(`${baseUrl}/api/amendments/%E0%A4%A`),
      fetch(`${baseUrl}/api//amendments/amendment%3A1`),
      fetch(`${baseUrl}/%61pi/amendments/amendment%3A1`),
      fetch(`${baseUrl}/api/bills//amendments`),
      fetch(`${baseUrl}/api/amendments/batch`, {
        body: JSON.stringify({ ids: ["amendment:1"], ignored: true }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/bills/amendments/batch`, {
        body: JSON.stringify({ billIds: ["bill:1"], ignored: true }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    ])
    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 400, 400, 404, 404, 400, 400, 400])
  })
})

describe("amendment read ordering and cursor codec", () => {
  it("orders mixed structured and document rows with nullable submitted dates deterministically", () => {
    const structured = summary("amendment:structured")
    const document = { ...summary("amendment:document:doc"), documentId: "doc", recordType: "document" as const }
    const later = { ...summary("amendment:later"), submittedDate: "2026-02-02" }
    const nullDate = { ...summary("amendment:null"), submittedDate: null }
    expect(
      [document, nullDate, structured, later].toSorted((left, right) =>
        compareAmendmentReadOrder(left, right, "submitted-desc")
      )
    ).toEqual([later, structured, document, nullDate])
  })

  it("binds cross-record-type continuation cursors to canonicalized array filters", () => {
    const document = { ...summary("amendment:document:doc"), documentId: "doc", recordType: "document" as const }
    const input = {
      billId: "bill:1",
      recordTypes: ["document", "structured"] as const,
      statuses: ["engrossed", "introduced"] as const,
      submittedFrom: "2026-01-01",
      submittedTo: "2026-02-01"
    }
    const cursor = amendmentContinuationCursor(document, input)
    expect(
      decodeAmendmentContinuationCursor(cursor, {
        ...input,
        recordTypes: ["structured", "document"],
        statuses: ["introduced", "engrossed"]
      })
    ).toMatchObject({
      id: document.id,
      recordType: "document"
    })
    expect(() => decodeAmendmentContinuationCursor(cursor, { ...input, billId: "bill:2" })).toThrowError(
      new LegislationError("invalid_request", "cursor is not valid for these amendment filters")
    )
  })

  it("exposes detached structured-row completeness as a distinct fail-closed condition", () => {
    expect(isStructuredAmendmentComplete({ billId: "bill:1" })).toBe(true)
    expect(isStructuredAmendmentComplete({ billId: null })).toBe(false)
    expect(() => amendmentActionSourceUrl(null)).toThrowError(
      new LegislationError("unprocessable", "Amendment action canonical provenance is not persisted")
    )
  })
})
