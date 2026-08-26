import type {
  legislativeTerms,
  organizationMemberships,
  organizations,
  people,
  personAliases,
  personDetails,
  personExternalIdentifiers,
  personJurisdictions
} from "../db/schema/schema.js"

type MembershipInsert = typeof organizationMemberships.$inferInsert
type OrganizationInsert = typeof organizations.$inferInsert
type PersonAliasInsert = typeof personAliases.$inferInsert
type PersonDetailInsert = typeof personDetails.$inferInsert
type PersonExternalIdentifierInsert = typeof personExternalIdentifiers.$inferInsert
type PersonInsert = typeof people.$inferInsert
type PersonJurisdictionInsert = typeof personJurisdictions.$inferInsert
type TermInsert = typeof legislativeTerms.$inferInsert

/** Provider-neutral canonical entity data collected for one jurisdiction snapshot. */
export interface EntitySnapshot {
  memberships: MembershipInsert[]
  organizations: OrganizationInsert[]
  personAliasPersonIds: string[]
  personAliases: PersonAliasInsert[]
  personDetailPersonIds?: string[]
  personDetailSourceProvider?: string
  personDetails?: PersonDetailInsert[]
  personExternalIdentifiers?: PersonExternalIdentifierInsert[]
  personJurisdictions?: PersonJurisdictionInsert[]
  people: PersonInsert[]
  terms: TermInsert[]
}
