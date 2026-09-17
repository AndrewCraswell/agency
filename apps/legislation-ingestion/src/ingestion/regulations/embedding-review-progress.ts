import { digest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryJudgmentPacketSchema } from "./embedding-review-pages.js"

function candidateHumanState(candidate: {
  reviews: { grade: number; reviewerKind: "human" | "automated" }[]
  adjudication: { grade: number; reviewerKind: "human" | "automated" } | null
}) {
  const grades = new Set(
    candidate.reviews.filter(({ reviewerKind }) => reviewerKind === "human").map(({ grade }) => grade)
  )
  const humanReviewed = grades.size > 0
  const conflicting = grades.size > 1
  const humanAdjudicated = candidate.adjudication?.reviewerKind === "human"
  return { humanReviewed, conflicting, resolved: humanReviewed && (!conflicting || humanAdjudicated) }
}

/** Reports review progress without treating automated suggestions as human evidence or scoring an incomplete packet. */
export function auditRegulatoryJudgmentProgress(input: unknown) {
  const packet = regulatoryJudgmentPacketSchema.parse(input)
  let candidates = 0
  let automatedReviewedCandidates = 0
  let humanReviewedCandidates = 0
  let humanResolvedCandidates = 0
  let conflictingHumanCandidates = 0
  let humanAdjudications = 0
  let automatedJudgments = 0
  let humanJudgments = 0
  let completeQueries = 0
  let nextUnresolved: { queryId: string; candidateId: string } | null = null
  for (const query of packet.queries) {
    let queryComplete = true
    for (const candidate of query.candidates) {
      candidates += 1
      const automated = candidate.reviews.filter(({ reviewerKind }) => reviewerKind === "automated").length
      const human = candidate.reviews.filter(({ reviewerKind }) => reviewerKind === "human").length
      const state = candidateHumanState(candidate)
      automatedJudgments += automated
      humanJudgments += human
      automatedReviewedCandidates += Number(automated > 0)
      humanReviewedCandidates += Number(state.humanReviewed)
      humanResolvedCandidates += Number(state.resolved)
      conflictingHumanCandidates += Number(state.conflicting)
      humanAdjudications += Number(candidate.adjudication?.reviewerKind === "human")
      if (!state.resolved) {
        queryComplete = false
        nextUnresolved ??= { queryId: query.id, candidateId: candidate.id }
      }
    }
    completeQueries += Number(queryComplete)
  }
  return {
    contract: "regulatory-judgment-review-progress" as const,
    packetHash: digest(JSON.stringify(packet)),
    manifestHash: packet.manifestHash,
    systemsHash: packet.systemsHash,
    queries: packet.queries.length,
    completeQueries,
    candidates,
    automatedReviewedCandidates,
    humanReviewedCandidates,
    humanResolvedCandidates,
    conflictingHumanCandidates,
    automatedJudgments,
    humanJudgments,
    humanAdjudications,
    humanReviewComplete: humanResolvedCandidates === candidates,
    nextUnresolved
  }
}
