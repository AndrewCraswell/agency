import { withReadOnlyDatabase } from "@repo/legislation-core/database/database"
import {
  jurisdictions,
  people,
  personDetails,
  personExternalIdentifiers
} from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, eq, inArray } from "drizzle-orm"
import type pg from "pg"
import type { RepresentativeIdentifier } from "../../services/geocodio/geocodio"
import { representativeProfileSchema } from "./contracts"
import type { ProfileMatch, RepresentativeDirectoryReader } from "./representativeLookup"

const profileSelection = {
  id: people.id,
  name: people.name,
  party: people.party,
  imageUrl: personDetails.imageUrl,
  officialUrl: personDetails.officialUrl
}

export function createRepresentativeDirectoryReader(pool: pg.Pool): RepresentativeDirectoryReader {
  return async (identifiers, jurisdictionIds, signal) =>
    await withReadOnlyDatabase(
      pool,
      5000,
      async (database) => {
        const storedJurisdictions = await database
          .select({ id: jurisdictions.id, name: jurisdictions.name })
          .from(jurisdictions)
          .where(inArray(jurisdictions.id, [...jurisdictionIds]))
        const values = [...new Set(identifiers.map((identifier) => identifier.value))]
        if (!values.length) {
          return { jurisdictions: storedJurisdictions, profiles: [] }
        }
        const profileJoin = and(eq(personDetails.personId, people.id), eq(personDetails.provenanceComplete, true))
        const eligibility = and(
          eq(people.provenanceComplete, true),
          eq(people.isActive, true),
          inArray(people.jurisdictionId, [...jurisdictionIds])
        )
        const primary = await database
          .select({
            profile: profileSelection,
            jurisdictionId: people.jurisdictionId,
            provider: people.sourceProvider,
            value: people.sourceId
          })
          .from(people)
          .innerJoin(personDetails, profileJoin)
          .where(and(eligibility, inArray(people.sourceId, values)))
          .limit(101)
        const external = await database
          .select({
            profile: profileSelection,
            jurisdictionId: people.jurisdictionId,
            scheme: personExternalIdentifiers.scheme,
            value: personExternalIdentifiers.value
          })
          .from(people)
          .innerJoin(personDetails, profileJoin)
          .innerJoin(personExternalIdentifiers, eq(personExternalIdentifiers.personId, people.id))
          .where(
            and(
              eligibility,
              eq(personExternalIdentifiers.provenanceComplete, true),
              inArray(personExternalIdentifiers.value, values)
            )
          )
          .limit(101)
        if (primary.length > 100 || external.length > 100) {
          throw new LegislationError(
            "dependency_unavailable",
            "Representative identity matches exceeded the safe limit."
          )
        }
        const profiles: ProfileMatch[] = []
        for (const row of [
          ...primary.map(({ provider, ...row }) => ({
            ...row,
            scheme: identifierScheme(provider)
          })),
          ...external
        ]) {
          const identifier = findIdentifier(identifiers, row.scheme, row.value)
          if (identifier && row.jurisdictionId) {
            profiles.push({
              identifier,
              jurisdictionId: row.jurisdictionId,
              profile: representativeProfileSchema.parse(row.profile)
            })
          }
        }
        return { jurisdictions: storedJurisdictions, profiles }
      },
      signal
    )
}

function findIdentifier(identifiers: readonly RepresentativeIdentifier[], scheme: string | null, value: string | null) {
  return identifiers.find((identifier) => identifier.scheme === scheme && identifier.value === value)
}

function identifierScheme(provider: string | null) {
  if (provider === "congress") {
    return "bioguide"
  }
  return provider === "openstates" ? "openstates" : null
}
