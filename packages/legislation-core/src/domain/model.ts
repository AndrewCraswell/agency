import type {
  billActions,
  billDocuments,
  billOrganizations,
  billRelations,
  billSponsors,
  bills,
  documentSections,
  jurisdictions,
  legislativeSessions,
  organizations,
  people,
  votePositions,
  votes
} from "../database/schema/schema"

export interface CanonicalVote {
  positions?: Array<typeof votePositions.$inferInsert>
  vote: typeof votes.$inferInsert
}

export interface CanonicalDocument {
  document: typeof billDocuments.$inferInsert
  sections?: Array<typeof documentSections.$inferInsert>
}

export interface CanonicalBillAggregate {
  actions?: Array<typeof billActions.$inferInsert>
  bill: typeof bills.$inferInsert
  documents?: CanonicalDocument[]
  jurisdiction: typeof jurisdictions.$inferInsert
  people?: Array<typeof people.$inferInsert>
  organizations?: Array<typeof billOrganizations.$inferInsert>
  /** Source-resolved organization facts, inserted only when their entity does not exist. */
  organizationObservations?: Array<typeof organizations.$inferInsert>
  relations?: Array<typeof billRelations.$inferInsert>
  session: typeof legislativeSessions.$inferInsert
  sponsors?: Array<typeof billSponsors.$inferInsert>
  votes?: CanonicalVote[]
}
