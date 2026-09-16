import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  bills,
  organizations,
  supportingMaterialLinks,
  supportingMaterials
} from "@repo/legislation-core/database/schema/schema"
import { inArray, sql } from "drizzle-orm"
import type { CongressCommitteeReportSnapshot } from "../ingestion/congress/reports.js"

export async function upsertCongressCommitteeReportSnapshot(
  database: LegislationDatabase,
  snapshot: CongressCommitteeReportSnapshot
): Promise<void> {
  const materials = [...new Map(snapshot.materials.map((item) => [item.material.id, item])).values()]
  const materialIds = materials.map((item) => item.material.id)
  if (materialIds.length === 0) {
    return
  }
  const proposedBillIds = materials.flatMap((item) => item.links.flatMap((link) => link.billId ?? []))
  const proposedOrganizationIds = materials.flatMap((item) => item.links.flatMap((link) => link.organizationId ?? []))
  const [knownBills, knownOrganizations] = await Promise.all([
    proposedBillIds.length === 0
      ? []
      : database.select({ id: bills.id }).from(bills).where(inArray(bills.id, proposedBillIds)),
    proposedOrganizationIds.length === 0
      ? []
      : database
          .select({ id: organizations.id })
          .from(organizations)
          .where(inArray(organizations.id, proposedOrganizationIds))
  ])
  const knownBillIds = new Set(knownBills.map((bill) => bill.id))
  const knownOrganizationIds = new Set(knownOrganizations.map((organization) => organization.id))
  const links = [
    ...new Map(
      materials
        .flatMap((item) => item.links)
        .filter(
          (link) =>
            (link.billId !== undefined && link.billId !== null && knownBillIds.has(link.billId)) ||
            (link.organizationId !== undefined &&
              link.organizationId !== null &&
              knownOrganizationIds.has(link.organizationId))
        )
        .map((link) => [
          `${link.materialId}\0${link.classification}\0${link.billId ?? ""}\0${link.organizationId ?? ""}`,
          link
        ])
    ).values()
  ]

  await database.transaction(async (transaction) => {
    await transaction
      .insert(supportingMaterials)
      .values(materials.map((item) => item.material))
      .onConflictDoUpdate({
        set: {
          classification: sql`excluded.classification`,
          contentType: sql`excluded.content_type`,
          documentDate: sql`excluded.document_date`,
          sourceUpdatedAt: sql`excluded.source_updated_at`,
          sourceUrl: sql`excluded.source_url`,
          title: sql`excluded.title`,
          updatedAt: new Date()
        },
        target: supportingMaterials.id
      })
    await transaction.delete(supportingMaterialLinks).where(inArray(supportingMaterialLinks.materialId, materialIds))
    if (links.length > 0) {
      await transaction.insert(supportingMaterialLinks).values(links)
    }
  })
}
