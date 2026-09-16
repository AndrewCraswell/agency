import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import type { EventDocumentRead } from "../../legislation/persistence/queries/event-document-read.js"
import { close, createLegislationServer } from "../test-http-server.js"
import { createEventDocumentReadApiHandler, type EventDocumentReadApi } from "./event-document-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "event-document-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: EventDocumentReadApi) {
  const server = createLegislationServer({
    apiHandler: createEventDocumentReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function eventDocument(meetingId: string, eventDocumentId: string): EventDocumentRead {
  const createdAt = new Date("2026-08-20T15:00:00.000Z")
  return {
    classification: "agenda",
    createdAt,
    documentId: null,
    id: eventDocumentId,
    materialId: null,
    meetingId,
    sourceUrl: "https://api.congress.gov/v3/committee-meeting/1/agenda.pdf",
    title: "Committee agenda",
    updatedAt: createdAt
  }
}

function service(): EventDocumentReadApi {
  return {
    getEventDocument: async ({ eventDocumentId, meetingId }) => eventDocument(meetingId, eventDocumentId)
  }
}

describe("event document read API handler", () => {
  it("projects the exact meeting-scoped event document through a canonical resource envelope", async () => {
    let received: Readonly<{ eventDocumentId: string; meetingId: string }> | undefined
    const baseUrl = await startServer({
      getEventDocument: async (input) => {
        received = input
        return eventDocument(input.meetingId, input.eventDocumentId)
      }
    })
    const path =
      "/api/meetings/meeting%3Aus%3A119%3Acommittee%3A1/documents/event-document%3Aus%3A119%3Acommittee%3A1%3Aagenda"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "event-document-read" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      eventDocumentId: "event-document:us:119:committee:1:agenda",
      meetingId: "meeting:us:119:committee:1"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: {
        canonicalUrl:
          "https://api.example.test/api/meetings/meeting%3Aus%3A119%3Acommittee%3A1/documents/event-document%3Aus%3A119%3Acommittee%3A1%3Aagenda",
        classification: "agenda",
        documentId: null,
        materialId: null,
        meetingId: "meeting:us:119:committee:1",
        sourceUrl: "https://api.congress.gov/v3/committee-meeting/1/agenda.pdf",
        type: "event-document"
      },
      links: { self: path },
      meta: { correlationId: "event-document-read", warnings: [] }
    })
  })

  it("returns a correlated 404 when the event document is absent from the requested meeting", async () => {
    const baseUrl = await startServer({
      getEventDocument: async () => {
        throw new LegislationError("not_found", "Event document was not found")
      }
    })
    const response = await fetch(
      `${baseUrl}/api/meetings/meeting%3Aother/documents/event-document%3Aus%3A119%3Acommittee%3A1%3Aagenda`,
      { headers: { "x-correlation-id": "wrong-meeting" } }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "wrong-meeting", retryable: false }
    })
  })

  it("accepts only the exact GET route with bounded IDs and no query parameters", async () => {
    const baseUrl = await startServer(service())
    const path = "/api/meetings/meeting%3A1/documents/event-document%3A1"
    const [extraPath, unsupportedQuery, wrongMethod, oversizedId] = await Promise.all([
      fetch(`${baseUrl}${path}/extra`),
      fetch(`${baseUrl}${path}?limit=1`),
      fetch(`${baseUrl}${path}`, { method: "POST" }),
      fetch(`${baseUrl}/api/meetings/${"m".repeat(257)}/documents/event-document%3A1`)
    ])

    expect([extraPath.status, unsupportedQuery.status, wrongMethod.status, oversizedId.status]).toEqual([
      404, 400, 404, 400
    ])
    await expect(unsupportedQuery.json()).resolves.toMatchObject({
      error: { category: "invalid_request", retryable: false }
    })
    await expect(oversizedId.json()).resolves.toMatchObject({
      error: { category: "invalid_request", retryable: false }
    })
  })
})
