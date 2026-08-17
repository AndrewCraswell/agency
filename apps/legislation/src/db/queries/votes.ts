import { eq, inArray, sql } from "drizzle-orm"
import type { CongressHouseVoteSnapshot } from "../../ingestion/congress/votes.js"
import type { LegislationDatabase } from "../database.js"
import { bills, legislativeSessions, organizations, people, votePositions, votes } from "../schema/schema.js"

export async function upsertCongressHouseVoteSnapshot(
  database: LegislationDatabase,
  snapshot: CongressHouseVoteSnapshot
): Promise<void> {
  const billId = snapshot.vote.billId ?? undefined
  const organizationId = snapshot.vote.organizationId ?? undefined
  const sessionId = snapshot.vote.sessionId ?? undefined
  const [bill, organization, session] = await Promise.all([
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
      : await database.select({ id: people.id }).from(people).where(inArray(people.id, personIds))
  const validPeople = new Set(existingPeople.map((person) => person.id))

  await database.transaction(async (transaction) => {
    await transaction
      .insert(votes)
      .values({
        ...snapshot.vote,
        billId: bill[0]?.id,
        organizationId: organization[0]?.id,
        sessionId: session[0]?.id
      })
      .onConflictDoUpdate({
        set: {
          billId: sql`excluded.bill_id`,
          chamber: sql`excluded.chamber`,
          classification: sql`excluded.classification`,
          heldAt: sql`excluded.held_at`,
          motion: sql`excluded.motion`,
          noCount: sql`excluded.no_count`,
          organizationId: sql`excluded.organization_id`,
          otherCount: sql`excluded.other_count`,
          question: sql`excluded.question`,
          result: sql`excluded.result`,
          rollCallNumber: sql`excluded.roll_call_number`,
          sessionId: sql`excluded.session_id`,
          sourceUrl: sql`excluded.source_url`,
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
  })
}
