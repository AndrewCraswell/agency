import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  legislativeTerms,
  people,
  personAliases,
  personDetails,
  personExternalIdentifiers,
  personJurisdictions
} from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { asc, desc, eq, sql } from "drizzle-orm"
import { listPersonMemberships, type PersonMembershipPage } from "./person-membership-reads"

export const PERSON_DETAIL_ALIAS_MAXIMUM = 250
export const PERSON_DETAIL_IDENTIFIER_MAXIMUM = 250
export const PERSON_DETAIL_JURISDICTION_MAXIMUM = 250
export const PERSON_DETAIL_TERM_MAXIMUM = 100
export const PERSON_DETAIL_MEMBERSHIP_LIMIT = 25

export interface PersonDetailRead {
  aliases: (typeof personAliases.$inferSelect)[]
  externalIdentifiers: (typeof personExternalIdentifiers.$inferSelect)[]
  jurisdictions: (typeof personJurisdictions.$inferSelect)[]
  memberships: PersonMembershipPage
  person: typeof people.$inferSelect
  profile: typeof personDetails.$inferSelect
  terms: (typeof legislativeTerms.$inferSelect)[]
}

/**
 * Reads the one bounded, source-complete projection needed by PersonDetail.
 * Empty fact collections are valid; a missing profile or an incomplete stored
 * fact is a data-integrity failure, never silently presented as absence.
 */
export async function getPersonDetailRead(database: LegislationDatabase, personId: string): Promise<PersonDetailRead> {
  const id = requiredId(personId)
  const person = await database.query.people.findFirst({ where: eq(people.id, id) })
  if (person === undefined) {
    throw new LegislationError("not_found", `Person ${id} was not found`)
  }
  const [profile, aliases, externalIdentifiers, jurisdictions, terms, memberships] = await Promise.all([
    database.query.personDetails.findFirst({ where: eq(personDetails.personId, id) }),
    database
      .select()
      .from(personAliases)
      .where(eq(personAliases.personId, id))
      .orderBy(asc(personAliases.name))
      .limit(251),
    database
      .select()
      .from(personExternalIdentifiers)
      .where(eq(personExternalIdentifiers.personId, id))
      .orderBy(asc(personExternalIdentifiers.scheme), asc(personExternalIdentifiers.value))
      .limit(251),
    database
      .select()
      .from(personJurisdictions)
      .where(eq(personJurisdictions.personId, id))
      .orderBy(asc(personJurisdictions.jurisdictionId), asc(personJurisdictions.sourceIdentity))
      .limit(251),
    database
      .select()
      .from(legislativeTerms)
      .where(eq(legislativeTerms.personId, id))
      .orderBy(
        asc(sql`${legislativeTerms.startDate} is null`),
        desc(legislativeTerms.startDate),
        asc(legislativeTerms.id)
      )
      .limit(101),
    listPersonMemberships(database, { limit: PERSON_DETAIL_MEMBERSHIP_LIMIT, personId: id })
  ])
  if (profile === undefined) {
    throw new LegislationError("unprocessable", "person detail profile has not been authoritatively collected")
  }
  if (
    aliases.length > PERSON_DETAIL_ALIAS_MAXIMUM ||
    externalIdentifiers.length > PERSON_DETAIL_IDENTIFIER_MAXIMUM ||
    jurisdictions.length === 0 ||
    jurisdictions.length > PERSON_DETAIL_JURISDICTION_MAXIMUM ||
    terms.length > PERSON_DETAIL_TERM_MAXIMUM
  ) {
    throw new LegislationError("unprocessable", "person detail exceeds the documented source collection bounds")
  }
  assertCompletePerson(person)
  assertComplete(profile, "person detail profile")
  aliases.forEach((row) => assertComplete(row, "person alias"))
  externalIdentifiers.forEach((row) => assertComplete(row, "person external identifier"))
  jurisdictions.forEach((row) => assertComplete(row, "person jurisdiction"))
  terms.forEach((row) => {
    assertComplete(row, "person legislative term")
    if (row.officeTitle === null || row.officeTitle.trim().length === 0 || row.isActive === null) {
      throw new LegislationError("unprocessable", "person legislative term lacks canonical office facts")
    }
  })
  return { aliases, externalIdentifiers, jurisdictions, memberships, person, profile, terms }
}

function assertCompletePerson(row: typeof people.$inferSelect): void {
  assertComplete(row, "person")
  if (row.isActive === null || row.name.trim().length === 0) {
    throw new LegislationError("unprocessable", "person lacks canonical summary facts")
  }
}

function assertComplete(
  row: Readonly<{
    provenanceComplete: boolean
    sourceIsOfficial: boolean | null
    sourceProvider: string | null
    sourceRetrievedAt: Date | null
    sourceUrl: string | null
  }>,
  label: string
): void {
  if (
    !row.provenanceComplete ||
    row.sourceIsOfficial === null ||
    row.sourceProvider === null ||
    row.sourceProvider.trim().length === 0 ||
    row.sourceRetrievedAt === null ||
    row.sourceUrl === null ||
    !row.sourceUrl.startsWith("https://")
  ) {
    throw new LegislationError("unprocessable", `${label} provenance is incomplete`)
  }
}

function requiredId(value: string): string {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > 256) {
    throw new LegislationError("invalid_request", "personId must be between 1 and 256 characters")
  }
  return normalized
}
