import { describe, expect, it } from "vitest"
import { assessAnnualCfrDates } from "./annual-cfr-dates.js"
import { digest } from "./contracts.js"

const observation = {
  unitKey: digest("2023"),
  nativeId: "CFR-2023-title1-vol1",
  packageYear: 2023,
  artifactHash: digest("same publisher bytes"),
  printedRevisionDates: ["2023-01-01"]
}
describe("annual CFR publisher date evidence", () => {
  it("detects reused bytes without promoting package years into currency", () => {
    const report = assessAnnualCfrDates(
      [2023, 2024, 2025].map((year) => ({
        ...observation,
        unitKey: digest(String(year)),
        nativeId: `CFR-${year}-title1-vol1`,
        packageYear: year
      }))
    )
    expect(report.consistentUnits).toBe(1)
    expect(report.dateReviewRequired).toBe(true)
    expect(report.units.map((unit) => unit.status)).toEqual([
      "dates_consistent",
      "package_revision_year_mismatch",
      "package_revision_year_mismatch"
    ])
    expect(report.units.every((unit) => unit.legalCurrencyDate === null && !unit.publicationReady)).toBe(true)
    expect(report.units[0]?.sharedPackageYears).toEqual([2023, 2024, 2025])
    expect(report.duplicateRevisionObservations).toBe(2)
    expect(report.units[1]).toMatchObject({
      disposition: "retain_duplicate_revision_observation",
      revisionAnchorUnitKey: digest("2023"),
      packageYearMatchesPrintedRevision: false,
      canCreatePackageYearEdition: false
    })
  })
  it("keeps missing and contradictory printed dates unresolved", () => {
    expect(assessAnnualCfrDates([{ ...observation, printedRevisionDates: [] }]).units[0]?.status).toBe(
      "missing_printed_revision"
    )
    const result = assessAnnualCfrDates([{ ...observation, printedRevisionDates: ["2023-01-01", "2024-01-01"] }])
    expect(result.units[0]).toMatchObject({ status: "conflicting_printed_revisions", sourceRevisionDate: null })
  })
  it("accepts repeated identical date evidence without treating other gates as passed", () => {
    expect(
      assessAnnualCfrDates([{ ...observation, printedRevisionDates: ["2023-01-01", "2023-01-01"] }])
    ).toMatchObject({ consistentUnits: 1, dateReviewRequired: false, publicationReady: false })
  })
  it("rejects duplicate observations instead of inflating coverage", () => {
    expect(() => assessAnnualCfrDates([observation, observation])).toThrow("duplicate_annual_cfr_observation")
  })
  it("does not anchor identical bytes across titles or ambiguous source observations", () => {
    const mismatched = { ...observation, unitKey: digest("2024"), nativeId: "CFR-2024-title1-vol1", packageYear: 2024 }
    const otherTitle = { ...observation, nativeId: "CFR-2023-title2-vol1" }
    expect(assessAnnualCfrDates([otherTitle, mismatched]).units[1]?.disposition).toBe("quarantine_date_evidence")
    const duplicateAnchor = { ...observation, unitKey: digest("another 2023 observation") }
    expect(assessAnnualCfrDates([observation, duplicateAnchor, mismatched]).units[2]?.revisionAnchorUnitKey).toBeNull()
  })
})
