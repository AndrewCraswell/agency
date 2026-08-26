import type { LegislationDatabase } from "../db/database.js"
import {
  getBillDetailRead,
  listBillVoteReads,
  type BillDetailPage,
  type BillDetailReadInput,
  type BillVoteReadInput
} from "../db/queries/bill-detail-read.js"
import type { BillDetail, VoteDetail } from "./canonical-projection.js"

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
