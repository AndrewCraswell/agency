import { z } from "zod"
import {
  childId,
  federalBillId,
  jurisdictionId,
  legislativeSessionId,
  organizationId,
  personId
} from "../../legislation/identifiers.js"
import type { CanonicalBillAggregate } from "../../legislation/model.js"
import { outgoingRelationProvenance } from "../relation-provenance.js"

const optionalString = z.preprocess(
  (value) => (value === null || (typeof value === "string" && value.trim().length === 0) ? undefined : value),
  z.string().trim().min(1).optional()
)
const memberSchema = z.object({ bioguideId: z.string().min(1), fullName: z.string().min(1) }).passthrough()
const actionSchema = z
  .object({ actionDate: optionalString, actionTime: optionalString, text: optionalString })
  .passthrough()
const textVersionSchema = z.object({
  date: optionalString,
  formats: z.array(z.object({ type: optionalString, url: z.string().min(1) }).passthrough()).default([]),
  type: z.string().min(1)
})
function normalizeRelationshipDetails(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value
  }
  return value
    .flatMap((item) => {
      if (typeof item === "string") {
        return [item]
      }
      return typeof item === "object" && item !== null && "type" in item && typeof item.type === "string"
        ? [item.type]
        : []
    })
    .join(" ")
}
const relationshipDetailsSchema = z.preprocess(normalizeRelationshipDetails, optionalString)
const relatedBillSchema = z.object({
  congress: z.number().int().positive(),
  number: z.union([z.string().min(1), z.number().int().nonnegative()]).transform(String),
  relationshipDetails: relationshipDetailsSchema,
  type: z.string().min(1),
  updateDate: optionalString,
  url: optionalString
})

export const congressBillBundleSchema = z.object({
  actions: z.array(actionSchema).default([]),
  bill: z
    .object({
      congress: z.number().int().positive(),
      introducedDate: optionalString,
      number: z.string().min(1),
      originChamber: optionalString,
      policyArea: z.object({ name: z.string() }).optional(),
      sponsors: z.array(memberSchema).default([]),
      title: z.string().min(1),
      type: z.string().min(1),
      updateDate: optionalString,
      url: z.string().min(1)
    })
    .passthrough(),
  committees: z.array(z.object({ name: z.string().min(1), systemCode: optionalString }).passthrough()).default([]),
  cosponsors: z.array(memberSchema).default([]),
  relatedBills: z.array(relatedBillSchema).default([]),
  subjects: z.array(z.string()).default([]),
  summaries: z.array(z.object({ text: z.string() }).passthrough()).default([]),
  textVersions: z.array(textVersionSchema).optional()
})

function canonicalClassification(type: string): string[] {
  const normalized = type.toLowerCase()
  if (normalized === "hr" || normalized === "s") {
    return ["bill"]
  }
  if (normalized === "hjres" || normalized === "sjres") {
    return ["joint-resolution"]
  }
  if (normalized === "hconres" || normalized === "sconres") {
    return ["concurrent-resolution"]
  }
  return ["resolution"]
}

function canonicalChamber(value: string | undefined): string | undefined {
  if (value?.toLowerCase() === "house") {
    return "lower"
  }
  if (value?.toLowerCase() === "senate") {
    return "upper"
  }
  return undefined
}

function dateOnly(value: string | undefined): string | undefined {
  return value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
}

export interface CongressNormalizationContext {
  retrievedAt?: Date
}

export function normalizeCongressBillBundle(
  input: unknown,
  context: CongressNormalizationContext = {}
): CanonicalBillAggregate {
  const source = congressBillBundleSchema.parse(input)
  const canonicalBillId = federalBillId(source.bill.congress, source.bill.type, source.bill.number)
  const federalJurisdictionId = jurisdictionId("us")
  const sessionId = legislativeSessionId("us", String(source.bill.congress))
  const members = [...source.bill.sponsors, ...source.cosponsors]
  const uniqueMembers = new Map(members.map((member) => [member.bioguideId, member]))

  return {
    actions: source.actions.flatMap((action, index) =>
      action.text === undefined
        ? []
        : [
            {
              actionDate: action.actionDate,
              billId: canonicalBillId,
              description: action.text,
              id: childId(
                "action",
                canonicalBillId,
                `${index}:${action.actionDate ?? "undated"}:${action.actionTime ?? ""}:${action.text}`
              ),
              ordinal: index
            }
          ]
    ),
    bill: {
      chamber: canonicalChamber(source.bill.originChamber),
      classification: canonicalClassification(source.bill.type),
      committees: source.committees.map((committee) => committee.name),
      id: canonicalBillId,
      identifier: `${source.bill.type.toUpperCase()} ${source.bill.number}`,
      introducedAt: source.bill.introducedDate,
      jurisdictionId: federalJurisdictionId,
      sessionId,
      sourceUpdatedAt: source.bill.updateDate === undefined ? undefined : new Date(source.bill.updateDate),
      sourceUrl: source.bill.url,
      subjects: [...source.subjects, ...(source.bill.policyArea === undefined ? [] : [source.bill.policyArea.name])],
      summary: source.summaries.at(-1)?.text,
      title: source.bill.title,
      upstreamIds: { congress: `${source.bill.congress}-${source.bill.type.toLowerCase()}-${source.bill.number}` }
    },
    documents: source.textVersions?.flatMap((version) =>
      version.formats.map((format) => ({
        document: {
          billId: canonicalBillId,
          classification: "version",
          contentType: format.type,
          documentDate: dateOnly(version.date),
          id: childId("document", canonicalBillId, `congress:${format.url}`),
          sourceUrl: format.url,
          title: version.type,
          versionCode: version.type
        }
      }))
    ),
    jurisdiction: {
      classification: "country",
      countryCode: "US",
      id: federalJurisdictionId,
      name: "United States"
    },
    people: [...uniqueMembers.values()].map((member) => ({
      id: personId("congress", member.bioguideId),
      jurisdictionId: federalJurisdictionId,
      name: member.fullName,
      sourceId: member.bioguideId,
      upstreamIds: { bioguide: member.bioguideId }
    })),
    organizations: source.committees.flatMap((committee) =>
      committee.systemCode === undefined
        ? []
        : [
            {
              billId: canonicalBillId,
              classification: "committee",
              organizationId: organizationId("congress", committee.systemCode),
              sourceName: committee.name
            }
          ]
    ),
    relations: source.relatedBills.map((relation) => {
      const sourceUpdatedAt =
        relation.updateDate === undefined && source.bill.updateDate === undefined
          ? undefined
          : new Date(relation.updateDate ?? source.bill.updateDate ?? "")
      return {
        billId: canonicalBillId,
        classification:
          relation.relationshipDetails?.toLowerCase().includes("companion") === true ? "companion" : "related",
        relatedBillId: federalBillId(relation.congress, relation.type, relation.number),
        ...outgoingRelationProvenance({
          sourceIsOfficial: true,
          sourceProvider: "congress",
          sourceRetrievedAt: context.retrievedAt,
          sourceUpdatedAt,
          sourceUrl: relation.url ?? source.bill.url
        })
      }
    }),
    session: {
      id: sessionId,
      identifier: String(source.bill.congress),
      jurisdictionId: federalJurisdictionId,
      name: `${source.bill.congress}th Congress`
    },
    sponsors: members.map((member, index) => ({
      billId: canonicalBillId,
      classification: index < source.bill.sponsors.length ? "primary" : "cosponsor",
      id: childId("sponsor", canonicalBillId, member.bioguideId),
      isPrimary: index < source.bill.sponsors.length,
      name: member.fullName,
      personId: personId("congress", member.bioguideId)
    }))
  }
}
