import { XMLParser } from "fast-xml-parser"
import { z } from "zod"
import {
  childId,
  federalBillId,
  jurisdictionId,
  legislativeSessionId,
  personId
} from "../../legislation/identifiers.js"
import type { CanonicalBillAggregate } from "../../legislation/model.js"

const collection = <T extends z.ZodType>(item: T) => z.object({ item: z.array(item).default([]) }).optional()
const sponsorSchema = z.object({ bioguideId: z.string().optional(), fullName: z.string().min(1) }).passthrough()
const actionSchema = z
  .object({ actionDate: z.string().optional(), actionTime: z.string().optional(), text: z.string().min(1) })
  .passthrough()
const committeeSchema = z.object({ name: z.string().min(1) }).passthrough()
const relatedBillSchema = z
  .object({
    congress: z.coerce.number().int().positive(),
    number: z.coerce.string(),
    relationshipDetails: z.string().optional(),
    type: z.string()
  })
  .passthrough()
const textVersionSchema = z
  .object({
    date: z.string().optional(),
    formats: collection(z.object({ url: z.url() }).passthrough()),
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
          introducedDate: z.string().optional(),
          latestAction: actionSchema.optional(),
          number: z.coerce.string(),
          originChamber: z.string().optional(),
          policyArea: z.object({ name: z.string() }).optional(),
          relatedBills: collection(relatedBillSchema),
          sponsors: collection(sponsorSchema),
          summaries: collection(z.object({ text: z.string() }).passthrough()),
          textVersions: collection(textVersionSchema),
          titles: collection(z.object({ title: z.string(), titleType: z.string().optional() }).passthrough()),
          type: z.string().min(1),
          updateDate: z.string().optional()
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

function relationType(value: string | undefined): string {
  const normalized = value?.toLowerCase() ?? ""
  return normalized.includes("companion") ? "companion" : "related"
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

function embeddedDocuments(
  textVersions: z.infer<typeof textVersionSchema>[] | undefined,
  packagePrefix: string
): GovInfoDocumentInput[] {
  return (textVersions ?? []).flatMap((version) =>
    (version.formats?.item ?? []).flatMap((format) => {
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
        }
      ]
    })
  )
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

  const primarySponsors = source.sponsors?.item ?? []
  const cosponsors = source.cosponsors?.item ?? []
  const sourcePeople = [...primarySponsors, ...cosponsors]

  const people = sourcePeople.flatMap((sponsor) => {
    if (sponsor.bioguideId === undefined) {
      return []
    }
    return [
      {
        id: personId("congress", sponsor.bioguideId),
        name: sponsor.fullName,
        upstreamIds: { bioguide: sponsor.bioguideId }
      }
    ]
  })

  const documents = [
    ...(context.documents ?? []),
    ...embeddedDocuments(source.textVersions?.item, packagePrefix)
  ].filter((document, index, all) => all.findIndex((candidate) => candidate.sourceUrl === document.sourceUrl) === index)

  return {
    actions:
      source.actions?.item.map((action, index) => ({
        actionDate: action.actionDate,
        billId: canonicalBillId,
        description: action.text,
        id: childId(
          "action",
          canonicalBillId,
          `${action.actionDate ?? "undated"}:${action.actionTime ?? ""}:${action.text}`
        ),
        ordinal: index
      })) ?? [],
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
    relations:
      source.relatedBills?.item.map((relation) => ({
        billId: canonicalBillId,
        classification: relationType(relation.relationshipDetails),
        relatedBillId: federalBillId(relation.congress, relation.type, relation.number)
      })) ?? [],
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
