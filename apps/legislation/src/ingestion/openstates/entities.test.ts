import { describe, expect, it } from "vitest"
import { normalizeOpenStatesCommittees, normalizeOpenStatesPeople } from "./entities.js"

const context = { jurisdictionCode: "ak" }

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
})
