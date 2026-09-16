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
