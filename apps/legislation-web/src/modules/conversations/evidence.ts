import { z } from "zod"
import { citationReferenceSchema } from "./citationReference"
import { displayText } from "./displayText"
import { sessionLabel } from "./sessionLabels"

const billIdentitySchema = z.strictObject({
  id: z.string().regex(/^bill:[a-z0-9-]+:[^:]+:[a-z0-9-]+:[a-z0-9-]+$/),
  sessionId: z.string().min(1),
  identifier: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(1000)
})

export const sourceUrlSchema = z.url({ protocol: /^https?$/ }).pipe(
  z.string().refine((value) => {
    const url = new URL(value)
    if (url.username || url.password) {
      return false
    }
    return ![...url.searchParams.keys()].some((key) => /token|secret|signature|api[_-]?key|^sig$/i.test(key))
  }, "Source links must not contain credentials.")
)

export const evidenceSnapshotSchema = z.strictObject({
  id: z.string().min(1).max(256),
  recordId: z.string().min(1).max(512).optional(),
  billId: z.string().min(1).max(512).optional(),
  billIdentity: billIdentitySchema.optional(),
  citationRef: citationReferenceSchema.optional(),
  title: z.string().trim().min(1).max(1000),
  origin: z.enum(["canonical", "web"]),
  publisher: z.string().trim().min(1).max(240).optional(),
  versionLabel: z.string().trim().min(1).max(240).optional(),
  locator: z.string().trim().min(1).max(240).optional(),
  sourceUrl: sourceUrlSchema.nullable(),
  sourceUrlOmitted: z.literal(true).optional(),
  readableUrl: sourceUrlSchema.optional(),
  content: z.discriminatedUnion("state", [
    z.strictObject({
      state: z.literal("available"),
      quote: z.string().min(1).max(20000),
      truncated: z.literal(true).optional(),
      totalCharacters: z.number().int().positive().optional()
    }),
    z.strictObject({ state: z.enum(["not-collected", "unavailable", "failed"]) })
  ])
})

export const citedAnswerSchema = z
  .strictObject({
    claims: z
      .array(
        z.strictObject({
          id: z.string().min(1).max(256),
          text: z.string().trim().min(1).max(20000),
          citationIds: z.array(z.string().min(1).max(256)).max(25)
        })
      )
      .max(100),
    citations: z.array(evidenceSnapshotSchema).max(100)
  })
  .superRefine((answer, context) => {
    const citationIds = new Set(answer.citations.map((citation) => citation.id))
    if (citationIds.size !== answer.citations.length) {
      context.addIssue({ code: "custom", path: ["citations"], message: "Citation IDs must be unique." })
    }
    if (new Set(answer.claims.map((claim) => claim.id)).size !== answer.claims.length) {
      context.addIssue({ code: "custom", path: ["claims"], message: "Claim IDs must be unique." })
    }
    answer.claims.forEach((claim, index) => {
      if (
        new Set(claim.citationIds).size !== claim.citationIds.length ||
        claim.citationIds.some((id) => !citationIds.has(id))
      ) {
        context.addIssue({
          code: "custom",
          path: ["claims", index, "citationIds"],
          message: "Claims must reference distinct evidence from this answer."
        })
      }
    })
  })

export type EvidenceSnapshot = z.infer<typeof evidenceSnapshotSchema>
export function projectModelEvidence({ citationRef: _citationRef, ...source }: EvidenceSnapshot, index: number) {
  return { ...source, citation: `[${index + 1}](#citation-${source.id})` }
}

export const researchContextSchema = z.object({ evidence: z.array(evidenceSnapshotSchema).max(320) })

const sourceBillSchema = z.object({
  id: billIdentitySchema.shape.id,
  identifier: z.string().nullish(),
  title: z.string().trim().min(1),
  origin: z.enum(["canonical", "web"]).optional()
})

const sourceRecordSchema = z.object({
  origin: z.enum(["canonical", "web"]).optional(),
  id: z.string().nullish(),
  type: z.string().nullish(),
  recordType: z.string().nullish(),
  recordId: z.string().nullish(),
  documentId: z.string().nullish(),
  materialId: z.string().nullish(),
  provisionId: z.string().nullish(),
  passageId: z.string().nullish(),
  sectionId: z.string().nullish(),
  ordinal: z.number().int().nullish(),
  sourceLocator: z.string().nullish(),
  billId: z.string().nullish(),
  bill: sourceBillSchema.nullish(),
  identifier: z.string().nullish(),
  classification: z
    .union([z.string(), z.array(z.string())])
    .nullish()
    .transform((value) => (typeof value === "string" ? value : undefined)),
  title: z.string().nullish(),
  name: z.string().nullish(),
  sourceUrl: z.string().nullish(),
  url: z.string().nullish(),
  canonicalUrl: z.string().nullish(),
  readableUrl: z.string().nullish(),
  contentType: z.string().nullish(),
  mimeType: z.string().nullish(),
  format: z.string().nullish(),
  renditions: z.array(z.unknown()).nullish(),
  text: z.string().nullish(),
  textOffset: z.number().int().nonnegative().nullish(),
  nextTextOffset: z.number().int().nonnegative().nullish(),
  totalCharacters: z.number().int().nonnegative().nullish(),
  truncated: z.boolean().optional(),
  snippet: z.string().nullish(),
  heading: z.string().nullable().optional(),
  sectionIdentifier: z.string().nullable().optional(),
  processingStatus: z.string().nullish(),
  availability: z.string().nullish(),
  contentHash: z.string().nullish(),
  versionId: z.string().nullish(),
  sourceObservationId: z.string().nullish(),
  versionHash: z.string().nullish(),
  versionCode: z.string().nullable().optional(),
  documentDate: z.string().nullable().optional()
})

export type EvidenceSourceContext = z.infer<typeof sourceRecordSchema>

function sourceBill(source: EvidenceSourceContext) {
  if (source.origin === "web" || source.materialId || source.provisionId) {
    return undefined
  }
  if (!source.documentId && source.id && source.title && billIdentitySchema.shape.id.safeParse(source.id).success) {
    return { id: source.id, title: source.title, identifier: source.identifier }
  }
  return source.bill?.origin !== "web" && source.bill?.id === source.billId ? source.bill : undefined
}

function billIdentity(source: EvidenceSourceContext) {
  const bill = sourceBill(source)
  if (!bill) {
    return undefined
  }
  const [, jurisdiction, session] = bill.id.split(":")
  return billIdentitySchema.parse({
    id: bill.id,
    sessionId: `session:${jurisdiction}:${session}`,
    identifier: bill.identifier ? displayText(bill.identifier, 240) : undefined,
    title: displayText(bill.title)
  })
}

function withParentBill(source: EvidenceSourceContext, parent?: EvidenceSourceContext): EvidenceSourceContext {
  const bill = source.bill ?? parent?.bill
  return bill && source.billId === bill.id && source.origin !== "web" ? { ...source, bill } : source
}

const actionRecordSchema = z.object({
  id: z.string().min(1),
  billId: z.string().min(1).nullish(),
  type: z.string().nullish(),
  description: z.string().min(1),
  actionDate: z.string().nullish(),
  actionAt: z.union([z.string(), z.date()]).nullish(),
  date: z.string().nullish(),
  sourceUrl: z.string().nullish(),
  sourceObservationId: z.string().nullish()
})

function actionSource(
  value: unknown,
  collection: string | undefined,
  parent: EvidenceSourceContext | undefined
): EvidenceSourceContext | undefined {
  if (collection !== "actions" && collection !== "latestAction" && collection !== "events") {
    return undefined
  }
  const parsed = actionRecordSchema.safeParse(value)
  if (!parsed.success || (collection === "events" && parsed.data.type !== "action")) {
    return undefined
  }
  const action = parsed.data
  const billId = action.billId ?? parent?.billId
  if (!billId) {
    return undefined
  }
  const timestamp = action.actionAt instanceof Date ? action.actionAt.toISOString() : action.actionAt
  const date = timestamp ?? action.actionDate ?? action.date ?? undefined
  return {
    id: action.id,
    recordType: "action",
    classification: undefined,
    billId,
    title: action.description,
    sourceUrl: action.sourceUrl,
    sourceLocator: date,
    sourceObservationId: action.sourceObservationId,
    contentHash: JSON.stringify([action.description, date ?? null])
  }
}

function matchesDocumentVersion(record: EvidenceSourceContext, document: EvidenceSourceContext) {
  for (const field of [
    "billId",
    "versionId",
    "sourceObservationId",
    "versionHash",
    "versionCode",
    "documentDate"
  ] as const) {
    if (record[field] !== undefined && (record[field] ?? null) !== (document[field] ?? null)) {
      return false
    }
  }
  return true
}

function inheritDocument(record: EvidenceSourceContext, document?: EvidenceSourceContext): EvidenceSourceContext {
  if (
    !document ||
    !record.documentId ||
    record.documentId !== (document.documentId ?? document.id) ||
    !matchesDocumentVersion(record, document)
  ) {
    return record
  }
  return {
    ...document,
    ...record,
    classification: record.classification ?? document.classification,
    id: record.id,
    type: record.type,
    recordType: record.recordType,
    recordId: record.recordId,
    text: record.text,
    snippet: record.snippet,
    passageId: record.passageId,
    sectionId: record.sectionId,
    ordinal: record.ordinal,
    sourceLocator: record.sourceLocator,
    heading: record.heading,
    sectionIdentifier: record.sectionIdentifier
  }
}

function evidenceIdentity(source: EvidenceSourceContext, sourceUrl: string | null) {
  let recordType = source.recordType ?? source.type ?? "record"
  let recordId = source.recordId ?? source.id ?? sourceUrl ?? source.sourceUrl ?? source.url ?? source.canonicalUrl
  if (source.documentId) {
    recordType = "document"
    recordId = source.documentId
  } else if (source.materialId) {
    recordType = "material"
    recordId = source.materialId
  } else if (source.provisionId) {
    recordType = "provision"
    recordId = source.provisionId
  }
  let passageId = source.passageId ?? source.sectionId ?? null
  if (!passageId && source.id && source.id !== recordId) {
    passageId = source.id
  }
  const identity = [
    recordType,
    recordId,
    source.billId ?? null,
    source.versionId ?? null,
    source.versionCode ?? null,
    source.documentDate ?? null,
    source.sourceObservationId ?? null,
    source.versionHash ?? null,
    passageId,
    passageId ? null : (source.ordinal ?? null),
    passageId ? null : (source.sourceLocator ?? source.sectionIdentifier ?? source.heading ?? null),
    source.text ?? source.contentHash ?? null,
    source.textOffset ?? 0
  ]
  const bill = sourceBill(source)
  return JSON.stringify(
    bill ? [...identity, { id: bill.id, identifier: bill.identifier, title: bill.title }] : identity
  )
}

export function projectResearchEvidence(
  data: unknown,
  createId: (identity: string) => string,
  resolveSource?: (
    evidence: EvidenceSnapshot,
    source: EvidenceSourceContext,
    sources: readonly EvidenceSourceContext[]
  ) => EvidenceSnapshot
): EvidenceSnapshot[] {
  const evidence: { snapshot: EvidenceSnapshot; source: EvidenceSourceContext }[] = []
  const sources: EvidenceSourceContext[] = []
  const seen = new Set<string>()
  let visited = 0
  function visit(value: unknown, parent?: EvidenceSourceContext, depth = 0, collection?: string) {
    if (++visited > 3000 || depth > 12) {
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, parent, depth + 1, collection)
      }
      return
    }
    if (value === null || typeof value !== "object") {
      return
    }
    const parsed = sourceRecordSchema.safeParse(value)
    let context = parent
    if ("document" in value) {
      const document = sourceRecordSchema.safeParse(value.document)
      context = undefined
      if (document.success && (!parsed.success || matchesDocumentVersion(parsed.data, document.data))) {
        context = withParentBill(document.data, parsed.success ? parsed.data : undefined)
      }
    }
    if (parsed.success) {
      const record = parsed.data
      const source =
        actionSource(value, collection, context) ?? withParentBill(inheritDocument(record, context), context)
      const rawUrl = source.sourceUrl ?? source.url ?? source.canonicalUrl
      const url = sourceUrlSchema.safeParse(rawUrl)
      const sourceUrl = url.success && url.data.length <= 8192 ? url.data : null
      const title = source.title ?? source.name ?? source.heading
      const hasSource = Boolean(rawUrl || ((source.recordId ?? source.id ?? source.documentId) && title))
      if (hasSource && sources.length < 1600) {
        sources.push(source)
      }
      const key = evidenceIdentity(source, sourceUrl)
      if (hasSource && evidence.length < 1600 && !seen.has(key)) {
        const quote = source.text
        let displayTitle = title ? displayText(title) : undefined
        if (!displayTitle && url.success) {
          displayTitle = new URL(url.data).hostname
        }
        const bill = billIdentity(source)
        const isBillVersion = source.classification === "version" && bill !== undefined
        if (isBillVersion) {
          const identity = [bill.identifier, `(${sessionLabel(bill.sessionId)})`].filter(Boolean).join(" ")
          displayTitle = displayText(`${identity}: ${bill.title}`)
        }
        const snapshot = evidenceSnapshotSchema.safeParse({
          id: createId(key),
          recordId:
            source.recordId ?? source.documentId ?? source.materialId ?? source.provisionId ?? source.id ?? undefined,
          billId: source.billId ?? bill?.id,
          billIdentity: bill,
          title: displayTitle,
          origin: source.origin ?? "canonical",
          sourceUrl,
          ...(url.success && url.data.length > 8192 ? { sourceUrlOmitted: true } : {}),
          versionLabel:
            displayText(
              [isBillVersion ? (source.title ?? source.versionCode) : source.versionCode, source.documentDate]
                .filter(Boolean)
                .join(", "),
              240
            ) || undefined,
          locator:
            displayText(source.sourceLocator ?? source.sectionIdentifier ?? source.heading ?? "", 240) || undefined,
          content: evidenceContent(source, quote)
        })
        if (snapshot.success) {
          seen.add(key)
          evidence.push({ snapshot: snapshot.data, source })
        }
      }
      if (
        !("document" in value) &&
        (record.id || record.documentId || record.recordId || record.billId || record.bill)
      ) {
        context = source
      }
    }
    for (const [key, item] of Object.entries(value)) {
      if (key !== "embedding" && key !== "renditions" && item !== null && typeof item === "object") {
        visit(item, context, depth + 1, key)
      }
    }
  }
  visit(data)
  const selected = new Set(
    evidence
      .toSorted(
        (left, right) =>
          Number(right.snapshot.content.state === "available") - Number(left.snapshot.content.state === "available")
      )
      .slice(0, 40)
  )
  return evidence
    .filter((item) => selected.has(item))
    .map(({ snapshot, source }) => {
      if (!resolveSource) {
        return snapshot
      }
      return evidenceSnapshotSchema.parse(resolveSource(snapshot, source, sources))
    })
}

export function humanReadableUrl(value: unknown): string | null {
  const parsed = sourceUrlSchema.safeParse(value)
  if (!parsed.success) {
    return null
  }
  const source = new URL(parsed.data)
  let path: string
  try {
    path = decodeURIComponent(source.pathname)
  } catch {
    return null
  }
  const federalHosts = ["www.govinfo.gov", "govinfo.gov"]
  let bill =
    source.hostname === "api.congress.gov"
      ? /^\/v3\/bill\/([1-9][0-9]*)\/(hr|s|hjres|sjres|hconres|sconres|hres|sres)\/([1-9][0-9]*)\/?$/i.exec(path)
      : null
  if (federalHosts.includes(source.hostname)) {
    const status =
      /^\/bulkdata\/BILLSTATUS\/([1-9][0-9]*)\/(hr|s|hjres|sjres|hconres|sconres|hres|sres)\/BILLSTATUS-\1\2([1-9][0-9]*)\.xml$/i.exec(
        path
      )
    bill = status ?? bill
    const document = /^\/content\/pkg\/([A-Z0-9-]+)\/xml\/\1\.xml$/i.exec(path)
    if (document) {
      return `https://www.govinfo.gov/content/pkg/${document[1]}/pdf/${document[1]}.pdf`
    }
  }
  const amendment =
    source.hostname === "api.congress.gov"
      ? /^\/v3\/amendment\/([1-9][0-9]*)\/(hamdt|samdt)\/([1-9][0-9]*)\/?$/i.exec(path)
      : null
  const record = bill ?? amendment
  if (record) {
    const congress = record[1]!
    const types: Record<string, string> = {
      hr: "house-bill",
      s: "senate-bill",
      hjres: "house-joint-resolution",
      sjres: "senate-joint-resolution",
      hconres: "house-concurrent-resolution",
      sconres: "senate-concurrent-resolution",
      hres: "house-resolution",
      sres: "senate-resolution",
      hamdt: "house-amendment",
      samdt: "senate-amendment"
    }
    const suffixes: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" }
    const suffix = suffixes[new Intl.PluralRules("en", { type: "ordinal" }).select(Number(congress))]
    return `https://www.congress.gov/${bill ? "bill" : "amendment"}/${congress}${suffix}-congress/${types[record[2]!.toLowerCase()]}/${record[3]}`
  }
  if (
    /(^|\.)api\./i.test(source.hostname) ||
    /\/(api|bulkdata)(\/|$)/i.test(path) ||
    /\.(xml|json|jsonl|ndjson|csv|tsv|zip|gz|txt)\/?$/i.test(path) ||
    [...source.searchParams].some(
      ([key, format]) => /^(format|output|outputformat|f)$/i.test(key) && /^(xml|json|csv|txt)$/i.test(format)
    )
  ) {
    return null
  }
  return parsed.data
}

export function evidenceSourceUrl(evidence: Pick<EvidenceSnapshot, "sourceUrl" | "readableUrl">): string | null {
  return humanReadableUrl(evidence.readableUrl) ?? humanReadableUrl(evidence.sourceUrl)
}

function evidenceContent(source: EvidenceSourceContext, quote: string | null | undefined): EvidenceSnapshot["content"] {
  if (quote) {
    const truncated =
      source.truncated === true ||
      quote.length > 20000 ||
      (source.totalCharacters ?? quote.length) > quote.length ||
      (source.nextTextOffset !== null && source.nextTextOffset !== undefined) ||
      (source.textOffset ?? 0) > 0
    return {
      state: "available",
      quote: quote.slice(0, 20000),
      ...(truncated ? { truncated: true, totalCharacters: source.totalCharacters ?? quote.length } : {})
    }
  }
  if (source.processingStatus === "failed") {
    return { state: "failed" }
  }
  if (["unavailable", "restricted", "empty"].includes(source.availability ?? "")) {
    return { state: "unavailable" }
  }
  return { state: "not-collected" }
}

export function formatEvidenceCitation(evidence: EvidenceSnapshot) {
  const parts = [evidence.title, evidence.publisher, evidence.versionLabel, evidence.locator]
  if (evidence.content.state === "available") {
    parts.push(evidence.content.quote)
  }
  if (evidence.sourceUrl) {
    parts.push(evidence.sourceUrl)
  }
  return parts.filter((part) => part !== undefined).join("\n")
}
