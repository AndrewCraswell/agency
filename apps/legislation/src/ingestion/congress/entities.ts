import { z } from "zod"
import type { legislativeTerms, organizations, people } from "../../db/schema/schema.js"
import { jurisdictionId, legislativeTermId, organizationId, personId } from "../../legislation/identifiers.js"

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().trim().min(1).optional()
)
const termSchema = z
  .object({ chamber: z.string().trim().min(1), endYear: z.number().int().optional(), startYear: z.number().int() })
  .passthrough()
const memberSchema = z
  .object({
    bioguideId: z.string().trim().min(1),
    district: z.union([z.number().int(), z.string()]).optional(),
    name: z.string().trim().min(1),
    partyName: optionalString,
    terms: z.object({ item: z.array(termSchema).default([]) }).default({ item: [] }),
    updateDate: optionalString,
    url: optionalString
  })
  .passthrough()
const subcommitteeSchema = z
  .object({ name: z.string().trim().min(1), systemCode: z.string().trim().min(1), url: optionalString })
  .passthrough()
const committeeSchema = z
  .object({
    chamber: z.string().trim().min(1),
    committeeTypeCode: optionalString,
    name: z.string().trim().min(1),
    subcommittees: z.array(subcommitteeSchema).default([]),
    systemCode: z.string().trim().min(1),
    updateDate: optionalString,
    url: optionalString
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

export function normalizeCongressMembers(
  inputs: readonly unknown[],
  congress: number
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
      sourceUrl: member.url,
      upstreamIds: { bioguide: member.bioguideId }
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
            sourceUrl: member.url
          } satisfies TermInsert
        ]
      })
    })
  }
}

export function normalizeCongressCommittees(inputs: readonly unknown[]): Pick<CongressEntitySnapshot, "organizations"> {
  const federalJurisdictionId = jurisdictionId("us")
  const legislatureId = organizationId("congress", "united-states-congress")
  const houseId = organizationId("congress", "house")
  const senateId = organizationId("congress", "senate")
  const fixedOrganizations: OrganizationInsert[] = [
    {
      classification: "legislature",
      id: legislatureId,
      isActive: true,
      jurisdictionId: federalJurisdictionId,
      name: "United States Congress",
      sourceId: "united-states-congress",
      upstreamIds: { congress: "united-states-congress" }
    },
    {
      chamber: "lower",
      classification: "chamber",
      id: houseId,
      isActive: true,
      jurisdictionId: federalJurisdictionId,
      name: "House of Representatives",
      parentOrganizationId: legislatureId,
      sourceId: "house",
      upstreamIds: { congress: "house" }
    },
    {
      chamber: "upper",
      classification: "chamber",
      id: senateId,
      isActive: true,
      jurisdictionId: federalJurisdictionId,
      name: "Senate",
      parentOrganizationId: legislatureId,
      sourceId: "senate",
      upstreamIds: { congress: "senate" }
    }
  ]
  const committees = inputs.map((input) => committeeSchema.parse(input))
  return {
    organizations: [
      ...fixedOrganizations,
      ...committees.flatMap((committee) => {
        const normalizedChamber = chamber(committee.chamber)
        const canonicalCommitteeId = organizationId("congress", committee.systemCode)
        const parentOrganizationId = normalizedChamber === "lower" ? houseId : senateId
        return [
          {
            chamber: normalizedChamber,
            classification: "committee",
            id: canonicalCommitteeId,
            isActive: true,
            jurisdictionId: federalJurisdictionId,
            name: committee.name,
            parentOrganizationId,
            sourceId: committee.systemCode,
            sourceUpdatedAt: committee.updateDate === undefined ? undefined : new Date(committee.updateDate),
            sourceUrl: committee.url,
            upstreamIds: { congress: committee.systemCode, typeCode: committee.committeeTypeCode ?? "" }
          } satisfies OrganizationInsert,
          ...committee.subcommittees.map((subcommittee) => ({
            chamber: normalizedChamber,
            classification: "subcommittee" as const,
            id: organizationId("congress", subcommittee.systemCode),
            isActive: true,
            jurisdictionId: federalJurisdictionId,
            name: subcommittee.name,
            parentOrganizationId: canonicalCommitteeId,
            sourceId: subcommittee.systemCode,
            sourceUrl: subcommittee.url,
            upstreamIds: { congress: subcommittee.systemCode }
          }))
        ]
      })
    ]
  }
}
