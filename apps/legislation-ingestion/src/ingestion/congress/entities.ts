import type {
  legislativeTerms,
  people,
  personDetails,
  personJurisdictions
} from "@repo/legislation-core/database/schema/schema"
import { jurisdictionId, legislativeTermId, personId } from "@repo/legislation-core/domain/identifiers"
import { z } from "zod"
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
// Historical official-site metadata can legitimately predate HTTPS. This is
// displayed source metadata, not the URL used to fetch the Congress API.
const optionalWebsiteUrl = z.preprocess(
  (value) => (value === null || (typeof value === "string" && value.trim().length === 0) ? undefined : value),
  z.url({ protocol: /^https?$/ }).optional()
)
const optionalInteger = z.preprocess((value) => (value === null ? undefined : value), z.number().int().optional())
const optionalDistrict = z.preprocess(
  (value) => (value === null ? undefined : value),
  z.union([z.number().int(), z.string()]).optional()
)
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
    directOrderName: optionalString,
    invertedOrderName: optionalString,
    lastName: optionalString,
    officialWebsiteUrl: optionalWebsiteUrl,
    terms: z.array(memberDetailTermSchema).default([]),
    updateDate: optionalIsoDateTime
  })
  .passthrough()

type PersonInsert = typeof people.$inferInsert
type PersonDetailInsert = typeof personDetails.$inferInsert
type PersonJurisdictionInsert = typeof personJurisdictions.$inferInsert
type TermInsert = typeof legislativeTerms.$inferInsert

export type CongressEntitySnapshot = Pick<
  EntitySnapshot,
  | "personAliasPersonIds"
  | "personAliases"
  | "personExternalIdentifiers"
  | "personDetailPersonIds"
  | "personDetails"
  | "personJurisdictions"
  | "people"
  | "termPersonIds"
  | "terms"
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
  const congressStartYear = 1789 + (congress - 1) * 2
  const congressEndYear = congressStartYear + 2
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
        // Collection terms cover a member's entire career. Do not label an
        // unrelated chamber tenure with the requested Congress. Keep boundary
        // years because year-only dates cannot prove absence before January 3.
        if (term.startYear > congressEndYear || (term.endYear !== undefined && term.endYear < congressStartYear)) {
          return []
        }
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
): CongressEntitySnapshot {
  const federalJurisdictionId = jurisdictionId("us")
  const normalized = inputs.map(({ detail, member }) => {
    const parsedMember = memberSchema.parse(member)
    const parsedDetail = memberDetailSchema.safeParse(detail)
    if (!parsedDetail.success) {
      throw new Error(`Invalid Congress member detail for ${parsedMember.bioguideId}: ${parsedDetail.error.message}`, {
        cause: parsedDetail.error
      })
    }
    return { detail: parsedDetail.data, member: parsedMember }
  })
  const people: PersonInsert[] = []
  const personAliases: EntitySnapshot["personAliases"] = []
  const personExternalIdentifiers: NonNullable<EntitySnapshot["personExternalIdentifiers"]> = []
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
    if (provenance.provenanceComplete) {
      personExternalIdentifiers.push({
        personId: canonicalPersonId,
        scheme: "bioguide",
        value: detail.bioguideId,
        sourceIdentity: `congress:${detail.bioguideId}:bioguide`,
        sourceUpdatedAt,
        ...provenance
      })
      // Keep only explicitly published name forms, never inferred nicknames or
      // synthesized first/last-name combinations. Identical forms collapse.
      for (const name of new Set([member.name, detail.directOrderName, detail.invertedOrderName])) {
        if (name !== undefined) {
          personAliases.push({
            name,
            personId: canonicalPersonId,
            sourceIdentity: `congress:${detail.bioguideId}:name:${name}`,
            sourceUpdatedAt,
            ...provenance
          })
        }
      }
    }
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
      officialUrl: detail.officialWebsiteUrl ?? null,
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
    for (const term of detail.terms) {
      const normalizedChamber = chamber(term.chamber)
      if (normalizedChamber === undefined) {
        throw new Error(`Congress member detail has an unmappable chamber for ${detail.bioguideId}`)
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
    personAliasPersonIds: people.filter((person) => person.provenanceComplete).map((person) => person.id),
    personAliases,
    personExternalIdentifiers,
    personDetailPersonIds: people.map((person) => person.id),
    personDetails,
    personJurisdictions,
    people,
    termPersonIds: people.filter((person) => person.provenanceComplete).map((person) => person.id),
    terms
  }
}
