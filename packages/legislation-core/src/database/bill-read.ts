import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { bills } from "@repo/legislation-core/database/schema/schema"
import { eq } from "drizzle-orm"

export async function getBillById(database: LegislationDatabase, canonicalBillId: string) {
  return database.query.bills.findFirst({ where: eq(bills.id, canonicalBillId) })
}
