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
    classification: "meeting",
    description: "A source-declared meeting",
    endAt: null,
    id: "event:openstates:rules-1",
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
    listMeetings: async () => ({ items: [meeting()], truncated: false })
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
      "/api/jurisdictions/jurisdiction%3Awa/meetings?classification=meeting&from=2026-08-01&limit=1&organizationId=organization%3Aopenstates%3Arules&status=scheduled&to=2026-08-31"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "meeting-page" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      classification: "meeting",
      cursor: undefined,
      from: "2026-08-01",
      jurisdictionId: "jurisdiction:wa",
      limit: 1,
      organizationId: "organization:openstates:rules",
      sessionId: undefined,
      sort: undefined,
      status: "scheduled",
      to: "2026-08-31"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
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
      sort: undefined
    })
    const invalid = await fetch(`${baseUrl}/api/sessions/session%3Awa%3A2026/meetings?sessionId=session%3Awa%3A2025`)
    expect(invalid.status).toBe(400)
  })

  it("returns parent 404s and leaves the incomplete global collection unregistered", async () => {
    const baseUrl = await startServer({
      ...service(),
      assertOrganizationExists: async () => {
        throw new LegislationError("not_found", "Organization organization:missing was not found")
      }
    })
    const missing = await fetch(`${baseUrl}/api/organizations/organization%3Amissing/meetings`, {
      headers: { "x-correlation-id": "missing-parent" }
    })
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "missing-parent" }
    })
    expect((await fetch(`${baseUrl}/api/meetings`)).status).toBe(404)
  })
})
