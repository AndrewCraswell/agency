import { createHash } from "node:crypto"
import { z } from "zod"

export const EXECUTION_CONTRACT_VERSION = "1" as const

const DigestSchema = z.string().regex(/^[0-9a-f]{64}$/u)
const IdentifierSchema = z.string().trim().min(1)
const JsonPrimitiveSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()])
export type JsonValue = z.infer<typeof JsonPrimitiveSchema> | JsonValue[] | { [key: string]: JsonValue }
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([JsonPrimitiveSchema, z.array(JsonValueSchema), z.record(z.string(), JsonValueSchema)])
)

export const WorkflowArtifactReferenceSchema = z
  .object({
    artifactId: DigestSchema,
    kind: IdentifierSchema,
    mediaType: z.string().trim().min(1),
    sha256: DigestSchema,
    byteLength: z.number().int().nonnegative(),
    producerActivationId: DigestSchema,
    producerAttemptId: IdentifierSchema,
    classification: z.enum(["internal", "sensitive"])
  })
  .strict()

export const WorkflowRunStatusSchema = z.enum([
  "preparing",
  "runnable",
  "running",
  "waiting",
  "succeeded",
  "failed",
  "cancelled",
  "abandoned"
])

export const WorkflowActivationStatusSchema = z.enum([
  "blocked",
  "ready",
  "leased",
  "running",
  "waiting",
  "succeeded",
  "failed",
  "cancelled"
])

export const WorkflowAttemptStatusSchema = z.enum([
  "queued",
  "running",
  "waiting",
  "succeeded",
  "failed",
  "cancelled",
  "unknown"
])

export const WorkflowDatumKindSchema = z.enum([
  "value",
  "artifact",
  "external_reference",
  "observation",
  "secret_capability"
])

export const WorkflowEffectStatusSchema = z.enum([
  "prepared",
  "dispatching",
  "confirmed",
  "unknown",
  "conflict",
  "failed",
  "resolved"
])

export const WorkflowWaitStatusSchema = z.enum(["pending", "claimed", "resumed", "timed_out", "cancelled"])

export const ActivationScopeSegmentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("branch"), key: IdentifierSchema }).strict(),
  z.object({ kind: z.literal("loop"), key: IdentifierSchema, iteration: z.number().int().nonnegative() }).strict(),
  z.object({ kind: z.literal("item"), key: IdentifierSchema }).strict()
])

export const ActivationIdentityInputSchema = z
  .object({
    runId: z.uuid(),
    stepId: IdentifierSchema,
    scope: z.array(ActivationScopeSegmentSchema).default([])
  })
  .strict()

export const StepDefinitionSchema = z
  .object({
    kind: IdentifierSchema,
    version: z.number().int().positive(),
    executorDigest: DigestSchema,
    configSchema: JsonValueSchema,
    inputSchema: JsonValueSchema,
    outputSchema: JsonValueSchema,
    errorSchema: JsonValueSchema,
    executionClass: z.enum(["control", "provider", "model", "workspace"]),
    mutationPolicy: z.enum(["none", "external_effect"]),
    capabilities: z.array(IdentifierSchema)
  })
  .strict()

export const ExecutionPackageContentSchema = z
  .object({
    schemaVersion: z.literal(EXECUTION_CONTRACT_VERSION),
    workflowId: z.uuid(),
    source: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("published"), version: z.number().int().positive() }).strict(),
      z.object({ kind: z.literal("draft_test"), draftRevision: z.number().int().positive() }).strict()
    ]),
    compilerVersion: IdentifierSchema,
    mappingExpressionVersion: IdentifierSchema,
    eventDecoderVersions: z.record(IdentifierSchema, IdentifierSchema),
    graph: JsonValueSchema,
    stepDefinitions: z.array(StepDefinitionSchema),
    constants: z.record(z.string(), JsonValueSchema),
    resourceReferences: z.array(JsonValueSchema),
    agentSnapshots: z.array(JsonValueSchema),
    modelSnapshots: z.array(JsonValueSchema)
  })
  .strict()

function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`
  }
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`
}

function digestJson(value: JsonValue): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex")
}

export function jsonValueDigest(input: unknown): string {
  return digestJson(JsonValueSchema.parse(input))
}

export function deterministicActivationId(input: z.input<typeof ActivationIdentityInputSchema>): string {
  return digestJson(ActivationIdentityInputSchema.parse(input))
}

export function executionPackageDigest(input: z.input<typeof ExecutionPackageContentSchema>): string {
  return digestJson(ExecutionPackageContentSchema.parse(input))
}

export type ActivationScopeSegment = z.infer<typeof ActivationScopeSegmentSchema>
export type ExecutionPackageContent = z.infer<typeof ExecutionPackageContentSchema>
