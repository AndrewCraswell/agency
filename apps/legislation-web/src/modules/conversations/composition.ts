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
  resultId: z.union([z.uuid(), z.string().regex(/^r[1-9][0-9]{0,3}$/)]),
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
        "Choose for one bill when the answer is about where it stands across legislative milestones. This full card shows bill identity and the recorded milestone path. Select a BillProgressCard contentId from get_bill presentationOptions. Use ProgressPath for a concise sequence of returned actions or RecordTimeline for dated actions and votes. Unknown stages remain unknown; never infer enactment or future progress."
    },
    RecordGroup: {
      props: recordGroupSchema,
      slots: [],
      description:
        "Choose when two to five specific records collectively matter and each needs its full identity and key-fact body. The group supplies one shared action header and omits per-card actions. Use CompactRecordGroup when titles, metadata and status are enough; use ResultList for a retrieved or paginated result set. Copy exact resultId/recordId references from successful tools."
    },
    CompactRecordGroup: {
      props: recordGroupSchema,
      slots: [],
      description:
        "Choose when two to five specific records need a concise grouped reference. It renders title, compact metadata and status rows under one count and shared action header, without fact-grid bodies. Use RecordGroup when each record's facts need to remain visible; use ResultList for a retrieved or paginated result set. Copy exact resultId/recordId references."
    },
    CompactPassageCard: {
      props: contentReferenceSchema,
      slots: [],
      description:
        "Choose when the prose carries the claim and only a compact source pointer is needed. It shows source title, publisher/version and locator; the quote is hidden until the user opens the evidence panel. Use PassageQuote when the exact words should be visible or CitationCard when provenance and citation controls should be prominent. Select a CompactPassageCard presentationOption; never author its content."
    },
    CitationCard: {
      props: contentReferenceSchema,
      slots: [],
      description:
        "Choose when source provenance is central and the reader should see publisher, title, version, locator, exact quote and citation actions together. Use PassageQuote when the quote should flow more lightly beside prose, or CompactPassageCard when the quote can remain in the evidence panel. Select contentId from a CitationCard presentationOption; never write the quote yourself."
    },
    PassageQuote: {
      props: contentReferenceSchema,
      slots: [],
      description:
        "Choose when the source's exact words are central to the answer. It leads with the retrieved quote and follows with a lightweight source, version and locator line plus citation actions. Use CitationCard when provenance metadata needs stronger visual emphasis, or CompactPassageCard when the quote need not be visible. Select a PassageQuote presentationOption; missing passages stay explicitly unavailable."
    },
    ResultList: {
      props: contentReferenceSchema,
      slots: [],
      description:
        "Choose when the answer should expose a retrieved result set, especially when users may page through it or need query and coverage notes. It renders compact navigable rows and real result-store pagination. Use a record card for one selected record or a record group for two to five curated records. Select a ResultList presentationOption; do not automatically display every retrieval."
    },
    ProgressPath: {
      props: contentReferenceSchema,
      slots: [],
      description:
        "Choose for a concise step-like account of how a bill progressed through returned legislative actions. It includes only action events and omits votes and other event types. Use BillProgressCard for canonical milestone status or RecordTimeline when all returned dated activity matters. Select a ProgressPath presentationOption from get_bill_timeline; never infer future stages or enactment."
    },
    RecordTimeline: {
      props: contentReferenceSchema,
      slots: [],
      description:
        "Choose when the question is what happened and when. It presents every returned event type, including actions and votes, as a date-led activity list. Use ProgressPath for action-only progression or BillProgressCard for canonical milestone status. Select a RecordTimeline presentationOption from get_bill_timeline; partial timelines are labeled."
    },
    RollCall: {
      props: contentReferenceSchema,
      slots: [],
      description:
        "Choose when the answer discusses how members voted, not merely that a vote occurred. It shows the reported tally, up to six retrieved member positions and a control to open the full roll-call inspector. Use RecordCard or CompactRecordCard for vote identity, outcome or a passing vote reference. Select a RollCall presentationOption from get_vote; do not invent missing votes or members."
    },
    RecordStatus: {
      props: contentReferenceSchema,
      slots: [],
      description:
        "Choose only to communicate an explicit source-backed not-found lookup or a passage known not to have been collected. It renders the unavailable state and a source link when one exists. Select a RecordStatus presentationOption; an empty search is not eligible and never proves absence."
    },
    RecordCard: {
      props: presentationReferenceSchema,
      slots: [],
      description:
        "Choose when one retrieved record is a primary subject and its visible facts, tallies or actions help answer the question. This full card shows the record's identity and kind-specific detail body. Use CompactRecordCard for a passing reference, ResultList for a result set, or BillProgressCard for milestone status. Copy resultId from resultSet.id and recordId from that result; the server supplies every display field."
    },
    CompactRecordCard: {
      props: presentationReferenceSchema,
      slots: [],
      description:
        "Choose when one retrieved record needs a concise navigable reference beside prose. It shows title, kind, compact metadata and status or vote counts, without a fact-grid body or account actions. Use RecordCard when visible record facts materially help the answer. Copy exact resultId and recordId from current tool results."
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
      if (references.some((reference) => !z.uuid().safeParse(reference.resultId).success)) {
        context.addIssue({ code: "custom", message: "Rendered references must contain canonical result IDs." })
      }
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

const compositionRules = [
  "Resolve named records before topic discovery. For a bill number and Congress/session, discover the jurisdiction and session IDs, then use resolve_record with identifier and separate scope fields. Do not search for bare numbers, embed Congress names in query text, or invent introduction-date filters. Use returned canonical IDs with get tools. If a published name is ambiguous, ask for context instead of guessing.",
  "Record-card resultId values may be short turn-owned handles such as r1. Copy them exactly from resultSet.id; never reconstruct UUIDs or reuse previous-turn references. The server canonicalizes handles before rendering. For record mentions copy recordLinks.href unchanged.",
  "A parent detail is a bounded preview. Use read_record_collection and the dedicated membership, sponsored-bill and document readers for the rest. Follow nextCursor unchanged; for section text continue sectionId with nextTextOffset as textOffset. Truncated passages and approximate search candidate sets are partial, not evidence of absent records.",
  "Use CompactRecordCard for a concise navigable record reference and CompactPassageCard for a concise source-passage reference. Compact passage props contain only contentId from an option permitting that component. Both use retrieved metadata without a fact-grid body or account actions.",
  "Research and retrieve evidence before composing visual blocks. Preserve all research and citation requirements.",
  "For an explorable list of bills, select a ResultList presentationOption: it renders compact bill rows with pagination. For one selected bill, choose the full, compact or progress card according to the question and catalog descriptions. For two to five curated records, choose the full or compact group. Explain comparisons in cited prose alongside the view, not a duplicate metadata table. Never print JSON outside a spec code fence.",
  "Each spec fence is one independent catalog component. Use a unique root key per block, no child elements, and at most three blocks in an answer.",
  "For CitationCard, PassageQuote, ResultList, ProgressPath, RecordTimeline, RollCall and RecordStatus, copy contentId from presentationOptions in a successful tool result and choose only a component listed for that option. Supply only {contentId}; the server provides all content. Prefer CitationCard or PassageQuote for a useful exact passage, a timeline/progress view for recorded bill history, and RollCall for member positions. Place selected views next to relevant prose. Do not duplicate the same passage in multiple blocks or repeat its full quote in prose. A quote block itself cites that evidence, but surrounding claims still require accurate citations. Do not use a version pin. A not-collected passage does not mean the entire jurisdiction is uncovered.",
  "Emit /root and one complete /elements/ROOT patch with the selected component type, complete literal props, and children []. Do not emit partial props.",
  "Only use references returned in successful tools during this turn. Never invent IDs, titles, URLs, statuses, properties, state expressions, or actions.",
  "For a passing record mention in prose, use [short record name](href) with the exact href from recordLinks in a successful tool result. These are inline navigation links, not cards or evidence citations. Never construct a record link yourself or copy one from a previous turn.",
  "Use a specific bill number, person name, or record name as link text, not a generic phrase such as click here. Link the first useful mention of a record rather than every repetition.",
  "Select the central records or evidence, not every retrieved item. Do not repeat the same record across cards and lists or the same passage across views. When several components fit, choose the smallest one that preserves the information the user needs to see.",
  "Cards are not evidence citations. For each supported claim, copy the exact Markdown link from the relevant evidence entry's citation field. The application numbers citations; do not construct citation anchors from resultSet.id, record IDs, tool-call IDs, or previous turns. Do not repeat a card as a Markdown table.",
  "An empty search result is not a source. If evidence is empty, there is no citation link to use: describe the limited search outcome without a citation, and do not claim it proves no activity occurred. Never cite a result-set ID to support a missing or empty result.",
  "Check each cited evidence entry's recordId and billId against the claim's record, then check its date, version, and available passage. An exact citation link is not proof of relevance. Evidence from another result or jurisdiction cannot support an empty search. An action's description and locator support only that recorded action; if its sourceUrl is null, disclose the missing publisher link rather than substituting another record's source."
]

export const compositionInstructions = [
  "ANSWER PRESENTATION CONTRACT",
  "For a substantive answer about retrieved records, include at least one useful supported visualization by default. The user does not need to ask for a card. Treat selecting and emitting the view as part of completing the answer, not an optional follow-up. Answer in cited prose plus the chosen view; do not merely offer or promise it.",
  "Cards are entry points into resources, not decoration. Giving the user a clear click-through to a relevant bill, person, committee, vote, document or passage is sufficient value, even when its label repeats the prose. Prefer CompactRecordCard or CompactRecordGroup when navigation is the main benefit. Do not suppress a useful resource entry point just because it adds no new facts. Resource pages are the place for deeper research and available resource actions; do not claim follow, add-to-issue or other planned actions work unless they are actually available.",
  "Choose the view from the user's information need: visible record facts, a compact reference, a curated group, an explorable result set, exact wording, source provenance, recorded progress, dated activity, member positions or an explicit unavailable-record state. Follow the distinctions in the catalog below. Keep the finding and necessary qualifications in prose. Visuals complement evidence-backed explanation; they never replace grounding or accurate citations.",
  "Use prose only when neither resource navigation nor a supported evidence view helps: greetings, general civics, clarification, an explicit prose-only request, a brief follow-up that needs no resource entry point, failed or empty retrieval without an eligible status option, or an aggregate calculation with no supported view. Otherwise emit the best available view. A brief answer is not by itself a reason to omit a resource card. Do not turn an empty search into a not-found card. If a central record needs a supported read to obtain a presentation reference, make the smallest such retrieval while budget permits; do not hydrate every aggregate row.",
  "Before finishing, check that a useful selected view was actually emitted. A Markdown table, record link, source citation or promise is not a visualization. Use at most three independent spec fences; one well-chosen view is normally enough.",
  "RENDERING PROTOCOL",
  "These are server-rendered views, not arbitrary UI. Supply only literal references from successful current-turn tools. No state, sample data, child elements, actions, bindings, repeats, dynamic expressions or custom layouts are supported. Each spec fence contains exactly two JSON Patch objects on separate lines: add /root, then add the complete /elements/ROOT value with type, props and children [].",
  "Format example only: replace RETURNED_CONTENT_ID with an exact current-turn presentationOptions contentId that permits the chosen type. Never emit the placeholder. Record cards use resultId and recordId; groups use records containing those pairs. The catalog supplies the exact props for every type.",
  '```spec\n{"op":"add","path":"/root","value":"source"}\n{"op":"add","path":"/elements/source","value":{"type":"CitationCard","props":{"contentId":"RETURNED_CONTENT_ID"},"children":[]}}\n```',
  "AVAILABLE COMPONENTS",
  ...Object.entries(answerCatalog.data.components).map(
    ([name, definition]) =>
      `${name}: ${definition.description}\nProps: ${JSON.stringify(z.toJSONSchema(definition.props, { io: "input" }))}`
  ),
  "RESEARCH AND REFERENCE RULES",
  ...compositionRules
].join("\n\n")
