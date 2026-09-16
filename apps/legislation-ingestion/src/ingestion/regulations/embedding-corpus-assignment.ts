import { digest } from "@repo/legislation-core/legal-text/contracts"
import invariant from "tiny-invariant"
import { z } from "zod"
import { regulatoryEmbeddingSmokeSchema } from "./embedding-smoke.js"

const splitSchema = z.enum(["development", "held-out"])
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const cohortSchema = z.enum([
  "current_prose",
  "current_tables_exceptions_numbers",
  "annual_history_version_selection",
  "proposed_rules",
  "final_rules",
  "notices_scope_and_deadlines",
  "no_answer_in_selected_corpus"
])
const sourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("code"), title: z.int().min(1).max(50) }),
  z.object({ kind: z.literal("publication"), rulemakingFamily: z.string().trim().min(1) })
])
const assignmentSchema = z.strictObject({
  protocolHash: hashSchema,
  manifestHash: hashSchema,
  additionalExposedFamilies: z.array(z.string().min(1)).max(512),
  records: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        split: splitSchema,
        source: sourceSchema,
        sourceHash: hashSchema,
        generationHash: hashSchema,
        nearDuplicateGroup: z.string().trim().min(1)
      })
    )
    .min(1)
    .max(512),
  queries: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        split: splitSchema,
        cohort: cohortSchema,
        families: z.array(z.string().min(1)).min(1).max(512)
      })
    )
    .length(60)
})
const protocolHash = "8bf27836fb7ba2a891ab65ea8d1fe275a5f284f88aa29b8bea2a6546e3797d9e"
const inspectedTitles = [2, 7, 12, 14, 16, 21, 29, 31, 34, 40, 45, 49, 3, 5, 9, 23, 25, 33, 38, 47]
const allocation = new Map([
  ["current_prose", 5],
  ["current_tables_exceptions_numbers", 5],
  ["annual_history_version_selection", 5],
  ["proposed_rules", 4],
  ["final_rules", 4],
  ["notices_scope_and_deadlines", 4],
  ["no_answer_in_selected_corpus", 3]
])

/** Validates declared assignments, not the authenticity of source or human review evidence. */
export function validateRegulatoryCorpusAssignment(manifestInput: unknown, assignmentInput: unknown) {
  const manifest = regulatoryEmbeddingSmokeSchema.parse(manifestInput)
  const assignment = assignmentSchema.parse(assignmentInput)
  invariant(assignment.protocolHash === protocolHash, "regulatory_corpus_protocol_mismatch")
  invariant(assignment.manifestHash === digest(JSON.stringify(manifest)), "regulatory_corpus_manifest_mismatch")
  const records = new Map(manifest.records.map((record) => [record.id, record]))
  const queries = new Map(manifest.queries.map((query) => [query.id, query]))
  invariant(
    records.size === manifest.records.length && queries.size === manifest.queries.length,
    "regulatory_corpus_duplicate_identity"
  )
  invariant(
    assignment.records.length === records.size && new Set(assignment.records.map((r) => r.id)).size === records.size,
    "regulatory_corpus_record_coverage"
  )
  invariant(
    assignment.queries.length === queries.size && new Set(assignment.queries.map((q) => q.id)).size === queries.size,
    "regulatory_corpus_query_coverage"
  )
  const excluded = new Set([
    ...inspectedTitles.map((title) => `code:${title}`),
    ...assignment.additionalExposedFamilies
  ])
  const groups = new Map<string, string>()
  const families = new Map<string, string>()
  const byRecord = new Map<string, { split: string; family: string }>()
  function bind(group: string, split: string) {
    invariant(!groups.has(group) || groups.get(group) === split, "regulatory_corpus_split_leakage")
    groups.set(group, split)
  }
  for (const row of assignment.records) {
    const record = records.get(row.id)
    invariant(record, "regulatory_corpus_record_coverage")
    const family =
      row.source.kind === "code" ? `code:${row.source.title}` : `publication:${row.source.rulemakingFamily}`
    invariant(row.split !== "held-out" || !excluded.has(family), "regulatory_corpus_exposed_held_out_family")
    bind(`family:${family}`, row.split)
    bind(`version:${record.versionId}`, row.split)
    bind(`input:${digest(record.input)}`, row.split)
    bind(`near:${row.nearDuplicateGroup}`, row.split)
    bind(`source:${row.sourceHash}`, row.split)
    families.set(family, row.split)
    byRecord.set(row.id, { split: row.split, family })
  }
  const counts = new Map<string, number>()
  for (const row of assignment.queries) {
    const query = queries.get(row.id)
    invariant(query, "regulatory_corpus_query_coverage")
    invariant(
      (query.answerability === "no_answer") === (row.cohort === "no_answer_in_selected_corpus"),
      "regulatory_corpus_answerability_mismatch"
    )
    invariant(
      new Set(row.families).size === row.families.length &&
        row.families.every((family) => families.get(family) === row.split),
      "regulatory_corpus_query_family_mismatch"
    )
    for (const id of query.relevantIds) {
      const record = byRecord.get(id)
      invariant(
        record?.split === row.split && row.families.includes(record.family),
        "regulatory_corpus_answer_split_mismatch"
      )
    }
    bind(`query:${digest(query.input)}`, row.split)
    const key = `${row.split}:${row.cohort}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  for (const split of splitSchema.options) {
    for (const [cohort, count] of allocation) {
      invariant(counts.get(`${split}:${cohort}`) === count, "regulatory_corpus_cohort_allocation")
    }
  }
  return {
    protocolHash,
    manifestHash: assignment.manifestHash,
    assignmentHash: digest(JSON.stringify(assignment)),
    querySplits: assignment.queries.map(({ id, split }) => ({ id, split })),
    declaredAssignmentsValid: true,
    sourceProvenanceVerified: false,
    wholeVersionQualificationVerified: false,
    humanReviewComplete: false,
    protocolCompliance: false,
    modelSelected: false,
    bulkEmbeddingAuthorized: false
  }
}
