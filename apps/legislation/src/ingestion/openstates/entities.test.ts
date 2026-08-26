import { describe, expect, it } from "vitest"
import { isOrganizationCivicFoundationComplete } from "../civic-foundation.js"
import { mergeOpenStatesEntitySnapshots, normalizeOpenStatesCommittees, normalizeOpenStatesPeople } from "./entities.js"

function organizationFoundationComplete(
  row: ReturnType<typeof normalizeOpenStatesCommittees>["organizations"][number]
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

const context = { jurisdictionCode: "ak", retrievedAt: new Date("2026-08-24T12:00:00.000Z") }

describe("Open States entity normalization", () => {
  it("normalizes current people and terms without inventing dates", () => {
    const result = normalizeOpenStatesPeople(
      [
        {
          current_role: {
            district: "14",
            division_id: "ocd-division/country:us/state:ak/sldl:14",
            org_classification: "lower",
            title: "Representative"
          },
          family_name: "Galvin",
          given_name: "Alyse",
          id: "ocd-person/example",
          name: "Alyse Galvin",
          openstates_url: "https://openstates.org/person/example/",
          party: "Independent",
          updated_at: "2025-03-29T00:02:10Z"
        }
      ],
      context
    )

    expect(result.people[0]).toMatchObject({
      id: "person:openstates:ocd-person-example",
      isActive: true,
      jurisdictionId: "jurisdiction:ak",
      sourceId: "ocd-person/example"
    })
    expect(result.terms[0]).toMatchObject({ chamber: "lower", district: "14", isActive: true })
    expect(result.terms[0]?.startDate).toBeUndefined()
    expect(result.terms[0]?.endDate).toBeUndefined()
    expect(result.personAliases).toEqual([])
  })

  it("retains only source-declared aliases with retrieval provenance", () => {
    const result = normalizeOpenStatesPeople(
      [
        {
          id: "ocd-person/alias-example",
          name: "Alexandra Example",
          openstates_url: "https://openstates.org/person/alias-example/",
          other_names: ["Alex Example", "Alex Example", "A. Example"],
          updated_at: "2026-08-20T15:00:00Z"
        },
        {
          id: "ocd-person/missing-source",
          name: "No Source",
          other_names: ["Unverified Alias"]
        }
      ],
      context
    )

    expect(result.personAliases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Alex Example",
          personId: "person:openstates:ocd-person-alias-example",
          provenanceComplete: true,
          sourceIdentity: "openstates:ocd-person/alias-example:other-name:Alex Example",
          sourceProvider: "openstates",
          sourceUrl: "https://openstates.org/person/alias-example/"
        }),
        expect.objectContaining({
          name: "Unverified Alias",
          personId: "person:openstates:ocd-person-missing-source",
          provenanceComplete: false,
          sourceUrl: undefined
        })
      ])
    )
    expect(result.personAliases.filter((alias) => alias.name === "Alex Example")).toHaveLength(1)
    expect(result.personAliases.find((alias) => alias.name === "Alex Example")).toHaveProperty(
      "sourceRetrievedAt",
      context.retrievedAt
    )
    expect(result.personAliasPersonIds).toEqual([
      "person:openstates:ocd-person-alias-example",
      "person:openstates:ocd-person-missing-source"
    ])
  })

  it("maps only source-backed person detail facts and identifier relationships", () => {
    const result = normalizeOpenStatesPeople(
      [
        {
          email: "representative@example.test",
          id: "ocd-person/detail-example",
          identifiers: [{ identifier: "A000001", scheme: "bioguide" }, { scheme: "missing-value" }],
          image: "https://images.example.test/detail-example.jpg",
          name: "Detail Example",
          links: [{ note: "Official website", url: "https://detail-example.example.test" }],
          openstates_url: "https://openstates.org/person/detail-example/",
          sources: [{ url: "https://legislature.example.test/members/detail-example" }],
          updated_at: "2026-08-20T15:00:00Z"
        }
      ],
      context
    )

    expect(result.personDetails).toEqual([
      expect.objectContaining({
        imageUrl: "https://images.example.test/detail-example.jpg",
        officialUrl: "https://detail-example.example.test",
        personId: "person:openstates:ocd-person-detail-example",
        provenanceComplete: true,
        publicEmail: "representative@example.test",
        sourceUrl: "https://legislature.example.test/members/detail-example"
      })
    ])
    expect(result.personExternalIdentifiers).toEqual([
      expect.objectContaining({ scheme: "bioguide", value: "A000001" })
    ])
    expect(result.personJurisdictions).toEqual([
      expect.objectContaining({
        jurisdictionId: "jurisdiction:ak",
        personId: "person:openstates:ocd-person-detail-example"
      })
    ])
  })

  it("normalizes committee snapshots and retains unresolved parent identity", () => {
    const result = normalizeOpenStatesCommittees(
      [
        {
          classification: "committee",
          id: "ocd-organization/committee",
          memberships: [
            {
              person: {
                current_role: { district: "20", org_classification: "lower", title: "Representative" },
                id: "ocd-person/member",
                name: "Andrew Gray",
                party: "Democratic"
              },
              person_name: "Andrew Gray",
              role: "co-chair"
            }
          ],
          name: "Armed Services",
          parent_id: "ocd-organization/lower"
        }
      ],
      context
    )

    expect(result.organizations[0]).toMatchObject({
      classification: "committee",
      upstreamIds: {
        openstates: "ocd-organization/committee",
        openstatesParent: "ocd-organization/lower"
      }
    })
    expect(result.people).toHaveLength(1)
    expect(result.terms).toHaveLength(1)
    expect(result.memberships[0]).toMatchObject({ isActive: true, role: "co-chair" })
    expect(result.memberships[0]?.classification).toBeUndefined()
    expect(result.memberships[0]?.title).toBeUndefined()
  })

  it("retains memberships without inventing a role when Open States omits one", () => {
    const result = normalizeOpenStatesCommittees(
      [
        {
          classification: "committee",
          id: "ocd-organization/roleless",
          memberships: [
            {
              person: {
                id: "ocd-person/roleless-member",
                name: "Roleless Member"
              }
            }
          ],
          name: "Roleless committee"
        }
      ],
      context
    )

    expect(result.memberships).toEqual([
      expect.objectContaining({
        role: undefined,
        sourceId: "ocd-organization/roleless:ocd-person/roleless-member"
      })
    ])
    expect(result.memberships[0]?.sourceId).not.toContain("member:member")
  })

  it("preserves detailed people and forwards their civic relationship collections", () => {
    const people = normalizeOpenStatesPeople(
      [
        {
          email: "detailed@example.test",
          family_name: "Detail",
          given_name: "Dana",
          id: "ocd-person/detailed-member",
          identifiers: [{ identifier: "D123", scheme: "provider" }],
          name: "Dana Detail",
          openstates_url: "https://openstates.org/person/detailed-member/",
          sources: [{ url: "https://legislature.example.test/members/dana-detail" }]
        }
      ],
      context
    )
    const committees = normalizeOpenStatesCommittees(
      [
        {
          classification: "committee",
          id: "ocd-organization/detail-committee",
          memberships: [
            {
              person: {
                id: "ocd-person/detailed-member",
                name: "Dana Detail"
              },
              role: "member"
            }
          ],
          name: "Detail committee"
        }
      ],
      context
    )

    const snapshot = mergeOpenStatesEntitySnapshots(people, committees)

    expect(snapshot.people).toEqual([
      expect.objectContaining({
        familyName: "Detail",
        givenName: "Dana",
        provenanceComplete: true,
        sourceUrl: "https://legislature.example.test/members/dana-detail"
      })
    ])
    expect(snapshot.personDetails).toEqual([
      expect.objectContaining({ personId: "person:openstates:ocd-person-detailed-member" })
    ])
    expect(snapshot.personExternalIdentifiers).toEqual([expect.objectContaining({ scheme: "provider", value: "D123" })])
    expect(snapshot.personJurisdictions).toEqual([
      expect.objectContaining({
        jurisdictionId: "jurisdiction:ak",
        personId: "person:openstates:ocd-person-detailed-member"
      })
    ])
  })

  it("leaves unmappable organization classifications and chambers unknown", () => {
    const people = normalizeOpenStatesPeople(
      [
        {
          current_role: { org_classification: "assembly", title: "Delegate" },
          id: "ocd-person/unknown-chamber",
          name: "Unknown Chamber"
        }
      ],
      context
    )
    const organizations = normalizeOpenStatesCommittees(
      [
        {
          classification: "task-force",
          id: "ocd-organization/unknown-classification",
          name: "Unknown classification"
        }
      ],
      context
    )

    expect(people.terms[0]?.chamber).toBeNull()
    expect(organizations.organizations[0]?.classification).toBeNull()
  })

  it("uses an explicit canonical FK only when the Open States parent is in the authoritative snapshot", () => {
    const result = normalizeOpenStatesCommittees(
      [
        {
          classification: "committee",
          id: "ocd-organization/parent",
          name: "Parent committee"
        },
        {
          classification: "subcommittee",
          id: "ocd-organization/child",
          name: "Child committee",
          parent_id: "ocd-organization/parent"
        }
      ],
      context
    )
    const child = result.organizations.find((organization) => organization.sourceId === "ocd-organization/child")

    expect(child).toMatchObject({ parentOrganizationId: "organization:openstates:ocd-organization-parent" })
    expect(child?.upstreamIds).not.toHaveProperty("openstatesParent")
  })

  it("persists only source-supplied organization detail facts and relationship completeness", () => {
    const result = normalizeOpenStatesCommittees(
      [
        {
          classification: "committee",
          contact: { email: "committee@example.test", phone: "555-0100" },
          description: "Reviews public safety proposals.",
          id: "ocd-organization/detailed",
          memberships: [],
          name: "Public Safety",
          sources: [{ url: "https://v3.openstates.org/organizations/ocd-organization/detailed" }],
          terms_of_reference: "Standing rules section 4.",
          website_url: "https://legislature.example.test/committees/public-safety"
        },
        {
          classification: "committee",
          id: "ocd-organization/summary-only",
          links: [{ note: "committee listing", url: "https://legislature.example.test/committees/summary-only" }],
          memberships: [],
          name: "Summary only"
        }
      ],
      context
    )

    const detailed = result.organizations.find((organization) => organization.sourceId === "ocd-organization/detailed")
    const summaryOnly = result.organizations.find(
      (organization) => organization.sourceId === "ocd-organization/summary-only"
    )

    expect(detailed).toMatchObject({
      childRelationsComplete: true,
      description: "Reviews public safety proposals.",
      detailFactsComplete: true,
      membershipRelationsComplete: true,
      publicContactAddress: null,
      publicContactEmail: "committee@example.test",
      publicContactPhone: "555-0100",
      termsOfReference: "Standing rules section 4.",
      websiteUrl: "https://legislature.example.test/committees/public-safety"
    })
    expect(summaryOnly).toMatchObject({
      detailFactsComplete: false,
      membershipRelationsComplete: true,
      websiteUrl: null
    })
    expect(detailed).toBeDefined()
    expect(summaryOnly).toBeDefined()
    expect(organizationFoundationComplete(detailed!)).toBe(true)
    expect(organizationFoundationComplete(summaryOnly!)).toBe(false)
  })
})
