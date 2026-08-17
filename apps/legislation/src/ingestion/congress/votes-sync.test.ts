import { beforeEach, describe, expect, it, vi } from "vitest"
import type { LegislationDatabase } from "../../db/database.js"
import type { CongressClient, CongressHouseVoteReference } from "./client.js"
import type { CongressHouseVoteSnapshot } from "./votes.js"

const mocks = vi.hoisted(() => ({
  upsertHouseVote: vi.fn<(database: unknown, snapshot: CongressHouseVoteSnapshot) => Promise<void>>()
}))

vi.mock("../../db/queries/votes.js", () => ({
  upsertCongressHouseVoteSnapshot: mocks.upsertHouseVote
}))

import { synchronizeCongressHouseVotes } from "./votes-sync.js"

type HouseVoteClient = Pick<CongressClient, "getHouseVoteBundle" | "houseVotes">

function voteReference(rollCallNumber: number): CongressHouseVoteReference {
  return {
    congress: 115,
    identifier: `11512017${rollCallNumber}`,
    rollCallNumber,
    sessionNumber: 1,
    sourceDataURL: `https://clerk.house.gov/evs/2017/roll${rollCallNumber}.xml`,
    url: `https://api.congress.gov/v3/house-vote/115/1/${rollCallNumber}`
  }
}

function voteBundle(reference: CongressHouseVoteReference): unknown {
  return {
    members: { results: [] },
    reference,
    vote: {
      sourceDataURL: reference.sourceDataURL,
      startDate: "2017-01-03T12:00:00-05:00",
      voteQuestion: "On Passage"
    }
  }
}

function createClient(
  references: readonly CongressHouseVoteReference[],
  getHouseVoteBundle: HouseVoteClient["getHouseVoteBundle"],
  starts: number[] = []
): HouseVoteClient {
  return {
    getHouseVoteBundle,
    async *houseVotes(_congress, _session, startOffset = 0) {
      starts.push(startOffset)
      for (const [offset, reference] of references.entries()) {
        if (offset >= startOffset) {
          yield { offset, reference }
        }
      }
    }
  }
}

function createDatabaseHarness(initialOffset?: number): {
  checkpointWrites: number[]
  database: LegislationDatabase
  readOffset: () => number | undefined
} {
  let checkpoint =
    initialOffset === undefined ? undefined : { cursor: { nextOffset: initialOffset }, source: "congress" }
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

describe("Congress House vote synchronization", () => {
  beforeEach(() => {
    mocks.upsertHouseVote.mockReset().mockResolvedValue()
  })

  it("runs a bounded batch concurrently without exceeding the exact limit", async () => {
    const references = [1, 2, 3, 4].map(voteReference)
    const pending = new Map<number, () => void>()
    const getHouseVoteBundle = vi.fn<HouseVoteClient["getHouseVoteBundle"]>(async (reference) => {
      await new Promise<void>((resolve) => pending.set(reference.rollCallNumber, resolve))
      return voteBundle(reference)
    })
    const starts: number[] = []
    const client = createClient(references, getHouseVoteBundle, starts)
    const harness = createDatabaseHarness()

    const synchronization = synchronizeCongressHouseVotes(harness.database, client, 115, 1, {
      concurrency: 2,
      limit: 2
    })

    await vi.waitFor(() => expect([...pending.keys()]).toEqual([1, 2]))
    pending.get(2)?.()
    pending.get(1)?.()
    const result = await synchronization

    expect(starts).toEqual([0])
    expect(getHouseVoteBundle).toHaveBeenCalledTimes(2)
    expect(result.counts).toMatchObject({ discovered: 2, failed: 0, inserted: 2, read: 2 })
    expect(result.checkpoint).toEqual({ nextOffset: 2 })
    expect(harness.checkpointWrites).toEqual([1, 2])
  })

  it("stops the checkpoint at a middle-batch failure and replays the uncommitted suffix", async () => {
    const references = [1, 2, 3].map(voteReference)
    const attempts = new Map<number, number>()
    const starts: number[] = []
    const persisted = new Set<string>()
    mocks.upsertHouseVote.mockImplementation(async (_database, snapshot) => {
      persisted.add(snapshot.vote.id)
    })
    const getHouseVoteBundle = vi.fn<HouseVoteClient["getHouseVoteBundle"]>(async (reference) => {
      const attempt = (attempts.get(reference.rollCallNumber) ?? 0) + 1
      attempts.set(reference.rollCallNumber, attempt)
      if (reference.rollCallNumber === 2 && attempt === 1) {
        throw new Error("controlled middle-batch failure")
      }
      return voteBundle(reference)
    })
    const client = createClient(references, getHouseVoteBundle, starts)
    const harness = createDatabaseHarness()

    const first = await synchronizeCongressHouseVotes(harness.database, client, 115, 1, { concurrency: 3 })

    expect(first.failures).toEqual([
      expect.objectContaining({ identifier: "115-1-2", message: "controlled middle-batch failure" })
    ])
    expect(first.checkpoint).toEqual({ nextOffset: 1 })
    expect(harness.checkpointWrites).toEqual([1])
    expect(persisted).toEqual(new Set(["vote:congress:house-115-1-1", "vote:congress:house-115-1-3"]))

    const replay = await synchronizeCongressHouseVotes(harness.database, client, 115, 1, { concurrency: 3 })

    expect(starts).toEqual([0, 1])
    expect(replay.failures).toEqual([])
    expect(replay.checkpoint).toEqual({ nextOffset: 3 })
    expect(harness.checkpointWrites).toEqual([1, 2, 3])
    expect(attempts).toEqual(
      new Map([
        [1, 1],
        [2, 2],
        [3, 2]
      ])
    )
    expect(persisted).toEqual(
      new Set(["vote:congress:house-115-1-1", "vote:congress:house-115-1-2", "vote:congress:house-115-1-3"])
    )
  })
})
