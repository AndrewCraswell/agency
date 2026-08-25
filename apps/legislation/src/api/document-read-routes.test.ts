import { afterEach, describe, expect, it } from "vitest"
import { LegislationError } from "../legislation/errors.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
import { createDocumentReadApiHandler, type DocumentReadApi } from "./document-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "legislation-document-read-api-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: DocumentReadApi) {
  const server = createLegislationServer({
    apiHandler: createDocumentReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function document(id = "document:us:119:hr:1:ih") {
  return {
    billId: "bill:us:119:hr:1",
    byteSize: null,
    classification: "version" as const,
    contentHash: "a".repeat(64),
    createdAt: new Date("2026-08-20T15:00:00Z"),
    documentDate: "2026-01-03",
    failureCategory: null,
    id,
    mimeType: "application/pdf",
    ocrCompletedAt: new Date("2026-08-20T15:00:00Z"),
    ocrProvider: "azure-document-intelligence",
    ocrStatus: "processed" as const,
    pageCount: 4,
    processingStatus: "processed" as const,
    sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1/text/ih",
    storedUrl: null,
    title: "Introduced in House",
    updatedAt: new Date("2026-08-20T15:00:00Z"),
    versionCode: "ih"
  }
}

function documentSection(documentId = "document:us:119:hr:1:ih") {
  return {
    document: {
      billId: "bill:us:119:hr:1",
      createdAt: new Date("2026-08-20T15:00:00Z"),
      id: documentId,
      sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1/text/ih",
      updatedAt: new Date("2026-08-20T15:00:00Z")
    },
    section: {
      contentHash: "b".repeat(64),
      heading: "Findings",
      id: "section:us:119:hr:1:ih:1",
      ordinal: 1,
      pageEnd: 2,
      pageStart: 1,
      sourceEndOffset: 12,
      sourceStartOffset: 0,
      text: "A finding"
    }
  }
}

function service(): DocumentReadApi {
  return {
    assertBillExists: async () => undefined,
    getDocumentDetail: async (id) => ({ ...document(id), sectionCount: 1, textCharacterCount: 9 }),
    getDocumentSection: async ({ documentId }) => documentSection(documentId),
    listBillDocuments: async () => ({ items: [document()], nextCursor: "document-cursor", truncated: true }),
    listDocumentSections: async () => ({ items: [documentSection()], nextCursor: "section-cursor", truncated: true })
  }
}

describe("document read API handler", () => {
  it("projects bill documents through their canonical top-level URL and forwards every documented filter", async () => {
    let received: unknown
    const baseUrl = await startServer({
      ...service(),
      listBillDocuments: async (input) => {
        received = input
        return { items: [document()], nextCursor: "document-cursor", truncated: true }
      }
    })

    const path =
      "/api/bills/bill%3Aus%3A119%3Ahr%3A1/documents?classification=version&cursor=first&limit=7&processingStatus=processed&versionCode=ih"
    const response = await fetch(`${baseUrl}${path}`, { headers: { host: "untrusted.example" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      billId: "bill:us:119:hr:1",
      classification: "version",
      cursor: "first",
      limit: 7,
      processingStatus: "processed",
      versionCode: "ih"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl: "https://api.example.test/api/documents/document%3Aus%3A119%3Ahr%3A1%3Aih",
          ocrStatus: "processed",
          sources: [{ isOfficial: true, provider: "congress" }],
          storedUrl: null,
          type: "document"
        }
      ],
      links: { next: expect.stringContaining("cursor=document-cursor"), self: path },
      meta: { limit: 7, nextCursor: "document-cursor", truncated: true, warnings: [] }
    })
  })

  it("returns an exact document detail resource without inventing an artifact URL", async () => {
    const baseUrl = await startServer(service())
    const path = "/api/documents/document%3Aus%3A119%3Ahr%3A1%3Aih"
    const response = await fetch(`${baseUrl}${path}`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        canonicalUrl: "https://api.example.test/api/documents/document%3Aus%3A119%3Ahr%3A1%3Aih",
        pageCount: 4,
        sectionCount: 1,
        storedUrl: null,
        textCharacterCount: 9,
        type: "document"
      },
      links: { self: path },
      meta: { warnings: [] }
    })
  })

  it("establishes a bill parent before returning its document page", async () => {
    let documentReads = 0
    const baseUrl = await startServer({
      ...service(),
      assertBillExists: async (billId) => {
        if (billId === "bill:missing") {
          throw new LegislationError("not_found", `Bill ${billId} was not found`)
        }
      },
      listBillDocuments: async () => {
        documentReads += 1
        return { items: [], truncated: false }
      }
    })

    const response = await fetch(`${baseUrl}/api/bills/bill%3Amissing/documents`)
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "not_found", retryable: false } })
    expect(documentReads).toBe(0)
  })

  it("projects persisted document section pages and preserves their page mapping", async () => {
    let received: unknown
    let detailReadId: string | undefined
    const baseUrl = await startServer({
      ...service(),
      getDocumentDetail: async (id) => {
        detailReadId = id
        return { ...document(id), sectionCount: 1, textCharacterCount: 9 }
      },
      listDocumentSections: async (input) => {
        received = input
        return { items: [documentSection(input.documentId)], nextCursor: "section-cursor", truncated: true }
      }
    })
    const path =
      "/api/documents/document%3Aus%3A119%3Ahr%3A1%3Aih/sections?cursor=first&heading=Findings&limit=7&pageFrom=1&pageTo=2"
    const response = await fetch(`${baseUrl}${path}`)

    expect(response.status).toBe(200)
    expect(received).toEqual({
      cursor: "first",
      documentId: "document:us:119:hr:1:ih",
      heading: "Findings",
      limit: 7,
      pageFrom: 1,
      pageTo: 2
    })
    expect(detailReadId).toBe("document:us:119:hr:1:ih")
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl:
            "https://api.example.test/api/documents/document%3Aus%3A119%3Ahr%3A1%3Aih/sections/section%3Aus%3A119%3Ahr%3A1%3Aih%3A1",
          pageEnd: 2,
          pageStart: 1,
          type: "document-section"
        }
      ],
      links: { next: expect.stringContaining("cursor=section-cursor") },
      meta: { limit: 7, nextCursor: "section-cursor", truncated: true }
    })
  })

  it("serves a canonical singular section only below its requested document parent", async () => {
    const received: unknown[] = []
    const baseUrl = await startServer({
      ...service(),
      getDocumentSection: async (input) => {
        received.push(input)
        if (input.documentId !== "document:us:119:hr:1:ih") {
          throw new LegislationError("not_found", "Document section was not found")
        }
        return documentSection(input.documentId)
      }
    })
    const path = "/api/documents/document%3Aus%3A119%3Ahr%3A1%3Aih/sections/section%3Aus%3A119%3Ahr%3A1%3Aih%3A1"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "section-read-1" } })
    const mismatch = await fetch(
      `${baseUrl}/api/documents/document%3Aus%3A119%3Ahr%3A2%3Aih/sections/section%3Aus%3A119%3Ahr%3A1%3Aih%3A1`,
      { headers: { "x-correlation-id": "section-missing-1" } }
    )

    expect(response.status).toBe(200)
    expect(received).toEqual([
      {
        documentId: "document:us:119:hr:1:ih",
        sectionId: "section:us:119:hr:1:ih:1"
      },
      {
        documentId: "document:us:119:hr:2:ih",
        sectionId: "section:us:119:hr:1:ih:1"
      }
    ])
    await expect(response.json()).resolves.toMatchObject({
      data: {
        canonicalUrl:
          "https://api.example.test/api/documents/document%3Aus%3A119%3Ahr%3A1%3Aih/sections/section%3Aus%3A119%3Ahr%3A1%3Aih%3A1",
        pageEnd: 2,
        pageStart: 1,
        type: "document-section"
      },
      links: { self: path },
      meta: { correlationId: "section-read-1", warnings: [] }
    })
    expect(mismatch.status).toBe(404)
    await expect(mismatch.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "section-missing-1", retryable: false }
    })
  })

  it("rejects malformed documented controls and never handles the unsupported material section page", async () => {
    const baseUrl = await startServer(service())
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/bills/bill%3A1/documents?classification=unknown`),
      fetch(`${baseUrl}/api/documents/document%3A1?limit=1`),
      fetch(`${baseUrl}/api/documents/document%3A1/sections?pageFrom=2&pageTo=1`),
      fetch(`${baseUrl}/api/documents/document%3A1/sections?heading=a&heading=b`),
      fetch(`${baseUrl}/api/documents/document%3A1/sections/section%3A1?limit=1`),
      fetch(`${baseUrl}/api/documents/${"a".repeat(257)}/sections/section%3A1`),
      fetch(`${baseUrl}/api/supporting-materials/material%3A1/sections?pageFrom=1`),
      fetch(`${baseUrl}/api/documents/%ZZ`)
    ])

    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 400, 400, 400, 404, 400])
    for (const response of [...responses.slice(0, 6), responses[7]]) {
      await expect(response.json()).resolves.toMatchObject({ error: { category: expect.any(String) } })
    }
  })

  it("fails closed when a document projection is incomplete", async () => {
    const baseUrl = await startServer({
      ...service(),
      getDocumentDetail: async (id) => ({
        ...document(id),
        ocrStatus: "not-canonical" as never,
        sectionCount: 1,
        textCharacterCount: 9
      })
    })

    const response = await fetch(`${baseUrl}/api/documents/document%3A1`)
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
  })
})
