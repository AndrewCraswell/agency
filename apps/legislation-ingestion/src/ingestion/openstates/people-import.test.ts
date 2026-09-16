import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import { describe, expect, it, vi } from "vitest"
import type { replaceEntitySnapshot } from "../../persistence/entities.js"
import { importPeopleRepository, preparePeopleRepositoryImport } from "./people-import.js"
import { northCarolinaPeopleSource } from "./people-repository.js"

const now = new Date("2026-09-14T00:00:00Z")
const current = ["lower", "upper"].flatMap((type) =>
  Array.from({ length: type === "lower" ? 120 : 50 }, (_, i) => ({
    path: `data/nc/legislature/${type}-${i}.yml`,
    content: JSON.stringify({
      id: `ocd-person/${type}-${i}`,
      name: `Person ${type} ${i}`,
      roles: [
        {
          type,
          district: String(i + 1),
          jurisdiction: northCarolinaPeopleSource.jurisdiction
        }
      ]
    })
  }))
)
current.push({
  path: "data/nc/committees/test.yml",
  content: JSON.stringify({
    id: "ocd-organization/test",
    name: "Test",
    classification: "committee",
    chamber: "lower",
    jurisdiction: northCarolinaPeopleSource.jurisdiction,
    members: []
  })
})
const retired = [
  {
    path: "data/nc/retired/test.yml",
    content: JSON.stringify({
      id: "ocd-person/retired",
      name: "Retired",
      roles: [
        { type: "upper", district: "1", jurisdiction: northCarolinaPeopleSource.jurisdiction, end_date: "2010-01-01" }
      ]
    })
  }
]
describe("people history import", () => {
  it("retains legislative service from people now in other offices without importing those offices", () => {
    const former = [
      {
        path: "data/nc/executive/former.yml",
        content: JSON.stringify({
          id: "ocd-person/former-legislator",
          name: "Former legislator",
          roles: [
            {
              type: "upper",
              district: "1",
              jurisdiction: northCarolinaPeopleSource.jurisdiction,
              end_date: "2023-01-01"
            },
            { type: "attorney general", jurisdiction: northCarolinaPeopleSource.jurisdiction, start_date: "2025-01-01" }
          ]
        })
      }
    ]
    const result = preparePeopleRepositoryImport(current, former, now)
    expect(result.counts).toEqual({ people: 171, terms: 171 })
    expect(result.snapshot?.people.find((person) => person.sourceId === "ocd-person/former-legislator")?.isActive).toBe(
      false
    )
    expect(result.snapshot?.terms.filter((term) => term.endDate === "2023-01-01")).toHaveLength(1)
  })
  it("preserves source-declared former identities without name matching", () => {
    const historical = [
      {
        ...retired[0]!,
        content: JSON.stringify({
          id: "ocd-person/retired",
          name: "Retired",
          other_identifiers: [{ scheme: "openstates", identifier: "ocd-person/former-source-id" }],
          roles: [
            {
              type: "upper",
              district: "1",
              jurisdiction: northCarolinaPeopleSource.jurisdiction,
              end_date: "2010-01-01"
            }
          ]
        })
      }
    ]
    const result = preparePeopleRepositoryImport(current, historical, now)
    expect(result.snapshot?.personExternalIdentifiers).toEqual(
      expect.arrayContaining([expect.objectContaining({ scheme: "openstates", value: "ocd-person/former-source-id" })])
    )
  })
  it("prepares current and retired people without committee writes", () => {
    const result = preparePeopleRepositoryImport(current, retired, now)
    expect(result.counts).toEqual({ people: 171, terms: 171 })
    expect(result.snapshot?.organizations).toEqual([])
    expect(result.snapshot?.memberships).toEqual([])
    expect(result.snapshot?.people.find((person) => person.sourceId === "ocd-person/retired")?.isActive).toBe(false)
  })
  it("persists only observed people from an incomplete roster without claiming completion", async () => {
    const persist = vi.fn<typeof replaceEntitySnapshot>()
    const database = drizzle("postgresql://localhost/not-used", { schema })
    const result = await importPeopleRepository(database, "nc", current.slice(1), retired, now, persist)
    expect(result.status).toBe("partially_imported")
    expect(persist).toHaveBeenCalledWith(
      database,
      "jurisdiction:nc",
      expect.any(Object),
      expect.objectContaining({
        preserveUnobservedPeople: true,
        replaceOrganizations: false,
        checkpoint: expect.objectContaining({ cursor: expect.objectContaining({ complete: false }) })
      })
    )
  })
  it("commits through the atomic writer with history and absence safeguards", async () => {
    const persist = vi.fn<typeof replaceEntitySnapshot>(async () => undefined)
    const database = drizzle("postgresql://localhost/not-used", { schema })
    const result = await importPeopleRepository(database, "nc", current, retired, now, persist)
    expect(result.status).toBe("imported")
    expect(persist).toHaveBeenCalledWith(
      database,
      "jurisdiction:nc",
      expect.any(Object),
      expect.objectContaining({
        preserveUnobservedPeople: true,
        protectTermHistory: true,
        replaceOrganizations: false,
        checkpoint: expect.objectContaining({ stream: "nc-people-history" })
      })
    )
  })
})
