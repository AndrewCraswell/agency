import { createServer, type Server } from "node:http"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { afterEach, describe, expect, it } from "vitest"
import type { CanonicalDocumentRead } from "../../legislation/persistence/queries/document-reads"
import { createDocumentDiffApiHandler, type DocumentDiffApi } from "./document-diff-routes"

const servers = new Set<Server>()

afterEach(async () => {
  await Promise.all(
    [...servers].map(
      async (server) =>
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error === undefined ? resolve() : reject(error)))
        )
    )
  )
  servers.clear()
})

function document(id: string): CanonicalDocumentRead {
  return {
    billId: "bill:us:119:hr:1",
    byteSize: null,
    classification: "version",
    contentHash: "a".repeat(64),
    createdAt: new Date("2026-08-25T00:00:00.000Z"),
    documentDate: "2026-01-01",
    failureCategory: null,
    id,
    mimeType: "text/plain",
    ocrCompletedAt: new Date("2026-08-25T00:00:00.000Z"),
    ocrProvider: "azure-document-intelligence",
    ocrStatus: "processed",
    pageCount: 1,
    processingStatus: "processed",
    sourceUrl: "https://www.congress.gov/bill-text",
    storedUrl: null,
    title: "Bill text",
    updatedAt: new Date("2026-08-25T00:00:00.000Z"),
    versionCode: "ih"
  }
}

function service(overrides: Partial<DocumentDiffApi> = {}): DocumentDiffApi {
  return {
    readDocumentDiff: async () => ({
      left: {
        document: document("document:left"),
        text: "old funding"
      },
      right: {
        document: document("document:right"),
        text: "new funding"
      }
    }),
    ...overrides
  }
}

async function start(api: DocumentDiffApi): Promise<string> {
  const handler = createDocumentDiffApiHandler(api, { apiBaseUrl: "https://api.example.test" })
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
    throw new Error("Expected TCP address")
  }
  return `http://127.0.0.1:${address.port}`
}

async function post(baseUrl: string, body: unknown) {
  return await fetch(`${baseUrl}/api/document-diffs`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST"
  })
}

function assertRecord(value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected a JSON object")
  }
}

describe("document diff route", () => {
  it("projects canonical documents, exact hunk operations, and hides unchanged hunks by default", async () => {
    const baseUrl = await start(service())
    const response = await post(baseUrl, {
      billId: "bill:us:119:hr:1",
      granularity: "word",
      leftDocumentId: "document:left",
      rightDocumentId: "document:right"
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        counts: { changed: 1 },
        granularity: "word",
        hunks: [
          {
            classification: "changed",
            leftStart: 0,
            operations: expect.arrayContaining([expect.objectContaining({ classification: "delete", leftStart: 0 })]),
            rightStart: 0
          }
        ],
        leftDocument: { id: "document:left", ocrStatus: "processed", type: "document" },
        rightDocument: { id: "document:right", type: "document" }
      }
    })
  })

  it("rejects malformed, equal, and filter-mismatched requests before reads", async () => {
    let calls = 0
    const baseUrl = await start(
      service({
        readDocumentDiff: async () => {
          calls += 1
          throw new Error("should not run")
        }
      })
    )
    const [same, unknown, badCursor] = await Promise.all([
      post(baseUrl, { billId: "bill:1", leftDocumentId: "document:1", rightDocumentId: "document:1" }),
      post(baseUrl, { billId: "bill:1", leftDocumentId: "document:1", rightDocumentId: "document:2", extra: true }),
      post(baseUrl, { billId: "bill:1", cursor: "bad", leftDocumentId: "document:1", rightDocumentId: "document:2" })
    ])

    expect([same.status, unknown.status, badCursor.status]).toEqual([400, 400, 400])
    expect(calls).toBe(0)
  })

  it("preserves conflict semantics for unprocessed or ownership-mismatched reads", async () => {
    const baseUrl = await start(
      service({
        readDocumentDiff: async () => {
          throw new LegislationError("conflict", "Both documents must have processed text before they can be compared")
        }
      })
    )
    const response = await post(baseUrl, {
      billId: "bill:1",
      leftDocumentId: "document:1",
      rightDocumentId: "document:2"
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "conflict" } })
  })

  it("returns a filter-bound continuation cursor for visible hunks", async () => {
    const baseUrl = await start(
      service({
        readDocumentDiff: async () => ({
          left: {
            document: document("document:left"),
            text: "old\n\nRetained paragraph.\n\nold"
          },
          right: {
            document: document("document:right"),
            text: "new\n\nRetained paragraph.\n\nnew"
          }
        })
      })
    )
    const body = {
      billId: "bill:us:119:hr:1",
      leftDocumentId: "document:left",
      limit: 1,
      rightDocumentId: "document:right"
    }
    const first = await post(baseUrl, body)
    const firstPayload = await first.json()
    assertRecord(firstPayload)
    const firstData = firstPayload.data
    assertRecord(firstData)
    const second = await post(baseUrl, { ...body, cursor: firstData.nextCursor })
    const changedFilter = await post(baseUrl, { ...body, cursor: firstData.nextCursor, granularity: "word" })

    expect(first.status).toBe(200)
    expect(firstData.hunks).toHaveLength(1)
    expect(firstData.nextCursor).toEqual(expect.any(String))
    await expect(second.json()).resolves.toMatchObject({
      data: { hunks: [{ classification: "changed" }], nextCursor: null }
    })
    expect(changedFilter.status).toBe(400)
  })
})
