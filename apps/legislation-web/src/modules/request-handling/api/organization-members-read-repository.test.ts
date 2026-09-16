import { LegislationError } from "@repo/legislation-core/domain/errors"
import { describe, expect, it } from "vitest"
import { OrganizationMembersRepository } from "./organization-members-read-repository"

const input = {
  from: "2026-01-01",
  isCurrent: true,
  limit: 25,
  organizationId: "organization:us:house",
  role: "member",
  to: "2026-12-31"
}

describe("OrganizationMembersRepository", () => {
  it("retains historical coverage warnings on empty pages but not current-only requests", async () => {
    const warning = "GovInfo roster for session:us:117 is incomplete."
    let assessed = 0
    const repository = new OrganizationMembersRepository({
      organizationExists: async () => true,
      listOrganizationMemberships: async () => ({ items: [], truncated: false }),
      coverageWarnings: async (_organizationId, isCurrent) => {
        assessed += 1
        return isCurrent ? [] : [warning]
      }
    })
    expect(await repository.listOrganizationMembers({ ...input, isCurrent: false })).toMatchObject({
      warnings: [warning]
    })
    expect(await repository.listOrganizationMembers(input)).not.toHaveProperty("warnings")
    expect(assessed).toBe(2)
  })
  it("does not hide incomplete roster warnings on current-only pages", async () => {
    const warning = "Committee membership coverage is incomplete."
    const repository = new OrganizationMembersRepository({
      organizationExists: async () => true,
      listOrganizationMemberships: async () => ({ items: [], truncated: false }),
      coverageWarnings: async () => [warning]
    })
    expect(await repository.listOrganizationMembers(input)).toMatchObject({ warnings: [warning] })
  })
  it("returns not_found for an absent parent before listing memberships", async () => {
    let listed = false
    const repository = new OrganizationMembersRepository({
      coverageWarnings: async () => [],
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
      coverageWarnings: async () => [],
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
