import { eq } from "drizzle-orm"
import type { LegislationDatabase } from "./database.js"
import { bills } from "./schema/schema.js"

export async function getBillById(database: LegislationDatabase, canonicalBillId: string) {
  return database.query.bills.findFirst({ where: eq(bills.id, canonicalBillId) })
}
