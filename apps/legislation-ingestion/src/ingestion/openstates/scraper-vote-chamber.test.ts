import { describe, expect, it } from "vitest"
import { scraperVoteChamberFromEvidence, scraperVoteChamberFromSourceUrl } from "./scraper-vote-chamber.js"

describe("scraper vote chamber evidence", () => {
  it("derives Alaska chambers from official journal URLs", () => {
    expect(
      scraperVoteChamberFromSourceUrl(
        "ak",
        "34",
        "https://www.akleg.gov/basis/Journal/Pages/34?Chamber=H&Bill=HB2&Page=02441#2441"
      )
    ).toBe("lower")
    expect(
      scraperVoteChamberFromSourceUrl(
        "ak",
        "34",
        "https://www.akleg.gov/basis/Journal/Pages/34?Chamber=S&Bill=HB2&Page=02441"
      )
    ).toBe("upper")
  })

  it("derives North Carolina chambers from official transcript URLs", () => {
    expect(
      scraperVoteChamberFromSourceUrl(
        "nc",
        "2025",
        "https://www.ncleg.gov/Legislation/Votes/RollCallVoteTranscript/2025/H/17"
      )
    ).toBe("lower")
    expect(
      scraperVoteChamberFromSourceUrl(
        "nc",
        "2025",
        "https://www.ncleg.gov/Legislation/Votes/RollCallVoteTranscript/2025/S/9"
      )
    ).toBe("upper")
  })

  it.each([
    ["ak", "34", "http://www.akleg.gov/basis/Journal/Pages/34?Chamber=H"],
    ["ak", "34", "https://example.com/basis/Journal/Pages/34?Chamber=H"],
    ["ak", "33", "https://www.akleg.gov/basis/Journal/Pages/34?Chamber=H"],
    ["ak", "34", "https://www.akleg.gov/basis/Journal/Pages/34?Chamber=X"],
    ["nc", "2025", "https://www.ncleg.gov/Legislation/Votes/RollCallVoteTranscript/2023/H/1"],
    ["nc", "2025", "https://www.ncleg.gov/Legislation/Votes/RollCallVoteTranscript/2025/X/1"],
    ["nc", "2025", "not a URL"]
  ] as const)("rejects non-authoritative or malformed evidence", (state, session, sourceUrl) => {
    expect(scraperVoteChamberFromSourceUrl(state, session, sourceUrl)).toBeUndefined()
  })

  it("distinguishes chamber-specific and combined Alaska tallies on one journal page", () => {
    const sourceUrl = "https://www.akleg.gov/basis/Journal/Pages/34?Chamber=S&Bill=SSCR1&Page=00566#0566"
    expect(
      scraperVoteChamberFromEvidence({
        motion: "(S) HOUSE VOTE Y18 N22 #566",
        positionCount: 40,
        session: "34",
        sourceUrl,
        state: "ak"
      })
    ).toBe("lower")
    expect(
      scraperVoteChamberFromEvidence({
        motion: "(S) SENATE VOTE Y14 N6 #566",
        positionCount: 20,
        session: "34",
        sourceUrl,
        state: "ak"
      })
    ).toBe("upper")
    expect(
      scraperVoteChamberFromEvidence({
        motion: "(S) PASSED Y32 N28 #566",
        positionCount: 60,
        session: "34",
        sourceUrl,
        state: "ak"
      })
    ).toBe("legislature")
  })
})
