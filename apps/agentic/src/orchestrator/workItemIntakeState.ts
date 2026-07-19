import { createHash } from "node:crypto"
import { z } from "zod"
import { LinearCandidateListSchema } from "../contracts/linear"
import { PlanningResultSchema, PromptVersionSchema } from "../contracts/specialized"

export const WORK_ITEM_INTAKE_SCHEMA_VERSION = "1" as const

const GitCommitShaSchema = z.string().regex(/^[0-9a-f]{40}$/u, "Expected a full lowercase Git commit SHA")
const Sha256DigestSchema = z.string().regex(/^[0-9a-f]{64}$/u, "Expected a lowercase SHA-256 digest")
const IsoTimestampSchema = z.iso.datetime({ offset: true })

export const WorkItemIntakeRequestSchema = z
  .object({
    schemaVersion: z.literal(WORK_ITEM_INTAKE_SCHEMA_VERSION),
    runId: z.uuid(),
    team: z.string().trim().min(1),
    repository: z
      .object({
        provider: z.literal("github"),
        owner: z.string().trim().min(1),
        name: z.string().trim().min(1)
      })
      .strict()
  })
  .strict()

export const WorkItemIntakeFailureSchema = z
  .object({
    node: z.enum(["fetchLinearCandidates", "resolveBaseCommit", "runScrumMaster", "validatePlan"]),
    classification: z.enum(["linear", "repository", "model", "malformed_response", "validation", "cancelled"]),
    message: z.string().trim().min(1),
    retryable: z.boolean()
  })
  .strict()

export const WorkItemIntakeEventSchema = z
  .object({
    node: WorkItemIntakeFailureSchema.shape.node,
    outcome: z.enum(["completed", "failed", "skipped"]),
    at: IsoTimestampSchema,
    summary: z.string().trim().min(1)
  })
  .strict()

export const WorkItemIntakeStateSchema = z
  .object({
    schemaVersion: z.literal(WORK_ITEM_INTAKE_SCHEMA_VERSION),
    runId: z.uuid(),
    requestDigest: Sha256DigestSchema,
    request: WorkItemIntakeRequestSchema,
    phase: z.enum(["initialized", "candidates_fetched", "base_resolved", "planned", "ready", "blocked", "failed"]),
    candidates: LinearCandidateListSchema.nullable(),
    baseCommitSha: GitCommitShaSchema.nullable(),
    prompt: PromptVersionSchema.nullable(),
    planningResult: PlanningResultSchema.nullable(),
    rawScrumMasterResponse: z.string().nullable(),
    terminalStatus: z.enum(["running", "ready", "blocked", "failed"]),
    failure: WorkItemIntakeFailureSchema.nullable(),
    events: z.array(WorkItemIntakeEventSchema)
  })
  .strict()
  .superRefine((state, context) => {
    if (state.runId !== state.request.runId) {
      context.addIssue({ code: "custom", message: "Intake run ID must match the request run ID", path: ["runId"] })
    }
  })

export type WorkItemIntakeRequest = z.infer<typeof WorkItemIntakeRequestSchema>
export type WorkItemIntakeFailure = z.infer<typeof WorkItemIntakeFailureSchema>
export type WorkItemIntakeEvent = z.infer<typeof WorkItemIntakeEventSchema>
export type WorkItemIntakeState = z.infer<typeof WorkItemIntakeStateSchema>

export function workItemIntakeRequestDigest(requestInput: WorkItemIntakeRequest): string {
  return createHash("sha256")
    .update(JSON.stringify(WorkItemIntakeRequestSchema.parse(requestInput)))
    .digest("hex")
}

export function createInitialWorkItemIntakeState(requestInput: WorkItemIntakeRequest): WorkItemIntakeState {
  const request = WorkItemIntakeRequestSchema.parse(requestInput)
  return WorkItemIntakeStateSchema.parse({
    schemaVersion: WORK_ITEM_INTAKE_SCHEMA_VERSION,
    runId: request.runId,
    requestDigest: workItemIntakeRequestDigest(request),
    request,
    phase: "initialized",
    candidates: null,
    baseCommitSha: null,
    prompt: null,
    planningResult: null,
    rawScrumMasterResponse: null,
    terminalStatus: "running",
    failure: null,
    events: []
  })
}
