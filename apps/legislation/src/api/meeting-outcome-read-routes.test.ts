import { afterEach, describe, expect, it } from "vitest"
import type { MeetingOutcomeRead } from "../db/queries/meeting-outcome-read.js"
import { LegislationError } from "../legislation/errors.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
import { createMeetingOutcomeReadApiHandler, type MeetingOutcomeReadApi } from "./meeting-outcome-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "meeting-outcome-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: MeetingOutcomeReadApi) {
  const server = createLegislationServer({
    apiHandler: createMeetingOutcomeReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function outcome(meetingId = "meeting:us:119:hearing:1", id = "outcome:us:119:hearing:1:2"): MeetingOutcomeRead {
  return {
    agendaItemId: "agenda:us:119:hearing:1:2",
    billActionId: "action:us:119:hr:1:2",
    classification: "action",
    description: "Committee recommendation adopted",
    id,
    linkMethod: "explicit",
    meetingId,
    source: {
      isOfficial: true,
      provider: "Congress.gov",
      retrievedAt: new Date("2026-08-21T15:00:00.000Z"),
      sourceUpdatedAt: new Date("2026-08-20T16:00:00.000Z"),
      sourceUrl: "https://api.congress.gov/v3/committee-meeting/1",
      updatedAt: new Date("2026-08-22T15:00:00.000Z")
    },
    voteId: null
  }
}

function service(): MeetingOutcomeReadApi {
  return {
    assertMeetingOutcomeParentExists: async () => undefined,
    getMeetingOutcomeRead: async ({ meetingId, outcomeId }) => outcome(meetingId, outcomeId),
    listMeetingOutcomes: async (input) => ({ items: [outcome(input.meetingId)], truncated: false })
  }
}

describe("meeting outcome read API handler", () => {
  it("returns the parent-bound canonical Page<MeetingOutcome> with the documented filter contract", async () => {
    let received: unknown
    const baseUrl = await startServer({
      ...service(),
      listMeetingOutcomes: async (input) => {
        received = input
        return { items: [outcome(input.meetingId)], nextCursor: "next-cursor", truncated: true }
      }
    })
    const path =
      "/api/meetings/meeting%3Aus%3A119%3Ahearing%3A1/outcomes?classification=action&billId=bill%3Aus%3A119%3Ahr%3A1&limit=1"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "meeting-outcomes" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      billId: "bill:us:119:hr:1",
      classification: "action",
      cursor: undefined,
      limit: 1,
      meetingId: "meeting:us:119:hearing:1"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl:
            "https://api.example.test/api/meetings/meeting%3Aus%3A119%3Ahearing%3A1/outcomes/outcome%3Aus%3A119%3Ahearing%3A1%3A2",
          classification: "action",
          description: "Committee recommendation adopted",
          meetingId: "meeting:us:119:hearing:1",
          sources: [
            {
              isOfficial: true,
              provider: "Congress.gov",
              sourceUrl: "https://api.congress.gov/v3/committee-meeting/1"
            }
          ],
          type: "meeting-outcome"
        }
      ],
      links: {
        next: "/api/meetings/meeting%3Aus%3A119%3Ahearing%3A1/outcomes?classification=action&billId=bill%3Aus%3A119%3Ahr%3A1&limit=1&cursor=next-cursor",
        self: path
      },
      meta: { correlationId: "meeting-outcomes", limit: 1, nextCursor: "next-cursor", truncated: true, warnings: [] }
    })
    await expect((await fetch(`${baseUrl}${path}`)).json()).resolves.not.toMatchObject({
      data: [expect.objectContaining({ sourceSequence: expect.anything() })]
    })
    await expect((await fetch(`${baseUrl}${path}`)).json()).resolves.not.toMatchObject({
      data: [expect.objectContaining({ sourceProvider: expect.anything() })]
    })
  })

  it("returns the exact canonical resource and correlated 404 for an outcome under another meeting", async () => {
    const baseUrl = await startServer({
      ...service(),
      getMeetingOutcomeRead: async (input) => {
        if (input.meetingId === "meeting:other") {
          throw new LegislationError("not_found", "Outcome was not found")
        }
        return outcome(input.meetingId, input.outcomeId)
      }
    })
    const path = "/api/meetings/meeting%3Aus%3A119%3Ahearing%3A1/outcomes/outcome%3Aus%3A119%3Ahearing%3A1%3A2"
    const [found, missing] = await Promise.all([
      fetch(`${baseUrl}${path}`),
      fetch(`${baseUrl}/api/meetings/meeting%3Aother/outcomes/outcome%3Aus%3A119%3Ahearing%3A1%3A2`, {
        headers: { "x-correlation-id": "wrong-meeting" }
      })
    ])

    expect(found.status).toBe(200)
    expect(missing.status).toBe(404)
    await expect(found.json()).resolves.toMatchObject({
      data: {
        canonicalUrl:
          "https://api.example.test/api/meetings/meeting%3Aus%3A119%3Ahearing%3A1/outcomes/outcome%3Aus%3A119%3Ahearing%3A1%3A2",
        type: "meeting-outcome"
      },
      links: { self: path }
    })
    await expect(missing.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "wrong-meeting", retryable: false }
    })
  })

  it("checks the public parent before listing and keeps collection errors correlated", async () => {
    let listed = false
    const baseUrl = await startServer({
      ...service(),
      assertMeetingOutcomeParentExists: async () => {
        throw new LegislationError("not_found", "Meeting was not found")
      },
      listMeetingOutcomes: async () => {
        listed = true
        return { items: [], truncated: false }
      }
    })
    const response = await fetch(`${baseUrl}/api/meetings/meeting%3Amissing/outcomes`, {
      headers: { "x-correlation-id": "missing-meeting" }
    })

    expect(response.status).toBe(404)
    expect(listed).toBe(false)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "missing-meeting", retryable: false }
    })
  })

  it("accepts only exact GET routes with bounded documented parameters", async () => {
    const baseUrl = await startServer(service())
    const path = "/api/meetings/meeting%3A1/outcomes"
    const [unknown, duplicate, invalidClassification, itemQuery, trailingSlash, wrongMethod, oversized] =
      await Promise.all([
        fetch(`${baseUrl}${path}?unknown=true`),
        fetch(`${baseUrl}${path}?billId=bill%3A1&billId=bill%3A2`),
        fetch(`${baseUrl}${path}?classification=unsupported`),
        fetch(`${baseUrl}${path}/outcome%3A1?limit=1`),
        fetch(`${baseUrl}${path}/`),
        fetch(`${baseUrl}${path}`, { method: "POST" }),
        fetch(`${baseUrl}/api/meetings/${"m".repeat(257)}/outcomes`)
      ])

    expect([
      unknown.status,
      duplicate.status,
      invalidClassification.status,
      itemQuery.status,
      trailingSlash.status,
      wrongMethod.status,
      oversized.status
    ]).toEqual([400, 400, 400, 400, 404, 404, 400])
  })
})
