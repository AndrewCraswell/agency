import { isDeepStrictEqual } from "node:util"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import invariant from "tiny-invariant"
import { z } from "zod"
import { buildRegulatoryJudgmentPool } from "./embedding-judgments.js"
import { regulatoryEmbeddingSmokeSchema } from "./embedding-smoke.js"

const judgmentSchema = z.strictObject({
  grade: z.int().min(0).max(3),
  rationale: z.string().trim().min(1),
  reviewer: z.string().trim().min(1),
  reviewerKind: z.enum(["human", "automated"])
})
const candidateSchema = z.object({
  id: z.string().min(1),
  versionId: z.string().min(1),
  inputHash: z.string(),
  text: z.string(),
  reviews: z.array(judgmentSchema).min(1).max(8),
  adjudication: judgmentSchema.nullable()
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

function resolveJudgment(candidate: z.infer<typeof candidateSchema>) {
  invariant(
    new Set(candidate.reviews.map(({ reviewer }) => reviewer)).size === candidate.reviews.length,
    "regulatory_review_duplicate_reviewer"
  )
  const human = candidate.reviews.filter(({ reviewerKind }) => reviewerKind === "human")
  const humanGrades = new Set(human.map(({ grade }) => grade))
  const allGrades = new Set(candidate.reviews.map(({ grade }) => grade))
  if (humanGrades.size > 1) {
    invariant(candidate.adjudication?.reviewerKind === "human", "regulatory_review_human_disagreement_unresolved")
  }
  const grade =
    humanGrades.size === 1
      ? human[0]!.grade
      : humanGrades.size > 1
        ? candidate.adjudication!.grade
        : allGrades.size === 1
          ? candidate.reviews[0]!.grade
          : candidate.adjudication?.grade
  invariant(grade !== undefined, "regulatory_review_automated_disagreement_unresolved")
  return {
    grade,
    humanComplete: human.length > 0 && (humanGrades.size <= 1 || candidate.adjudication?.reviewerKind === "human")
  }
}

/** Scores bound review evidence. Reviewer declarations still require an external review/sign-off record. */
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
  const resolved = new Map(
    review.queries.flatMap((query) =>
      query.candidates.map((candidate) => [`${query.id}:${candidate.id}`, resolveJudgment(candidate)] as const)
    )
  )
  const humanReviewComplete = [...resolved.values()].every(({ humanComplete }) => humanComplete)
  const results = systems.map((system) => {
    const queries = system.queries.map((query) => {
      const definition = manifest.queries.find((row) => row.id === query.queryId)
      const judgment = review.queries.find((row) => row.id === query.queryId)
      invariant(definition && judgment, "regulatory_review_query_coverage")
      const grades = new Map(
        judgment.candidates.map((row) => [row.id, resolved.get(`${judgment.id}:${row.id}`)!.grade])
      )
      const relevant = judgment.candidates.filter((row) => grades.get(row.id)! >= 2)
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
      const ideal = gain([...grades.values()].sort((a, b) => b - a))
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
    declaredReviewerKinds: [
      ...new Set(
        review.queries.flatMap((query) =>
          query.candidates.flatMap((candidate) => [
            ...candidate.reviews.map(({ reviewerKind }) => reviewerKind),
            ...(candidate.adjudication === null ? [] : [candidate.adjudication.reviewerKind])
          ])
        )
      )
    ].sort(),
    results,
    humanReviewComplete,
    protocolCompliance: humanReviewComplete,
    modelSelected: false,
    bulkEmbeddingAuthorized: false
  }
}
