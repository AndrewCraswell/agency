import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { frMetadataPageSchema } from "./fr-metadata-contract.js"
import { projectFrSourceReferences } from "./fr-source-references.js"

const fixture = frMetadataPageSchema.parse(
  JSON.parse(await readFile(new URL("./fixtures/fr-2024-01-02-metadata.json", import.meta.url), "utf8"))
)
const record = fixture.results[0]
if (!record) {
  throw new Error("Source fixture is empty")
}
describe("Federal Register source references", () => {
  it("retains every source value from the official fixture without inventing organizations or actions", () => {
    for (const item of fixture.results) {
      const projected = projectFrSourceReferences(item)
      expect(projected.agencies.map((agency) => agency.evidence)).toEqual(item.agencies)
      expect(projected.rins.map((rin) => rin.rawValue)).toEqual(item.regulation_id_numbers)
      expect(projected.dockets.map((docket) => docket.rawValue)).toEqual(item.docket_ids)
      expect(
        projected.agencies.every((agency) => agency.reference === null || agency.reference.organizationId === null)
      ).toBe(true)
      expect([...projected.rins, ...projected.dockets].every((identifier) => identifier.actionId === null)).toBe(true)
      expect(projectFrSourceReferences(item).hash).toBe(projected.hash)
    }
  })
  it("keeps numeric publisher identity across name changes and never resolves it by name", () => {
    const original = projectFrSourceReferences({ ...record, agencies: [{ id: 42, raw_name: "Agency", parent_id: 4 }] })
    const renamed = projectFrSourceReferences({ ...record, agencies: [{ id: 42, raw_name: "New name", parent_id: 4 }] })
    expect(original.agencies[0]?.reference?.sourceAgencyId).toBe(renamed.agencies[0]?.reference?.sourceAgencyId)
    expect(renamed.agencies[0]).toMatchObject({
      sourceParentAgencyId: "fr-agency-4",
      reference: { organizationId: null, status: "unresolved" }
    })
  })
  it("does not merge same-name agencies without publisher IDs across documents", () => {
    const first = projectFrSourceReferences({ ...record, agencies: [{ raw_name: "Agency" }] })
    const second = projectFrSourceReferences({
      ...record,
      document_number: "2024-10000",
      agencies: [{ raw_name: "Agency" }]
    })
    expect(first.agencies[0]?.reference?.sourceAgencyId).not.toBe(second.agencies[0]?.reference?.sourceAgencyId)
    expect(first.agencies[0]?.identityBasis).toBe("document_occurrence")
  })
  it("retains missing names and blank identifiers as explicit unusable source evidence", () => {
    const projected = projectFrSourceReferences({
      ...record,
      agencies: [{ raw_name: " " }],
      docket_ids: ["  "],
      regulation_id_numbers: [""]
    })
    expect(projected.agencies[0]).toMatchObject({
      reference: null,
      reason: "missing_source_agency_name",
      evidence: { raw_name: " " }
    })
    expect(projected.dockets[0]).toMatchObject({
      sourceReferenceId: null,
      rawValue: "  ",
      reason: "empty_source_identifier"
    })
  })
  it("scopes docket collisions to their document while a shared RIN remains only an alias", () => {
    const first = projectFrSourceReferences({
      ...record,
      docket_ids: ["  Docket-1  "],
      regulation_id_numbers: ["1234-AB01"]
    })
    const second = projectFrSourceReferences({
      ...record,
      document_number: "2024-10000",
      docket_ids: ["Docket-1"],
      regulation_id_numbers: ["1234-AB01"]
    })
    expect(first.dockets[0]?.sourceReferenceId).not.toBe(second.dockets[0]?.sourceReferenceId)
    expect(first.rins[0]?.sourceReferenceId).toBe(second.rins[0]?.sourceReferenceId)
    expect(first.dockets[0]).toMatchObject({ value: "Docket-1", rawValue: "  Docket-1  ", actionId: null })
  })
})
