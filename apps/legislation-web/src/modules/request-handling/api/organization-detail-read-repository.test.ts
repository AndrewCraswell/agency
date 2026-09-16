import { describe, expect, it } from "vitest"
import type { OrganizationDetailOrganizationRow } from "../../legislation/persistence/queries/organization-detail-read"
import { projectOrganizationDetailRead } from "./organization-detail-read-repository"

function organizationRow(
  overrides: Partial<OrganizationDetailOrganizationRow> = {}
): OrganizationDetailOrganizationRow {
  return {
    chamber: "lower",
    childRelationsComplete: true,
    classification: "committee",
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
    description: "Sets House rules.",
    detailFactsComplete: true,
    id: "organization:us:rules",
    isActive: true,
    jurisdictionId: "jurisdiction:us",
    membershipRelationsComplete: true,
    name: "Rules Committee",
    parentOrganizationId: "organization:us:house",
    provenanceComplete: true,
    publicContactAddress: "100 Capitol Way",
    publicContactEmail: "rules@example.test",
    publicContactPhone: null,
    sourceId: "HSRU00",
    sourceIsOfficial: true,
    sourceProvider: "congress",
    sourceRetrievedAt: new Date("2026-08-20T15:00:00.000Z"),
    sourceUpdatedAt: null,
    sourceUrl: "https://api.congress.gov/committee/house-rules/HSRU00",
    termsOfReference: "House Rule X.",
    updatedAt: new Date("2026-08-20T15:00:00.000Z"),
    upstreamIds: { congress: "HSRU00" },
    websiteUrl: "https://rules.house.gov/",
    ...overrides
  }
}

describe("organization detail read repository projection", () => {
  it("projects only persisted profile facts and bounded relationship continuation", () => {
    const detail = projectOrganizationDetailRead(
      {
        children: [
          organizationRow({
            id: "organization:us:rules:subcommittee",
            name: "Rules Subcommittee",
            parentOrganizationId: "organization:us:rules"
          })
        ],
        organization: organizationRow()
      },
      { items: [], nextCursor: "membership-cursor", truncated: true },
      "https://api.example.test",
      2
    )

    expect(detail).toMatchObject({
      childPageInfo: { memberships: { limit: 2, nextCursor: "membership-cursor", truncated: true } },
      children: [{ id: "organization:us:rules:subcommittee", type: "organization" }],
      contact: { address: "100 Capitol Way", email: "rules@example.test", phone: null },
      description: "Sets House rules.",
      termsOfReference: "House Rule X.",
      websiteUrl: "https://rules.house.gov/"
    })
  })

  it("does not emit an empty fabricated contact object", () => {
    const detail = projectOrganizationDetailRead(
      { children: [], organization: organizationRow({ publicContactAddress: null, publicContactEmail: null }) },
      { items: [], truncated: false },
      "https://api.example.test",
      25
    )

    expect(detail.contact).toBeNull()
  })

  it("suppresses public contact from a nonofficial profile source", () => {
    const detail = projectOrganizationDetailRead(
      {
        children: [],
        organization: organizationRow({
          publicContactAddress: "100 Capitol Way",
          publicContactEmail: "rules@example.test",
          publicContactPhone: "555-0100",
          sourceIsOfficial: false,
          sourceProvider: "openstates",
          sourceUrl: "https://v3.openstates.org/organizations/ocd-organization/rules"
        })
      },
      { items: [], truncated: false },
      "https://api.example.test",
      25
    )

    expect(detail.contact).toBeNull()
  })
})
