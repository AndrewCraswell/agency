import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  getBillDetailRead,
  listBillVoteReads,
  type BillDetailPage,
  type BillDetailReadInput,
  type BillVoteReadInput
} from "../../legislation/persistence/queries/bill-detail-read"
import type { BillDetail, VoteDetail } from "./canonical-projection"

export interface BillDetailReadRepository {
  getBillDetail(input: BillDetailReadInput): Promise<BillDetail>
  listBillVotes(input: BillVoteReadInput): Promise<BillDetailPage<VoteDetail>>
}

export function createBillDetailReadRepository(
  database: LegislationDatabase,
  apiBaseUrl: string
): BillDetailReadRepository {
  return {
    getBillDetail: async (input) => await getBillDetailRead(database, input, apiBaseUrl),
    listBillVotes: async (input) => await listBillVoteReads(database, input, apiBaseUrl)
  }
}
