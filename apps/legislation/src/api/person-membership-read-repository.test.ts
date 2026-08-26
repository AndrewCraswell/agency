import { describe, expect, it } from "vitest"
import { PersonMembershipsRepository } from "./person-membership-read-repository.js"

const input = {
  from: "2026-01-01",
  isCurrent: true,
  limit: 25,
  organizationId: "organization:us:house",
  personId: "person:us:example",
  to: "2026-12-31"
}

describe("PersonMembershipsRepository", () => {
  it("returns not_found for an absent parent before listing memberships", async () => {
    let listed = false
    const repository = new PersonMembershipsRepository({
      listPersonMemberships: async () => {
        listed = true
        return { items: [], truncated: false }
      },
      personExists: async () => false
    })

    await expect(repository.listPersonMemberships(input)).rejects.toMatchObject({ category: "not_found" })
    expect(listed).toBe(false)
  })

  it("forwards the complete parent-bound filter scope after confirming the parent", async () => {
    let received: unknown
    const page = { items: [], nextCursor: "person-membership-cursor", truncated: true }
    const repository = new PersonMembershipsRepository({
      listPersonMemberships: async (value) => {
        received = value
        return page
      },
      personExists: async (personId) => personId === input.personId
    })

    await expect(repository.listPersonMemberships(input)).resolves.toEqual(page)
    expect(received).toEqual(input)
  })
})
