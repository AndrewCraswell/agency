import { z } from "zod"
import {
  childId,
  federalBillId,
  jurisdictionId,
  legislativeSessionId,
  personId
} from "../../legislation/identifiers.js"
import type { CanonicalBillAggregate } from "../../legislation/model.js"

const memberSchema = z.object({ bioguideId: z.string().min(1), fullName: z.string().min(1) }).passthrough()
const actionSchema = z
  .object({ actionDate: z.string().optional(), actionTime: z.string().optional(), text: z.string().min(1) })
  .passthrough()
const textVersionSchema = z.object({
  date: z.string().optional(),
  formats: z.array(z.object({ type: z.string().optional(), url: z.string().min(1) }).passthrough()).default([]),
  type: z.string().min(1)
})
const relatedBillSchema = z.object({
  congress: z.number().int().positive(),
  number: z.string().min(1),
  relationshipDetails: z.string().optional(),
  type: z.string().min(1)
})

export const congressBillBundleSchema = z.object({
  actions: z.array(actionSchema).default([]),
  bill: z
    .object({
      congress: z.number().int().positive(),
      introducedDate: z.string().optional(),
      number: z.string().min(1),
      originChamber: z.string().optional(),
      policyArea: z.object({ name: z.string() }).optional(),
      sponsors: z.array(memberSchema).default([]),
      title: z.string().min(1),
      type: z.string().min(1),
      updateDate: z.string().optional(),
      url: z.string().min(1)
    })
    .passthrough(),
  committees: z.array(z.object({ name: z.string().min(1) }).passthrough()).default([]),
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

export function normalizeCongressBillBundle(input: unknown): CanonicalBillAggregate {
  const source = congressBillBundleSchema.parse(input)
  const canonicalBillId = federalBillId(source.bill.congress, source.bill.type, source.bill.number)
  const federalJurisdictionId = jurisdictionId("us")
  const sessionId = legislativeSessionId("us", String(source.bill.congress))
  const members = [...source.bill.sponsors, ...source.cosponsors]
  const uniqueMembers = new Map(members.map((member) => [member.bioguideId, member]))

  return {
    actions: source.actions.map((action, index) => ({
      actionDate: action.actionDate,
      billId: canonicalBillId,
      description: action.text,
      id: childId(
        "action",
        canonicalBillId,
        `${action.actionDate ?? "undated"}:${action.actionTime ?? ""}:${action.text}`
      ),
      ordinal: index
    })),
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
    documents: source.textVersions?.flatMap((version, versionIndex) =>
      version.formats.map((format, formatIndex) => ({
        document: {
          billId: canonicalBillId,
          classification: "version",
          contentType: format.type,
          documentDate: version.date,
          id: childId("document", canonicalBillId, `congress:${versionIndex}:${formatIndex}:${format.url}`),
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
    relations: source.relatedBills.map((relation) => ({
      billId: canonicalBillId,
      classification:
        relation.relationshipDetails?.toLowerCase().includes("companion") === true ? "companion" : "related",
      relatedBillId: federalBillId(relation.congress, relation.type, relation.number)
    })),
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
