import type { UIMessage } from "ai"
import { describe, expect, it } from "vitest"
import { conversationTextMessages } from "./chatRequest"
import {
  answerCatalog,
  answerPlainText,
  billComparisonSchema,
  comparisonValue,
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
  it("uses friendly session names in bill snapshots and comparisons without changing source IDs", () => {
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
    expect(comparisonValue(record, "session")).toBe("2023-2024 Regular Session")
    expect(input.bill.sessionId).toBe(id)
    expect(comparisonValue({ ...record, billSummary: undefined, subtitle: id }, "session")).toBe("2023-2024")
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

  const comparison: PresentationBlock = {
    state: "ready",
    blockId: "comparison",
    spec: {
      root: "comparison",
      elements: {
        comparison: {
          type: "BillComparison",
          props: {
            records: [
              { resultId: "11111111-1111-4111-8111-111111111111", recordId: "bill:1" },
              { resultId: "22222222-2222-4222-8222-222222222222", recordId: "bill:2" }
            ],
            columns: ["status", "latestAction"]
          },
          children: []
        }
      }
    },
    records: [
      {
        id: "bill:1",
        kind: "bill",
        title: "First bill",
        subtitle: "2025 session",
        sourceUrl: null,
        fields: [],
        tallies: [],
        billSummary: {
          status: "Introduced",
          latestAction: { date: "2025-02-01", description: "Referred to committee" }
        }
      },
      { id: "bill:2", kind: "bill", title: "Second bill", sourceUrl: null, fields: [], tallies: [] }
    ]
  }

  it("validates comparison metadata only and requires exact row order and kind", () => {
    expect(answerCatalog.validate(comparison.spec).success).toBe(true)
    expect(presentationBlockSchema.safeParse(comparison).success).toBe(true)
    expect(
      presentationBlockSchema.safeParse({ ...comparison, records: [...comparison.records].reverse() }).success
    ).toBe(false)
    expect(
      presentationBlockSchema.safeParse({
        ...comparison,
        records: comparison.records.map((record) => ({ ...record, kind: "person" }))
      }).success
    ).toBe(false)
    expect(presentationBlockSchema.safeParse({ ...comparison, records: comparison.records.slice(0, 1) }).success).toBe(
      false
    )
    expect(billComparisonSchema.safeParse({ records: [], columns: ["unapproved"] }).success).toBe(false)
  })

  it("copies selected comparison metadata without inventing absent values or including unselected columns", () => {
    expect(presentationText(comparison)).toBe(
      "First bill\nRecord: bill:1\nStatus: Introduced\nLatest action: 2025-02-01: Referred to committee\n\nSecond bill\nRecord: bill:2\nStatus: Not returned\nLatest action: Not returned"
    )
    const response: UIMessage = {
      id: "comparison-answer",
      role: "assistant",
      parts: [
        { type: "text", text: "Before" },
        { type: "data-presentation", id: comparison.blockId, data: comparison },
        { type: "text", text: "After" }
      ]
    }
    expect(answerPlainText(response)).toBe(`Before\n\n${presentationText(comparison)}\n\nAfter`)
    expect(conversationTextMessages([response])[0]?.parts[1]?.text).toBe(presentationText(comparison))
    const first = comparison.records[0]
    if (!first) {
      throw new Error("Missing comparison fixture")
    }
    expect(comparisonValue(first, "session")).toBe("2025 session")
    expect(comparisonValue({ ...first, billSummary: { status: "  " } }, "status")).toBeUndefined()
  })

  it("restores only complete validated comparison snapshots", async () => {
    const response: UIMessage = {
      id: "comparison-answer",
      role: "assistant",
      parts: [{ type: "data-presentation", id: comparison.blockId, data: comparison }]
    }
    const snapshot = {
      id: "conversation",
      sessionKey: "11111111-1111-4111-8111-111111111111",
      draft: "",
      clarificationAnswers: {},
      messages: [response]
    }
    expect((await parseDevelopmentConversation(JSON.stringify(snapshot)))?.messages).toEqual([response])
    const invalid = {
      ...response,
      parts: [
        {
          type: "data-presentation",
          id: comparison.blockId,
          data: { ...comparison, records: comparison.records.slice(0, 1) }
        }
      ]
    }
    expect(await parseDevelopmentConversation(JSON.stringify({ ...snapshot, messages: [invalid] }))).toBeUndefined()
  })

  it("generates inline catalog instructions for literal references only", () => {
    expect(compositionInstructions).toContain("RecordCard")
    expect(compositionInstructions).toContain("resultId")
    expect(compositionInstructions).toContain("spec")
    expect(compositionInstructions).toContain("Do not put the conclusion before the comparison.")
    expect(compositionInstructions).toContain("do not repeat every status, date, and action")
    expect(answerCatalog.validate(block.spec).success).toBe(true)
    expect(
      presentationBlockSchema.safeParse({ ...block, records: [{ ...block.records[0], id: "foreign" }] }).success
    ).toBe(false)
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
          data: { ...block, records: [{ ...block.records[0], sourceUrl: "javascript:alert(1)" }] }
        }
      ]
    }
    expect(await parseDevelopmentConversation(JSON.stringify({ ...snapshot, messages: [invalid] }))).toBeUndefined()
  })
})
