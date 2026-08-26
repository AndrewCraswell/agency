import { beforeEach, describe, expect, it, vi } from "vitest"
import type { LegislationDatabase } from "../../db/database.js"
import type { CongressClient, CongressCommitteeMeetingReference, CongressHearingReference } from "./client.js"
import type { CongressEventSnapshot } from "./events.js"

const mocks = vi.hoisted(() => ({
  upsertCongressEvent: vi.fn<(database: unknown, snapshot: CongressEventSnapshot) => Promise<void>>()
}))

vi.mock("../../db/queries/congress-events.js", () => ({
  upsertCongressEventSnapshot: mocks.upsertCongressEvent
}))

import { synchronizeCongressEvents } from "./events-sync.js"

type EventClient = Pick<CongressClient, "committeeMeetings" | "getCommitteeMeeting" | "getHearing" | "hearings">

function hearingReference(jacketNumber: number): CongressHearingReference {
  return {
    chamber: "House",
    congress: 113,
    jacketNumber: String(jacketNumber),
    url: `https://api.congress.gov/v3/hearing/113/house/${jacketNumber}`
  }
}

function committeeMeetingReference(eventId: string): CongressCommitteeMeetingReference {
  return {
    chamber: "House",
    congress: 119,
    eventId,
    url: `https://api.congress.gov/v3/committee-meeting/119/house/${eventId}`
  }
}

function createDatabaseHarness(existingSourceUpdatedAt?: Date): {
  checkpointWrites: number[]
  database: LegislationDatabase
  readOffset: () => number | undefined
} {
  let checkpoint: { cursor: { nextOffset: number }; source: string } | undefined
  const checkpointWrites: number[] = []
  const database = {
    insert: () => ({
      values: (value: { cursor: Record<string, unknown> }) => ({
        onConflictDoUpdate: async () => {
          const nextOffset = value.cursor.nextOffset
          if (typeof nextOffset !== "number") {
            throw new Error("Test checkpoint did not contain a numeric offset")
          }
          checkpoint = { cursor: { nextOffset }, source: "congress" }
          checkpointWrites.push(nextOffset)
        }
      })
    }),
    query: { syncCheckpoints: { findFirst: async () => checkpoint } },
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () =>
            existingSourceUpdatedAt === undefined ? [] : [{ sourceUpdatedAt: existingSourceUpdatedAt }]
        })
      })
    })
  } as unknown as LegislationDatabase
  return {
    checkpointWrites,
    database,
    readOffset: () => checkpoint?.cursor.nextOffset
  }
}

describe("Congress event synchronization", () => {
  beforeEach(() => {
    mocks.upsertCongressEvent.mockReset().mockResolvedValue()
  })

  it("skips an undated hearing, commits its checkpoint, and continues to the next hearing", async () => {
    const references = [hearingReference(80170), hearingReference(80171)]
    const client: EventClient = {
      async *committeeMeetings() {
        yield* []
      },
      async getCommitteeMeeting() {
        throw new Error("Committee meeting details should not be requested for hearing synchronization")
      },
      async getHearing(reference) {
        if (reference.jacketNumber === "80170") {
          return {
            hearing: {
              chamber: "House",
              congress: 113,
              jacketNumber: 80170,
              title: "Undated hearing"
            },
            sourceUrl: reference.url
          }
        }
        return {
          hearing: {
            chamber: "House",
            congress: 113,
            dates: [{ date: "2014-12-10" }],
            jacketNumber: 80171,
            title: "Dated hearing"
          },
          sourceUrl: reference.url
        }
      },
      async *hearings(_congress, startOffset = 0) {
        for (const [offset, reference] of references.entries()) {
          if (offset >= startOffset) {
            yield { offset, reference }
          }
        }
      }
    }
    const harness = createDatabaseHarness()

    const result = await synchronizeCongressEvents(harness.database, client, 113, "hearings")

    expect(result.counts).toMatchObject({ discovered: 2, failed: 0, inserted: 1, read: 1, skipped: 1 })
    expect(result.failures).toEqual([])
    expect(result.checkpoint).toEqual({ nextOffset: 2 })
    expect(harness.readOffset()).toBe(2)
    expect(harness.checkpointWrites).toEqual([1, 2])
    expect(mocks.upsertCongressEvent).toHaveBeenCalledTimes(1)
    expect(mocks.upsertCongressEvent.mock.calls[0]?.[1].event.name).toBe("Dated hearing")
  })

  it("rematerializes equal-timestamp events only when explicitly requested", async () => {
    const updatedAt = new Date("2026-08-26T12:00:00.000Z")
    const reference = committeeMeetingReference("119189")
    const client: EventClient = {
      async *committeeMeetings(_congress, startOffset = 0) {
        if (startOffset === 0) {
          yield { offset: 0, reference }
        }
      },
      async getCommitteeMeeting() {
        return {
          meeting: {
            chamber: "House",
            committees: [],
            congress: 119,
            date: "2026-08-26T14:00:00Z",
            eventId: "119189",
            location: { room: "2123" },
            meetingStatus: "Scheduled",
            title: "Meeting to rematerialize",
            type: "Meeting",
            updateDate: updatedAt.toISOString()
          },
          sourceUrl: reference.url
        }
      },
      async getHearing() {
        throw new Error("Hearing details should not be requested for meeting synchronization")
      },
      async *hearings() {
        yield* []
      }
    }

    const harness = createDatabaseHarness(updatedAt)
    const unchanged = await synchronizeCongressEvents(harness.database, client, 119, "meetings")

    expect(unchanged.counts).toMatchObject({ read: 1, unchanged: 1, updated: 0 })
    expect(harness.readOffset()).toBe(1)
    expect(mocks.upsertCongressEvent).not.toHaveBeenCalled()

    const terminalCheckpoint = await synchronizeCongressEvents(harness.database, client, 119, "meetings", {
      forceRematerialize: true
    })

    expect(terminalCheckpoint.counts).toMatchObject({ discovered: 0, read: 0, updated: 0 })
    expect(mocks.upsertCongressEvent).not.toHaveBeenCalled()

    const rematerialized = await synchronizeCongressEvents(harness.database, client, 119, "meetings", {
      forceRematerialize: true,
      restart: true
    })

    expect(rematerialized.counts).toMatchObject({ read: 1, unchanged: 0, updated: 1 })
    expect(mocks.upsertCongressEvent).toHaveBeenCalledTimes(1)
    expect(mocks.upsertCongressEvent.mock.calls[0]?.[1].event.id).toBe("event:congress:committee-meeting-119189")
  })
})
