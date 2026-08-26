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
type OrganizationMembershipRow = typeof organizationMemberships.$inferSelect

function uniqueById<T extends { id: string }>(values: readonly T[]): T[] {
  return [...new Map(values.map((value) => [value.id, value])).values()]
}

function membershipContinuityKey(
  membership: Pick<OrganizationMembershipInsert, "id" | "organizationId" | "sourceId">
): string {
  const sourceIdentity = membership.sourceId?.trim() || membership.id
  return `${membership.organizationId}\u0000${sourceIdentity}`
}

function resolveMembershipTenures(
  incomingMemberships: readonly OrganizationMembershipInsert[],
  existingMemberships: readonly OrganizationMembershipRow[]
): OrganizationMembershipInsert[] {
  const incomingKeys = new Set<string>()
  const existingByKey = new Map<string, OrganizationMembershipRow[]>()
  for (const membership of existingMemberships) {
    const key = membershipContinuityKey(membership)
    const group = existingByKey.get(key) ?? []
    group.push(membership)
    existingByKey.set(key, group)
  }

  return incomingMemberships.map((membership) => {
    const key = membershipContinuityKey(membership)
    if (incomingKeys.has(key)) {
      throw new Error(
        `Entity snapshot contains duplicate membership source identity ${membership.sourceId ?? membership.id}`
      )
    }
    incomingKeys.add(key)

    const history = existingByKey.get(key) ?? []
    const activeTenures = history.filter((existing) => existing.isActive === true)
    if (activeTenures.length > 1) {
      throw new Error(
        `Entity snapshot found multiple active tenures for membership ${membership.sourceId ?? membership.id}`
      )
    }
    const activeTenure = activeTenures[0]
    if (activeTenure !== undefined) {
      return {
        ...membership,
        endDate: membership.endDate ?? activeTenure.endDate,
        id: activeTenure.id,
        startDate: membership.startDate ?? activeTenure.startDate,
        tenureOrdinal: activeTenure.tenureOrdinal
      }
    }

    const tenureOrdinal = history.reduce((maximum, existing) => Math.max(maximum, existing.tenureOrdinal), 0) + 1
    return {
      ...membership,
      id: tenureOrdinal === 1 ? membership.id : `${membership.id}:tenure:${tenureOrdinal}`,
      tenureOrdinal
    }
  })
}

export async function replaceEntitySnapshot(
  database: LegislationDatabase,
  jurisdictionId: string,
  snapshot: EntitySnapshot,
  options: Readonly<{
    membershipObservedAt?: string
    organizationSourceProvider?: string
    replaceOrganizations?: boolean
    replacePeople?: boolean
  }> = {}
): Promise<void> {
  const personValues = uniqueById(snapshot.people)
  const organizationValues = uniqueById(snapshot.organizations)
  const termValues = uniqueById(snapshot.terms)
  const incomingMembershipValues = uniqueById(snapshot.memberships)
  if (options.membershipObservedAt !== undefined && !isIsoDate(options.membershipObservedAt)) {
    throw new Error("Membership observation date must use YYYY-MM-DD")
  }
  if (options.organizationSourceProvider?.trim().length === 0) {
    throw new Error("Organization source provider must not be empty")
  }
  if (
    options.organizationSourceProvider !== undefined &&
    organizationValues.some((organization) => organization.sourceProvider !== options.organizationSourceProvider)
  ) {
    throw new Error("Provider-scoped organization replacement cannot contain another provider")
  }
  if (
    options.replaceOrganizations === false &&
    (organizationValues.length > 0 || incomingMembershipValues.length > 0)
  ) {
    throw new Error("A people-only entity snapshot cannot contain organizations or memberships")
  }
  if (
    options.replacePeople === false &&
    (personValues.length > 0 ||
      termValues.length > 0 ||
      snapshot.personAliases.length > 0 ||
      snapshot.personAliasPersonIds.length > 0 ||
      (snapshot.personDetails?.length ?? 0) > 0 ||
      (snapshot.personDetailPersonIds?.length ?? 0) > 0 ||
      (snapshot.personExternalIdentifiers?.length ?? 0) > 0 ||
      (snapshot.personJurisdictions?.length ?? 0) > 0 ||
      (snapshot.termPersonIds?.length ?? 0) > 0)
  ) {
    throw new Error("An organization-only entity snapshot cannot contain people or terms")
  }
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
    const replacedOrganizationIds =
      options.replaceOrganizations === false
        ? []
        : await transaction
            .select({ id: organizations.id })
            .from(organizations)
            .where(
              options.organizationSourceProvider === undefined
                ? eq(organizations.jurisdictionId, jurisdictionId)
                : and(
                    eq(organizations.jurisdictionId, jurisdictionId),
                    eq(organizations.sourceProvider, options.organizationSourceProvider)
                  )
            )
    if (options.replacePeople !== false) {
      await transaction
        .update(people)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(people.jurisdictionId, jurisdictionId), sql`${people.sourceId} is not null`))
      await transaction
        .update(legislativeTerms)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(legislativeTerms.jurisdictionId, jurisdictionId))
    }
    if (options.replaceOrganizations !== false) {
      await transaction
        .update(organizations)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          options.organizationSourceProvider === undefined
            ? eq(organizations.jurisdictionId, jurisdictionId)
            : and(
                eq(organizations.jurisdictionId, jurisdictionId),
                eq(organizations.sourceProvider, options.organizationSourceProvider)
              )
        )
    }

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
    const completeMembershipOrganizationIds = [
      ...new Set([
        ...organizationValues
          .filter((organization) => organization.membershipRelationsComplete === true)
          .map((organization) => organization.id),
        ...(options.organizationSourceProvider === undefined ? [] : replacedOrganizationIds.map(({ id }) => id))
      ])
    ]
    let membershipValues = incomingMembershipValues
    if (organizationIds.length > 0) {
      await transaction
        .select({ id: organizations.id })
        .from(organizations)
        .where(inArray(organizations.id, organizationIds))
        .for("update")
      const existingMembershipValues = await transaction
        .select()
        .from(organizationMemberships)
        .where(inArray(organizationMemberships.organizationId, organizationIds))
      membershipValues = resolveMembershipTenures(incomingMembershipValues, existingMembershipValues)
    }
    if (completeMembershipOrganizationIds.length > 0) {
      await transaction
        .update(organizationMemberships)
        .set({
          ...(options.membershipObservedAt === undefined
            ? {}
            : { endDate: sql`coalesce(${organizationMemberships.endDate}, ${options.membershipObservedAt})` }),
          isActive: false,
          updatedAt: new Date()
        })
        .where(inArray(organizationMemberships.organizationId, completeMembershipOrganizationIds))
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
            tenureOrdinal: sql`excluded.tenure_ordinal`,
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

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
