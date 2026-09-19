import { describe, expect, it } from "vitest"
import { createScraperPersonResolver } from "./scraper-person-resolution.js"
import { sponsorObservationDate } from "./sponsor-observation-date.js"

describe("sponsorship observation dates", () => {
  it("uses first reading instead of an earlier prefiling action", () => {
    expect(sponsorObservationDate({ firstActionDate: "2024-12-02", firstReadingDate: "2025-01-13" })).toBe("2025-01-13")
  })

  it("preserves explicit introduction and falls back only to supplied evidence", () => {
    expect(sponsorObservationDate({ introducedDate: "2025-01-10", firstReadingDate: "2025-01-13" })).toBe("2025-01-10")
    expect(sponsorObservationDate({ firstIntroductionDate: "2025-01-13", firstActionDate: "2024-12-02" })).toBe(
      "2025-01-13"
    )
    expect(sponsorObservationDate({ firstActionDate: "2024-12-02" })).toBe("2024-12-02")
    expect(sponsorObservationDate({})).toBeUndefined()
  })

  it("resolves a newly seated sponsor without changing tenure or accepting ambiguous names", () => {
    const person = {
      personId: "person:new",
      sourcePersonId: "ocd-person/new",
      familyName: "Example",
      names: ["New Example"],
      terms: [{ chamber: "lower", startDate: "2025-01-13", endDate: null }]
    }
    const context = {
      chamber: "lower" as const,
      name: "Example",
      observedDate: sponsorObservationDate({
        firstActionDate: "2024-12-02",
        firstReadingDate: "2025-01-13"
      })
    }
    expect(createScraperPersonResolver([person])(context)).toMatchObject({ status: "resolved", personId: "person:new" })
    expect(createScraperPersonResolver([person])({ ...context, observedDate: "2024-12-02" })).toEqual({
      status: "not_found"
    })
    expect(
      createScraperPersonResolver([
        person,
        { ...person, personId: "person:other", sourcePersonId: "ocd-person/other" }
      ])(context)
    ).toEqual({ status: "ambiguous" })
  })
})
