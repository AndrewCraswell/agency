import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { type Assignment } from "../contracts/assignment"
import { type CommandResult, type WorkerResult, type WorkspaceHandle, WorkerResultSchema } from "../contracts/results"
import { type CleanupMode, DaytonaWorkspace, createDaytonaClient, waitForHttpReadiness } from "../daytona/workspace"
import { OpenHandsClient, OpenHandsError } from "../openhands/client"
import {
  OPENHANDS_AGENT_SERVER_IMAGE,
  OPENHANDS_AGENT_SERVER_PORT,
  createAgentServerEnvironment,
  createCoderProfile
} from "../openhands/profiles"
import { deriveAgentServerSecrets } from "../openhands/secrets"
import { ArtifactStore, type ArtifactStorePort } from "./artifacts"
import { createContextBundle, findPathPolicyViolations, sha256 } from "./context"

const REPOSITORY_PATH = "/workspace/repository"
const CONTEXT_ROOT = "/workspace/orchestrator-context"
const REMOTE_ARTIFACT_ROOT = "/workspace/orchestrator-artifacts"
const DEFAULT_ARTIFACTS_ROOT = fileURLToPath(new URL("../../artifacts/", import.meta.url))

export interface WorkerSecrets {
  githubToken: string
  modelProviderApiKey: string
}

export interface WorkerOptions {
  assignment: Assignment
  approvedRepository: string
  workspaceSecretKey: string
  cleanupMode: CleanupMode
  secrets: WorkerSecrets
  artifactRoot?: string
  artifactStore?: ArtifactStorePort
  signal?: AbortSignal
  onProgress?: (message: string) => void
}

interface MutableRunState {
  conversationId: string | null
  finalResponse: string | null
  resultingCommitSha: string
  changedFiles: string[]
  patchArtifact: string | null
  validationResults: CommandResult[]
  promptTokens: number | null
  completionTokens: number | null
  status: WorkerResult["status"]
  failure: WorkerResult["failure"]
}

function requireSuccess(result: { exitCode: number | null; output: string; timedOut: boolean }, message: string): void {
  if (result.timedOut) {
    throw new Error(`${message}: command timed out`)
  }
  if (result.exitCode !== 0) {
    throw new Error(`${message}: ${result.output.slice(0, 500)}`)
  }
}

function githubEnvironment(token: string): Record<string, string> {
  const basicCredential = Buffer.from(`x-access-token:${token}`).toString("base64")
  return {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basicCredential}`
  }
}

function redactSecrets(content: string, secrets: readonly string[]): string {
  let redacted = content
  for (const secret of secrets) {
    if (secret.length > 0) {
      redacted = redacted.replaceAll(secret, "[REDACTED]")
    }
  }
  return redacted
}

function parseChangedFiles(status: string): string[] {
  return status
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3))
    .map((path) => (path.includes(" -> ") ? (path.split(" -> ").at(-1) ?? path) : path))
    .sort()
}

function lifecycleState(cleanupMode: CleanupMode): WorkspaceHandle["lifecycleState"] {
  if (cleanupMode === "archive") {
    return "archived"
  }
  if (cleanupMode === "delete") {
    return "deleted"
  }
  return "stopped"
}

function classifyFailure(error: unknown): WorkerResult["failure"] {
  if (error instanceof OpenHandsError) {
    const classification = error.classification === "startup" ? "agent_server_startup" : error.classification
    return { classification, message: error.message, retryable: error.retryable }
  }
  if (error instanceof Error) {
    return { classification: "internal", message: error.message, retryable: false }
  }
  return { classification: "internal", message: "Unknown worker failure", retryable: false }
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    const error = new Error("Worker was cancelled")
    error.name = "AbortError"
    throw error
  }
}

async function prepareRepository(
  workspace: DaytonaWorkspace,
  assignment: Assignment,
  githubToken: string,
  approvedRepository: string
): Promise<void> {
  const repository = `${assignment.repository.owner}/${assignment.repository.name}`
  if (repository !== approvedRepository) {
    throw new Error(`Repository ${repository} is outside the worker allowlist`)
  }

  const clone = await workspace.executeCommand({
    commandId: "prepare-repository",
    command: [
      `rm -rf ${REPOSITORY_PATH}`,
      `git clone --no-checkout https://github.com/${repository}.git ${REPOSITORY_PATH}`,
      `git -C ${REPOSITORY_PATH} fetch --depth=1 origin ${assignment.baseCommitSha}`,
      `git -C ${REPOSITORY_PATH} checkout --detach ${assignment.baseCommitSha}`,
      `test "$(git -C ${REPOSITORY_PATH} rev-parse HEAD)" = "${assignment.baseCommitSha}"`,
      `test -z "$(git -C ${REPOSITORY_PATH} status --porcelain=v1)"`,
      `git -C ${REPOSITORY_PATH} switch -c agent/${assignment.runId}`
    ].join(" && "),
    workingDirectory: "/workspace",
    environment: githubEnvironment(githubToken),
    timeoutMs: 180_000
  })
  requireSuccess(clone, "Repository preparation failed")
}

async function uploadContext(
  workspace: DaytonaWorkspace,
  assignment: Assignment,
  artifacts: ArtifactStorePort
): Promise<string> {
  const contextDirectory = `${CONTEXT_ROOT}/${assignment.runId}`
  const createDirectory = await workspace.executeCommand({
    commandId: "create-context-directory",
    command: `mkdir -p ${contextDirectory}`,
    workingDirectory: "/workspace",
    timeoutMs: 10_000
  })
  requireSuccess(createDirectory, "Context directory creation failed")

  for (const artifact of createContextBundle(assignment)) {
    const remotePath = `${contextDirectory}/${artifact.relativePath}`
    await workspace.upload(artifact.content, remotePath, 30_000)
    await artifacts.write(`context/${artifact.relativePath}`, artifact.content, artifact.mediaType)
    const verification = await workspace.executeCommand({
      commandId: "verify-context-digest",
      command: `printf '%s  %s\\n' '${artifact.sha256}' '${remotePath}' | sha256sum -c -`,
      workingDirectory: "/workspace",
      timeoutMs: 10_000
    })
    requireSuccess(verification, `Context digest verification failed for ${artifact.relativePath}`)
  }

  const makeReadOnly = await workspace.executeCommand({
    commandId: "protect-context",
    command: `chmod -R a-w ${contextDirectory}`,
    workingDirectory: "/workspace",
    timeoutMs: 10_000
  })
  requireSuccess(makeReadOnly, "Context protection failed")
  return contextDirectory
}

async function startAgentServer(
  workspace: DaytonaWorkspace,
  assignment: Assignment
): Promise<{ baseUrl: string; commandId: string }> {
  const commandId = await workspace.startBackgroundSession(
    "agent-server",
    `cd /workspace && exec /usr/local/bin/openhands-agent-server --host 0.0.0.0 --port ${OPENHANDS_AGENT_SERVER_PORT}`,
    10_000
  )

  const preview = await workspace.signedPreview(
    OPENHANDS_AGENT_SERVER_PORT,
    Math.ceil(assignment.budgets.maxElapsedMs / 1000) + 900
  )
  const baseUrl = preview.url.replace(/\/$/u, "")
  await waitForHttpReadiness({
    url: `${baseUrl}/health`,
    maxAttempts: 30,
    requestTimeoutMs: 5_000,
    intervalMs: 2_000
  })
  return { baseUrl, commandId }
}

async function collectValidation(
  workspace: DaytonaWorkspace,
  assignment: Assignment,
  artifacts: ArtifactStorePort
): Promise<CommandResult[]> {
  const results: CommandResult[] = []
  for (const validation of assignment.validationCommands) {
    const startedAt = new Date().toISOString()
    const command = await workspace.executeCommand({
      commandId: validation.id,
      command: validation.command,
      workingDirectory: `${REPOSITORY_PATH}/${validation.workingDirectory === "." ? "" : validation.workingDirectory}`,
      timeoutMs: validation.timeoutMs
    })
    const endedAt = new Date().toISOString()
    const stdoutArtifact = await artifacts.write(
      `validation/${validation.id}.stdout.log`,
      Buffer.from(command.output),
      "text/plain"
    )
    const stderrArtifact = await artifacts.write(
      `validation/${validation.id}.stderr.log`,
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

async function collectGitEvidence(
  workspace: DaytonaWorkspace,
  artifacts: ArtifactStorePort
): Promise<{ resultingCommitSha: string; changedFiles: string[]; patchArtifact: string | null }> {
  const status = await workspace.executeCommand({
    commandId: "git-status",
    command: "git status --porcelain=v1",
    workingDirectory: REPOSITORY_PATH,
    timeoutMs: 30_000
  })
  requireSuccess(status, "Git status collection failed")
  await artifacts.write("git/status.txt", Buffer.from(status.output), "text/plain")
  const changedFiles = parseChangedFiles(status.output)

  const stat = await workspace.executeCommand({
    commandId: "git-diff-stat",
    command: "git diff --stat HEAD",
    workingDirectory: REPOSITORY_PATH,
    timeoutMs: 30_000
  })
  requireSuccess(stat, "Git diff stat collection failed")
  await artifacts.write("git/diff-stat.txt", Buffer.from(stat.output), "text/plain")

  const head = await workspace.executeCommand({
    commandId: "git-head",
    command: "git rev-parse HEAD",
    workingDirectory: REPOSITORY_PATH,
    timeoutMs: 30_000
  })
  requireSuccess(head, "Git HEAD collection failed")

  if (changedFiles.length === 0) {
    return { resultingCommitSha: head.output.trim(), changedFiles, patchArtifact: null }
  }

  const patchRemotePath = `${REMOTE_ARTIFACT_ROOT}/patch.diff`
  const patch = await workspace.executeCommand({
    commandId: "git-patch",
    command: `mkdir -p ${REMOTE_ARTIFACT_ROOT} && git add -N . && git diff --binary HEAD > ${patchRemotePath}`,
    workingDirectory: REPOSITORY_PATH,
    timeoutMs: 60_000
  })
  requireSuccess(patch, "Git patch collection failed")
  const patchContent = await workspace.download(patchRemotePath, 60_000)
  const patchArtifact = await artifacts.write("git/patch.diff", patchContent, "text/x-diff")
  return { resultingCommitSha: head.output.trim(), changedFiles, patchArtifact }
}

function buildWorkspaceHandle(
  workspace: DaytonaWorkspace,
  assignment: Assignment,
  cleanupMode: CleanupMode,
  conversationId: string | null
): WorkspaceHandle {
  const metadata = workspace.describe()
  const now = new Date()
  const createdAt = metadata.createdAt ?? now.toISOString()
  return {
    provider: "daytona",
    workspaceId: metadata.workspaceId,
    lifecycleState: lifecycleState(cleanupMode),
    repositoryPath: REPOSITORY_PATH,
    agentServerUrlReference: `daytona-preview:${OPENHANDS_AGENT_SERVER_PORT}`,
    conversationId,
    createdAt,
    lastActivityAt: metadata.lastActivityAt ?? now.toISOString(),
    retentionUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
  }
}

export async function runWorker(options: WorkerOptions): Promise<WorkerResult> {
  const startedAt = Date.now()
  const { assignment, cleanupMode, secrets } = options
  const progress = (message: string): void => options.onProgress?.(message)
  const artifactRoot = options.artifactRoot ?? join(DEFAULT_ARTIFACTS_ROOT, assignment.runId)
  const artifacts = options.artifactStore ?? new ArtifactStore(artifactRoot)
  throwIfCancelled(options.signal)
  const client = createDaytonaClient()
  const { sessionApiKey, encryptionKey } = deriveAgentServerSecrets(
    options.workspaceSecretKey,
    assignment.runId,
    "coder"
  )
  const repositoryHash = sha256(Buffer.from(`${assignment.repository.owner}/${assignment.repository.name}`)).slice(
    0,
    32
  )
  progress("Creating Daytona workspace")
  const workspace = await DaytonaWorkspace.create(client, {
    image: OPENHANDS_AGENT_SERVER_IMAGE,
    resources: { cpu: 4, memory: 8, disk: 10 },
    labels: {
      runId: assignment.runId,
      role: "coder",
      repositoryHash,
      promptVersion: assignment.promptVersion,
      environment: "worker"
    },
    retention: { autoArchiveMinutes: 1_440, autoDeleteMinutes: 10_080 },
    environment: createAgentServerEnvironment({ sessionApiKey, encryptionKey }),
    createTimeoutMs: 120_000
  })
  const state: MutableRunState = {
    conversationId: null,
    finalResponse: null,
    resultingCommitSha: assignment.baseCommitSha,
    changedFiles: [],
    patchArtifact: null,
    validationResults: [],
    promptTokens: null,
    completionTokens: null,
    status: "failed",
    failure: null
  }
  let agentServerCommandId: string | null = null

  try {
    throwIfCancelled(options.signal)
    progress("Cloning repository and checking out the pinned commit")
    await prepareRepository(workspace, assignment, secrets.githubToken, options.approvedRepository)
    throwIfCancelled(options.signal)
    progress("Uploading and verifying the context bundle")
    const contextDirectory = await uploadContext(workspace, assignment, artifacts)
    progress("Starting OpenHands Agent Server")
    const agentServer = await startAgentServer(workspace, assignment)
    agentServerCommandId = agentServer.commandId
    const openHands = new OpenHandsClient({
      baseUrl: agentServer.baseUrl,
      sessionApiKey,
      timeoutMs: assignment.budgets.maxElapsedMs,
      maxIterations: assignment.budgets.maxTurns,
      profile: createCoderProfile(assignment.roleExecutionId)
    })
    progress("Configuring and verifying the model profile")
    await openHands.configureProfile(secrets.modelProviderApiKey)
    await openHands.verifyProfile()
    const systemPrompt = await readFile(new URL("../../prompts/coder/v1.md", import.meta.url), "utf8")
    progress("Running the OpenHands coder")
    const completion = await openHands.chat({
      systemPrompt,
      userPrompt: `Read ${contextDirectory}/manifest.json, then complete the assignment in ${REPOSITORY_PATH}.`,
      signal: options.signal
    })
    state.conversationId = completion.conversationId
    state.finalResponse = completion.finalResponse
    state.promptTokens = completion.usage.promptTokens
    state.completionTokens = completion.usage.completionTokens
    await artifacts.write("agent/final-response.txt", Buffer.from(completion.finalResponse), "text/plain")

    progress("Running independent validation")
    state.validationResults = await collectValidation(workspace, assignment, artifacts)
    progress("Collecting Git evidence and enforcing path policy")
    const evidence = await collectGitEvidence(workspace, artifacts)
    state.resultingCommitSha = evidence.resultingCommitSha
    state.changedFiles = evidence.changedFiles
    state.patchArtifact = evidence.patchArtifact

    const policyViolations = findPathPolicyViolations(assignment, evidence.changedFiles)
    if (policyViolations.length > 0) {
      state.failure = {
        classification: "policy_violation",
        message: `Changed paths violate assignment policy: ${policyViolations.join(", ")}`,
        retryable: false
      }
    } else if (state.validationResults.some((result) => result.timedOut || result.exitCode !== 0)) {
      state.failure = {
        classification: "validation",
        message: "One or more validation commands failed",
        retryable: false
      }
    } else if (/^STATUS:\s*BLOCKED\b/imu.test(completion.finalResponse)) {
      state.status = "blocked"
      state.failure = {
        classification: "validation",
        message: "Agent reported the assignment as blocked",
        retryable: false
      }
    } else {
      state.status = "completed"
      state.failure = null
    }
  } catch (error) {
    state.status =
      (error instanceof OpenHandsError && error.classification === "cancelled") ||
      (error instanceof Error && error.name === "AbortError")
        ? "cancelled"
        : "failed"
    state.failure = classifyFailure(error)
    if (agentServerCommandId !== null) {
      try {
        const server = await workspace.getBackgroundSessionResult("agent-server", agentServerCommandId)
        const values = [secrets.githubToken, secrets.modelProviderApiKey, sessionApiKey, encryptionKey] as const
        const status = JSON.stringify({ exitCode: server.exitCode }, null, 2)
        await artifacts.write("agent/server-status.json", Buffer.from(status), "application/json")
        await artifacts.write(
          "agent/server.stdout.log",
          Buffer.from(redactSecrets(server.stdout, values)),
          "text/plain"
        )
        await artifacts.write(
          "agent/server.stderr.log",
          Buffer.from(redactSecrets(server.stderr, values)),
          "text/plain"
        )
      } catch {
        // Preserve the original worker failure when diagnostics are unavailable.
      }
    }
  } finally {
    progress(`Applying ${cleanupMode} workspace cleanup`)
    await workspace.cleanup(cleanupMode, 60_000)
  }

  const result = {
    schemaVersion: "1",
    runId: assignment.runId,
    roleExecutionId: assignment.roleExecutionId,
    status: state.status,
    workspace: buildWorkspaceHandle(workspace, assignment, cleanupMode, state.conversationId),
    conversationId: state.conversationId,
    baseCommitSha: assignment.baseCommitSha,
    resultingCommitSha: state.resultingCommitSha,
    changedFiles: state.changedFiles,
    patchArtifact: state.patchArtifact,
    validationResults: state.validationResults,
    metrics: {
      elapsedMs: Date.now() - startedAt,
      turns: null,
      promptTokens: state.promptTokens,
      cachedPromptTokens: null,
      completionTokens: state.completionTokens,
      estimatedCostUsd: null
    },
    artifacts: artifacts.manifest(),
    failure: state.failure
  }
  return WorkerResultSchema.parse(result)
}
