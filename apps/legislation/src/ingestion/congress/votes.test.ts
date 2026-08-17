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
})
