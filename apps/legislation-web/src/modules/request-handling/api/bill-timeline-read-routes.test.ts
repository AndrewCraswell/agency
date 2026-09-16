import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import type { BillTimelinePersistenceRead } from "../../legislation/persistence/queries/bill-timeline-read"
import { close, createLegislationServer } from "../test-http-server"
import { createBillTimelineReadApiHandler, type BillTimelineReadApi } from "./bill-timeline-read-routes"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "bill-timeline-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: BillTimelineReadApi) {
  const server = createLegislationServer({
    apiHandler: createBillTimelineReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function rows(): BillTimelinePersistenceRead[] {
  return [
    {
      action: {
        actionAt: new Date("2026-02-01T09:00:00.000Z"),
        actionDate: "2026-02-01",
        billId: "bill:us:119:hr:1",
        chamber: null,
        classification: ["introduced"],
        createdAt: new Date("2026-02-01T10:00:00.000Z"),
        description: "Introduced",
        id: "action:1",
        ordinal: 1,
        organizationId: "organization:house",
        sourceOrganizationId: null,
        sourceUrl: "https://api.congress.gov/action/1"
      },
      kind: "action",
      organization: {
        chamber: "lower",
        childRelationsComplete: false,
        classification: "chamber",
        createdAt: new Date("2026-02-01T08:00:00.000Z"),
        description: null,
        detailFactsComplete: false,
        id: "organization:house",
        isActive: true,
        jurisdictionId: "jurisdiction:us",
        membershipRelationsComplete: false,
        name: "United States House of Representatives",
        parentOrganizationId: null,
        provenanceComplete: true,
        publicContactAddress: null,
        publicContactEmail: null,
        publicContactPhone: null,
        sourceId: "house",
        sourceIsOfficial: true,
        sourceProvider: "congress",
        sourceRetrievedAt: new Date("2026-02-01T08:00:00.000Z"),
        sourceUpdatedAt: null,
        sourceUrl: "https://api.congress.gov/house",
        termsOfReference: null,
        updatedAt: new Date("2026-02-01T08:00:00.000Z"),
        upstreamIds: { congress: "house" },
        websiteUrl: null
      }
    },
    {
      kind: "meeting-outcome",
      action: null,
      outcome: {
        actionId: null,
        agendaAssociation: "none",
        agendaItemId: null,
        classification: "note",
        createdAt: new Date("2026-02-01T10:00:00.000Z"),
        description: "Committee note",
        eventId: "meeting:1",
        id: "outcome:1",
        linkMethod: "explicit",
        occurredAt: new Date("2026-02-01T10:00:00.000Z"),
        occurredDate: "2026-02-01",
        sourceIsOfficial: true,
        sourceProvider: "congress",
        sourceRetrievedAt: new Date("2026-02-01T11:00:00.000Z"),
        sourceSequence: 2,
        sourceUpdatedAt: null,
        sourceUrl: "https://api.congress.gov/outcome/1",
        timelineComplete: true,
        updatedAt: new Date("2026-02-01T11:00:00.000Z"),
        voteId: null
      },
      vote: null
    },
    {
      kind: "vote",
      vote: {
        absentCount: 0,
        abstainCount: 0,
        amendmentId: null,
        billId: "bill:us:119:hr:1",
        chamber: "lower",
        classification: "roll-call",
        createdAt: new Date("2026-02-01T12:00:00.000Z"),
        eventId: null,
        heldAt: new Date("2026-02-01T11:00:00.000Z"),
        id: "vote:1",
        noCount: 2,
        notVotingCount: 1,
        organizationId: null,
        otherCount: 0,
        pairedCount: 0,
        presentCount: 0,
        proxyCount: 0,
        question: "On passage",
        requirement: null,
        result: "passed",
        rollCallNumber: "1",
        sessionId: "session:us:119",
        sourceId: "1",
        sourceIsOfficial: true,
        sourceProvider: "congress",
        sourceRetrievedAt: new Date("2026-02-01T12:00:00.000Z"),
        sourceSequence: 3,
        sourceUpdatedAt: null,
        sourceUrl: "https://api.congress.gov/vote/1",
        timelineComplete: true,
        voteType: "roll-call",
        motion: "On passage",
        yesCount: 10
      }
    }
  ]
}

describe("bill timeline API", () => {
  it("projects every canonical union branch and passes the exact repeated type filter", async () => {
    let received: unknown
    const baseUrl = await startServer({
      assertBillTimelineParentExists: async () => undefined,
      listBillTimeline: async (input) => {
        received = input
        return { items: rows(), truncated: false }
      }
    })
    const response = await fetch(
      `${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/timeline?type=vote&type=meeting-outcome&type=action`
    )

    expect(response.status).toBe(200)
    expect(received).toEqual({
      billId: "bill:us:119:hr:1",
      cursor: undefined,
      from: undefined,
      limit: 25,
      to: undefined,
      types: ["action", "meeting-outcome", "vote"]
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          action: {
            canonicalUrl: "https://api.example.test/api/bills/bill%3Aus%3A119%3Ahr%3A1/timeline#action-action%3A1",
            organization: {
              canonicalUrl: "https://api.example.test/api/organizations/organization%3Ahouse",
              id: "organization:house"
            }
          },
          type: "action"
        },
        { type: "meeting-outcome" },
        { type: "vote" }
      ]
    })
  })

  it("accepts equal RFC3339 timeline bounds", async () => {
    const baseUrl = await startServer({
      assertBillTimelineParentExists: async () => undefined,
      listBillTimeline: async () => ({ items: [], truncated: false })
    })
    const timestamp = "2026-02-01T10:00:00.000Z"
    const response = await fetch(
      `${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/timeline?from=${encodeURIComponent(timestamp)}&to=${encodeURIComponent(timestamp)}`
    )

    expect(response.status).toBe(200)
  })

  it("rejects a timestamp at an ISO-date exclusive end bound", async () => {
    const baseUrl = await startServer({
      assertBillTimelineParentExists: async () => undefined,
      listBillTimeline: async () => ({ items: [], truncated: false })
    })
    const response = await fetch(
      `${baseUrl}/api/bills/bill%3Aus%3A119%3Ahr%3A1/timeline?from=2026-01-02T00%3A00%3A00Z&to=2026-01-01`
    )

    expect(response.status).toBe(400)
  })
})
