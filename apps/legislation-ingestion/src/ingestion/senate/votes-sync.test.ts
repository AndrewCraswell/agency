import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SenateClient, SenateVoteReference, SenateXmlSource } from "./client.js"
import type { SenateVoteSnapshot } from "./votes.js"

const mocks = vi.hoisted(() => ({
  upsertFederalVote: vi.fn<(database: unknown, snapshot: SenateVoteSnapshot) => Promise<void>>()
}))

vi.mock("../../persistence/votes.js", () => ({
  upsertFederalVoteSnapshot: mocks.upsertFederalVote
}))

import { synchronizeSenateVotes } from "./votes-sync.js"

type VoteClient = Pick<SenateClient, "getMemberIdentifiers" | "getVote" | "listVotes">

function reference(voteNumber: number): SenateVoteReference {
  return {
    congress: 119,
    session: 1,
    sourceUrl: `https://www.senate.gov/vote-${voteNumber}.xml`,
    voteNumber
  }
}

function source<T>(value: T, sourceUrl = "https://www.senate.gov/source.xml"): SenateXmlSource<T> {
  return { bytes: new TextEncoder().encode(String(value)), sourceUrl, value }
}

function voteXml(voteNumber: number): string {
  return `<roll_call_vote><congress>119</congress><session>1</session><vote_number>${voteNumber}</vote_number>
    <vote_date>January 3, 2025,  01:00 PM</vote_date><vote_question_text>On Passage</vote_question_text>
    <vote_result>Passed</vote_result><members><member><last_name>Example</last_name><vote_cast>Yea</vote_cast>
    <lis_member_id>S001</lis_member_id></member></members></roll_call_vote>`
}

function client(voteNumbers: readonly number[]): VoteClient {
  return {
    getMemberIdentifiers: async () => source(new Map()),
    getVote: async (item) => source(voteXml(item.voteNumber), item.sourceUrl),
    listVotes: async () => source(voteNumbers.map(reference))
  }
}

function databaseHarness(initialNextVoteNumber?: number) {
  let checkpoint: { cursor: Record<string, unknown>; source: string } | undefined =
    initialNextVoteNumber === undefined
      ? undefined
      : { cursor: { nextVoteNumber: initialNextVoteNumber }, source: "senate" }
  const checkpointWrites: number[] = []
  const database = {
    insert: () => ({
      values: (value: { cursor: Record<string, unknown> }) => ({
        onConflictDoUpdate: async () => {
          checkpoint = { cursor: value.cursor, source: "senate" }
          checkpointWrites.push(Number(value.cursor.nextVoteNumber))
        }
      })
    }),
    query: { syncCheckpoints: { findFirst: async () => checkpoint } },
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => (initialNextVoteNumber === undefined ? [] : [{ id: "vote" }]) })
      })
    })
  } as unknown as LegislationDatabase
  return { checkpointWrites, database }
}

describe("Senate vote synchronization", () => {
  beforeEach(() => mocks.upsertFederalVote.mockReset().mockResolvedValue())

  it("processes new votes in ascending order and checkpoints each durable write", async () => {
    const harness = databaseHarness()
    const result = await synchronizeSenateVotes(harness.database, client([3, 1, 2]), 119, 1)

    expect(result.counts).toMatchObject({ discovered: 3, failed: 0, inserted: 3, read: 3 })
    expect(result.checkpoint).toEqual({ nextVoteNumber: 4 })
    expect(harness.checkpointWrites).toEqual([2, 3, 4])
    expect(mocks.upsertFederalVote.mock.calls.map(([, snapshot]) => snapshot.vote.rollCallNumber)).toEqual([
      "1",
      "2",
      "3"
    ])
  })

  it("resumes from the first uncommitted vote after a failure", async () => {
    const harness = databaseHarness(2)
    const sourceClient = client([1, 2, 3])
    vi.spyOn(sourceClient, "getVote").mockImplementation(async (item) => {
      if (item.voteNumber === 2) throw new Error("controlled failure")
      return source(voteXml(item.voteNumber), item.sourceUrl)
    })

    const result = await synchronizeSenateVotes(harness.database, sourceClient, 119, 1)

    expect(result.counts.failed).toBe(1)
    expect(result.checkpoint).toEqual({ nextVoteNumber: 2 })
    expect(harness.checkpointWrites).toEqual([])
    expect(sourceClient.getVote).toHaveBeenCalledTimes(1)
  })

  it("refreshes a bounded recent window after catching up", async () => {
    const harness = databaseHarness(4)
    const result = await synchronizeSenateVotes(harness.database, client([1, 2, 3]), 119, 1)

    expect(result.counts).toMatchObject({ discovered: 3, updated: 3 })
    expect(result.checkpoint).toEqual({ nextVoteNumber: 4 })
    expect(harness.checkpointWrites).toEqual([])
  })
})
