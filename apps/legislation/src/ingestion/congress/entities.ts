import { z } from "zod"
import type { legislativeTerms, organizations, people } from "../../db/schema/schema.js"
import { jurisdictionId, legislativeTermId, organizationId, personId } from "../../legislation/identifiers.js"

const optionalString = z.preprocess(
  (value) => (value === null || (typeof value === "string" && value.trim().length === 0) ? undefined : value),
  z.string().trim().min(1).optional()
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
type TermInsert = typeof legislativeTerms.$inferInsert

export interface CongressEntitySnapshot {
  organizations: OrganizationInsert[]
  people: PersonInsert[]
  terms: TermInsert[]
}

export interface CongressEntityContext {
  /** The time the official Congress.gov collection was successfully observed. */
  retrievedAt: Date
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

function isHttpsUrl(value: string | undefined): value is string {
  return value !== undefined && value.startsWith("https://")
}

function congressProvenance(sourceUrl: string | undefined, retrievedAt: Date) {
  return {
    provenanceComplete: isHttpsUrl(sourceUrl),
    sourceIsOfficial: true,
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
