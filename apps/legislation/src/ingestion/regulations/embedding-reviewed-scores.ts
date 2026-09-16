import { isDeepStrictEqual } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { digest } from "./contracts.js"
import { buildRegulatoryJudgmentPool } from "./embedding-judgments.js"
import { regulatoryEmbeddingSmokeSchema } from "./embedding-smoke.js"

const candidateSchema = z.object({
  id: z.string().min(1),
  versionId: z.string().min(1),
  inputHash: z.string(),
  text: z.string(),
  grade: z.int().min(0).max(3),
  rationale: z.string().trim().min(1),
  reviewer: z.string().trim().min(1),
  reviewerKind: z.enum(["human", "automated"])
})
const systemsSchema = z.array(
  z.object({
    model: z.string(),
    queries: z.array(
      z.object({
        queryId: z.string(),
        ranked: z.array(z.object({ id: z.string() }))
      })
    )
  })
)

/** Scores bound review evidence. Declared reviewer metadata is not independent proof of human adjudication. */
export function scoreReviewedRegulatoryJudgments(manifestInput: unknown, systemsInput: unknown, reviewInput: unknown) {
  const manifest = regulatoryEmbeddingSmokeSchema.parse(manifestInput)
  const systems = systemsSchema.parse(systemsInput)
  const expected = buildRegulatoryJudgmentPool(manifest, systems, 25)
  const review = z
    .object({
      manifestHash: z.string(),
      systemsHash: z.string(),
      depth: z.literal(25),
      queries: z
        .array(z.object({ id: z.string(), question: z.string(), candidates: z.array(candidateSchema).max(512) }))
        .max(64)
    })
    .parse(reviewInput)
  invariant(
    review.manifestHash === expected.manifestHash && review.systemsHash === expected.systemsHash,
    "regulatory_review_identity_mismatch"
  )
  invariant(
    review.queries.length === expected.queries.length &&
      new Set(review.queries.map((q) => q.id)).size === review.queries.length,
    "regulatory_review_query_coverage"
  )
  for (const query of expected.queries) {
    const supplied = review.queries.find((row) => row.id === query.id)
    invariant(
      supplied?.question === query.question && supplied.candidates.length === query.candidates.length,
      "regulatory_review_query_coverage"
    )
    invariant(
      new Set(supplied.candidates.map((row) => row.id)).size === supplied.candidates.length,
      "regulatory_review_duplicate_candidate"
    )
    for (const candidate of query.candidates) {
      const actual = supplied.candidates.find((row) => row.id === candidate.id)
      invariant(
        actual &&
          isDeepStrictEqual(
            { id: actual.id, versionId: actual.versionId, inputHash: actual.inputHash, text: actual.text },
            { id: candidate.id, versionId: candidate.versionId, inputHash: candidate.inputHash, text: candidate.text }
          ),
        "regulatory_review_evidence_changed"
      )
    }
  }
  const results = systems.map((system) => {
    const queries = system.queries.map((query) => {
      const definition = manifest.queries.find((row) => row.id === query.queryId)
      const judgment = review.queries.find((row) => row.id === query.queryId)
      invariant(definition && judgment, "regulatory_review_query_coverage")
      const grades = new Map(judgment.candidates.map((row) => [row.id, row.grade]))
      const relevant = judgment.candidates.filter((row) => row.grade >= 2)
      const noAnswer = definition.answerability === "no_answer"
      invariant(noAnswer ? relevant.length === 0 : relevant.length > 0, "regulatory_review_answerability_conflict")
      const ranked = query.ranked.slice(0, 25).map((row) => row.id)
      invariant(
        ranked.every((id) => grades.has(id)),
        "regulatory_review_unjudged_candidate"
      )
      if (noAnswer) {
        return { queryId: query.queryId, metrics: null }
      }
      const relevantAt = (k: number) => ranked.slice(0, k).filter((id) => (grades.get(id) ?? 0) >= 2).length
      const gain = (values: number[]) =>
        values.slice(0, 10).reduce((sum, grade, index) => sum + (2 ** grade - 1) / Math.log2(index + 2), 0)
      const ideal = gain(judgment.candidates.map((row) => row.grade).sort((a, b) => b - a))
      return {
        queryId: query.queryId,
        metrics: {
          expectedCount: relevant.length,
          recallAt5: relevantAt(5) / relevant.length,
          recallAt10: relevantAt(10) / relevant.length,
          recallAt25: relevantAt(25) / relevant.length,
          precisionAt10: relevantAt(10) / Math.max(1, Math.min(10, ranked.length)),
          ndcgAt10: gain(ranked.map((id) => grades.get(id) ?? 0)) / ideal
        }
      }
    })
    const scored = queries.flatMap((query) => (query.metrics === null ? [] : [query.metrics]))
    return {
      model: system.model,
      queries,
      answerableQueries: scored.length,
      meanRecallAt25: scored.length ? scored.reduce((sum, row) => sum + row.recallAt25, 0) / scored.length : null,
      meanNdcgAt10: scored.length ? scored.reduce((sum, row) => sum + row.ndcgAt10, 0) / scored.length : null
    }
  })
  return {
    manifestHash: expected.manifestHash,
    systemsHash: expected.systemsHash,
    reviewHash: digest(JSON.stringify(review)),
    judgmentCoverage: "pooled_top25_plus_known_answers",
    declaredReviewerKinds: [...new Set(review.queries.flatMap((q) => q.candidates.map((c) => c.reviewerKind)))].sort(),
    results,
    humanReviewComplete: false,
    protocolCompliance: false,
    modelSelected: false,
    bulkEmbeddingAuthorized: false
  }
}
