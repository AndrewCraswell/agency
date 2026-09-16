import { createHash } from "node:crypto"
import { z } from "zod"

const identifier = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,99}$/)
export const caseSchema = z.strictObject({
  id: identifier,
  family: identifier,
  tags: z.array(z.string()).min(1),
  review: z.enum(["draft", "reviewed"]),
  provenance: z.enum(["synthetic", "source-captured", "reviewed-public"]),
  reference: z.string().min(1),
  messages: z.array(z.strictObject({ role: z.enum(["user", "assistant"]), content: z.string().min(1) })).min(1),
  followUps: z.array(z.string().min(1)).max(4).default([]),
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
          promptVersion: z.number().int().positive()
        })
      )
      .min(1)
      .max(8),
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
