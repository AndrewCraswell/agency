import { describe, expect, it } from "vitest"
import { buildRegulatoryJudgmentPool } from "./embedding-judgments.js"
import { scoreReviewedRegulatoryJudgments } from "./embedding-reviewed-scores.js"

const manifest = {
  records: ["a", "b", "c"].map((id) => ({ id, versionId: `${id}-version`, input: `source ${id}` })),
  queries: [{ id: "q", input: "question", relevantIds: ["a"] }]
}
const systems = [{ model: "fixture", queries: [{ queryId: "q", ranked: [{ id: "c" }, { id: "a" }, { id: "b" }] }] }]
function reviewFor(input: unknown = manifest, noAnswer = false, reviewerKind: "automated" | "human" = "automated") {
  const pool = buildRegulatoryJudgmentPool(input, systems, 25)
  return {
    ...pool,
    queries: pool.queries.map((query) => ({
      ...query,
      candidates: query.candidates.map((candidate) => ({
        ...candidate,
        reviews: [
          {
            grade: noAnswer
              ? 1
              : (new Map([
                  ["a", 3],
                  ["b", 2]
                ]).get(candidate.id) ?? 1),
            rationale: "Synthetic regression fixture",
            reviewer: "test",
            reviewerKind
          }
        ],
        adjudication: null
      }))
    }))
  }
}

describe("reviewed regulatory scoring", () => {
  it("counts partial and direct answers for recall while retaining contextual graded gain", () => {
    const result = scoreReviewedRegulatoryJudgments(manifest, systems, reviewFor())
    const metrics = result.results[0]?.queries[0]?.metrics
    expect(metrics?.expectedCount).toBe(2)
    expect(metrics?.recallAt25).toBe(1)
    expect(metrics?.precisionAt10).toBeCloseTo(2 / 3)
    expect(metrics?.ndcgAt10).toBeCloseTo((1 + 7 / Math.log2(3) + 3 / 2) / (7 + 3 / Math.log2(3) + 1 / 2))
    expect(result.declaredReviewerKinds).toEqual(["automated"])
    expect(result).toMatchObject({
      humanReviewComplete: false,
      protocolCompliance: false,
      modelSelected: false,
      bulkEmbeddingAuthorized: false
    })
    expect(result.reviewHash).toMatch(/^[a-f0-9]{64}$/)
  })
  it("excludes no-answer cases from quality averages and rejects contradictory judgments", () => {
    const input = {
      ...manifest,
      queries: [{ id: "q", input: "question", relevantIds: [], answerability: "no_answer" }]
    }
    const review = reviewFor(input, true)
    expect(scoreReviewedRegulatoryJudgments(input, systems, review).results[0]).toMatchObject({
      queries: [{ queryId: "q", metrics: null }],
      answerableQueries: 0,
      meanRecallAt25: null,
      meanNdcgAt10: null
    })
    const contradiction = {
      ...review,
      queries: review.queries.map((q) => ({
        ...q,
        candidates: q.candidates.map((c) => ({
          ...c,
          reviews: c.reviews.map((judgment) => ({ ...judgment, grade: 2 }))
        }))
      }))
    }
    expect(() => scoreReviewedRegulatoryJudgments(input, systems, contradiction)).toThrow("answerability_conflict")
  })
  it("reports complete human review and requires human adjudication for disagreement", () => {
    const human = reviewFor(manifest, false, "human")
    expect(scoreReviewedRegulatoryJudgments(manifest, systems, human)).toMatchObject({
      declaredReviewerKinds: ["human"],
      humanReviewComplete: true,
      protocolCompliance: true,
      modelSelected: false,
      bulkEmbeddingAuthorized: false
    })
    const disputed = {
      ...human,
      queries: human.queries.map((query) => ({
        ...query,
        candidates: query.candidates.map((candidate) => ({
          ...candidate,
          reviews: [
            ...candidate.reviews,
            { ...candidate.reviews[0]!, grade: candidate.reviews[0]!.grade === 3 ? 2 : 3, reviewer: "second" }
          ]
        }))
      }))
    }
    expect(() => scoreReviewedRegulatoryJudgments(manifest, systems, disputed)).toThrow("human_disagreement_unresolved")
    const adjudicated = {
      ...disputed,
      queries: disputed.queries.map((query) => ({
        ...query,
        candidates: query.candidates.map((candidate) => ({
          ...candidate,
          adjudication: {
            grade: candidate.reviews[0]!.grade,
            rationale: "Resolved against the cited source",
            reviewer: "adjudicator",
            reviewerKind: "human" as const
          }
        }))
      }))
    }
    expect(scoreReviewedRegulatoryJudgments(manifest, systems, adjudicated).humanReviewComplete).toBe(true)
  })
  it("refuses unreviewed, incomplete, duplicated, or altered evidence", () => {
    expect(() =>
      scoreReviewedRegulatoryJudgments(manifest, systems, buildRegulatoryJudgmentPool(manifest, systems, 25))
    ).toThrow("reviews")
    const review = reviewFor()
    for (const field of ["text", "versionId", "inputHash"]) {
      const altered = {
        ...review,
        queries: review.queries.map((q) => ({
          ...q,
          candidates: q.candidates.map((c) => ({ ...c, [field]: "changed" }))
        }))
      }
      expect(() => scoreReviewedRegulatoryJudgments(manifest, systems, altered)).toThrow("evidence_changed")
    }
    const missing = { ...review, queries: review.queries.map((q) => ({ ...q, candidates: q.candidates.slice(1) })) }
    expect(() => scoreReviewedRegulatoryJudgments(manifest, systems, missing)).toThrow("query_coverage")
    const duplicated = {
      ...review,
      queries: review.queries.map((q) => ({ ...q, candidates: q.candidates.map(() => q.candidates[0]) }))
    }
    expect(() => scoreReviewedRegulatoryJudgments(manifest, systems, duplicated)).toThrow("duplicate_candidate")
    expect(() => scoreReviewedRegulatoryJudgments(manifest, systems, { ...review, manifestHash: "changed" })).toThrow(
      "identity_mismatch"
    )
    const question = { ...review, queries: review.queries.map((q) => ({ ...q, question: "changed" })) }
    expect(() => scoreReviewedRegulatoryJudgments(manifest, systems, question)).toThrow("query_coverage")
  })
})
