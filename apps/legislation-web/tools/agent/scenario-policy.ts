import { z } from "zod"
import {
  clarificationRequestSchema,
  clarificationResponseSchemaFor,
  type ClarificationRequest
} from "../../src/modules/conversations/clarification"
import { responseOutcomeSchema } from "../../src/modules/conversations/responseOutcome"

const jurisdiction = z.enum([
  "U.S. federal",
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "District of Columbia",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming"
])
const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/)
const text = z.string().trim().min(1).max(2000)
const jurisdictions = z
  .array(jurisdiction)
  .min(1)
  .max(52)
  .refine((items) => new Set(items).size === items.length)

export const scenarioSchema = z
  .strictObject({
    id: identifier,
    objective: text,
    jurisdictions,
    acceptedNarrowing: z.strictObject({ jurisdictions, reason: text }).optional(),
    maximumExchanges: z.number().int().min(1).max(8),
    steps: z
      .array(
        z.strictObject({
          id: identifier,
          prompt: text,
          requiresRecordsFrom: z
            .strictObject({
              stepId: identifier,
              kind: z.string().trim().min(1).max(80),
              onMissingRecords: text.optional()
            })
            .optional()
        })
      )
      .min(1)
      .max(8),
    clarificationAnswers: z
      .array(
        z.discriminatedUnion("kind", [
          z.strictObject({
            question: text,
            kind: z.literal("jurisdiction"),
            jurisdictions,
            options: z
              .array(z.strictObject({ label: text, jurisdictions }))
              .max(12)
              .default([])
          }),
          z.strictObject({
            question: text,
            kind: z.literal("other"),
            optionLabels: z.array(text).max(12).default([]),
            text: z.string().trim().max(2000).default("")
          })
        ])
      )
      .max(8)
      .default([])
  })
  .superRefine((scenario, context) => {
    if (scenario.acceptedNarrowing?.jurisdictions.some((name) => !scenario.jurisdictions.includes(name))) {
      context.addIssue({
        code: "custom",
        path: ["acceptedNarrowing"],
        message: "Narrowing must use authored jurisdictions."
      })
    }
    const seen = new Set<string>()
    for (const [index, step] of scenario.steps.entries()) {
      if (seen.has(step.id) || (step.requiresRecordsFrom && !seen.has(step.requiresRecordsFrom.stepId))) {
        context.addIssue({
          code: "custom",
          path: ["steps", index],
          message: "Step IDs must be unique; dependencies must name an earlier step."
        })
      }
      seen.add(step.id)
    }
    const questions = scenario.clarificationAnswers.map((answer) => answer.question)
    if (new Set(questions).size !== questions.length) {
      context.addIssue({
        code: "custom",
        path: ["clarificationAnswers"],
        message: "Each exact question needs one authored answer."
      })
    }
  })
export type Scenario = z.infer<typeof scenarioSchema>

export const snapshotSchema = z
  .object({
    format: z.literal("rostra-conversation"),
    schemaVersion: z.literal(1),
    conversationId: z.string(),
    interactionStatus: z.string(),
    messages: z.array(
      z
        .object({
          id: z.string(),
          role: z.string(),
          parts: z.array(z.record(z.string(), z.unknown()))
        })
        .passthrough()
    ),
    responseOutcomes: z.array(responseOutcomeSchema.extend({ messageId: z.string() })),
    toolCalls: z.array(
      z
        .object({
          messageId: z.string(),
          toolCallId: z.string(),
          toolName: z.string(),
          state: z.string(),
          output: z.unknown().optional(),
          error: z.unknown().optional()
        })
        .passthrough()
    )
  })
  .passthrough()
export type Snapshot = z.infer<typeof snapshotSchema>
export type ObservedRecord = { id: string; kind: string; title: string }
export type StepProgress = {
  id: string
  selected: "primary" | "missing-records" | null
  executedRequestIds: string[]
  answered: boolean
  // Discovery receipts are not the assistant's selected research sample.
  records: ObservedRecord[]
}

export function approvedJurisdictions(scenario: Scenario) {
  return scenario.acceptedNarrowing?.jurisdictions ?? scenario.jurisdictions
}

export function selectStep(scenario: Scenario, index: number, progress: readonly StepProgress[]) {
  const step = scenario.steps[index]
  if (!step) {
    return { kind: "pause" as const, reason: "No authored step remains." }
  }
  if (index > 0 && !progress[index - 1]?.answered) {
    return { kind: "pause" as const, reason: "The preceding step has no delivered terminal answer." }
  }
  let prompt = step.prompt
  let branch: NonNullable<StepProgress["selected"]> = "primary"
  if (step.requiresRecordsFrom) {
    const dependency = step.requiresRecordsFrom
    const hasRecords =
      progress
        .find((entry) => entry.id === dependency.stepId)
        ?.records.some((record) => record.kind === dependency.kind) ?? false
    if (!hasRecords) {
      if (!dependency.onMissingRecords) {
        return {
          kind: "pause" as const,
          reason: `No ${dependency.kind} records were observed in ${dependency.stepId}; dependent question not submitted.`
        }
      }
      prompt = dependency.onMissingRecords
      branch = "missing-records"
    }
  }
  prompt += `\n\nApproved jurisdictions: ${approvedJurisdictions(scenario).join(", ")}.`
  return { kind: "submit" as const, branch, prompt }
}

export function selectClarification(
  scenario: Scenario,
  request: ClarificationRequest,
  answeredQuestions: ReadonlySet<string>
) {
  const rule = scenario.clarificationAnswers.find((answer) => answer.question === request.input.question)
  if (!rule) {
    return { kind: "pause" as const, reason: "No authored answer matches this exact clarification question." }
  }
  if (answeredQuestions.has(rule.question)) {
    return {
      kind: "pause" as const,
      reason: "The clarification question repeated; the driver will not repeat a generic answer."
    }
  }
  const input = request.input
  const options = input.kind === "text" ? [] : input.options
  let optionLabels: string[]
  let answerText: string
  if (rule.kind === "jurisdiction") {
    const approved = approvedJurisdictions(scenario)
    const states = approved.filter((name) => name !== "U.S. federal")
    const required = states.length ? states : approved
    if (
      rule.jurisdictions.some((name) => !approved.includes(name)) ||
      required.some((name) => !rule.jurisdictions.includes(name))
    ) {
      return {
        kind: "pause" as const,
        reason: "The structured jurisdiction choices must preserve the approved scope without adding jurisdictions."
      }
    }
    const mapped = rule.options.flatMap((option) => option.jurisdictions)
    if (
      rule.options.length &&
      (new Set(mapped).size !== mapped.length ||
        mapped.length !== rule.jurisdictions.length ||
        mapped.some((name) => !rule.jurisdictions.includes(name)) ||
        rule.options.some((option) => option.label !== option.jurisdictions.join(", ")))
    ) {
      return {
        kind: "pause" as const,
        reason: "Jurisdiction options must exactly name and cover the structured choices."
      }
    }
    optionLabels = rule.options.map((option) => option.label)
    answerText = rule.options.length ? "" : rule.jurisdictions.join(", ")
  } else {
    optionLabels = rule.optionLabels
    answerText = rule.text
  }
  const selectedIds: string[] = []
  for (const label of optionLabels) {
    const matches = options.filter((option) => option.label === label)
    if (matches.length !== 1) {
      return { kind: "pause" as const, reason: `Authored option is unavailable or ambiguous: ${label}` }
    }
    selectedIds.push(matches[0]!.id)
  }
  const response = clarificationResponseSchemaFor(request).safeParse({
    requestId: request.id,
    revision: request.revision,
    status: "answered",
    selectedIds,
    text: answerText
  })
  if (!response.success) {
    return { kind: "pause" as const, reason: "The authored answer does not satisfy the active clarification controls." }
  }
  return { kind: "answer" as const, response: response.data, optionLabels, text: answerText }
}

const requestBodySchema = z.object({
  action: z.string().optional(),
  clarificationId: z.uuid().optional(),
  response: z.object({ requestId: z.uuid() }).optional(),
  messages: z.array(z.unknown()).optional()
})
export function requestIdentity(body: unknown) {
  const parsed = requestBodySchema.safeParse(body)
  if (!parsed.success) {
    return { kind: "unknown" as const, action: null, clarificationId: null }
  }
  const { action, clarificationId, response, messages } = parsed.data
  if (action === "answer-clarification" && response) {
    return { kind: "confirmation" as const, action, clarificationId: response.requestId }
  }
  if (action !== undefined) {
    return { kind: "auxiliary" as const, action: "other", clarificationId: null }
  }
  if (messages && clarificationId) {
    return { kind: "resume" as const, action: null, clarificationId }
  }
  return { kind: messages ? ("generation" as const) : ("unknown" as const), action: null, clarificationId: null }
}

export type RequestObservation = ReturnType<typeof requestIdentity> & {
  id: string
  serverRequestId: string | null
  status: number | null
  terminal: "finished" | "failed" | null
  failure: string | null
}

export function summarizeExchange(
  requests: readonly RequestObservation[],
  outcome: z.infer<typeof responseOutcomeSchema> | undefined
) {
  const confirmations = requests.filter((request) => request.kind === "confirmation")
  const generations = requests.filter((request) => request.kind === "generation" || request.kind === "resume")
  const confirmation = confirmations[0]
  const resumed = generations[0]
  const isExpectedPair =
    confirmations.length === 1 &&
    generations.length === 1 &&
    confirmation?.terminal === "finished" &&
    confirmation.status !== null &&
    confirmation.status >= 200 &&
    confirmation.status < 300 &&
    resumed?.kind === "resume" &&
    resumed.clarificationId === confirmation.clarificationId
  let requestPattern = "unattributed"
  if (isExpectedPair) {
    requestPattern = "confirmation-resume"
  } else if (generations.length > 1) {
    requestPattern = "multiple-generation-requests-observed"
  } else if (generations.length === 1 && confirmations.length === 0 && resumed?.kind === "generation") {
    requestPattern = "single-generation"
  }
  return {
    requestPattern,
    generationRequestIds: generations.map((request) => request.id),
    transportObservations: requests
      .filter((request) => request.terminal === "failed" || (request.status !== null && request.status >= 400))
      .map((request) => ({
        requestId: request.id,
        status: request.status,
        terminal: request.terminal,
        failure: request.failure
      })),
    delivery: outcome?.status ?? "unknown",
    answered: outcome?.status === "completed" && outcome.hasAnswer && outcome.pendingToolCalls.length === 0,
    hasAnswer: outcome?.hasAnswer ?? null,
    failedToolCalls: outcome?.failedToolCalls ?? null,
    pendingToolCalls: outcome?.pendingToolCalls ?? null,
    assessment: "unassessed" as const
  }
}

export function inspectSnapshot(snapshot: Snapshot, previousMessageIds: ReadonlySet<string>) {
  const messages = snapshot.messages.filter(
    (message) => message.role === "assistant" && !previousMessageIds.has(message.id)
  )
  const last = messages.at(-1)
  const outcome = snapshot.responseOutcomes.find((entry) => entry.messageId === last?.id)
  const clarification = last?.parts
    .flatMap((part) => {
      if (part.type !== "dynamic-tool" || part.toolName !== "ask_clarification" || part.state !== "output-available") {
        return []
      }
      const parsed = z.object({ clarification: clarificationRequestSchema }).safeParse(part.output)
      return parsed.success && parsed.data.clarification.state === "pending" ? [parsed.data.clarification] : []
    })
    .at(-1)
  const calls = snapshot.toolCalls.filter((call) => messages.some((message) => message.id === call.messageId))
  const records = new Map<string, ObservedRecord>()
  const evidenceCandidates: { messageId: string; toolCallId: string; evidenceIds: string[] }[] = []
  const resultSchema = z.object({
    success: z.boolean().optional(),
    ok: z.boolean().optional(),
    isError: z.boolean().optional(),
    error: z.unknown().optional(),
    resultSet: z
      .object({ items: z.array(z.object({ id: z.string(), kind: z.string(), title: z.string() })) })
      .optional(),
    evidence: z.array(z.object({ id: z.string() })).optional()
  })
  for (const call of calls) {
    if (call.toolName === "ask_clarification" || call.state !== "output-available" || call.error) {
      continue
    }
    const result = resultSchema.safeParse(call.output)
    if (
      !result.success ||
      result.data.success === false ||
      result.data.ok === false ||
      result.data.isError === true ||
      result.data.error
    ) {
      continue
    }
    for (const record of result.data.resultSet?.items ?? []) {
      records.set(`${record.kind}:${record.id}`, record)
    }
    if (result.data.evidence?.length) {
      evidenceCandidates.push({
        messageId: call.messageId,
        toolCallId: call.toolCallId,
        evidenceIds: result.data.evidence.map((entry) => entry.id)
      })
    }
  }
  return {
    messages,
    messageIds: messages.map((message) => message.id),
    outcome,
    clarification,
    calls,
    records: [...records.values()],
    evidenceCandidates
  }
}

export function scenarioCoverage(scenario: Scenario, progress: readonly StepProgress[]) {
  return {
    planned: scenario.steps.map((step) => step.id),
    selected: progress
      .filter((step) => step.selected !== null)
      .map((step) => ({ stepId: step.id, branch: step.selected })),
    executed: progress
      .filter((step) => step.executedRequestIds.length)
      .map((step) => ({
        stepId: step.id,
        branch: step.selected,
        requestIds: step.executedRequestIds
      })),
    answered: progress.filter((step) => step.answered).map((step) => ({ stepId: step.id, branch: step.selected })),
    unassessed: scenario.steps.map((step) => step.id),
    note: "Answered means a delivered terminal response, not a verified research objective or useful evidence chain."
  }
}
