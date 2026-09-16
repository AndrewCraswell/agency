import { createHash } from "node:crypto"
import { z } from "zod"
import { clarificationResponseSchema } from "../lib/clarification"

const identifier = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,99}$/)
const followUpSchema = z.union([
  z.string().min(1),
  clarificationResponseSchema.options[0].omit({ requestId: true, revision: true }),
  clarificationResponseSchema.options[1].omit({ requestId: true, revision: true })
])
const turnCriteriaSchema = z.strictObject({
  turn: z.number().int().min(0).max(4),
  criteria: z.array(z.string().trim().min(1)).min(1)
})
const reasoningFlags = { enabled: z.boolean().optional(), exclude: z.boolean().optional() }
const reasoningSchema = z.union([
  z.strictObject({ ...reasoningFlags, effort: z.enum(["xhigh", "high", "medium", "low", "minimal", "none"]) }),
  z.strictObject({ ...reasoningFlags, max_tokens: z.number().int().positive() })
])

export const caseSchema = z
  .strictObject({
    id: identifier,
    family: identifier,
    tags: z.array(z.string()).min(1),
    review: z.enum(["draft", "reviewed"]),
    provenance: z.enum(["synthetic", "source-captured", "reviewed-public"]),
    reference: z.string().min(1),
    messages: z.array(z.strictObject({ role: z.enum(["user", "assistant"]), content: z.string().min(1) })).min(1),
    followUps: z.array(followUpSchema).max(4).default([]),
    turnCriteria: z.array(turnCriteriaSchema).max(5).optional(),
    fixtures: z.array(
      z.strictObject({
        method: z.string().min(1),
        input: z.record(z.string(), z.json()),
        output: z.json()
      })
    ),
    expected: z.strictObject({
      terminal: z.enum(["answer", "clarification"]),
      requiresCitation: z.boolean(),
      noResearch: z.boolean().default(false),
      requiredText: z.array(z.string()).default([]),
      forbiddenText: z.array(z.string()).default([])
    })
  })
  .superRefine((item, context) => {
    const turns = item.turnCriteria?.map((entry) => entry.turn) ?? []
    if (new Set(turns).size !== turns.length || turns.some((turn) => turn > item.followUps.length)) {
      context.addIssue({
        code: "custom",
        path: ["turnCriteria"],
        message: "Turn criteria must name unique runnable turns."
      })
    }
  })

export const datasetSchema = z
  .strictObject({
    name: z.string().regex(/^legislative-research\/[a-z0-9-]+$/),
    cases: z.array(caseSchema).min(1)
  })
  .superRefine((dataset, context) => {
    if (new Set(dataset.cases.map((item) => item.id)).size !== dataset.cases.length) {
      context.addIssue({ code: "custom", message: "Dataset case IDs must be unique." })
    }
  })

export const experimentSchema = z
  .strictObject({
    candidates: z
      .array(
        z.strictObject({
          id: identifier,
          model: z.string().min(1),
          promptVersion: z.number().int().positive(),
          provider: z.strictObject({ only: z.array(z.string().trim().min(1)).min(1) }).optional(),
          reasoning: reasoningSchema.nullable().optional()
        })
      )
      .min(1)
      .max(16),
    repeats: z.number().int().min(1).max(10),
    maximumModelCalls: z.number().int().min(1).max(10000),
    maximumInputCharacters: z.number().int().min(1000).max(1000000),
    evaluatorModel: z.string().min(1),
    evaluate: z.boolean(),
    allowDrafts: z.boolean().default(false)
  })
  .superRefine((config, context) => {
    if (new Set(config.candidates.map((item) => item.id)).size !== config.candidates.length) {
      context.addIssue({ code: "custom", message: "Candidate IDs must be unique." })
    }
  })

export type EvalCase = z.infer<typeof caseSchema>
export type EvalEvent = {
  turn: number
  step: number
  type: "call" | "result" | "error"
  tool: string
  callId: string
  value: unknown
}
const tokenCount = z.number().int().nonnegative().nullable()
const usageFields = {
  inputTokens: tokenCount,
  outputTokens: tokenCount,
  totalTokens: tokenCount,
  inputTokenDetails: z.object({ noCacheTokens: tokenCount, cacheReadTokens: tokenCount, cacheWriteTokens: tokenCount }),
  outputTokenDetails: z.object({ textTokens: tokenCount, reasoningTokens: tokenCount })
}
export const evalTurnSchema = z.object({
  text: z.string(),
  termination: z.string(),
  durationMs: z.number(),
  firstTextMs: z.number().nullable(),
  traceId: z.string(),
  observationId: z.string(),
  ...usageFields,
  responses: z.array(
    z.object({
      step: z.number().int().positive(),
      id: z.string().optional(),
      generationId: z.string().nullable(),
      modelId: z.string().optional(),
      providerMetadata: z.record(z.string(), z.record(z.string(), z.json())).nullable(),
      costUsd: z.number().nonnegative().nullable(),
      ...usageFields
    })
  )
})
export type EvalTurn = {
  text: string
  termination: string
  durationMs: number
  firstTextMs: number | null
  inputTokens: number | null
  outputTokens: number | null
  responses: { id?: string; modelId?: string }[]
}
export type EvalScore = { name: string; value: number | null; detail: string }

export function canonicalJson(value: unknown): string {
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString())
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`
  }
  return JSON.stringify(value) ?? "null"
}

export function digest(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex")
}

export function assertSafeArtifact(value: unknown) {
  const text = canonicalJson(value)
  if (/sk-or-v1-[a-z0-9]{16,}|sk-lf-[a-z0-9-]{16,}|Bearer\s+\S+|Basic\s+[a-z0-9+/=]{16,}/i.test(text)) {
    throw new Error("Evaluation artifact contains a credential pattern; remove it before capture.")
  }
  function visit(item: unknown): void {
    if (typeof item === "string" && /^https?:\/\//i.test(item)) {
      const url = new URL(item)
      if (
        url.username ||
        url.password ||
        [...url.searchParams.keys()].some((key) => /token|secret|signature|api.?key|^sig$/i.test(key))
      ) {
        throw new Error("Evaluation artifact contains an unsafe URL.")
      }
    }
    if (Array.isArray(item)) {
      item.forEach(visit)
    } else if (item !== null && typeof item === "object") {
      for (const [key, child] of Object.entries(item)) {
        if (/^(authorization|password|secret|api.?key)$/i.test(key)) {
          throw new Error("Unsafe evaluation field.")
        }
        visit(child)
      }
    }
  }
  visit(value)
}
