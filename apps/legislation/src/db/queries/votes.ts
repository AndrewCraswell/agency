import { eq, inArray, sql } from "drizzle-orm"
import { isPersonCivicFoundationComplete } from "../../ingestion/civic-foundation.js"
import type { CongressHouseVoteSnapshot } from "../../ingestion/congress/votes.js"
import type { LegislationDatabase } from "../database.js"
import {
  amendments,
  bills,
  legislativeSessions,
  organizations,
  people,
  votePositions,
  votes
} from "../schema/schema.js"
import { observeCanonicalRecord } from "./changes.js"

export async function upsertCongressHouseVoteSnapshot(
  database: LegislationDatabase,
  snapshot: CongressHouseVoteSnapshot
): Promise<void> {
  const amendmentId = snapshot.vote.amendmentId ?? undefined
  const billId = snapshot.vote.billId ?? undefined
  const organizationId = snapshot.vote.organizationId ?? undefined
  const sessionId = snapshot.vote.sessionId ?? undefined
  const [amendment, bill, organization, session] = await Promise.all([
    amendmentId === undefined
      ? []
      : database.select({ id: amendments.id }).from(amendments).where(eq(amendments.id, amendmentId)).limit(1),
    billId === undefined ? [] : database.select({ id: bills.id }).from(bills).where(eq(bills.id, billId)).limit(1),
    organizationId === undefined
      ? []
      : database
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.id, organizationId))
          .limit(1),
    sessionId === undefined
      ? []
      : database
          .select({ id: legislativeSessions.id })
          .from(legislativeSessions)
          .where(eq(legislativeSessions.id, sessionId))
          .limit(1)
  ])
  const personIds = snapshot.positions.flatMap((position) =>
    position.personId === undefined || position.personId === null ? [] : [position.personId]
  )
  const existingPeople =
    personIds.length === 0
      ? []
      : await database
          .select({
            id: people.id,
            isActive: people.isActive,
            jurisdictionId: people.jurisdictionId,
            name: people.name,
            provenanceComplete: people.provenanceComplete,
            sourceIsOfficial: people.sourceIsOfficial,
            sourceProvider: people.sourceProvider,
            sourceRetrievedAt: people.sourceRetrievedAt,
            sourceUrl: people.sourceUrl
          })
          .from(people)
          .where(inArray(people.id, personIds))
  const validPeople = new Set(existingPeople.filter(isVotePositionPersonLinkable).map((person) => person.id))

  await database.transaction(async (transaction) => {
    await transaction
      .insert(votes)
      .values({
        ...snapshot.vote,
        amendmentId: amendment[0]?.id,
        billId: bill[0]?.id,
        organizationId: organization[0]?.id,
        sessionId: session[0]?.id
      })
      .onConflictDoUpdate({
        set: {
          amendmentId: sql`excluded.amendment_id`,
          billId: sql`excluded.bill_id`,
          chamber: sql`excluded.chamber`,
          classification: sql`excluded.classification`,
          heldAt: sql`excluded.held_at`,
          motion: sql`excluded.motion`,
          noCount: sql`excluded.no_count`,
          absentCount: sql`excluded.absent_count`,
          abstainCount: sql`excluded.abstain_count`,
          notVotingCount: sql`excluded.not_voting_count`,
          organizationId: sql`excluded.organization_id`,
          otherCount: sql`excluded.other_count`,
          pairedCount: sql`excluded.paired_count`,
          presentCount: sql`excluded.present_count`,
          proxyCount: sql`excluded.proxy_count`,
          question: sql`excluded.question`,
          result: sql`excluded.result`,
          rollCallNumber: sql`excluded.roll_call_number`,
          sessionId: sql`excluded.session_id`,
          sourceUrl: sql`excluded.source_url`,
          sourceIsOfficial: sql`excluded.source_is_official`,
          sourceProvider: sql`excluded.source_provider`,
          sourceRetrievedAt: sql`excluded.source_retrieved_at`,
          sourceSequence: sql`excluded.source_sequence`,
          sourceUpdatedAt: sql`excluded.source_updated_at`,
          timelineComplete: sql`excluded.timeline_complete`,
          voteType: sql`excluded.vote_type`,
          yesCount: sql`excluded.yes_count`
        },
        target: votes.id
      })
    await transaction.delete(votePositions).where(eq(votePositions.voteId, snapshot.vote.id))
    if (snapshot.positions.length > 0) {
      await transaction.insert(votePositions).values(
        snapshot.positions.map((position) => ({
          ...position,
          personId:
            position.personId !== undefined && position.personId !== null && validPeople.has(position.personId)
              ? position.personId
              : undefined
        }))
      )
    }
    await observeCanonicalRecord(transaction, {
      fields: {
        amendmentId: amendment[0]?.id,
        billId: bill[0]?.id,
        heldAt: snapshot.vote.heldAt,
        motion: snapshot.vote.motion,
        noCount: snapshot.vote.noCount,
        absentCount: snapshot.vote.absentCount,
        abstainCount: snapshot.vote.abstainCount,
        notVotingCount: snapshot.vote.notVotingCount,
        otherCount: snapshot.vote.otherCount,
        pairedCount: snapshot.vote.pairedCount,
        presentCount: snapshot.vote.presentCount,
        proxyCount: snapshot.vote.proxyCount,
        result: snapshot.vote.result,
        timelineComplete: snapshot.vote.timelineComplete,
        yesCount: snapshot.vote.yesCount
      },
      jurisdictionId: "jurisdiction:us",
      organizationId: organization[0]?.id,
      recordId: snapshot.vote.id,
      recordType: "vote"
    })
  })
}

/**
 * A linked vote person must be usable by the vote-detail canonical projection.
 * Source-derived display fields remain on the position even when the matching
 * person has not been imported with complete canonical provenance.
 */
export function isVotePositionPersonLinkable(
  person: Readonly<{
    isActive: boolean | null
    jurisdictionId: string | null
    name: string
    provenanceComplete: boolean
    sourceIsOfficial: boolean | null
    sourceProvider: string | null
    sourceRetrievedAt: Date | null
    sourceUrl: string | null
  }>
): boolean {
  return isPersonCivicFoundationComplete(person)
}
