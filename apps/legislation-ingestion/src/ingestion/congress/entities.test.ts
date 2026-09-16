import { describe, expect, it } from "vitest"
import { normalizeCongressMemberDetails, normalizeCongressMembers } from "./entities.js"

const organizationContext = { retrievedAt: new Date("2026-08-20T15:00:00.000Z") }

describe("Congress entity normalization", () => {
  it("does not assign career terms outside the requested Congress to that Congress", () => {
    const result = normalizeCongressMembers(
      [
        {
          bioguideId: "M000639",
          name: "Menendez, Robert",
          terms: {
            item: [
              { chamber: "House of Representatives", startYear: 1993, endYear: 2006 },
              { chamber: "Senate", startYear: 2006, endYear: 2024 },
              { chamber: "House of Representatives", startYear: 2026 }
            ]
          }
        }
      ],
      118,
      organizationContext
    )
    expect(result.people).toHaveLength(1)
    expect(result.terms).toHaveLength(1)
    expect(result.terms[0]).toMatchObject({ chamber: "upper", sourceId: "118:upper:2006:2024" })
  })

  it("retains year-only boundary terms rather than guessing their precise appointment dates", () => {
    const result = normalizeCongressMembers(
      [
        {
          bioguideId: "M000001",
          name: "Boundary Member",
          terms: {
            item: [
              { chamber: "House of Representatives", startYear: 2021, endYear: 2023 },
              { chamber: "Senate", startYear: 2025 }
            ]
          }
        }
      ],
      118,
      organizationContext
    )
    expect(result.terms.map((term) => term.sourceId)).toEqual(["118:lower:2021:2023", "118:upper:2025:current"])
    expect(result.terms.every((term) => term.startDate === undefined && term.endDate === undefined)).toBe(true)
  })

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

  it.each(["http://example.house.gov/", "https://example.house.gov/"])("preserves published website %s", (website) => {
    const result = normalizeCongressMemberDetails(
      [
        {
          member: { bioguideId: "G000607", name: "Gallagher, Mike" },
          detail: { bioguideId: "G000607", currentMember: false, officialWebsiteUrl: website }
        }
      ],
      118,
      organizationContext
    )
    expect(result.personDetails?.[0]?.officialUrl).toBe(website)
  })

  it.each(["javascript:alert(1)", "file:///etc/passwd", "ftp://example.test/file"])(
    "rejects unsafe website %s with member identity",
    (website) => {
      expect(() =>
        normalizeCongressMemberDetails(
          [
            {
              member: { bioguideId: "G000607", name: "Gallagher, Mike" },
              detail: { bioguideId: "G000607", currentMember: false, officialWebsiteUrl: website }
            }
          ],
          118,
          organizationContext
        )
      ).toThrow("Invalid Congress member detail for G000607")
    }
  )

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
            officialWebsiteUrl: "https://gallagher.house.gov/",
            terms: [
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
            ],
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

  it("accepts the current member detail terms array", () => {
    const result = normalizeCongressMemberDetails(
      [
        {
          detail: {
            bioguideId: "G000607",
            currentMember: true,
            terms: [
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

    expect(result.terms).toEqual([
      expect.objectContaining({
        district: "8",
        isActive: true,
        officeTitle: "Representative",
        sourceId: "119:lower:2025:current"
      })
    ])
  })

  it("retains only explicit source names and the exact Bioguide identity on replay", () => {
    const input = [
      {
        detail: {
          bioguideId: "S001208",
          currentMember: true,
          directOrderName: "Elissa Slotkin",
          invertedOrderName: "Slotkin, Elissa",
          firstName: "Elissa",
          lastName: "Slotkin"
        },
        member: { bioguideId: "S001208", name: "Slotkin, Elissa", url: "https://api.congress.gov/v3/member/S001208" }
      }
    ]
    const result = normalizeCongressMemberDetails(input, 119, organizationContext)
    expect(result.personAliases.map((alias) => alias.name)).toEqual(["Slotkin, Elissa", "Elissa Slotkin"])
    expect(result.personAliasPersonIds).toEqual(["person:congress:s001208"])
    expect(result.personExternalIdentifiers).toEqual([
      expect.objectContaining({
        personId: "person:congress:s001208",
        scheme: "bioguide",
        value: "S001208",
        provenanceComplete: true
      })
    ])
    expect(normalizeCongressMemberDetails(input, 119, organizationContext)).toEqual(result)
  })

  it("does not synthesize aliases from name components or accept untrusted alias evidence", () => {
    const detail = {
      bioguideId: "S001208",
      currentMember: true,
      firstName: "Elissa",
      lastName: "Slotkin",
      directOrderName: null,
      invertedOrderName: " "
    }
    const member = { bioguideId: "S001208", name: "Slotkin, Elissa", url: "https://api.congress.gov/v3/member/S001208" }
    expect(
      normalizeCongressMemberDetails([{ detail, member }], 119, organizationContext).personAliases.map(
        (alias) => alias.name
      )
    ).toEqual([member.name])
    const untrusted = normalizeCongressMemberDetails(
      [{ detail, member: { ...member, url: "https://example.test/member" } }],
      119,
      organizationContext
    )
    expect(untrusted.personAliases).toEqual([])
    expect(untrusted.personAliasPersonIds).toEqual([])
    expect(untrusted.personExternalIdentifiers).toEqual([])
  })

  it("rejects the obsolete member detail terms object wrapper", () => {
    expect(() =>
      normalizeCongressMemberDetails(
        [
          {
            detail: {
              bioguideId: "G000607",
              currentMember: true,
              terms: { item: [] }
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
    ).toThrow(/expected array/)
  })

  it("rejects a detail term that omits its published member type", () => {
    expect(() =>
      normalizeCongressMemberDetails(
        [
          {
            detail: {
              bioguideId: "G000607",
              currentMember: true,
              terms: [{ chamber: "House", congress: 119, startYear: 2025 }]
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
              terms: [{ chamber: "Joint", congress: 119, memberType: "Representative", startYear: 2025 }]
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
            terms: [{ chamber: "House", congress: 119, memberType: "Representative", startYear: 2025 }]
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
              terms: [],
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
})
