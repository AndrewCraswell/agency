import { inArray, sql } from "drizzle-orm"
import type { LegislationDatabase } from "../database.js"
import { eventAgendaItems, eventDocuments, eventParticipants, legislativeEvents } from "../schema/schema.js"

export interface EventSnapshot {
  agendaItems: Array<typeof eventAgendaItems.$inferInsert>
  documents: Array<typeof eventDocuments.$inferInsert>
  event: typeof legislativeEvents.$inferInsert
  participants: Array<typeof eventParticipants.$inferInsert>
}

export async function upsertEventSnapshots(
  database: LegislationDatabase,
  snapshots: readonly EventSnapshot[]
): Promise<void> {
  if (snapshots.length === 0) {
    return
  }
  const eventIds = snapshots.map((snapshot) => snapshot.event.id)
  await database.transaction(async (transaction) => {
    await transaction
      .insert(legislativeEvents)
      .values(snapshots.map((snapshot) => snapshot.event))
      .onConflictDoUpdate({
        set: {
          allDay: sql`excluded.all_day`,
          classification: sql`excluded.classification`,
          description: sql`excluded.description`,
          endAt: sql`excluded.end_at`,
          isDeleted: sql`excluded.is_deleted`,
          location: sql`excluded.location`,
          name: sql`excluded.name`,
          sourceId: sql`excluded.source_id`,
          sourceUpdatedAt: sql`excluded.source_updated_at`,
          sourceUrl: sql`excluded.source_url`,
          startAt: sql`excluded.start_at`,
          status: sql`excluded.status`,
          timezone: sql`excluded.timezone`,
          updatedAt: new Date(),
          upstreamIds: sql`${legislativeEvents.upstreamIds} || excluded.upstream_ids`,
          virtualAccess: sql`excluded.virtual_access`
        },
        target: legislativeEvents.id
      })
    await transaction.delete(eventAgendaItems).where(inArray(eventAgendaItems.eventId, eventIds))
    await transaction.delete(eventParticipants).where(inArray(eventParticipants.eventId, eventIds))
    await transaction.delete(eventDocuments).where(inArray(eventDocuments.eventId, eventIds))
    const documents = snapshots.flatMap((snapshot) => snapshot.documents)
    const participants = snapshots.flatMap((snapshot) => snapshot.participants)
    const agendaItems = snapshots.flatMap((snapshot) => snapshot.agendaItems)
    if (documents.length > 0) {
      await transaction.insert(eventDocuments).values(documents)
    }
    if (participants.length > 0) {
      await transaction.insert(eventParticipants).values(participants)
    }
    if (agendaItems.length > 0) {
      await transaction.insert(eventAgendaItems).values(agendaItems)
    }
  })
}
