import { createHash } from "node:crypto"
import { z } from "zod"
import { AssignmentSchema } from "../contracts/assignment"
import type { WorkerResult } from "../contracts/results"
import { OPENHANDS_AGENT_SERVER_IMAGE } from "../openhands/profiles"
import type { WorkflowStepInstance } from "./definition"
import { JsonValueSchema, jsonValueDigest, type JsonValue } from "./executionContracts"
import { RepositoryAgentSnapshotSchema, type RepositoryAgentSnapshot } from "./repositoryAgents"

const JsonObjectSchema = z.record(z.string(), JsonValueSchema)
const ValidationCommandConfigSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    command: z.string().trim().min(1),
    workingDirectory: z.string().trim().min(1),
    timeoutMs: z.number().int().positive().max(3_600_000)
  })
  .strict()
const RepositoryAgentExecutionConfigSchema = z
  .object({
    agentReference: RepositoryAgentSnapshotSchema.shape.reference,
    instructions: z.string().trim().min(1).max(20_000).optional(),
    validationCommands: z.array(ValidationCommandConfigSchema).min(1).max(20),
    allowedPaths: z.array(z.string().trim().min(1)).min(1).max(100),
    forbiddenPaths: z.array(z.string().trim().min(1)).max(100),
    budgets: z
      .object({
        maxTurns: z.number().int().min(1).max(200),
        maxTokens: z.number().int().min(1_000).max(1_000_000),
        maxElapsedMs: z.number().int().min(60_000).max(3_600_000)
      })
      .strict()
  })
  .strict()

export type RepositoryAgentRunInput = {
  runId: string
  activationId: string
  attemptOrdinal: number
  step: WorkflowStepInstance
  input: Record<string, JsonValue>
  snapshots: JsonValue[]
}

export type RepositoryAgentWorker = (options: {
  assignment: z.infer<typeof AssignmentSchema>
  approvedRepository: string
  systemPrompt: string
  artifactPrefix: string
}) => Promise<WorkerResult>

function deterministicUuid(seed: string): string {
  const digest = createHash("sha256").update(seed).digest("hex")
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`
}

function repository(snapshot: RepositoryAgentSnapshot): { owner: string; name: string } {
  const [owner, name] = snapshot.reference.repositoryName.split("/")
  if (owner === undefined || name === undefined) throw new Error("Repository agent snapshot has an invalid repository")
  return { owner, name }
}

function objective(
  snapshot: RepositoryAgentSnapshot,
  instructions: string | undefined,
  input: Record<string, JsonValue>
): string {
  const parts = [
    instructions ?? snapshot.reference.description,
    "Use only the supplied workflow context and the publication-approved repository-agent definition.",
    `Workflow context: ${JSON.stringify(input)}`
  ]
  const value = parts.join("\n\n")
  if (value.length > 50_000) throw new Error("Repository agent objective and context exceed 50000 characters")
  return value
}

function systemPrompt(snapshot: RepositoryAgentSnapshot): string {
  return [
    snapshot.body,
    "",
    "This definition is an immutable publication-approved snapshot.",
    `Approved tools: ${snapshot.effectiveTools.join(", ") || "none"}.`,
    snapshot.effectiveModel === null
      ? "Use the platform-approved model."
      : `Requested model: ${snapshot.effectiveModel}.`
  ].join("\n")
}

function compactResult(result: WorkerResult): Record<string, JsonValue> {
  return {
    status: result.status,
    baseCommitSha: result.baseCommitSha,
    resultingCommitSha: result.resultingCommitSha,
    changedFiles: result.changedFiles,
    patchArtifact: result.patchArtifact,
    workspace: {
      provider: result.workspace.provider,
      workspaceId: result.workspace.workspaceId,
      lifecycleState: result.workspace.lifecycleState,
      conversationId: result.conversationId
    },
    validation: result.validationResults.map(({ commandId, exitCode, timedOut }) => ({
      commandId,
      exitCode,
      timedOut
    })),
    usage: result.metrics,
    artifacts: result.artifacts,
    failure: result.failure
  }
}

export function createRepositoryAgentExecutor(worker: RepositoryAgentWorker) {
  return async (input: RepositoryAgentRunInput): Promise<Record<string, JsonValue>> => {
    const config = RepositoryAgentExecutionConfigSchema.parse(input.step.config)
    const snapshot = input.snapshots
      .map((value) => RepositoryAgentSnapshotSchema.parse(value))
      .find((candidate) => candidate.reference.contentDigest === config.agentReference.contentDigest)
    if (snapshot === undefined) throw new Error("Published repository-agent snapshot is unavailable")
    const context = JsonObjectSchema.parse(input.input.context ?? {})
    const repositoryIdentity = repository(snapshot)
    const assignment = AssignmentSchema.parse({
      schemaVersion: "1",
      runId: z.uuid().parse(input.runId),
      roleExecutionId: deterministicUuid(`${input.activationId}:${input.attemptOrdinal}`),
      repository: { provider: "github", ...repositoryIdentity },
      baseCommitSha: snapshot.reference.observedCommitSha,
      objective: objective(snapshot, config.instructions, context),
      acceptanceCriteria: ["Return a complete result and satisfy every configured validation command."],
      relevantPaths: config.allowedPaths,
      validationCommands: config.validationCommands,
      pathPolicy: { allowed: config.allowedPaths, forbidden: config.forbiddenPaths },
      budgets: { ...config.budgets, maxRepairAttempts: 0 },
      contextBundle: {
        uri: `file:///workflow/${input.runId}/${input.activationId}/${input.attemptOrdinal}/manifest.json`,
        sha256: jsonValueDigest(context)
      },
      promptVersion: `repository-agent-${snapshot.reference.contentDigest}`,
      workerImageVersion: OPENHANDS_AGENT_SERVER_IMAGE
    })
    const result = await worker({
      assignment,
      approvedRepository: snapshot.reference.repositoryName,
      systemPrompt: systemPrompt(snapshot),
      artifactPrefix: `workflow/${input.activationId}/${input.attemptOrdinal}`
    })
    if (result.status !== "completed") {
      throw new Error(result.failure?.message ?? `Repository agent ended with status ${result.status}`)
    }
    return { result: compactResult(result) }
  }
}

export type RepositoryAgentExecutor = ReturnType<typeof createRepositoryAgentExecutor>
