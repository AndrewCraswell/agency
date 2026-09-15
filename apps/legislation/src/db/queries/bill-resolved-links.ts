import { inArray } from "drizzle-orm"
import type { CanonicalBillAggregate } from "../../legislation/model.js"
import type { LegislationDatabase } from "../database.js"
import { billActions, billSponsors, votes, votePositions } from "../schema/schema.js"

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
  const sponsorsById = new Map(previousSponsors.map((sponsor) => [sponsor.id, sponsor]))
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
      const previous = votesById.get(entry.vote.id)
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
          organizationId: entry.vote.organizationId === undefined ? previous?.organizationId : entry.vote.organizationId
        },
        positions:
          entry.positions === undefined
            ? previousPositions.filter((position) => position.voteId === entry.vote.id)
            : entry.positions.map((position) => {
                const prior = positionsByKey.get(JSON.stringify([position.voteId, position.sourceIdentity]))
                if (prior?.personId && position.personId === undefined) {
                  if (
                    prior.sourceName !== (position.sourceName ?? null) ||
                    (position.sourcePersonId !== undefined && position.sourcePersonId !== prior.sourcePersonId)
                  ) {
                    throw new Error("Resolved vote observation changed source identity")
                  }
                  return { ...position, personId: prior.personId, sourcePersonId: prior.sourcePersonId }
                }
                return position
              })
      }
    })
  }))

  function reconcileSponsors(aggregate: CanonicalBillAggregate) {
    const incoming = aggregate.sponsors ?? []
    const incomingIds = new Set(incoming.map((sponsor) => sponsor.id))
    if (
      incoming.some((sponsor) => sponsor.personId === undefined) &&
      previousSponsors.some(
        (sponsor) => sponsor.billId === aggregate.bill.id && sponsor.personId && !incomingIds.has(sponsor.id)
      )
    ) {
      throw new Error("Unresolved sponsor collection would replace resolved observations")
    }
    return incoming.map((sponsor) => {
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
      return { ...sponsor, personId: sponsor.personId === undefined ? previous?.personId : sponsor.personId }
    })
  }
}
