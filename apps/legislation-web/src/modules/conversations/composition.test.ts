import type { UIMessage } from "ai"
import { describe, expect, it } from "vitest"
import { conversationTextMessages } from "./chatRequest"
import {
  answerCatalog,
  answerPlainText,
  compositionInstructions,
  presentationBlockSchema,
  presentationText,
  type PresentationBlock
} from "./composition"
import { parseDevelopmentConversation } from "./developmentConversation"
import { projectEntityResult } from "./entityResults"
import { sessionLabel, sessionLabelsInText } from "./sessionLabels"

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
  records: [
    {
      id: "bill:1",
      kind: "bill",
      title: "Retrieved bill",
      sourceUrl: "https://example.org/bill",
      fields: [],
      tallies: []
    }
  ]
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
  it("uses friendly session names in bill snapshots without changing source IDs", () => {
    const id = "session:ca:20232024"
    const input = {
      bill: {
        id: "bill:ca:20232024:ab:2652",
        title: "Education",
        chamber: "lower",
        sessionId: id,
        sessionName: "2023-2024 Regular Session"
      }
    }
    const record = projectEntityResult("get_bill", input)?.items[0]
    if (!record) {
      throw new Error("Missing bill fixture")
    }
    expect(record.subtitle).toBe("lower, 2023-2024 Regular Session")
    expect(record.billSummary?.sessionName).toBe("2023-2024 Regular Session")
    expect(input.bill.sessionId).toBe(id)
  })

  it.each([
    ["session:ca:20232024", "2023-2024"],
    ["session:us:118", "118th Congress"],
    ["session:us:121", "121st Congress"],
    ["session:us:122", "122nd Congress"],
    ["session:us:123", "123rd Congress"],
    ["session:us:111", "111th Congress"],
    ["session:us:112", "112th Congress"],
    ["session:us:113", "113th Congress"],
    ["session:ca:2023S1", "Session 2023S1"],
    ["session:ny:2025", "2025"],
    ["Published name", "Published name"]
  ])("formats session %s without exposing storage prefixes", (id, expected) => {
    expect(sessionLabel(id)).toBe(expected)
  })

  it("prefers a supplied special-session name and formats session references in activity text", () => {
    expect(sessionLabel("session:ca:20232024", "20232024")).toBe("2023-2024")
    expect(sessionLabel("session:us:118", "118")).toBe("118th Congress")
    expect(sessionLabel("session:ca:2023S1", "2023 First Extraordinary Session")).toBe(
      "2023 First Extraordinary Session"
    )
    expect(sessionLabelsInText("Education in session:ca:20232024 and session:us:118.")).toBe(
      "Education in 2023-2024 and 118th Congress."
    )
  })

  it("generates inline catalog instructions for literal references only", () => {
    expect(compositionInstructions).toContain("RecordCard")
    expect(compositionInstructions).toContain("resultId")
    expect(compositionInstructions).toContain("spec")
    expect(compositionInstructions).toContain("ResultList")
    expect(compositionInstructions).toContain("CompactRecordCard")
    expect(compositionInstructions).toContain("resolve_record")
    expect(compositionInstructions).toContain("never reconstruct UUIDs")
    expect(compositionInstructions).toContain("the quote is hidden until the user opens the evidence panel")
    expect(compositionInstructions).toContain("includes only action events and omits votes")
    expect(compositionInstructions).toContain("every returned event type, including actions and votes")
    expect(compositionInstructions).toContain("Use RecordCard when visible record facts materially help the answer")
    expect(compositionInstructions).toContain("include at least one useful supported visualization by default")
    expect(compositionInstructions).toContain("Cards are entry points into resources, not decoration")
    expect(compositionInstructions).toContain("even when its label repeats the prose")
    expect(compositionInstructions).toContain("do not claim follow, add-to-issue")
    expect(compositionInstructions).toContain("an explicit prose-only request")
    expect(compositionInstructions).toContain('"children":[]')
    expect(compositionInstructions).toContain("No state, sample data, child elements")
    expect(compositionInstructions).not.toContain("Most retrieved records need no visual block")
    expect(compositionInstructions).not.toContain("Always include realistic")
    expect(compositionInstructions).not.toContain('"path":"/state')
    for (const component of answerCatalog.componentNames) {
      expect(compositionInstructions).toContain(`${component}:`)
    }
    expect(compositionInstructions).not.toContain("BillComparison")
    expect(answerCatalog.validate(block.spec).success).toBe(true)
    expect(
      presentationBlockSchema.safeParse({ ...block, records: [{ ...block.records[0], id: "foreign" }] }).success
    ).toBe(false)
  })

  it("copies rendered cards in order and passes record identity as untrusted history text", () => {
    expect(presentationText(block)).toBe("Retrieved bill\nRecord: bill:1\nhttps://example.org/bill")
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
      draft: [],
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
          data: { ...block, records: [{ ...block.records[0], sourceUrl: "javascript:alert(1)" }] }
        }
      ]
    }
    expect(await parseDevelopmentConversation(JSON.stringify({ ...snapshot, messages: [invalid] }))).toBeUndefined()
  })
})
