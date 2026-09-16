import { readFile } from "node:fs/promises"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import invariant from "tiny-invariant"
import { expect, it } from "vitest"
import { groupRegulatoryEvaluationPublications } from "./embedding-publication-families.js"
import { frMetadataPageSchema } from "./fr-metadata-contract.js"

const fixture = frMetadataPageSchema.parse(
  JSON.parse(await readFile(new URL("./fixtures/fr-2024-01-02-metadata.json", import.meta.url), "utf8"))
).results[0]
invariant(fixture, "family_fixture_required")
function row(id: number, rins: string[], dockets: string[], agency = 42) {
  return {
    documentId: `doc-${id}`,
    versionId: String(id),
    contentHash: digest(String(id)),
    metadata: {
      ...fixture,
      document_number: `2024-${10000 + id}`,
      regulation_id_numbers: rins,
      docket_ids: dockets,
      agencies: [{ id: agency, raw_name: "Fixture agency" }],
      correction_of: null,
      corrections: []
    }
  }
}
it("coassigns transitive identifiers deterministically without merging canonical actions", () => {
  const input = [row(1, ["1234-AB01"], []), row(2, ["1234-AB01"], ["Docket A"]), row(3, [], ["Docket A"])]
  const result = groupRegulatoryEvaluationPublications(input)
  expect(result.families).toHaveLength(1)
  expect(result.families[0]?.members).toHaveLength(3)
  expect(groupRegulatoryEvaluationPublications([...input].reverse()).families).toEqual(result.families)
  expect(result).toMatchObject({
    canonicalActionsAssigned: false,
    familyAssignmentReviewed: false,
    splitAssigned: false
  })
})
it("does not link same docket strings across different or unidentified agencies", () => {
  const a = row(1, [], ["1"])
  const b = row(2, [], ["1"], 99)
  const c = row(3, [], ["1"])
  const result = groupRegulatoryEvaluationPublications([
    a,
    b,
    { ...c, metadata: { ...c.metadata, agencies: [{ raw_name: "Fixture agency" }] } }
  ])
  expect(result.families).toHaveLength(3)
  expect(result.families.flatMap((f) => f.warnings)).toContain("docket_without_publisher_agency")
})
it("links explicit corrections and flags missing targets rather than declaring independence", () => {
  const a = row(1, [], [])
  const b = row(2, [], [])
  const result = groupRegulatoryEvaluationPublications([
    a,
    {
      ...b,
      metadata: {
        ...b.metadata,
        correction_of: "https://www.federalregister.gov/api/v1/documents/2024-10001.json",
        corrections: ["https://www.federalregister.gov/api/v1/documents/2024-99999.json"]
      }
    }
  ])
  expect(result.families).toHaveLength(1)
  expect(result.families[0]?.warnings).toContain("related_document_outside_inventory")
  expect(() => groupRegulatoryEvaluationPublications([a, a])).toThrow("duplicate_version")
})

it("retains incomplete canonical publisher metadata as unresolved inventory", () => {
  const input = row(1, [], [])
  const result = groupRegulatoryEvaluationPublications([
    { ...input, metadata: { document_number: input.metadata.document_number } }
  ])
  expect(result.families[0]?.members).toEqual([
    { documentId: "doc-1", versionId: "1", documentNumber: input.metadata.document_number }
  ])
  expect(result.families[0]?.warnings).toEqual(["incomplete_publisher_metadata"])
  expect(result.familyAssignmentReviewed).toBe(false)
})

it("preserves colliding printed numbers and ignores unapproved original candidate identifiers", () => {
  const first = row(1, [], [])
  const second = row(2, [], [])
  const unrelated = row(3, ["1234-AB01"], [])
  const metadata = {
    document_number: "00-113",
    metadata_basis: "reviewed_fields",
    original_candidates: [unrelated.metadata]
  }
  const result = groupRegulatoryEvaluationPublications([{ ...first, metadata }, { ...second, metadata }, unrelated])
  expect(result.families).toHaveLength(2)
  const collision = result.families.find((family) => family.members.length === 2)
  expect(collision?.members.map((member) => member.documentId)).toEqual(["doc-1", "doc-2"])
  expect(collision?.warnings).toEqual(
    expect.arrayContaining(["printed_document_number_collision", "source_review_restricts_metadata"])
  )
  expect(collision?.identifiers).not.toContain("rin:1234-AB01")
})
