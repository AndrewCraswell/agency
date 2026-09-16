import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  bills,
  eventBills,
  organizations,
  supportingMaterialLinks,
  supportingMaterials
} from "@repo/legislation-core/database/schema/schema"
import { eq, inArray, sql } from "drizzle-orm"
import type { CongressEventSnapshot } from "../ingestion/congress/events.js"
import { upsertEventSnapshots } from "./events.js"

export async function upsertCongressEventSnapshot(
  database: LegislationDatabase,
  snapshot: CongressEventSnapshot
): Promise<void> {
  const organizationIds = snapshot.participants.flatMap((participant) =>
    participant.organizationId === undefined || participant.organizationId === null ? [] : [participant.organizationId]
  )
  const existingOrganizations =
    organizationIds.length === 0
      ? []
      : await database
          .select({ id: organizations.id })
          .from(organizations)
          .where(inArray(organizations.id, organizationIds))
  const validOrganizationIds = new Set(existingOrganizations.map((item) => item.id))
  const normalized: CongressEventSnapshot = {
    ...snapshot,
    participants: snapshot.participants.map((participant) => ({
      ...participant,
      organizationId:
        participant.organizationId !== null &&
        participant.organizationId !== undefined &&
        validOrganizationIds.has(participant.organizationId)
          ? participant.organizationId
          : undefined
    }))
  }
  await upsertEventSnapshots(database, [normalized])
  const existingBills =
    snapshot.billIds.length === 0
      ? []
      : await database.select({ id: bills.id }).from(bills).where(inArray(bills.id, snapshot.billIds))
  await database.transaction(async (transaction) => {
    await transaction.delete(eventBills).where(eq(eventBills.eventId, snapshot.event.id))
    if (existingBills.length > 0) {
      await transaction
        .insert(eventBills)
        .values(
          existingBills.map((bill) => ({ billId: bill.id, classification: "related", eventId: snapshot.event.id }))
        )
    }
    if (snapshot.materials.length > 0) {
      await transaction
        .insert(supportingMaterials)
        .values(snapshot.materials.map((item) => item.material))
        .onConflictDoUpdate({
          set: {
            classification: sql`excluded.classification`,
            contentType: sql`excluded.content_type`,
            documentDate: sql`excluded.document_date`,
            sourceUrl: sql`excluded.source_url`,
            title: sql`excluded.title`,
            updatedAt: new Date()
          },
          target: supportingMaterials.id
        })
      const materialIds = snapshot.materials.map((item) => item.material.id)
      await transaction.delete(supportingMaterialLinks).where(inArray(supportingMaterialLinks.materialId, materialIds))
      await transaction.insert(supportingMaterialLinks).values(snapshot.materials.map((item) => item.link))
    }
  })
}
