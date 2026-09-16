import { describe, expect, it } from "vitest"
import {
  canonicalCivicFoundationRecordSchema,
  isMembershipCivicFoundationComplete,
  isOrganizationCivicFoundationComplete,
  isPersonCivicFoundationComplete,
  isTermCivicFoundationComplete
} from "./civic-foundation.js"

const source = {
  isOfficial: true,
  provider: "official-legislature",
  retrievedAt: "2026-08-24T12:00:00.000Z",
  sourceUpdatedAt: null,
  url: "https://legislature.example.test/civic"
}

const provenance = {
  provenanceComplete: true,
  sourceIsOfficial: true,
  sourceProvider: "official-legislature",
  sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
  sourceUrl: "https://legislature.example.test/civic"
}

describe("canonical civic foundation", () => {
  it("accepts only explicit canonical organization parents and vocabulary values", () => {
    expect(
      canonicalCivicFoundationRecordSchema.parse({
        chamber: "lower",
        classification: "commission",
        id: "organization:official:ethics",
        isActive: true,
        jurisdictionId: "jurisdiction:example",
        kind: "organization",
        name: "Ethics Commission",
        parentOrganizationId: "organization:official:house",
        source
      })
    ).toMatchObject({ chamber: "lower", classification: "commission" })
    for (const classification of ["agency", "other"] as const) {
      expect(
        canonicalCivicFoundationRecordSchema.parse({
          chamber: null,
          classification,
          id: `organization:official:${classification}`,
          isActive: true,
          jurisdictionId: "jurisdiction:example",
          kind: "organization",
          name: classification,
          parentOrganizationId: null,
          source
        })
      ).toMatchObject({ classification })
    }
    expect(() =>
      canonicalCivicFoundationRecordSchema.parse({
        chamber: "house",
        classification: "committee",
        id: "organization:official:committee",
        isActive: true,
        jurisdictionId: "jurisdiction:example",
        kind: "organization",
        name: "Example Committee",
        parentOrganizationId: "ocd-organization/house",
        source
      })
    ).toThrow("Invalid option")
    expect(() =>
      canonicalCivicFoundationRecordSchema.parse({
        chamber: "lower",
        classification: "committee",
        id: "organization:official:committee",
        isActive: true,
        jurisdictionId: "jurisdiction:example",
        kind: "organization",
        name: "Example Committee",
        parentOrganizationId: "ocd-organization/not-canonical",
        source
      })
    ).toThrow("organization ID must be canonical")
  })

  it("retains unknown organization classification as null instead of substituting a category", () => {
    expect(
      canonicalCivicFoundationRecordSchema.parse({
        chamber: null,
        classification: null,
        id: "organization:official:unknown",
        isActive: true,
        jurisdictionId: "jurisdiction:example",
        kind: "organization",
        name: "Unknown body",
        parentOrganizationId: null,
        source
      })
    ).toMatchObject({ chamber: null, classification: null })
  })

  it("requires explicit authoritative office and membership role facts", () => {
    expect(() =>
      canonicalCivicFoundationRecordSchema.parse({
        chamber: "lower",
        id: "person:official:example:term:1",
        isActive: true,
        jurisdictionId: "jurisdiction:example",
        kind: "term",
        organizationId: null,
        personId: "person:official:example",
        source
      })
    ).toThrow("Invalid input")
    expect(() =>
      canonicalCivicFoundationRecordSchema.parse({
        id: "organization:official:example:membership:1",
        isActive: true,
        kind: "membership",
        label: null,
        organizationId: "organization:official:example",
        personId: "person:official:example",
        source
      })
    ).toThrow("Invalid input")
  })

  it("fails closed for incomplete provenance and civic record facts", () => {
    expect(
      isPersonCivicFoundationComplete({
        ...provenance,
        isActive: true,
        jurisdictionId: "jurisdiction:example",
        name: "Example Person"
      })
    ).toBe(true)
    expect(
      isOrganizationCivicFoundationComplete({
        ...provenance,
        classification: null,
        chamber: null,
        isActive: true,
        name: "Unknown",
        parentOrganizationId: null,
        upstreamIds: {}
      })
    ).toBe(false)
    expect(
      isOrganizationCivicFoundationComplete({
        ...provenance,
        classification: "committee",
        chamber: null,
        isActive: true,
        name: "Unresolved parent",
        parentOrganizationId: null,
        upstreamIds: { openstatesParent: "ocd-organization/unknown" }
      })
    ).toBe(false)
    expect(
      isTermCivicFoundationComplete({
        ...provenance,
        chamber: "not-a-chamber",
        isActive: true,
        jurisdictionId: "jurisdiction:example",
        officeTitle: null,
        personId: "person:official:example"
      })
    ).toBe(false)
    expect(
      isMembershipCivicFoundationComplete({
        ...provenance,
        isActive: null,
        organizationId: "organization:official:example",
        personId: "person:official:example",
        role: null
      })
    ).toBe(false)
    expect(
      isTermCivicFoundationComplete({
        ...provenance,
        chamber: "lower",
        isActive: true,
        jurisdictionId: "jurisdiction:example",
        officeTitle: null,
        personId: "person:official:example"
      })
    ).toBe(false)
    expect(
      isMembershipCivicFoundationComplete({
        ...provenance,
        isActive: true,
        organizationId: "organization:official:example",
        personId: "person:official:example",
        role: null
      })
    ).toBe(false)
  })
})
