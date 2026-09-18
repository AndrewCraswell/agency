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

  it("uses the terminal token of a source-declared compound family name", () => {
    const candidates = [candidate("helfrich", "Gardner Helfrich", "lower")]
    expect(
      resolveScraperPersonReference({ chamber: "lower", name: "Helfrich", observedDate: "2026-05-01" }, candidates)
    ).toMatchObject({ personId: "helfrich", status: "resolved" })
  })

  it("matches a source formatting defect that removed spaces from a unique published full name", () => {
    const candidates = [
      candidate("jarrod", "Lowery", "lower", { names: ["Jarrod Lowery"] }),
      candidate("john", "Lowery", "lower", { names: ["John Lowery"] })
    ]
    expect(
      resolveScraperPersonReference({ chamber: "lower", name: "JohnLowery", observedDate: "2026-05-01" }, candidates)
    ).toMatchObject({ personId: "john", status: "resolved" })
  })

  it("resolves a legislature-wide tally across both chambers while retaining ambiguity checks", () => {
    const candidates = [candidate("lower", "House", "lower"), candidate("upper", "Senate", "upper")]
    expect(
      resolveScraperPersonReference({ chamber: "legislature", name: "House", observedDate: "2026-05-01" }, candidates)
    ).toMatchObject({ personId: "lower", status: "resolved" })
    expect(
      resolveScraperPersonReference({ chamber: "legislature", name: "Senate", observedDate: "2026-05-01" }, candidates)
    ).toMatchObject({ personId: "upper", status: "resolved" })
  })

  it("uses source-backed surname aliases and unique chamber history to bridge provider tenure gaps", () => {
    const renamed = candidate("renamed", "Frier", "lower", {
      familyNameAliases: ["Burke"],
      names: ["Robyn Frier", "Robyn Burke"]
    })
    const transferred = candidate("transferred", "Rauscher", "lower", {
      terms: [
        { chamber: "lower", startDate: "2017-01-01", endDate: "2023-01-01" },
        { chamber: "upper", startDate: "2025-11-29", endDate: null }
      ]
    })
    expect(
      resolveScraperPersonReference(
        {
          chamber: "lower",
          allowChamberHistoryFallback: true,
          name: "Burke",
          observedDate: "2025-05-01",
          sessionStartDate: "2025-01-01",
          sessionEndDate: "2026-12-31"
        },
        [renamed]
      )
    ).toMatchObject({ personId: "renamed", status: "resolved" })
    expect(
      resolveScraperPersonReference(
        {
          chamber: "lower",
          allowChamberHistoryFallback: true,
          name: "Rauscher",
          observedDate: "2025-05-01",
          sessionStartDate: "2025-01-01",
          sessionEndDate: "2026-12-31"
        },
        [transferred]
      )
    ).toMatchObject({ personId: "transferred", status: "resolved" })
  })

  it("does not bridge chamber history when the source-backed surname remains ambiguous", () => {
    const candidates = [candidate("one", "Legacy", "lower"), candidate("two", "Legacy", "lower")]
    expect(
      resolveScraperPersonReference(
        {
          chamber: "lower",
          allowChamberHistoryFallback: true,
          name: "Legacy",
          observedDate: "2025-05-01",
          sessionStartDate: "2025-01-01",
          sessionEndDate: "2026-12-31"
        },
        candidates
      )
    ).toEqual({ status: "ambiguous" })
  })

  it("resolves a uniquely named cross-chamber sponsor only within a source-backed tenure", () => {
    const upperSponsor = candidate("upper-dunbar", "Dunbar", "upper")
    const context = {
      allowUniqueCrossChamberFallback: true,
      chamber: "lower" as const,
      name: "Dunbar",
      observedDate: "2026-05-01",
      sessionStartDate: "2025-01-01",
      sessionEndDate: "2026-12-31"
    }
    expect(resolveScraperPersonReference(context, [upperSponsor])).toMatchObject({
      personId: "upper-dunbar",
      status: "resolved"
    })
    expect(
      resolveScraperPersonReference({ ...context, allowUniqueCrossChamberFallback: false }, [upperSponsor])
    ).toEqual({ status: "not_found" })
    expect(resolveScraperPersonReference({ ...context, observedDate: "2027-05-01" }, [upperSponsor])).toEqual({
      status: "not_found"
    })
  })

  it("fails closed when a cross-chamber sponsor name remains ambiguous", () => {
    const context = {
      allowUniqueCrossChamberFallback: true,
      chamber: "lower" as const,
      name: "Fields",
      observedDate: "2026-05-01"
    }
    expect(
      resolveScraperPersonReference(context, [
        candidate("upper-fields-one", "Fields", "upper"),
        candidate("upper-fields-two", "Fields", "upper")
      ])
    ).toEqual({ status: "ambiguous" })
    expect(
      resolveScraperPersonReference({ ...context, name: "Senate Rules" }, [
        candidate("upper-fields-one", "Fields", "upper")
      ])
    ).toEqual({ status: "not_found" })
  })

  it("links an exact unique source identity whose contradictory tenure was quarantined", () => {
    const quarantined = candidate("hughes", "Hughes", "upper", { terms: [] })
    expect(
      resolveScraperPersonReference(
        {
          allowChamberHistoryFallback: true,
          chamber: "upper",
          name: "Hughes",
          observedDate: "2025-05-01"
        },
        [quarantined]
      )
    ).toMatchObject({ personId: "hughes", status: "resolved" })
    expect(
      resolveScraperPersonReference(
        {
          allowChamberHistoryFallback: true,
          chamber: "upper",
          name: "Hughes",
          observedDate: "2025-05-01"
        },
        [quarantined, candidate("other-hughes", "Hughes", "upper", { terms: [] })]
      )
    ).toEqual({ status: "ambiguous" })
  })
})
