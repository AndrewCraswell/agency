import { afterEach, describe, expect, it } from "vitest"
import type { VoteRead } from "../db/queries/vote-reads.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
import { createVoteReadApiHandler, type VoteReadApi } from "./vote-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "vote-read-routes-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function start(service: VoteReadApi) {
  const server = createLegislationServer({
    apiHandler: createVoteReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
    logger
  })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP address")
  }
  return `http://127.0.0.1:${address.port}`
}

function vote(overrides: Partial<VoteRead> = {}): VoteRead {
  return {
    absentCount: 0,
    abstainCount: 0,
    amendmentId: null,
    billId: "bill:us:119:house:hr-1",
    chamber: "house",
    classification: "passage",
    createdAt: new Date("2026-08-25T00:00:00.000Z"),
    eventId: null,
    heldAt: new Date("2026-08-24T12:00:00.000Z"),
    id: "vote:us:119:house:1",
    motion: "On passage",
    noCount: 2,
    notVotingCount: 0,
    organizationId: "organization:us:house",
    otherCount: 0,
    pairedCount: 0,
    presentCount: 0,
    proxyCount: 0,
    question: "Shall the bill pass?",
    requirement: null,
    result: "passed",
    rollCallNumber: "1",
    sessionId: "session:us:119",
    sourceId: "house-1",
    sourceIsOfficial: true,
    sourceProvider: "congress",
    sourceRetrievedAt: new Date("2026-08-25T00:00:00.000Z"),
    sourceSequence: 1,
    sourceUpdatedAt: new Date("2026-08-24T12:00:00.000Z"),
    sourceUrl: "https://api.congress.gov/v3/house-vote/1",
    timelineComplete: true,
    voteType: "roll-call",
    yesCount: 3,
    ...overrides
  }
}

function service(overrides: Partial<VoteReadApi> = {}): VoteReadApi {
  return {
    getVote: async () => vote(),
    listPersonVotePositions: async () => ({ items: [], truncated: false }),
    listVotePositions: async () => ({ items: [], truncated: false }),
    listVotes: async () => ({ items: [vote()], nextCursor: "next", truncated: true }),
    ...overrides
  }
}

describe("vote read API handler", () => {
  it("uses the shared pagination default for person vote activity", async () => {
    let received: unknown
    const baseUrl = await start(
      service({
        listPersonVotePositions: async (input) => {
          received = input
          return { items: [], truncated: false }
        }
      })
    )

    const response = await fetch(`${baseUrl}/api/people/person%3Aus%3Aexample/votes`)

    expect(response.status).toBe(200)
    expect(received).toMatchObject({ limit: 20, personId: "person:us:example" })
  })

  it("returns bounded canonical vote pages and binds the cursor to the exact filters", async () => {
    let received: unknown
    const baseUrl = await start(
      service({
        listVotes: async (input) => {
          received = input
          return { items: [vote()], nextCursor: "next", truncated: true }
        }
      })
    )
    const path = "/api/votes?billId=bill%3Aus%3A119%3Ahouse%3Ahr-1&from=2026-08-01&limit=1&result=passed&sort=held-desc"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "vote-list" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      billId: "bill:us:119:house:hr-1",
      classification: undefined,
      cursor: undefined,
      from: "2026-08-01",
      jurisdictionId: undefined,
      limit: 1,
      organizationId: undefined,
      personId: undefined,
      result: "passed",
      sort: "held-desc",
      to: undefined
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl: "https://api.example.test/api/votes/vote%3Aus%3A119%3Ahouse%3A1",
          counts: { yes: 3, no: 2 },
          type: "vote"
        }
      ],
      links: { next: `${path}&cursor=next` },
      meta: { correlationId: "vote-list", limit: 1, nextCursor: "next", truncated: true }
    })
  })

  it("rejects encoded literal aliases and keeps malformed ID encodings as invalid requests", async () => {
    const baseUrl = await start(service())
    const [alias, doubledSlash, malformed, duplicate, badOption] = await Promise.all([
      fetch(`${baseUrl}/%61pi/votes`),
      fetch(`${baseUrl}/api//votes`),
      fetch(`${baseUrl}/api/votes/%ZZ`),
      fetch(`${baseUrl}/api/votes?sort=held-desc&sort=held-asc`),
      fetch(`${baseUrl}/api/votes/vote%3A1/positions?option=maybe`)
    ])
    expect([alias.status, doubledSlash.status, malformed.status, duplicate.status, badOption.status]).toEqual([
      404, 404, 400, 400, 400
    ])
  })

  it("returns isolated batch errors while preserving canonical successful results", async () => {
    const baseUrl = await start(
      service({
        getVote: async (id) => {
          if (id === "missing") {
            throw new Error("missing")
          }
          return vote({ id })
        }
      })
    )
    const response = await fetch(`${baseUrl}/api/votes/batch`, {
      body: JSON.stringify({ ids: ["vote:1", "missing"] }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          id: "vote:1",
          status: "ok",
          data: { type: "vote", positions: [], positionsPageInfo: { limit: 25, nextCursor: null, truncated: false } }
        },
        { id: "missing", status: "error", error: { category: "dependency_unavailable", retryable: false } }
      ]
    })
  })
})
