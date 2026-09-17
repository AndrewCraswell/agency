import { expect, it } from "vitest"
import { auditRegulatoryJudgmentProgress } from "./embedding-review-progress.js"

const judgment = (grade: number, reviewerKind: "human" | "automated") => ({
  grade,
  rationale: "Reviewed against the exact source excerpt.",
  reviewer: `${reviewerKind}-reviewer`,
  reviewerKind
})
type Judgment = ReturnType<typeof judgment>
const candidate = (id: string, reviews: Judgment[], adjudication: Judgment | null = null) => ({
  id,
  versionId: `version-${id}`,
  inputHash: id.repeat(64).slice(0, 64),
  text: `Evidence ${id}`,
  reviews,
  adjudication
})
const packet = (candidates: ReturnType<typeof candidate>[]) => ({
  contract: "regulatory-judgment-pool",
  manifestHash: "a".repeat(64),
  systemsHash: "b".repeat(64),
  depth: 10,
  gradeScale: { 0: "No", 1: "Context", 2: "Partial", 3: "Direct" },
  humanReviewComplete: false,
  modelSelected: false,
  queries: [{ id: "q1", question: "Question?", candidates }]
})

it("reports automated suggestions without counting them as human completion", () => {
  const result = auditRegulatoryJudgmentProgress(packet([candidate("1", [judgment(3, "automated")])]))
  expect(result).toMatchObject({
    candidates: 1,
    automatedReviewedCandidates: 1,
    humanReviewedCandidates: 0,
    humanReviewComplete: false,
    nextUnresolved: { queryId: "q1", candidateId: "1" }
  })
})

it("requires human adjudication when human grades conflict", () => {
  const disputed = candidate("1", [judgment(0, "human"), judgment(3, "human")])
  expect(auditRegulatoryJudgmentProgress(packet([disputed]))).toMatchObject({
    humanReviewedCandidates: 1,
    humanResolvedCandidates: 0,
    conflictingHumanCandidates: 1,
    humanReviewComplete: false
  })
  const resolved = { ...disputed, adjudication: judgment(3, "human") }
  expect(auditRegulatoryJudgmentProgress(packet([resolved]))).toMatchObject({
    humanResolvedCandidates: 1,
    humanAdjudications: 1,
    completeQueries: 1,
    humanReviewComplete: true,
    nextUnresolved: null
  })
})
