import { describe, expect, it } from "vitest"
import type { OrganizationRow } from "../db/queries/organization-relationships.js"
import { projectOrganizationRow } from "./organization-summary-read-projection.js"

function organization(overrides: Partial<OrganizationRow> = {}): OrganizationRow {
  return {
    chamber: "lower",
    classification: "committee",
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
    id: "organization:ca:house:rules",
    isActive: true,
    jurisdictionId: "jurisdiction:ca",
    name: "Rules Committee",
    parentOrganizationId: "organization:ca:house",
    provenanceComplete: true,
    sourceId: "ca-rules",
    sourceIsOfficial: true,
    sourceProvider: "openstates",
    sourceRetrievedAt: new Date("2026-08-20T15:00:00.000Z"),
    sourceUpdatedAt: new Date("2026-08-20T14:00:00.000Z"),
    sourceUrl: "https://openstates.org/ca/organizations/rules",
    updatedAt: new Date("2026-08-20T15:00:00.000Z"),
    upstreamIds: { openstates: "ca-rules" },
    ...overrides
  }
}

describe("organization summary projection", () => {
  it("projects persisted canonical organization facts", () => {
    expect(projectOrganizationRow(organization(), "https://api.example.test", "jurisdiction:ca")).toMatchObject({
      canonicalUrl: "https://api.example.test/api/organizations/organization%3Aca%3Ahouse%3Arules",
      chamber: "lower",
      classification: "committee",
      isActive: true,
      jurisdictionId: "jurisdiction:ca",
      type: "organization"
    })
  })

  it.each([
    ["provenance", { provenanceComplete: false }, "canonical provenance"],
    ["activity", { isActive: null }, "organization isActive"],
    ["chamber", { chamber: "senate" }, "organization chamber"],
    ["classification", { classification: "district" }, "organization classification"]
  ])("rejects incomplete %s facts", (_name, overrides, message) => {
    expect(() => projectOrganizationRow(organization(overrides), "https://api.example.test")).toThrow(message)
  })

  it("rejects a row from another jurisdiction when a parent path is supplied", () => {
    expect(() =>
      projectOrganizationRow(
        organization({ jurisdictionId: "jurisdiction:ny" }),
        "https://api.example.test",
        "jurisdiction:ca"
      )
    ).toThrow("organization does not belong to its jurisdiction path")
  })
})
