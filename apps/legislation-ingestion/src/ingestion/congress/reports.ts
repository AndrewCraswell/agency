import type { supportingMaterialLinks, supportingMaterials } from "@repo/legislation-core/database/schema/schema"
import {
  federalBillId,
  jurisdictionId,
  organizationId,
  supportingMaterialId
} from "@repo/legislation-core/domain/identifiers"
import { z } from "zod"

const optionalString = z.preprocess(
  (value) => (value === null || (typeof value === "string" && value.trim().length === 0) ? undefined : value),
  z.string().trim().min(1).optional()
)
const billSchema = z
  .object({ congress: z.number().int().positive(), number: z.string().min(1), type: z.string().min(1) })
  .passthrough()
const committeeSchema = z.object({ name: optionalString, systemCode: z.string().min(1) }).passthrough()
const formatSchema = z
  .object({ isErrata: optionalString, type: z.string().min(1), url: z.string().url() })
  .passthrough()
const bundleSchema = z.object({
  reference: z
    .object({
      citation: z.string().min(1),
      cmte_rpt_id: z.string().min(1),
      congress: z.number().int().positive(),
      number: z.string().min(1),
      part: optionalString,
      type: z.string().min(1),
      updateDate: optionalString,
      url: z.string().url()
    })
    .passthrough(),
  report: z
    .object({
      associatedBill: z.array(billSchema).default([]),
      committees: z.array(committeeSchema).default([]),
      issueDate: optionalString,
      title: optionalString,
      updateDate: optionalString
    })
    .passthrough(),
  text: z.array(z.object({ formats: z.array(formatSchema).default([]) }).passthrough()).default([])
})

type MaterialInsert = typeof supportingMaterials.$inferInsert
type MaterialLinkInsert = typeof supportingMaterialLinks.$inferInsert

export interface CongressCommitteeReportSnapshot {
  materials: Array<{ links: MaterialLinkInsert[]; material: MaterialInsert }>
}

function dateOnly(value: string | undefined): string | undefined {
  return value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
}

export function congressReportPublicationDate(text: string) {
  const header = text.slice(0, 2500).replaceAll(/\s+/g, " ")
  if (!/\b\d+(?:th|st|nd|rd)\s+Congress\b/i.test(header) || !/\bREPORT\b/i.test(header)) { return undefined }
  const months: Record<string, string> = { january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12" }
  const dates = new Set<string>()
  for (const match of header.matchAll(/\b([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*\.\s*[-\u2013\u2014]+\s*(?:Ordered to be printed|Committed to the Committee of the Whole House on the State of the Union and ordered to be printed)/gi)) {
    const month = months[match[1]!.toLowerCase()]
    if (!month) { continue }
    const date = z.iso.date().safeParse(`${match[3]}-${month}-${match[2]!.padStart(2, "0")}`)
    if (date.success) { dates.add(date.data) }
  }
  return dates.size === 1 ? [...dates][0] : undefined
}

function contentType(format: string): string | undefined {
  const normalized = format.toLowerCase()
  if (normalized.includes("pdf")) {
    return "application/pdf"
  }
  if (normalized.includes("html") || normalized.includes("formatted text")) {
    return "text/html"
  }
  return normalized.includes("text") ? "text/plain" : undefined
}

export function normalizeCongressCommitteeReportBundle(input: unknown): CongressCommitteeReportSnapshot {
  const source = bundleSchema.parse(input)
  const sourceIdentity = source.reference.cmte_rpt_id
  const title = source.report.title ?? source.reference.citation
  const billIds = [
    ...new Set(source.report.associatedBill.map((bill) => federalBillId(bill.congress, bill.type, bill.number)))
  ]
  const organizationIds = [
    ...new Set(source.report.committees.map((committee) => organizationId("congress", committee.systemCode)))
  ]
  const formats = [
    ...new Map(source.text.flatMap((entry) => entry.formats).map((format) => [format.url, format])).values()
  ]
  const representations =
    formats.length === 0 ? [{ isErrata: undefined, type: "API record", url: source.reference.url }] : formats

  return {
    materials: representations.map((format) => {
      const materialId = supportingMaterialId("congress", `${sourceIdentity}:${format.url}`)
      return {
        links: [
          ...billIds.map((billId) => ({ billId, classification: "reported-bill", materialId })),
          ...organizationIds.map((organizationId) => ({
            classification: "reporting-committee",
            materialId,
            organizationId
          }))
        ],
        material: {
          classification: "committee-report",
          contentType: contentType(format.type),
          documentDate: dateOnly(source.report.issueDate),
          id: materialId,
          jurisdictionId: jurisdictionId("us"),
          sourceId: `${sourceIdentity}:${format.url}`,
          sourceUpdatedAt:
            source.report.updateDate === undefined && source.reference.updateDate === undefined
              ? undefined
              : new Date(source.report.updateDate ?? source.reference.updateDate ?? ""),
          sourceUrl: format.url,
          title: `${source.reference.citation}: ${title}${format.isErrata === "Y" ? " (errata)" : ""}`
        }
      }
    })
  }
}
