import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  getAmendmentRead,
  listAmendmentReads,
  type AmendmentReadInput,
  type AmendmentReadPage
} from "../../legislation/persistence/queries/amendment-reads.js"
import { assertBillExists } from "../../legislation/persistence/queries/document-reads.js"
import type { AmendmentDetail, AmendmentSummary } from "./canonical-projection.js"

export interface AmendmentReadRepository {
  assertBill: (billId: string) => Promise<void>
  getAmendment: (amendmentId: string) => Promise<AmendmentDetail>
  listAmendments: (input: AmendmentReadInput) => Promise<AmendmentReadPage<AmendmentSummary>>
}

export function createAmendmentReadRepository(
  database: LegislationDatabase,
  apiBaseUrl: string
): AmendmentReadRepository {
  return {
    assertBill: async (billId) => await assertBillExists(database, billId),
    getAmendment: async (amendmentId) => await getAmendmentRead(database, amendmentId, apiBaseUrl),
    listAmendments: async (input) => await listAmendmentReads(database, input, apiBaseUrl)
  }
}
