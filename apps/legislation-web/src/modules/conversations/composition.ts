import { defineCatalog } from "@json-render/core"
import { schema } from "@json-render/react/schema"
import type { UIMessage } from "ai"
import { z } from "zod"
import { entityCardSchema, type EntityCard } from "./entityResults"
import { sessionLabelsInText } from "./sessionLabels"

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

export const comparisonColumnSchema = z.enum(["session", "status", "latestAction"])
export const comparisonColumns: Record<z.infer<typeof comparisonColumnSchema>, string> = {
  session: "Session",
  status: "Status",
  latestAction: "Latest action"
}
export const billComparisonSchema = z.strictObject({
  records: z
    .array(presentationReferenceSchema)
    .min(2)
    .max(4)
    .refine(
      (records) => new Set(records.map((record) => record.recordId)).size === records.length,
      "Choose distinct bills."
    ),
  columns: z
    .array(comparisonColumnSchema)
    .min(1)
    .max(3)
    .refine((columns) => new Set(columns).size === columns.length, "Choose distinct columns.")
})
export type BillComparisonProps = z.infer<typeof billComparisonSchema>

export function comparisonValue(record: EntityCard, column: z.infer<typeof comparisonColumnSchema>) {
  if (column === "session") {
    const name = record.billSummary?.sessionName ?? record.subtitle
    return name?.trim() ? sessionLabelsInText(name.trim()) : undefined
  }
  if (column === "status") {
    return record.billSummary?.status?.trim() || undefined
  }
  const action = record.billSummary?.latestAction
  return action ? [action.date, action.description].filter(Boolean).join(": ") : undefined
}

export const answerCatalog = defineCatalog(schema, {
  components: {
    RecordCard: {
      props: presentationReferenceSchema,
      slots: [],
      description:
        "Display one retrieved legislative record beside the prose discussing it. Copy resultId from resultSet.id and recordId from a record in that result. The server supplies all display fields. Do not show every search result."
    },
    BillComparison: {
      props: billComparisonSchema,
      slots: [],
      description:
        "Compare metadata for two to four retrieved bills. Supply records as resultId/recordId references and select only session, status, or latestAction columns. Values come from server snapshots; absent values remain absent. This is not a comparison of policy substance and does not replace citations."
    }
  },
  actions: {}
})

export const presentationElementSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("RecordCard"),
    props: presentationReferenceSchema,
    children: z.array(z.string()).length(0).optional()
  }),
  z.strictObject({
    type: z.literal("BillComparison"),
    props: billComparisonSchema,
    children: z.array(z.string()).length(0).optional()
  })
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
  return element.type === "RecordCard" ? [element.props] : element.props.records
}

export const presentationBlockSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("pending"), blockId: z.string().min(1).max(128) }),
  z
    .strictObject({
      state: z.literal("ready"),
      blockId: z.string().min(1).max(128),
      spec: presentationSpecSchema,
      records: z.array(entityCardSchema).min(1).max(4)
    })
    .superRefine((block, context) => {
      const references = presentationReferences(block.spec)
      if (
        references.length !== block.records.length ||
        references.some((reference, index) => reference.recordId !== block.records[index]?.id)
      ) {
        context.addIssue({ code: "custom", message: "The presentation references do not match their records." })
      }
      if (
        block.spec.elements[block.spec.root]?.type === "BillComparison" &&
        block.records.some((record) => record.kind !== "bill")
      ) {
        context.addIssue({ code: "custom", message: "A bill comparison must contain only bills." })
      }
    }),
  z.strictObject({ state: z.literal("error"), blockId: z.string().min(1).max(128) })
])

export type PresentationBlock = z.infer<typeof presentationBlockSchema>
export type PresentationReference = z.infer<typeof presentationReferenceSchema>

export function recordMentionHref(reference: PresentationReference) {
  return `#record-${reference.resultId}/${encodeURIComponent(reference.recordId)}`
}

export function presentationText(value: unknown) {
  const parsed = presentationBlockSchema.safeParse(value)
  if (!parsed.success || parsed.data.state !== "ready") {
    return undefined
  }
  const block = parsed.data
  const element = block.spec.elements[block.spec.root]
  return block.records
    .map((record) => {
      const fields =
        element?.type === "BillComparison"
          ? element.props.columns.map(
              (column) => `${comparisonColumns[column]}: ${comparisonValue(record, column) ?? "Not returned"}`
            )
          : []
      return [record.title, `Record: ${record.id}`, ...fields, record.sourceUrl].filter(Boolean).join("\n")
    })
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
    "Research and retrieve evidence before composing visual blocks. Preserve all research and citation requirements.",
    "For an answer with a comparison, use this order: a brief scope-setting introduction, the BillComparison spec fence, then a short conclusion or coverage caveat after the fence. Do not put the conclusion before the comparison. For a single card, place it beside the prose discussing that record. Never print JSON outside a spec code fence.",
    "Each spec fence is one independent RecordCard or BillComparison block. Use a unique root key per block, no child elements, and at most three blocks in an answer.",
    "Emit /root and one complete /elements/ROOT patch with the selected component type, complete literal props, and children []. Do not emit partial props.",
    "Only use references returned in successful tools during this turn. Never invent IDs, titles, URLs, statuses, properties, state expressions, or actions.",
    "For a passing record mention in prose, use [short record name](href) with the exact href from recordLinks in a successful tool result. These are inline navigation links, not cards or evidence citations. Never construct a record link yourself or copy one from a previous turn.",
    "Use a specific bill number, person name, or record name as link text, not a generic phrase such as click here. Link the first useful mention of a record rather than every repetition.",
    "Do not repeat the same record across cards and comparisons. Most retrieved records need no visual block. Prose-only responses are valid.",
    "Cards are not evidence citations. For each supported claim, copy the exact Markdown link from the relevant evidence entry's citation field. The application numbers citations; do not construct citation anchors from resultSet.id, record IDs, tool-call IDs, or previous turns. Do not repeat a card as a Markdown table.",
    "An empty search result is not a source. If evidence is empty, there is no citation link to use: describe the limited search outcome without a citation, and do not claim it proves no activity occurred. Never cite a result-set ID to support a missing or empty result.",
    "Check each cited evidence entry's recordId and billId against the claim's record, then check its date, version, and available passage. An exact citation link is not proof of relevance. Evidence from another result or jurisdiction cannot support an empty search. An action's description and locator support only that recorded action; if its sourceUrl is null, disclose the missing publisher link rather than substituting another record's source.",
    "Use BillComparison for metadata of two to four bills using records from successful result sets. Select useful columns only from session, status, latestAction. Do not invent cell values or use it for policy analysis; explain policy differences in cited prose. Let the comparison carry the row-by-row values: do not repeat every status, date, and action in the introduction or conclusion. Do not repeat the same table in Markdown."
  ]
})
