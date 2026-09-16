import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import type { MeetingDocumentRead } from "../../legislation/persistence/queries/meeting-document-read.js"
import { close, createLegislationServer } from "../test-http-server.js"
import { createMeetingDocumentReadApiHandler, type MeetingDocumentReadApi } from "./meeting-document-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "meeting-document-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: MeetingDocumentReadApi) {
  const server = createLegislationServer({
    apiHandler: createMeetingDocumentReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function document(meetingId = "event:us:119:hearing:1", id = "event-document:us:119:hearing:1:agenda") {
  return {
    classification: "agenda",
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
    documentId: null,
    id,
    materialId: null,
    meetingId,
    sourceUrl: "https://api.congress.gov/v3/committee-meeting/1/document/agenda",
    title: "Budget hearing packet",
    updatedAt: new Date("2026-08-20T15:00:00.000Z")
  } satisfies MeetingDocumentRead
}

describe("meeting document read API handler", () => {
  it("returns the parent-bound canonical Page<EventDocument> envelope", async () => {
    let received: unknown
    const baseUrl = await startServer({
      assertMeetingExists: async () => undefined,
      listMeetingDocuments: async (input) => {
        received = input
        return { items: [document(input.meetingId)], nextCursor: "next-cursor", truncated: true }
      }
    })
    const path = "/api/meetings/event%3Aus%3A119%3Ahearing%3A1/documents?classification=agenda&limit=1"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "meeting-documents" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      classification: "agenda",
      cursor: undefined,
      limit: 1,
      meetingId: "event:us:119:hearing:1"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl:
            "https://api.example.test/api/meetings/event%3Aus%3A119%3Ahearing%3A1/documents/event-document%3Aus%3A119%3Ahearing%3A1%3Aagenda",
          classification: "agenda",
          documentId: null,
          materialId: null,
          meetingId: "event:us:119:hearing:1",
          type: "event-document"
        }
      ],
      links: {
        next: "/api/meetings/event%3Aus%3A119%3Ahearing%3A1/documents?classification=agenda&limit=1&cursor=next-cursor",
        self: path
      },
      meta: { correlationId: "meeting-documents", limit: 1, nextCursor: "next-cursor", truncated: true, warnings: [] }
    })
  })

  it("checks the public parent before listing child rows and returns a correlated 404", async () => {
    let listed = false
    const baseUrl = await startServer({
      assertMeetingExists: async () => {
        throw new LegislationError("not_found", "Meeting was not found")
      },
      listMeetingDocuments: async () => {
        listed = true
        return { items: [], truncated: false }
      }
    })
    const response = await fetch(`${baseUrl}/api/meetings/event%3Amissing/documents`, {
      headers: { "x-correlation-id": "missing-meeting" }
    })

    expect(response.status).toBe(404)
    expect(listed).toBe(false)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "missing-meeting", retryable: false }
    })
  })

  it("uses the shared default limit for independent document pages", async () => {
    let received: unknown
    const baseUrl = await startServer({
      assertMeetingExists: async () => undefined,
      listMeetingDocuments: async (input) => {
        received = input
        return { items: [], truncated: false }
      }
    })

    const response = await fetch(`${baseUrl}/api/meetings/event%3Aus%3A119%3Ahearing%3A1/documents`)

    expect(response.status).toBe(200)
    expect(received).toEqual({
      classification: undefined,
      cursor: undefined,
      limit: 20,
      meetingId: "event:us:119:hearing:1"
    })
    await expect(response.json()).resolves.toMatchObject({ meta: { limit: 20 } })
  })

  it("accepts only the documented GET query contract with bounded single values", async () => {
    const baseUrl = await startServer({
      assertMeetingExists: async () => undefined,
      listMeetingDocuments: async () => ({ items: [], truncated: false })
    })
    const longClassification = "a".repeat(257)
    const [extraPath, wrongMethod, unsupported, duplicate, oversized, limit] = await Promise.all([
      fetch(`${baseUrl}/api/meetings/event%3A1/documents/extra`),
      fetch(`${baseUrl}/api/meetings/event%3A1/documents`, { method: "POST" }),
      fetch(`${baseUrl}/api/meetings/event%3A1/documents?unknown=value`),
      fetch(`${baseUrl}/api/meetings/event%3A1/documents?classification=agenda&classification=minutes`),
      fetch(`${baseUrl}/api/meetings/event%3A1/documents?classification=${longClassification}`),
      fetch(`${baseUrl}/api/meetings/event%3A1/documents?limit=101`)
    ])

    expect([
      extraPath.status,
      wrongMethod.status,
      unsupported.status,
      duplicate.status,
      oversized.status,
      limit.status
    ]).toEqual([404, 404, 400, 400, 400, 400])
    await expect(unsupported.json()).resolves.toMatchObject({
      error: { category: "invalid_request", retryable: false }
    })
  })
})
