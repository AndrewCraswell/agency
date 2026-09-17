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
      expect(
        result.snapshot.organizations.find((organization) => organization.sourceId === "ocd-organization/ready")
      ).toMatchObject({
        chamber: "lower",
        membershipRelationsComplete: true,
        childRelationsComplete: false,
        detailFactsComplete: false,
        websiteUrl: "https://legislature.example/committee"
      })
      expect(
        result.snapshot.organizations.find((organization) => organization.sourceId === "ocd-organization/held")
      ).toMatchObject({ membershipRelationsComplete: false })
      expect(result.snapshot.people).toEqual([])
      expect(result.snapshot.terms).toEqual([])
      expect(result.snapshot.memberships).toHaveLength(1)
      expect(result.snapshot.memberships[0]?.effectiveStartDate).toBeUndefined()
      expect(result.snapshot.memberships[0]?.detectedStartDate).toBe("2026-09-15")
      expect(result.snapshot.memberships[0]?.lastObservedDate).toBe("2026-09-15")
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
  it("links a complete current roster while holding ambiguous historical terms", () => {
    const people = ["lower", "upper"].flatMap((chamber) =>
      Array.from({ length: chamber === "lower" ? 120 : 50 }, (_, index) => ({
        path: `data/nc/legislature/${chamber}-${index}.yml`,
        content: JSON.stringify({
          id: `ocd-person/${chamber}-${index}`,
          name: `Person ${chamber} ${index}`,
          roles:
            chamber === "lower" && index === 0
              ? [
                  {
                    type: chamber,
                    district: "1",
                    jurisdiction: peopleSourceProfiles.nc.jurisdiction,
                    start_date: "2025-01-01"
                  },
                  {
                    type: chamber,
                    district: "1",
                    jurisdiction: peopleSourceProfiles.nc.jurisdiction,
                    start_date: "2025-01-01",
                    end_date: "2025-01-01"
                  }
                ]
              : [
                  {
                    type: chamber,
                    district: String(index + 1),
                    jurisdiction: peopleSourceProfiles.nc.jurisdiction
                  }
                ]
        })
      }))
    )
    const committee = {
      path: "data/nc/committees/current.yml",
      content: JSON.stringify({
        id: "ocd-organization/current",
        name: "Current",
        classification: "committee",
        chamber: "lower",
        jurisdiction: peopleSourceProfiles.nc.jurisdiction,
        members: [{ person_id: "ocd-person/lower-0", name: "Person lower 0", role: "member" }]
      })
    }
    const result = prepareCommitteeRepositoryImport([...people, committee], [], now, "nc")
    expect(result.plan.held).toEqual([])
    expect(result.plan.eligible).toHaveLength(1)
    expect(result.snapshot.memberships).toHaveLength(1)
  })
  it("uses the guarded atomic writer and records the observed current roster date", async () => {
    const persist = vi.fn<typeof replaceEntitySnapshot>().mockResolvedValue(undefined)
    const database = drizzle({ connection: "postgresql://unused", schema })
    await importCommitteeRepository(database, "ak", files("ak"), [], now, persist)
    expect(persist).toHaveBeenCalledWith(
      database,
      "jurisdiction:ak",
      expect.any(Object),
      expect.objectContaining({
        replacePeople: false,
        membershipDetectionDate: "2026-09-15",
        preserveUnobservedOrganizations: true,
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
