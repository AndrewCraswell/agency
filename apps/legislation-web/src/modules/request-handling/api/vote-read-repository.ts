import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  getVoteRead,
  listPersonVotePositionReads,
  listVotePositionReads,
  listVoteReads,
  type PersonVoteListInput,
  type VoteListInput,
  type VotePositionListInput
} from "../../legislation/persistence/queries/vote-reads"
import type { VoteReadApi } from "./vote-read-routes"

export function createVoteReadRepository(database: LegislationDatabase): VoteReadApi {
  return {
    getVote: async (voteId) => await getVoteRead(database, voteId),
    listPersonVotePositions: async (input: PersonVoteListInput) => await listPersonVotePositionReads(database, input),
    listVotePositions: async (input: VotePositionListInput) => await listVotePositionReads(database, input),
    listVotes: async (input: VoteListInput) => await listVoteReads(database, input)
  }
}
