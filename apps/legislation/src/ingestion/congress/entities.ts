import { z } from "zod"
import type {
  legislativeTerms,
  organizations,
  people,
  personDetails,
  personJurisdictions
} from "../../db/schema/schema.js"
import { jurisdictionId, legislativeTermId, organizationId, personId } from "../../legislation/identifiers.js"
import type { EntitySnapshot } from "../entity-snapshot.js"

const optionalString = z.preprocess(
  (value) => (value === null || (typeof value === "string" && value.trim().length === 0) ? undefined : value),
  z.string().trim().min(1).optional()
)
const optionalIsoDateTime = z.preprocess(
  (value) => (value === null || (typeof value === "string" && value.trim().length === 0) ? undefined : value),
  z.iso.datetime({ offset: true }).optional()
)
const optionalHttpsUrl = z.preprocess(
  (value) => (value === null || (typeof value === "string" && value.trim().length === 0) ? undefined : value),
  z.url({ protocol: /^https$/ }).optional()
)
const optionalInteger = z.preprocess((value) => (value === null ? undefined : value), z.number().int().optional())
const optionalDistrict = z.preprocess(
  (value) => (value === null ? undefined : value),
  z.union([z.number().int(), z.string()]).optional()
)
const publicContactSchema = z
  .object({ address: optionalString, email: optionalString, phone: optionalString })
  .passthrough()
const termSchema = z
  .object({ chamber: z.string().trim().min(1), endYear: optionalInteger, startYear: z.number().int() })
  .passthrough()
const memberSchema = z
  .object({
    bioguideId: z.string().trim().min(1),
    district: optionalDistrict,
    name: z.string().trim().min(1),
    partyName: optionalString,
    terms: z.object({ item: z.array(termSchema).default([]) }).default({ item: [] }),
    updateDate: optionalString,
    url: optionalString
  })
  .passthrough()
const memberDetailTermSchema = termSchema.extend({
  congress: z.number().int().positive(),
  district: optionalDistrict,
  memberType: z.string().trim().min(1),
  partyName: optionalString
})
const memberDetailSchema = z
  .object({
    bioguideId: z.string().trim().min(1),
    currentMember: z.boolean(),
    depiction: z.preprocess(
      (value) => (value === null ? undefined : value),
      z.object({ imageUrl: optionalHttpsUrl }).optional()
    ),
    firstName: optionalString,
    lastName: optionalString,
    officialUrl: optionalHttpsUrl,
    terms: z.object({ item: z.array(memberDetailTermSchema).default([]) }).default({ item: [] }),
    updateDate: optionalIsoDateTime
  })
  .passthrough()
const subcommitteeSchema = z
  .object({
    contact: publicContactSchema.optional(),
    description: optionalString,
    name: z.string().trim().min(1),
    systemCode: z.string().trim().min(1),
    termsOfReference: optionalString,
    url: optionalString,
    website: optionalHttpsUrl,
    websiteUrl: optionalHttpsUrl
  })
  .passthrough()
const committeeSchema = z
  .object({
    chamber: z.string().trim().min(1),
    committeeTypeCode: optionalString,
    contact: publicContactSchema.optional(),
    description: optionalString,
    name: z.string().trim().min(1),
    subcommittees: z.array(subcommitteeSchema).optional(),
    systemCode: z.string().trim().min(1),
    termsOfReference: optionalString,
    updateDate: optionalString,
    url: optionalString,
    website: optionalHttpsUrl,
    websiteUrl: optionalHttpsUrl
  })
  .passthrough()

type PersonInsert = typeof people.$inferInsert
type OrganizationInsert = typeof organizations.$inferInsert
type PersonDetailInsert = typeof personDetails.$inferInsert
type PersonJurisdictionInsert = typeof personJurisdictions.$inferInsert
type TermInsert = typeof legislativeTerms.$inferInsert

export type CongressEntitySnapshot = Pick<
  EntitySnapshot,
  "organizations" | "personDetailPersonIds" | "personDetails" | "personJurisdictions" | "people" | "terms"
>

export interface CongressEntityContext {
  /** The time the official Congress.gov collection was successfully observed. */
  retrievedAt: Date
}

export interface CongressMemberDetailInput {
  detail: unknown
  member: unknown
}

function chamber(value: string): "lower" | "upper" | undefined {
  const normalized = value.toLowerCase()
  if (normalized.includes("house")) {
    return "lower"
  }
  if (normalized.includes("senate")) {
    return "upper"
  }
  return undefined
}

function rawObjectHasOwn(input: unknown, key: string): boolean {
  return typeof input === "object" && input !== null && Object.hasOwn(input, key)
}

function profileFactsWereSupplied(input: unknown): boolean {
  return ["contact", "description", "termsOfReference", "website", "websiteUrl"].some((key) =>
    rawObjectHasOwn(input, key)
  )
}

function profileFields(input: {
  contact?: { address?: string; email?: string; phone?: string }
  description?: string
  termsOfReference?: string
  website?: string
  websiteUrl?: string
}) {
  return {
    description: input.description ?? null,
    publicContactAddress: input.contact?.address ?? null,
    publicContactEmail: input.contact?.email ?? null,
    publicContactPhone: input.contact?.phone ?? null,
    termsOfReference: input.termsOfReference ?? null,
    websiteUrl: input.websiteUrl ?? input.website ?? null
  }
}

function isOfficialCongressUrl(value: string | undefined): value is string {
  if (value === undefined) {
    return false
  }
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname === "api.congress.gov" && url.port === ""
  } catch {
    return false
  }
}

function congressProvenance(sourceUrl: string | undefined, retrievedAt: Date) {
  const sourceIsOfficial = isOfficialCongressUrl(sourceUrl)
  return {
    provenanceComplete: sourceIsOfficial,
    sourceIsOfficial,
    sourceProvider: "congress",
    sourceRetrievedAt: retrievedAt,
    sourceUrl
  }
}

export function normalizeCongressMembers(
  inputs: readonly unknown[],
  congress: number,
  context: CongressEntityContext
): Pick<CongressEntitySnapshot, "people" | "terms"> {
  const federalJurisdictionId = jurisdictionId("us")
  const normalized = inputs.map((input) => memberSchema.parse(input))
  return {
    people: normalized.map((member) => ({
      id: personId("congress", member.bioguideId),
      isActive: member.terms.item.some(
        (term) => term.endYear === undefined || term.endYear >= new Date().getUTCFullYear()
      ),
      jurisdictionId: federalJurisdictionId,
      name: member.name,
      party: member.partyName,
      sourceId: member.bioguideId,
      sourceUpdatedAt: member.updateDate === undefined ? undefined : new Date(member.updateDate),
      upstreamIds: { bioguide: member.bioguideId },
      ...congressProvenance(member.url, context.retrievedAt)
    })),
    terms: normalized.flatMap((member) => {
      const canonicalPersonId = personId("congress", member.bioguideId)
      return member.terms.item.flatMap((term) => {
        const normalizedChamber = chamber(term.chamber)
        if (normalizedChamber === undefined) {
          return []
        }
        const sourceIdentity = `${congress}:${normalizedChamber}:${term.startYear}:${term.endYear ?? "current"}`
        return [
          {
            chamber: normalizedChamber,
            district: member.district === undefined ? undefined : String(member.district),
            id: legislativeTermId(canonicalPersonId, sourceIdentity),
            isActive: term.endYear === undefined || term.endYear >= new Date().getUTCFullYear(),
            jurisdictionId: federalJurisdictionId,
            party: member.partyName,
            personId: canonicalPersonId,
            role: term.chamber,
            sourceId: sourceIdentity,
            ...congressProvenance(member.url, context.retrievedAt)
          } satisfies TermInsert
        ]
      })
    })
  }
}

/**
 * Maps the authoritative Member detail resource onto the existing Congress person
 * identity. The collection member supplies the canonical API record URL and name;
 * the detail resource supplies profile facts and canonical term titles.
 */
export function normalizeCongressMemberDetails(
  inputs: readonly CongressMemberDetailInput[],
  congress: number,
  context: CongressEntityContext
): Pick<
  CongressEntitySnapshot,
  "personDetailPersonIds" | "personDetails" | "personJurisdictions" | "people" | "terms"
> {
  const federalJurisdictionId = jurisdictionId("us")
  const normalized = inputs.map(({ detail, member }) => ({
    detail: memberDetailSchema.parse(detail),
    member: memberSchema.parse(member)
  }))
  const people: PersonInsert[] = []
  const personDetails: PersonDetailInsert[] = []
  const personJurisdictions: PersonJurisdictionInsert[] = []
  const terms: TermInsert[] = []

  for (const { detail, member } of normalized) {
    if (detail.bioguideId !== member.bioguideId) {
      throw new Error(`Congress member detail identity mismatch for ${member.bioguideId}`)
    }
    const canonicalPersonId = personId("congress", detail.bioguideId)
    const provenance = congressProvenance(member.url, context.retrievedAt)
    const sourceUpdatedAt = detail.updateDate === undefined ? undefined : new Date(detail.updateDate)
    people.push({
      familyName: detail.lastName,
      givenName: detail.firstName,
      id: canonicalPersonId,
      isActive: detail.currentMember,
      jurisdictionId: federalJurisdictionId,
      name: member.name,
      party: member.partyName,
      sourceId: detail.bioguideId,
      sourceUpdatedAt,
      upstreamIds: { bioguide: detail.bioguideId },
      ...provenance
    })
    personDetails.push({
      imageUrl: detail.depiction?.imageUrl ?? null,
      officialUrl: detail.officialUrl ?? null,
      personId: canonicalPersonId,
      publicEmail: null,
      sourceUpdatedAt,
      ...provenance
    })
    personJurisdictions.push({
      jurisdictionId: federalJurisdictionId,
      personId: canonicalPersonId,
      sourceIdentity: `congress:${detail.bioguideId}:jurisdiction:us`,
      sourceUpdatedAt,
      ...provenance
    })
    for (const term of detail.terms.item) {
      const normalizedChamber = chamber(term.chamber)
      if (normalizedChamber === undefined) {
        continue
      }
      const sourceIdentity = `${term.congress}:${normalizedChamber}:${term.startYear}:${term.endYear ?? "current"}`
      terms.push({
        chamber: normalizedChamber,
        district: term.district === undefined ? undefined : String(term.district),
        id: legislativeTermId(canonicalPersonId, sourceIdentity),
        isActive: detail.currentMember && term.congress === congress,
        jurisdictionId: federalJurisdictionId,
        officeTitle: term.memberType,
        party: term.partyName,
        personId: canonicalPersonId,
        role: term.memberType,
        sourceId: sourceIdentity,
        sourceUpdatedAt,
        ...provenance
      })
    }
  }
  return {
    personDetailPersonIds: people.map((person) => person.id),
    personDetails,
    personJurisdictions,
    people,
    terms
  }
}

export function normalizeCongressCommittees(
  inputs: readonly unknown[],
  context: CongressEntityContext
): Pick<CongressEntitySnapshot, "organizations"> {
  const federalJurisdictionId = jurisdictionId("us")
  const legislatureId = organizationId("congress", "united-states-congress")
  const houseId = organizationId("congress", "house")
  const senateId = organizationId("congress", "senate")
  const fixedOrganizations: OrganizationInsert[] = [
    {
      childRelationsComplete: true,
      detailFactsComplete: false,
      classification: "legislature",
      id: legislatureId,
      isActive: true,
      jurisdictionId: federalJurisdictionId,
      membershipRelationsComplete: false,
      name: "United States Congress",
      sourceId: "united-states-congress",
      upstreamIds: { congress: "united-states-congress" },
      ...congressProvenance("https://api.congress.gov/committee", context.retrievedAt)
    },
    {
      chamber: "lower",
      childRelationsComplete: true,
      classification: "chamber",
      detailFactsComplete: false,
      id: houseId,
      isActive: true,
      jurisdictionId: federalJurisdictionId,
      membershipRelationsComplete: false,
      name: "House of Representatives",
      parentOrganizationId: legislatureId,
      sourceId: "house",
      upstreamIds: { congress: "house" },
      ...congressProvenance("https://api.congress.gov/committee", context.retrievedAt)
    },
    {
      chamber: "upper",
      childRelationsComplete: true,
      classification: "chamber",
      detailFactsComplete: false,
      id: senateId,
      isActive: true,
      jurisdictionId: federalJurisdictionId,
      membershipRelationsComplete: false,
      name: "Senate",
      parentOrganizationId: legislatureId,
      sourceId: "senate",
      upstreamIds: { congress: "senate" },
      ...congressProvenance("https://api.congress.gov/committee", context.retrievedAt)
    }
  ]
  const committees = inputs.map((input) => ({
    detailFactsComplete: profileFactsWereSupplied(input),
    record: committeeSchema.parse(input),
    subcommitteesComplete: rawObjectHasOwn(input, "subcommittees")
  }))
  return {
    organizations: [
      ...fixedOrganizations,
      ...committees.flatMap(({ detailFactsComplete, record: committee, subcommitteesComplete }) => {
        const normalizedChamber = chamber(committee.chamber)
        const canonicalCommitteeId = organizationId("congress", committee.systemCode)
        let parentOrganizationId: string | null = null
        if (normalizedChamber === "lower") {
          parentOrganizationId = houseId
        } else if (normalizedChamber === "upper") {
          parentOrganizationId = senateId
        }
        return [
          {
            childRelationsComplete: subcommitteesComplete,
            chamber: normalizedChamber ?? null,
            classification: "committee",
            detailFactsComplete,
            id: canonicalCommitteeId,
            isActive: true,
            jurisdictionId: federalJurisdictionId,
            membershipRelationsComplete: false,
            name: committee.name,
            parentOrganizationId,
            sourceId: committee.systemCode,
            sourceUpdatedAt: committee.updateDate === undefined ? undefined : new Date(committee.updateDate),
            upstreamIds: { congress: committee.systemCode, typeCode: committee.committeeTypeCode ?? "" },
            ...profileFields(committee),
            ...congressProvenance(committee.url, context.retrievedAt)
          } satisfies OrganizationInsert,
          ...(committee.subcommittees ?? []).map((subcommittee) => ({
            childRelationsComplete: true,
            chamber: normalizedChamber ?? null,
            classification: "subcommittee" as const,
            detailFactsComplete: profileFactsWereSupplied(subcommittee),
            id: organizationId("congress", subcommittee.systemCode),
            isActive: true,
            jurisdictionId: federalJurisdictionId,
            membershipRelationsComplete: false,
            name: subcommittee.name,
            parentOrganizationId: canonicalCommitteeId,
            sourceId: subcommittee.systemCode,
            upstreamIds: { congress: subcommittee.systemCode },
            ...profileFields(subcommittee),
            ...congressProvenance(subcommittee.url ?? committee.url, context.retrievedAt)
          }))
        ]
      })
    ]
  }
}
