import { defineCatalog } from "@json-render/core"
import { schema } from "@json-render/react/schema"
import type { UIMessage } from "ai"
import { z } from "zod"
import { entityCardSchema } from "./entityResults"

export const presentationReferenceSchema = z.strictObject({
  resultId: z.uuid(),
  recordId: z.string().min(1).max(512)
})

export const answerCatalog = defineCatalog(schema, {
  components: {
    RecordCard: {
      props: presentationReferenceSchema,
      slots: [],
      description:
        "Display one retrieved legislative record beside the prose discussing it. Copy resultId from resultSet.id and recordId from a record in that result. The server supplies all display fields. Do not show every search result."
    }
  },
  actions: {}
})

export const presentationElementSchema = z.strictObject({
  type: z.literal("RecordCard"),
  props: presentationReferenceSchema,
  children: z.array(z.string()).length(0).optional()
})

export const presentationSpecSchema = z
  .strictObject({
    root: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/),
    elements: z.record(z.string(), presentationElementSchema)
  })
  .superRefine((spec, context) => {
    if (Object.keys(spec.elements).length !== 1 || !Object.hasOwn(spec.elements, spec.root)) {
      context.addIssue({ code: "custom", message: "A presentation block must contain exactly its root record card." })
    }
  })

export const presentationBlockSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("pending"), blockId: z.string().min(1).max(128) }),
  z
    .strictObject({
      state: z.literal("ready"),
      blockId: z.string().min(1).max(128),
      spec: presentationSpecSchema,
      record: entityCardSchema
    })
    .superRefine((block, context) => {
      if (block.spec.elements[block.spec.root]?.props.recordId !== block.record.id) {
        context.addIssue({ code: "custom", message: "The presentation reference does not match its record." })
      }
    }),
  z.strictObject({ state: z.literal("error"), blockId: z.string().min(1).max(128) })
])

export type PresentationBlock = z.infer<typeof presentationBlockSchema>
export type PresentationReference = z.infer<typeof presentationReferenceSchema>

export function presentationText(value: unknown) {
  const parsed = presentationBlockSchema.safeParse(value)
  if (!parsed.success || parsed.data.state !== "ready") {
    return undefined
  }
  const record = parsed.data.record
  return [record.title, `Record: ${record.id}`, record.sourceUrl].filter(Boolean).join("\n")
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
    "Stream useful prose before a card and continue prose afterward when useful. Never print JSON outside a spec code fence.",
    "Each spec fence is one independent RecordCard block. Use a unique root key per block, no child elements, and at most three cards in an answer.",
    "Emit /root and one complete /elements/ROOT patch with type RecordCard, literal resultId and recordId props, and children []. Do not emit partial props.",
    "Only use references returned in successful tools during this turn. Never invent IDs, titles, URLs, statuses, properties, state expressions, or actions.",
    "Do not repeat the same record in multiple cards. Most retrieved records need no card. Prose-only responses are valid.",
    "Cards are not evidence citations. Cite statements using exact evidence IDs; don't repeat a card as a Markdown table.",
    "For broad comparisons, use concise prose for now: no comparison, layout, or interactive action component is available."
  ]
})
