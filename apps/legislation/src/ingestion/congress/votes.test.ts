import { describe, expect, it } from "vitest"
import { normalizeCongressHouseVote } from "./votes.js"

describe("Congress House vote normalization", () => {
  it("normalizes a bill roll call and member positions", () => {
    const snapshot = normalizeCongressHouseVote({
      members: {
        results: [
          { bioguideID: "A000055", firstName: "Robert", lastName: "Aderholt", voteCast: "Yea" },
          { bioguideID: "B000668", firstName: "Cliff", lastName: "Bentz", voteCast: "Nay" },
          { bioguideID: "C000059", firstName: "Ken", lastName: "Calvert", voteCast: "Not Voting" }
        ]
      },
      reference: {
        congress: 119,
        identifier: 11912025240,
        legislationNumber: "3424",
        legislationType: "HR",
        rollCallNumber: 240,
        sessionNumber: 1,
        sourceDataURL: "https://clerk.house.gov/evs/2025/roll240.xml",
        url: "https://api.congress.gov/v3/house-vote/119/1/240"
      },
      vote: {
        result: "Passed",
        sourceDataURL: "https://clerk.house.gov/evs/2025/roll240.xml",
        startDate: "2025-09-08T18:56:00-04:00",
        voteQuestion: "On Passage",
        voteType: "Yea-And-Nay"
      }
    })

    expect(snapshot.vote).toMatchObject({
      billId: "bill:us:119:hr:3424",
      id: "vote:congress:house-119-1-240",
      noCount: 1,
      otherCount: 1,
      yesCount: 1
    })
    expect(snapshot.positions.map((position) => position.option)).toEqual(["yes", "no", "not-voting"])
    expect(snapshot.positions[0]?.personId).toBe("person:congress:a000055")
  })

  it("links amendment references and retains unlinked chamber votes", () => {
    const base = {
      members: { results: [] },
      vote: {
        sourceDataURL: "https://clerk.house.gov/evs/2025/roll241.xml",
        startDate: "2025-09-08T19:00:00-04:00",
        voteQuestion: "On Agreeing to the Amendment"
      }
    }
    const amendment = normalizeCongressHouseVote({
      ...base,
      reference: {
        congress: 119,
        identifier: 11912025241,
        legislationNumber: "57",
        legislationType: "H.Amdt.",
        rollCallNumber: 241,
        sessionNumber: 1,
        sourceDataURL: "https://clerk.house.gov/evs/2025/roll241.xml",
        url: "https://api.congress.gov/v3/house-vote/119/1/241"
      }
    })
    expect(amendment.vote).toMatchObject({ amendmentId: "amendment:us:119:hamdt:57" })
    expect(amendment.vote).not.toHaveProperty("billId")

    const chamberVote = normalizeCongressHouseVote({
      ...base,
      reference: {
        congress: 119,
        identifier: 11912025242,
        rollCallNumber: 242,
        sessionNumber: 1,
        sourceDataURL: "https://clerk.house.gov/evs/2025/roll242.xml",
        url: "https://api.congress.gov/v3/house-vote/119/1/242"
      }
    })
    expect(chamberVote.vote).toMatchObject({ chamber: "lower" })
    expect(chamberVote.vote).not.toHaveProperty("amendmentId")
    expect(chamberVote.vote).not.toHaveProperty("billId")
  })

  it("deduplicates repeated member identities before counting and persistence", () => {
    const snapshot = normalizeCongressHouseVote({
      members: {
        results: [
          { bioguideID: "A000055", firstName: "Robert", lastName: "Aderholt", voteCast: "Yea" },
          { bioguideID: "A000055", firstName: "Robert", lastName: "Aderholt", voteCast: "Yea" }
        ]
      },
      reference: {
        congress: 119,
        identifier: 11912025240,
        rollCallNumber: 240,
        sessionNumber: 1,
        sourceDataURL: "https://clerk.house.gov/evs/2025/roll240.xml",
        url: "https://api.congress.gov/v3/house-vote/119/1/240"
      },
      vote: {
        sourceDataURL: "https://clerk.house.gov/evs/2025/roll240.xml",
        startDate: "2025-09-08T18:56:00-04:00",
        voteQuestion: "On Passage"
      }
    })

    expect(snapshot.positions).toHaveLength(1)
    expect(snapshot.vote).toMatchObject({ noCount: 0, otherCount: 0, yesCount: 1 })
  })
})
