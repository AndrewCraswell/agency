import { createHash, randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { z } from "zod"
import {
  ReviewResultSchema,
  SPECIALIZED_CONTRACT_SCHEMA_VERSION,
  stableReviewFindingId
} from "../contracts/specialized"
import { DaytonaWorkspace, createDaytonaClient, waitForHttpReadiness } from "../daytona/workspace"
import { OpenHandsClient } from "../openhands/client"
import {
  OPENHANDS_AGENT_SERVER_IMAGE,
  OPENHANDS_AGENT_SERVER_PORT,
  createAgentServerEnvironment,
  createReviewerProfile
} from "../openhands/profiles"
import { deriveAgentServerSecrets } from "../openhands/secrets"
import type { ReviewCycleRecord, WorkflowRunRecord } from "../persistence/controlPlaneStore"
import { ArtifactStore, type ArtifactStorePort } from "../prototype/artifacts"

const REPOSITORY_PATH = "/workspace/repository"
const REVIEW_CONTEXT_PATH = "/workspace/review-context"
const reviewContextFiles = ["assignment.md", "acceptance-criteria.json", "validation-plan.json", "path-policy.json"]

const ReviewDraftSchema = z
  .object({
    disposition: z.enum(["approved", "changes_requested", "blocked"]),
    findings: z.array(
      z
        .object({
          severity: z.enum(["critical", "high", "medium", "low"]),
          category: z.enum([
            "correctness",
            "regression",
            "security",
            "data_loss",
            "test_gap",
            "scope",
            "maintainability"
          ]),
          locator: z
            .object({
              path: z.string().trim().min(1),
              line: z.number().int().positive().nullable(),
              symbol: z.string().trim().min(1).nullable()
            })
            .strict(),
          finding: z.string().trim().min(1),
          evidence: z.string().trim().min(1),
          expectedBehavior: z.string().trim().min(1),
          actionable: z.boolean(),
          confidence: z.number().min(0).max(1)
        })
        .strict()
    ),
    blockedReasons: z.array(
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
  maxTurns: 8,
  maxInputTokens: 40_000,
  maxOutputTokens: 8_000,
  maxElapsedMs: 20 * 60 * 1_000,
  maxEstimatedSpendUsd: 3
} as const

export type ReviewResult = z.infer<typeof ReviewResultSchema>

export interface ReviewerRunOutput {
  review: ReviewResult
  workspaceId: string
  conversationId: string
  createdAt: Date
  retentionUntil: Date
  expiresAt: Date
}

export interface ReviewerRunOptions {
  run: WorkflowRunRecord
  cycle: ReviewCycleRecord
  artifactRoot: string
  artifactStore?: ArtifactStorePort
  githubToken: string
  modelProviderApiKey: string
  workspaceSecretKey: string
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

function parseReviewDraft(response: string): z.infer<typeof ReviewDraftSchema> {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(response.trim())
  return ReviewDraftSchema.parse(JSON.parse(fenced?.[1] ?? response))
}

export function materializeReviewResult(input: {
  run: WorkflowRunRecord
  cycle: ReviewCycleRecord
  draft: z.infer<typeof ReviewDraftSchema>
  roleExecutionId: string
  conversationId: string
  workspaceId: string
  promptSha256: string
  model: string
  startedAt: Date
  endedAt: Date
  promptTokens: number | null
  completionTokens: number | null
}): ReviewResult {
  const evidence = {
    uri: `https://github.com/${input.run.repositoryOwner}/${input.run.repositoryName}/pull/${input.run.pullRequestNumber}`,
    sha256: createHash("sha256").update(JSON.stringify(input.draft)).digest("hex")
  }
  const findings = input.draft.findings.map((finding) => ({
    schemaVersion: SPECIALIZED_CONTRACT_SCHEMA_VERSION,
    id: stableReviewFindingId({
      runId: input.run.runId,
      reviewAttempt: input.cycle.reviewRound,
      locator: finding.locator,
      category: finding.category,
      finding: finding.finding
    }),
    runId: input.run.runId,
    reviewAttempt: input.cycle.reviewRound,
    ...finding
  }))
  return ReviewResultSchema.parse({
    schemaVersion: SPECIALIZED_CONTRACT_SCHEMA_VERSION,
    runId: input.run.runId,
    roleAttempt: {
      schemaVersion: SPECIALIZED_CONTRACT_SCHEMA_VERSION,
      runId: input.run.runId,
      roleExecutionId: input.roleExecutionId,
      role: "reviewer",
      attempt: input.cycle.reviewRound,
      modelProfile: {
        schemaVersion: SPECIALIZED_CONTRACT_SCHEMA_VERSION,
        profileId: "reviewer-default",
        role: "reviewer",
        provider: "openrouter",
        model: input.model,
        reasoningEffort: "high"
      },
      prompt: {
        schemaVersion: SPECIALIZED_CONTRACT_SCHEMA_VERSION,
        role: "reviewer",
        version: "v1",
        sha256: input.promptSha256
      },
      workspace: {
        schemaVersion: SPECIALIZED_CONTRACT_SCHEMA_VERSION,
        provider: "daytona",
        workspaceId: input.workspaceId,
        repositoryPath: REPOSITORY_PATH,
        commitSha: input.cycle.candidateCommitSha,
        conversationId: input.conversationId
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
    reviewAttempt: input.cycle.reviewRound,
    candidateCommitSha: input.cycle.candidateCommitSha,
    disposition: input.draft.disposition,
    findings,
    blockedReasons: input.draft.blockedReasons.map((blocker) => ({ ...blocker, evidence: [evidence] }))
  })
}

export async function runReviewer(options: ReviewerRunOptions): Promise<ReviewerRunOutput> {
  if (options.run.pullRequestNumber === null) {
    throw new Error("A review run requires a pull request number")
  }
  const roleExecutionId = randomUUID()
  const profile = createReviewerProfile(roleExecutionId)
  const artifacts = options.artifactStore ?? new ArtifactStore(options.artifactRoot)
  const prompt = await readFile(new URL("../../prompts/reviewer/v1.md", import.meta.url), "utf8")
  const promptSha256 = createHash("sha256").update(prompt).digest("hex")
  const { sessionApiKey, encryptionKey } = deriveAgentServerSecrets(
    options.workspaceSecretKey,
    options.run.runId,
    `reviewer-${options.cycle.reviewRound}`
  )
  const repository = `${options.run.repositoryOwner}/${options.run.repositoryName}`
  const repositoryHash = createHash("sha256").update(repository).digest("hex").slice(0, 32)
  const workspace = await DaytonaWorkspace.create(createDaytonaClient(), {
    image: OPENHANDS_AGENT_SERVER_IMAGE,
    resources: { cpu: 4, memory: 8, disk: 10 },
    labels: {
      runId: options.run.runId,
      role: "reviewer",
      repositoryHash,
      promptVersion: "v1",
      environment: "review"
    },
    retention: { autoArchiveMinutes: 60, autoDeleteMinutes: 1_440 },
    environment: createAgentServerEnvironment({ sessionApiKey, encryptionKey }),
    createTimeoutMs: 120_000
  })
  const metadata = workspace.describe()
  const createdAt = new Date(metadata.createdAt ?? new Date().toISOString())
  const retentionUntil = new Date(Date.now() + 60 * 60 * 1_000)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000)
  try {
    const prepare = await workspace.executeCommand({
      commandId: "prepare-review-repository",
      command: [
        `git clone --no-checkout https://github.com/${repository}.git ${REPOSITORY_PATH}`,
        `git -C ${REPOSITORY_PATH} fetch --depth=2 origin ${options.cycle.candidateCommitSha}`,
        `git -C ${REPOSITORY_PATH} checkout --detach ${options.cycle.candidateCommitSha}`,
        `test "$(git -C ${REPOSITORY_PATH} rev-parse HEAD)" = "${options.cycle.candidateCommitSha}"`,
        `git -C ${REPOSITORY_PATH} remote set-url origin disabled://review-workspace`
      ].join(" && "),
      workingDirectory: "/workspace",
      environment: gitEnvironment(options.githubToken),
      timeoutMs: 180_000
    })
    requireSuccess(prepare, "Reviewer repository preparation failed")
    const makeContext = await workspace.executeCommand({
      commandId: "prepare-review-context",
      command: `mkdir -p ${REVIEW_CONTEXT_PATH}`,
      workingDirectory: "/workspace",
      timeoutMs: 10_000
    })
    requireSuccess(makeContext, "Reviewer context preparation failed")
    for (const file of reviewContextFiles) {
      await workspace.upload(await artifacts.read(`context/${file}`), `${REVIEW_CONTEXT_PATH}/${file}`, 30_000)
    }
    const protectContext = await workspace.executeCommand({
      commandId: "protect-review-context",
      command: `chmod -R a-w ${REVIEW_CONTEXT_PATH}`,
      workingDirectory: "/workspace",
      timeoutMs: 10_000
    })
    requireSuccess(protectContext, "Reviewer context protection failed")

    await workspace.startBackgroundSession(
      "reviewer-agent-server",
      `cd /workspace && exec /usr/local/bin/openhands-agent-server --host 0.0.0.0 --port ${OPENHANDS_AGENT_SERVER_PORT}`,
      10_000
    )
    const preview = await workspace.signedPreview(OPENHANDS_AGENT_SERVER_PORT, 1_800)
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
    const completion = await openHands.chat({
      systemPrompt: prompt,
      userPrompt: `Read ${REVIEW_CONTEXT_PATH}/assignment.md and the JSON context files. Review commit ${options.cycle.candidateCommitSha} in ${REPOSITORY_PATH} against its first parent. Return only the required JSON object.`
    })
    const endedAt = new Date()
    const immutable = await workspace.executeCommand({
      commandId: "verify-review-workspace",
      command: `test "$(git rev-parse HEAD)" = "${options.cycle.candidateCommitSha}" && test -z "$(git status --porcelain=v1)"`,
      workingDirectory: REPOSITORY_PATH,
      timeoutMs: 30_000
    })
    requireSuccess(immutable, "Reviewer modified the candidate workspace")
    return {
      review: materializeReviewResult({
        run: options.run,
        cycle: options.cycle,
        draft: parseReviewDraft(completion.finalResponse),
        roleExecutionId,
        conversationId: completion.conversationId,
        workspaceId: metadata.workspaceId,
        promptSha256,
        model: profile.model,
        startedAt,
        endedAt,
        promptTokens: completion.usage.promptTokens,
        completionTokens: completion.usage.completionTokens
      }),
      workspaceId: metadata.workspaceId,
      conversationId: completion.conversationId,
      createdAt,
      retentionUntil,
      expiresAt
    }
  } finally {
    await workspace.cleanup("delete", 60_000)
  }
}
