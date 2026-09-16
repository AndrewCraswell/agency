import { describe, expect, it } from "vitest"
import { northCarolinaPeopleSource, peopleSourceProfiles } from "./people-repository.js"
import { planPeopleLegislativeTerms } from "./people-term-plan.js"

const retrievedAt = new Date("2026-09-14T00:00:00Z")
function files(roles: unknown[], directory = "retired") {
  return [
    {
      path: `data/nc/${directory}/person.yml`,
      content: JSON.stringify({
        id: "ocd-person/test",
        name: "Test",
        roles
      })
    }
  ]
}
const role = { type: "upper", district: "1", jurisdiction: northCarolinaPeopleSource.jurisdiction }
describe("source legislative term plan", () => {
  it("plans Alaska source terms without copying NC jurisdiction or inventing missing starts", () => {
    const input = files([
      { ...role, jurisdiction: peopleSourceProfiles.ak.jurisdiction, district: "A", end_date: "2020-01-01" }
    ]).map((file) => ({ ...file, path: file.path.replace("/nc/", "/ak/") }))
    const result = planPeopleLegislativeTerms(input, retrievedAt, "ak")
    expect(result.terms[0]).toMatchObject({
      jurisdictionId: "jurisdiction:ak",
      district: "A",
      startDate: null,
      endDate: "2020-01-01",
      isActive: false
    })
    expect(result.terms[0]?.sourceUrl).toContain("/data/ak/retired/")
    expect(() => planPeopleLegislativeTerms(input, retrievedAt, "nc")).toThrow("source path")
  })
  it("preserves unknown starts and separate returns without assigning historical party", () => {
    const result = planPeopleLegislativeTerms(
      files([
        { ...role, end_date: "2010-01-01" },
        { ...role, start_date: "2015-01-01", end_date: "2020-01-01" }
      ]),
      retrievedAt
    )
    expect(result.terms).toHaveLength(2)
    expect(result.terms[0]?.startDate).toBeNull()
    expect(result.terms[0]?.party).toBeNull()
    expect(result.terms[0]?.id).not.toBe(result.terms[1]?.id)
    expect(result.canonicalWrites).toBe(false)
  })
  it("keeps identity when an open term ends and its file moves to retired", () => {
    const open = planPeopleLegislativeTerms(files([{ ...role, start_date: "2020-01-01" }], "legislature"), retrievedAt)
    const ended = planPeopleLegislativeTerms(
      files([{ ...role, start_date: "2020-01-01", end_date: "2025-01-01" }]),
      retrievedAt
    )
    expect(open.terms[0]?.id).toBe(ended.terms[0]?.id)
    expect(ended.terms[0]?.isActive).toBe(false)
  })
  it("rejects indistinguishable unknown-start terms and partial dates", () => {
    expect(() =>
      planPeopleLegislativeTerms(
        files([
          { ...role, end_date: "2010-01-01" },
          { ...role, end_date: "2020-01-01" }
        ]),
        retrievedAt
      )
    ).toThrow("Ambiguous")
    expect(() =>
      planPeopleLegislativeTerms(files([{ ...role, start_date: "2010", end_date: "2020" }]), retrievedAt)
    ).toThrow("review")
  })
})
