import { spawn } from "node:child_process"
import { createSign } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { z } from "zod"
import { PublicationResultSchema } from "../orchestrator/state"
import type { DraftPullRequestInput, DraftPullRequestPublisher } from "./publisher"

const RepositorySegmentSchema = z.string().regex(/^[A-Za-z0-9_.-]+$/u)
const InstallationTokenSchema = z.object({ token: z.string().min(1), expires_at: z.iso.datetime({ offset: true }) })
const RepositoryDetailsSchema = z.object({ default_branch: z.string().min(1) })
const GitReferenceSchema = z.object({ object: z.object({ sha: z.string().regex(/^[0-9a-f]{40}$/u) }) })
const GitCommitSchema = z.object({ message: z.string() })
const PullRequestSchema = z.object({
  number: z.number().int().positive(),
  html_url: z.url(),
  body: z.string().nullable(),
  head: z.object({ sha: z.string().regex(/^[0-9a-f]{40}$/u) })
})
const PullRequestListSchema = z.array(PullRequestSchema)

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export type GitCommandResult = {
  stdout: string
  stderr: string
}

export type GitCommandRunner = (
  arguments_: readonly string[],
  options: { cwd: string; environment?: Readonly<Record<string, string>>; timeoutMs: number }
) => Promise<GitCommandResult>

export type GitHubAppPublisherOptions = {
  appId: string
  installationId: string
  privateKey: string
  apiBaseUrl?: string
  fetcher?: Fetcher
  gitRunner?: GitCommandRunner
  now?: () => Date
}

function base64UrlJson(value: Readonly<Record<string, string | number>>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function createAppJwt(appId: string, privateKey: string, now: Date): string {
  const issuedAt = Math.floor(now.getTime() / 1_000) - 60
  const unsignedToken = `${base64UrlJson({ alg: "RS256", typ: "JWT" })}.${base64UrlJson({
    iat: issuedAt,
    exp: issuedAt + 600,
    iss: appId
  })}`
  const signature = createSign("RSA-SHA256").update(unsignedToken).sign(privateKey).toString("base64url")
  return `${unsignedToken}.${signature}`
}

async function defaultGitRunner(
  arguments_: readonly string[],
  options: { cwd: string; environment?: Readonly<Record<string, string>>; timeoutMs: number }
): Promise<GitCommandResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("git", arguments_, {
      cwd: options.cwd,
      env: { ...process.env, ...options.environment },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    })
    let stdout = ""
    let stderr = ""
    let isTimedOut = false
    const timeout = setTimeout(() => {
      isTimedOut = true
      child.kill()
    }, options.timeoutMs)

    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk
    })
    child.on("error", (error) => {
      clearTimeout(timeout)
      rejectPromise(error)
    })
    child.on("close", (exitCode) => {
      clearTimeout(timeout)
      if (isTimedOut) {
        rejectPromise(new Error(`Git command timed out: git ${arguments_.join(" ")}`))
        return
      }
      if (exitCode !== 0) {
        rejectPromise(new Error(`Git command failed with exit code ${exitCode}: ${stderr.slice(0, 1_000)}`))
        return
      }
      resolvePromise({ stdout, stderr })
    })
  })
}

function authorizationEnvironment(token: string): Record<string, string> {
  const credential = Buffer.from(`x-access-token:${token}`).toString("base64")
  return {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${credential}`
  }
}

function runMarker(runId: string): string {
  return `<!-- agent-run-id:${runId} -->`
}

function pullRequestTitle(input: DraftPullRequestInput): string {
  return `Agent: ${input.assignment.objective}`.slice(0, 240)
}

function pullRequestBody(input: DraftPullRequestInput): string {
  const criteria = input.assignment.acceptanceCriteria.map((criterion) => `- ${criterion}`).join("\n")
  const validations = input.workerResult.validationResults
    .map((result) => `- ${result.commandId}: ${result.exitCode === 0 && !result.timedOut ? "passed" : "failed"}`)
    .join("\n")
  const changedFiles = input.workerResult.changedFiles.map((path) => `- \`${path}\``).join("\n")
  return [
    runMarker(input.assignment.runId),
    "## Objective",
    input.assignment.objective,
    "## Acceptance criteria",
    criteria,
    "## Independent validation",
    validations,
    "## Changed files",
    changedFiles,
    "## Evidence",
    `- Run ID: \`${input.assignment.runId}\``,
    `- Base commit: \`${input.assignment.baseCommitSha}\``,
    `- Prompt version: \`${input.assignment.promptVersion}\``
  ].join("\n\n")
}

function commitMessage(input: DraftPullRequestInput): string {
  return [
    `agent: ${input.assignment.objective}`.slice(0, 72),
    `Agent-Run-ID: ${input.assignment.runId}`,
    `Agent-Prompt-Version: ${input.assignment.promptVersion}`,
    `Agent-Base-SHA: ${input.assignment.baseCommitSha}`
  ].join("\n\n")
}

export class GitHubAppPublisher implements DraftPullRequestPublisher {
  readonly #appId: string
  readonly #installationId: string
  readonly #privateKey: string
  readonly #apiBaseUrl: string
  readonly #fetcher: Fetcher
  readonly #gitRunner: GitCommandRunner
  readonly #now: () => Date

  constructor(options: GitHubAppPublisherOptions) {
    this.#appId = options.appId
    this.#installationId = options.installationId
    this.#privateKey = options.privateKey
    this.#apiBaseUrl = (options.apiBaseUrl ?? "https://api.github.com").replace(/\/$/u, "")
    this.#fetcher = options.fetcher ?? fetch
    this.#gitRunner = options.gitRunner ?? defaultGitRunner
    this.#now = options.now ?? (() => new Date())
  }

  async publish(input: DraftPullRequestInput) {
    const owner = RepositorySegmentSchema.parse(input.assignment.repository.owner)
    const repositoryName = RepositorySegmentSchema.parse(input.assignment.repository.name)
    const repository = `${owner}/${repositoryName}`
    if (input.workerResult.status !== "completed" || input.workerResult.patchArtifact === null) {
      throw new Error("Only a completed worker result with a patch can be published")
    }

    const token = await this.installationToken()
    const branch = `agent/${input.assignment.runId}`
    const repositoryDetails = await this.#request(
      `/repos/${owner}/${repositoryName}`,
      { method: "GET" },
      RepositoryDetailsSchema,
      token
    )
    const existingReference = await this.#reference(owner, repositoryName, branch, token)
    const existingPullRequests = await this.#request(
      `/repos/${owner}/${repositoryName}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`,
      { method: "GET" },
      PullRequestListSchema,
      token
    )
    const marker = runMarker(input.assignment.runId)
    const existingPullRequest = existingPullRequests.find((pullRequest) => pullRequest.body?.includes(marker) === true)
    const title = pullRequestTitle(input)
    const body = pullRequestBody(input)

    if (existingPullRequest !== undefined) {
      const updated = await this.#request(
        `/repos/${owner}/${repositoryName}/pulls/${existingPullRequest.number}`,
        { method: "PATCH", body: JSON.stringify({ title, body }) },
        PullRequestSchema,
        token
      )
      return PublicationResultSchema.parse({
        branch,
        pullRequestNumber: updated.number,
        pullRequestUrl: updated.html_url,
        headCommitSha: updated.head.sha,
        updatedExisting: true
      })
    }

    let headCommitSha: string
    if (existingReference === null) {
      headCommitSha = await this.#materializeAndPush(input, repository, branch, token)
    } else {
      const existingCommit = await this.#request(
        `/repos/${owner}/${repositoryName}/git/commits/${existingReference}`,
        { method: "GET" },
        GitCommitSchema,
        token
      )
      if (!existingCommit.message.includes(`Agent-Run-ID: ${input.assignment.runId}`)) {
        throw new Error(`Branch ${branch} already exists and is not owned by run ${input.assignment.runId}`)
      }
      headCommitSha = existingReference
    }

    const verifiedReference = await this.#reference(owner, repositoryName, branch, token)
    if (verifiedReference !== headCommitSha) {
      throw new Error(`Remote branch ${branch} did not resolve to the published commit`)
    }

    const pullRequest = await this.#request(
      `/repos/${owner}/${repositoryName}/pulls`,
      {
        method: "POST",
        body: JSON.stringify({
          title,
          body,
          head: branch,
          base: repositoryDetails.default_branch,
          draft: true
        })
      },
      PullRequestSchema,
      token
    )
    return PublicationResultSchema.parse({
      branch,
      pullRequestNumber: pullRequest.number,
      pullRequestUrl: pullRequest.html_url,
      headCommitSha: pullRequest.head.sha,
      updatedExisting: false
    })
  }

  async installationToken(): Promise<string> {
    const appJwt = createAppJwt(this.#appId, this.#privateKey, this.#now())
    const result = await this.#request(
      `/app/installations/${encodeURIComponent(this.#installationId)}/access_tokens`,
      { method: "POST" },
      InstallationTokenSchema,
      appJwt
    )
    return result.token
  }

  async #reference(owner: string, repository: string, branch: string, token: string): Promise<string | null> {
    const response = await this.#fetcher(
      `${this.#apiBaseUrl}/repos/${owner}/${repository}/git/ref/heads/${encodeURIComponent(branch)}`,
      { headers: this.#headers(token) }
    )
    if (response.status === 404) {
      return null
    }
    if (!response.ok) {
      throw new Error(`GitHub reference lookup failed with status ${response.status}`)
    }
    return GitReferenceSchema.parse(await response.json()).object.sha
  }

  async #request<Output>(path: string, init: RequestInit, schema: z.ZodType<Output>, token: string): Promise<Output> {
    const response = await this.#fetcher(`${this.#apiBaseUrl}${path}`, {
      ...init,
      headers: { ...this.#headers(token), ...(init.body === undefined ? {} : { "Content-Type": "application/json" }) }
    })
    if (!response.ok) {
      const responseText = await response.text()
      throw new Error(
        `GitHub request ${init.method ?? "GET"} ${path} failed with status ${response.status}: ${responseText.slice(0, 500)}`
      )
    }
    return schema.parse(await response.json())
  }

  #headers(token: string): Record<string, string> {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  }

  async #materializeAndPush(
    input: DraftPullRequestInput,
    repository: string,
    branch: string,
    token: string
  ): Promise<string> {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "agent-publish-"))
    const checkout = join(temporaryRoot, "repository")
    const environment = authorizationEnvironment(token)
    const runGit = (arguments_: readonly string[], cwd = checkout) =>
      this.#gitRunner(arguments_, { cwd, environment, timeoutMs: 180_000 })

    try {
      await runGit(["clone", "--no-checkout", `https://github.com/${repository}.git`, checkout], temporaryRoot)
      await runGit(["fetch", "--depth=1", "origin", input.assignment.baseCommitSha])
      await runGit(["checkout", "--detach", input.assignment.baseCommitSha])
      const head = (await runGit(["rev-parse", "HEAD"])).stdout.trim()
      if (head !== input.assignment.baseCommitSha) {
        throw new Error(`Fresh publication checkout resolved ${head} instead of ${input.assignment.baseCommitSha}`)
      }
      if ((await runGit(["status", "--porcelain=v1"])).stdout.trim().length > 0) {
        throw new Error("Fresh publication checkout is not clean")
      }

      await runGit(["apply", "--check", "--index", input.patchArtifactPath])
      await runGit(["apply", "--index", input.patchArtifactPath])
      const changedFiles = (await runGit(["diff", "--cached", "--name-only"])).stdout.split("\n").filter(Boolean).sort()
      const expectedFiles = [...input.workerResult.changedFiles].sort()
      if (JSON.stringify(changedFiles) !== JSON.stringify(expectedFiles)) {
        throw new Error("Files changed by the publication patch do not match the independently validated inventory")
      }

      await runGit([
        "-c",
        "user.name=Agency Agent",
        "-c",
        "user.email=agency-agent@users.noreply.github.com",
        "commit",
        "-m",
        commitMessage(input)
      ])
      await runGit(["switch", "-c", branch])
      const commitSha = (await runGit(["rev-parse", "HEAD"])).stdout.trim()
      await runGit(["push", "origin", `HEAD:refs/heads/${branch}`])
      return z
        .string()
        .regex(/^[0-9a-f]{40}$/u)
        .parse(commitSha)
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  }
}
