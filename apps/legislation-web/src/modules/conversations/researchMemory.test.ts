import { createLogger } from "@repo/legislation-core/observability/logger"
import type { ModelMessage } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import invariant from "tiny-invariant"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { runResearchAgent } from "./agent"
import { conversationTextMessages, chatRequestSchema } from "./chatRequest"
import { createCitationPresentation } from "./components/citationPresentation"
import { createPresentationRecords } from "./compositionRecords"
import { parseDevelopmentConversation } from "./developmentConversation"
import { type EvidenceSnapshot } from "./evidence"
import { createResearchEvidenceProjector } from "./evidenceSource.server"
import { createResearchTurn, researchMemoryLimits, restoreResearchMemory } from "./researchMemory"
import type { ResearchSnapshotPersistence } from "./snapshotPersistence.server"

vi.mock("@langfuse/tracing", () => ({
  propagateAttributes: (_attributes: unknown, operation: () => unknown) => operation()
}))

const owner = { sessionKey: "11111111-1111-4111-8111-111111111111", sessionId: "conversation-one" }
const runId = "22222222-2222-4222-8222-222222222222"
const otherRunId = "33333333-3333-4333-8333-333333333333"
const evidence: EvidenceSnapshot = {
  id: "provision-2367-ih-section-3",
  citationRef: "e1",
  recordId: "document:us:119:s:2367:ih",
  billId: "bill:us:119:s:2367",
  title: "S. 2367",
  versionLabel: "Introduced",
  origin: "canonical",
  locator: "Section 3",
  sourceUrl: "https://www.congress.gov/119/bills/s2367/BILLS-119s2367is.htm",
  content: { state: "available", quote: "A person may bring a civil action.", truncated: true, totalCharacters: 900 }
}
const history = [{ role: "assistant", researchRunId: runId }] as const

function persistenceFixture() {
  const saved = new Map<string, unknown>()
  const persistence: ResearchSnapshotPersistence = {
    save: vi.fn<ResearchSnapshotPersistence["save"]>(async (id, value) => {
      saved.set(id, structuredClone(value))
    }),
    read: vi.fn<ResearchSnapshotPersistence["read"]>(async (_sessionKey, id) => structuredClone(saved.get(id)))
  }
  return { persistence, saved }
}

async function seed(persistence: ResearchSnapshotPersistence, id = runId, source = evidence, now = () => 0) {
  const turn = createResearchTurn(
    owner.sessionKey,
    owner.sessionId,
    "Compare proposed remedies and judicial interpretation.",
    now
  )
  turn.record({
    tool: "get_bill_text",
    input: { id: source.billId, versionCode: "is", cursor: "expired-input-cursor" },
    data: {
      document: { id: source.recordId, versionCode: "is", billId: source.billId },
      sections: [{ text: source.content.state === "available" ? source.content.quote : null }],
      nextCursor: "expired-output-cursor",
      warnings: ["Only the first section page was read."]
    },
    evidence: [source]
  })
  turn.record({ tool: "get_bill_timeline", input: { id: source.billId }, failure: "timeout" })
  await turn.save(id, true, persistence)
}

describe("server-owned research memory", () => {
  it.each([
    {
      name: "conditional immunity",
      quote: "A developer satisfying paragraphs (1) and (2) is immune from the specified civil action.",
      qualification:
        "Failure to satisfy those conditions removes this immunity; it does not itself establish liability."
    },
    {
      name: "hearing opportunity",
      quote: "Provide written notice and an opportunity for a fair hearing.",
      qualification:
        "Assistance continues during the 30-day correction period; the passage does not require a completed hearing before every action."
    },
    {
      name: "fiscal component and whole-bill estimate",
      quote: "The modeled section 2 change reduces premiums for the specified population.",
      qualification: "The modeled whole-bill net effect increases premiums over the same forecast horizon."
    },
    {
      name: "proposed rather than final authority",
      quote: "The agency proposes payment at the outpatient rate plus five percent.",
      qualification: "Proposed rule, not final authority; final adoption and effective date have not been retrieved."
    }
  ])(
    "retains both claim and qualification for $name without upgrading incomplete scope",
    async ({ quote, qualification }) => {
      const { persistence } = persistenceFixture()
      const turn = createResearchTurn(
        owner.sessionKey,
        owner.sessionId,
        "Compare 2021-2026 federal and state policy.",
        () => 0
      )
      const input = { query: "policy", sessionIds: ["session:us:119"], jurisdictionIds: ["jurisdiction:us"] }
      const source: EvidenceSnapshot = {
        ...evidence,
        content: { state: "available", quote: `${quote}\n\n${qualification}`, truncated: true, totalCharacters: 4000 }
      }
      const data = {
        sections: [{ text: `${quote}\n\n${qualification}` }],
        sampleCount: 2,
        populationDenominator: null,
        warnings: ["Only one Congress and the first section page were retrieved."],
        nextCursor: "turn-owned-continuation"
      }
      turn.record({ tool: "search_bill_text", input, data, evidence: [source] })
      turn.record({ tool: "analyze_legislation", input: { dataset: "bills" }, failure: "dependency_unavailable" })
      await turn.save(runId, true, persistence)
      const restored = await restoreResearchMemory(owner, history, ["e1"], persistence, () => 1)
      invariant(restored.message && typeof restored.message.content === "string")
      const context = z
        .object({
          turns: z.array(
            z.looseObject({
              observations: z.array(z.looseObject({ data: z.unknown().optional() }))
            })
          )
        })
        .parse(JSON.parse(restored.message.content.split("\n\n").at(-1) ?? ""))
      expect(context.turns[0]).toMatchObject({
        goal: "Compare 2021-2026 federal and state policy.",
        interrupted: true,
        observations: [
          {
            input,
            data: {
              sections: [{ text: `${quote}\n\n${qualification}` }],
              sampleCount: 2,
              populationDenominator: null,
              warnings: data.warnings
            },
            hasMore: true,
            dataOmitted: false
          },
          { failure: "dependency_unavailable" }
        ]
      })
      expect(context.turns[0]?.observations[0]?.data).not.toHaveProperty("nextCursor")
      expect(restored.evidence[0]?.content).toEqual(source.content)
      expect(restored.evidence[0]?.versionLabel).toBe(source.versionLabel)
      expect(restored.evidence[0]?.citationRef).not.toBe("e1")
    }
  )

  it("restores bounded provenance and failed goals into actual follow-up model input without another read", async () => {
    const { persistence } = persistenceFixture()
    await seed(persistence)
    const restored = await restoreResearchMemory(owner, history, ["e246", "e251"], persistence, () => 1)
    invariant(restored.message)
    const model = new MockLanguageModelV4({
      doStream: async ({ prompt }) => {
        expect(JSON.stringify(prompt)).toContain("A person may bring a civil action.")
        expect(JSON.stringify(prompt)).toContain("bill:us:119:s:2367")
        expect(JSON.stringify(prompt)).toContain("Introduced")
        expect(JSON.stringify(prompt)).toContain("Only the first section page was read.")
        expect(JSON.stringify(prompt)).toContain("timeout")
        expect(JSON.stringify(prompt)).toContain("judicial interpretation")
        expect(JSON.stringify(prompt)).toContain("#citation-provision-2367-ih-section-3")
        expect(JSON.stringify(prompt)).not.toContain("#citation-e252")
        expect(JSON.stringify(prompt)).not.toContain("expired-input-cursor")
        expect(JSON.stringify(prompt)).not.toContain("expired-output-cursor")
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "stream-start", warnings: [] })
              controller.enqueue({ type: "text-start", id: "answer" })
              controller.enqueue({
                type: "text-delta",
                id: "answer",
                delta:
                  "The proposed text permits civil actions; judicial interpretation remains unresolved. [1](#citation-provision-2367-ih-section-3)"
              })
              controller.enqueue({ type: "text-end", id: "answer" })
              controller.enqueue({
                type: "finish",
                finishReason: { unified: "stop", raw: "stop" },
                usage: {
                  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                  outputTokens: { total: 1, text: 1, reasoning: 0 }
                }
              })
              controller.close()
            }
          })
        }
      }
    })
    const messages: ModelMessage[] = [
      { role: "user", content: "Compare remedies." },
      { role: "assistant", content: "Previously retrieved text [1](#citation-e251)" },
      restored.message,
      { role: "user", content: "What counterevidence remains?" }
    ]
    const result = runResearchAgent({
      sessionId: owner.sessionId,
      model,
      instructions: "Research.",
      messages,
      tools: {},
      signal: new AbortController().signal
    })
    let text = ""
    let calls = 0
    for await (const chunk of result.stream) {
      expect(chunk.type).not.toBe("error")
      if (chunk.type === "text-delta") {
        text += chunk.text
      }
      if (chunk.type === "tool-call") {
        calls++
      }
    }
    expect(calls).toBe(0)
    expect(model.doStreamCalls).toHaveLength(1)
    expect(createCitationPresentation("answer", text, restored.evidence).missingReferences).toEqual([])
    expect(restored.evidence[0]).toEqual({ ...evidence, citationRef: "e252" })
    const records = createPresentationRecords(owner.sessionKey)
    records.registerContents(restored.contents)
    expect(records.resolveContent({ contentId: restored.contents[0]?.id })).toMatchObject({
      kind: "evidence",
      evidence: { locator: "Section 3", content: { truncated: true } }
    })
    expect(() => records.canonicalReference({ resultId: "r1", recordId: evidence.billId ?? "" })).toThrow(
      "The result was not retrieved in this response."
    )
  })

  it("isolates owners, conversations and expired snapshots even if their run IDs are known", async () => {
    const { persistence } = persistenceFixture()
    await seed(persistence)
    for (const [identity, clock] of [
      [{ ...owner, sessionKey: otherRunId }, () => 1],
      [{ ...owner, sessionId: "other-conversation" }, () => 1],
      [owner, () => researchMemoryLimits.ttlMs]
    ] as const) {
      const restored = await restoreResearchMemory(identity, history, [], persistence, clock)
      expect(restored.evidence).toEqual([])
      expect(JSON.stringify(restored.message)).not.toContain(evidence.title)
      expect(JSON.stringify(restored.message)).toContain("unavailable")
    }
  })

  it("never merges different sources sharing an old eN marker", async () => {
    const { persistence } = persistenceFixture()
    await seed(persistence)
    await seed(persistence, otherRunId, {
      ...evidence,
      id: "provision-2081-is-section-4",
      billId: "bill:us:119:s:2081",
      recordId: "document:us:119:s:2081:is",
      title: "S. 2081",
      locator: "Section 4"
    })
    const restored = await restoreResearchMemory(
      owner,
      [...history, { role: "assistant", researchRunId: otherRunId }],
      [],
      persistence,
      () => 1
    )
    expect(restored.evidence).toHaveLength(2)
    expect(new Set(restored.evidence.map((source) => source.citationRef)).size).toBe(2)
    expect(restored.evidence.every((source) => source.citationRef !== "e1")).toBe(true)
    for (const source of restored.evidence) {
      const citation = createCitationPresentation("answer", `[1](#citation-${source.citationRef})`, restored.evidence)
      expect(citation.citations[0]?.evidence.id).toBe(source.id)
    }
  })

  it("keeps refreshed tool results on the same newly registered citation", async () => {
    const logger = createLogger({ service: "memory-test", level: "warn", write: () => undefined })
    const data = {
      id: "document:one",
      billId: evidence.billId,
      title: "Proposed text",
      text: "Proposed remedy.",
      sourceUrl: evidence.sourceUrl
    }
    const prior = createResearchEvidenceProjector(logger, runId)(data)[0]
    invariant(prior)
    const { persistence } = persistenceFixture()
    await seed(persistence, runId, prior)
    const restored = await restoreResearchMemory(owner, history, [], persistence, () => 1)
    const project = createResearchEvidenceProjector(logger, otherRunId, [], restored.evidence)
    expect(project(data)[0]?.citationRef).toBe(restored.evidence[0]?.citationRef)
    expect(project({ ...data, text: "Changed text." })[0]?.citationRef).not.toBe(restored.evidence[0]?.citationRef)
  })

  it("bounds serialized storage and actual model context and marks omitted observations", async () => {
    const { persistence, saved } = persistenceFixture()
    const turn = createResearchTurn(owner.sessionKey, owner.sessionId, "Question".repeat(1000), () => 0)
    for (let index = 0; index < 30; index++) {
      turn.record({
        tool: "get_bill_text",
        input: { id: "bill:us:119:s:2367" },
        data: { text: "x".repeat(90000) },
        evidence: [{ ...evidence, id: `source-${index}`, content: { state: "available", quote: "y".repeat(20000) } }]
      })
    }
    await turn.save(runId, false, persistence)
    expect(Buffer.byteLength(JSON.stringify(saved.get(runId)))).toBeLessThanOrEqual(researchMemoryLimits.turnBytes)
    expect(saved.get(runId)).toMatchObject({ goalTruncated: true, omitted: expect.any(Number) })
    const restored = await restoreResearchMemory(owner, history, [], persistence, () => 1)
    expect(restored.evidence.length).toBeGreaterThan(0)
    expect(Buffer.byteLength(JSON.stringify(restored.message))).toBeLessThanOrEqual(researchMemoryLimits.contextBytes)
    expect(JSON.stringify(restored.message)).toContain("dataOmitted")
  })

  it("forwards only server snapshot IDs and restores retained evidence through browser reload", async () => {
    const messages = [
      {
        id: "answer",
        role: "assistant" as const,
        metadata: { runId },
        parts: [
          { type: "text" as const, text: "Answer." },
          { type: "data-research-context" as const, data: { evidence: [evidence] } }
        ]
      },
      { id: "question", role: "user" as const, parts: [{ type: "text" as const, text: "Follow up." }] }
    ]
    const projected = conversationTextMessages(messages)
    expect(projected[0]).toEqual({
      id: "answer",
      role: "assistant",
      researchRunId: runId,
      parts: [{ type: "text", text: "Answer." }]
    })
    const request = chatRequestSchema.parse({ ...owner, messages: projected, evidence: ["forged"] })
    expect(request).not.toHaveProperty("evidence")
    expect(JSON.stringify(request)).not.toContain("civil action")
    const snapshot = await parseDevelopmentConversation(
      JSON.stringify({
        id: owner.sessionId,
        sessionKey: owner.sessionKey,
        draft: [],
        messages,
        clarificationAnswers: {}
      })
    )
    expect(snapshot?.messages[0]?.parts[1]).toEqual(messages[0]?.parts[1])
  })

  it("reports missing context and propagates persistence failures instead of silently losing evidence", async () => {
    const { persistence } = persistenceFixture()
    const restored = await restoreResearchMemory(owner, history, [], persistence, () => 1)
    expect(restored.evidence).toEqual([])
    expect(JSON.stringify(restored.message)).toContain("expired")
    const failing: ResearchSnapshotPersistence = {
      ...persistence,
      read: async () => {
        throw new Error("storage unavailable")
      }
    }
    await expect(restoreResearchMemory(owner, history, [], failing)).rejects.toThrow("storage unavailable")
    const newConversation = await restoreResearchMemory(owner, [], [], persistence)
    expect(newConversation.message).toBeUndefined()
  })
})
