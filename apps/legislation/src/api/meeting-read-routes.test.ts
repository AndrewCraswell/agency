import { afterEach, describe, expect, it } from "vitest"
import type { MeetingRead } from "../db/queries/meeting-read.js"
import { LegislationError } from "../legislation/errors.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
import { createMeetingReadApiHandler, type MeetingReadApi } from "./meeting-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "meeting-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: MeetingReadApi) {
  const server = createLegislationServer({
    apiHandler: createMeetingReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function meeting(): MeetingRead {
  return {
    calendarId: "calendar:wa:committee-schedule:2026",
    classification: "meeting",
    description: "A source-declared meeting",
    endAt: null,
    id: "event:openstates:rules-1",
    allDay: false,
    isRemote: false,
    jurisdictionId: "jurisdiction:wa",
    location: { name: "Capitol" },
    name: "Rules Committee",
    organizationIds: ["organization:openstates:rules"],
    publisherLocalDate: "2026-08-17",
    sessionIds: ["session:wa:2026"],
    sourceIsOfficial: false,
    sourceProvider: "openstates",
    sourceRetrievedAt: new Date("2026-08-01T00:00:00Z"),
    sourceSequence: 0,
    sourceUpdatedAt: null,
    sourceUrl: "https://leg.example.test/events/rules-1",
    startAt: new Date("2026-08-17T17:00:00Z"),
    status: "scheduled",
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    virtualAccess: null
  }
}

function service(): MeetingReadApi {
  return {
    assertJurisdictionExists: async () => undefined,
    assertOrganizationExists: async () => undefined,
    assertSessionExists: async () => undefined,
    getMeetingRead: async () => meeting(),
    listMeetingAgenda: async () => ({ items: [], truncated: false }),
    listMeetingDocuments: async () => ({ items: [], truncated: false }),
    listMeetings: async () => ({ items: [meeting()], truncated: false }),
    listMeetingOrganizations: async () => [],
    listMeetingOutcomes: async () => ({ items: [], truncated: false }),
    listMeetingParticipants: async () => ({ items: [], truncated: false })
  }
}

describe("meeting read API handler", () => {
  it("serves the canonical jurisdiction meeting collection with its exact documented query", async () => {
    let received: unknown
    const baseUrl = await startServer({
      ...service(),
      listMeetings: async (input) => {
        received = input
        return { items: [meeting()], nextCursor: "next-meeting", truncated: true }
      }
    })
    const path =
      "/api/jurisdictions/jurisdiction%3Awa/meetings?classification=meeting&from=2026-08-01T00:00:00Z&limit=1&organizationId=organization%3Aopenstates%3Arules&status=scheduled&to=2026-08-31T23:59:59Z"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "meeting-page" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      billId: undefined,
      calendarId: undefined,
      classification: "meeting",
      cursor: undefined,
      from: "2026-08-01T00:00:00Z",
      isRemote: undefined,
      jurisdictionId: "jurisdiction:wa",
      limit: 1,
      organizationId: "organization:openstates:rules",
      sessionId: undefined,
      sort: "starts-asc",
      status: "scheduled",
      to: "2026-08-31T23:59:59Z"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          calendarId: "calendar:wa:committee-schedule:2026",
          canonicalUrl: "https://api.example.test/api/meetings/event%3Aopenstates%3Arules-1",
          date: "2026-08-17",
          organizationIds: ["organization:openstates:rules"],
          sessionIds: ["session:wa:2026"],
          type: "meeting"
        }
      ],
      meta: { correlationId: "meeting-page", limit: 1, nextCursor: "next-meeting", truncated: true, warnings: [] }
    })
  })

  it("uses the shared default page limit and rejects scoped sort overrides", async () => {
    let received: unknown
    const baseUrl = await startServer({
      ...service(),
      listMeetings: async (input) => {
        received = input
        return { items: [], truncated: false }
      }
    })

    const response = await fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Awa/meetings`)
    const invalidSort = await fetch(`${baseUrl}/api/sessions/session%3Awa%3A2026/meetings?sort=starts-desc`)

    expect(response.status).toBe(200)
    expect(received).toMatchObject({ limit: 20, sort: "starts-asc" })
    expect(invalidSort.status).toBe(400)
  })

  it("accepts valid temporal ranges and rejects invalid temporal bounds", async () => {
    const baseUrl = await startServer(service())
    const validMixed = await fetch(
      `${baseUrl}/api/jurisdictions/jurisdiction%3Awa/meetings?from=2026-08-01&to=2026-08-31T00:00:00Z`
    )
    const invertedMixed = await fetch(
      `${baseUrl}/api/jurisdictions/jurisdiction%3Awa/meetings?from=2026-09-01T00:00:00Z&to=2026-08-31`
    )
    const impossibleDate = await fetch(
      `${baseUrl}/api/jurisdictions/jurisdiction%3Awa/meetings?from=2026-02-30&to=2026-03-01`
    )
    const impossibleTimestamp = await fetch(
      `${baseUrl}/api/jurisdictions/jurisdiction%3Awa/meetings?from=2026-02-28T25:00:00Z&to=2026-03-01T00:00:00Z`
    )
    const duplicate = await fetch(
      `${baseUrl}/api/jurisdictions/jurisdiction%3Awa/meetings?from=2026-08-01&from=2026-08-02&to=2026-08-31`
    )

    expect(validMixed.status).toBe(200)
    expect(invertedMixed.status).toBe(400)
    expect(impossibleDate.status).toBe(400)
    expect(impossibleTimestamp.status).toBe(400)
    expect(duplicate.status).toBe(400)
  })

  it("binds the session collection to its path and rejects unrelated query scope", async () => {
    let received: unknown
    const baseUrl = await startServer({
      ...service(),
      listMeetings: async (input) => {
        received = input
        return { items: [], truncated: false }
      }
    })
    const response = await fetch(
      `${baseUrl}/api/sessions/session%3Awa%3A2026/meetings?organizationId=organization%3Aopenstates%3Arules`
    )

    expect(response.status).toBe(200)
    expect(received).toMatchObject({
      organizationId: "organization:openstates:rules",
      sessionId: "session:wa:2026",
      sort: "starts-asc"
    })
    const invalid = await fetch(`${baseUrl}/api/sessions/session%3Awa%3A2026/meetings?sessionId=session%3Awa%3A2025`)
    expect(invalid.status).toBe(400)
  })

  it("returns parent 404s and serves the global collection with documented filters", async () => {
    let received: unknown
    const baseUrl = await startServer({
      ...service(),
      assertOrganizationExists: async () => {
        throw new LegislationError("not_found", "Organization organization:missing was not found")
      },
      listMeetings: async (input) => {
        received = input
        return { items: [meeting()], truncated: false }
      }
    })
    const missing = await fetch(`${baseUrl}/api/organizations/organization%3Amissing/meetings`, {
      headers: { "x-correlation-id": "missing-parent" }
    })
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "missing-parent" }
    })
    const global = await fetch(
      `${baseUrl}/api/meetings?billId=bill%3A1&calendarId=calendar%3A1&isRemote=false&jurisdictionId=jurisdiction%3Awa`
    )
    expect(global.status).toBe(200)
    await expect(global.json()).resolves.toMatchObject({
      data: [{ calendarId: "calendar:wa:committee-schedule:2026", type: "meeting" }]
    })
    expect(received).toMatchObject({
      billId: "bill:1",
      calendarId: "calendar:1",
      isRemote: false,
      jurisdictionId: "jurisdiction:wa",
      limit: 20
    })
  })

  it("deduplicates repeated global meeting enum filters into cursor-bound canonical arrays", async () => {
    let received: unknown
    const baseUrl = await startServer({
      ...service(),
      listMeetings: async (input) => {
        received = input
        return { items: [], truncated: false }
      }
    })

    const response = await fetch(
      `${baseUrl}/api/meetings?classification=meeting&classification=hearing&classification=meeting&status=scheduled&status=completed&status=scheduled`
    )

    expect(response.status).toBe(200)
    expect(received).toMatchObject({
      classifications: ["hearing", "meeting"],
      statuses: ["completed", "scheduled"]
    })
  })

  it("serves a bounded canonical detail and rejects encoded route literals or malformed IDs", async () => {
    let childLimit: number | undefined
    const baseUrl = await startServer({
      ...service(),
      listMeetingAgenda: async (input) => {
        childLimit = input.limit
        return { items: [], nextCursor: "agenda-next", truncated: true }
      }
    })
    const detail = await fetch(`${baseUrl}/api/meetings/event%3Aopenstates%3Arules-1?childLimit=2`, {
      headers: { "x-correlation-id": "meeting-detail" }
    })
    expect(detail.status).toBe(200)
    expect(childLimit).toBe(2)
    await expect(detail.json()).resolves.toMatchObject({
      data: {
        childPageInfo: {
          agenda: { limit: 2, nextCursor: "agenda-next", truncated: true },
          documents: { limit: 2, nextCursor: null, truncated: false }
        },
        calendarId: "calendar:wa:committee-schedule:2026",
        type: "meeting"
      },
      meta: { correlationId: "meeting-detail" }
    })
    expect((await fetch(`${baseUrl}/%61pi/meetings/event%3Aopenstates%3Arules-1`)).status).toBe(404)
    expect((await fetch(`${baseUrl}/api/meetings/%`)).status).toBe(400)
  })
})
