import type { LegislationDatabase } from "../db/database.js"
import {
  getBillDetailRead,
  listBillAmendmentReads,
  listBillVoteReads,
  type BillAmendmentReadInput,
  type BillDetailPage,
  type BillDetailReadInput,
  type BillVoteReadInput
} from "../db/queries/bill-detail-read.js"
import type { AmendmentSummary, BillDetail, VoteDetail } from "./canonical-projection.js"

export interface BillDetailReadRepository {
  getBillDetail(input: BillDetailReadInput): Promise<BillDetail>
  listBillAmendments(input: BillAmendmentReadInput): Promise<BillDetailPage<AmendmentSummary>>
  listBillVotes(input: BillVoteReadInput): Promise<BillDetailPage<VoteDetail>>
}

export function createBillDetailReadRepository(
  database: LegislationDatabase,
  apiBaseUrl: string
): BillDetailReadRepository {
  return {
    getBillDetail: async (input) => await getBillDetailRead(database, input, apiBaseUrl),
    listBillAmendments: async (input) => await listBillAmendmentReads(database, input, apiBaseUrl),
    listBillVotes: async (input) => await listBillVoteReads(database, input, apiBaseUrl)
  }
}
