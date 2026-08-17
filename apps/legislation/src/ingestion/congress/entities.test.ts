import { describe, expect, it } from "vitest"
import { normalizeCongressCommittees, normalizeCongressMembers } from "./entities.js"

describe("Congress entity normalization", () => {
  it("normalizes member identities and year-granularity terms without fabricating dates", () => {
    const result = normalizeCongressMembers(
      [
        {
          bioguideId: "G000607",
          district: 1,
          name: "Gallagher, James",
          partyName: "Republican",
          terms: { item: [{ chamber: "House of Representatives", startYear: 2026 }] },
          updateDate: "2026-08-17T07:40:45Z"
        }
      ],
      119
    )

    expect(result.people[0]).toMatchObject({ jurisdictionId: "jurisdiction:us", sourceId: "G000607" })
    expect(result.terms[0]).toMatchObject({ chamber: "lower", district: "1" })
    expect(result.terms[0]?.startDate).toBeUndefined()
    expect(result.terms[0]?.endDate).toBeUndefined()
  })

  it("accepts null optional fields returned by Congress.gov", () => {
    const result = normalizeCongressMembers(
      [
        {
          bioguideId: "S001234",
          district: null,
          name: "Senator Example",
          partyName: null,
          terms: { item: [{ chamber: "Senate", endYear: null, startYear: 2025 }] },
          updateDate: null,
          url: null
        }
      ],
      119
    )

    expect(result.people[0]).toMatchObject({ party: undefined, sourceId: "S001234" })
    expect(result.terms[0]).toMatchObject({ chamber: "upper", district: undefined, isActive: true })
  })

  it("creates legislature, chamber, committee, and subcommittee hierarchy", () => {
    const result = normalizeCongressCommittees([
      {
        chamber: "Senate",
        committeeTypeCode: "Standing",
        name: "Judiciary Committee",
        subcommittees: [{ name: "Antitrust Subcommittee", systemCode: "ssju01" }],
        systemCode: "ssju00",
        updateDate: "2026-08-10T11:51:27Z"
      }
    ])

    expect(result.organizations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ classification: "legislature", name: "United States Congress" }),
        expect.objectContaining({ classification: "chamber", name: "Senate" }),
        expect.objectContaining({ classification: "committee", sourceId: "ssju00" }),
        expect.objectContaining({
          classification: "subcommittee",
          parentOrganizationId: "organization:congress:ssju00"
        })
      ])
    )
  })
})
