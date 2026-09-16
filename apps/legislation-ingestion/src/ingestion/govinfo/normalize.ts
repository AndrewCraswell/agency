import {
  childId,
  federalBillId,
  jurisdictionId,
  legislativeSessionId,
  personId
} from "@repo/legislation-core/domain/identifiers"
import type { CanonicalBillAggregate } from "@repo/legislation-core/domain/model"
import { XMLParser } from "fast-xml-parser"
import { z } from "zod"
import { outgoingRelationProvenance } from "../relation-provenance.js"

const collection = <T extends z.ZodType>(item: T) =>
  z.preprocess((value) => {
    if (typeof value === "string") {
      return undefined
    }
    if (typeof value !== "object" || value === null || !("item" in value) || !Array.isArray(value.item)) {
      return value
    }
    return {
      ...value,
      item: value.item.flatMap((candidate) => {
        const parsed = item.safeParse(candidate)
        return parsed.success ? [parsed.data] : []
      })
    }
  }, z.object({ item: z.array(item).default([]) }).optional())
const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().optional()
)
const optionalNonemptyString = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().min(1).optional()
)
const sponsorSchema = z.object({ bioguideId: optionalString, fullName: z.string().min(1) }).passthrough()
const actionSchema = z
  .object({ actionDate: optionalString, actionTime: optionalString, text: optionalNonemptyString })
  .passthrough()
const committeeSchema = z.object({ name: z.string().min(1) }).passthrough()
const relationshipDetailsSchema = z.union([
  z.string(),
  z
    .object({
      item: z.array(z.object({ type: z.string().optional() }).passthrough()).default([])
    })
    .passthrough()
])
const relatedBillSchema = z
  .object({
    congress: z.coerce.number().int().positive(),
    number: z.coerce.string(),
    relationshipDetails: relationshipDetailsSchema.optional(),
    type: z.string()
  })
  .passthrough()
const textVersionSchema = z
  .object({
    date: optionalString,
    formats: z.preprocess(
      (value) => (typeof value === "string" ? undefined : value),
      collection(z.object({ url: z.url() }).passthrough())
    ),
    type: z.string().min(1)
  })
  .passthrough()
const billStatusSchema = z
  .object({
    billStatus: z.object({
      bill: z
        .object({
          actions: collection(actionSchema),
          committees: collection(committeeSchema),
          congress: z.coerce.number().int().positive(),
          cosponsors: collection(sponsorSchema),
          introducedDate: optionalString,
          latestAction: actionSchema.optional(),
          number: z.coerce.string(),
          originChamber: z.string().optional(),
          policyArea: z.preprocess(
            (value) => (typeof value === "string" ? undefined : value),
            z.object({ name: z.string() }).optional()
          ),
          relatedBills: collection(relatedBillSchema),
          sponsors: collection(sponsorSchema),
          summaries: collection(z.object({ text: z.string() }).passthrough()),
          textVersions: collection(textVersionSchema),
          titles: collection(z.object({ title: z.string(), titleType: z.string().optional() }).passthrough()),
          type: z.string().min(1),
          updateDate: optionalString
        })
        .passthrough()
    })
  })
  .passthrough()

const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (_name, jPath) => typeof jPath === "string" && jPath.endsWith(".item"),
  parseTagValue: false,
  removeNSPrefix: true,
  trimValues: true
})

export interface GovInfoDocumentInput {
  contentType?: string
  date?: string
  sourceUrl: string
  title: string
  versionCode: string
}

export interface GovInfoNormalizationContext {
  documents?: GovInfoDocumentInput[]
  retrievedAt?: Date
  sourceUrl: string
}

function chamber(value: string | undefined): string | undefined {
  const normalized = value?.toLowerCase()
  if (normalized === "house") {
    return "lower"
  }
  if (normalized === "senate") {
    return "upper"
  }
  return undefined
}

function classification(type: string): string[] {
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

function relationType(value: z.infer<typeof relationshipDetailsSchema> | undefined): string {
  const normalized =
    typeof value === "string"
      ? value.toLowerCase()
      : (value?.item
          .map((detail) => detail.type)
          .filter((type): type is string => type !== undefined)
          .join(" ")
          .toLowerCase() ?? "")
  return normalized.includes("companion") ? "companion" : "related"
}

function uniqueActions(actions: z.infer<typeof actionSchema>[] | undefined) {
  const seen = new Set<string>()
  return (actions ?? []).filter((action): action is typeof action & { text: string } => {
    if (action.text === undefined || action.text.trim().length === 0) {
      return false
    }
    const identity = `${action.actionDate ?? "undated"}:${action.actionTime ?? ""}:${action.text}`
    if (seen.has(identity)) {
      return false
    }
    seen.add(identity)
    return true
  })
}

function uniqueSponsors(sponsors: z.infer<typeof sponsorSchema>[]) {
  const seen = new Set<string>()
  return sponsors.filter((sponsor) => {
    const identity = sponsor.bioguideId?.toLowerCase() ?? sponsor.fullName.trim().toLowerCase()
    if (seen.has(identity)) {
      return false
    }
    seen.add(identity)
    return true
  })
}

function contentType(url: URL): string | undefined {
  const extension = url.pathname.split(".").at(-1)?.toLowerCase()
  return {
    htm: "text/html",
    html: "text/html",
    pdf: "application/pdf",
    txt: "text/plain",
    xml: "application/xml"
  }[extension ?? ""]
}

function documentFormatRank(url: URL): number {
  if (url.pathname.toLowerCase().includes("/uslm/") && url.pathname.toLowerCase().endsWith(".xml")) {
    return 0
  }
  return (
    {
      "application/pdf": 4,
      "application/xml": 1,
      "text/html": 3,
      "text/plain": 2
    }[contentType(url) ?? ""] ?? 5
  )
}

function embeddedDocuments(
  textVersions: z.infer<typeof textVersionSchema>[] | undefined,
  packagePrefix: string
): GovInfoDocumentInput[] {
  return (textVersions ?? []).flatMap((version) => {
    const documents = (version.formats?.item ?? []).flatMap((format) => {
      const url = new URL(format.url)
      if (url.protocol !== "https:") {
        return []
      }
      const packageId = url.pathname.match(/\/content\/pkg\/(BILLS-[^/]+)/i)?.[1]
      if (packageId === undefined || !packageId.toLowerCase().startsWith(packagePrefix.toLowerCase())) {
        return []
      }
      const versionCode = packageId.slice(packagePrefix.length).toLowerCase()
      if (!/^[a-z][a-z0-9]*$/.test(versionCode)) {
        return []
      }
      return [
        {
          contentType: contentType(url),
          date: version.date,
          sourceUrl: url.href,
          title: version.type,
          versionCode
        } as GovInfoDocumentInput
      ]
    })
    return (
      documents.sort(
        (left, right) => documentFormatRank(new URL(left.sourceUrl)) - documentFormatRank(new URL(right.sourceUrl))
      )[0] ?? []
    )
  })
}

export function normalizeGovInfoBillStatus(xml: string, context: GovInfoNormalizationContext): CanonicalBillAggregate {
  const parsed = billStatusSchema.parse(parser.parse(xml))
  const source = parsed.billStatus.bill
  const canonicalBillId = federalBillId(source.congress, source.type, source.number)
  const packagePrefix = `BILLS-${source.congress}${source.type.toLowerCase()}${source.number}`
  const federalJurisdictionId = jurisdictionId("us")
  const sessionId = legislativeSessionId("us", String(source.congress))
  const title =
    source.titles?.item.find((item) => item.titleType?.toLowerCase().includes("official"))?.title ??
    source.titles?.item[0]?.title

  if (title === undefined) {
    throw new Error("GovInfo bill status has no title")
  }

  const primarySponsors = uniqueSponsors(source.sponsors?.item ?? [])
  const cosponsors = uniqueSponsors(source.cosponsors?.item ?? [])
  const sourcePeople = uniqueSponsors([...primarySponsors, ...cosponsors])

  const people = sourcePeople.flatMap((sponsor) => {
    if (sponsor.bioguideId === undefined) {
      return []
    }
    return [
      {
        id: personId("congress", sponsor.bioguideId),
        jurisdictionId: federalJurisdictionId,
        name: sponsor.fullName,
        sourceId: sponsor.bioguideId,
        upstreamIds: { bioguide: sponsor.bioguideId }
      }
    ]
  })

  const documents = [
    ...(context.documents ?? []),
    ...embeddedDocuments(source.textVersions?.item, packagePrefix)
  ].filter(
    (document, index, all) => all.findIndex((candidate) => candidate.versionCode === document.versionCode) === index
  )

  return {
    actions: uniqueActions(source.actions?.item).map((action, index) => ({
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
      chamber: chamber(source.originChamber),
      classification: classification(source.type),
      committees: source.committees?.item.map((committee) => committee.name) ?? [],
      id: canonicalBillId,
      identifier: `${source.type.toUpperCase()} ${source.number}`,
      introducedAt: source.introducedDate,
      jurisdictionId: federalJurisdictionId,
      sessionId,
      sourceUpdatedAt: source.updateDate === undefined ? undefined : new Date(source.updateDate),
      sourceUrl: context.sourceUrl,
      status: source.latestAction?.text,
      subjects: source.policyArea === undefined ? [] : [source.policyArea.name],
      summary: source.summaries?.item.at(-1)?.text,
      title,
      upstreamIds: { govinfo: `BILLSTATUS-${source.congress}${source.type.toLowerCase()}${source.number}` }
    },
    documents: documents.map((document) => ({
      document: {
        billId: canonicalBillId,
        classification: "version",
        contentType: document.contentType,
        documentDate: document.date,
        id: childId("document", canonicalBillId, `govinfo:${document.versionCode}:${document.sourceUrl}`),
        sourceUrl: document.sourceUrl,
        title: document.title,
        versionCode: document.versionCode
      }
    })),
    jurisdiction: {
      classification: "country",
      countryCode: "US",
      id: federalJurisdictionId,
      name: "United States"
    },
    people,
    relations: (source.relatedBills?.item ?? [])
      .map((relation) => ({
        billId: canonicalBillId,
        classification: relationType(relation.relationshipDetails),
        relatedBillId: federalBillId(relation.congress, relation.type, relation.number),
        ...outgoingRelationProvenance({
          sourceIsOfficial: true,
          sourceProvider: "govinfo",
          sourceRetrievedAt: context.retrievedAt,
          sourceUpdatedAt: source.updateDate === undefined ? undefined : new Date(source.updateDate),
          sourceUrl: context.sourceUrl
        })
      }))
      .filter(
        (relation, index, all) =>
          relation.relatedBillId !== canonicalBillId &&
          all.findIndex(
            (candidate) =>
              candidate.relatedBillId === relation.relatedBillId && candidate.classification === relation.classification
          ) === index
      ),
    session: {
      id: sessionId,
      identifier: String(source.congress),
      jurisdictionId: federalJurisdictionId,
      name: `${source.congress}th Congress`
    },
    sponsors: [
      ...primarySponsors.map((sponsor, index) => ({
        billId: canonicalBillId,
        classification: "primary",
        id: childId("sponsor", canonicalBillId, sponsor.bioguideId ?? `${sponsor.fullName}:${index}`),
        isPrimary: true,
        name: sponsor.fullName,
        personId: sponsor.bioguideId === undefined ? undefined : personId("congress", sponsor.bioguideId)
      })),
      ...cosponsors.map((sponsor, index) => ({
        billId: canonicalBillId,
        classification: "cosponsor",
        id: childId("sponsor", canonicalBillId, sponsor.bioguideId ?? `${sponsor.fullName}:cosponsor:${index}`),
        isPrimary: false,
        name: sponsor.fullName,
        personId: sponsor.bioguideId === undefined ? undefined : personId("congress", sponsor.bioguideId)
      }))
    ]
  }
}
