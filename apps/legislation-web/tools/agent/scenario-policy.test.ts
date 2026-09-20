import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import invariant from "tiny-invariant"
import { describe, expect, it } from "vitest"
import type { ClarificationRequest } from "../../src/modules/conversations/clarification"
import { entityKindSchema, projectEntityResult } from "../../src/modules/conversations/entityResults"
import {
  approvedJurisdictions,
  adaptiveDecisionSchema,
  validateAdaptiveDecision,
  inspectSnapshot,
  requestIdentity,
  scenarioCoverage,
  scenarioSchema,
  selectClarification,
  selectStep,
  snapshotSchema,
  summarizeExchange,
  type RequestObservation,
  type StepProgress
} from "./scenario-policy"

const clarificationId = "11111111-1111-4111-8111-111111111111"
const otherClarificationId = "22222222-2222-4222-8222-222222222222"
const authored = {
  id: "explicit-state-fixture",
  objective: "Compare the named jurisdictions without narrowing scope automatically.",
  jurisdictions: ["U.S. federal", "California", "New York"],
  maximumExchanges: 8,
  steps: [
    { id: "discover", prompt: "Find proposals in the approved jurisdictions." },
    {
      id: "compare",
      prompt: "Compare the discovered proposals.",
      requiresRecordsFrom: { stepId: "discover", kind: "bill" }
    }
  ],
  clarificationAnswers: [
    {
      question: "Which two states?",
      kind: "jurisdiction",
      jurisdictions: ["California", "New York"]
    }
  ]
}
const request: ClarificationRequest = {
  id: clarificationId,
  revision: 1,
  state: "pending",
  input: { kind: "text", question: "Which two states?", allowSkip: false }
}
const complete = {
  status: "completed" as const,
  finishReason: "stop",
  hasAnswer: true,
  pendingToolCalls: [],
  failedToolCalls: []
}
function observed(body: unknown, id = "request-one"): RequestObservation {
  return { ...requestIdentity(body), id, serverRequestId: null, status: 200, terminal: "finished", failure: null }
}
function progress(): StepProgress[] {
  return authored.steps.map((step) => ({
    id: step.id,
    selected: null,
    executedRequestIds: [],
    answered: false,
    records: []
  }))
}

describe("adaptive conversation policy", () => {
  const scenario = scenarioSchema.parse({
    ...authored,
    adaptive: { persona: "A local reporter", constraints: ["Keep all three jurisdictions"], maximumRecoveries: 1 }
  })
  const visible = {
    transcript: "I found a California proposal. New York evidence is unavailable.",
    clarification: null,
    hasFailure: false
  }
  const next = adaptiveDecisionSchema.parse({
    action: "follow-up",
    text: "What does the California proposal require?",
    optionLabels: [],
    reason: "Follow the selected proposal.",
    jurisdictions: authored.jurisdictions,
    goals: []
  })

  it("accepts a natural follow-up without hidden record dependencies", () => {
    expect(validateAdaptiveDecision(scenario, visible, next, [])).toEqual(next)
  })

  it("rejects scope changes and invented goal evidence", () => {
    expect(() => validateAdaptiveDecision(scenario, visible, { ...next, jurisdictions: ["U.S. federal"] }, [])).toThrow(
      "jurisdictions"
    )
    expect(() =>
      validateAdaptiveDecision(
        scenario,
        visible,
        { ...next, goals: [{ id: "discover", status: "addressed", quote: "All states passed laws." }] },
        []
      )
    ).toThrow("quote")
    expect(() =>
      validateAdaptiveDecision(
        scenario,
        visible,
        { ...next, goals: [{ id: "unknown", status: "addressed", quote: "California" }] },
        []
      )
    ).toThrow("authored goals")
  })

  it("requires an explicit bounded recovery and retains failures", () => {
    const failed = { ...visible, hasFailure: true }
    const recovery = { ...next, action: "recover" as const }
    expect(() => validateAdaptiveDecision(scenario, failed, next, [])).toThrow("recovery")
    expect(validateAdaptiveDecision(scenario, failed, recovery, [])).toEqual(recovery)
    expect(() =>
      validateAdaptiveDecision(scenario, failed, { ...recovery, text: "Try a smaller comparison." }, [recovery])
    ).toThrow("budget")
    expect(() => validateAdaptiveDecision(scenario, visible, recovery, [])).toThrow("no visible failure")
  })

  it("rejects repeated submissions and unavailable clarification options", () => {
    expect(() => validateAdaptiveDecision(scenario, visible, next, [next])).toThrow("repeat")
    expect(() =>
      validateAdaptiveDecision(
        scenario,
        { ...visible, hasFailure: true },
        { ...next, action: "recover", text: scenario.steps[0]!.prompt },
        []
      )
    ).toThrow("repeat")
    const pending = {
      ...visible,
      clarification: {
        question: "Which state?",
        optionLabels: ["California", "New York"],
        allowsText: false,
        multiple: true
      }
    }
    const answer = { ...next, action: "clarify" as const, text: "", optionLabels: ["California", "New York"] }
    expect(validateAdaptiveDecision(scenario, pending, answer, [])).toEqual(answer)
    expect(() => validateAdaptiveDecision(scenario, pending, { ...answer, optionLabels: ["Texas"] }, [])).toThrow(
      "controls"
    )
    expect(() => validateAdaptiveDecision(scenario, pending, next, [])).toThrow("pending clarification")
    expect(() => validateAdaptiveDecision(scenario, pending, { ...answer, text: "unsupported free text" }, [])).toThrow(
      "controls"
    )
  })

  it("requires every goal disposition before finishing, without certifying correctness", () => {
    const finish = { ...next, action: "finish" as const, text: "" }
    expect(() => validateAdaptiveDecision(scenario, visible, finish, [])).toThrow("every goal")
    const goals = [
      { id: "discover", status: "addressed" as const, quote: "I found a California proposal." },
      { id: "compare", status: "unresolved" as const, quote: "New York evidence is unavailable." }
    ]
    expect(validateAdaptiveDecision(scenario, visible, { ...finish, goals }, []).goals).toEqual(goals)
  })
})

describe("explicit scenario scope", () => {
  it("rejects unspecified states instead of selecting convenient federal scope", () => {
    expect(scenarioSchema.safeParse({ ...authored, jurisdictions: ["Federal and two supported states"] }).success).toBe(
      false
    )
    expect(scenarioSchema.safeParse({ ...authored, jurisdictions: ["CA", "NY"] }).success).toBe(false)
  })

  it("permits only an explicitly accepted narrowing to authored jurisdictions", () => {
    const scenario = scenarioSchema.parse({
      ...authored,
      acceptedNarrowing: {
        jurisdictions: ["U.S. federal"],
        reason: "The researcher explicitly accepted a federal-only investigation."
      }
    })
    expect(approvedJurisdictions(scenario)).toEqual(["U.S. federal"])
    expect(
      scenarioSchema.safeParse({
        ...authored,
        acceptedNarrowing: { jurisdictions: ["Texas"], reason: "Unavailable original state" }
      }).success
    ).toBe(false)
  })

  it("answers the actual named-state question with names, not the objective or next prompt", () => {
    const selection = selectClarification(scenarioSchema.parse(authored), request, new Set())
    expect(selection.kind).toBe("answer")
    invariant(selection.kind === "answer")
    expect(selection.response).toEqual({
      requestId: clarificationId,
      revision: 1,
      status: "answered",
      selectedIds: [],
      text: "California, New York"
    })
  })

  it("pauses on generic repeated scope, unrecognized questions and repeated clarification", () => {
    const generic = scenarioSchema.safeParse({
      ...authored,
      clarificationAnswers: [
        { question: "Which two states?", kind: "jurisdiction", text: "Federal and two supported states" }
      ]
    })
    expect(generic.success).toBe(false)
    const scenario = scenarioSchema.parse(authored)
    expect(
      selectClarification(
        scenario,
        { ...request, input: { ...request.input, question: "Which jurisdiction should I use?" } },
        new Set()
      ).kind
    ).toBe("pause")
    expect(selectClarification(scenario, request, new Set(["Which two states?"])).kind).toBe("pause")
  })

  it("does not choose a federal-only option for an approved multistate investigation", () => {
    const choice: ClarificationRequest = {
      ...request,
      input: {
        kind: "single",
        question: "Choose scope",
        allowSkip: false,
        allowFreeText: false,
        options: [
          { id: "federal", label: "U.S. federal" },
          { id: "states", label: "Named states" }
        ]
      }
    }
    const answers = [
      {
        question: "Choose scope",
        kind: "jurisdiction",
        jurisdictions: ["U.S. federal"],
        options: [{ label: "U.S. federal", jurisdictions: ["U.S. federal"] }]
      }
    ]
    expect(
      selectClarification(scenarioSchema.parse({ ...authored, clarificationAnswers: answers }), choice, new Set()).kind
    ).toBe("pause")
    const narrowed = scenarioSchema.parse({
      ...authored,
      acceptedNarrowing: { jurisdictions: ["U.S. federal"], reason: "Explicit researcher approval" },
      clarificationAnswers: answers
    })
    const selection = selectClarification(narrowed, choice, new Set())
    expect(selection.kind).toBe("answer")
    invariant(selection.kind === "answer" && selection.response.status === "answered")
    expect(selection.response.selectedIds).toEqual(["federal"])
  })

  it("pauses when authored choices are unavailable or controls disallow a custom answer", () => {
    const choice: ClarificationRequest = {
      ...request,
      input: {
        kind: "single",
        question: "Which two states?",
        allowSkip: false,
        allowFreeText: false,
        options: [
          { id: "california", label: "California" },
          { id: "texas", label: "Texas" }
        ]
      }
    }
    expect(selectClarification(scenarioSchema.parse(authored), choice, new Set()).kind).toBe("pause")
    const missing = scenarioSchema.parse({
      ...authored,
      clarificationAnswers: [
        {
          question: "Which two states?",
          kind: "jurisdiction",
          jurisdictions: ["California", "New York"],
          options: [
            { label: "California", jurisdictions: ["California"] },
            { label: "New York", jurisdictions: ["New York"] }
          ]
        }
      ]
    })
    expect(selectClarification(missing, choice, new Set()).kind).toBe("pause")
  })

  it("does not confuse Virginia with West Virginia in structured choices", () => {
    const scenario = scenarioSchema.parse({
      ...authored,
      jurisdictions: ["U.S. federal", "Virginia"],
      clarificationAnswers: [{ question: "Which two states?", kind: "jurisdiction", jurisdictions: ["West Virginia"] }]
    })
    expect(selectClarification(scenario, request, new Set()).kind).toBe("pause")
  })

  it("rejects an unauthorized extra state even when the approved state is present", () => {
    const scenario = scenarioSchema.parse({
      ...authored,
      jurisdictions: ["Michigan"],
      clarificationAnswers: [
        { question: "Which two states?", kind: "jurisdiction", jurisdictions: ["Michigan", "Ohio"] }
      ]
    })
    expect(selectClarification(scenario, request, new Set()).kind).toBe("pause")
  })

  it("rejects an option label whose named state differs from its structured mapping", () => {
    const scenario = scenarioSchema.parse({
      ...authored,
      jurisdictions: ["Virginia"],
      clarificationAnswers: [
        {
          question: "Which two states?",
          kind: "jurisdiction",
          jurisdictions: ["Virginia"],
          options: [{ label: "West Virginia", jurisdictions: ["Virginia"] }]
        }
      ]
    })
    const choice: ClarificationRequest = {
      ...request,
      input: {
        kind: "single",
        question: request.input.question,
        allowSkip: false,
        allowFreeText: false,
        options: [
          { id: "west", label: "West Virginia" },
          { id: "virginia", label: "Virginia" }
        ]
      }
    }
    expect(selectClarification(scenario, choice, new Set()).kind).toBe("pause")
  })

  it("generates exact state-only text without silently removing the approved federal scope", () => {
    const scenario = scenarioSchema.parse({
      ...authored,
      jurisdictions: ["U.S. federal", "Virginia"],
      clarificationAnswers: [{ question: "Which two states?", kind: "jurisdiction", jurisdictions: ["Virginia"] }]
    })
    const selection = selectClarification(scenario, request, new Set())
    invariant(selection.kind === "answer")
    expect(selection.text).toBe("Virginia")
    expect(approvedJurisdictions(scenario)).toEqual(["U.S. federal", "Virginia"])
  })
})

describe("dependent prompt selection and coverage", () => {
  it.each(entityKindSchema.options)("accepts the canonical %s prerequisite kind", (kind) => {
    expect(
      scenarioSchema.safeParse({
        ...authored,
        steps: [authored.steps[0], { ...authored.steps[1], requiresRecordsFrom: { stepId: "discover", kind } }]
      }).success
    ).toBe(true)
  })

  it.each(["event", "hearing", "unknown", ""])("rejects unsupported prerequisite kind %j", (kind) => {
    const result = scenarioSchema.safeParse({
      ...authored,
      steps: [authored.steps[0], { ...authored.steps[1], requiresRecordsFrom: { stepId: "discover", kind } }]
    })
    expect(result.success).toBe(false)
    invariant(!result.success)
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ path: ["steps", 1, "requiresRecordsFrom", "kind"] })
    )
  })

  it.each([true, false])(
    "selects meeting prerequisites from exported discovery and preserves branch coverage (has meetings: %s)",
    (hasMeetings) => {
      const scenario = scenarioSchema.parse({
        ...authored,
        steps: [
          { id: "discover", prompt: "Find AI committee hearings." },
          {
            id: "compare",
            prompt: "Compare the discovered hearings.",
            requiresRecordsFrom: {
              stepId: "discover",
              kind: "meeting",
              onMissingRecords: "Explain the hearing discovery gap."
            }
          }
        ]
      })
      const resultSet = projectEntityResult("search_events", {
        items: hasMeetings
          ? [
              {
                id: "event:congress:committee-meeting-123",
                name: "Artificial intelligence oversight hearing",
                startAt: "2026-09-18T14:00:00Z",
                sourceUrl: "https://www.congress.gov/event/119th-congress/house-event/123"
              }
            ]
          : []
      })
      invariant(resultSet)
      const snapshot = snapshotSchema.parse({
        format: "rostra-conversation",
        schemaVersion: 1,
        conversationId: "meeting-fixture",
        interactionStatus: "ready",
        messages: [{ id: "answer", role: "assistant", parts: [{ type: "text", text: "Discovery complete." }] }],
        responseOutcomes: [{ messageId: "answer", ...complete }],
        toolCalls: [
          {
            messageId: "answer",
            toolCallId: "events",
            toolName: "search_events",
            state: "output-available",
            output: { resultSet }
          }
        ]
      })
      const inspection = inspectSnapshot(snapshot, new Set())
      expect(inspection.records).toEqual(
        hasMeetings
          ? [
              {
                id: "event:congress:committee-meeting-123",
                kind: "meeting",
                title: "Artificial intelligence oversight hearing"
              }
            ]
          : []
      )
      const steps = progress()
      steps[0] = {
        id: "discover",
        selected: "primary",
        executedRequestIds: ["opening"],
        answered: summarizeExchange([observed({ messages: [] })], inspection.outcome).answered,
        records: inspection.records
      }
      const selection = selectStep(scenario, 1, steps)
      const branch = hasMeetings ? "primary" : "missing-records"
      expect(selection).toEqual({
        kind: "submit",
        branch,
        prompt: `${hasMeetings ? "Compare the discovered hearings." : "Explain the hearing discovery gap."}\n\nApproved jurisdictions: U.S. federal, California, New York.`
      })
      steps[1] = {
        id: "compare",
        selected: branch,
        executedRequestIds: ["follow-up"],
        answered: true,
        records: []
      }
      const coverage = scenarioCoverage(scenario, steps)
      expect(coverage.answered).toEqual([
        { stepId: "discover", branch: "primary" },
        { stepId: "compare", branch }
      ])
      expect(coverage.executed).toContainEqual({ stepId: "compare", branch, requestIds: ["follow-up"] })
      expect(coverage.unassessed).toEqual(["discover", "compare"])
    }
  )

  it("does not advance after clarification-only output or absent discovery", () => {
    const scenario = scenarioSchema.parse(authored)
    const steps = progress()
    expect(selectStep(scenario, 1, steps).kind).toBe("pause")
    steps[0]!.answered = true
    expect(selectStep(scenario, 1, steps)).toEqual({
      kind: "pause",
      reason: "No bill records were observed in discover; dependent question not submitted."
    })
  })

  it("selects only an authored absent-discovery branch, not the ungrounded comparison", () => {
    const scenario = scenarioSchema.parse({
      ...authored,
      steps: [
        authored.steps[0],
        {
          id: "compare",
          prompt: "Compare the discovered proposals.",
          requiresRecordsFrom: {
            stepId: "discover",
            kind: "bill",
            onMissingRecords: "Explain the discovery gap without identifying a proposal."
          }
        }
      ]
    })
    const steps = progress()
    steps[0]!.answered = true
    const selection = selectStep(scenario, 1, steps)
    expect(selection).toEqual({
      kind: "submit",
      branch: "missing-records",
      prompt:
        "Explain the discovery gap without identifying a proposal.\n\nApproved jurisdictions: U.S. federal, California, New York."
    })
  })

  it("does not inject discovered records into an authored dependent question", () => {
    const steps = progress()
    steps[0]!.answered = true
    steps[0]!.records.push({ id: "bill:fixture", kind: "bill", title: "Synthetic proposal" })
    const selection = selectStep(scenarioSchema.parse(authored), 1, steps)
    expect(selection.kind).toBe("submit")
    invariant(selection.kind === "submit")
    expect(selection.prompt).toBe(
      "Compare the discovered proposals.\n\nApproved jurisdictions: U.S. federal, California, New York."
    )
    expect(selection.branch).toBe("primary")
  })

  it("distinguishes planned, selected, executed, answered and unassessed work", () => {
    const scenario = scenarioSchema.parse(authored)
    const steps = progress()
    steps[0]!.selected = "primary"
    steps[0]!.executedRequestIds = ["research-one"]
    expect(scenarioCoverage(scenario, steps)).toMatchObject({
      planned: ["discover", "compare"],
      selected: [{ stepId: "discover", branch: "primary" }],
      executed: [{ stepId: "discover", branch: "primary", requestIds: ["research-one"] }],
      answered: [],
      unassessed: ["discover", "compare"]
    })
    steps[0]!.answered = true
    expect(scenarioCoverage(scenario, steps).answered).toEqual([{ stepId: "discover", branch: "primary" }])
    expect(scenarioCoverage(scenario, steps).unassessed).toEqual(["discover", "compare"])
  })
})

describe("request-aware observation", () => {
  it("correlates confirmation and resume by request identity without counting two generations", () => {
    const requests = [
      observed(
        { action: "answer-clarification", sessionKey: "DO NOT RETAIN", response: { requestId: clarificationId } },
        "confirmation"
      ),
      observed({ messages: [], clarificationId }, "continuation")
    ]
    expect(requests[0]).not.toHaveProperty("sessionKey")
    expect(summarizeExchange(requests, complete)).toMatchObject({
      requestPattern: "confirmation-resume",
      generationRequestIds: ["continuation"],
      answered: true
    })
    requests[1] = observed({ messages: [], clarificationId: otherClarificationId }, "unrelated")
    expect(summarizeExchange(requests, complete).requestPattern).toBe("unattributed")
  })

  it("keeps a late abort alongside a delivered terminal answer without relabeling it failed", () => {
    const request = { ...observed({ messages: [] }), terminal: "failed" as const, failure: "net::ERR_ABORTED" }
    const result = summarizeExchange([request], complete)
    expect(result).toMatchObject({ answered: true, delivery: "completed", assessment: "unassessed" })
    expect(result.transportObservations).toEqual([
      {
        requestId: request.id,
        status: 200,
        terminal: "failed",
        failure: "net::ERR_ABORTED"
      }
    ])
  })

  it.each([
    undefined,
    { ...complete, status: "unknown" as const },
    { ...complete, status: "partial" as const },
    { ...complete, status: "clarification" as const, hasAnswer: false },
    { ...complete, hasAnswer: false },
    { ...complete, pendingToolCalls: ["unfinished"] }
  ])("does not infer delivered completion from idle HTTP 200: %j", (outcome) => {
    expect(summarizeExchange([observed({ messages: [] })], outcome).answered).toBe(false)
  })

  it("retains real tool failures and distinguishes multiple requests from proved duplicate billing", () => {
    const summary = summarizeExchange(
      [
        observed({ messages: [] }, "first"),
        observed({ messages: [] }, "second"),
        observed({ action: "page-results" }, "inspection")
      ],
      { ...complete, failedToolCalls: ["failed-read"] }
    )
    expect(summary).toMatchObject({
      requestPattern: "multiple-generation-requests-observed",
      generationRequestIds: ["first", "second"],
      failedToolCalls: ["failed-read"]
    })
  })
})

describe("export observation and the executable plan", () => {
  it("does not call clarification or tool invocation a useful evidence chain", () => {
    const snapshot = snapshotSchema.parse({
      format: "rostra-conversation",
      schemaVersion: 1,
      conversationId: "offline",
      interactionStatus: "ready",
      messages: [
        {
          id: "clarify",
          role: "assistant",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "ask_clarification",
              state: "output-available",
              output: { clarification: request }
            }
          ]
        }
      ],
      responseOutcomes: [{ messageId: "clarify", ...complete, status: "clarification", hasAnswer: false }],
      toolCalls: [
        {
          messageId: "clarify",
          toolCallId: "ask-one",
          toolName: "ask_clarification",
          state: "output-available",
          output: { clarification: request }
        }
      ]
    })
    const result = inspectSnapshot(snapshot, new Set())
    expect(result.calls).toHaveLength(1)
    expect(result.records).toEqual([])
    expect(result.evidenceCandidates).toEqual([])
    expect(result.clarification).toEqual(request)
    expect(inspectSnapshot(snapshot, new Set(["clarify"])).messageIds).toEqual([])
  })

  it("ignores error-envelope records and keeps successful record/evidence receipts distinct", () => {
    const snapshot = snapshotSchema.parse({
      format: "rostra-conversation",
      schemaVersion: 1,
      conversationId: "offline",
      interactionStatus: "ready",
      messages: [{ id: "answer", role: "assistant", parts: [{ type: "text", text: "Synthetic response" }] }],
      responseOutcomes: [{ messageId: "answer", ...complete }],
      toolCalls: [
        {
          messageId: "answer",
          toolCallId: "failed",
          toolName: "search_bills",
          state: "output-available",
          output: {
            error: "Failed read",
            resultSet: { items: [{ id: "untrusted", kind: "bill", title: "Not a success" }] }
          }
        },
        {
          messageId: "answer",
          toolCallId: "read",
          toolName: "get_bill",
          state: "output-available",
          output: {
            resultSet: { items: [{ id: "bill:one", kind: "bill", title: "Observed proposal" }] },
            evidence: [{ id: "exact-evidence" }]
          }
        }
      ]
    })
    const result = inspectSnapshot(snapshot, new Set())
    expect(result.calls).toHaveLength(2)
    expect(result.records).toEqual([{ id: "bill:one", kind: "bill", title: "Observed proposal" }])
    expect(result.evidenceCandidates).toEqual([
      { messageId: "answer", toolCallId: "read", evidenceIds: ["exact-evidence"] }
    ])
  })

  it("runs the actual CLI in plan mode from stdin without browser execution or run output", () => {
    const cli = fileURLToPath(new URL("./run-scenarios.ts", import.meta.url))
    const result = spawnSync(process.execPath, ["--import", "tsx", cli, "--scenario", "-"], {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      input: JSON.stringify({
        ...authored,
        adaptive: { persona: "A reporter", constraints: ["Preserve the named states"] }
      }),
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, OPENROUTER_API_KEY: "", LANGFUSE_SECRET_KEY: "" }
    })
    expect(result.stderr).toBe("")
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      mode: "plan",
      approvedJurisdictions: ["U.S. federal", "California", "New York"],
      coverage: {
        planned: ["discover", "compare"],
        selected: [],
        executed: [],
        answered: [],
        unassessed: ["discover", "compare"]
      }
    })
  })

  it("rejects an event prerequisite before execution even when paid browser execution is requested", () => {
    const cli = fileURLToPath(new URL("./run-scenarios.ts", import.meta.url))
    const result = spawnSync(process.execPath, ["--import", "tsx", cli, "--scenario", "-", "--execute"], {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      input: JSON.stringify({
        ...authored,
        steps: [authored.steps[0], { ...authored.steps[1], requiresRecordsFrom: { stepId: "discover", kind: "event" } }]
      }),
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, OPENROUTER_API_KEY: "", LANGFUSE_SECRET_KEY: "" }
    })
    expect(result.status).toBe(1)
    expect(result.stdout).toBe("")
    expect(result.stderr).toContain("requiresRecordsFrom")
    expect(result.stderr).toContain('"meeting"')
  })
})
