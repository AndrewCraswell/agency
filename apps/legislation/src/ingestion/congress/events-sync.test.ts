import { beforeEach, describe, expect, it, vi } from "vitest"
import type { LegislationDatabase } from "../../db/database.js"
import type { CongressClient, CongressHearingReference } from "./client.js"
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

function createDatabaseHarness(): {
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
      from: () => ({ where: () => ({ limit: async () => [] }) })
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
})
