import { z } from "zod"
import type { legislativeTerms, organizationMemberships, organizations, people } from "../../db/schema/schema.js"
import {
  jurisdictionId,
  legislativeTermId,
  organizationId,
  organizationMembershipId,
  personId
} from "../../legislation/identifiers.js"

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().trim().min(1).optional()
)
const sourceSchema = z.object({ url: z.string().trim().min(1) }).passthrough()
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
  openstates_url: optionalString,
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
const committeeSchema = z
  .object({
    classification: z.string().trim().min(1),
    id: z.string().trim().min(1),
    memberships: z.array(membershipSchema).default([]),
    name: z.string().trim().min(1),
    parent_id: optionalString,
    sources: z.array(sourceSchema).default([])
  })
  .passthrough()

type PersonInsert = typeof people.$inferInsert
type OrganizationInsert = typeof organizations.$inferInsert
type TermInsert = typeof legislativeTerms.$inferInsert
type MembershipInsert = typeof organizationMemberships.$inferInsert

export interface OpenStatesEntityContext {
  jurisdictionCode: string
}

export interface OpenStatesEntitySnapshot {
  memberships: MembershipInsert[]
  organizations: OrganizationInsert[]
  people: PersonInsert[]
  terms: TermInsert[]
}

function sourceUrl(sources: Array<{ url: string }>, fallback?: string): string | undefined {
  return sources[0]?.url ?? fallback
}

function normalizePerson(
  input: z.infer<typeof embeddedPersonSchema>,
  context: OpenStatesEntityContext,
  details?: Pick<
    z.infer<typeof personSchema>,
    "family_name" | "given_name" | "openstates_url" | "sources" | "updated_at"
  >
): { person: PersonInsert; term?: TermInsert } {
  const canonicalPersonId = personId("openstates", input.id)
  const canonicalJurisdictionId = jurisdictionId(context.jurisdictionCode)
  const role = input.current_role
  return {
    person: {
      familyName: details?.family_name,
      givenName: details?.given_name,
      id: canonicalPersonId,
      isActive: role === undefined ? undefined : true,
      jurisdictionId: canonicalJurisdictionId,
      name: input.name,
      party: input.party,
      sourceId: input.id,
      sourceUpdatedAt: details?.updated_at === undefined ? undefined : new Date(details.updated_at),
      sourceUrl: sourceUrl(details?.sources ?? [], details?.openstates_url),
      upstreamIds: { openstates: input.id }
    },
    term:
      role === undefined
        ? undefined
        : {
            chamber: role.org_classification,
            district: role.district,
            id: legislativeTermId(
              canonicalPersonId,
              `current:${role.org_classification}:${role.division_id ?? role.district ?? "unknown"}`
            ),
            isActive: true,
            jurisdictionId: canonicalJurisdictionId,
            party: input.party,
            personId: canonicalPersonId,
            role: role.title,
            sourceId: role.division_id ?? `current:${role.org_classification}:${role.district ?? "unknown"}`,
            sourceUrl: details?.openstates_url
          }
  }
}

export function normalizeOpenStatesPeople(
  inputs: readonly unknown[],
  context: OpenStatesEntityContext
): Pick<OpenStatesEntitySnapshot, "people" | "terms"> {
  const normalized = inputs.map((input) => {
    const parsed = personSchema.parse(input)
    return normalizePerson(parsed, context, parsed)
  })
  return {
    people: normalized.map((value) => value.person),
    terms: normalized.flatMap((value) => (value.term === undefined ? [] : [value.term]))
  }
}

export function normalizeOpenStatesCommittees(
  inputs: readonly unknown[],
  context: OpenStatesEntityContext
): Pick<OpenStatesEntitySnapshot, "memberships" | "organizations" | "people" | "terms"> {
  const peopleById = new Map<string, PersonInsert>()
  const termsById = new Map<string, TermInsert>()
  const memberships: MembershipInsert[] = []
  const canonicalJurisdictionId = jurisdictionId(context.jurisdictionCode)
  const normalizedOrganizations = inputs.map((input) => {
    const committee = committeeSchema.parse(input)
    const canonicalOrganizationId = organizationId("openstates", committee.id)
    for (const membership of committee.memberships) {
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
        sourceId: `${committee.id}:${membership.person.id}:${sourceIdentity}`,
        title: membership.role
      })
    }
    return {
      classification: committee.classification === "subcommittee" ? "subcommittee" : "committee",
      id: canonicalOrganizationId,
      isActive: true,
      jurisdictionId: canonicalJurisdictionId,
      name: committee.name,
      sourceId: committee.id,
      sourceUrl: sourceUrl(committee.sources),
      upstreamIds: {
        openstates: committee.id,
        ...(committee.parent_id === undefined ? {} : { openstatesParent: committee.parent_id })
      }
    } satisfies OrganizationInsert
  })
  return {
    memberships,
    organizations: normalizedOrganizations,
    people: [...peopleById.values()],
    terms: [...termsById.values()]
  }
}
