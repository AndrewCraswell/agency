import { z } from "zod"
import type {
  legislativeTerms,
  organizationMemberships,
  organizations,
  people,
  personAliases,
  personDetails,
  personExternalIdentifiers,
  personJurisdictions
} from "../../db/schema/schema.js"
import {
  jurisdictionId,
  legislativeTermId,
  organizationId,
  organizationMembershipId,
  personId
} from "../../legislation/identifiers.js"
import { canonicalChamberSchema, canonicalOrganizationClassificationSchema } from "../civic-foundation.js"

const optionalString = z.preprocess(
  (value) => (value === null || (typeof value === "string" && value.trim().length === 0) ? undefined : value),
  z.string().trim().min(1).optional()
)
const optionalHttpsUrl = z.preprocess(
  (value) => (value === null || (typeof value === "string" && value.trim().length === 0) ? undefined : value),
  z.url({ protocol: /^https$/ }).optional()
)
const sourceSchema = z.object({ url: z.string().trim().min(1) }).passthrough()
const externalIdentifierSchema = z
  .object({
    identifier: optionalString,
    scheme: optionalString,
    value: optionalString
  })
  .passthrough()
const personLinkSchema = z.object({ note: optionalString, url: z.string().trim().min(1) }).passthrough()
const publicLinkSchema = z.object({ note: optionalString, url: optionalHttpsUrl }).passthrough()
const currentRoleSchema = z
  .object({
    district: optionalString,
    division_id: optionalString,
    org_classification: z.string().trim().min(1),
    title: optionalString
  })
  .passthrough()
const embeddedPersonSchema = z
  .object({
    current_role: currentRoleSchema.optional(),
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    party: optionalString
  })
  .passthrough()
const personSchema = embeddedPersonSchema.extend({
  family_name: optionalString,
  given_name: optionalString,
  email: optionalString,
  image: optionalString,
  identifiers: z.array(externalIdentifierSchema).default([]),
  links: z.array(personLinkSchema).default([]),
  openstates_url: optionalString,
  other_names: z.array(z.string().trim().min(1)).default([]),
  sources: z.array(sourceSchema).default([]),
  updated_at: optionalString
})
const membershipSchema = z
  .object({
    person: embeddedPersonSchema,
    person_name: optionalString,
    role: optionalString
  })
  .passthrough()
const publicContactSchema = z
  .object({ address: optionalString, email: optionalString, phone: optionalString })
  .passthrough()
const committeeSchema = z
  .object({
    classification: z.string().trim().min(1),
    contact: publicContactSchema.optional(),
    description: optionalString,
    id: z.string().trim().min(1),
    links: z.array(publicLinkSchema).optional(),
    memberships: z.array(membershipSchema).optional(),
    name: z.string().trim().min(1),
    parent_id: optionalString,
    sources: z.array(sourceSchema).default([]),
    terms_of_reference: optionalString,
    website: optionalHttpsUrl,
    website_url: optionalHttpsUrl
  })
  .passthrough()

type PersonInsert = typeof people.$inferInsert
type PersonAliasInsert = typeof personAliases.$inferInsert
type PersonDetailInsert = typeof personDetails.$inferInsert
type PersonExternalIdentifierInsert = typeof personExternalIdentifiers.$inferInsert
type PersonJurisdictionInsert = typeof personJurisdictions.$inferInsert
type OrganizationInsert = typeof organizations.$inferInsert
type TermInsert = typeof legislativeTerms.$inferInsert
type MembershipInsert = typeof organizationMemberships.$inferInsert

export interface OpenStatesEntityContext {
  jurisdictionCode: string
  retrievedAt: Date
}

export interface OpenStatesEntitySnapshot {
  memberships: MembershipInsert[]
  organizations: OrganizationInsert[]
  personAliasPersonIds: string[]
  personAliases: PersonAliasInsert[]
  personDetails?: PersonDetailInsert[]
  personDetailPersonIds?: string[]
  personExternalIdentifiers?: PersonExternalIdentifierInsert[]
  personJurisdictions?: PersonJurisdictionInsert[]
  people: PersonInsert[]
  terms: TermInsert[]
}

function sourceUrl(sources: Array<{ url: string }>, fallback?: string): string | undefined {
  return sources[0]?.url ?? fallback
}

function canonicalChamber(value: string): z.output<typeof canonicalChamberSchema> | null {
  const parsed = canonicalChamberSchema.safeParse(value.trim().toLowerCase())
  return parsed.success ? parsed.data : null
}

function canonicalOrganizationClassification(
  value: string
): z.output<typeof canonicalOrganizationClassificationSchema> | null {
  const parsed = canonicalOrganizationClassificationSchema.safeParse(value.trim().toLowerCase())
  return parsed.success ? parsed.data : null
}

function rawObjectHasOwn(input: unknown, key: string): boolean {
  return typeof input === "object" && input !== null && Object.hasOwn(input, key)
}

function profileFactsWereSupplied(input: unknown): boolean {
  return ["contact", "description", "terms_of_reference", "website", "website_url"].some((key) =>
    rawObjectHasOwn(input, key)
  )
}

function publicWebsiteUrl(committee: z.infer<typeof committeeSchema>): string | null {
  return committee.website_url ?? committee.website ?? null
}

function isHttpsUrl(value: string | undefined): value is string {
  return value !== undefined && value.startsWith("https://")
}

function membershipFactsWereSupplied(input: unknown): boolean {
  return rawObjectHasOwn(input, "memberships")
}

function normalizePerson(
  input: z.infer<typeof embeddedPersonSchema>,
  context: OpenStatesEntityContext,
  details?: Pick<
    z.infer<typeof personSchema>,
    | "email"
    | "family_name"
    | "given_name"
    | "identifiers"
    | "image"
    | "links"
    | "openstates_url"
    | "other_names"
    | "sources"
    | "updated_at"
  >
): {
  aliases: PersonAliasInsert[]
  detail?: PersonDetailInsert
  externalIdentifiers: PersonExternalIdentifierInsert[]
  person: PersonInsert
  jurisdiction?: PersonJurisdictionInsert
  term?: TermInsert
} {
  const canonicalPersonId = personId("openstates", input.id)
  const canonicalJurisdictionId = jurisdictionId(context.jurisdictionCode)
  const role = input.current_role
  const aliasSourceUrl = sourceUrl(details?.sources ?? [], details?.openstates_url)
  const detailSourceUrl = sourceUrl(details?.sources ?? [], details?.openstates_url)
  const detailProvenanceComplete = detailSourceUrl !== undefined && detailSourceUrl.startsWith("https://")
  const officialUrl = details === undefined ? undefined : declaredOfficialUrl(details.links)
  return {
    aliases:
      details === undefined
        ? []
        : [...new Set(details.other_names)].map((name) => ({
            name,
            personId: canonicalPersonId,
            provenanceComplete: detailProvenanceComplete,
            sourceIdentity: `openstates:${input.id}:other-name:${name}`,
            sourceIsOfficial: false,
            sourceProvider: "openstates",
            sourceRetrievedAt: context.retrievedAt,
            sourceUpdatedAt: details.updated_at === undefined ? undefined : new Date(details.updated_at),
            sourceUrl: aliasSourceUrl
          })),
    detail:
      details === undefined
        ? undefined
        : {
            // Open States does not mark its directory profile as the elected
            // official's site. Do not promote it into officialUrl or public
            // email; those values remain null until an official artifact is
            // imported.
            imageUrl: httpsUrl(details.image),
            officialUrl,
            personId: canonicalPersonId,
            provenanceComplete: detailProvenanceComplete,
            publicEmail: details.email,
            sourceIsOfficial: false,
            sourceProvider: "openstates",
            sourceRetrievedAt: context.retrievedAt,
            sourceUpdatedAt: details.updated_at === undefined ? undefined : new Date(details.updated_at),
            sourceUrl: detailSourceUrl
          },
    externalIdentifiers:
      details === undefined
        ? []
        : details.identifiers.flatMap((identifier) => {
            const scheme = identifier.scheme
            const value = identifier.identifier ?? identifier.value
            if (scheme === undefined || value === undefined) {
              return []
            }
            return [
              {
                personId: canonicalPersonId,
                provenanceComplete: detailProvenanceComplete,
                scheme,
                sourceIdentity: `openstates:${input.id}:identifier:${scheme}:${value}`,
                sourceIsOfficial: false,
                sourceProvider: "openstates",
                sourceRetrievedAt: context.retrievedAt,
                sourceUpdatedAt: details.updated_at === undefined ? undefined : new Date(details.updated_at),
                sourceUrl: detailSourceUrl,
                value
              }
            ] satisfies PersonExternalIdentifierInsert[]
          }),
    person: {
      familyName: details?.family_name,
      givenName: details?.given_name,
      id: canonicalPersonId,
      isActive: role === undefined ? undefined : true,
      jurisdictionId: canonicalJurisdictionId,
      name: input.name,
      party: input.party,
      provenanceComplete: detailProvenanceComplete,
      sourceId: input.id,
      sourceIsOfficial: false,
      sourceProvider: "openstates",
      sourceRetrievedAt: context.retrievedAt,
      sourceUpdatedAt: details?.updated_at === undefined ? undefined : new Date(details.updated_at),
      sourceUrl: detailSourceUrl,
      upstreamIds: { openstates: input.id }
    },
    jurisdiction:
      details === undefined
        ? undefined
        : {
            jurisdictionId: canonicalJurisdictionId,
            personId: canonicalPersonId,
            provenanceComplete: detailProvenanceComplete,
            sourceIdentity: `openstates:${input.id}:jurisdiction:${context.jurisdictionCode}`,
            sourceIsOfficial: false,
            sourceProvider: "openstates",
            sourceRetrievedAt: context.retrievedAt,
            sourceUpdatedAt: details.updated_at === undefined ? undefined : new Date(details.updated_at),
            sourceUrl: detailSourceUrl
          },
    term:
      role === undefined
        ? undefined
        : {
            chamber: canonicalChamber(role.org_classification),
            district: role.district,
            id: legislativeTermId(
              canonicalPersonId,
              `current:${role.org_classification}:${role.division_id ?? role.district ?? "unknown"}`
            ),
            isActive: true,
            jurisdictionId: canonicalJurisdictionId,
            officeTitle: role.title,
            party: input.party,
            personId: canonicalPersonId,
            provenanceComplete: detailProvenanceComplete,
            role: role.title,
            sourceId: role.division_id ?? `current:${role.org_classification}:${role.district ?? "unknown"}`,
            sourceIsOfficial: false,
            sourceProvider: "openstates",
            sourceRetrievedAt: context.retrievedAt,
            sourceUpdatedAt: details?.updated_at === undefined ? undefined : new Date(details.updated_at),
            sourceUrl: detailSourceUrl
          }
  }
}

export function normalizeOpenStatesPeople(
  inputs: readonly unknown[],
  context: OpenStatesEntityContext
): Pick<
  OpenStatesEntitySnapshot,
  | "personAliasPersonIds"
  | "personAliases"
  | "personDetailPersonIds"
  | "personDetails"
  | "personExternalIdentifiers"
  | "personJurisdictions"
  | "people"
  | "terms"
> {
  const normalized = inputs.map((input) => {
    const parsed = personSchema.parse(input)
    return normalizePerson(parsed, context, parsed)
  })
  return {
    personAliasPersonIds: normalized.map((value) => value.person.id),
    personAliases: normalized.flatMap((value) => value.aliases),
    personDetailPersonIds: normalized.map((value) => value.person.id),
    personDetails: normalized.flatMap((value) => (value.detail === undefined ? [] : [value.detail])),
    personExternalIdentifiers: normalized.flatMap((value) => value.externalIdentifiers),
    personJurisdictions: normalized.flatMap((value) => (value.jurisdiction === undefined ? [] : [value.jurisdiction])),
    people: normalized.map((value) => value.person),
    terms: normalized.flatMap((value) => (value.term === undefined ? [] : [value.term]))
  }
}

function httpsUrl(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }
  try {
    return new URL(value).protocol === "https:" ? value : undefined
  } catch {
    return undefined
  }
}

/** An Open States link is treated as official only when its provider label says so. */
function declaredOfficialUrl(links: readonly { note?: string; url: string }[]): string | undefined {
  for (const link of links) {
    if (!/\b(official|website|web\s*site|home\s*page)\b/i.test(link.note ?? "")) {
      continue
    }
    const value = httpsUrl(link.url)
    if (value !== undefined) {
      return value
    }
  }
  return undefined
}

export function normalizeOpenStatesCommittees(
  inputs: readonly unknown[],
  context: OpenStatesEntityContext
): Pick<
  OpenStatesEntitySnapshot,
  "memberships" | "organizations" | "personAliasPersonIds" | "personAliases" | "people" | "terms"
> {
  const peopleById = new Map<string, PersonInsert>()
  const termsById = new Map<string, TermInsert>()
  const memberships: MembershipInsert[] = []
  const canonicalJurisdictionId = jurisdictionId(context.jurisdictionCode)
  const committees = inputs.map((input) => ({
    detailFactsComplete: profileFactsWereSupplied(input),
    membershipRelationsComplete: membershipFactsWereSupplied(input),
    record: committeeSchema.parse(input)
  }))
  const canonicalOrganizationIds = new Map(
    committees.map(({ record }) => [record.id, organizationId("openstates", record.id)])
  )
  const normalizedOrganizations = committees.map(
    ({ detailFactsComplete, membershipRelationsComplete, record: committee }) => {
      const canonicalOrganizationId = organizationId("openstates", committee.id)
      const canonicalSourceUrl = sourceUrl(committee.sources)
      for (const membership of committee.memberships ?? []) {
        const normalizedPerson = normalizePerson(membership.person, context)
        peopleById.set(normalizedPerson.person.id, normalizedPerson.person)
        if (normalizedPerson.term !== undefined) {
          termsById.set(normalizedPerson.term.id, normalizedPerson.term)
        }
        const sourceIdentity = membership.role ?? "member"
        memberships.push({
          classification: membership.role,
          id: organizationMembershipId(canonicalOrganizationId, normalizedPerson.person.id, sourceIdentity),
          isActive: true,
          organizationId: canonicalOrganizationId,
          personId: normalizedPerson.person.id,
          provenanceComplete: isHttpsUrl(canonicalSourceUrl),
          sourceId: `${committee.id}:${membership.person.id}:${sourceIdentity}`,
          sourceIsOfficial: false,
          sourceProvider: "openstates",
          sourceRetrievedAt: context.retrievedAt,
          sourceUrl: canonicalSourceUrl,
          title: membership.role
        })
      }
      return {
        chamber: null,
        classification: canonicalOrganizationClassification(committee.classification),
        childRelationsComplete: true,
        description: committee.description ?? null,
        detailFactsComplete,
        id: canonicalOrganizationId,
        isActive: true,
        jurisdictionId: canonicalJurisdictionId,
        membershipRelationsComplete,
        name: committee.name,
        parentOrganizationId:
          committee.parent_id === undefined ? null : (canonicalOrganizationIds.get(committee.parent_id) ?? null),
        sourceId: committee.id,
        sourceUrl: canonicalSourceUrl,
        termsOfReference: committee.terms_of_reference ?? null,
        upstreamIds: {
          openstates: committee.id,
          ...(committee.parent_id === undefined || canonicalOrganizationIds.has(committee.parent_id)
            ? {}
            : { openstatesParent: committee.parent_id })
        },
        publicContactAddress: committee.contact?.address ?? null,
        publicContactEmail: committee.contact?.email ?? null,
        publicContactPhone: committee.contact?.phone ?? null,
        provenanceComplete: isHttpsUrl(canonicalSourceUrl),
        sourceIsOfficial: false,
        sourceProvider: "openstates",
        sourceRetrievedAt: context.retrievedAt,
        websiteUrl: publicWebsiteUrl(committee)
      } satisfies OrganizationInsert
    }
  )
  return {
    memberships,
    organizations: normalizedOrganizations,
    personAliasPersonIds: [],
    personAliases: [],
    people: [...peopleById.values()],
    terms: [...termsById.values()]
  }
}
