import { createLogger } from "@repo/legislation-core/observability/logger"
import { MockLanguageModelV4 } from "ai/test"
import invariant from "tiny-invariant"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { runResearchAgent } from "./agent"
import { compositionInstructions } from "./composition"
import { createResearchEvidenceProjector } from "./evidenceSource.server"
import { contentOptions, type PresentationContent } from "./presentationContent"
import { researchModelOutput } from "./research"
import { createResearchTurn, restoreResearchMemory } from "./researchMemory"
import type { ResearchSnapshotPersistence } from "./snapshotPersistence.server"

vi.mock("@langfuse/tracing", () => ({
  propagateAttributes: (_attributes: unknown, operation: () => unknown) => operation()
}))

// Public canonical fields retained in campaign cases 071 and 027; no conversation or telemetry payloads.
const bills = [
  {
    id: "bill:us:119:hr:7008",
    identifier: "HR 7008",
    sessionId: "session:us:119",
    title:
      "To amend chapter 131 of title 5 to require certain restrictions on stocks for Members of Congress and their spouses and dependents, and for other purposes."
  },
  {
    id: "bill:us:119:hr:396",
    identifier: "HR 396",
    sessionId: "session:us:119",
    title:
      "To require Members of Congress and their spouses and dependent children to place certain assets into blind trusts, and for other purposes."
  },
  {
    id: "bill:us:119:s:2937",
    identifier: "S 2937",
    sessionId: "session:us:119",
    title: "A bill to establish legal standards for advanced artificial intelligence products."
  },
  {
    id: "bill:us:118:s:2293",
    identifier: "S 2293",
    sessionId: "session:us:118",
    title:
      "A bill to establish the Chief Artificial Intelligence Officers Council, Chief Artificial Intelligence Officers, and Artificial Intelligence Governance Boards, and for other purposes."
  }
] as const
const owner = { sessionKey: "11111111-1111-4111-8111-111111111111", sessionId: "identity-regression" }
const runId = "22222222-2222-4222-8222-222222222222"
const contentId = "33333333-3333-4333-8333-333333333333"

function projector() {
  return createResearchEvidenceProjector(createLogger({ service: "identity-test", level: "error" }), runId)
}

describe("canonical bill identity across research turns", () => {
  it("keeps each campaign bill's exact title, identifier and Congress bound in model tool output", () => {
    const evidence = projector()({ items: bills.map((bill) => ({ bill })) })
    expect(evidence.map((source) => source.billIdentity)).toEqual(bills)
    expect(evidence.map((source) => source.billId)).toEqual(bills.map((bill) => bill.id))
    const output = z
      .object({ evidence: z.array(z.object({ billIdentity: z.unknown() })) })
      .parse(JSON.parse(researchModelOutput({ output: { evidence } }).value))
    expect(output.evidence.map((source) => source.billIdentity)).toEqual(bills)
    expect(new Set(evidence.map((source) => source.id)).size).toBe(4)
  })

  it("does not deduplicate contrary canonical titles or trust a web title as canonical identity", () => {
    const project = projector()
    const original = project(bills[0])[0]
    const changed = project({ ...bills[0], title: "Stop Insider Trading Act" })[0]
    expect(changed?.id).not.toBe(original?.id)
    expect(changed?.citationRef).not.toBe(original?.citationRef)
    expect(changed?.billIdentity?.id).toBe(original?.billIdentity?.id)
    expect(project({ ...bills[0], origin: "web", title: "TRUST in Congress" })[0]?.billIdentity).toBeUndefined()
    expect(project({ ...bills[0], id: "unresolved", title: "TRUST in Congress" })[0]?.billIdentity).toBeUndefined()
    expect(project({ ...bills[0], sessionId: "session:us:118" })[0]?.billIdentity?.sessionId).toBe("session:us:119")
  })

  it.each(bills)(
    "retains $identifier identity when full result data is omitted from follow-up model input",
    async (bill) => {
      const saved = new Map<string, unknown>()
      const persistence: ResearchSnapshotPersistence = {
        save: async (id, value) => {
          saved.set(id, value)
        },
        read: async (_key, id) => saved.get(id)
      }
      const turn = createResearchTurn(owner.sessionKey, owner.sessionId, "Compare these proposals.", () => 0)
      const evidence = projector()(bill)
      turn.record({ tool: "get_bill", input: { id: bill.id }, data: { padding: "x".repeat(96000) }, evidence })
      await turn.save(runId, false, persistence)
      const memory = await restoreResearchMemory(
        owner,
        [{ role: "assistant", researchRunId: runId }],
        [],
        persistence,
        () => 1
      )
      invariant(memory.message)
      const model = new MockLanguageModelV4({
        doStream: async ({ prompt }) => {
          const input = JSON.stringify(prompt)
          expect(input).toContain(bill.id)
          expect(input).toContain(bill.sessionId)
          expect(input).toContain(bill.title)
          expect(input).toContain("billIdentities")
          expect(input).toContain("dataOmitted")
          expect(input).not.toContain("padding")
          expect(input).toContain("explicitly correct")
          expect(input).toContain("dependent scope, enforcement, amendment, sponsor and hearing")
          return {
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: "stream-start", warnings: [] })
                controller.enqueue({
                  type: "finish",
                  finishReason: { unified: "stop", raw: "stop" },
                  usage: {
                    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                    outputTokens: { total: 0, text: 0, reasoning: 0 }
                  }
                })
                controller.close()
              }
            })
          }
        }
      })
      const result = runResearchAgent({
        sessionId: owner.sessionId,
        model,
        instructions: compositionInstructions,
        messages: [
          {
            role: "assistant",
            content: "H.R. 7008 is TRUST in Congress; use S. 2293 for the earlier S. 2937 comparison."
          },
          memory.message,
          { role: "user", content: "Which assets, offices and family relationships are covered?" }
        ],
        tools: {},
        signal: new AbortController().signal
      })
      for await (const chunk of result.stream) {
        expect(chunk.type).not.toBe("error")
      }
      expect(model.doStreamCalls).toHaveLength(1)
      expect(memory.evidence[0]?.billIdentity).toEqual(bill)
    }
  )

  it("keeps document IDs, parent bills and versions in presentation choices", () => {
    for (const bill of bills) {
      const documentId = `document:${bill.id}:introduced`
      const sources = projector()({
        document: { id: documentId, billId: bill.id, title: "Introduced text", versionCode: "is" },
        sections: [{ id: "section:1", documentId, text: "Fixture operative text." }]
      })
      const source = sources.find((item) => item.content.state === "available")
      invariant(source)
      expect(source.billIdentity).toBeUndefined()
      const content: PresentationContent = { id: contentId, kind: "evidence", evidence: source }
      expect(contentOptions(content)).toMatchObject({ recordId: documentId, billId: bill.id, versionLabel: "is" })
    }
  })

  it("carries retrieved document-parent identity into model input and presentation choices", () => {
    for (const bill of bills) {
      const documentId = `document:${bill.id}:introduced`
      const sources = projector()({
        document: {
          id: documentId,
          billId: bill.id,
          bill,
          classification: "version",
          title: "Introduced in Senate",
          versionCode: "is"
        },
        sections: [{ id: "section:1", documentId, text: "Fixture operative text." }]
      })
      const source = sources.find((item) => item.content.state === "available")
      invariant(source)
      expect(source.billIdentity).toEqual(bill)
      expect(source.title).toContain(`${bill.identifier} (`)
      expect(source.title).toContain(bill.title)
      expect(source.versionLabel).toBe("Introduced in Senate")
      const content: PresentationContent = { id: contentId, kind: "evidence", evidence: source }
      expect(contentOptions(content)).toMatchObject({
        recordId: documentId,
        billId: bill.id,
        billIdentity: bill,
        label: source.title,
        versionLabel: "Introduced in Senate"
      })
      const output = z
        .object({ evidence: z.array(z.object({ title: z.string(), billIdentity: z.unknown() })) })
        .parse(JSON.parse(researchModelOutput({ output: { evidence: [source] } }).value))
      expect(output.evidence[0]).toMatchObject({ title: source.title, billIdentity: bill })
    }
  })

  it("retains new version citation titles across research memory without retaining the raw result", async () => {
    const saved = new Map<string, unknown>()
    const persistence: ResearchSnapshotPersistence = {
      save: async (id, value) => {
        saved.set(id, value)
      },
      read: async (_key, id) => saved.get(id)
    }
    const bill = bills[0]
    const documentId = `document:${bill.id}:introduced`
    const source = projector()({
      document: {
        id: documentId,
        billId: bill.id,
        bill,
        classification: "version",
        title: "Introduced in House",
        versionCode: "ih",
        documentDate: "2026-01-13"
      },
      sections: [{ id: "section:1", documentId, text: "Fixture operative text." }]
    }).find((item) => item.content.state === "available")
    invariant(source)
    const turn = createResearchTurn(owner.sessionKey, owner.sessionId, "Read the bill text.", () => 0)
    turn.record({
      tool: "get_bill_text",
      input: { id: bill.id, documentId },
      data: { padding: "x".repeat(96000) },
      evidence: [source]
    })
    await turn.save(runId, false, persistence)
    const memory = await restoreResearchMemory(
      owner,
      [{ role: "assistant", researchRunId: runId }],
      [],
      persistence,
      () => 1
    )
    expect(memory.evidence[0]).toMatchObject({
      title: source.title,
      versionLabel: "Introduced in House, 2026-01-13",
      billIdentity: bill,
      recordId: documentId,
      content: { state: "available", quote: "Fixture operative text." }
    })
    expect(JSON.stringify(memory.message)).toContain(source.title)
  })
})
