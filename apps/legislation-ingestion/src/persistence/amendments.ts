import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  amendmentActions,
  amendments,
  bills,
  people,
  supportingMaterialLinks,
  supportingMaterials
} from "@repo/legislation-core/database/schema/schema"
import { eq, inArray, sql } from "drizzle-orm"
import type { CongressAmendmentSnapshot } from "../ingestion/congress/amendments.js"
import { observeCanonicalRecord } from "./changes.js"

export async function upsertCongressAmendmentSnapshot(
  database: LegislationDatabase,
  snapshot: CongressAmendmentSnapshot
): Promise<void> {
  const billId = snapshot.amendment.billId ?? undefined
  const sponsorPersonId = snapshot.amendment.sponsorPersonId ?? undefined
  const bill =
    billId === undefined
      ? undefined
      : await database.select({ id: bills.id }).from(bills).where(eq(bills.id, billId)).limit(1)
  const sponsor =
    sponsorPersonId === undefined
      ? undefined
      : await database.select({ id: people.id }).from(people).where(eq(people.id, sponsorPersonId)).limit(1)
  await database.transaction(async (transaction) => {
    const persistedAmendment = {
      ...snapshot.amendment,
      billId: bill?.[0]?.id,
      sponsorPersonId: sponsor?.[0]?.id
    }
    await transaction
      .insert(amendments)
      .values(persistedAmendment)
      .onConflictDoUpdate({
        set: {
          amendmentNumber: sql`excluded.amendment_number`,
          amendmentType: sql`excluded.amendment_type`,
          billId: sql`excluded.bill_id`,
          chamber: sql`excluded.chamber`,
          description: sql`excluded.description`,
          printedIdentifier: sql`excluded.printed_identifier`,
          purpose: sql`excluded.purpose`,
          sessionId: sql`excluded.session_id`,
          sourceUpdatedAt: sql`excluded.source_updated_at`,
          sourceUrl: sql`excluded.source_url`,
          sponsorName: sql`excluded.sponsor_name`,
          sponsorPersonId: sql`excluded.sponsor_person_id`,
          sponsorSourceId: sql`excluded.sponsor_source_id`,
          status: sql`excluded.status`,
          submittedDate: sql`excluded.submitted_date`,
          updatedAt: new Date(),
          upstreamIds: sql`${amendments.upstreamIds} || excluded.upstream_ids`
        },
        target: amendments.id
      })
    await transaction.delete(amendmentActions).where(eq(amendmentActions.amendmentId, snapshot.amendment.id))
    if (snapshot.actions.length > 0) {
      await transaction.insert(amendmentActions).values(snapshot.actions)
    }
    const previousMaterials = await transaction
      .select({ materialId: supportingMaterialLinks.materialId })
      .from(supportingMaterialLinks)
      .where(eq(supportingMaterialLinks.amendmentId, snapshot.amendment.id))
    await transaction
      .delete(supportingMaterialLinks)
      .where(eq(supportingMaterialLinks.amendmentId, snapshot.amendment.id))
    if (previousMaterials.length > 0) {
      await transaction.delete(supportingMaterials).where(
        inArray(
          supportingMaterials.id,
          previousMaterials.map((item) => item.materialId)
        )
      )
    }
    const materialIds = snapshot.materials.map((item) => item.material.id)
    if (materialIds.length > 0) {
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
      await transaction.insert(supportingMaterialLinks).values(
        snapshot.materials.map((item) => ({
          ...item.link,
          billId: bill?.[0]?.id
        }))
      )
    }
    await observeCanonicalRecord(transaction, {
      fields: {
        billId: persistedAmendment.billId,
        description: persistedAmendment.description,
        purpose: persistedAmendment.purpose,
        sponsorPersonId: persistedAmendment.sponsorPersonId,
        status: persistedAmendment.status,
        submittedDate: persistedAmendment.submittedDate
      },
      jurisdictionId: persistedAmendment.jurisdictionId,
      personId: persistedAmendment.sponsorPersonId,
      recordId: persistedAmendment.id,
      recordType: "amendment",
      sourceUpdatedAt: persistedAmendment.sourceUpdatedAt ?? undefined
    })
  })
}
