import { describe, expect, it } from "vitest"
import { isVotePositionPersonLinkable } from "./votes.js"

const completePerson = {
  isActive: true,
  jurisdictionId: "jurisdiction:us",
  name: "Representative Example",
  provenanceComplete: true,
  sourceIsOfficial: true,
  sourceProvider: "congress",
  sourceRetrievedAt: new Date("2026-08-26T12:00:00.000Z"),
  sourceUrl: "https://api.congress.gov/v3/member/A000001"
}

describe("isVotePositionPersonLinkable", () => {
  it("links only people that can be projected in vote detail", () => {
    expect(isVotePositionPersonLinkable(completePerson)).toBe(true)
    expect(isVotePositionPersonLinkable({ ...completePerson, provenanceComplete: false })).toBe(false)
    expect(isVotePositionPersonLinkable({ ...completePerson, sourceProvider: " " })).toBe(false)
    expect(isVotePositionPersonLinkable({ ...completePerson, sourceRetrievedAt: null })).toBe(false)
    expect(isVotePositionPersonLinkable({ ...completePerson, sourceUrl: null })).toBe(false)
    expect(isVotePositionPersonLinkable({ ...completePerson, sourceIsOfficial: null })).toBe(false)
    expect(isVotePositionPersonLinkable({ ...completePerson, jurisdictionId: null })).toBe(false)
    expect(isVotePositionPersonLinkable({ ...completePerson, isActive: null })).toBe(false)
    expect(isVotePositionPersonLinkable({ ...completePerson, name: " " })).toBe(false)
  })
})
