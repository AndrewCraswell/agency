import { describe, expect, it } from "vitest"
import { SessionRepository } from "./session-read-repository.js"

const session = {
  classification: "regular",
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
  endDate: null,
  id: "session:wa:2025",
  identifier: "2025-2026",
  isActive: true,
  jurisdictionId: "jurisdiction:wa",
  name: "Regular Session",
  provenanceComplete: true,
  sourceIsOfficial: true,
  sourceProvider: "official-legislature",
  sourceRetrievedAt: new Date("2026-08-20T00:00:00.000Z"),
  sourceUpdatedAt: null,
  sourceUrl: "https://legislature.example.test/sessions/2025",
  startDate: "2025-01-01",
  updatedAt: new Date("2026-08-20T00:00:00.000Z")
} as const

describe("session read repository", () => {
  it("checks a jurisdiction before listing its sessions and forwards the full scope", async () => {
    const calls: unknown[] = []
    const repository = new SessionRepository({
      getSession: async () => session,
      jurisdictionExists: async (jurisdictionId) => {
        calls.push(["parent", jurisdictionId])
        return true
      },
      listJurisdictionSessions: async (input) => {
        calls.push(["list", input])
        return { items: [session], truncated: false }
      }
    })

    await repository.assertJurisdictionExists("jurisdiction:wa")
    await repository.listJurisdictionSessions({
      from: "2025-01-01",
      isActive: true,
      jurisdictionId: "jurisdiction:wa",
      limit: 10,
      to: "2025-12-31"
    })

    expect(calls).toEqual([
      ["parent", "jurisdiction:wa"],
      [
        "list",
        {
          from: "2025-01-01",
          isActive: true,
          jurisdictionId: "jurisdiction:wa",
          limit: 10,
          to: "2025-12-31"
        }
      ]
    ])
  })

  it("returns a not-found error for a missing session or jurisdiction", async () => {
    const repository = new SessionRepository({
      getSession: async () => undefined,
      jurisdictionExists: async () => false,
      listJurisdictionSessions: async () => ({ items: [], truncated: false })
    })

    await expect(repository.getSession("session:missing")).rejects.toMatchObject({ category: "not_found" })
    await expect(repository.assertJurisdictionExists("jurisdiction:missing")).rejects.toMatchObject({
      category: "not_found"
    })
  })
})
