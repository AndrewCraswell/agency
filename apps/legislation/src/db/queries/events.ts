import { inArray, sql } from "drizzle-orm"
import type { LegislationDatabase } from "../database.js"
import {
  eventAgendaItemAmendments,
  eventAgendaItemBills,
  eventAgendaItems,
  eventAgendaItemSupportingMaterials,
  eventDocuments,
  eventOrganizations,
  eventParticipants,
  eventSessions,
  legislativeSessions,
  organizations,
  legislativeEvents
} from "../schema/schema.js"
import { observeCanonicalRecord } from "./changes.js"

export interface EventSnapshot {
  agendaItems: EventAgendaItemSnapshot[]
  documents: Array<typeof eventDocuments.$inferInsert>
  event: typeof legislativeEvents.$inferInsert
  organizationIds?: readonly string[]
  participants: Array<typeof eventParticipants.$inferInsert>
  sessionIds?: readonly string[]
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
  const preparedSnapshots = await prepareEventSnapshots(database, snapshots)
  const eventIds = preparedSnapshots.map((snapshot) => snapshot.event.id)
  await database.transaction(async (transaction) => {
    await transaction
      .insert(legislativeEvents)
      .values(preparedSnapshots.map((snapshot) => snapshot.event))
      .onConflictDoUpdate({
        set: {
          allDay: sql`excluded.all_day`,
          classification: sql`excluded.classification`,
          description: sql`excluded.description`,
          endAt: sql`excluded.end_at`,
          isDeleted: sql`excluded.is_deleted`,
          location: sql`excluded.location`,
          name: sql`excluded.name`,
          organizationRelationsComplete: sql`excluded.organization_relations_complete`,
          provenanceComplete: sql`excluded.provenance_complete`,
          publisherLocalDate: sql`excluded.publisher_local_date`,
          canonicalFactsComplete: sql`excluded.canonical_facts_complete`,
          isRemote: sql`excluded.is_remote`,
          sourceIsOfficial: sql`excluded.source_is_official`,
          sourceProvider: sql`excluded.source_provider`,
          sourceRetrievedAt: sql`excluded.source_retrieved_at`,
          sourceSequence: sql`excluded.source_sequence`,
          sourceId: sql`excluded.source_id`,
          sourceUpdatedAt: sql`excluded.source_updated_at`,
          sourceUrl: sql`excluded.source_url`,
          startAt: sql`excluded.start_at`,
          status: sql`excluded.status`,
          sessionRelationsComplete: sql`excluded.session_relations_complete`,
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
    await transaction.delete(eventSessions).where(inArray(eventSessions.eventId, eventIds))
    await transaction.delete(eventOrganizations).where(inArray(eventOrganizations.eventId, eventIds))
    const documents = preparedSnapshots.flatMap((snapshot) => snapshot.documents)
    const participants = preparedSnapshots.flatMap((snapshot) => snapshot.participants)
    const agendaItems = preparedSnapshots.flatMap((snapshot) => snapshot.agendaItems)
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
    const sessionLinks = preparedSnapshots.flatMap((snapshot) =>
      (snapshot.sessionIds ?? []).map((sessionId) => ({ eventId: snapshot.event.id, sessionId }))
    )
    const organizationLinks = preparedSnapshots.flatMap((snapshot) =>
      (snapshot.organizationIds ?? []).map((organizationId) => ({ eventId: snapshot.event.id, organizationId }))
    )
    if (sessionLinks.length > 0) {
      await transaction.insert(eventSessions).values(sessionLinks)
    }
    if (organizationLinks.length > 0) {
      await transaction.insert(eventOrganizations).values(organizationLinks)
    }
    for (const snapshot of preparedSnapshots) {
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

/**
 * Restrictive relationship FKs are part of the public-truth boundary. A source-declared
 * ID that has not been persisted yet leaves its collection incomplete; it is never
 * replaced by a date, label, or best-effort match.
 */
async function prepareEventSnapshots(
  database: LegislationDatabase,
  snapshots: readonly EventSnapshot[]
): Promise<EventSnapshot[]> {
  const sessionIds = uniqueIds(
    snapshots.flatMap((snapshot) => [...(snapshot.sessionIds ?? [])]),
    "sessionId"
  )
  const organizationIds = uniqueIds(
    snapshots.flatMap((snapshot) => [...(snapshot.organizationIds ?? [])]),
    "organizationId"
  )
  const [persistedSessions, persistedOrganizations] = await Promise.all([
    sessionIds.length === 0
      ? []
      : await database
          .select({ id: legislativeSessions.id, jurisdictionId: legislativeSessions.jurisdictionId })
          .from(legislativeSessions)
          .where(inArray(legislativeSessions.id, sessionIds)),
    organizationIds.length === 0
      ? []
      : await database
          .select({ id: organizations.id, jurisdictionId: organizations.jurisdictionId })
          .from(organizations)
          .where(inArray(organizations.id, organizationIds))
  ])
  const jurisdictionBySession = new Map(persistedSessions.map((item) => [item.id, item.jurisdictionId]))
  const jurisdictionByOrganization = new Map(persistedOrganizations.map((item) => [item.id, item.jurisdictionId]))
  return snapshots.map((snapshot) => {
    const sourceSessionIds = snapshot.sessionIds ?? []
    const sourceOrganizationIds = snapshot.organizationIds ?? []
    const validSessionIds = uniqueIds(sourceSessionIds, "sessionId").filter(
      (id) => jurisdictionBySession.get(id) === snapshot.event.jurisdictionId
    )
    const validOrganizationIds = uniqueIds(sourceOrganizationIds, "organizationId").filter(
      (id) => jurisdictionByOrganization.get(id) === snapshot.event.jurisdictionId
    )
    const sessionRelationsComplete =
      snapshot.event.sessionRelationsComplete === true && validSessionIds.length === sourceSessionIds.length
    const organizationRelationsComplete =
      snapshot.event.organizationRelationsComplete === true &&
      validOrganizationIds.length === sourceOrganizationIds.length
    return {
      ...snapshot,
      event: {
        ...snapshot.event,
        canonicalFactsComplete:
          snapshot.event.canonicalFactsComplete === true && sessionRelationsComplete && organizationRelationsComplete,
        organizationRelationsComplete,
        sessionRelationsComplete
      },
      organizationIds: validOrganizationIds,
      sessionIds: validSessionIds
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
