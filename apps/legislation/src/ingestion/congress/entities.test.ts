import { describe, expect, it } from "vitest"
import { isOrganizationCivicFoundationComplete } from "../civic-foundation.js"
import { normalizeCongressCommittees, normalizeCongressMembers } from "./entities.js"

function organizationFoundationComplete(
  row: ReturnType<typeof normalizeCongressCommittees>["organizations"][number]
): boolean {
  return isOrganizationCivicFoundationComplete({
    chamber: row.chamber ?? null,
    classification: row.classification ?? null,
    isActive: row.isActive ?? null,
    name: row.name,
    parentOrganizationId: row.parentOrganizationId ?? null,
    provenanceComplete: row.provenanceComplete ?? false,
    sourceIsOfficial: row.sourceIsOfficial ?? null,
    sourceProvider: row.sourceProvider ?? null,
    sourceRetrievedAt: row.sourceRetrievedAt ?? null,
    sourceUrl: row.sourceUrl ?? null,
    upstreamIds: row.upstreamIds ?? {}
  })
}

const organizationContext = { retrievedAt: new Date("2026-08-20T15:00:00.000Z") }

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
          updateDate: "2026-08-17T07:40:45Z",
          url: "https://api.congress.gov/member/G000607"
        }
      ],
      119,
      organizationContext
    )

    expect(result.people[0]).toMatchObject({
      jurisdictionId: "jurisdiction:us",
      provenanceComplete: true,
      sourceId: "G000607",
      sourceIsOfficial: true,
      sourceProvider: "congress",
      sourceRetrievedAt: organizationContext.retrievedAt,
      sourceUrl: "https://api.congress.gov/member/G000607"
    })
    expect(result.terms[0]).toMatchObject({
      chamber: "lower",
      district: "1",
      provenanceComplete: true,
      sourceIsOfficial: true,
      sourceProvider: "congress",
      sourceRetrievedAt: organizationContext.retrievedAt,
      sourceUrl: "https://api.congress.gov/member/G000607"
    })
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
      119,
      organizationContext
    )

    expect(result.people[0]).toMatchObject({
      party: undefined,
      provenanceComplete: false,
      sourceId: "S001234",
      sourceIsOfficial: true,
      sourceProvider: "congress",
      sourceRetrievedAt: organizationContext.retrievedAt,
      sourceUrl: undefined
    })
    expect(result.terms[0]).toMatchObject({
      chamber: "upper",
      district: undefined,
      isActive: true,
      provenanceComplete: false,
      sourceIsOfficial: true,
      sourceProvider: "congress",
      sourceRetrievedAt: organizationContext.retrievedAt,
      sourceUrl: undefined
    })
  })

  it("creates legislature, chamber, committee, and subcommittee hierarchy", () => {
    const result = normalizeCongressCommittees(
      [
        {
          chamber: "Senate",
          committeeTypeCode: "Standing",
          name: "Judiciary Committee",
          subcommittees: [{ name: "Antitrust Subcommittee", systemCode: "ssju01" }],
          systemCode: "ssju00",
          updateDate: "2026-08-10T11:51:27Z"
        }
      ],
      organizationContext
    )

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

  it("does not invent a Senate parent for an unmappable committee chamber", () => {
    const result = normalizeCongressCommittees(
      [
        {
          chamber: "Joint",
          name: "Joint Example Committee",
          systemCode: "joint-example"
        }
      ],
      organizationContext
    )
    const committee = result.organizations.find((organization) => organization.sourceId === "joint-example")

    expect(committee).toMatchObject({ chamber: null, parentOrganizationId: null })
  })

  it("persists provider-supplied committee profile facts without treating the source URL as a website", () => {
    const result = normalizeCongressCommittees(
      [
        {
          chamber: "House",
          contact: { address: "100 Capitol Way", email: "rules@example.test" },
          description: "Considers House rules.",
          name: "Rules Committee",
          subcommittees: [],
          systemCode: "hsru00",
          termsOfReference: "House Rule X.",
          url: "https://api.congress.gov/committee/house-rules/HSRU00",
          website: "https://rules.house.gov/"
        }
      ],
      organizationContext
    )
    const committee = result.organizations.find((organization) => organization.sourceId === "hsru00")

    expect(committee).toMatchObject({
      childRelationsComplete: true,
      description: "Considers House rules.",
      detailFactsComplete: true,
      membershipRelationsComplete: false,
      publicContactAddress: "100 Capitol Way",
      publicContactEmail: "rules@example.test",
      publicContactPhone: null,
      sourceUrl: "https://api.congress.gov/committee/house-rules/HSRU00",
      termsOfReference: "House Rule X.",
      websiteUrl: "https://rules.house.gov/"
    })
    expect(committee).toBeDefined()
    expect(organizationFoundationComplete(committee!)).toBe(true)
  })
})
