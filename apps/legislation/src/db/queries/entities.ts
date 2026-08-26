import { and, eq, inArray, sql } from "drizzle-orm"
import type { OpenStatesEntitySnapshot } from "../../ingestion/openstates/entities.js"
import type { LegislationDatabase } from "../database.js"
import {
  legislativeTerms,
  organizationMemberships,
  organizations,
  people,
  personAliases,
  personDetails,
  personExternalIdentifiers,
  personJurisdictions
} from "../schema/schema.js"
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
  const personAliasPersonIds = [...new Set(snapshot.personAliasPersonIds)]
  const personAliasValues = snapshot.personAliases
  const personDetailPersonIds = [...new Set(snapshot.personDetailPersonIds ?? [])]
  const personDetailValues = snapshot.personDetails ?? []
  const personExternalIdentifierValues = snapshot.personExternalIdentifiers ?? []
  const personJurisdictionValues = snapshot.personJurisdictions ?? []

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
    if (personAliasPersonIds.length > 0) {
      await transaction
        .delete(personAliases)
        .where(
          and(inArray(personAliases.personId, personAliasPersonIds), eq(personAliases.sourceProvider, "openstates"))
        )
    }
    if (personAliasValues.length > 0) {
      await transaction
        .insert(personAliases)
        .values(personAliasValues)
        .onConflictDoUpdate({
          set: {
            name: sql`excluded.name`,
            provenanceComplete: sql`excluded.provenance_complete`,
            sourceIsOfficial: sql`excluded.source_is_official`,
            sourceProvider: sql`excluded.source_provider`,
            sourceRetrievedAt: sql`excluded.source_retrieved_at`,
            sourceUpdatedAt: sql`excluded.source_updated_at`,
            sourceUrl: sql`excluded.source_url`,
            updatedAt: new Date()
          },
          target: [personAliases.personId, personAliases.sourceIdentity]
        })
    }
    if (personDetailPersonIds.length > 0) {
      await transaction
        .delete(personDetails)
        .where(
          and(inArray(personDetails.personId, personDetailPersonIds), eq(personDetails.sourceProvider, "openstates"))
        )
      await transaction
        .delete(personExternalIdentifiers)
        .where(
          and(
            inArray(personExternalIdentifiers.personId, personDetailPersonIds),
            eq(personExternalIdentifiers.sourceProvider, "openstates")
          )
        )
      await transaction
        .delete(personJurisdictions)
        .where(
          and(
            inArray(personJurisdictions.personId, personDetailPersonIds),
            eq(personJurisdictions.sourceProvider, "openstates")
          )
        )
    }
    if (personDetailValues.length > 0) {
      await transaction
        .insert(personDetails)
        .values(personDetailValues)
        .onConflictDoUpdate({
          set: {
            imageUrl: sql`excluded.image_url`,
            officialUrl: sql`excluded.official_url`,
            provenanceComplete: sql`excluded.provenance_complete`,
            publicEmail: sql`excluded.public_email`,
            sourceIsOfficial: sql`excluded.source_is_official`,
            sourceProvider: sql`excluded.source_provider`,
            sourceRetrievedAt: sql`excluded.source_retrieved_at`,
            sourceUpdatedAt: sql`excluded.source_updated_at`,
            sourceUrl: sql`excluded.source_url`,
            updatedAt: new Date()
          },
          target: personDetails.personId,
          where: eq(personDetails.sourceProvider, "openstates")
        })
    }
    if (personExternalIdentifierValues.length > 0) {
      await transaction
        .insert(personExternalIdentifiers)
        .values(personExternalIdentifierValues)
        .onConflictDoUpdate({
          set: {
            provenanceComplete: sql`excluded.provenance_complete`,
            scheme: sql`excluded.scheme`,
            sourceIsOfficial: sql`excluded.source_is_official`,
            sourceProvider: sql`excluded.source_provider`,
            sourceRetrievedAt: sql`excluded.source_retrieved_at`,
            sourceUpdatedAt: sql`excluded.source_updated_at`,
            sourceUrl: sql`excluded.source_url`,
            updatedAt: new Date(),
            value: sql`excluded.value`
          },
          target: [personExternalIdentifiers.personId, personExternalIdentifiers.sourceIdentity]
        })
    }
    if (personJurisdictionValues.length > 0) {
      await transaction
        .insert(personJurisdictions)
        .values(personJurisdictionValues)
        .onConflictDoUpdate({
          set: {
            provenanceComplete: sql`excluded.provenance_complete`,
            sourceIsOfficial: sql`excluded.source_is_official`,
            sourceProvider: sql`excluded.source_provider`,
            sourceRetrievedAt: sql`excluded.source_retrieved_at`,
            sourceUpdatedAt: sql`excluded.source_updated_at`,
            sourceUrl: sql`excluded.source_url`,
            updatedAt: new Date()
          },
          target: [personJurisdictions.personId, personJurisdictions.jurisdictionId, personJurisdictions.sourceIdentity]
        })
    }
    if (organizationValues.length > 0) {
      await transaction
        .insert(organizations)
        .values(organizationValues)
        .onConflictDoUpdate({
          set: {
            chamber: sql`excluded.chamber`,
            childRelationsComplete: sql`excluded.child_relations_complete`,
            classification: sql`excluded.classification`,
            description: sql`excluded.description`,
            detailFactsComplete: sql`excluded.detail_facts_complete`,
            isActive: sql`excluded.is_active`,
            jurisdictionId: sql`excluded.jurisdiction_id`,
            membershipRelationsComplete: sql`excluded.membership_relations_complete`,
            name: sql`excluded.name`,
            parentOrganizationId: sql`excluded.parent_organization_id`,
            publicContactAddress: sql`excluded.public_contact_address`,
            publicContactEmail: sql`excluded.public_contact_email`,
            publicContactPhone: sql`excluded.public_contact_phone`,
            provenanceComplete: sql`excluded.provenance_complete`,
            sourceId: sql`excluded.source_id`,
            sourceIsOfficial: sql`excluded.source_is_official`,
            sourceProvider: sql`excluded.source_provider`,
            sourceRetrievedAt: sql`excluded.source_retrieved_at`,
            sourceUpdatedAt: sql`excluded.source_updated_at`,
            sourceUrl: sql`excluded.source_url`,
            termsOfReference: sql`excluded.terms_of_reference`,
            updatedAt: new Date(),
            // A full entity snapshot is authoritative for its Open States parent graph.
            // Replacing this object clears a now-resolved raw parent identity rather
            // than retaining it beside the canonical FK indefinitely.
            upstreamIds: sql`excluded.upstream_ids`,
            websiteUrl: sql`excluded.website_url`
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
          childRelationsComplete: organization.childRelationsComplete,
          classification: organization.classification,
          description: organization.description,
          detailFactsComplete: organization.detailFactsComplete,
          isActive: organization.isActive,
          membershipRelationsComplete: organization.membershipRelationsComplete,
          name: organization.name,
          parentOrganizationId: organization.parentOrganizationId,
          publicContactAddress: organization.publicContactAddress,
          publicContactEmail: organization.publicContactEmail,
          publicContactPhone: organization.publicContactPhone,
          termsOfReference: organization.termsOfReference,
          websiteUrl: organization.websiteUrl
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
