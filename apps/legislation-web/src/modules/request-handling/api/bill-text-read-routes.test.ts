import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import { close, createLegislationServer } from "../test-http-server"
import type { BillTextReadApi } from "./bill-text-read-routes"
import { createBillTextReadApiHandler } from "./bill-text-read-routes"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "legislation-bill-text-read-api-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: BillTextReadApi): Promise<string> {
  const server = createLegislationServer({
    apiHandler: createBillTextReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function section(documentId = "document:us:119:hr:1:ih") {
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

function service(): BillTextReadApi {
  return {
    assertBillExists: async () => undefined,
    listBillTextSections: async () => ({ items: [section()], nextCursor: "section-cursor", truncated: true })
  }
}

describe("bill text read API handler", () => {
  it("traverses only the requested processed bill-version section set through the canonical section URL", async () => {
    let received: unknown
    const baseUrl = await startServer({
      ...service(),
      listBillTextSections: async (input) => {
        received = input
        return { items: [section()], nextCursor: "section-cursor", truncated: true }
      }
    })
    const cursor = Buffer.from(
      JSON.stringify({
        documentDate: "2026-01-03",
        documentId: "document:us:119:hr:1:eh",
        ordinal: 1,
        scope: {
          billId: "bill:us:119:hr:1",
          documentIds: ["document:us:119:hr:1:eh", "document:us:119:hr:1:ih"],
          heading: "Findings",
          pageFrom: 1,
          pageTo: 2,
          versionCodes: ["eh", "ih"]
        },
        sectionId: "section:us:119:hr:1:eh:1",
        version: 1,
        versionCode: "eh"
      })
    ).toString("base64url")
    const path = `/api/bills/bill%3Aus%3A119%3Ahr%3A1/sections?cursor=${cursor}&documentId=document%3Aus%3A119%3Ahr%3A1%3Aih&documentId=document%3Aus%3A119%3Ahr%3A1%3Aeh&heading=Findings&limit=7&pageFrom=1&pageTo=2&versionCode=ih&versionCode=eh`

    const response = await fetch(`${baseUrl}${path}`)

    expect(response.status).toBe(200)
    expect(received).toEqual({
      billId: "bill:us:119:hr:1",
      cursor,
      documentIds: ["document:us:119:hr:1:eh", "document:us:119:hr:1:ih"],
      heading: "Findings",
      limit: 7,
      pageFrom: 1,
      pageTo: 2,
      versionCodes: ["eh", "ih"]
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          billId: "bill:us:119:hr:1",
          canonicalUrl:
            "https://api.example.test/api/documents/document%3Aus%3A119%3Ahr%3A1%3Aih/sections/section%3Aus%3A119%3Ahr%3A1%3Aih%3A1",
          documentId: "document:us:119:hr:1:ih",
          pageEnd: 2,
          pageStart: 1,
          type: "document-section"
        }
      ],
      links: { next: expect.stringContaining("cursor=section-cursor"), self: path },
      meta: { limit: 7, nextCursor: "section-cursor", truncated: true, warnings: [] }
    })
  })

  it("validates every query control before looking up the parent bill", async () => {
    let parentReads = 0
    let listReads = 0
    const baseUrl = await startServer({
      ...service(),
      assertBillExists: async () => {
        parentReads += 1
      },
      listBillTextSections: async () => {
        listReads += 1
        return { items: [], truncated: false }
      }
    })

    const responses = await Promise.all([
      fetch(`${baseUrl}/api/bills/bill%3A1/sections?documentId=a&documentId=a`),
      fetch(`${baseUrl}/api/bills/bill%3A1/sections?pageFrom=2&pageTo=1`),
      fetch(`${baseUrl}/api/bills/bill%3A1/sections?cursor=a&cursor=b`),
      fetch(`${baseUrl}/api/bills/bill%3A1/sections?ignored=true`),
      fetch(`${baseUrl}/api/bills/%ZZ/sections`),
      fetch(`${baseUrl}/%61pi/bills/bill%3A1/sections`)
    ])

    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 400, 400, 404])
    expect(parentReads).toBe(0)
    expect(listReads).toBe(0)
  })

  it("establishes the bill parent before returning an empty text traversal", async () => {
    let listReads = 0
    const baseUrl = await startServer({
      ...service(),
      assertBillExists: async () => {
        throw new LegislationError("not_found", "Bill bill:missing was not found")
      },
      listBillTextSections: async () => {
        listReads += 1
        return { items: [], truncated: false }
      }
    })

    const response = await fetch(`${baseUrl}/api/bills/bill%3Amissing/sections`)

    expect(response.status).toBe(404)
    expect(listReads).toBe(0)
  })
})
