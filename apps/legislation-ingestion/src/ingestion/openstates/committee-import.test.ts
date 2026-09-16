import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import { describe, expect, it, vi } from "vitest"
import type { replaceEntitySnapshot } from "../../persistence/entities.js"
import { importCommitteeRepository, prepareCommitteeRepositoryImport } from "./committee-import.js"
import { peopleSourceProfiles } from "./people-repository.js"

const now = new Date("2026-09-15T00:00:00Z")
function files(state: "ak" | "nc") {
  return [
    {
      path: `data/${state}/legislature/person.yml`,
      content: JSON.stringify({
        id: "ocd-person/known",
        name: "Known person",
        roles: [{ type: "lower", district: "1", jurisdiction: peopleSourceProfiles[state].jurisdiction }]
      })
    },
    ...["ready", "held"].map((id) => ({
      path: `data/${state}/committees/${id}.yml`,
      content: JSON.stringify({
        id: `ocd-organization/${id}`,
        name: id,
        classification: "committee",
        chamber: "lower",
        links: [{ note: "homepage", url: "https://legislature.example/committee" }],
        members: [
          { person_id: `ocd-person/${id === "ready" ? "known" : "unknown"}`, name: "Known person", role: "member" }
        ]
      })
    }))
  ]
}
describe("committee repository observation import", () => {
  it.each(["ak", "nc"] as const)(
    "reuses canonical normalization without inferred dates or people writes for %s",
    (state) => {
      const result = prepareCommitteeRepositoryImport(files(state), [], now, state)
      expect(result.plan.held).toHaveLength(1)
      expect(result.snapshot.organizations).toHaveLength(2)
      expect(result.snapshot.organizations[0]).toMatchObject({
        chamber: "lower",
        membershipRelationsComplete: false,
        childRelationsComplete: false,
        detailFactsComplete: false,
        websiteUrl: "https://legislature.example/committee"
      })
      expect(result.snapshot.people).toEqual([])
      expect(result.snapshot.terms).toEqual([])
      expect(result.snapshot.memberships).toHaveLength(1)
      expect(result.snapshot.memberships[0]?.effectiveStartDate).toBeUndefined()
      expect(result.snapshot.memberships[0]?.detectedStartDate).toBeUndefined()
      expect(prepareCommitteeRepositoryImport([...files(state)].reverse(), [], now, state).snapshot).toEqual(
        result.snapshot
      )
    }
  )
  it("persists identity-only observations when every roster is held", async () => {
    const input = files("ak").filter((file) => file.path.endsWith("held.yml"))
    const result = prepareCommitteeRepositoryImport(input, [], now, "ak")
    expect(result.snapshot.organizations).toHaveLength(1)
    expect(result.snapshot.memberships).toEqual([])
    expect(result.snapshot.organizations[0]?.membershipRelationsComplete).toBe(false)
    const persist = vi.fn<typeof replaceEntitySnapshot>().mockResolvedValue(undefined)
    const database = drizzle({ connection: "postgresql://unused", schema })
    await importCommitteeRepository(database, "ak", input, [], now, persist)
    expect(persist).toHaveBeenCalledOnce()
  })
  it("uses the guarded atomic writer and keeps the checkpoint incomplete", async () => {
    const persist = vi.fn<typeof replaceEntitySnapshot>().mockResolvedValue(undefined)
    const database = drizzle({ connection: "postgresql://unused", schema })
    await importCommitteeRepository(database, "ak", files("ak"), [], now, persist)
    expect(persist).toHaveBeenCalledWith(
      database,
      "jurisdiction:ak",
      expect.any(Object),
      expect.objectContaining({
        replacePeople: false,
        organizationObservationOnly: true,
        statementTimeoutMs: 30000,
        checkpoint: expect.objectContaining({ cursor: expect.objectContaining({ complete: false }) })
      })
    )
    persist.mockRejectedValueOnce(new Error("database failure"))
    await expect(importCommitteeRepository(database, "ak", files("ak"), [], now, persist)).rejects.toThrow(
      "database failure"
    )
  })
})
