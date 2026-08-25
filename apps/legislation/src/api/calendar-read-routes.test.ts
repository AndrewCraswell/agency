import { afterEach, describe, expect, it } from "vitest"
import type { MeetingRead } from "../db/queries/meeting-read.js"
import { LegislationError } from "../legislation/errors.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
import type { CalendarRead } from "./calendar-read-repository.js"
import { createCalendarReadApiHandler, type CalendarReadApi } from "./calendar-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "calendar-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: CalendarReadApi) {
  const server = createLegislationServer({
    apiHandler: createCalendarReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function calendar(overrides: Partial<CalendarRead> = {}): CalendarRead {
  return {
    classification: "legislative-schedule",
    coverageFrom: new Date("2026-01-01T00:00:00.000Z"),
    coverageTo: new Date("2026-12-31T00:00:00.000Z"),
    description: "The published 2026 committee schedule.",
    id: "calendar:wa:committee-schedule:2026",
    isActive: true,
    jurisdictionId: "jurisdiction:wa",
    name: "Committee schedule",
    organizationId: "organization:wa:house",
    sourceUrl: "https://leg.wa.gov/calendars/committee-schedule-2026",
    sources: [
      {
        isOfficial: true,
        provider: "wa-legislature",
        retrievedAt: new Date("2026-08-01T00:00:00.000Z"),
        sourceUpdatedAt: null,
        sourceUrl: "https://leg.wa.gov/calendars/committee-schedule-2026"
      }
    ],
    timezone: "America/Los_Angeles",
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides
  }
}

function meeting(): MeetingRead {
  return {
    classification: "meeting",
    description: null,
    endAt: null,
    id: "event:wa:rules-1",
    isRemote: false,
    jurisdictionId: "jurisdiction:wa",
    location: null,
    name: "Rules Committee",
    organizationIds: ["organization:wa:house"],
    publisherLocalDate: "2026-08-17",
    sessionIds: ["session:wa:2026"],
    sourceIsOfficial: true,
    sourceProvider: "wa-legislature",
    sourceRetrievedAt: new Date("2026-08-01T00:00:00.000Z"),
    sourceSequence: 1,
    sourceUpdatedAt: null,
    sourceUrl: "https://leg.wa.gov/events/rules-1",
    startAt: new Date("2026-08-17T17:00:00.000Z"),
    status: "scheduled",
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    virtualAccess: null
  }
}

function service(): CalendarReadApi {
  return {
    assertCalendarExists: async () => undefined,
    assertOrganizationExists: async () => undefined,
    getCalendarRead: async () => calendar(),
    listCalendarMeetings: async () => ({ items: [meeting()], truncated: false }),
    listCalendars: async () => ({ items: [calendar()], truncated: false })
  }
}

describe("calendar read API handler", () => {
  it("serves the canonical calendar collection with its exact documented filters and cursor", async () => {
    let received: unknown
    const baseUrl = await startServer({
      ...service(),
      listCalendars: async (input) => {
        received = input
        return { items: [calendar()], nextCursor: "calendar-keyset", truncated: true }
      }
    })
    const path =
      "/api/calendars?jurisdictionId=jurisdiction%3Awa&organizationId=organization%3Awa%3Ahouse&classification=legislative-schedule&isActive=true&q=committee&limit=1"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "calendar-page" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      classification: "legislative-schedule",
      cursor: undefined,
      isActive: true,
      jurisdictionId: "jurisdiction:wa",
      limit: 1,
      organizationId: "organization:wa:house",
      query: "committee"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl: "https://api.example.test/api/calendars/calendar%3Awa%3Acommittee-schedule%3A2026",
          id: "calendar:wa:committee-schedule:2026",
          sourceUrl: "https://leg.wa.gov/calendars/committee-schedule-2026",
          type: "calendar"
        }
      ],
      links: { next: `${path}&cursor=calendar-keyset`, self: path },
      meta: { correlationId: "calendar-page", limit: 1, nextCursor: "calendar-keyset", truncated: true, warnings: [] }
    })
  })

  it("serves canonical details and binds meeting results to the calendar parent", async () => {
    let received: unknown
    const baseUrl = await startServer({
      ...service(),
      listCalendarMeetings: async (input) => {
        received = input
        return { items: [meeting()], nextCursor: "meeting-keyset", truncated: true }
      }
    })
    const detail = await fetch(`${baseUrl}/api/calendars/calendar%3Awa%3Acommittee-schedule%3A2026`, {
      headers: { "x-correlation-id": "calendar-detail" }
    })
    expect(detail.status).toBe(200)
    await expect(detail.json()).resolves.toMatchObject({
      data: {
        coverageFrom: "2026-01-01",
        coverageTo: "2026-12-31",
        description: "The published 2026 committee schedule.",
        type: "calendar"
      },
      meta: { correlationId: "calendar-detail", warnings: [] }
    })

    const path =
      "/api/calendars/calendar%3Awa%3Acommittee-schedule%3A2026/meetings?from=2026-08-01&to=2026-08-31&status=scheduled&sort=starts-desc&limit=1"
    const meetings = await fetch(`${baseUrl}${path}`)
    expect(meetings.status).toBe(200)
    expect(received).toEqual({
      calendarId: "calendar:wa:committee-schedule:2026",
      cursor: undefined,
      from: "2026-08-01",
      limit: 1,
      sort: "starts-desc",
      status: "scheduled",
      to: "2026-08-31"
    })
    await expect(meetings.json()).resolves.toMatchObject({
      data: [{ calendarId: "calendar:wa:committee-schedule:2026", type: "meeting" }],
      links: { next: `${path}&cursor=meeting-keyset` }
    })
  })

  it("binds organization calendars to the path and checks the parent before listing", async () => {
    let listed = false
    const baseUrl = await startServer({
      ...service(),
      assertOrganizationExists: async () => {
        throw new LegislationError("not_found", "Organization organization:missing was not found")
      },
      listCalendars: async () => {
        listed = true
        return { items: [], truncated: false }
      }
    })
    const missing = await fetch(`${baseUrl}/api/organizations/organization%3Amissing/calendars`, {
      headers: { "x-correlation-id": "missing-organization" }
    })
    expect(missing.status).toBe(404)
    expect(listed).toBe(false)
    await expect(missing.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "missing-organization" }
    })

    let scoped: unknown
    const scopedUrl = await startServer({
      ...service(),
      listCalendars: async (input) => {
        scoped = input
        return { items: [], truncated: false }
      }
    })
    const response = await fetch(
      `${scopedUrl}/api/organizations/organization%3Awa%3Ahouse/calendars?classification=legislative-schedule&isActive=false`
    )
    expect(response.status).toBe(200)
    expect(scoped).toEqual({
      classification: "legislative-schedule",
      cursor: undefined,
      isActive: false,
      jurisdictionId: undefined,
      limit: 25,
      organizationId: "organization:wa:house",
      query: undefined
    })
  })

  it("rejects undocumented, duplicate, malformed, and unbound calendar requests", async () => {
    const baseUrl = await startServer(service())
    const results = await Promise.all([
      fetch(`${baseUrl}/api/calendars?unknown=value`),
      fetch(`${baseUrl}/api/calendars?isActive=true&isActive=false`),
      fetch(`${baseUrl}/api/calendars?limit=101`),
      fetch(`${baseUrl}/api/calendars/calendar%3A1?childLimit=1`),
      fetch(`${baseUrl}/api/calendars/calendar%3A1/meetings?sort=updated-desc`),
      fetch(`${baseUrl}/api/calendars/calendar%3A1/meetings?from=2026-08-01&to=2026-08-01T00%3A00%3A00Z`),
      fetch(`${baseUrl}/%61pi/calendars`),
      fetch(`${baseUrl}/api/calendars/%`),
      fetch(`${baseUrl}/api/organizations/organization%3A1/calendars?organizationId=organization%3Aother`)
    ])
    expect(results.map((result) => result.status)).toEqual([400, 400, 400, 400, 400, 400, 404, 400, 400])
  })

  it("returns an empty page before any publisher calendar is imported and a 404 for unknown calendar IDs", async () => {
    const baseUrl = await startServer({
      assertCalendarExists: async () => {
        throw new LegislationError("not_found", "Calendar calendar:missing was not found")
      },
      assertOrganizationExists: async () => undefined,
      getCalendarRead: async () => {
        throw new LegislationError("not_found", "Calendar calendar:missing was not found")
      },
      listCalendarMeetings: async () => ({ items: [], truncated: false }),
      listCalendars: async () => ({ items: [], truncated: false })
    })
    const response = await fetch(`${baseUrl}/api/calendars`, {
      headers: { "x-correlation-id": "calendar-empty" }
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [],
      meta: { correlationId: "calendar-empty", nextCursor: null, truncated: false, warnings: [] }
    })
    const missing = await fetch(`${baseUrl}/api/calendars/calendar%3Amissing`)
    expect(missing.status).toBe(404)
    const missingMeetings = await fetch(`${baseUrl}/api/calendars/calendar%3Amissing/meetings`)
    expect(missingMeetings.status).toBe(404)
  })
})
