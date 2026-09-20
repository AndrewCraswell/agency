import { describe, expect, it } from "vitest"
import type { PersonVotePositionRead, VoteRead } from "../../legislation/persistence/queries/vote-reads"
import { parseVoteOption, projectPersonVoteActivity, projectVote, projectVoteDetailRead } from "./vote-read-projection"

const baseUrl = "https://api.example.test"
const createdAt = new Date("2026-08-25T00:00:00Z")

function vote(): VoteRead {
  return {
    absentCount: 0,
    abstainCount: 0,
    amendmentId: null,
    billId: null,
    chamber: "house",
    classification: "passage",
    createdAt,
    eventId: null,
    heldAt: null,
    heldDate: "2026-08-24",
    id: "vote:us:119:house:1",
    motion: "On passage",
    noCount: 2,
    notVotingCount: 1,
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
    sourceIsOfficial: false,
    sourceProvider: "fixture",
    sourceRetrievedAt: createdAt,
    sourceSequence: 1,
    sourceUpdatedAt: null,
    sourceUrl: "https://publisher.example.test/vote/1",
    timelineComplete: true,
    voteType: "roll-call",
    yesCount: 3
  }
}

function activity(): PersonVotePositionRead {
  const row = vote()
  return {
    bill: null,
    person: null,
    position: {
      createdAt,
      option: "not-voting",
      personId: null,
      sourceIdentity: "member:1",
      sourceName: "Recorded member",
      sourcePersonId: null,
      sourceSequence: 0,
      voteId: row.id
    },
    vote: row
  }
}

describe("vote read projection", () => {
  it("preserves unresolved people, absent bills, source precision and bounded position continuation", () => {
    const value = activity()
    const result = projectPersonVoteActivity(value, baseUrl)
    const detail = projectVoteDetailRead(
      value.vote,
      { items: [value], nextCursor: "next-position", truncated: true },
      baseUrl
    )

    expect(result.bill).toBeNull()
    expect(result.position).toMatchObject({
      canonicalUrl: `${baseUrl}/api/votes/vote%3Aus%3A119%3Ahouse%3A1#member%3A1`,
      person: null,
      option: "not-voting",
      sourceName: "Recorded member",
      sourcePersonId: null
    })
    expect(result.vote).toMatchObject({
      billId: null,
      date: "2026-08-24",
      heldAt: null,
      counts: { notVoting: 1, other: 0, yes: 3 },
      sources: [{ isOfficial: false, provider: "fixture", sourceUpdatedAt: null }]
    })
    expect(detail.positions).toEqual([result.position])
    expect(detail.positionsPageInfo).toEqual({ limit: 25, nextCursor: "next-position", truncated: true })
  })

  it.each(["yesCount", "result", "sourceIsOfficial", "sourceProvider", "sourceRetrievedAt"])(
    "rejects incomplete %s rather than fabricating a canonical value",
    (field) => {
      const value = vote()
      Reflect.set(value, field, null)
      expect(() => projectVote(value, baseUrl)).toThrow(expect.objectContaining({ category: "unprocessable" }))
    }
  )

  it("retains a known empty position page and rejects an invalid recorded option", () => {
    const value = activity()
    const detail = projectVoteDetailRead(value.vote, { items: [], truncated: false }, baseUrl)
    expect(detail.positions).toEqual([])
    expect(detail.positionsPageInfo).toEqual({ limit: 25, nextCursor: null, truncated: false })

    value.position.option = "unknown"
    expect(() => projectPersonVoteActivity(value, baseUrl)).toThrow("Vote position option is invalid")
    expect(parseVoteOption("unknown")).toBeUndefined()
    expect(parseVoteOption(undefined)).toBeUndefined()
  })
})
