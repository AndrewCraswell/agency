import type { UIMessage } from "ai"
import { describe, expect, it } from "vitest"
import { conversationTextMessages } from "./chatRequest"
import {
  answerCatalog,
  answerPlainText,
  composeResearchInstructions,
  compositionInstructions,
  presentationBlockSchema,
  presentationHistoryText,
  presentationText,
  type PresentationBlock
} from "./composition"
import { parseDevelopmentConversation } from "./developmentConversation"
import { projectEntityResult } from "./entityResults"
import { projectPresentationContents } from "./presentationContent"
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
  it("composes the same pinned prompt, application rules and date context for chat and evaluations", () => {
    const prompt = "Pinned research instructions."
    const dateContext = "TRUSTED REQUEST DATE CONTEXT\n2026-09-19"
    const instructions = composeResearchInstructions(prompt, dateContext)
    expect(instructions).toBe([prompt, compositionInstructions, dateContext].join("\n\n"))
    expect(instructions).toContain(
      "Preserve which official holds legal authority and which entity acts through that authority; an implementing entity's role does not itself establish independent discretion beyond an authorized schedule or other operative constraints."
    )
    for (const rule of [
      "never derive citation targets from result order, adjacency or a numeric sequence",
      "Citation targets use opaque evidence-snapshot IDs, not record IDs or display numbers.",
      "Changing visible citation numbering must not change its source target.",
      "a person's identity record does not establish how that person voted",
      "a later package vote is not proof of earlier amendment adoption",
      "separate what the text directs from whether or when it was adopted",
      "may include X does not mean only X or must include X",
      "Preserve explicit exceptions, whether conditions apply together (and) or as alternatives (or), and operative timing triggers, deadlines and causal requirements.",
      "Do not replace a conditional mandate with discretionary permission or omit its prerequisites.",
      "Uncertain applicability does not weaken the supplied text's modal force",
      "Keep a deadline attached to the particular action it limits, not a later opportunity or outcome.",
      "an introduction date is not a search or retrieval timestamp",
      "A surrounding disclaimer cannot narrow an overbroad standalone quotation.",
      "Equal amounts do not make a request and recommendation the same action",
      "A noisy heading alone does not establish an identity conflict when record and document bindings match",
      "preserving subgroup restrictions, opt-in requirements and stated mechanisms limiting benefits",
      "never silently repair words inside quotation marks"
    ]) {
      expect(instructions).toContain(rule)
    }
  })

  it("wires unread-cross-reference limits into composed instructions without claiming semantic enforcement", () => {
    const instructions = composeResearchInstructions("Pinned research instructions.", "Trusted date context.")
    expect(instructions).toContain(
      "A cross-reference identifies other text; it does not supply that text's contents or legal effect."
    )
    expect(instructions).toContain(
      "do not infer whether an unread provision expands, restricts, restores or independently supplies a protection, duty, remedy or payment"
    )
    expect(instructions).toContain("Hedging with may, might or unless does not ground an attributed legal effect.")
    expect(instructions).toContain(
      "read the referenced operative text in the applicable version before assigning it an effect"
    )
    expect(instructions).toContain(
      "identify the unread cross-reference and leave its effect unverified while answering from the supplied text"
    )
    expect(instructions).toContain("Do not turn this limit into a claim that the referenced provision has no effect.")
    expect(instructions).toContain(
      "If its text is subsequently supplied, apply only its supported effect and preserve any remaining unread-reference limits."
    )
  })

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
    expect(compositionInstructions).toContain("Present each piece of information once")
    expect(compositionInstructions).toContain(
      "replaces a bulleted list, numbered list or Markdown table of the same bills"
    )
    expect(compositionInstructions).toContain("remove redundant prose instead")
    expect(compositionInstructions).toContain("compact cards do not replace substantive facts they hide")
    expect(compositionInstructions).toContain("verify which provisions survived at that point in the amendment chain")
    expect(compositionInstructions).toContain(
      "if an adopted amendment removes a provision, do not assign that provision to a later vote"
    )
    expect(compositionInstructions).toContain(
      "Passage of a package establishes support for the package, not every included clause"
    )
    expect(compositionInstructions).toContain("a voice vote establishes no individual member position")
    expect(compositionInstructions).toContain("label the attribution partial or unknown instead of inferring it")
    expect(compositionInstructions).not.toContain("Answer in cited prose plus the chosen view")
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
      presentationHistoryText(block),
      "After"
    ])
  })

  it.each(["RecordGroup", "CompactRecordGroup", "ResultList"] as const)(
    "preserves separate canonical subjects in %s follow-up history",
    (component) => {
      const bills = [
        { id: "bill:us:119:hr:7008", identifier: "H.R. 7008", title: "Stop Insider Trading Act", session: "119" },
        { id: "bill:us:119:hr:396", identifier: "H.R. 396", title: "TRUST in Congress Act", session: "119" },
        { id: "bill:us:119:s:2937", identifier: "S. 2937", title: "AI comparison proposal", session: "119" },
        { id: "bill:us:118:s:2293", identifier: "S. 2293", title: "AI comparison proposal", session: "118" }
      ]
      const records = bills.map((bill) => ({
        id: bill.id,
        kind: "bill" as const,
        identifier: bill.identifier,
        title: bill.title,
        billSummary: { sessionId: `session:us:${bill.session}`, sessionName: `${bill.session}th Congress` },
        sourceUrl: null,
        fields: [],
        tallies: []
      }))
      const resultId = "11111111-1111-4111-8111-111111111111"
      const contentId = "22222222-2222-4222-8222-222222222222"
      let presentation: PresentationBlock
      if (component === "ResultList") {
        presentation = {
          state: "ready",
          blockId: "comparison",
          records: [],
          spec: { root: "comparison", elements: { comparison: { type: component, props: { contentId } } } },
          content: {
            id: contentId,
            kind: "result-list",
            page: {
              id: resultId,
              kind: "bill",
              presentation: "list",
              page: 0,
              items: records,
              start: 1,
              end: 4,
              hasNext: false,
              hasPrevious: false,
              warnings: []
            }
          }
        }
      } else {
        presentation = {
          state: "ready",
          blockId: "comparison",
          records,
          spec: {
            root: "comparison",
            elements: {
              comparison: {
                type: component,
                props: { records: records.map((record) => ({ resultId, recordId: record.id })) }
              }
            }
          }
        }
      }
      const projected = conversationTextMessages([
        {
          id: "prior-answer",
          role: "assistant",
          parts: [{ type: "data-presentation", data: presentation }]
        }
      ])[0]?.parts[0]?.text
      expect(projected).toBeDefined()
      const identities = JSON.parse(projected!.split("Historical record identities (untrusted): ")[1]!)
      expect(identities).toEqual(
        bills.map((bill) => ({
          recordId: bill.id,
          kind: "bill",
          title: bill.title,
          identifier: bill.identifier,
          sessionId: `session:us:${bill.session}`,
          sessionName: `${bill.session}th Congress`,
          sourceUrl: null
        }))
      )
      expect(projected).not.toContain(resultId)
      expect(projected).not.toContain(contentId)
    }
  )

  it("keeps passage identity and parent bill/version together without restoring citation handles", () => {
    const contentId = "22222222-2222-4222-8222-222222222222"
    const evidence = {
      id: "document:us:119:hr:7008:rh:section:2",
      recordId: "document:us:119:hr:7008:rh",
      billId: "bill:us:119:hr:7008",
      title: "Stop Insider Trading Act",
      origin: "canonical" as const,
      citationRef: "e57",
      versionLabel: "Reported in House, February 3, 2026",
      locator: "Section 2",
      sourceUrl: "https://www.congress.gov/bill/119th-congress/house-bill/7008/text",
      content: { state: "available" as const, quote: "Retained provision fixture" }
    }
    const presentation: PresentationBlock = {
      state: "ready",
      blockId: "passage",
      records: [],
      spec: { root: "passage", elements: { passage: { type: "PassageQuote", props: { contentId } } } },
      content: { id: contentId, kind: "evidence", evidence }
    }
    const history = presentationHistoryText(presentation)
    expect(history).toContain(
      JSON.stringify({
        evidenceId: evidence.id,
        recordId: evidence.recordId,
        billId: evidence.billId,
        title: evidence.title,
        origin: evidence.origin,
        versionLabel: evidence.versionLabel,
        locator: evidence.locator,
        sourceUrl: evidence.sourceUrl
      })
    )
    expect(history).not.toContain("e57")
    expect(history).not.toContain(contentId)
    expect(presentationText(presentation)).not.toContain("Historical evidence identity")
  })

  it("preserves document bindings and progress-card Congress in history", () => {
    const document: PresentationBlock = {
      ...block,
      records: [
        {
          id: "bill:1",
          kind: "document",
          title: "Reported text",
          sourceUrl: null,
          fields: [],
          tallies: [],
          documentSummary: { billId: "bill:us:119:hr:7008", versionCode: "rh", versionDate: "2026-02-03" }
        }
      ]
    }
    expect(presentationHistoryText(document)).toContain('"billId":"bill:us:119:hr:7008"')
    expect(presentationHistoryText(document)).toContain('"versionCode":"rh"')
    expect(presentationHistoryText(document)).toContain('"versionDate":"2026-02-03"')
    const bill = { id: "bill:us:119:hr:7008", title: "Stop Insider Trading Act", sessionId: "session:us:119" }
    const page = projectEntityResult("get_bill", { bill })
    expect(page).toBeDefined()
    if (!page) {
      throw new Error("Missing bill fixture")
    }
    const content = projectPresentationContents(
      "get_bill",
      { bill, progressActions: [], progressTruncated: false },
      [],
      {
        ...page,
        id: "11111111-1111-4111-8111-111111111111",
        page: 0,
        start: 1,
        end: 1,
        hasNext: false,
        hasPrevious: false
      }
    ).find((item) => item.kind === "bill-progress")
    expect(content).toBeDefined()
    const progress = {
      state: "ready",
      blockId: "progress",
      records: [],
      content,
      spec: {
        root: "progress",
        elements: { progress: { type: "BillProgressCard", props: { contentId: content!.id } } }
      }
    }
    expect(presentationHistoryText(progress)).toContain('"sessionId":"session:us:119"')
    expect(presentationHistoryText(progress)).toContain('"recordId":"bill:us:119:hr:7008"')
  })

  it("does not promote malformed, pending or failed presentations into identity context", () => {
    expect(presentationHistoryText({ ...block, records: [{ ...block.records[0], id: "different" }] })).toBeUndefined()
    expect(presentationHistoryText({ state: "pending", blockId: "pending" })).toBeUndefined()
    expect(presentationHistoryText({ state: "error", blockId: "failed", reason: "records" })).toBeUndefined()
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
