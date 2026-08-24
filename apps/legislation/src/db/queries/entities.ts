import { and, eq, inArray, sql } from "drizzle-orm"
import type { OpenStatesEntitySnapshot } from "../../ingestion/openstates/entities.js"
import type { LegislationDatabase } from "../database.js"
import { legislativeTerms, organizationMemberships, organizations, people } from "../schema/schema.js"
import { observeCanonicalRecord } from "./changes.js"

function uniqueById<T extends { id: string }>(values: readonly T[]): T[] {
  return [...new Map(values.map((value) => [value.id, value])).values()]
}

export async function replaceEntitySnapshot(
  database: LegislationDatabase,
  jurisdictionId: string,
  snapshot: OpenStatesEntitySnapshot
): Promise<void> {
  const personValues = uniqueById(snapshot.people)
  const organizationValues = uniqueById(snapshot.organizations)
  const termValues = uniqueById(snapshot.terms)
  const membershipValues = uniqueById(snapshot.memberships)

  await database.transaction(async (transaction) => {
    await transaction
      .update(people)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(people.jurisdictionId, jurisdictionId), sql`${people.sourceId} is not null`))
    await transaction
      .update(legislativeTerms)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(legislativeTerms.jurisdictionId, jurisdictionId))
    await transaction
      .update(organizations)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(organizations.jurisdictionId, jurisdictionId))

    if (personValues.length > 0) {
      await transaction
        .insert(people)
        .values(personValues)
        .onConflictDoUpdate({
          set: {
            familyName: sql`excluded.family_name`,
            givenName: sql`excluded.given_name`,
            isActive: sql`excluded.is_active`,
            jurisdictionId: sql`excluded.jurisdiction_id`,
            name: sql`excluded.name`,
            party: sql`excluded.party`,
            sourceId: sql`excluded.source_id`,
            sourceUpdatedAt: sql`excluded.source_updated_at`,
            sourceUrl: sql`excluded.source_url`,
            updatedAt: new Date(),
            upstreamIds: sql`${people.upstreamIds} || excluded.upstream_ids`
          },
          target: people.id
        })
    }
    if (organizationValues.length > 0) {
      await transaction
        .insert(organizations)
        .values(organizationValues)
        .onConflictDoUpdate({
          set: {
            chamber: sql`excluded.chamber`,
            classification: sql`excluded.classification`,
            isActive: sql`excluded.is_active`,
            jurisdictionId: sql`excluded.jurisdiction_id`,
            name: sql`excluded.name`,
            parentOrganizationId: sql`excluded.parent_organization_id`,
            sourceId: sql`excluded.source_id`,
            sourceUpdatedAt: sql`excluded.source_updated_at`,
            sourceUrl: sql`excluded.source_url`,
            updatedAt: new Date(),
            // A full entity snapshot is authoritative for its Open States parent graph.
            // Replacing this object clears a now-resolved raw parent identity rather
            // than retaining it beside the canonical FK indefinitely.
            upstreamIds: sql`excluded.upstream_ids`
          },
          target: organizations.id
        })
    }
    if (termValues.length > 0) {
      await transaction
        .insert(legislativeTerms)
        .values(termValues)
        .onConflictDoUpdate({
          set: {
            chamber: sql`excluded.chamber`,
            district: sql`excluded.district`,
            endDate: sql`excluded.end_date`,
            isActive: sql`excluded.is_active`,
            organizationId: sql`excluded.organization_id`,
            party: sql`excluded.party`,
            role: sql`excluded.role`,
            sourceId: sql`excluded.source_id`,
            sourceUrl: sql`excluded.source_url`,
            startDate: sql`excluded.start_date`,
            updatedAt: new Date()
          },
          target: legislativeTerms.id
        })
    }

    const organizationIds = organizationValues.map((organization) => organization.id)
    if (organizationIds.length > 0) {
      await transaction
        .update(organizationMemberships)
        .set({ isActive: false, updatedAt: new Date() })
        .where(inArray(organizationMemberships.organizationId, organizationIds))
    }
    if (membershipValues.length > 0) {
      await transaction
        .insert(organizationMemberships)
        .values(membershipValues)
        .onConflictDoUpdate({
          set: {
            classification: sql`excluded.classification`,
            endDate: sql`excluded.end_date`,
            isActive: sql`excluded.is_active`,
            organizationId: sql`excluded.organization_id`,
            personId: sql`excluded.person_id`,
            rank: sql`excluded.rank`,
            sourceId: sql`excluded.source_id`,
            sourceUrl: sql`excluded.source_url`,
            startDate: sql`excluded.start_date`,
            title: sql`excluded.title`,
            updatedAt: new Date()
          },
          target: organizationMemberships.id
        })
    }
    for (const person of personValues) {
      await observeCanonicalRecord(transaction, {
        fields: {
          familyName: person.familyName,
          givenName: person.givenName,
          isActive: person.isActive,
          name: person.name,
          party: person.party
        },
        jurisdictionId,
        personId: person.id,
        recordId: person.id,
        recordType: "person",
        sourceUpdatedAt: person.sourceUpdatedAt ?? undefined
      })
    }
    for (const organization of organizationValues) {
      await observeCanonicalRecord(transaction, {
        fields: {
          chamber: organization.chamber,
          classification: organization.classification,
          isActive: organization.isActive,
          name: organization.name,
          parentOrganizationId: organization.parentOrganizationId
        },
        jurisdictionId,
        organizationId: organization.id,
        recordId: organization.id,
        recordType: "organization",
        sourceUpdatedAt: organization.sourceUpdatedAt ?? undefined
      })
    }
    for (const membership of membershipValues) {
      await observeCanonicalRecord(transaction, {
        fields: {
          classification: membership.classification,
          endDate: membership.endDate,
          isActive: membership.isActive,
          rank: membership.rank,
          startDate: membership.startDate,
          title: membership.title
        },
        changeType: "relationship-change",
        organizationId: membership.organizationId,
        personId: membership.personId,
        recordId: membership.id,
        recordType: "organization-membership"
      })
    }
  })
}
