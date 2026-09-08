import { z } from "zod"
import type {
  amendmentActions,
  amendments,
  supportingMaterialLinks,
  supportingMaterials
} from "../../db/schema/schema.js"
import {
  amendmentChildId,
  federalAmendmentId,
  federalBillId,
  jurisdictionId,
  legislativeSessionId,
  personId,
  supportingMaterialId
} from "../../legislation/identifiers.js"

const optionalString = z.preprocess(
  (value) => (value === null || (typeof value === "string" && value.trim().length === 0) ? undefined : value),
  z.string().trim().min(1).optional()
)
const actionSchema = z
  .object({
    actionCode: optionalString,
    actionDate: optionalString,
    actionTime: optionalString,
    text: optionalString,
    type: optionalString
  })
  .passthrough()
const formatSchema = z.object({ type: z.string().min(1), url: z.string().url() }).passthrough()
const textVersionSchema = z
  .object({ date: optionalString, formats: z.array(formatSchema).default([]), type: optionalString })
  .passthrough()
const sponsorSchema = z
  .object({ bioguideId: optionalString, fullName: optionalString, name: optionalString })
  .passthrough()
const amendedBillSchema = z
  .object({ congress: z.number().int().positive(), number: z.string().min(1), type: z.string().min(1) })
  .passthrough()
const bundleSchema = z.object({
  actions: z.array(actionSchema).default([]),
  amendment: z
    .object({
      amendedBill: amendedBillSchema.optional(),
      chamber: optionalString,
      congress: z.number().int().positive(),
      description: optionalString,
      latestAction: z.object({ text: optionalString }).passthrough().optional(),
      number: z.string().min(1),
      purpose: optionalString,
      sponsors: z.array(sponsorSchema).default([]),
      submittedDate: optionalString,
      type: z.string().min(1),
      updateDate: optionalString
    })
    .passthrough(),
  sourceUrl: z.string().url(),
  textVersions: z.array(textVersionSchema).default([])
})

type AmendmentInsert = typeof amendments.$inferInsert
type ActionInsert = typeof amendmentActions.$inferInsert
type MaterialInsert = typeof supportingMaterials.$inferInsert
type MaterialLinkInsert = typeof supportingMaterialLinks.$inferInsert

export interface CongressAmendmentSnapshot {
  actions: ActionInsert[]
  amendment: AmendmentInsert
  materials: Array<{ link: MaterialLinkInsert; material: MaterialInsert }>
}

function dateOnly(value: string | undefined): string | undefined {
  return value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
}

function chamber(value: string | undefined): "lower" | "upper" | undefined {
  const normalized = value?.toLowerCase()
  if (normalized?.includes("house")) {
    return "lower"
  }
  return normalized?.includes("senate") ? "upper" : undefined
}

function amendmentStatus(latestAction: string | undefined): string | undefined {
  const normalized = latestAction?.toLowerCase()
  if (normalized?.includes("failed")) {
    return "failed"
  }
  if (normalized?.includes("agreed to")) {
    return "agreed"
  }
  if (normalized?.includes("withdrawn")) {
    return "withdrawn"
  }
  return undefined
}

function contentType(format: string): string | undefined {
  const normalized = format.toLowerCase()
  if (normalized === "pdf") {
    return "application/pdf"
  }
  if (normalized === "html") {
    return "text/html"
  }
  return normalized === "text" ? "text/plain" : undefined
}

export function normalizeCongressAmendmentBundle(input: unknown): CongressAmendmentSnapshot {
  const source = bundleSchema.parse(input)
  const amendment = source.amendment
  const canonicalAmendmentId = federalAmendmentId(amendment.congress, amendment.type, amendment.number)
  const relatedBillId =
    amendment.amendedBill === undefined
      ? undefined
      : federalBillId(amendment.amendedBill.congress, amendment.amendedBill.type, amendment.amendedBill.number)
  const sponsor = amendment.sponsors[0]
  const printedIdentifier = `${amendment.type.toUpperCase()} ${amendment.number}`
  return {
    actions: source.actions.flatMap((action, ordinal) => {
      const description = action.text ?? action.actionCode ?? action.type
      return description === undefined
        ? []
        : [
            {
              actionDate: dateOnly(action.actionDate),
              amendmentId: canonicalAmendmentId,
              classification: action.type === undefined ? [] : [action.type.toLowerCase()],
              description,
              id: amendmentChildId("action", canonicalAmendmentId, `${ordinal}:${action.actionCode ?? description}`),
              ordinal,
              sourceUrl: source.sourceUrl
            }
          ]
    }),
    amendment: {
      amendmentNumber: amendment.number,
      amendmentType: amendment.type.toLowerCase(),
      billId: relatedBillId,
      chamber: chamber(amendment.chamber),
      description: amendment.description,
      id: canonicalAmendmentId,
      jurisdictionId: jurisdictionId("us"),
      printedIdentifier,
      purpose: amendment.purpose,
      sessionId: legislativeSessionId("us", String(amendment.congress)),
      sourceId: `${amendment.congress}-${amendment.type.toLowerCase()}-${amendment.number}`,
      sourceUpdatedAt: amendment.updateDate === undefined ? undefined : new Date(amendment.updateDate),
      sourceUrl: source.sourceUrl,
      sponsorName: sponsor?.fullName ?? sponsor?.name,
      sponsorPersonId: sponsor?.bioguideId === undefined ? undefined : personId("congress", sponsor.bioguideId),
      sponsorSourceId: sponsor?.bioguideId,
      status: amendmentStatus(amendment.latestAction?.text),
      submittedDate: dateOnly(amendment.submittedDate),
      upstreamIds: { congress: `${amendment.congress}-${amendment.type.toLowerCase()}-${amendment.number}` }
    },
    materials: source.textVersions.flatMap((version, versionIndex) =>
      version.formats.map((format, formatIndex) => {
        const identity = `${versionIndex}:${formatIndex}:${format.url}`
        const materialId = supportingMaterialId("congress", `${canonicalAmendmentId}:${identity}`)
        return {
          link: { amendmentId: canonicalAmendmentId, billId: relatedBillId, materialId },
          material: {
            classification: "amendment-text",
            contentType: contentType(format.type),
            documentDate: dateOnly(version.date),
            id: materialId,
            jurisdictionId: jurisdictionId("us"),
            sourceId: `${amendment.congress}-${amendment.type.toLowerCase()}-${amendment.number}:${identity}`,
            sourceUrl: format.url,
            title: `${printedIdentifier} ${version.type ?? "text"} (${format.type})`
          }
        }
      })
    )
  }
}
