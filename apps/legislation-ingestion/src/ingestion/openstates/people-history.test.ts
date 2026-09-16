import { describe, expect, it } from "vitest"
import { inventoryPeopleHistory } from "./people-history.js"
import { northCarolinaPeopleSource } from "./people-repository.js"

const role = { type: "upper", jurisdiction: northCarolinaPeopleSource.jurisdiction, district: "1" }
function file(roles: unknown[]) {
  return { path: "data/nc/retired/person.yml", content: JSON.stringify({ id: "ocd-person/test", name: "Test", roles }) }
}
describe("historical people inventory", () => {
  it("includes previous terms of current legislators without flagging their open role as retired", () => {
    const current = file([
      { ...role, start_date: "2010-01-01", end_date: "2012-01-01" },
      { ...role, start_date: "2020-01-01" }
    ])
    current.path = "data/nc/legislature/person.yml"
    const result = inventoryPeopleHistory([current])
    expect(result.roles).toBe(2)
    expect(result.currentFiles).toBe(1)
    expect(result.retiredFiles).toBe(0)
    expect(result.missingEnds).toBe(1)
    expect(result.issues).toEqual([])
    expect(result.sourceRoles[0]?.sourcePath).toBe(current.path)
  })
  it("rejects a person appearing in both current and retired files", () => {
    const retired = file([{ ...role, end_date: "2012-01-01" }])
    const current = { ...retired, path: "data/nc/legislature/person.yml" }
    expect(() => inventoryPeopleHistory([retired, current])).toThrow("Duplicate historical person")
  })
  it("rejects impossible calendar dates and invalid months without repairing them", () => {
    for (const start_date of ["2025-02-29", "2024-02-30", "2024-13", "2024-00"]) {
      expect(() => inventoryPeopleHistory([file([{ ...role, start_date }])])).toThrow(/Invalid/)
    }
    expect(
      inventoryPeopleHistory([file([{ ...role, start_date: "2024-02-29", end_date: "2024-03-01" }])]).issues
    ).toEqual([])
  })
  it("flags overlapping periods but preserves both source assertions", () => {
    const result = inventoryPeopleHistory([
      file([
        { ...role, start_date: "2010-01-01", end_date: "2014-01-01" },
        { ...role, start_date: "2013-01-01", end_date: "2016-01-01" }
      ])
    ])
    expect(result.issues[0]?.reason).toBe("overlapping_source_roles")
    expect(result.sourceRoles).toHaveLength(2)
  })
  it("allows same-day chamber transitions and never infers overlap from unknown starts", () => {
    const result = inventoryPeopleHistory([
      file([
        { ...role, start_date: "2010-01-01", end_date: "2014-01-01" },
        { ...role, type: "lower", start_date: "2014-01-01", end_date: "2016-01-01" },
        { ...role, end_date: "2017-01-01" }
      ])
    ])
    expect(result.issues).toEqual([])
  })
  it("rejects an empty snapshot", () => {
    expect(() => inventoryPeopleHistory([])).toThrow("Empty")
  })
  it("preserves separate tenures and unknown starts without manufacturing dates", () => {
    const result = inventoryPeopleHistory([
      file([
        { ...role, end_date: "2010-12-31" },
        { ...role, start_date: "2015-01-01", end_date: "2016-12-31" }
      ])
    ])
    expect(result.roles).toBe(2)
    expect(result.missingStarts).toBe(1)
    expect(result.sourceRoles[0]?.start).toBeNull()
    expect(result.completenessEstablished).toBe(false)
  })
  it("retains partial precision and flags retired roles without departures", () => {
    const result = inventoryPeopleHistory([file([{ ...role, start_date: "2009" }])])
    expect(result.partialDates).toBe(1)
    expect(result.missingEnds).toBe(1)
    expect(result.status).toBe("needs_review")
  })
  it("flags reversed dates and ignores non-legislative roles", () => {
    const result = inventoryPeopleHistory([
      file([
        { ...role, start_date: "2012-01-01", end_date: "2010-01-01" },
        { ...role, type: "governor" }
      ])
    ])
    expect(result.roles).toBe(1)
    expect(result.issues[0]?.reason).toBe("reversed_source_dates")
  })
  it("rejects duplicate identities and foreign paths", () => {
    expect(() => inventoryPeopleHistory([file([]), file([])])).toThrow("Duplicate")
    expect(() => inventoryPeopleHistory([{ ...file([]), path: "../person.yml" }])).toThrow("Unexpected")
  })
})
