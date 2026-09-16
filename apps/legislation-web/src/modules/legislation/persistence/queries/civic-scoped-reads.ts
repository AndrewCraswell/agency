import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  legislativeTerms,
  organizationMemberships,
  organizations,
  people
} from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, eq } from "drizzle-orm"

export interface PersonTermRead {
  term: Pick<
    typeof legislativeTerms.$inferSelect,
    | "createdAt"
    | "district"
    | "endDate"
    | "id"
    | "isActive"
    | "jurisdictionId"
    | "officeTitle"
    | "organizationId"
    | "personId"
    | "provenanceComplete"
    | "sourceIsOfficial"
    | "sourceProvider"
    | "sourceRetrievedAt"
    | "sourceUpdatedAt"
    | "sourceUrl"
    | "startDate"
    | "updatedAt"
  >
}

export interface OrganizationMembershipRead {
  membership: Pick<
    typeof organizationMemberships.$inferSelect,
    | "createdAt"
    | "detectedEndDate"
    | "detectedStartDate"
    | "effectiveEndDate"
    | "effectiveStartDate"
    | "endedReason"
    | "id"
    | "isActive"
    | "label"
    | "lastObservedDate"
    | "legislativeSessionId"
    | "organizationId"
    | "personId"
    | "provenanceComplete"
    | "role"
    | "sourceIsOfficial"
    | "sourceProvider"
    | "sourceRetrievedAt"
    | "sourceUpdatedAt"
    | "sourceUrl"
    | "updatedAt"
  >
  organization: Pick<
    typeof organizations.$inferSelect,
    | "chamber"
    | "classification"
    | "createdAt"
    | "id"
    | "isActive"
    | "jurisdictionId"
    | "name"
    | "parentOrganizationId"
    | "provenanceComplete"
    | "sourceIsOfficial"
    | "sourceProvider"
    | "sourceRetrievedAt"
    | "sourceUpdatedAt"
    | "sourceUrl"
    | "updatedAt"
  >
  person: Pick<
    typeof people.$inferSelect,
    | "createdAt"
    | "familyName"
    | "givenName"
    | "id"
    | "isActive"
    | "jurisdictionId"
    | "name"
    | "party"
    | "provenanceComplete"
    | "sourceIsOfficial"
    | "sourceProvider"
    | "sourceRetrievedAt"
    | "sourceUpdatedAt"
    | "sourceUrl"
    | "updatedAt"
  >
}

export interface PersonTermLookup {
  personId: string
  termId: string
}

export interface OrganizationMembershipLookup {
  membershipId: string
  organizationId: string
}

/** Binds a legislative term to its requested person instead of trusting the opaque term ID alone. */
export function buildPersonTermQuery(database: LegislationDatabase, input: PersonTermLookup) {
  return database
    .select({ term: legislativeTerms })
    .from(legislativeTerms)
    .where(
      and(
        eq(legislativeTerms.personId, requiredInputText(input.personId, "personId")),
        eq(legislativeTerms.id, requiredInputText(input.termId, "termId"))
      )
    )
    .limit(1)
}

export async function getPersonTerm(database: LegislationDatabase, input: PersonTermLookup): Promise<PersonTermRead> {
  const row = (await buildPersonTermQuery(database, input))[0]
  if (row === undefined) {
    throw new LegislationError("not_found", `Term ${input.termId} was not found for person ${input.personId}`)
  }
  return row
}

/** Binds a membership to its organization and supplies both canonical embedded records in one read. */
export function buildOrganizationMembershipQuery(database: LegislationDatabase, input: OrganizationMembershipLookup) {
  return database
    .select({ membership: organizationMemberships, organization: organizations, person: people })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
    .innerJoin(people, eq(organizationMemberships.personId, people.id))
    .where(
      and(
        eq(organizationMemberships.organizationId, requiredInputText(input.organizationId, "organizationId")),
        eq(organizationMemberships.id, requiredInputText(input.membershipId, "membershipId"))
      )
    )
    .limit(1)
}

export async function getOrganizationMembership(
  database: LegislationDatabase,
  input: OrganizationMembershipLookup
): Promise<OrganizationMembershipRead> {
  const row = (await buildOrganizationMembershipQuery(database, input))[0]
  if (row === undefined) {
    throw new LegislationError(
      "not_found",
      `Membership ${input.membershipId} was not found for organization ${input.organizationId}`
    )
  }
  return row
}

function requiredInputText(value: string, name: string): string {
  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new LegislationError("invalid_request", `${name} must not be empty`)
  }
  return normalized
}
