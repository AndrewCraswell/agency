import { describe, expect, it } from "vitest"
import { planCommitteeDependencies } from "./committee-dependencies.js"
import { inventoryCommitteeHistory } from "./committee-history.js"

function inventory(rows: Array<{ id: string; members: Array<string | null>; parent?: string }>) {
  return inventoryCommitteeHistory(
    rows.map((row) => ({
      path: `data/ak/committees/${row.id}.yml`,
      content: JSON.stringify({
        id: `ocd-organization/${row.id}`,
        name: row.id,
        classification: "committee",
        chamber: "upper",
        parent: row.parent,
        members: row.members.map((id) => ({
          name: "Same name",
          role: "member",
          person_id: id === null ? null : `ocd-person/${id}`
        }))
      })
    })),
    "a".repeat(40),
    "2026-09-15T00:00:00Z",
    "ak"
  )
}

describe("committee dependency plan", () => {
  it("holds the whole affected roster while permitting unrelated committees", () => {
    const source = inventory([
      { id: "held", members: ["good", "bad"] },
      { id: "ready", members: ["good"] }
    ])
    const result = planCommitteeDependencies(source, ["ocd-person/good"])
    expect(result.eligible).toHaveLength(1)
    expect(result.held[0]?.members).toHaveLength(2)
    expect(result.eligibleMemberships).toBe(1)
    expect(result.heldMemberships).toBe(2)
    expect(result.identityEligible).toHaveLength(2)
    expect(result.departuresEstablished).toBe(false)
    expect(planCommitteeDependencies(source, ["ocd-person/good", "ocd-person/bad"]).held).toEqual([])
  })
  it("propagates parent holds regardless of order and refuses missing parents and cycles", () => {
    const rows = [
      { id: "child", members: ["good"], parent: "ocd-organization/held" },
      { id: "held", members: [null] },
      { id: "orphan", members: [], parent: "ocd-organization/missing" },
      { id: "cycle", members: [], parent: "ocd-organization/cycle" }
    ]
    const result = planCommitteeDependencies(inventory(rows), ["ocd-person/good"])
    expect(result.eligible).toEqual([])
    expect(result.identityEligible.map((row) => row.committeeId)).toEqual([
      "ocd-organization/child",
      "ocd-organization/held"
    ])
    expect(result.identityHeld).toHaveLength(2)
    expect(result.held.flatMap((row) => row.reasons)).toEqual(
      expect.arrayContaining(["held_parent", "missing_parent", "parent_cycle", "unaccepted_person"])
    )
    expect(planCommitteeDependencies(inventory([...rows].reverse()), ["ocd-person/good"])).toEqual(result)
  })
})
