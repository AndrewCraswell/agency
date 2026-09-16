import { isDeepStrictEqual } from "node:util"
import { eq, inArray, sql } from "drizzle-orm"
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
  legislativeEvents,
  bills,
  syncCheckpoints
} from "../schema/schema.js"
import { assertBillBatchOwnership, type BillBatchOwnership } from "./bill-batch-ownership.js"
import { observeCanonicalRecord } from "./changes.js"
import { resolveAgendaBillReferences } from "./event-bill-references.js"
import { resolveEventOrganizationReferences } from "./event-organization-references.js"
import { promotionAlreadyCommitted } from "./promotion-receipt.js"

export interface EventSnapshot {
  agendaItems: EventAgendaItemSnapshot[]
  documents: Array<typeof eventDocuments.$inferInsert>
  event: typeof legislativeEvents.$inferInsert
  organizationIds?: readonly string[]
  organizationReferences?: readonly string[]
  participants: Array<typeof eventParticipants.$inferInsert>
  sessionIds?: readonly string[]
}

export interface EventAgendaItemSnapshot {
  agendaItem: typeof eventAgendaItems.$inferInsert
  amendmentIds: readonly string[]
  billIds: readonly string[]
  materialIds: readonly string[]
  /** Explicit source identifiers only; never inferred from agenda prose. */
  billReferences?: readonly { identifier: string; sessionId: string; jurisdictionId: string }[]
}

/** Reconcile unchanged admitted snapshots. Readiness refresh is explicit; source facts are never rewritten. */
export async function reconcileEventSnapshotRelationships(
  database: LegislationDatabase,
  snapshots: readonly EventSnapshot[],
  options: { refreshReadiness?: boolean } = {}
) {
  if (snapshots.length === 0) {
    return { events: 0, billLinks: 0, organizationLinks: 0 }
  }
  const prepared = await prepareEventSnapshots(database, snapshots)
  const ids = prepared.map((item) => item.event.id)
  if (new Set(ids).size !== ids.length) {
    throw new Error("Duplicate event reconciliation identity")
  }
  const evidenceKey = (event: EventSnapshot["event"]) => [
    event.id,
    event.sourceId ?? null,
    event.sourceUrl ?? null,
    event.startAt?.toISOString() ?? null,
    event.name,
    event.status,
    event.jurisdictionId,
    event.classification ?? null,
    event.description ?? null,
    event.endAt?.toISOString() ?? null,
    event.publisherLocalDate ?? null,
    event.location ?? null,
    event.virtualAccess ?? null,
    event.isRemote ?? null,
    event.allDay ?? false,
    event.isDeleted ?? false
  ]
  return database.transaction(async (transaction) => {
    await transaction.execute(
      sql`select set_config('statement_timeout', '60000', true), set_config('lock_timeout', '10000', true)`
    )
    const existing = await transaction
      .select()
      .from(legislativeEvents)
      .where(inArray(legislativeEvents.id, ids))
      .for("update")
    if (
      existing.length !== prepared.length ||
      prepared.some((item) => !existing.some((row) => isDeepStrictEqual(evidenceKey(row), evidenceKey(item.event))))
    ) {
      throw new Error("Event changed or is missing; refuse relationship reconciliation")
    }
    const agenda = prepared.flatMap((item) => item.agendaItems)
    const expectedAgenda = agenda.map((item) => item.agendaItem.id).sort()
    const storedAgenda = await transaction
      .select({ id: eventAgendaItems.id })
      .from(eventAgendaItems)
      .where(inArray(eventAgendaItems.eventId, ids))
    if (JSON.stringify(storedAgenda.map((item) => item.id).sort()) !== JSON.stringify(expectedAgenda)) {
      throw new Error("Agenda changed; refuse relationship reconciliation")
    }
    const links = agendaItemLinkRows(agenda).billLinks
    const organizationLinks = prepared.flatMap((item) =>
      (item.organizationIds ?? []).map((organizationId) => ({ eventId: item.event.id, organizationId }))
    )
    if (expectedAgenda.length) {
      await transaction.delete(eventAgendaItemBills).where(inArray(eventAgendaItemBills.agendaItemId, expectedAgenda))
    }
    await transaction.delete(eventOrganizations).where(inArray(eventOrganizations.eventId, ids))
    if (links.length) {
      await transaction.insert(eventAgendaItemBills).values(links)
    }
    if (organizationLinks.length) {
      await transaction.insert(eventOrganizations).values(organizationLinks)
    }
    if (options.refreshReadiness) {
      await transaction.delete(eventSessions).where(inArray(eventSessions.eventId, ids))
      const sessionLinks = prepared.flatMap((item) =>
        (item.sessionIds ?? []).map((sessionId) => ({ eventId: item.event.id, sessionId }))
      )
      if (sessionLinks.length) {
        await transaction.insert(eventSessions).values(sessionLinks)
      }
      for (const item of prepared) {
        await transaction
          .update(legislativeEvents)
          .set({
            canonicalFactsComplete: item.event.canonicalFactsComplete === true,
            sessionRelationsComplete: item.event.sessionRelationsComplete === true,
            organizationRelationsComplete: item.event.organizationRelationsComplete === true
          })
          .where(eq(legislativeEvents.id, item.event.id))
      }
    }
    return { events: prepared.length, billLinks: links.length, organizationLinks: organizationLinks.length }
  })
}

export async function upsertEventSnapshots(
  database: LegislationDatabase,
  snapshots: readonly EventSnapshot[],
  options: {
    receipt?: { source: string; stream: string; cursor: Record<string, unknown> }
    ownership?: BillBatchOwnership
  } = {}
): Promise<void> {
  if (
    options.ownership &&
    (!options.receipt ||
      (options.receipt.source === options.ownership.source && options.receipt.stream === options.ownership.stream))
  ) {
    throw new Error("Owned event promotion requires a separate immutable receipt")
  }
  if (snapshots.length === 0) {
    if (options.receipt) {
      throw new Error("Cannot receipt an empty event batch")
    }
    return
  }
  const preparedSnapshots = await prepareEventSnapshots(database, snapshots)
  const eventIds = preparedSnapshots.map((snapshot) => snapshot.event.id)
  await database.transaction(async (transaction) => {
    if (options.receipt && (await promotionAlreadyCommitted(transaction, options.receipt))) {
      return
    }
    if (options.ownership) {
      await assertBillBatchOwnership(transaction, options.ownership)
    }
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
    if (options.receipt) {
      await transaction.insert(syncCheckpoints).values({ ...options.receipt, updatedAt: new Date() })
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
  const references = snapshots.flatMap((snapshot) => snapshot.agendaItems.flatMap((item) => item.billReferences ?? []))
  const candidates =
    references.length === 0
      ? []
      : await database
          .select({
            id: bills.id,
            identifier: bills.identifier,
            sessionId: bills.sessionId,
            jurisdictionId: bills.jurisdictionId
          })
          .from(bills)
          .where(inArray(bills.sessionId, [...new Set(references.map((item) => item.sessionId))]))
  snapshots = resolveAgendaBillReferences(snapshots, candidates)
  const organizationReferenceScopes = [
    ...new Set(snapshots.filter((item) => item.organizationReferences?.length).map((item) => item.event.jurisdictionId))
  ]
  const organizationCandidates =
    organizationReferenceScopes.length === 0
      ? []
      : await database
          .select({
            id: organizations.id,
            jurisdictionId: organizations.jurisdictionId,
            upstreamIds: organizations.upstreamIds
          })
          .from(organizations)
          .where(inArray(organizations.jurisdictionId, organizationReferenceScopes))
  snapshots = resolveEventOrganizationReferences(snapshots, organizationCandidates)
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
