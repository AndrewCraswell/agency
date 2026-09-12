import { afterEach, describe, expect, it, vi } from "vitest"
import type { MeetingRead } from "../db/queries/meeting-read.js"
import { LegislationError } from "../legislation/errors.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
import type { CalendarRead } from "./calendar-read-repository.js"
import { createCalendarReadApiHandler, type CalendarReadApi } from "./calendar-read-routes.js"
import { createCompositeHttpApiHandler } from "./http.js"
import {
  createRepresentativeLookupApi,
  createRepresentativeLookupApiHandler,
  UnavailableAddressToDistrictProvider,
  type AddressToDistrictProvider,
  type DistrictResolution,
  type RepresentativeLookupApi,
  type RepresentativeLookupRequest
} from "./representative-lookup.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({
  level: "error",
  service: "calendar-representative-composed-test",
  write: () => undefined
})
const apiBaseUrl = "https://api.example.test"

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(calendarService: CalendarReadApi, representativeApi: RepresentativeLookupApi) {
  const server = createLegislationServer({
    apiHandler: createCompositeHttpApiHandler([
      createRepresentativeLookupApiHandler(representativeApi),
      createCalendarReadApiHandler(calendarService, { apiBaseUrl })
    ]),
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
    calendarId: "calendar:wa:committee-schedule:2026",
    classification: "meeting",
    description: "Rules Committee hearing",
    endAt: new Date("2026-08-17T19:00:00.000Z"),
    id: "event:wa:rules-1",
    allDay: false,
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

function calendarService(overrides: Partial<CalendarReadApi> = {}): CalendarReadApi {
  return {
    assertCalendarExists: async () => undefined,
    assertOrganizationExists: async () => undefined,
    getCalendarRead: async () => calendar(),
    listCalendarMeetings: async () => ({ items: [meeting()], truncated: false }),
    listCalendars: async () => ({ items: [calendar()], truncated: false }),
    ...overrides
  }
}

const representativeSource = {
  isOfficial: true,
  provider: "openstates",
  retrievedAt: "2026-08-25T11:59:00.000Z",
  sourceUpdatedAt: null,
  sourceUrl: "https://v3.openstates.org/people.geo"
} as const

function districtResolution(overrides: Partial<DistrictResolution> = {}): DistrictResolution {
  const district = {
    boundarySourceUrl: "https://v3.openstates.org/people.geo",
    classification: "lower",
    jurisdictionId: "jurisdiction:us:ca",
    label: "10",
    organizationId: "organization:us:ca:assembly",
    sources: [representativeSource]
  } as const
  return {
    districts: [district],
    quality: "exact",
    representatives: [
      {
        district,
        matchConfidence: 1,
        person: {
          canonicalUrl: `${apiBaseUrl}/api/people/person%3Aca%3Aexample`,
          familyName: "Example",
          givenName: "Alex",
          id: "person:ca:example",
          imageUrl: null,
          isActive: true,
          jurisdictionIds: ["jurisdiction:us:ca"],
          name: "Alex Example",
          party: "Independent",
          sources: [representativeSource],
          type: "person",
          updatedAt: "2026-08-25T11:59:00.000Z"
        },
        term: {
          canonicalUrl: `${apiBaseUrl}/api/people/person%3Aca%3Aexample/terms/term%3Aca%3Aexample%3A2025`,
          district: "10",
          endDate: null,
          id: "term:ca:example:2025",
          isCurrent: true,
          jurisdictionId: "jurisdiction:us:ca",
          officeTitle: "Assembly Member",
          organizationId: "organization:us:ca:assembly",
          personId: "person:ca:example",
          sources: [representativeSource],
          startDate: "2025-12-01",
          type: "legislative-term",
          updatedAt: "2026-08-25T11:59:00.000Z"
        }
      }
    ],
    warnings: [],
    ...overrides
  }
}

function representativeApi(provider: AddressToDistrictProvider): RepresentativeLookupApi {
  return createRepresentativeLookupApi(provider, {
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
    createLookupId: () => "lookup:fixture"
  })
}

function addressRequest(): RepresentativeLookupRequest {
  return {
    address: {
      city: "Sacramento",
      country: "US",
      line1: "123 Main Street",
      line2: null,
      postalCode: "95814",
      region: "CA"
    }
  }
}

describe("calendar and representative routes through the composed HTTP handler", () => {
  it("dispatches all four exact calendar routes with filters, parent binding, and provenance", async () => {
    let collectionInput: unknown
    let meetingsInput: unknown
    let organizationInput: unknown
    let listCall = 0
    const baseUrl = await startServer(
      calendarService({
        listCalendarMeetings: async (input) => {
          meetingsInput = input
          return { items: [meeting()], nextCursor: "meeting-cursor", truncated: true }
        },
        listCalendars: async (input) => {
          listCall += 1
          collectionInput = input
          if (listCall === 2) {
            organizationInput = input
            return { items: [calendar()], truncated: false }
          }
          return { items: [calendar()], nextCursor: "calendar-cursor", truncated: true }
        }
      }),
      representativeApi(new UnavailableAddressToDistrictProvider())
    )

    const collectionPath =
      "/api/calendars?jurisdictionId=jurisdiction%3Awa&organizationId=organization%3Awa%3Ahouse&classification=legislative-schedule&isActive=true&q=committee&limit=1"
    const collection = await fetch(`${baseUrl}${collectionPath}`, { headers: { "x-correlation-id": "calendar-page" } })
    expect(collection.status).toBe(200)
    expect(collectionInput).toEqual({
      classification: "legislative-schedule",
      cursor: undefined,
      isActive: true,
      jurisdictionId: "jurisdiction:wa",
      limit: 1,
      organizationId: "organization:wa:house",
      query: "committee"
    })
    await expect(collection.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl: `${apiBaseUrl}/api/calendars/calendar%3Awa%3Acommittee-schedule%3A2026`,
          id: "calendar:wa:committee-schedule:2026",
          sourceUrl: "https://leg.wa.gov/calendars/committee-schedule-2026",
          sources: [
            {
              isOfficial: true,
              provider: "wa-legislature",
              retrievedAt: "2026-08-01T00:00:00.000Z",
              sourceUpdatedAt: null,
              sourceUrl: "https://leg.wa.gov/calendars/committee-schedule-2026"
            }
          ],
          type: "calendar",
          updatedAt: "2026-08-01T00:00:00.000Z"
        }
      ],
      links: { next: `${collectionPath}&cursor=calendar-cursor`, self: collectionPath },
      meta: { correlationId: "calendar-page", limit: 1, nextCursor: "calendar-cursor", truncated: true, warnings: [] }
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
        sources: [{ provider: "wa-legislature", isOfficial: true }],
        type: "calendar"
      },
      links: { self: "/api/calendars/calendar%3Awa%3Acommittee-schedule%3A2026" },
      meta: { correlationId: "calendar-detail", warnings: [] }
    })

    const meetingsPath =
      "/api/calendars/calendar%3Awa%3Acommittee-schedule%3A2026/meetings?from=2026-08-01&to=2026-08-31&status=scheduled&sort=starts-desc&limit=1"
    const meetings = await fetch(`${baseUrl}${meetingsPath}`)
    expect(meetings.status).toBe(200)
    expect(meetingsInput).toEqual({
      calendarId: "calendar:wa:committee-schedule:2026",
      cursor: undefined,
      from: "2026-08-01",
      limit: 1,
      sort: "starts-desc",
      status: "scheduled",
      to: "2026-08-31"
    })
    await expect(meetings.json()).resolves.toMatchObject({
      data: [
        {
          calendarId: "calendar:wa:committee-schedule:2026",
          sources: [{ provider: "wa-legislature", isOfficial: true }],
          type: "meeting"
        }
      ],
      links: { next: `${meetingsPath}&cursor=meeting-cursor` },
      meta: { nextCursor: "meeting-cursor", truncated: true, warnings: [] }
    })

    const organizationPath =
      "/api/organizations/organization%3Awa%3Ahouse/calendars?classification=legislative-schedule&isActive=false"
    const organization = await fetch(`${baseUrl}${organizationPath}`)
    expect(organization.status).toBe(200)
    expect(organizationInput).toEqual({
      classification: "legislative-schedule",
      cursor: undefined,
      isActive: false,
      jurisdictionId: undefined,
      limit: 20,
      organizationId: "organization:wa:house",
      query: undefined
    })
    await expect(organization.json()).resolves.toMatchObject({
      data: [{ id: "calendar:wa:committee-schedule:2026", type: "calendar" }],
      links: { self: organizationPath },
      meta: { limit: 20, nextCursor: null, truncated: false, warnings: [] }
    })
  })

  it("keeps empty pages distinct from missing calendar resources and missing organization parents", async () => {
    let listed = false
    const notFound = (kind: string, id: string) => new LegislationError("not_found", `${kind} ${id} was not found`)
    const baseUrl = await startServer(
      calendarService({
        assertCalendarExists: async (id) => {
          throw notFound("Calendar", id)
        },
        assertOrganizationExists: async (id) => {
          throw notFound("Organization", id)
        },
        getCalendarRead: async (id) => {
          throw notFound("Calendar", id)
        },
        listCalendarMeetings: async () => {
          throw notFound("Calendar", "calendar:missing")
        },
        listCalendars: async () => {
          listed = true
          return { items: [], truncated: false }
        }
      }),
      representativeApi(new UnavailableAddressToDistrictProvider())
    )

    const responses = await Promise.all([
      fetch(`${baseUrl}/api/calendars`, { headers: { "x-correlation-id": "calendar-empty" } }),
      fetch(`${baseUrl}/api/calendars/calendar%3Amissing`),
      fetch(`${baseUrl}/api/calendars/calendar%3Amissing/meetings`),
      fetch(`${baseUrl}/api/organizations/organization%3Amissing/calendars`)
    ])
    expect(responses.map((response) => response.status)).toEqual([200, 404, 404, 404])
    await expect(responses[0]?.json()).resolves.toMatchObject({
      data: [],
      links: { next: null, self: "/api/calendars" },
      meta: { correlationId: "calendar-empty", nextCursor: null, truncated: false, warnings: [] }
    })
    await expect(responses[1]?.json()).resolves.toMatchObject({ error: { category: "not_found" } })
    await expect(responses[2]?.json()).resolves.toMatchObject({ error: { category: "not_found" } })
    await expect(responses[3]?.json()).resolves.toMatchObject({ error: { category: "not_found" } })
    expect(listed).toBe(true)
  })

  it("dispatches representative address and coordinates through the canonical resource envelope", async () => {
    const resolve = vi.fn<AddressToDistrictProvider["resolve"]>(async (input: RepresentativeLookupRequest) => {
      if ("coordinates" in input) {
        return { districts: [], quality: "unresolved", representatives: [], warnings: [] }
      }
      expect(input).toEqual(addressRequest())
      return districtResolution()
    })
    const baseUrl = await startServer(calendarService(), representativeApi({ resolve }))

    const addressResponse = await fetch(`${baseUrl}/api/representative-lookups`, {
      body: JSON.stringify({
        address: {
          city: " Sacramento ",
          country: "US",
          line1: " 123 Main Street ",
          line2: null,
          postalCode: " 95814 ",
          region: " CA "
        }
      }),
      headers: { "content-type": "application/json", "x-correlation-id": "representative-address" },
      method: "POST"
    })
    expect(addressResponse.status).toBe(200)
    const addressBody = await addressResponse.json()
    expect(JSON.stringify(addressBody)).not.toContain("123 Main Street")
    expect(addressBody).toMatchObject({
      data: {
        districts: [{ sources: [representativeSource] }],
        expiresAt: "2026-08-25T12:05:00.000Z",
        lookupId: "lookup:fixture",
        quality: "exact",
        representatives: [
          {
            district: { sources: [representativeSource] },
            person: { id: "person:ca:example", sources: [representativeSource] },
            term: { personId: "person:ca:example", sources: [representativeSource] }
          }
        ],
        resolvedAt: "2026-08-25T12:00:00.000Z",
        warnings: []
      },
      links: { self: "/api/representative-lookups" },
      meta: { correlationId: "representative-address", warnings: [] }
    })

    const coordinatesResponse = await fetch(`${baseUrl}/api/representative-lookups`, {
      body: JSON.stringify({ coordinates: { latitude: 38.5816, longitude: -121.4944 } }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    expect(coordinatesResponse.status).toBe(200)
    expect(resolve).toHaveBeenNthCalledWith(
      2,
      { coordinates: { latitude: 38.5816, longitude: -121.4944 } },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    await expect(coordinatesResponse.json()).resolves.toMatchObject({
      data: { districts: [], quality: "unresolved", representatives: [], warnings: [] },
      links: { self: "/api/representative-lookups" },
      meta: { warnings: [] }
    })
  })

  it("rejects unsupported countries and reports an unconfigured representative provider", async () => {
    const resolve = vi.fn<AddressToDistrictProvider["resolve"]>(async () => districtResolution())
    const baseUrl = await startServer(calendarService(), representativeApi({ resolve }))
    const unsupported = await fetch(`${baseUrl}/api/representative-lookups`, {
      body: JSON.stringify({
        address: { city: "Ottawa", country: "CA", line1: "1 Main", line2: null, postalCode: "K1A", region: "ON" }
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    expect(unsupported.status).toBe(422)
    await expect(unsupported.json()).resolves.toMatchObject({
      error: { category: "unprocessable", message: "Representative lookup is supported only for US addresses" }
    })
    expect(resolve).not.toHaveBeenCalled()

    const unavailableUrl = await startServer(
      calendarService(),
      representativeApi(new UnavailableAddressToDistrictProvider())
    )
    const unavailable = await fetch(`${unavailableUrl}/api/representative-lookups`, {
      body: JSON.stringify({ coordinates: { latitude: 0, longitude: 0 } }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    expect(unavailable.status).toBe(503)
    expect(unavailable.headers.get("retry-after")).toBe("30")
    await expect(unavailable.json()).resolves.toMatchObject({
      error: {
        category: "dependency_unavailable",
        message: "Representative lookup provider is not configured",
        retryable: true
      }
    })
  })
})
