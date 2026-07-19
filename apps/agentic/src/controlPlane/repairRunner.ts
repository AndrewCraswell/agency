import { createHash, randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { matchesGlob } from "node:path"
import { z } from "zod"
import type { CommandResult } from "../contracts/results"
import {
  SPECIALIZED_CONTRACT_SCHEMA_VERSION,
  repairResultSchemaFor,
  type RepairResultSchema
} from "../contracts/specialized"
import { DaytonaWorkspace, createDaytonaClient, waitForHttpReadiness } from "../daytona/workspace"
import { OpenHandsClient } from "../openhands/client"
import { OPENHANDS_AGENT_SERVER_PORT, createCoderProfile } from "../openhands/profiles"
import { deriveAgentServerSecrets } from "../openhands/secrets"
import type { ReviewCycleRecord, WorkflowRunRecord, WorkspaceLeaseRecord } from "../persistence/controlPlaneStore"
import { ArtifactStore, type ArtifactStorePort } from "../prototype/artifacts"
import type { ReviewResult } from "./reviewerRunner"

const REPOSITORY_PATH = "/workspace/repository"
const CONTEXT_PATH = "/workspace/orchestrator-context"
const GitCommitShaSchema = z.string().regex(/^[0-9a-f]{40}$/u)

const ValidationPlanSchema = z.array(
  z
    .object({
      id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
      command: z.string().trim().min(1),
      workingDirectory: z.string().trim().min(1),
      timeoutMs: z.number().int().positive().max(3_600_000)
    })
    .strict()
)
const PathPolicySchema = z
  .object({
    relevantPaths: z.array(z.string()),
    pathPolicy: z.object({ allowed: z.array(z.string()).min(1), forbidden: z.array(z.string()) }).strict()
  })
  .strict()
const RepairDraftSchema = z
  .object({
    status: z.enum(["completed", "blocked", "failed"]),
    addressedFindingIds: z.array(z.string()),
    declinedFindings: z.array(
      z
        .object({
          findingId: z.string(),
          reason: z.enum(["incorrect", "already_resolved", "out_of_scope", "blocked_by_dependency"]),
          explanation: z.string().trim().min(1)
        })
        .strict()
    ),
    remainingActionableFindingIds: z.array(z.string()),
    blockers: z.array(
      z
        .object({
          category: z.enum([
            "ambiguity",
            "dependency",
            "policy",
            "budget",
            "tool",
            "repository",
            "validation",
            "internal"
          ]),
          message: z.string().trim().min(1)
        })
        .strict()
    )
  })
  .strict()

const budgetLimits = {
  maxTurns: 12,
  maxInputTokens: 60_000,
  maxOutputTokens: 10_000,
  maxElapsedMs: 30 * 60 * 1_000,
  maxEstimatedSpendUsd: 5
} as const

type RepairResult = z.infer<typeof RepairResultSchema>

export interface RepairRunOptions {
  run: WorkflowRunRecord
  cycle: ReviewCycleRecord
  review: ReviewResult
  coderWorkspace: WorkspaceLeaseRecord
  artifactRoot: string
  artifactStore?: ArtifactStorePort
  githubToken: string
  modelProviderApiKey: string
  workspaceSecretKey: string
}

export interface RepairRunOutput {
  candidateCommitSha: string
  repair: RepairResult
}

function gitEnvironment(token: string): Record<string, string> {
  const credential = Buffer.from(`x-access-token:${token}`).toString("base64")
  return {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${credential}`
  }
}

function requireSuccess(result: { exitCode: number | null; output: string; timedOut: boolean }, message: string): void {
  if (result.timedOut || result.exitCode !== 0) {
    throw new Error(`${message}: ${result.timedOut ? "command timed out" : result.output.slice(0, 500)}`)
  }
}

function parseRepairDraft(response: string): z.infer<typeof RepairDraftSchema> {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(response.trim())
  return RepairDraftSchema.parse(JSON.parse(fenced?.[1] ?? response))
}

function changedFiles(status: string): string[] {
  return status
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3))
    .map((path) => (path.includes(" -> ") ? (path.split(" -> ").at(-1) ?? path) : path))
    .sort()
}

async function collectValidation(
  workspace: DaytonaWorkspace,
  plan: z.infer<typeof ValidationPlanSchema>,
  artifacts: ArtifactStorePort,
  reviewRound: number
): Promise<CommandResult[]> {
  const results: CommandResult[] = []
  for (const validation of plan) {
    const startedAt = new Date().toISOString()
    const command = await workspace.executeCommand({
      commandId: `repair-${reviewRound}-${validation.id}`,
      command: validation.command,
      workingDirectory: `${REPOSITORY_PATH}/${validation.workingDirectory === "." ? "" : validation.workingDirectory}`,
      timeoutMs: validation.timeoutMs
    })
    const endedAt = new Date().toISOString()
    const stdoutArtifact = await artifacts.write(
      `repair/${reviewRound}/validation/${validation.id}.stdout.log`,
      Buffer.from(command.output),
      "text/plain"
    )
    const stderrArtifact = await artifacts.write(
      `repair/${reviewRound}/validation/${validation.id}.stderr.log`,
      Buffer.alloc(0),
      "text/plain"
    )
    results.push({
      commandId: validation.id,
      exitCode: command.exitCode,
      stdoutArtifact,
      stderrArtifact,
      startedAt,
      endedAt,
      timedOut: command.timedOut
    })
  }
  return results
}

export function materializeRepairResult(input: {
  options: Pick<RepairRunOptions, "run" | "cycle" | "review" | "coderWorkspace">
  draft: z.infer<typeof RepairDraftSchema>
  roleExecutionId: string
  promptSha256: string
  model: string
  resultingCommitSha: string
  changedFiles: string[]
  validationResults: CommandResult[]
  startedAt: Date
  endedAt: Date
  promptTokens: number | null
  completionTokens: number | null
}): RepairResult {
  const { run, cycle, review, coderWorkspace } = input.options
  const evidence = {
    uri: `https://github.com/${run.repositoryOwner}/${run.repositoryName}/pull/${run.pullRequestNumber}`,
    sha256: createHash("sha256").update(JSON.stringify(review)).digest("hex")
  }
  return repairResultSchemaFor(review).parse({
    schemaVersion: SPECIALIZED_CONTRACT_SCHEMA_VERSION,
    runId: run.runId,
    roleAttempt: {
      schemaVersion: SPECIALIZED_CONTRACT_SCHEMA_VERSION,
      runId: run.runId,
      roleExecutionId: input.roleExecutionId,
      role: "repairer",
      attempt: cycle.reviewRound,
      modelProfile: {
        schemaVersion: SPECIALIZED_CONTRACT_SCHEMA_VERSION,
        profileId: "repairer-default",
        role: "repairer",
        provider: "openrouter",
        model: input.model,
        reasoningEffort: "medium"
      },
      prompt: {
        schemaVersion: SPECIALIZED_CONTRACT_SCHEMA_VERSION,
        role: "repairer",
        version: "v1",
        sha256: input.promptSha256
      },
      workspace: {
        schemaVersion: SPECIALIZED_CONTRACT_SCHEMA_VERSION,
        provider: "daytona",
        workspaceId: coderWorkspace.workspaceId,
        repositoryPath: REPOSITORY_PATH,
        commitSha: input.resultingCommitSha,
        conversationId: coderWorkspace.conversationId
      },
      budget: {
        schemaVersion: SPECIALIZED_CONTRACT_SCHEMA_VERSION,
        limits: budgetLimits,
        turns: 1,
        inputTokens: input.promptTokens,
        outputTokens: input.completionTokens,
        elapsedMs: Math.max(0, input.endedAt.getTime() - input.startedAt.getTime()),
        estimatedSpendUsd: 0,
        actualSpendUsd: null
      },
      startedAt: input.startedAt.toISOString(),
      endedAt: input.endedAt.toISOString()
    },
    repairAttempt: cycle.reviewRound,
    reviewedCandidateCommitSha: cycle.candidateCommitSha,
    resultingCommitSha: input.resultingCommitSha,
    status: input.draft.status,
    addressedFindingIds: input.draft.addressedFindingIds,
    declinedFindings: input.draft.declinedFindings,
    remainingActionableFindingIds: input.draft.remainingActionableFindingIds,
    changedFiles: input.changedFiles,
    patchArtifact: null,
    independentValidationResults: input.validationResults,
    workspace: {
      schemaVersion: SPECIALIZED_CONTRACT_SCHEMA_VERSION,
      provider: "daytona",
      workspaceId: coderWorkspace.workspaceId,
      repositoryPath: REPOSITORY_PATH,
      commitSha: input.resultingCommitSha,
      conversationId: coderWorkspace.conversationId
    },
    blockers: input.draft.blockers.map((blocker) => ({ ...blocker, evidence: [evidence] }))
  })
}

export async function runRepairer(options: RepairRunOptions): Promise<RepairRunOutput> {
  if (options.coderWorkspace.conversationId === null) {
    throw new Error("Retained repair requires the coder conversation ID")
  }
  const repository = `${options.run.repositoryOwner}/${options.run.repositoryName}`
  const contextDirectory = `${CONTEXT_PATH}/${options.run.runId}`
  const artifacts = options.artifactStore ?? new ArtifactStore(options.artifactRoot)
  const prompt = await readFile(new URL("../../prompts/repairer/v1.md", import.meta.url), "utf8")
  const promptSha256 = createHash("sha256").update(prompt).digest("hex")
  const roleExecutionId = randomUUID()
  const profile = createCoderProfile(roleExecutionId)
  const { sessionApiKey } = deriveAgentServerSecrets(options.workspaceSecretKey, options.run.runId, "coder")
  const workspace = await DaytonaWorkspace.attach(createDaytonaClient(), options.coderWorkspace.workspaceId)
  await workspace.start(120_000)
  try {
    const synchronize = await workspace.executeCommand({
      commandId: `synchronize-candidate-${options.cycle.reviewRound}`,
      command: [
        "git reset --hard",
        "git clean -fdx",
        `git fetch --depth=2 https://github.com/${repository}.git ${options.cycle.candidateCommitSha}`,
        `git checkout -B agent/${options.run.runId} ${options.cycle.candidateCommitSha}`,
        `test "$(git rev-parse HEAD)" = "${options.cycle.candidateCommitSha}"`,
        'test -z "$(git status --porcelain=v1)"'
      ].join(" && "),
      workingDirectory: REPOSITORY_PATH,
      environment: gitEnvironment(options.githubToken),
      timeoutMs: 180_000
    })
    requireSuccess(synchronize, "Retained workspace candidate synchronization failed")

    const localHealth = await workspace.executeCommand({
      commandId: `check-agent-server-${options.cycle.reviewRound}`,
      command: `curl --fail --silent http://127.0.0.1:${OPENHANDS_AGENT_SERVER_PORT}/health >/dev/null`,
      workingDirectory: "/workspace",
      timeoutMs: 5_000
    })
    if (localHealth.timedOut || localHealth.exitCode !== 0) {
      await workspace.startBackgroundSession(
        `repair-agent-server-${options.cycle.reviewRound}`,
        `cd /workspace && exec /usr/local/bin/openhands-agent-server --host 0.0.0.0 --port ${OPENHANDS_AGENT_SERVER_PORT}`,
        10_000
      )
    }
    const preview = await workspace.signedPreview(OPENHANDS_AGENT_SERVER_PORT, 2_700)
    const baseUrl = preview.url.replace(/\/$/u, "")
    await waitForHttpReadiness({
      url: `${baseUrl}/health`,
      maxAttempts: 30,
      requestTimeoutMs: 5_000,
      intervalMs: 2_000
    })
    const openHands = new OpenHandsClient({
      baseUrl,
      sessionApiKey,
      timeoutMs: budgetLimits.maxElapsedMs,
      maxIterations: budgetLimits.maxTurns,
      profile
    })
    await openHands.configureProfile(options.modelProviderApiKey)
    await openHands.verifyProfile()
    const startedAt = new Date()
    const completion = await openHands.followUp({
      conversationId: options.coderWorkspace.conversationId,
      systemPrompt: prompt,
      userPrompt: `The exact reviewed candidate ${options.cycle.candidateCommitSha} is checked out. Read ${contextDirectory}/assignment.md, ${contextDirectory}/validation-plan.json, and ${contextDirectory}/path-policy.json. Apply this review:\n${JSON.stringify(options.review)}`
    })
    const endedAt = new Date()
    const draft = parseRepairDraft(completion.finalResponse)
    if (draft.status !== "completed") {
      throw new Error(
        `Repairer returned ${draft.status}: ${draft.blockers.map((blocker) => blocker.message).join("; ")}`
      )
    }

    const [validationPlanBuffer, pathPolicyBuffer] = await Promise.all([
      workspace.download(`${contextDirectory}/validation-plan.json`, 30_000),
      workspace.download(`${contextDirectory}/path-policy.json`, 30_000)
    ])
    const validationPlan = ValidationPlanSchema.parse(JSON.parse(validationPlanBuffer.toString("utf8")))
    const pathPolicy = PathPolicySchema.parse(JSON.parse(pathPolicyBuffer.toString("utf8")))
    const status = await workspace.executeCommand({
      commandId: `repair-status-${options.cycle.reviewRound}`,
      command: "git status --porcelain=v1",
      workingDirectory: REPOSITORY_PATH,
      timeoutMs: 30_000
    })
    requireSuccess(status, "Repair Git status collection failed")
    const repairedFiles = changedFiles(status.output)
    if (repairedFiles.length === 0) {
      throw new Error("Repairer produced no changes")
    }
    const policyViolations = repairedFiles.filter((file) => {
      const forbidden = pathPolicy.pathPolicy.forbidden.some((pattern) => matchesGlob(file, pattern))
      const allowed = pathPolicy.pathPolicy.allowed.some((pattern) => matchesGlob(file, pattern))
      return forbidden || !allowed
    })
    if (policyViolations.length > 0) {
      throw new Error(`Repair changed paths outside policy: ${policyViolations.join(", ")}`)
    }
    const validationResults = await collectValidation(workspace, validationPlan, artifacts, options.cycle.reviewRound)
    if (validationResults.some((result) => result.timedOut || result.exitCode !== 0)) {
      throw new Error("Independent repair validation failed")
    }

    const publish = await workspace.executeCommand({
      commandId: `publish-repair-${options.cycle.reviewRound}`,
      command: [
        "git add -A",
        `git -c user.name="Agency Agent" -c user.email="agency-agent@users.noreply.github.com" commit -m "agent: apply review round ${options.cycle.reviewRound}" -m "Agent-Run-ID: ${options.run.runId}"`,
        `git push https://github.com/${repository}.git HEAD:refs/heads/agent/${options.run.runId}`,
        "git rev-parse HEAD"
      ].join(" && "),
      workingDirectory: REPOSITORY_PATH,
      environment: gitEnvironment(options.githubToken),
      timeoutMs: 180_000
    })
    requireSuccess(publish, "Repair publication failed")
    const resultingCommitSha = GitCommitShaSchema.parse(publish.output.trim().split("\n").at(-1))
    return {
      candidateCommitSha: resultingCommitSha,
      repair: materializeRepairResult({
        options,
        draft,
        roleExecutionId,
        promptSha256,
        model: profile.model,
        resultingCommitSha,
        changedFiles: repairedFiles,
        validationResults,
        startedAt,
        endedAt,
        promptTokens: completion.usage.promptTokens,
        completionTokens: completion.usage.completionTokens
      })
    }
  } finally {
    await workspace.cleanup("stop", 60_000)
  }
}
