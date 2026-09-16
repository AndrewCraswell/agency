import type { LanguageModel, ModelMessage } from "ai"
import { z } from "zod"
import { createLegislationResearchTools } from "../../src/mcp/tools"
import { createLogger } from "../../src/observability/logger"
import { researchAgentLimits, runResearchAgent } from "../chat/agent"
import { createClarificationStore } from "../chat/clarificationStore"
import { createClarificationTool } from "../chat/clarificationTool"
import { createResearchTools } from "../chat/research"
import { clarificationRequestSchema } from "../lib/clarification"
import { checkRun } from "./checks"
import { assertSafeArtifact, canonicalJson, digest, type EvalCase, type EvalEvent, type EvalTurn } from "./contracts"
import { createFixtureService } from "./fixtures"
import { providerFailure } from "./providerRecovery"

export function createCallBudget(
  maximum: number,
  maximumInputCharacters: number,
  ledger?: { used: number; claim: () => void }
) {
  let used = ledger?.used ?? 0
  let blocked = false
  return {
    get used() {
      return used
    },
    get blocked() {
      return blocked
    },
    stop() {
      blocked = true
    },
    claim(input: unknown) {
      if (used >= maximum || canonicalJson(input).length > maximumInputCharacters) {
        blocked = true
        throw new Error("Evaluation call or input budget exhausted.")
      }
      ledger?.claim()
      used++
    }
  }
}

export async function executeCase(options: {
  item: EvalCase
  model: LanguageModel
  instructions: string
  budget: ReturnType<typeof createCallBudget>
  signal: AbortSignal
}) {
  const { item } = options
  assertSafeArtifact(item)
  const fixture = createFixtureService(item)
  const catalog = createLegislationResearchTools(
    fixture.service,
    createLogger({ service: "eval", level: "error" })
  ).map((definition) => ({
    name: definition.name,
    description: definition.description,
    schema: z.toJSONSchema(definition.inputSchema, { io: "input" })
  }))
  const toolSchemaHash = digest(catalog)
  const store = createClarificationStore()
  const sessionKey = crypto.randomUUID()
  const messages: ModelMessage[] = structuredClone(item.messages)
  const turns: EvalTurn[] = []
  const events: EvalEvent[] = []
  let status: "completed" | "agent-failure" | "ungradable" = "completed"
  const providerFailures: ReturnType<typeof providerFailure>[] = []
  for (let turn = 0; turn <= item.followUps.length; turn++) {
    const signal = AbortSignal.any([options.signal, AbortSignal.timeout(researchAgentLimits.timeoutMs)])
    let pending = false
    let step = 0
    let text = ""
    let termination = "incomplete"
    let firstTextMs: number | null = null
    let inputTokens: number | null = null
    let outputTokens: number | null = null
    const responses: EvalTurn["responses"] = []
    const started = performance.now()
    const tools = createResearchTools(
      { NODE_ENV: "development" },
      signal,
      () => !pending,
      () => undefined,
      undefined,
      fixture.service
    )
    tools.ask_clarification = createClarificationTool(
      sessionKey,
      signal,
      () => {
        pending = true
      },
      store
    )
    try {
      const result = runResearchAgent({
        sessionId: sessionKey,
        model: options.model,
        instructions: options.instructions,
        messages,
        tools,
        signal,
        prepareStep: ({ messages: stepMessages }) => {
          options.budget.claim({ instructions: options.instructions, catalog, messages: stepMessages })
          return undefined
        }
      })
      for await (const chunk of result.stream) {
        if (chunk.type === "start-step") {
          step++
        } else if (chunk.type === "text-delta") {
          firstTextMs ??= Math.round(performance.now() - started)
          text += chunk.text
        } else if (chunk.type === "tool-call" || chunk.type === "tool-result" || chunk.type === "tool-error") {
          let type: EvalEvent["type"] = "error"
          let value: unknown = "Tool execution failed."
          if (chunk.type === "tool-call") {
            type = "call"
            value = chunk.input
          } else if (chunk.type === "tool-result") {
            type = "result"
            value = chunk.output
          }
          events.push({ turn, step, type, tool: chunk.toolName, callId: chunk.toolCallId, value })
        } else if (chunk.type === "finish-step") {
          responses.push({ id: chunk.response.id, modelId: chunk.response.modelId })
        } else if (chunk.type === "finish") {
          termination = chunk.finishReason
          inputTokens = chunk.totalUsage.inputTokens ?? null
          outputTokens = chunk.totalUsage.outputTokens ?? null
        } else if (chunk.type === "error" || chunk.type === "abort") {
          if (chunk.type === "error") {
            const failure = providerFailure(chunk.error)
            if (failure.infrastructure) {
              providerFailures.push(failure)
              options.budget.stop()
            }
          }
          termination = "error"
          status = "agent-failure"
        }
      }
    } catch (error) {
      const failure = providerFailure(error)
      if (failure.infrastructure) {
        providerFailures.push(failure)
        options.budget.stop()
      }
      termination = "error"
      status = "agent-failure"
    }
    if (pending) {
      termination = "clarification"
    }
    turns.push({
      text,
      termination,
      durationMs: Math.round(performance.now() - started),
      firstTextMs,
      inputTokens,
      outputTokens,
      responses
    })
    if (fixture.missing.length) {
      status = "ungradable"
      break
    }
    if (options.signal.aborted || options.budget.blocked) {
      status = "ungradable"
      break
    }
    if (termination === "incomplete" || termination === "error") {
      status = "agent-failure"
      break
    }
    const followUp = item.followUps[turn]
    if (followUp === undefined) {
      break
    }
    const clarification = events
      .filter((event) => event.turn === turn && event.type === "result" && event.tool === "ask_clarification")
      .map((event) => z.object({ clarification: clarificationRequestSchema }).parse(event.value).clarification)
      .at(-1)
    messages.push({ role: "assistant", content: text || clarification?.input.question || "" })
    if (clarification && followUp === "[skip]") {
      try {
        store.answer(sessionKey, { requestId: clarification.id, revision: clarification.revision, status: "skipped" })
        messages.push({ role: "user", content: store.resume(sessionKey, clarification.id) })
      } catch {
        status = "ungradable"
        break
      }
    } else {
      store.supersede(sessionKey)
      messages.push({ role: "user", content: followUp })
    }
  }
  const scores = checkRun(item, turns, events)
  const record = {
    caseId: item.id,
    family: item.family,
    caseHash: digest(item),
    toolSchemaHash,
    status,
    turns,
    events,
    fixtureGaps: fixture.missing,
    providerFailures,
    scores,
    costUsd: null,
    humanOutcome: "pending"
  }
  assertSafeArtifact(record)
  return record
}

export type CaseResult = Awaited<ReturnType<typeof executeCase>>

export const caseResultSchema = z.object({
  caseId: z.string(),
  family: z.string(),
  caseHash: z.string(),
  toolSchemaHash: z.string(),
  status: z.enum(["completed", "agent-failure", "ungradable"]),
  turns: z.array(
    z.object({
      text: z.string(),
      termination: z.string(),
      durationMs: z.number(),
      firstTextMs: z.number().nullable(),
      inputTokens: z.number().nullable(),
      outputTokens: z.number().nullable(),
      responses: z.array(z.object({ id: z.string().optional(), modelId: z.string().optional() }))
    })
  ),
  events: z.array(
    z.object({
      turn: z.number(),
      step: z.number(),
      type: z.enum(["call", "result", "error"]),
      tool: z.string(),
      callId: z.string(),
      value: z.unknown()
    })
  ),
  fixtureGaps: z.array(z.object({ method: z.string(), input: z.unknown() })),
  providerFailures: z.array(z.unknown()).optional(),
  scores: z.array(z.object({ name: z.string(), value: z.number().nullable(), detail: z.string() })),
  costUsd: z.null(),
  humanOutcome: z.string()
})
