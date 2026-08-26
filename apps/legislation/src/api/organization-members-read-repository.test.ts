import { describe, expect, it } from "vitest"
import { LegislationError } from "../legislation/errors.js"
import { OrganizationMembersRepository } from "./organization-members-read-repository.js"

const input = {
  from: "2026-01-01",
  isCurrent: true,
  limit: 25,
  organizationId: "organization:us:house",
  role: "member",
  to: "2026-12-31"
}

describe("OrganizationMembersRepository", () => {
  it("returns not_found for an absent parent before listing memberships", async () => {
    let listed = false
    const repository = new OrganizationMembersRepository({
      listOrganizationMemberships: async () => {
        listed = true
        return { items: [], truncated: false }
      },
      organizationExists: async () => false
    })

    await expect(repository.listOrganizationMembers(input)).rejects.toMatchObject({
      category: "not_found"
    } satisfies Partial<LegislationError>)
    expect(listed).toBe(false)
  })

  it("forwards the complete parent-bound filter scope after confirming the parent", async () => {
    let received: unknown
    const page = { items: [], nextCursor: "member-cursor", truncated: true }
    const repository = new OrganizationMembersRepository({
      listOrganizationMemberships: async (value) => {
        received = value
        return page
      },
      organizationExists: async (organizationId) => organizationId === input.organizationId
    })

    await expect(repository.listOrganizationMembers(input)).resolves.toEqual(page)
    expect(received).toEqual(input)
  })
})
