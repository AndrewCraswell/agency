import { createHash } from "node:crypto"
import { z } from "zod"
import { AssignmentSchema, type Assignment } from "../contracts/assignment"
import { WorkerResultSchema } from "../contracts/results"

export const WORKFLOW_SCHEMA_VERSION = "1" as const

const GitCommitShaSchema = z.string().regex(/^[0-9a-f]{40}$/u, "Expected a full lowercase Git commit SHA")
const Sha256DigestSchema = z.string().regex(/^[0-9a-f]{64}$/u, "Expected a lowercase SHA-256 digest")
const IsoTimestampSchema = z.iso.datetime({ offset: true })

export const ValidationResultSchema = z
  .object({
    disposition: z.enum(["publishable", "failed"]),
    reasons: z.array(z.string().trim().min(1)),
    checkedAt: IsoTimestampSchema
  })
  .strict()

export const PublicationResultSchema = z
  .object({
    branch: z.string().regex(/^agent\/[0-9a-f-]+$/u),
    pullRequestNumber: z.number().int().positive(),
    pullRequestUrl: z.url(),
    headCommitSha: GitCommitShaSchema,
    updatedExisting: z.boolean()
  })
  .strict()

export const GraphFailureSchema = z
  .object({
    node: z.enum([
      "prepareAssignment",
      "provisionWorkspace",
      "runCoder",
      "validateResult",
      "publishDraftPr",
      "recordFailure",
      "stopWorkspace"
    ]),
    classification: z.enum(["assignment", "worker", "validation", "publication", "cleanup", "cancelled", "internal"]),
    message: z.string().trim().min(1),
    retryable: z.boolean()
  })
  .strict()

export const GraphEventSchema = z
  .object({
    node: GraphFailureSchema.shape.node,
    outcome: z.enum(["started", "completed", "failed", "skipped"]),
    at: IsoTimestampSchema,
    summary: z.string().trim().min(1)
  })
  .strict()

export const WorkflowStateSchema = z
  .object({
    schemaVersion: z.literal(WORKFLOW_SCHEMA_VERSION),
    runId: z.uuid(),
    assignmentDigest: Sha256DigestSchema,
    assignment: AssignmentSchema,
    phase: z.enum([
      "initialized",
      "prepared",
      "running",
      "validated",
      "published",
      "failed",
      "cancelled",
      "cleaned_up"
    ]),
    workerResult: WorkerResultSchema.nullable(),
    validationResult: ValidationResultSchema.nullable(),
    publicationResult: PublicationResultSchema.nullable(),
    terminalStatus: z.enum(["running", "published", "failed", "cancelled"]),
    failure: GraphFailureSchema.nullable(),
    cleanupFailure: GraphFailureSchema.nullable(),
    events: z.array(GraphEventSchema),
    artifactReferences: z.array(z.string().trim().min(1))
  })
  .strict()
  .superRefine((state, context) => {
    if (state.runId !== state.assignment.runId) {
      context.addIssue({
        code: "custom",
        message: "Graph run ID must match the assignment run ID",
        path: ["runId"]
      })
    }
  })

export type ValidationResult = z.infer<typeof ValidationResultSchema>
export type PublicationResult = z.infer<typeof PublicationResultSchema>
export type GraphFailure = z.infer<typeof GraphFailureSchema>
export type GraphEvent = z.infer<typeof GraphEventSchema>
export type WorkflowState = z.infer<typeof WorkflowStateSchema>

export function assignmentDigest(assignment: Assignment): string {
  return createHash("sha256")
    .update(JSON.stringify(AssignmentSchema.parse(assignment)))
    .digest("hex")
}

export function createInitialGraphState(assignmentInput: Assignment): WorkflowState {
  const assignment = AssignmentSchema.parse(assignmentInput)
  return WorkflowStateSchema.parse({
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    runId: assignment.runId,
    assignmentDigest: assignmentDigest(assignment),
    assignment,
    phase: "initialized",
    workerResult: null,
    validationResult: null,
    publicationResult: null,
    terminalStatus: "running",
    failure: null,
    cleanupFailure: null,
    events: [],
    artifactReferences: []
  })
}

export function roundTripGraphState(state: WorkflowState): WorkflowState {
  return WorkflowStateSchema.parse(JSON.parse(JSON.stringify(state)))
}
