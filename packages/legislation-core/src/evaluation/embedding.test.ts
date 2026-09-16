import { describe, expect, it } from "vitest"
import { rankingMetrics, type RelevanceJudgment } from "./embedding.js"

const judgments: RelevanceJudgment[] = Array.from({ length: 12 }, (_, index) => ({
  cohort: "treatment",
  id: `relevant-${index}`,
  relevance: index === 0 ? 3 : 1
}))

describe("rankingMetrics", () => {
  it("distinguishes ordinary recall from result-capacity-adjusted recall", () => {
    const result = rankingMetrics(
      Array.from({ length: 10 }, (_, index) => `relevant-${index}`),
      judgments
    )

    expect(result.recallAt10).toBeCloseTo(10 / 12)
    expect(result.capacityAdjustedRecallAt10).toBe(1)
    expect(result.precisionAt10).toBe(1)
  })

  it("uses graded relevance for nDCG and reports the first relevant rank", () => {
    const result = rankingMetrics(["irrelevant", "relevant-1", "relevant-0"], judgments)

    expect(result.firstRank).toBe(2)
    expect(result.meanReciprocalRank).toBe(0.5)
    expect(result.ndcgAt10).toBeGreaterThan(0)
    expect(result.ndcgAt10).toBeLessThan(1)
  })
})
