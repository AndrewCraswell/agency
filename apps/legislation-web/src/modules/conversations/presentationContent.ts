import { z } from "zod"
import { billProgressSchema, projectBillProgress } from "./billProgress"
import { displayText } from "./displayText"
import { entityPageSchema, type EntityPage } from "./entityResults"
import { evidenceSnapshotSchema, sourceUrlSchema, type EvidenceSnapshot } from "./evidence"
import { projectVoteDetails, voteDetailsSchema } from "./recordDetails"

export const contentReferenceSchema = z.strictObject({ contentId: z.uuid() })
export const contentComponentSchema = z.enum([
  "BillProgressCard",
  "CitationCard",
  "CompactPassageCard",
  "PassageQuote",
  "ResultList",
  "ProgressPath",
  "RecordTimeline",
  "RollCall",
  "RecordStatus"
])
const timelineEventSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  description: z.string().min(1),
  date: z.string().nullish(),
  sourceUrl: sourceUrlSchema.nullish()
})
export const presentationContentSchema = z.discriminatedUnion("kind", [
  billProgressSchema,
  z.strictObject({ id: z.uuid(), kind: z.literal("evidence"), evidence: evidenceSnapshotSchema }),
  z.strictObject({ id: z.uuid(), kind: z.literal("result-list"), page: entityPageSchema }),
  z.strictObject({
    id: z.uuid(),
    kind: z.literal("timeline"),
    billId: z.string().min(1),
    events: z.array(timelineEventSchema).max(100),
    hasMore: z.boolean()
  }),
  z.strictObject({
    id: z.uuid(),
    kind: z.literal("roll-call"),
    details: voteDetailsSchema,
    resultId: z.uuid(),
    offset: z.number().int().nonnegative(),
    hasMore: z.boolean()
  }),
  z.strictObject({
    id: z.uuid(),
    kind: z.literal("record-status"),
    recordId: z.string().min(1),
    title: z.string().min(1),
    state: z.enum(["not-found", "not-collected"]),
    sourceUrl: sourceUrlSchema.nullable()
  })
])
export type PresentationContent = z.infer<typeof presentationContentSchema>
export type ContentComponent = z.infer<typeof contentComponentSchema>
export const contentKinds: Record<ContentComponent, PresentationContent["kind"]> = {
  BillProgressCard: "bill-progress",
  CitationCard: "evidence",
  CompactPassageCard: "evidence",
  PassageQuote: "evidence",
  ResultList: "result-list",
  ProgressPath: "timeline",
  RecordTimeline: "timeline",
  RollCall: "roll-call",
  RecordStatus: "record-status"
}

export function contentOptions(content: PresentationContent) {
  const components = contentComponentSchema.options.filter((component) => contentKinds[component] === content.kind)
  let label: string
  if (content.kind === "evidence") {
    label = content.evidence.title
  } else if (content.kind === "bill-progress") {
    label = content.record.title
  } else if (content.kind === "timeline") {
    label = content.billId
  } else if (content.kind === "result-list") {
    label = content.page.query ?? content.page.kind
  } else if (content.kind === "roll-call") {
    label = content.details.record.title
  } else {
    label = content.title
  }
  return {
    contentId: content.id,
    components,
    label,
    ...(content.kind === "evidence"
      ? {
          evidenceId: content.evidence.id,
          recordId: content.evidence.recordId,
          billId: content.evidence.billId,
          billIdentity: content.evidence.billIdentity,
          versionLabel: content.evidence.versionLabel,
          locator: content.evidence.locator,
          contentState: content.evidence.content.state,
          ...(content.evidence.content.state === "available" && content.evidence.content.truncated
            ? { passageTruncated: true, totalCharacters: content.evidence.content.totalCharacters }
            : {})
        }
      : {}),
    ...(content.kind === "record-status" ? { recordId: content.recordId, state: content.state } : {})
  }
}

export function projectPresentationContents(
  tool: string,
  data: unknown,
  evidence: EvidenceSnapshot[],
  page?: EntityPage
): PresentationContent[] {
  const contents: PresentationContent[] = evidence.map((source) => ({
    id: crypto.randomUUID(),
    kind: "evidence",
    evidence: source
  }))
  if (page) {
    contents.push({ id: crypto.randomUUID(), kind: "result-list", page })
    if (tool === "get_bill") {
      const progress = projectBillProgress(data, page)
      if (progress) {
        contents.push(progress)
      }
    }
  }
  const batch = z
    .object({
      items: z.array(z.object({ id: z.string(), error: z.object({ category: z.string() }).optional() })).max(100)
    })
    .safeParse(data)
  if (tool.startsWith("get_") && batch.success) {
    for (const item of batch.data.items) {
      if (item.error?.category === "not_found") {
        contents.push({
          id: crypto.randomUUID(),
          kind: "record-status",
          recordId: item.id,
          title: item.id,
          state: "not-found",
          sourceUrl: null
        })
      }
    }
  }
  if (tool === "get_bill_timeline") {
    const timeline = z
      .object({
        billId: z.string(),
        events: z.array(timelineEventSchema).max(100),
        nextCursor: z.string().nullish(),
        nextChildCursor: z.string().nullish(),
        truncated: z.boolean().optional()
      })
      .safeParse(data)
    if (timeline.success) {
      contents.push({
        id: crypto.randomUUID(),
        kind: "timeline",
        billId: timeline.data.billId,
        events: timeline.data.events.map((event) => ({ ...event, description: displayText(event.description) })),
        hasMore: Boolean(timeline.data.nextCursor ?? timeline.data.nextChildCursor) || timeline.data.truncated === true
      })
    }
  }
  if (tool === "get_vote" && page) {
    const pagination = z
      .object({
        nextCursor: z.string().nullish(),
        positionsTruncated: z.boolean().optional(),
        positionOffset: z.number().int().nonnegative().optional()
      })
      .safeParse(data)
    if (pagination.success) {
      try {
        contents.push({
          id: crypto.randomUUID(),
          kind: "roll-call",
          resultId: page.id,
          details: projectVoteDetails(data),
          offset: pagination.data.positionOffset ?? 0,
          hasMore: Boolean(pagination.data.nextCursor) || pagination.data.positionsTruncated === true
        })
      } catch {
        return contents
      }
    }
  }
  for (const source of evidence) {
    if (
      source.content.state === "not-collected" &&
      source.recordId &&
      /text|material/.test(tool) &&
      !evidence.some((candidate) => candidate.recordId === source.recordId && candidate.content.state === "available")
    ) {
      contents.push({
        id: crypto.randomUUID(),
        kind: "record-status",
        recordId: source.recordId,
        title: source.title,
        state: "not-collected",
        sourceUrl: source.sourceUrl
      })
    }
  }
  return contents.map((content) => presentationContentSchema.parse(content))
}
