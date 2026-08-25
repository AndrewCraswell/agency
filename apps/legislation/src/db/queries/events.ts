import { inArray, sql } from "drizzle-orm"
import type { LegislationDatabase } from "../database.js"
import {
  eventAgendaItemAmendments,
  eventAgendaItemBills,
  eventAgendaItems,
  eventAgendaItemSupportingMaterials,
  eventDocuments,
  eventParticipants,
  legislativeEvents
} from "../schema/schema.js"
import { observeCanonicalRecord } from "./changes.js"

export interface EventSnapshot {
  agendaItems: EventAgendaItemSnapshot[]
  documents: Array<typeof eventDocuments.$inferInsert>
  event: typeof legislativeEvents.$inferInsert
  participants: Array<typeof eventParticipants.$inferInsert>
}

export interface EventAgendaItemSnapshot {
  agendaItem: typeof eventAgendaItems.$inferInsert
  amendmentIds: readonly string[]
  billIds: readonly string[]
  materialIds: readonly string[]
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
      await transaction.insert(eventAgendaItems).values(agendaItems.map((item) => item.agendaItem))
      const { amendmentLinks, billLinks, materialLinks } = agendaItemLinkRows(agendaItems)
      if (billLinks.length > 0) {
        await transaction.insert(eventAgendaItemBills).values(billLinks)
      }
      if (amendmentLinks.length > 0) {
        await transaction.insert(eventAgendaItemAmendments).values(amendmentLinks)
      }
      if (materialLinks.length > 0) {
        await transaction.insert(eventAgendaItemSupportingMaterials).values(materialLinks)
      }
    }
    for (const snapshot of snapshots) {
      await observeCanonicalRecord(transaction, {
        fields: {
          classification: snapshot.event.classification,
          endAt: snapshot.event.endAt,
          isDeleted: snapshot.event.isDeleted ?? false,
          name: snapshot.event.name,
          startAt: snapshot.event.startAt,
          status: snapshot.event.status
        },
        jurisdictionId: snapshot.event.jurisdictionId,
        recordId: snapshot.event.id,
        recordType: "event",
        sourceUpdatedAt: snapshot.event.sourceUpdatedAt ?? undefined
      })
    }
  })
}

export function agendaItemLinkRows(agendaItems: readonly EventAgendaItemSnapshot[]) {
  return {
    amendmentLinks: agendaItems.flatMap((item) =>
      uniqueIds(item.amendmentIds, "amendmentId").map((amendmentId) => ({
        agendaItemId: item.agendaItem.id,
        amendmentId
      }))
    ),
    billLinks: agendaItems.flatMap((item) =>
      uniqueIds(item.billIds, "billId").map((billId) => ({ agendaItemId: item.agendaItem.id, billId }))
    ),
    materialLinks: agendaItems.flatMap((item) =>
      uniqueIds(item.materialIds, "materialId").map((materialId) => ({ agendaItemId: item.agendaItem.id, materialId }))
    )
  }
}

function uniqueIds(ids: readonly string[], name: string): string[] {
  if (ids.some((id) => id.trim().length === 0 || id.trim() !== id)) {
    throw new Error(`${name} must be trimmed and nonempty`)
  }
  return [...new Set(ids)]
}
