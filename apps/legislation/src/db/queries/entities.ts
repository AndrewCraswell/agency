import { and, eq, inArray, sql } from "drizzle-orm"
import type { EntitySnapshot } from "../../ingestion/entity-snapshot.js"
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

type OrganizationMembershipInsert = typeof organizationMemberships.$inferInsert

/**
 * An authoritative current roster for exactly the listed organizations in one
 * jurisdiction. It deliberately does not infer coverage from parser output.
 */
export interface AuthoritativeOrganizationMembershipRoster {
  jurisdictionId: string
  memberships: readonly OrganizationMembershipInsert[]
  organizationIds: readonly string[]
}

function uniqueById<T extends { id: string }>(values: readonly T[]): T[] {
  return [...new Map(values.map((value) => [value.id, value])).values()]
}

/**
 * Replaces the active roster only for an explicitly authoritative organization
 * scope. The transaction first proves every organization and person belongs to
 * the declared jurisdiction, so a partial provider response cannot alter an
 * unrelated committee, chamber, or joint body.
 */
export async function replaceAuthoritativeOrganizationMembershipRoster(
  database: LegislationDatabase,
  input: AuthoritativeOrganizationMembershipRoster
): Promise<void> {
  const organizationIds = [...input.organizationIds]
  const memberships = [...input.memberships]

  await database.transaction(async (transaction) => {
    assertCompleteRosterScope(input.jurisdictionId, organizationIds, memberships)

    const coveredOrganizations = await transaction
      .select({ id: organizations.id })
      .from(organizations)
      .where(and(eq(organizations.jurisdictionId, input.jurisdictionId), inArray(organizations.id, organizationIds)))
    if (coveredOrganizations.length !== organizationIds.length) {
      throw new Error(`Authoritative organization roster contains organizations outside ${input.jurisdictionId}`)
    }

    const personIds = [...new Set(memberships.map((membership) => membership.personId))]
    if (personIds.length > 0) {
      const rosterPeople = await transaction
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.jurisdictionId, input.jurisdictionId), inArray(people.id, personIds)))
      if (rosterPeople.length !== personIds.length) {
        throw new Error(`Authoritative organization roster contains people outside ${input.jurisdictionId}`)
      }
    }

    await transaction
      .update(organizationMemberships)
      .set({ isActive: false, updatedAt: new Date() })
      .where(inArray(organizationMemberships.organizationId, organizationIds))

    if (memberships.length > 0) {
      await transaction
        .insert(organizationMemberships)
        .values(memberships)
        .onConflictDoUpdate({
          set: {
            classification: sql`excluded.classification`,
            endDate: sql`excluded.end_date`,
            isActive: sql`excluded.is_active`,
            label: sql`excluded.label`,
            organizationId: sql`excluded.organization_id`,
            personId: sql`excluded.person_id`,
            provenanceComplete: sql`excluded.provenance_complete`,
            rank: sql`excluded.rank`,
            role: sql`excluded.role`,
            sourceId: sql`excluded.source_id`,
            sourceIsOfficial: sql`excluded.source_is_official`,
            sourceProvider: sql`excluded.source_provider`,
            sourceRetrievedAt: sql`excluded.source_retrieved_at`,
            sourceUpdatedAt: sql`excluded.source_updated_at`,
            sourceUrl: sql`excluded.source_url`,
            startDate: sql`excluded.start_date`,
            title: sql`excluded.title`,
            updatedAt: new Date()
          },
          target: organizationMemberships.id
        })
    }

    await transaction
      .update(organizations)
      .set({ membershipRelationsComplete: true, updatedAt: new Date() })
      .where(and(eq(organizations.jurisdictionId, input.jurisdictionId), inArray(organizations.id, organizationIds)))

    for (const membership of memberships) {
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

function assertCompleteRosterScope(
  jurisdictionId: string,
  organizationIds: readonly string[],
  memberships: readonly OrganizationMembershipInsert[]
): void {
  if (jurisdictionId.trim().length === 0) {
    throw new Error("Authoritative organization roster requires a jurisdiction")
  }
  if (organizationIds.length === 0) {
    throw new Error("Authoritative organization roster requires at least one covered organization")
  }
  if (
    new Set(organizationIds).size !== organizationIds.length ||
    organizationIds.some((id) => id.trim().length === 0)
  ) {
    throw new Error("Authoritative organization roster has duplicate or blank covered organizations")
  }

  const coveredOrganizationIds = new Set(organizationIds)
  const membershipIds = new Set<string>()
  const sourceIdentities = new Set<string>()
  for (const membership of memberships) {
    if (!isNonBlankString(membership.id) || !isNonBlankString(membership.personId)) {
      throw new Error("Authoritative organization roster has a membership without an identity")
    }
    if (!coveredOrganizationIds.has(membership.organizationId)) {
      throw new Error("Authoritative organization roster has a membership outside its covered organizations")
    }
    if (membershipIds.has(membership.id)) {
      throw new Error(`Authoritative organization roster has duplicate membership identity ${membership.id}`)
    }
    membershipIds.add(membership.id)
    if (
      membership.isActive !== true ||
      membership.provenanceComplete !== true ||
      membership.sourceIsOfficial !== true ||
      !isNonBlankString(membership.sourceId) ||
      !isNonBlankString(membership.sourceProvider) ||
      !isNonBlankString(membership.sourceUrl) ||
      !isValidDate(membership.sourceRetrievedAt)
    ) {
      throw new Error("Authoritative organization roster requires active, complete official membership provenance")
    }
    const sourceIdentity = `${membership.organizationId}\u0000${membership.sourceId}`
    if (sourceIdentities.has(sourceIdentity)) {
      throw new Error(
        `Authoritative organization roster has duplicate source membership identity ${membership.sourceId}`
      )
    }
    sourceIdentities.add(sourceIdentity)
  }
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

export async function replaceEntitySnapshot(
  database: LegislationDatabase,
  jurisdictionId: string,
  snapshot: EntitySnapshot
): Promise<void> {
  const personValues = uniqueById(snapshot.people)
  const organizationValues = uniqueById(snapshot.organizations)
  const termValues = uniqueById(snapshot.terms)
  const membershipValues = uniqueById(snapshot.memberships)
  const personAliasPersonIds = [...new Set(snapshot.personAliasPersonIds)]
  const personAliasValues = snapshot.personAliases
  const personDetailPersonIds = [...new Set(snapshot.personDetailPersonIds ?? [])]
  const personDetailSourceProvider = snapshot.personDetailSourceProvider
  const personDetailValues = snapshot.personDetails ?? []
  const personExternalIdentifierValues = snapshot.personExternalIdentifiers ?? []
  const personJurisdictionValues = snapshot.personJurisdictions ?? []
  const termPersonIds = [...new Set(snapshot.termPersonIds ?? [])]
  const termSourceProvider = snapshot.termSourceProvider

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
            provenanceComplete: sql`excluded.provenance_complete`,
            sourceId: sql`excluded.source_id`,
            sourceIsOfficial: sql`excluded.source_is_official`,
            sourceProvider: sql`excluded.source_provider`,
            sourceRetrievedAt: sql`excluded.source_retrieved_at`,
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
    if (personDetailPersonIds.length > 0 && personDetailSourceProvider !== undefined) {
      await transaction
        .delete(personDetails)
        .where(
          and(
            inArray(personDetails.personId, personDetailPersonIds),
            eq(personDetails.sourceProvider, personDetailSourceProvider)
          )
        )
      await transaction
        .delete(personExternalIdentifiers)
        .where(
          and(
            inArray(personExternalIdentifiers.personId, personDetailPersonIds),
            eq(personExternalIdentifiers.sourceProvider, personDetailSourceProvider)
          )
        )
      await transaction
        .delete(personJurisdictions)
        .where(
          and(
            inArray(personJurisdictions.personId, personDetailPersonIds),
            eq(personJurisdictions.sourceProvider, personDetailSourceProvider)
          )
        )
    }
    for (const [sourceProvider, values] of groupedBySourceProvider(personDetailValues)) {
      await transaction
        .insert(personDetails)
        .values(values)
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
          where: eq(personDetails.sourceProvider, sourceProvider)
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
    if (termPersonIds.length > 0 && termSourceProvider !== undefined) {
      await transaction
        .delete(legislativeTerms)
        .where(
          and(
            inArray(legislativeTerms.personId, termPersonIds),
            eq(legislativeTerms.sourceProvider, termSourceProvider)
          )
        )
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
            officeTitle: sql`excluded.office_title`,
            organizationId: sql`excluded.organization_id`,
            party: sql`excluded.party`,
            provenanceComplete: sql`excluded.provenance_complete`,
            role: sql`excluded.role`,
            sourceId: sql`excluded.source_id`,
            sourceIsOfficial: sql`excluded.source_is_official`,
            sourceProvider: sql`excluded.source_provider`,
            sourceRetrievedAt: sql`excluded.source_retrieved_at`,
            sourceUpdatedAt: sql`excluded.source_updated_at`,
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
            label: sql`excluded.label`,
            organizationId: sql`excluded.organization_id`,
            personId: sql`excluded.person_id`,
            provenanceComplete: sql`excluded.provenance_complete`,
            rank: sql`excluded.rank`,
            role: sql`excluded.role`,
            sourceId: sql`excluded.source_id`,
            sourceIsOfficial: sql`excluded.source_is_official`,
            sourceProvider: sql`excluded.source_provider`,
            sourceRetrievedAt: sql`excluded.source_retrieved_at`,
            sourceUpdatedAt: sql`excluded.source_updated_at`,
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

function groupedBySourceProvider<T extends { sourceProvider?: string | null }>(values: readonly T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const value of values) {
    const sourceProvider = value.sourceProvider
    if (sourceProvider === undefined || sourceProvider === null || sourceProvider.trim().length === 0) {
      throw new Error("Canonical person detail requires a source provider")
    }
    const group = groups.get(sourceProvider) ?? []
    group.push(value)
    groups.set(sourceProvider, group)
  }
  return groups
}
