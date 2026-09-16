import { digest } from "@repo/legislation-core/legal-text/contracts"
import { describe, expect, it } from "vitest"
import { validateRegulatoryCorpusAssignment } from "./embedding-corpus-assignment.js"

const cohorts = [
  ["current_prose", 5],
  ["current_tables_exceptions_numbers", 5],
  ["annual_history_version_selection", 5],
  ["proposed_rules", 4],
  ["final_rules", 4],
  ["notices_scope_and_deadlines", 4],
  ["no_answer_in_selected_corpus", 3]
] as const
function fixture() {
  const queries = ["development", "held-out"].flatMap((split) =>
    cohorts.flatMap(([cohort, count]) =>
      Array.from({ length: count }, (_, index) => ({
        id: `${split}:${cohort}:${index}`,
        input: `${split} question ${cohort} ${index}`,
        relevantIds: cohort === "no_answer_in_selected_corpus" ? [] : [split],
        ...(cohort === "no_answer_in_selected_corpus" ? { answerability: "no_answer" } : {})
      }))
    )
  )
  const manifest = {
    records: ["development", "held-out"].map((id) => ({ id, versionId: `${id}-version`, input: `${id} passage` })),
    queries
  }
  const assignment = {
    protocolHash: "8bf27836fb7ba2a891ab65ea8d1fe275a5f284f88aa29b8bea2a6546e3797d9e",
    manifestHash: digest(JSON.stringify(manifest)),
    additionalExposedFamilies: [],
    records: manifest.records.map((r) => ({
      id: r.id,
      split: r.id,
      source: { kind: "code", title: r.id === "development" ? 2 : 6 },
      sourceHash: digest(r.id),
      generationHash: digest(r.versionId),
      nearDuplicateGroup: r.id
    })),
    queries: ["development", "held-out"].flatMap((split) =>
      cohorts.flatMap(([cohort, count]) =>
        Array.from({ length: count }, (_, index) => ({
          id: `${split}:${cohort}:${index}`,
          split,
          cohort,
          families: [split === "development" ? "code:2" : "code:6"]
        }))
      )
    )
  }
  return { manifest, assignment }
}
describe("regulatory corpus split assignments", () => {
  it("binds all sixty declared allocations without claiming source or model qualification", () => {
    const { manifest, assignment } = fixture()
    expect(validateRegulatoryCorpusAssignment(manifest, assignment)).toMatchObject({
      declaredAssignmentsValid: true,
      sourceProvenanceVerified: false,
      wholeVersionQualificationVerified: false,
      protocolCompliance: false,
      modelSelected: false
    })
  })
  it("rejects changed manifests, inspected held-out families, and missing cohorts", () => {
    const { manifest, assignment } = fixture()
    expect(() =>
      validateRegulatoryCorpusAssignment(manifest, { ...assignment, manifestHash: digest("changed") })
    ).toThrow("manifest_mismatch")
    expect(() =>
      validateRegulatoryCorpusAssignment(manifest, { ...assignment, additionalExposedFamilies: ["code:6"] })
    ).toThrow("exposed_held_out_family")
    expect(() =>
      validateRegulatoryCorpusAssignment(manifest, {
        ...assignment,
        queries: assignment.queries.map((q) => ({
          ...q,
          cohort: q.cohort === "current_prose" ? "current_tables_exceptions_numbers" : q.cohort
        }))
      })
    ).toThrow("cohort_allocation")
  })
  it("rejects near-duplicate leakage and answers assigned to the other split", () => {
    const { manifest, assignment } = fixture()
    expect(() =>
      validateRegulatoryCorpusAssignment(manifest, {
        ...assignment,
        records: assignment.records.map((r) => ({ ...r, nearDuplicateGroup: "shared" }))
      })
    ).toThrow("split_leakage")
    const changed = {
      ...manifest,
      queries: manifest.queries.map((q) => ({ ...q, relevantIds: q.relevantIds.length ? ["development"] : [] }))
    }
    expect(() =>
      validateRegulatoryCorpusAssignment(changed, { ...assignment, manifestHash: digest(JSON.stringify(changed)) })
    ).toThrow("answer_split_mismatch")
  })
})
