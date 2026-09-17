import { expect, it } from "vitest"
import { applyRegulatoryJudgmentReviewPage, extractRegulatoryJudgmentReviewPage } from "./embedding-review-pages.js"

function packet() {
  return {
    contract: "regulatory-judgment-pool",
    manifestHash: "a".repeat(64),
    systemsHash: "b".repeat(64),
    depth: 25,
    gradeScale: { 0: "No", 1: "Context", 2: "Partial", 3: "Direct" },
    humanReviewComplete: false,
    modelSelected: false,
    queries: ["one", "two", "three"].map((id) => ({
      id,
      question: `Question ${id}`,
      candidates: [
        {
          id: `${id}-candidate`,
          versionId: `${id}-version`,
          inputHash: "c".repeat(64),
          text: `Evidence ${id}`,
          reviews: [],
          adjudication: null
        }
      ]
    }))
  }
}

it("extracts bounded cursor pages and applies only reviewed fields", () => {
  const source = packet()
  const first = extractRegulatoryJudgmentReviewPage(source, { limit: 2 })
  expect(first).toMatchObject({ afterQueryId: null, nextAfterQueryId: "two", exhausted: false })
  const reviewed = {
    ...first,
    queries: first.queries.map((query) => ({
      ...query,
      candidates: query.candidates.map((candidate) => ({
        ...candidate,
        reviews: [
          {
            grade: 3,
            rationale: "The cited text directly answers the question",
            reviewer: "reviewer",
            reviewerKind: "human" as const
          }
        ]
      }))
    }))
  }
  const applied = applyRegulatoryJudgmentReviewPage(source, reviewed)
  expect(applied.queries[0]?.candidates[0]?.reviews).toHaveLength(1)
  expect(applied.queries[1]?.candidates[0]?.reviews).toHaveLength(1)
  expect(applied.queries[2]?.candidates[0]?.reviews).toHaveLength(0)
  expect(extractRegulatoryJudgmentReviewPage(applied, { afterQueryId: "two" })).toMatchObject({
    nextAfterQueryId: null,
    exhausted: true,
    queries: [{ id: "three" }]
  })
})

it("rejects stale pages, changed evidence and invalid cursors", () => {
  const source = packet()
  const page = extractRegulatoryJudgmentReviewPage(source)
  expect(() => extractRegulatoryJudgmentReviewPage(source, { afterQueryId: "missing" })).toThrow(
    "regulatory_review_page_cursor"
  )
  expect(() => applyRegulatoryJudgmentReviewPage({ ...source, depth: 10 }, page)).toThrow(
    "regulatory_review_page_stale_packet"
  )
  const changed = {
    ...page,
    queries: page.queries.map((query) => ({
      ...query,
      candidates: query.candidates.map((candidate) => ({ ...candidate, text: "changed" }))
    }))
  }
  expect(() => applyRegulatoryJudgmentReviewPage(source, changed)).toThrow("regulatory_review_page_evidence_changed")
})
