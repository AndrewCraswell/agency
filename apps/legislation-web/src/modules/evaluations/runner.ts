import { propagateAttributes, startActiveObservation } from "@langfuse/tracing"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { createLegislationResearchTools } from "@repo/legislation-core/research/tools"
import type { LanguageModel, LanguageModelUsage, ModelMessage } from "ai"
import { z } from "zod"
import { runResearchAgent } from "../conversations/agent"
import { clarificationRequestSchema } from "../conversations/clarification"
import { createClarificationStore } from "../conversations/clarificationStore"
import { createClarificationTool } from "../conversations/clarificationTool"
import { createCitationPresentation } from "../conversations/components/citationPresentation"
import { redactCredentials } from "../conversations/redactCredentials"
import { createResearchTools } from "../conversations/research"
import { ResearchFailure } from "../conversations/researchFailure"
import { checkRun } from "./checks"
import {
  assertSafeArtifact,
  canonicalJson,
  caseSchema,
  digest,
  evalTurnSchema,
  type EvalCase,
  type EvalEvent
} from "./contracts"
import { createFixtureService } from "./fixtures"
import { providerFailure } from "./providerRecovery"

type RecordedTurn = z.infer<typeof evalTurnSchema>

function usageCounters(usage?: LanguageModelUsage) {
  return {
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    totalTokens: usage?.totalTokens ?? null,
    inputTokenDetails: {
      noCacheTokens: usage?.inputTokenDetails.noCacheTokens ?? null,
      cacheReadTokens: usage?.inputTokenDetails.cacheReadTokens ?? null,
      cacheWriteTokens: usage?.inputTokenDetails.cacheWriteTokens ?? null
    },
    outputTokenDetails: {
      textTokens: usage?.outputTokenDetails.textTokens ?? null,
      reasoningTokens: usage?.outputTokenDetails.reasoningTokens ?? null
    }
  }
}

function knownSum(values: (number | null)[]) {
  if (values.length === 0 || values.some((value) => value === null)) {
    return null
  }
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
}

function totalUsage(responses: RecordedTurn["responses"]) {
  return {
    inputTokens: knownSum(responses.map((response) => response.inputTokens)),
    outputTokens: knownSum(responses.map((response) => response.outputTokens)),
    totalTokens: knownSum(responses.map((response) => response.totalTokens)),
    inputTokenDetails: {
      noCacheTokens: knownSum(responses.map((response) => response.inputTokenDetails.noCacheTokens)),
      cacheReadTokens: knownSum(responses.map((response) => response.inputTokenDetails.cacheReadTokens)),
      cacheWriteTokens: knownSum(responses.map((response) => response.inputTokenDetails.cacheWriteTokens))
    },
    outputTokenDetails: {
      textTokens: knownSum(responses.map((response) => response.outputTokenDetails.textTokens)),
      reasoningTokens: knownSum(responses.map((response) => response.outputTokenDetails.reasoningTokens))
    }
  }
}

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
  sessionId?: string
  model: LanguageModel
  instructions: string
  budget: ReturnType<typeof createCallBudget>
  signal: AbortSignal
}) {
  assertSafeArtifact({ item: options.item, instructions: options.instructions })
  const item = caseSchema.parse(options.item)
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
  const sessionKey = options.sessionId ?? crypto.randomUUID()
  const messages: ModelMessage[] = structuredClone(item.messages)
  const turns: RecordedTurn[] = []
  const events: EvalEvent[] = []
  const followUpFailures: { turn: number; detail: string }[] = []
  let status: "completed" | "agent-failure" | "ungradable" = "completed"
  const providerFailures: ReturnType<typeof providerFailure>[] = []
  for (let turn = 0; turn <= item.followUps.length; turn++) {
    const completedTurn = await propagateAttributes({ sessionId: sessionKey }, () =>
      startActiveObservation(
        "legislative-research-evaluation-turn",
        async (observation) => {
          const turnCriteria = item.turnCriteria?.find((entry) => entry.turn === turn)?.criteria ?? []
          observation.update({
            input: { messages: structuredClone(messages), instructions: options.instructions, turnCriteria },
            metadata: { caseId: item.id, turn, turnCriteria }
          })
          const signal = options.signal
          let pending = false
          let step = 0
          let text = ""
          let termination = "incomplete"
          let firstTextMs: number | null = null
          const responses: RecordedTurn["responses"] = []
          const started = performance.now()
          const previousCitationReferences = messages
            .filter((message) => message.role === "assistant")
            .flatMap((message) => {
              const text =
                typeof message.content === "string"
                  ? message.content
                  : message.content
                      .filter((part) => part.type === "text")
                      .map((part) => part.text)
                      .join("\n")
              return createCitationPresentation("history", text, []).missingReferences
            })
          const tools = await createResearchTools(
            { NODE_ENV: "development" },
            signal,
            () => !pending,
            () => undefined,
            undefined,
            fixture.service,
            undefined,
            undefined,
            previousCitationReferences
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
                step++
                responses.push({ step, generationId: null, providerMetadata: null, costUsd: null, ...usageCounters() })
                return undefined
              }
            })
            for await (const chunk of result.stream) {
              if (chunk.type === "text-delta") {
                firstTextMs ??= Math.round(performance.now() - started)
                text += chunk.text
              } else if (chunk.type === "tool-call" || chunk.type === "tool-result" || chunk.type === "tool-error") {
                let type: EvalEvent["type"] = "error"
                let value: unknown = { message: null, code: null, reference: null }
                if (chunk.type === "tool-call") {
                  type = "call"
                  value = chunk.input
                } else if (chunk.type === "tool-result") {
                  type = "result"
                  value = chunk.output
                } else if (chunk.error instanceof ResearchFailure) {
                  value = {
                    message: chunk.error.toString(),
                    code: chunk.error.code,
                    reference: chunk.error.reference
                  }
                }
                events.push({ turn, step, type, tool: chunk.toolName, callId: chunk.toolCallId, value })
              } else if (chunk.type === "finish-step") {
                const cost = z
                  .object({ usage: z.object({ cost: z.number().nonnegative() }) })
                  .safeParse(chunk.providerMetadata?.openrouter)
                responses[step - 1] = {
                  step,
                  id: chunk.response.id,
                  generationId: chunk.response.id?.startsWith("gen-") ? chunk.response.id : null,
                  modelId: chunk.response.modelId,
                  providerMetadata: evalTurnSchema.shape.responses.element.shape.providerMetadata.parse(
                    JSON.parse(canonicalJson(redactCredentials(chunk.providerMetadata)))
                  ),
                  costUsd: cost.success ? cost.data.usage.cost : null,
                  ...usageCounters(chunk.usage)
                }
              } else if (chunk.type === "finish") {
                termination = chunk.finishReason
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
          const outcome: RecordedTurn = {
            text,
            termination,
            durationMs: Math.round(performance.now() - started),
            firstTextMs,
            traceId: observation.traceId,
            observationId: observation.id,
            ...totalUsage(responses),
            responses
          }
          const output = { ...outcome, events: events.filter((event) => event.turn === turn), turnCriteria }
          assertSafeArtifact(output)
          observation.update({ output, level: termination === "error" ? "ERROR" : "DEFAULT" })
          return outcome
        },
        { asType: "agent" }
      )
    )
    turns.push(completedTurn)
    const { text, termination } = completedTurn
    if (fixture.missing.length) {
      status = "ungradable"
      break
    }
    if (options.signal.aborted || options.budget.blocked) {
      status = "ungradable"
      break
    }
    if (termination !== "stop" && termination !== "clarification") {
      status = "agent-failure"
      break
    }
    const followUp = item.followUps[turn]
    if (followUp === undefined) {
      break
    }
    try {
      const clarification = events
        .filter((event) => event.turn === turn && event.type === "result" && event.tool === "ask_clarification")
        .map((event) => z.object({ clarification: clarificationRequestSchema }).parse(event.value).clarification)
        .at(-1)
      messages.push({ role: "assistant", content: text || clarification?.input.question || "" })
      if (typeof followUp !== "string" || (clarification && followUp === "[skip]")) {
        if (!clarification) {
          throw new Error("A structured clarification response requires a pending question.")
        }
        const response = typeof followUp === "string" ? { status: "skipped" as const } : followUp
        store.answer(sessionKey, { ...response, requestId: clarification.id, revision: clarification.revision })
        messages.push({ role: "user", content: store.resume(sessionKey, clarification.id) })
      } else {
        store.supersede(sessionKey)
        messages.push({ role: "user", content: followUp })
      }
    } catch {
      followUpFailures.push({ turn: turn + 1, detail: "The clarification response does not match a pending question." })
      status = "ungradable"
      break
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
    followUpFailures,
    providerFailures,
    scores,
    costUsd: knownSum(turns.flatMap((turn) => turn.responses.map((response) => response.costUsd))),
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
  turns: z.array(evalTurnSchema),
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
  followUpFailures: z.array(z.object({ turn: z.number().int().positive(), detail: z.string() })),
  providerFailures: z.array(z.unknown()).optional(),
  scores: z.array(z.object({ name: z.string(), value: z.number().nullable(), detail: z.string() })),
  costUsd: z.number().nonnegative().nullable(),
  humanOutcome: z.string()
})
