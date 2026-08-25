import { describe, expect, it } from "vitest"
import type { OrganizationMembershipRead } from "../db/queries/civic-scoped-reads.js"
import { LegislationError } from "../legislation/errors.js"
import { projectOrganizationMembershipRead } from "./membership-read-projection.js"

function sourceFields() {
  return {
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
    provenanceComplete: true,
    sourceIsOfficial: true,
    sourceProvider: "congress",
    sourceRetrievedAt: new Date("2026-08-20T15:00:00.000Z"),
    sourceUpdatedAt: new Date("2026-08-20T14:00:00.000Z"),
    sourceUrl: "https://api.congress.gov/v3/member/example",
    updatedAt: new Date("2026-08-20T15:00:00.000Z")
  } as const
}

function membership(): OrganizationMembershipRead {
  return {
    membership: {
      ...sourceFields(),
      endDate: null,
      id: "membership:us:house:1",
      isActive: true,
      label: "Member",
      organizationId: "organization:us:house",
      personId: "person:us:example",
      role: "member",
      startDate: "2025-01-03"
    },
    organization: {
      ...sourceFields(),
      chamber: "lower",
      classification: "chamber",
      id: "organization:us:house",
      isActive: true,
      jurisdictionId: "jurisdiction:us",
      name: "House of Representatives",
      parentOrganizationId: null
    },
    person: {
      ...sourceFields(),
      familyName: "Example",
      givenName: "Alex",
      id: "person:us:example",
      isActive: true,
      jurisdictionId: "jurisdiction:us",
      name: "Alex Example",
      party: null
    }
  }
}

describe("projectOrganizationMembershipRead", () => {
  it("preserves the canonical membership and embedded person and organization", () => {
    expect(projectOrganizationMembershipRead(membership(), "https://api.example.test")).toMatchObject({
      canonicalUrl:
        "https://api.example.test/api/organizations/organization%3Aus%3Ahouse/memberships/membership%3Aus%3Ahouse%3A1",
      organization: {
        canonicalUrl: "https://api.example.test/api/organizations/organization%3Aus%3Ahouse",
        type: "organization"
      },
      person: { canonicalUrl: "https://api.example.test/api/people/person%3Aus%3Aexample", type: "person" },
      type: "membership"
    })
  })

  it.each([
    [
      "membership",
      (value: OrganizationMembershipRead) => ({
        ...value,
        membership: { ...value.membership, provenanceComplete: false }
      })
    ],
    ["person", (value: OrganizationMembershipRead) => ({ ...value, person: { ...value.person, sourceUrl: null } })],
    [
      "organization",
      (value: OrganizationMembershipRead) => ({
        ...value,
        organization: { ...value.organization, sourceProvider: null }
      })
    ]
  ])("fails closed when %s provenance is incomplete", (_name, mutate) => {
    expect(() => projectOrganizationMembershipRead(mutate(membership()), "https://api.example.test")).toThrow(
      LegislationError
    )
  })

  it.each([
    [
      "chamber",
      (value: OrganizationMembershipRead) => ({ ...value, organization: { ...value.organization, chamber: "invalid" } })
    ],
    [
      "classification",
      (value: OrganizationMembershipRead) => ({
        ...value,
        organization: { ...value.organization, classification: "invalid" }
      })
    ]
  ])("rejects a noncanonical organization %s", (_name, mutate) => {
    expect(() => projectOrganizationMembershipRead(mutate(membership()), "https://api.example.test")).toThrow(
      LegislationError
    )
  })
})
