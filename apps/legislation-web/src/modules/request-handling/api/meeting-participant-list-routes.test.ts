import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import type { MeetingParticipantRead } from "../../legislation/persistence/queries/meeting-participant-reads.js"
import { close, createLegislationServer } from "../test-http-server.js"
import {
  createMeetingParticipantListApiHandler,
  type MeetingParticipantListApi
} from "./meeting-participant-list-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "meeting-participant-list-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: MeetingParticipantListApi) {
  const server = createLegislationServer({
    apiHandler: createMeetingParticipantListApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function read(meetingId = "meeting:us:119:1", participantId = "participant:us:119:1:1"): MeetingParticipantRead {
  return {
    meeting: {
      createdAt: new Date("2026-08-20T15:00:00.000Z"),
      id: meetingId,
      sourceUpdatedAt: new Date("2026-08-21T15:00:00.000Z"),
      sourceUrl: "https://api.congress.gov/v3/committee-meeting/1",
      updatedAt: new Date("2026-08-22T15:00:00.000Z")
    },
    organization: {
      chamber: "upper",
      classification: "committee",
      createdAt: new Date("2026-08-10T15:00:00.000Z"),
      id: "organization:us:senate:rules",
      isActive: true,
      jurisdictionId: "jurisdiction:us",
      name: "Rules Committee",
      parentOrganizationId: "organization:us:senate",
      provenanceComplete: true,
      sourceIsOfficial: true,
      sourceProvider: "Congress.gov",
      sourceRetrievedAt: new Date("2026-08-20T15:00:00.000Z"),
      sourceUpdatedAt: null,
      sourceUrl: "https://api.congress.gov/v3/committee/SRUL00",
      updatedAt: new Date("2026-08-20T15:00:00.000Z")
    },
    participant: { eventId: meetingId, id: participantId, name: "Pat Witness", role: "witness" },
    person: {
      createdAt: new Date("2026-08-10T15:00:00.000Z"),
      familyName: "Witness",
      givenName: "Pat",
      id: "person:us:pat-witness",
      isActive: false,
      jurisdictionId: "jurisdiction:us",
      name: "Pat Witness",
      party: null,
      provenanceComplete: true,
      sourceIsOfficial: true,
      sourceProvider: "Congress.gov",
      sourceRetrievedAt: new Date("2026-08-20T15:00:00.000Z"),
      sourceUpdatedAt: null,
      sourceUrl: "https://api.congress.gov/v3/member/P000001",
      updatedAt: new Date("2026-08-20T15:00:00.000Z")
    }
  }
}

describe("meeting participant list API handler", () => {
  it("passes the documented filters to a parent-bound page and projects canonical nested resources", async () => {
    const calls: string[] = []
    let received: unknown
    const baseUrl = await startServer({
      assertMeetingExists: async (meetingId) => {
        calls.push(`parent:${meetingId}`)
      },
      listMeetingParticipants: async (input) => {
        calls.push("list")
        received = input
        return { items: [read(input.meetingId)], nextCursor: "next-cursor", truncated: true }
      }
    })
    const path =
      "/api/meetings/meeting%3Aus%3A119%3A1/participants?cursor=first&limit=7&organizationId=organization%3Aus%3Asenate%3Arules&personId=person%3Aus%3Apat-witness&role=witness"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "meeting-participants" } })

    expect(response.status).toBe(200)
    expect(calls).toEqual(["parent:meeting:us:119:1", "list"])
    expect(received).toEqual({
      cursor: "first",
      limit: 7,
      meetingId: "meeting:us:119:1",
      organizationId: "organization:us:senate:rules",
      personId: "person:us:pat-witness",
      role: "witness"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl:
            "https://api.example.test/api/meetings/meeting%3Aus%3A119%3A1/participants/participant%3Aus%3A119%3A1%3A1",
          meetingId: "meeting:us:119:1",
          organization: { id: "organization:us:senate:rules", type: "organization" },
          person: { id: "person:us:pat-witness", type: "person" },
          type: "meeting-participant"
        }
      ],
      links: { next: expect.stringContaining("cursor=next-cursor"), self: path },
      meta: {
        correlationId: "meeting-participants",
        limit: 7,
        nextCursor: "next-cursor",
        truncated: true,
        warnings: []
      }
    })
  })

  it("returns the parent lookup 404 without running the list query", async () => {
    let listed = false
    const baseUrl = await startServer({
      assertMeetingExists: async () => {
        throw new LegislationError("not_found", "Meeting was not found")
      },
      listMeetingParticipants: async () => {
        listed = true
        return { items: [], truncated: false }
      }
    })
    const response = await fetch(`${baseUrl}/api/meetings/meeting%3Amissing/participants`)

    expect(response.status).toBe(404)
    expect(listed).toBe(false)
  })

  it("uses the shared default limit for independent participant pages", async () => {
    let received: unknown
    const baseUrl = await startServer({
      assertMeetingExists: async () => undefined,
      listMeetingParticipants: async (input) => {
        received = input
        return { items: [], truncated: false }
      }
    })

    const response = await fetch(`${baseUrl}/api/meetings/meeting%3Aus%3A119%3A1/participants`)

    expect(response.status).toBe(200)
    expect(received).toEqual({
      cursor: undefined,
      limit: 20,
      meetingId: "meeting:us:119:1",
      organizationId: undefined,
      personId: undefined,
      role: undefined
    })
    await expect(response.json()).resolves.toMatchObject({ meta: { limit: 20 } })
  })

  it("rejects noncanonical linked provenance and malformed query contracts", async () => {
    const baseUrl = await startServer({
      assertMeetingExists: async () => undefined,
      listMeetingParticipants: async () => {
        const participant = read()
        if (participant.person === null) {
          throw new Error("Expected person fixture")
        }
        participant.person.provenanceComplete = false
        return { items: [participant], truncated: false }
      }
    })
    const [incomplete, unknown, duplicate, trailingSlash, wrongMethod] = await Promise.all([
      fetch(`${baseUrl}/api/meetings/meeting%3Aus%3A119%3A1/participants`),
      fetch(`${baseUrl}/api/meetings/meeting%3Aus%3A119%3A1/participants?unlisted=1`),
      fetch(`${baseUrl}/api/meetings/meeting%3Aus%3A119%3A1/participants?role=witness&role=guest`),
      fetch(`${baseUrl}/api/meetings/meeting%3Aus%3A119%3A1/participants/`),
      fetch(`${baseUrl}/api/meetings/meeting%3Aus%3A119%3A1/participants`, { method: "POST" })
    ])

    expect([incomplete.status, unknown.status, duplicate.status, trailingSlash.status, wrongMethod.status]).toEqual([
      422, 400, 400, 404, 404
    ])
  })
})
