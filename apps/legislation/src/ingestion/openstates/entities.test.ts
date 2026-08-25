import { describe, expect, it } from "vitest"
import { normalizeOpenStatesCommittees, normalizeOpenStatesPeople } from "./entities.js"

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
    expect(result.memberships[0]).toMatchObject({ classification: "co-chair", isActive: true })
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
})
