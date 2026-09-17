import { defineCatalog } from "@json-render/core"
import { schema } from "@json-render/react/schema"
import type { UIMessage } from "ai"
import { z } from "zod"
import { entityCardSchema } from "./entityResults"
import {
  contentComponentSchema,
  contentKinds,
  contentReferenceSchema,
  presentationContentSchema
} from "./presentationContent"

export const presentationReferenceSchema = z.strictObject({
  resultId: z.uuid(),
  recordId: z
    .string()
    .min(1)
    .max(512)
    .refine(
      (id) =>
        id.trim().length > 0 &&
        !/\p{Cc}/u.test(id) &&
        !["__proto__", "prototype", "constructor", ...Object.getOwnPropertyNames(Object.prototype)].includes(id)
    )
})

export const maximumPresentationBytes = 4096
export const recordGroupSchema = z.strictObject({
  records: z
    .array(presentationReferenceSchema)
    .min(2)
    .max(5)
    .refine(
      (records) => new Set(records.map((record) => record.recordId)).size === records.length,
      "Choose distinct records."
    )
})

export const answerCatalog = defineCatalog(schema, {
  components: {
    BillProgressCard: {
      props: contentReferenceSchema,
      slots: [],
      description:
        "A bill identity card with its recorded legislative milestones. Select a BillProgressCard contentId from get_bill presentationOptions. Unknown stages remain unknown; never infer enactment or future progress."
    },
    RecordGroup: {
      props: recordGroupSchema,
      slots: [],
      description:
        "Group two to five selected records of any kind with their identity and key facts. Copy exact resultId/recordId references from successful tools. No model-authored facts."
    },
    CompactRecordGroup: {
      props: recordGroupSchema,
      slots: [],
      description:
        "Group two to five selected records as compact rows with a shared count header. Use for a concise mixed-record list; use ResultList for pagination. Copy exact resultId/recordId references."
    },
    CompactPassageCard: {
      props: contentReferenceSchema,
      slots: [],
      description:
        "A compact passage reference row with quote icon, document/version metadata and locator. Select a CompactPassageCard presentationOption. Opens the existing evidence panel; no model-authored quote, title or location."
    },
    CitationCard: {
      props: contentReferenceSchema,
      slots: [],
      description:
        "A source card with exact retrieved quote, publisher, version, locator and citation actions. Select contentId from a CitationCard presentationOption; never write the quote yourself."
    },
    PassageQuote: {
      props: contentReferenceSchema,
      slots: [],
      description:
        "An inline exact passage with its source/version line. Select a PassageQuote presentationOption. Missing passages stay explicitly unavailable."
    },
    ResultList: {
      props: contentReferenceSchema,
      slots: [],
      description:
        "A selected compact result list with real pagination and coverage notes. Select a ResultList presentationOption. Do not automatically display every retrieval."
    },
    ProgressPath: {
      props: contentReferenceSchema,
      slots: [],
      description:
        "A bill's recorded legislative actions, in returned order. Select a ProgressPath presentationOption from get_bill_timeline. Never infer future stages or enactment."
    },
    RecordTimeline: {
      props: contentReferenceSchema,
      slots: [],
      description:
        "A chronological record of returned bill actions and votes. Select a RecordTimeline presentationOption from get_bill_timeline. Partial timelines are labeled."
    },
    RollCall: {
      props: contentReferenceSchema,
      slots: [],
      description:
        "A vote's reported tally and retrieved member positions. Select a RollCall presentationOption from get_vote; use the full roll-call inspector for partial pages. Do not invent missing votes or members."
    },
    RecordStatus: {
      props: contentReferenceSchema,
      slots: [],
      description:
        "A source-backed not-found or not-collected record state. Select a RecordStatus presentationOption; never infer a missing record from an unrelated empty search."
    },
    RecordCard: {
      props: presentationReferenceSchema,
      slots: [],
      description:
        "Display one retrieved legislative record beside the prose discussing it. Copy resultId from resultSet.id and recordId from a record in that result. The server supplies all display fields. Do not show every search result."
    },
    CompactRecordCard: {
      props: presentationReferenceSchema,
      slots: [],
      description:
        "A compact one-record card with title, kind and supplied metadata but no body or account actions. Use instead of RecordCard when a small navigable reference is enough. Copy exact resultId and recordId from current tool results."
    }
  },
  actions: {}
})

export const presentationElementSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.enum(["RecordGroup", "CompactRecordGroup"]),
    props: recordGroupSchema,
    children: z.array(z.string()).length(0).optional()
  }),
  z.strictObject({
    type: z.enum(["RecordCard", "CompactRecordCard"]),
    props: presentationReferenceSchema,
    children: z.array(z.string()).length(0).optional()
  }),
  z.strictObject({
    type: contentComponentSchema,
    props: contentReferenceSchema,
    children: z.array(z.string()).length(0).optional()
  })
])
export const presentationComponentSchema = z.enum([
  "RecordGroup",
  "CompactRecordGroup",
  "RecordCard",
  "CompactRecordCard",
  ...contentComponentSchema.options
])

export const presentationSpecSchema = z
  .strictObject({
    root: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/),
    elements: z.record(z.string(), presentationElementSchema)
  })
  .superRefine((spec, context) => {
    if (Object.keys(spec.elements).length !== 1 || !Object.hasOwn(spec.elements, spec.root)) {
      context.addIssue({ code: "custom", message: "A presentation block must contain exactly its root component." })
    }
  })

export function presentationReferences(spec: z.infer<typeof presentationSpecSchema>) {
  const element = spec.elements[spec.root]
  if (!element) {
    return []
  }
  if (element.type === "RecordCard" || element.type === "CompactRecordCard") {
    return [element.props]
  }
  if (element.type === "RecordGroup" || element.type === "CompactRecordGroup") {
    return element.props.records
  }
  return []
}

export const presentationBlockSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("pending"), blockId: z.string().min(1).max(128) }),
  z
    .strictObject({
      state: z.literal("ready"),
      blockId: z.string().min(1).max(128),
      spec: presentationSpecSchema,
      records: z.array(entityCardSchema).max(5),
      content: presentationContentSchema.optional()
    })
    .superRefine((block, context) => {
      const element = block.spec.elements[block.spec.root]
      if (element && "contentId" in element.props) {
        const component = contentComponentSchema.parse(element.type)
        if (
          !block.content ||
          block.content.id !== element.props.contentId ||
          block.content.kind !== contentKinds[component] ||
          block.records.length !== 0
        ) {
          context.addIssue({
            code: "custom",
            message: "Presentation content does not match the selected reference and component."
          })
        }
        return
      }
      if (block.content || block.records.length === 0) {
        context.addIssue({ code: "custom", message: "Record presentations require records only." })
      }
      const references = presentationReferences(block.spec)
      if (
        references.length !== block.records.length ||
        references.some((reference, index) => reference.recordId !== block.records[index]?.id)
      ) {
        context.addIssue({ code: "custom", message: "The presentation references do not match their records." })
      }
    }),
  z.strictObject({
    state: z.literal("error"),
    blockId: z.string().min(1).max(128),
    reason: z.enum(["presentation", "records", "interrupted"]),
    component: presentationComponentSchema.optional()
  })
])

export type PresentationBlock = z.infer<typeof presentationBlockSchema>
export type PresentationReference = z.infer<typeof presentationReferenceSchema>

export function presentationEvidence(value: unknown) {
  const parsed = presentationBlockSchema.safeParse(value)
  if (parsed.success && parsed.data.state === "ready" && parsed.data.content?.kind === "evidence") {
    return parsed.data.content.evidence
  }
  return undefined
}

export function presentationCitation(value: unknown) {
  const evidence = presentationEvidence(value)
  return evidence ? `#citation-${evidence.citationRef ?? evidence.id}` : undefined
}

export function recordMentionHref(reference: PresentationReference) {
  return `#record-${reference.resultId}/${encodeURIComponent(reference.recordId)}`
}

export function presentationText(value: unknown) {
  const parsed = presentationBlockSchema.safeParse(value)
  if (!parsed.success || parsed.data.state !== "ready") {
    return undefined
  }
  const block = parsed.data
  if (block.content) {
    const content = block.content
    if (content.kind === "bill-progress") {
      return [
        content.record.title,
        `Record: ${content.record.id}`,
        ...content.stages.map((stage) => `${stage.label}: ${stage.date ?? stage.state}`)
      ].join("\n")
    }
    if (content.kind === "evidence") {
      return [
        content.evidence.title,
        content.evidence.content.state === "available" ? content.evidence.content.quote : "No passage retrieved",
        content.evidence.versionLabel,
        content.evidence.locator,
        content.evidence.sourceUrl
      ]
        .filter(Boolean)
        .join("\n")
    }
    if (content.kind === "timeline") {
      return [
        content.billId,
        ...content.events.map((event) => [event.date, event.description].filter(Boolean).join(": ")),
        content.hasMore ? "More recorded events are available." : undefined
      ]
        .filter(Boolean)
        .join("\n")
    }
    if (content.kind === "result-list") {
      return content.page.items.map((record) => `${record.title}\nRecord: ${record.id}`).join("\n\n")
    }
    if (content.kind === "roll-call") {
      return [
        content.details.record.title,
        ...content.details.positions.map((position) => `${position.name ?? "Name not published"}: ${position.option}`)
      ].join("\n")
    }
    return `${content.title}\n${content.state}`
  }
  return block.records
    .map((record) => [record.title, `Record: ${record.id}`, record.sourceUrl].filter(Boolean).join("\n"))
    .join("\n\n")
}

export function answerPlainText(message: UIMessage) {
  return message.parts
    .flatMap((part) => {
      if (part.type === "text") {
        return [part.text]
      }
      if (part.type === "data-presentation") {
        const text = presentationText(part.data)
        return text ? [text] : []
      }
      return []
    })
    .join("\n\n")
}

export const compositionInstructions = answerCatalog.prompt({
  mode: "inline",
  customRules: [
    "Use CompactRecordCard for a concise navigable record reference and CompactPassageCard for a concise source-passage reference. Compact passage props contain only contentId from an option permitting that component. Both use retrieved metadata without a fact-grid body or account actions.",
    "Research and retrieve evidence before composing visual blocks. Preserve all research and citation requirements.",
    "For a list of bills, select a ResultList presentationOption: it renders compact bill rows with pagination. For one selected bill, use CompactRecordCard. Place the block beside the relevant prose. Explain comparisons in cited prose, not a bill-comparison component or a duplicate metadata table. Never print JSON outside a spec code fence.",
    "Each spec fence is one independent catalog component. Use a unique root key per block, no child elements, and at most three blocks in an answer.",
    "For CitationCard, PassageQuote, ResultList, ProgressPath, RecordTimeline, RollCall and RecordStatus, copy contentId from presentationOptions in a successful tool result and choose only a component listed for that option. Supply only {contentId}; the server provides all content. Prefer CitationCard or PassageQuote for a useful exact passage, a timeline/progress view for recorded bill history, and RollCall for member positions. Place selected views next to relevant prose. Do not duplicate the same passage in multiple blocks or repeat its full quote in prose. A quote block itself cites that evidence, but surrounding claims still require accurate citations. Do not use a version pin. A not-collected passage does not mean the entire jurisdiction is uncovered.",
    "Emit /root and one complete /elements/ROOT patch with the selected component type, complete literal props, and children []. Do not emit partial props.",
    "Only use references returned in successful tools during this turn. Never invent IDs, titles, URLs, statuses, properties, state expressions, or actions.",
    "For a passing record mention in prose, use [short record name](href) with the exact href from recordLinks in a successful tool result. These are inline navigation links, not cards or evidence citations. Never construct a record link yourself or copy one from a previous turn.",
    "Use a specific bill number, person name, or record name as link text, not a generic phrase such as click here. Link the first useful mention of a record rather than every repetition.",
    "Do not repeat the same record across cards and lists. Most retrieved records need no visual block. Prose-only responses are valid.",
    "Cards are not evidence citations. For each supported claim, copy the exact Markdown link from the relevant evidence entry's citation field. The application numbers citations; do not construct citation anchors from resultSet.id, record IDs, tool-call IDs, or previous turns. Do not repeat a card as a Markdown table.",
    "An empty search result is not a source. If evidence is empty, there is no citation link to use: describe the limited search outcome without a citation, and do not claim it proves no activity occurred. Never cite a result-set ID to support a missing or empty result.",
    "Check each cited evidence entry's recordId and billId against the claim's record, then check its date, version, and available passage. An exact citation link is not proof of relevance. Evidence from another result or jurisdiction cannot support an empty search. An action's description and locator support only that recorded action; if its sourceUrl is null, disclose the missing publisher link rather than substituting another record's source."
  ]
})
