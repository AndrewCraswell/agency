import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { billActions, billSponsors, votes, votePositions } from "@repo/legislation-core/database/schema/schema"
import type { CanonicalBillAggregate } from "@repo/legislation-core/domain/model"
import { inArray } from "drizzle-orm"

type SponsorInsert = NonNullable<CanonicalBillAggregate["sponsors"]>[number]
type SponsorRow = typeof billSponsors.$inferSelect

/** Preserve prior resolved observations without assigning people by name. */
export function preserveResolvedSponsorObservations(
  billId: string,
  incoming: readonly SponsorInsert[],
  previousSponsors: readonly SponsorRow[]
) {
  const sponsorsById = new Map(previousSponsors.map((sponsor) => [sponsor.id, sponsor]))
  const incomingIds = new Set(incoming.map((sponsor) => sponsor.id))
  const reconciled = incoming.map((sponsor) => {
    const previous = sponsorsById.get(sponsor.id)
    if (
      previous &&
      (previous.billId !== sponsor.billId ||
        previous.name !== sponsor.name ||
        previous.classification !== sponsor.classification ||
        previous.sourceUrl !== (sponsor.sourceUrl ?? null))
    ) {
      throw new Error("Sponsor observation changed source identity")
    }
    return {
      ...sponsor,
      personId: sponsor.personId == null ? (previous?.personId ?? sponsor.personId) : sponsor.personId
    }
  })
  if (!incoming.some((sponsor) => sponsor.personId == null)) return reconciled

  // An unresolved collection cannot prove that a differently identified,
  // resolved source observation disappeared. Preserve that prior row as its
  // own observation without assigning its person to any name-matched input.
  const retained = previousSponsors.filter(
    (sponsor) => sponsor.billId === billId && sponsor.personId && !incomingIds.has(sponsor.id)
  )
  return [...reconciled, ...retained]
}

export function persistedVoteId(
  incoming: { id: string; billId?: string | null; sourceUrl?: string | null; sourceId?: string | null },
  previous: readonly { id: string; billId: string | null; sourceUrl: string | null; sourceId: string | null }[]
): string {
  const sameId = previous.find((vote) => vote.id === incoming.id)
  if (
    sameId &&
    (sameId.billId !== (incoming.billId ?? null) ||
      sameId.sourceUrl !== (incoming.sourceUrl ?? null) ||
      sameId.sourceId !== (incoming.sourceId ?? null))
  ) {
    throw new Error("Persisted vote identity changed its source or bill ownership")
  }
  const matches = previous.filter(
    (vote) =>
      vote.id === incoming.id ||
      (typeof incoming.billId === "string" &&
        typeof incoming.sourceUrl === "string" &&
        typeof incoming.sourceId === "string" &&
        vote.sourceId === incoming.sourceId &&
        vote.billId === incoming.billId &&
        vote.sourceUrl === incoming.sourceUrl)
  )
  if (matches.length > 1) {
    throw new Error("Ambiguous persisted vote source identity")
  }
  return matches[0]?.id ?? incoming.id
}

/** Retain an existing resolution on the same observation, never resolve another observation by name. */
export async function preserveBillResolvedLinks(
  database: Omit<LegislationDatabase, "$client">,
  aggregates: readonly CanonicalBillAggregate[]
) {
  const billIds = aggregates.map((aggregate) => aggregate.bill.id)
  if (billIds.length === 0) {
    return aggregates
  }
  const previousActions = await database.select().from(billActions).where(inArray(billActions.billId, billIds))
  const previousSponsors = await database.select().from(billSponsors).where(inArray(billSponsors.billId, billIds))
  const previousVotes = await database.select().from(votes).where(inArray(votes.billId, billIds))
  const voteIds = previousVotes.map((vote) => vote.id)
  const previousPositions =
    voteIds.length === 0
      ? []
      : await database.select().from(votePositions).where(inArray(votePositions.voteId, voteIds))
  const actionsById = new Map(previousActions.map((action) => [action.id, action]))
  const votesById = new Map(previousVotes.map((vote) => [vote.id, vote]))
  const positionsByKey = new Map(
    previousPositions.map((position) => [JSON.stringify([position.voteId, position.sourceIdentity]), position])
  )
  return aggregates.map((aggregate) => ({
    ...aggregate,
    sponsors: aggregate.sponsors === undefined ? undefined : reconcileSponsors(aggregate),
    actions: aggregate.actions?.map((action) => {
      const previous = actionsById.get(action.id)
      if (previous && previous.billId !== action.billId) {
        throw new Error("Action identity changed bill ownership")
      }
      return {
        ...action,
        organizationId: action.organizationId === undefined ? previous?.organizationId : action.organizationId
      }
    }),
    votes: aggregate.votes?.map((entry) => {
      const voteId = persistedVoteId(entry.vote, previousVotes)
      const previous = votesById.get(voteId)
      if (
        previous &&
        (previous.billId !== entry.vote.billId || previous.sourceUrl !== (entry.vote.sourceUrl ?? null))
      ) {
        throw new Error("Vote identity changed its source or bill ownership")
      }
      return {
        ...entry,
        vote: {
          ...entry.vote,
          id: voteId,
          organizationId: entry.vote.organizationId === undefined ? previous?.organizationId : entry.vote.organizationId
        },
        positions:
          entry.positions === undefined
            ? previousPositions.filter((position) => position.voteId === voteId)
            : entry.positions.map((position) => {
                const prior = positionsByKey.get(JSON.stringify([voteId, position.sourceIdentity]))
                if (prior?.personId && position.personId === undefined) {
                  if (
                    prior.sourceName !== (position.sourceName ?? null) ||
                    (position.sourcePersonId !== undefined && position.sourcePersonId !== prior.sourcePersonId)
                  ) {
                    throw new Error("Resolved vote observation changed source identity")
                  }
                  return { ...position, voteId, personId: prior.personId, sourcePersonId: prior.sourcePersonId }
                }
                return { ...position, voteId }
              })
      }
    })
  }))

  function reconcileSponsors(aggregate: CanonicalBillAggregate) {
    return preserveResolvedSponsorObservations(aggregate.bill.id, aggregate.sponsors ?? [], previousSponsors)
  }
}
