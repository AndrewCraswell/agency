import { describe, expect, it } from "vitest"
import { resolveScraperPersonReference, type ScraperPersonCandidate } from "./scraper-person-resolution.js"

function candidate(
  personId: string,
  familyName: string,
  chamber: "lower" | "upper",
  overrides: Partial<ScraperPersonCandidate> = {}
): ScraperPersonCandidate {
  return {
    familyName,
    names: [`Example ${familyName}`],
    personId,
    sourcePersonId: `ocd-person/${personId}`,
    terms: [{ chamber, startDate: "2025-01-01", endDate: "2026-12-31" }],
    ...overrides
  }
}

describe("standalone scraper person resolution", () => {
  it("resolves a unique source surname only inside the matching chamber and tenure", () => {
    const candidates = [candidate("lower-gray", "Gray", "lower"), candidate("upper-gray", "Gray", "upper")]
    expect(
      resolveScraperPersonReference({ chamber: "lower", name: "GRAY", observedDate: "2026-05-01" }, candidates)
    ).toEqual({
      personId: "lower-gray",
      sourcePersonId: "ocd-person/lower-gray",
      status: "resolved"
    })
    expect(
      resolveScraperPersonReference({ chamber: "lower", name: "Gray", observedDate: "2027-05-01" }, candidates)
    ).toEqual({ status: "not_found" })
  })

  it("uses only declared full names or aliases for multi-token references", () => {
    const candidates = [
      candidate("gray", "Gray", "lower", { names: ["Andrew Gray", "A. J. Gray"] }),
      candidate("other", "Gray", "lower", { names: ["Alex Gray"] })
    ]
    expect(
      resolveScraperPersonReference(
        { chamber: "lower", name: "A. J. Gray", sessionStartDate: "2025-01-01", sessionEndDate: "2026-12-31" },
        candidates
      )
    ).toMatchObject({ personId: "gray", status: "resolved" })
    expect(
      resolveScraperPersonReference(
        { chamber: "lower", name: "A Gray", sessionStartDate: "2025-01-01", sessionEndDate: "2026-12-31" },
        candidates
      )
    ).toEqual({ status: "not_found" })
  })

  it("fails closed for ambiguous people, committee labels and missing date scope", () => {
    const candidates = [candidate("one", "Johnson", "lower"), candidate("two", "Johnson", "lower")]
    expect(
      resolveScraperPersonReference({ chamber: "lower", name: "Johnson", observedDate: "2026-05-01" }, candidates)
    ).toEqual({ status: "ambiguous" })
    expect(
      resolveScraperPersonReference({ chamber: "lower", name: "House Rules", observedDate: "2026-05-01" }, candidates)
    ).toEqual({ status: "not_found" })
    expect(resolveScraperPersonReference({ chamber: "lower", name: "Johnson" }, candidates)).toEqual({
      status: "not_found"
    })
  })

  it("normalizes case, accents and punctuation without synthesizing new names", () => {
    const candidates = [candidate("gray-jackson", "Gray-Jacksón", "upper")]
    expect(
      resolveScraperPersonReference({ chamber: "upper", name: "GRAY JACKSON", observedDate: "2026-05-01" }, candidates)
    ).toMatchObject({ personId: "gray-jackson", status: "resolved" })
  })
})
