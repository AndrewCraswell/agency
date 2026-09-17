import type { UIMessage } from "ai"
import { describe, expect, it } from "vitest"
import { conversationTextMessages } from "./chatRequest"
import {
  answerCatalog,
  answerPlainText,
  compositionInstructions,
  presentationBlockSchema,
  type PresentationBlock
} from "./composition"
import { parseDevelopmentConversation } from "./developmentConversation"

const block: PresentationBlock = {
  state: "ready",
  blockId: "presentation-selected",
  spec: {
    root: "selected",
    elements: {
      selected: {
        type: "RecordCard",
        props: {
          resultId: "11111111-1111-4111-8111-111111111111",
          recordId: "bill:1"
        },
        children: []
      }
    }
  },
  record: {
    id: "bill:1",
    kind: "bill",
    title: "Retrieved bill",
    sourceUrl: "https://example.org/bill",
    fields: [],
    tallies: []
  }
}
const message: UIMessage = {
  id: "answer",
  role: "assistant",
  parts: [
    { type: "text", text: "Before" },
    { type: "data-presentation", id: block.blockId, data: block },
    { type: "text", text: "After" }
  ]
}

describe("composition contracts", () => {
  it("generates inline catalog instructions for literal references only", () => {
    expect(compositionInstructions).toContain("RecordCard")
    expect(compositionInstructions).toContain("resultId")
    expect(compositionInstructions).toContain("spec")
    expect(answerCatalog.validate(block.spec).success).toBe(true)
    expect(presentationBlockSchema.safeParse({ ...block, record: { ...block.record, id: "foreign" } }).success).toBe(
      false
    )
  })

  it("copies rendered cards in order and passes record identity as untrusted history text", () => {
    expect(answerPlainText(message)).toBe("Before\n\nRetrieved bill\nRecord: bill:1\nhttps://example.org/bill\n\nAfter")
    expect(conversationTextMessages([message])[0]?.parts.map((part) => part.text)).toEqual([
      "Before",
      "Retrieved bill\nRecord: bill:1\nhttps://example.org/bill",
      "After"
    ])
  })

  it("restores valid presentation snapshots and rejects invented schemas", async () => {
    const snapshot = {
      id: "conversation",
      sessionKey: "11111111-1111-4111-8111-111111111111",
      draft: "",
      clarificationAnswers: {},
      messages: [message]
    }
    expect((await parseDevelopmentConversation(JSON.stringify(snapshot)))?.messages).toEqual([message])
    const invalid = {
      ...message,
      parts: [
        {
          type: "data-presentation",
          id: "bad",
          data: { ...block, record: { ...block.record, sourceUrl: "javascript:alert(1)" } }
        }
      ]
    }
    expect(await parseDevelopmentConversation(JSON.stringify({ ...snapshot, messages: [invalid] }))).toBeUndefined()
  })
})
