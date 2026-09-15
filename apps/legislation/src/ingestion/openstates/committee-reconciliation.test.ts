import { describe, expect, it } from "vitest"
import { reconcileNorthCarolinaCommittees } from "./committee-reconciliation.js"
const revision = "a".repeat(40)
const date = "2026-09-14T00:00:00Z"
const person = (id: string, former: string[] = []) => ({
  path: `data/nc/executive/${id}.yml`,
  content: JSON.stringify({
    id: `ocd-person/${id}`,
    name: "Same name",
    other_identifiers: former.map((identifier) => ({ scheme: "openstates", identifier })),
    roles: [
      {
        type: "upper",
        district: "1",
        jurisdiction: "ocd-jurisdiction/country:us/state:nc/government",
        end_date: "2023-01-01"
      }
    ]
  })
})
const committee = (ids: Array<string | null>) => [
  {
    path: "data/nc/committees/test.yml",
    content: JSON.stringify({
      id: "ocd-organization/test",
      name: "Test",
      classification: "committee",
      parent: "upper",
      members: ids.map((person_id) => ({ person_id, name: "Same name", role: "member" }))
    })
  }
]
describe("deterministic committee reconciliation", () => {
  it("resolves declared former IDs while retaining source evidence", () => {
    const result = reconcileNorthCarolinaCommittees(
      committee(["ocd-person/old"]),
      [person("new", ["ocd-person/old"])],
      revision,
      date
    )
    expect(result.status).toBe("resolved")
    expect(result.observations[0]?.members[0]).toMatchObject({
      sourcePersonId: "ocd-person/old",
      resolvedPersonId: "ocd-person/new"
    })
    expect(result.departuresEstablished).toBe(false)
  })
  it("quarantines missing and unknown IDs despite matching names", () => {
    const result = reconcileNorthCarolinaCommittees(
      committee([null, "ocd-person/unknown"]),
      [person("new")],
      revision,
      date
    )
    expect(result.unresolved.map((member) => member.reason)).toEqual(["missing_person_id", "unknown_person_id"])
  })
  it("never chooses between conflicting primary and former ID claims", () => {
    const result = reconcileNorthCarolinaCommittees(
      committee(["ocd-person/old"]),
      [person("old"), person("new", ["ocd-person/old"])],
      revision,
      date
    )
    expect(result.unresolved[0]?.reason).toBe("ambiguous_person_id")
    expect(result.resolvedMemberships).toBe(0)
  })
})
