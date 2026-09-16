export interface RelevanceJudgment {
  cohort: "control" | "treatment"
  id: string
  relevance: 1 | 2 | 3
}

export function rankingMetrics(ids: string[], judgments: RelevanceJudgment[]) {
  const relevance = new Map(judgments.map((judgment) => [judgment.id, judgment.relevance]))
  const relevantIds = new Set(relevance.keys())
  const relevantAt = (limit: number) => ids.slice(0, limit).filter((id) => relevantIds.has(id)).length
  const firstRank = ids.findIndex((id) => relevantIds.has(id)) + 1
  const dcgAt10 = ids.slice(0, 10).reduce((sum, id, index) => {
    const grade = relevance.get(id) ?? 0
    return sum + (2 ** grade - 1) / Math.log2(index + 2)
  }, 0)
  const idealDcgAt10 = judgments
    .map((judgment) => judgment.relevance)
    .sort((left, right) => right - left)
    .slice(0, 10)
    .reduce((sum, grade, index) => sum + (2 ** grade - 1) / Math.log2(index + 2), 0)
  return {
    capacityAdjustedRecallAt5: relevantAt(5) / Math.min(5, judgments.length),
    capacityAdjustedRecallAt10: relevantAt(10) / Math.min(10, judgments.length),
    capacityAdjustedRecallAt25: relevantAt(25) / Math.min(25, judgments.length),
    expectedCount: judgments.length,
    firstRank: firstRank === 0 ? null : firstRank,
    meanReciprocalRank: firstRank === 0 ? 0 : 1 / firstRank,
    ndcgAt10: idealDcgAt10 === 0 ? 0 : dcgAt10 / idealDcgAt10,
    precisionAt10: relevantAt(10) / Math.min(ids.length || 1, 10),
    recallAt5: relevantAt(5) / judgments.length,
    recallAt10: relevantAt(10) / judgments.length,
    recallAt25: relevantAt(25) / judgments.length
  }
}
