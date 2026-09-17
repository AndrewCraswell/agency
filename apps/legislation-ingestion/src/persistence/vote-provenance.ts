import type { CanonicalVote } from "@repo/legislation-core/domain/model"

const countKeys = [
  "yesCount",
  "noCount",
  "absentCount",
  "abstainCount",
  "notVotingCount",
  "presentCount",
  "proxyCount",
  "pairedCount",
  "otherCount"
] as const

/** Explicit retained-evidence repair only; ordinary ingestion never matches votes by motion/tally. */
export function planVoteProvenance(expected: readonly CanonicalVote[], stored: readonly CanonicalVote[]) {
  if (
    !expected.length ||
    expected.length !== stored.length ||
    new Set(expected.map((entry) => entry.vote.sourceId)).size !== expected.length ||
    new Set(stored.map((entry) => entry.vote.id)).size !== stored.length
  ) {
    throw new Error("Vote inventory is missing, duplicated or differs from retained evidence")
  }
  const selected = new Set<string>()
  return expected.map((incoming) => {
    const source = incoming.vote
    if (!source.timelineComplete || !source.sourceId || !source.sourceUrl || !incoming.positions?.length) {
      throw new Error("Source vote evidence is incomplete")
    }
    const matches = stored.filter(({ vote }) => {
      if (
        vote.billId !== source.billId ||
        vote.motion !== source.motion ||
        vote.yesCount == null ||
        vote.noCount == null
      )
        return false
      if (vote.sourceId != null && vote.sourceId !== source.sourceId) return false
      if (vote.sourceUrl != null && vote.sourceUrl !== source.sourceUrl) return false
      if (vote.timelineComplete && (!vote.sourceId || !vote.sourceUrl)) return false
      if (vote.heldAt != null && vote.heldAt.toISOString() !== source.heldAt?.toISOString()) return false
      if (vote.heldDate != null && vote.heldDate !== source.heldDate) return false
      const result = vote.result === "pass" ? "passed" : vote.result === "fail" ? "failed" : vote.result
      return result === source.result && countKeys.every((key) => vote[key] == null || vote[key] === source[key])
    })
    const previous = matches[0]
    if (matches.length !== 1 || !previous || selected.has(previous.vote.id)) {
      throw new Error("Vote evidence does not identify one distinct persisted observation")
    }
    selected.add(previous.vote.id)
    const positions = incoming.positions.map((position) => ({ ...position, voteId: previous.vote.id }))
    if (new Set(positions.map((position) => position.sourceIdentity)).size !== positions.length) {
      throw new Error("Duplicate source voter observation")
    }
    for (const prior of previous.positions ?? []) {
      const current = positions.find((position) => position.sourceIdentity === prior.sourceIdentity)
      if (
        !current ||
        current.sourceName !== prior.sourceName ||
        current.option !== prior.option ||
        (current.sourcePersonId != null &&
          prior.sourcePersonId != null &&
          current.sourcePersonId !== prior.sourcePersonId) ||
        (current.personId != null && prior.personId != null && current.personId !== prior.personId)
      ) {
        throw new Error("Existing voter observation conflicts with retained evidence")
      }
      current.personId ??= prior.personId
      current.sourcePersonId ??= prior.sourcePersonId
    }
    return {
      vote: { ...source, id: previous.vote.id, organizationId: source.organizationId ?? previous.vote.organizationId },
      positions
    }
  })
}
