import type { JSONContent } from "@tiptap/core"
import type { Node } from "@tiptap/pm/model"
import type { UIMessage } from "ai"
import { z } from "zod"
import { referenceMessageMetadata, stagedReferenceSchema, type StagedReference } from "./chatRequest"

export const composerDraftSchema = z.array(
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("text"), text: z.string() }),
    z.object({ type: z.literal("mention"), reference: stagedReferenceSchema })
  ])
)
export type ComposerDraft = z.infer<typeof composerDraftSchema>

export function textDraft(text: string): ComposerDraft {
  return text ? [{ type: "text", text }] : []
}

export function composerDraftText(draft: ComposerDraft) {
  return draft
    .map((segment) => (segment.type === "text" ? segment.text : `@${segment.reference.record.title}`))
    .join("")
}

export function composerReferences(draft: ComposerDraft, references: readonly StagedReference[] = []) {
  const combined = new Map(references.map((reference) => [`${reference.record.kind}:${reference.recordId}`, reference]))
  for (const segment of draft) {
    if (segment.type === "mention") {
      const reference = segment.reference
      combined.set(`${reference.record.kind}:${reference.recordId}`, reference)
    }
  }
  return [...combined.values()]
}

export function composerMessageMetadata(draft: ComposerDraft, references: readonly StagedReference[]) {
  return { ...referenceMessageMetadata(composerReferences(draft, references)), draft: structuredClone(draft) }
}

export function messageComposerDraft(message: UIMessage) {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
  const parsed = z.object({ draft: composerDraftSchema }).safeParse(message.metadata)
  if (parsed.success && composerDraftText(parsed.data.draft) === text) {
    return parsed.data.draft
  }
  return textDraft(text)
}

export function composerDocument(draft: ComposerDraft): JSONContent {
  const content: JSONContent[] = []
  for (const segment of draft) {
    if (segment.type === "mention") {
      content.push({
        type: "mention",
        attrs: { id: segment.reference.recordId, label: segment.reference.record.title, reference: segment.reference }
      })
    } else {
      segment.text.split("\n").forEach((text, index) => {
        if (index > 0) {
          content.push({ type: "hardBreak" })
        }
        if (text) {
          content.push({ type: "text", text })
        }
      })
    }
  }
  return { type: "doc", content: [{ type: "paragraph", content }] }
}

export function readComposerDraft(document: Node): ComposerDraft {
  const draft: ComposerDraft = []
  function appendText(text: string) {
    const previous = draft.at(-1)
    if (previous?.type === "text") {
      previous.text += text
    } else if (text) {
      draft.push({ type: "text", text })
    }
  }
  document.forEach((block, _offset, index) => {
    if (index > 0) {
      appendText("\n")
    }
    block.descendants((node) => {
      if (node.isText) {
        appendText(node.text ?? "")
      } else if (node.type.name === "hardBreak") {
        appendText("\n")
      } else if (node.type.name === "mention") {
        draft.push({ type: "mention", reference: stagedReferenceSchema.parse(node.attrs.reference) })
        return false
      }
      return undefined
    })
  })
  return draft
}
