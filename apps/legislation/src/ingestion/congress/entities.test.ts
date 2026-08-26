import { describe, expect, it } from "vitest"
import { isOrganizationCivicFoundationComplete } from "../civic-foundation.js"
import { normalizeCongressCommittees, normalizeCongressMemberDetails, normalizeCongressMembers } from "./entities.js"

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
      sourceIsOfficial: false,
      sourceProvider: "congress",
      sourceRetrievedAt: organizationContext.retrievedAt,
      sourceUrl: undefined
    })
    expect(result.terms[0]).toMatchObject({
      chamber: "upper",
      district: undefined,
      isActive: true,
      provenanceComplete: false,
      sourceIsOfficial: false,
      sourceProvider: "congress",
      sourceRetrievedAt: organizationContext.retrievedAt,
      sourceUrl: undefined
    })
  })

  it("fails closed for a non-Congress HTTPS member source URL", () => {
    const result = normalizeCongressMembers(
      [
        {
          bioguideId: "S001234",
          name: "Senator Example",
          terms: { item: [{ chamber: "Senate", startYear: 2025 }] },
          url: "https://example.test/member/S001234"
        }
      ],
      119,
      organizationContext
    )

    expect(result.people[0]).toMatchObject({ provenanceComplete: false, sourceIsOfficial: false })
    expect(result.terms[0]).toMatchObject({ provenanceComplete: false, sourceIsOfficial: false })
  })

  it("hydrates member profile and titled terms from the official detail record", () => {
    const result = normalizeCongressMemberDetails(
      [
        {
          detail: {
            bioguideId: "G000607",
            currentMember: true,
            depiction: { imageUrl: "https://api.congress.gov/image/G000607.jpg" },
            firstName: "James",
            lastName: "Gallagher",
            officialUrl: "https://gallagher.house.gov/",
            terms: {
              item: [
                {
                  chamber: "House of Representatives",
                  congress: 118,
                  district: 8,
                  endYear: 2024,
                  memberType: "Representative",
                  partyName: "Republican",
                  startYear: 2023
                },
                {
                  chamber: "House of Representatives",
                  congress: 119,
                  district: 8,
                  memberType: "Representative",
                  partyName: "Republican",
                  startYear: 2025
                }
              ]
            },
            updateDate: "2026-08-17T07:40:45Z"
          },
          member: {
            bioguideId: "G000607",
            district: 8,
            name: "Gallagher, James",
            partyName: "Republican",
            terms: { item: [] },
            url: "https://api.congress.gov/member/G000607"
          }
        }
      ],
      119,
      organizationContext
    )

    expect(result.people).toEqual([
      expect.objectContaining({
        familyName: "Gallagher",
        givenName: "James",
        isActive: true,
        sourceUrl: "https://api.congress.gov/member/G000607"
      })
    ])
    expect(result.personDetails).toEqual([
      expect.objectContaining({
        imageUrl: "https://api.congress.gov/image/G000607.jpg",
        officialUrl: "https://gallagher.house.gov/",
        publicEmail: null,
        sourceProvider: "congress"
      })
    ])
    expect(result.personJurisdictions).toEqual([
      expect.objectContaining({
        jurisdictionId: "jurisdiction:us",
        sourceIdentity: "congress:G000607:jurisdiction:us"
      })
    ])
    expect(result.terms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          isActive: false,
          officeTitle: "Representative",
          role: "Representative",
          sourceId: "118:lower:2023:2024"
        }),
        expect.objectContaining({ isActive: true, officeTitle: "Representative", role: "Representative" })
      ])
    )
    expect(result.terms.every((term) => term.startDate === undefined && term.endDate === undefined)).toBe(true)
    expect(result.termPersonIds).toEqual(["person:congress:g000607"])
  })

  it("rejects a detail term that omits its published member type", () => {
    expect(() =>
      normalizeCongressMemberDetails(
        [
          {
            detail: {
              bioguideId: "G000607",
              currentMember: true,
              terms: { item: [{ chamber: "House", congress: 119, startYear: 2025 }] }
            },
            member: {
              bioguideId: "G000607",
              name: "Gallagher, James",
              terms: { item: [] },
              url: "https://api.congress.gov/member/G000607"
            }
          }
        ],
        119,
        organizationContext
      )
    ).toThrow(/memberType/)
  })

  it("rejects a detail term whose chamber cannot be normalized", () => {
    expect(() =>
      normalizeCongressMemberDetails(
        [
          {
            detail: {
              bioguideId: "G000607",
              currentMember: true,
              terms: {
                item: [{ chamber: "Joint", congress: 119, memberType: "Representative", startYear: 2025 }]
              }
            },
            member: {
              bioguideId: "G000607",
              name: "Gallagher, James",
              terms: { item: [] },
              url: "https://api.congress.gov/member/G000607"
            }
          }
        ],
        119,
        organizationContext
      )
    ).toThrow(/unmappable chamber/)
  })

  it("does not authorize term replacement from an untrusted member URL", () => {
    const result = normalizeCongressMemberDetails(
      [
        {
          detail: {
            bioguideId: "G000607",
            currentMember: true,
            terms: {
              item: [{ chamber: "House", congress: 119, memberType: "Representative", startYear: 2025 }]
            }
          },
          member: {
            bioguideId: "G000607",
            name: "Gallagher, James",
            terms: { item: [] },
            url: "https://example.test/member/G000607"
          }
        }
      ],
      119,
      organizationContext
    )

    expect(result.termPersonIds).toEqual([])
    expect(result.terms[0]).toMatchObject({ provenanceComplete: false, sourceIsOfficial: false })
  })

  it("rejects a detail update timestamp that is not an ISO datetime", () => {
    expect(() =>
      normalizeCongressMemberDetails(
        [
          {
            detail: {
              bioguideId: "G000607",
              currentMember: true,
              terms: { item: [] },
              updateDate: "not-a-date"
            },
            member: {
              bioguideId: "G000607",
              name: "Gallagher, James",
              terms: { item: [] },
              url: "https://api.congress.gov/member/G000607"
            }
          }
        ],
        119,
        organizationContext
      )
    ).toThrow(/Invalid ISO datetime/)
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

  it("fails closed for missing and non-Congress committee source URLs", () => {
    const result = normalizeCongressCommittees(
      [
        { chamber: "House", name: "Missing URL Committee", systemCode: "missing-url" },
        {
          chamber: "Senate",
          name: "Untrusted URL Committee",
          systemCode: "untrusted-url",
          url: "https://example.test/committee/untrusted-url"
        }
      ],
      organizationContext
    )

    expect(result.organizations.find((organization) => organization.sourceId === "missing-url")).toMatchObject({
      provenanceComplete: false,
      sourceIsOfficial: false
    })
    expect(result.organizations.find((organization) => organization.sourceId === "untrusted-url")).toMatchObject({
      provenanceComplete: false,
      sourceIsOfficial: false
    })
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
