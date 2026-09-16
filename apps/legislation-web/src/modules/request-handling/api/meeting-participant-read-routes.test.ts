import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import type { MeetingParticipantRead } from "../../legislation/persistence/queries/meeting-participant-read.js"
import { close, createLegislationServer } from "../test-http-server.js"
import {
  createMeetingParticipantReadApiHandler,
  type MeetingParticipantReadApi
} from "./meeting-participant-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "meeting-participant-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: MeetingParticipantReadApi) {
  const server = createLegislationServer({
    apiHandler: createMeetingParticipantReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function read(meetingId = "event:us:119:hearing:1", participantId = "participant:us:119:hearing:1:1") {
  return {
    meeting: {
      createdAt: new Date("2026-08-20T15:00:00.000Z"),
      id: meetingId,
      sourceUpdatedAt: new Date("2026-08-21T15:00:00.000Z"),
      sourceUrl: "https://api.congress.gov/v3/committee-meeting/1",
      updatedAt: new Date("2026-08-22T15:00:00.000Z")
    },
    organization: null,
    participant: { id: participantId, name: "Public witness", role: "witness" },
    person: null
  } satisfies MeetingParticipantRead
}

function readWithPerson(): MeetingParticipantRead {
  return {
    ...read(),
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

describe("meeting participant read API handler", () => {
  it("projects a canonical Resource envelope from the visible parent-scoped read", async () => {
    let received: Readonly<{ meetingId: string; participantId: string }> | undefined
    const baseUrl = await startServer({
      getMeetingParticipant: async (input) => {
        received = input
        return read(input.meetingId, input.participantId)
      }
    })
    const path = "/api/meetings/event%3Aus%3A119%3Ahearing%3A1/participants/participant%3Aus%3A119%3Ahearing%3A1%3A1"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "meeting-participant-read" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      meetingId: "event:us:119:hearing:1",
      participantId: "participant:us:119:hearing:1:1"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: {
        canonicalUrl:
          "https://api.example.test/api/meetings/event%3Aus%3A119%3Ahearing%3A1/participants/participant%3Aus%3A119%3Ahearing%3A1%3A1",
        meetingId: "event:us:119:hearing:1",
        name: "Public witness",
        organization: null,
        person: null,
        type: "meeting-participant"
      },
      links: { self: path },
      meta: { correlationId: "meeting-participant-read", warnings: [] }
    })
  })

  it("returns a correlated 404 when a participant is not under the requested meeting", async () => {
    const baseUrl = await startServer({
      getMeetingParticipant: async () => {
        throw new LegislationError("not_found", "Participant was not found for meeting")
      }
    })
    const response = await fetch(
      `${baseUrl}/api/meetings/event%3Aother/participants/participant%3Aus%3A119%3Ahearing%3A1%3A1`,
      { headers: { "x-correlation-id": "wrong-meeting" } }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "wrong-meeting", retryable: false }
    })
  })

  it("projects a linked person as a canonical summary without persistence-only fields", async () => {
    const baseUrl = await startServer({ getMeetingParticipant: async () => readWithPerson() })
    const response = await fetch(
      `${baseUrl}/api/meetings/event%3Aus%3A119%3Ahearing%3A1/participants/participant%3Aus%3A119%3Ahearing%3A1%3A1`
    )
    const body: unknown = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      data: {
        person: {
          canonicalUrl: "https://api.example.test/api/people/person%3Aus%3Apat-witness",
          id: "person:us:pat-witness",
          name: "Pat Witness",
          type: "person"
        }
      }
    })
    expect(body).not.toHaveProperty("data.person.createdAt")
    expect(body).not.toHaveProperty("data.person.sourceProvider")
  })

  it("accepts only the exact GET path and its empty query contract", async () => {
    const baseUrl = await startServer({ getMeetingParticipant: async () => read() })
    const [extraPath, unsupportedQuery, wrongMethod] = await Promise.all([
      fetch(`${baseUrl}/api/meetings/event%3A1/participants/participant%3A1/extra`),
      fetch(`${baseUrl}/api/meetings/event%3A1/participants/participant%3A1?limit=1`),
      fetch(`${baseUrl}/api/meetings/event%3A1/participants/participant%3A1`, { method: "POST" })
    ])

    expect([extraPath.status, unsupportedQuery.status, wrongMethod.status]).toEqual([404, 400, 404])
    await expect(unsupportedQuery.json()).resolves.toMatchObject({
      error: { category: "invalid_request", retryable: false }
    })
  })
})
