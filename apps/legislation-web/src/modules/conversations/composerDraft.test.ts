import { describe, expect, it } from "vitest"
import type { StagedReference } from "./chatRequest"
import {
  composerDocument,
  composerDraftSchema,
  composerDraftText,
  composerReferences,
  textDraft,
  type ComposerDraft
} from "./composerDraft"

const person: StagedReference = {
  resultId: "23974c17-3898-4b92-96f7-1c600704e12e",
  recordId: "person:1",
  record: {
    id: "person:1",
    kind: "person",
    title: "Alexandria Ocasio-Cortez",
    sourceUrl: null,
    fields: [],
    tallies: []
  }
}

describe("composer draft", () => {
  it("keeps published names readable and references structured", () => {
    const draft: ComposerDraft = [
      ...textDraft("Ask "),
      { type: "mention", reference: person },
      ...textDraft(" about housing\nand transport")
    ]
    expect(composerDraftText(draft)).toBe("Ask @Alexandria Ocasio-Cortez about housing\nand transport")
    expect(composerReferences(draft)).toEqual([person])
    const serialized = JSON.stringify(draft)
    expect(composerDraftSchema.parse(JSON.parse(serialized))).toEqual(draft)
    expect(composerDocument(draft).content?.[0]?.content).toContainEqual({
      type: "mention",
      attrs: { id: person.recordId, label: person.record.title, reference: person }
    })
    expect(composerDocument(draft).content?.[0]?.content).toContainEqual({ type: "hardBreak" })
  })

  it("deduplicates repeated tags but retains distinct same-name identities", () => {
    const other = { ...person, recordId: "person:2", record: { ...person.record, id: "person:2" } }
    const draft: ComposerDraft = [
      { type: "mention", reference: person },
      { type: "mention", reference: person },
      { type: "mention", reference: other }
    ]
    expect(composerReferences(draft, [person])).toEqual([person, other])
  })

  it("does not infer references from typed names or retain removed tags", () => {
    expect(composerReferences(textDraft("Ask @Alexandria Ocasio-Cortez"))).toEqual([])
    expect(composerReferences([], [person])).toEqual([person])
    expect(composerDraftText([])).toBe("")
  })
})
