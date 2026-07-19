import { z } from "zod"
import { ASSIGNMENT_SCHEMA_VERSION } from "./assignment"

const GitCommitShaSchema = z.string().regex(/^[0-9a-f]{40}$/u, "Expected a full lowercase Git commit SHA")
const Sha256DigestSchema = z.string().regex(/^[0-9a-f]{64}$/u, "Expected a lowercase SHA-256 digest")
const IsoTimestampSchema = z.iso.datetime({ offset: true })
const RelativeArtifactPathSchema = z
  .string()
  .min(1)
  .refine((path) => !path.startsWith("/") && !path.includes("\\") && !/(^|\/)\.\.(\/|$)/u.test(path), {
    message: "Expected an artifact-relative POSIX path without parent traversal"
  })

export const ArtifactManifestEntrySchema = z
  .object({
    relativePath: RelativeArtifactPathSchema,
    mediaType: z.string().regex(/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/iu),
    byteLength: z.number().int().nonnegative(),
    sha256: Sha256DigestSchema
  })
  .strict()

export const ArtifactManifestSchema = z.array(ArtifactManifestEntrySchema)

export const CommandResultSchema = z
  .object({
    commandId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    exitCode: z.number().int().nullable(),
    stdoutArtifact: RelativeArtifactPathSchema,
    stderrArtifact: RelativeArtifactPathSchema,
    startedAt: IsoTimestampSchema,
    endedAt: IsoTimestampSchema,
    timedOut: z.boolean()
  })
  .strict()
  .superRefine((result, context) => {
    if (result.timedOut && result.exitCode !== null) {
      context.addIssue({
        code: "custom",
        message: "A timed-out command must have a null exit code",
        path: ["exitCode"]
      })
    }

    if (Date.parse(result.endedAt) < Date.parse(result.startedAt)) {
      context.addIssue({
        code: "custom",
        message: "Command end time must not precede its start time",
        path: ["endedAt"]
      })
    }
  })

export const WorkspaceHandleSchema = z
  .object({
    provider: z.literal("daytona"),
    workspaceId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u),
    lifecycleState: z.enum(["creating", "running", "stopped", "archived", "deleted", "failed"]),
    repositoryPath: z.string().startsWith("/"),
    agentServerUrlReference: z.string().min(1),
    conversationId: z.string().min(1).nullable(),
    createdAt: IsoTimestampSchema,
    lastActivityAt: IsoTimestampSchema,
    retentionUntil: IsoTimestampSchema,
    expiresAt: IsoTimestampSchema
  })
  .strict()

const WorkerMetricsSchema = z
  .object({
    elapsedMs: z.number().int().nonnegative(),
    turns: z.number().int().nonnegative().nullable(),
    promptTokens: z.number().int().nonnegative().nullable(),
    cachedPromptTokens: z.number().int().nonnegative().nullable(),
    completionTokens: z.number().int().nonnegative().nullable(),
    estimatedCostUsd: z.number().nonnegative().nullable()
  })
  .strict()

const WorkerFailureSchema = z
  .object({
    classification: z.enum([
      "authentication",
      "workspace_startup",
      "repository_preparation",
      "agent_server_startup",
      "model",
      "timeout",
      "policy_violation",
      "validation",
      "malformed_response",
      "cleanup",
      "cancelled",
      "internal"
    ]),
    message: z.string().trim().min(1),
    retryable: z.boolean()
  })
  .strict()

const WorkerResultBaseSchema = z
  .object({
    schemaVersion: z.literal(ASSIGNMENT_SCHEMA_VERSION),
    runId: z.uuid(),
    roleExecutionId: z.uuid(),
    workspace: WorkspaceHandleSchema,
    conversationId: z.string().min(1).nullable(),
    baseCommitSha: GitCommitShaSchema,
    resultingCommitSha: GitCommitShaSchema,
    changedFiles: z.array(RelativeArtifactPathSchema),
    patchArtifact: RelativeArtifactPathSchema.nullable(),
    validationResults: z.array(CommandResultSchema),
    metrics: WorkerMetricsSchema,
    artifacts: ArtifactManifestSchema
  })
  .strict()

export const WorkerResultSchema = z.discriminatedUnion("status", [
  WorkerResultBaseSchema.extend({
    status: z.literal("completed"),
    failure: z.null()
  }),
  WorkerResultBaseSchema.extend({
    status: z.enum(["blocked", "failed", "cancelled", "timed_out"]),
    failure: WorkerFailureSchema
  })
])

export type ArtifactManifest = z.infer<typeof ArtifactManifestSchema>
export type CommandResult = z.infer<typeof CommandResultSchema>
export type WorkerResult = z.infer<typeof WorkerResultSchema>
export type WorkspaceHandle = z.infer<typeof WorkspaceHandleSchema>
