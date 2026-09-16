import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import type {
  MeetingAgendaItemRead,
  MeetingAgendaListInput,
  MeetingAgendaPage
} from "../../legislation/persistence/queries/meeting-agenda-read.js"
import { close, createLegislationServer } from "../test-http-server.js"
import { createMeetingAgendaReadApiHandler, type MeetingAgendaReadApi } from "./meeting-agenda-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "meeting-agenda-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: MeetingAgendaReadApi) {
  const server = createLegislationServer({
    apiHandler: createMeetingAgendaReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function agenda(meetingId = "event:us:119:hearing:1", id = "agenda:us:119:hearing:1:0"): MeetingAgendaItemRead {
  return {
    amendmentIds: ["amendment:us:119:1"],
    billIds: ["bill:us:119:hr:1"],
    description: "Consider the budget proposal",
    id,
    materialIds: ["material:us:119:agenda"],
    meetingId,
    ordinal: 0,
    source: {
      createdAt: new Date("2026-08-20T15:00:00.000Z"),
      id: meetingId,
      sourceUpdatedAt: null,
      sourceUrl: "https://api.congress.gov/v3/committee-meeting/1",
      updatedAt: new Date("2026-08-21T15:00:00.000Z"),
      upstreamIds: { congress: "committee-meeting/1" }
    },
    status: "scheduled",
    title: "Budget proposal"
  }
}

function service(): MeetingAgendaReadApi {
  return {
    assertMeetingExists: async () => undefined,
    getMeetingAgendaItemRead: async ({ agendaItemId, meetingId }) => agenda(meetingId, agendaItemId),
    listMeetingAgenda: async (input: MeetingAgendaListInput): Promise<MeetingAgendaPage> => ({
      items: [agenda(input.meetingId)],
      truncated: false
    })
  }
}

describe("meeting agenda read API handler", () => {
  it("returns a parent-bound canonical Page<AgendaItem> with documented pagination", async () => {
    let received: MeetingAgendaListInput | undefined
    const baseUrl = await startServer({
      ...service(),
      listMeetingAgenda: async (input) => {
        received = input
        return { items: [agenda(input.meetingId)], nextCursor: "next-cursor", truncated: true }
      }
    })
    const path = "/api/meetings/event%3Aus%3A119%3Ahearing%3A1/agenda?cursor=first&limit=1"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "meeting-agenda" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({ cursor: "first", limit: 1, meetingId: "event:us:119:hearing:1" })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          amendmentIds: ["amendment:us:119:1"],
          billIds: ["bill:us:119:hr:1"],
          canonicalUrl:
            "https://api.example.test/api/meetings/event%3Aus%3A119%3Ahearing%3A1/agenda/agenda%3Aus%3A119%3Ahearing%3A1%3A0",
          materialIds: ["material:us:119:agenda"],
          meetingId: "event:us:119:hearing:1",
          title: "Budget proposal",
          type: "agenda-item"
        }
      ],
      links: { next: expect.stringContaining("cursor=next-cursor"), self: path },
      meta: { correlationId: "meeting-agenda", limit: 1, nextCursor: "next-cursor", truncated: true, warnings: [] }
    })
  })

  it("uses the shared default limit for independent agenda pages", async () => {
    let received: MeetingAgendaListInput | undefined
    const baseUrl = await startServer({
      ...service(),
      listMeetingAgenda: async (input) => {
        received = input
        return { items: [], truncated: false }
      }
    })

    const response = await fetch(`${baseUrl}/api/meetings/event%3Aus%3A119%3Ahearing%3A1/agenda`)

    expect(response.status).toBe(200)
    expect(received).toEqual({ cursor: undefined, limit: 20, meetingId: "event:us:119:hearing:1" })
    await expect(response.json()).resolves.toMatchObject({ meta: { limit: 20 } })
  })

  it("returns a canonical agenda resource and correlates a wrong-parent 404", async () => {
    let received: unknown
    const baseUrl = await startServer({
      ...service(),
      getMeetingAgendaItemRead: async (input) => {
        received = input
        return agenda(input.meetingId, input.agendaItemId)
      }
    })
    const path = "/api/meetings/event%3Aus%3A119%3Ahearing%3A1/agenda/agenda%3Aus%3A119%3Ahearing%3A1%3A0"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "agenda-item" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({ agendaItemId: "agenda:us:119:hearing:1:0", meetingId: "event:us:119:hearing:1" })
    await expect(response.json()).resolves.toMatchObject({
      data: { billIds: ["bill:us:119:hr:1"], meetingId: "event:us:119:hearing:1", type: "agenda-item" },
      links: { self: path },
      meta: { correlationId: "agenda-item", warnings: [] }
    })

    const missingBaseUrl = await startServer({
      ...service(),
      getMeetingAgendaItemRead: async () => {
        throw new LegislationError("not_found", "Agenda item was not found")
      }
    })
    const missing = await fetch(
      `${missingBaseUrl}/api/meetings/event%3Aother/agenda/agenda%3Aus%3A119%3Ahearing%3A1%3A0`,
      { headers: { "x-correlation-id": "wrong-meeting" } }
    )
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "wrong-meeting", retryable: false }
    })
  })

  it("rejects an unavailable parent before querying the collection", async () => {
    let listed = false
    const baseUrl = await startServer({
      ...service(),
      assertMeetingExists: async () => {
        throw new LegislationError("not_found", "Meeting was not found")
      },
      listMeetingAgenda: async () => {
        listed = true
        return { items: [], truncated: false }
      }
    })
    const response = await fetch(`${baseUrl}/api/meetings/event%3Amissing/agenda`)

    expect(response.status).toBe(404)
    expect(listed).toBe(false)
  })

  it("accepts only exact GET routes and the documented bounded query contract", async () => {
    const baseUrl = await startServer(service())
    const path = "/api/meetings/event%3A1/agenda"
    const [unknown, duplicate, badLimit, itemQuery, trailingSlash, wrongMethod, oversized] = await Promise.all([
      fetch(`${baseUrl}${path}?unlisted=true`),
      fetch(`${baseUrl}${path}?cursor=first&cursor=second`),
      fetch(`${baseUrl}${path}?limit=101`),
      fetch(`${baseUrl}${path}/agenda%3A1?limit=1`),
      fetch(`${baseUrl}${path}/`),
      fetch(`${baseUrl}${path}`, { method: "POST" }),
      fetch(`${baseUrl}/api/meetings/${"m".repeat(257)}/agenda`)
    ])

    expect([
      unknown.status,
      duplicate.status,
      badLimit.status,
      itemQuery.status,
      trailingSlash.status,
      wrongMethod.status,
      oversized.status
    ]).toEqual([400, 400, 400, 400, 404, 404, 400])
  })
})
