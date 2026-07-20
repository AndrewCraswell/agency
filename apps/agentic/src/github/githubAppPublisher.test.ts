import { readFile } from "node:fs/promises"
import { describe, expect, it, vi } from "vitest"
import { AssignmentSchema, type Assignment } from "../contracts/assignment"
import { WorkerResultSchema, type WorkerResult } from "../contracts/results"
import { GitHubAppPublisher, type GitCommandRunner } from "./githubAppPublisher"
import type { DraftPullRequestInput } from "./publisher"

const fixtureUrl = new URL("../../tests/fixtures/worker-repair-assignment.json", import.meta.url)
const timestamp = "2026-07-19T00:00:00.000Z"
const tokenProvider = async () => "installation-token"

async function assignmentFixture(): Promise<Assignment> {
  return AssignmentSchema.parse(JSON.parse(await readFile(fixtureUrl, "utf8")))
}

function workerResult(assignment: Assignment): WorkerResult {
  const validation = assignment.validationCommands[0]
  if (validation === undefined) {
    throw new Error("Expected assignment validation command")
  }
  return WorkerResultSchema.parse({
    schemaVersion: "1",
    runId: assignment.runId,
    roleExecutionId: assignment.roleExecutionId,
    status: "completed",
    workspace: {
      provider: "daytona",
      workspaceId: "workspace-1",
      lifecycleState: "stopped",
      repositoryPath: "/workspace/repository",
      agentServerUrlReference: "daytona-preview:3000",
      conversationId: "conversation-1",
      createdAt: timestamp,
      lastActivityAt: timestamp,
      retentionUntil: "2026-07-20T00:00:00.000Z",
      expiresAt: "2026-07-26T00:00:00.000Z"
    },
    conversationId: "conversation-1",
    baseCommitSha: assignment.baseCommitSha,
    resultingCommitSha: assignment.baseCommitSha,
    changedFiles: ["apps/structured-data/app/domain/remediation-links.ts"],
    patchArtifact: "git/patch.diff",
    validationResults: [
      {
        commandId: validation.id,
        exitCode: 0,
        stdoutArtifact: `validation/${validation.id}.stdout.log`,
        stderrArtifact: `validation/${validation.id}.stderr.log`,
        startedAt: timestamp,
        endedAt: timestamp,
        timedOut: false
      }
    ],
    metrics: {
      elapsedMs: 1_000,
      turns: 1,
      promptTokens: 100,
      cachedPromptTokens: null,
      completionTokens: 50,
      estimatedCostUsd: null
    },
    artifacts: [
      {
        relativePath: "git/patch.diff",
        mediaType: "text/x-diff",
        byteLength: 100,
        sha256: "a".repeat(64)
      }
    ],
    failure: null
  })
}

function publicationInput(assignment: Assignment): DraftPullRequestInput {
  return {
    assignment,
    workerResult: workerResult(assignment),
    patchArtifactPath: "D:/artifacts/git/patch.diff"
  }
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

describe("GitHubAppPublisher", () => {
  it("merges only the exact reviewed pull-request head", async () => {
    const reviewedSha = "d".repeat(40)
    const mergeSha = "e".repeat(40)
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const fetcher = vi.fn(async (request: string | URL | Request, init?: RequestInit) => {
      const url = request.toString()
      requests.push({ url, init })
      if (url.endsWith("/access_tokens")) {
        return response({ token: "installation-token", expires_at: "2026-07-19T01:00:00.000Z" }, 201)
      }
      if (url.endsWith("/pulls/42") && init?.method === "GET") {
        return response({ number: 42, node_id: "PR_node", draft: false, state: "open", head: { sha: reviewedSha } })
      }
      if (url.endsWith("/pulls/42/merge")) {
        return response({ sha: mergeSha, merged: true, message: "Pull Request successfully merged" })
      }
      return response({ message: "Not Found" }, 404)
    })
    const publisher = new GitHubAppPublisher({
      tokenProvider,
      fetcher
    })

    await expect(publisher.mergePullRequest("AndrewCraswell", "agency", 42, reviewedSha)).resolves.toBe(mergeSha)

    const mergeRequest = requests.find(({ url }) => url.endsWith("/pulls/42/merge"))
    expect(mergeRequest?.init?.method).toBe("PUT")
    expect(JSON.parse(String(mergeRequest?.init?.body))).toEqual({ sha: reviewedSha, merge_method: "squash" })
  })

  it("materializes a validated patch and creates one draft pull request", async () => {
    const assignment = await assignmentFixture()
    const input = publicationInput(assignment)
    const branch = `agent/${assignment.runId}`
    const commitSha = "b".repeat(40)
    let referenceLookups = 0
    const fetcher = vi.fn(async (request: string | URL | Request, init?: RequestInit) => {
      const url = request.toString()
      if (url.endsWith("/access_tokens")) {
        return response({ token: "installation-token", expires_at: "2026-07-19T01:00:00.000Z" }, 201)
      }
      if (url.endsWith("/repos/AndrewCraswell/fencing-club-shopify-theme")) {
        return response({ default_branch: "master" })
      }
      if (url.includes("/git/ref/heads/")) {
        referenceLookups += 1
        return referenceLookups === 1
          ? response({ message: "Not Found" }, 404)
          : response({ object: { sha: commitSha } })
      }
      if (url.includes("/pulls?")) {
        return response([])
      }
      if (url.endsWith("/pulls") && init?.method === "POST") {
        return response(
          {
            number: 42,
            html_url: "https://github.com/AndrewCraswell/fencing-club-shopify-theme/pull/42",
            body: "draft",
            head: { sha: commitSha }
          },
          201
        )
      }
      return response({ message: `Unexpected request ${url}` }, 500)
    })
    let revParseCalls = 0
    const gitRunner = vi.fn<GitCommandRunner>(async (arguments_) => {
      if (arguments_[0] === "rev-parse") {
        revParseCalls += 1
        return { stdout: `${revParseCalls === 1 ? assignment.baseCommitSha : commitSha}\n`, stderr: "" }
      }
      if (arguments_.includes("--name-only")) {
        return { stdout: `${input.workerResult.changedFiles[0]}\n`, stderr: "" }
      }
      return { stdout: "", stderr: "" }
    })
    const publisher = new GitHubAppPublisher({
      tokenProvider,
      fetcher,
      gitRunner
    })

    const result = await publisher.publish(input)

    expect(result).toMatchObject({
      branch,
      pullRequestNumber: 42,
      headCommitSha: commitSha,
      updatedExisting: false
    })
    expect(
      gitRunner.mock.calls.some(([arguments_]) => arguments_[0] === "apply" && arguments_.includes("--check"))
    ).toBe(true)
    expect(
      gitRunner.mock.calls.some(
        ([arguments_]) => arguments_[0] === "push" && arguments_.includes(`HEAD:refs/heads/${branch}`)
      )
    ).toBe(true)
  })

  it("updates an existing run-owned pull request without invoking Git", async () => {
    const assignment = await assignmentFixture()
    const headCommitSha = "c".repeat(40)
    const marker = `<!-- agent-run-id:${assignment.runId} -->`
    const fetcher = vi.fn(async (request: string | URL | Request, init?: RequestInit) => {
      const url = request.toString()
      if (url.endsWith("/access_tokens")) {
        return response({ token: "installation-token", expires_at: "2026-07-19T01:00:00.000Z" }, 201)
      }
      if (url.endsWith("/repos/AndrewCraswell/fencing-club-shopify-theme")) {
        return response({ default_branch: "master" })
      }
      if (url.includes("/git/ref/heads/")) {
        return response({ object: { sha: headCommitSha } })
      }
      if (url.includes("/pulls?")) {
        return response([
          {
            number: 42,
            html_url: "https://github.com/AndrewCraswell/fencing-club-shopify-theme/pull/42",
            body: marker,
            head: { sha: headCommitSha }
          }
        ])
      }
      if (url.endsWith("/pulls/42") && init?.method === "PATCH") {
        return response({
          number: 42,
          html_url: "https://github.com/AndrewCraswell/fencing-club-shopify-theme/pull/42",
          body: marker,
          head: { sha: headCommitSha }
        })
      }
      return response({ message: `Unexpected request ${url}` }, 500)
    })
    const gitRunner = vi.fn<GitCommandRunner>()
    const publisher = new GitHubAppPublisher({
      tokenProvider,
      fetcher,
      gitRunner
    })

    const result = await publisher.publish(publicationInput(assignment))

    expect(result.updatedExisting).toBe(true)
    expect(result.pullRequestNumber).toBe(42)
    expect(gitRunner).not.toHaveBeenCalled()
  })

  it("rejects an existing branch that is not owned by the workflow run", async () => {
    const assignment = await assignmentFixture()
    const headCommitSha = "d".repeat(40)
    const fetcher = vi.fn(async (request: string | URL | Request) => {
      const url = request.toString()
      if (url.endsWith("/access_tokens")) {
        return response({ token: "installation-token", expires_at: "2026-07-19T01:00:00.000Z" }, 201)
      }
      if (url.endsWith("/repos/AndrewCraswell/fencing-club-shopify-theme")) {
        return response({ default_branch: "master" })
      }
      if (url.includes("/git/ref/heads/")) {
        return response({ object: { sha: headCommitSha } })
      }
      if (url.includes("/pulls?")) {
        return response([])
      }
      if (url.includes("/git/commits/")) {
        return response({ message: "human-authored branch" })
      }
      return response({ message: `Unexpected request ${url}` }, 500)
    })
    const gitRunner = vi.fn<GitCommandRunner>()
    const publisher = new GitHubAppPublisher({
      tokenProvider,
      fetcher,
      gitRunner
    })

    await expect(publisher.publish(publicationInput(assignment))).rejects.toThrow("is not owned by run")
    expect(gitRunner).not.toHaveBeenCalled()
  })

  it("rejects non-publishable worker results before requesting a token", async () => {
    const assignment = await assignmentFixture()
    const input = publicationInput(assignment)
    const fetcher = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>()
    const publisher = new GitHubAppPublisher({
      tokenProvider,
      fetcher
    })

    await expect(
      publisher.publish({ ...input, workerResult: { ...input.workerResult, patchArtifact: null } })
    ).rejects.toThrow("Only a completed worker result with a patch can be published")
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("reuses a run-owned branch and creates its missing draft pull request", async () => {
    const assignment = await assignmentFixture()
    const branchSha = "e".repeat(40)
    const marker = `Agent-Run-ID: ${assignment.runId}`
    const fetcher = vi.fn(async (request: string | URL | Request, init?: RequestInit) => {
      const url = request.toString()
      if (url.endsWith("/access_tokens")) {
        return response({ token: "installation-token", expires_at: "2026-07-19T01:00:00.000Z" }, 201)
      }
      if (url.endsWith("/repos/AndrewCraswell/fencing-club-shopify-theme")) {
        return response({ default_branch: "master" })
      }
      if (url.includes("/git/ref/heads/")) {
        return response({ object: { sha: branchSha } })
      }
      if (url.includes("/pulls?")) {
        return response([])
      }
      if (url.includes("/git/commits/")) {
        return response({ message: marker })
      }
      if (url.endsWith("/pulls") && init?.method === "POST") {
        return response(
          {
            number: 43,
            html_url: "https://github.com/AndrewCraswell/fencing-club-shopify-theme/pull/43",
            body: "draft",
            head: { sha: branchSha }
          },
          201
        )
      }
      return response({ message: `Unexpected request ${url}` }, 500)
    })
    const gitRunner = vi.fn<GitCommandRunner>()
    const publisher = new GitHubAppPublisher({
      tokenProvider,
      apiBaseUrl: "https://api.github.test/",
      fetcher,
      gitRunner
    })

    await expect(publisher.publish(publicationInput(assignment))).resolves.toMatchObject({
      pullRequestNumber: 43,
      headCommitSha: branchSha,
      updatedExisting: false
    })
    expect(gitRunner).not.toHaveBeenCalled()
  })

  it("reports GitHub reference lookup failures", async () => {
    const assignment = await assignmentFixture()
    const fetcher = vi.fn(async (request: string | URL | Request) => {
      const url = request.toString()
      if (url.endsWith("/access_tokens")) {
        return response({ token: "installation-token", expires_at: "2026-07-19T01:00:00.000Z" }, 201)
      }
      if (url.endsWith("/repos/AndrewCraswell/fencing-club-shopify-theme")) {
        return response({ default_branch: "master" })
      }
      return response({ message: "unavailable" }, 503)
    })
    const publisher = new GitHubAppPublisher({
      tokenProvider,
      fetcher,
      gitRunner: vi.fn<GitCommandRunner>()
    })

    await expect(publisher.publish(publicationInput(assignment))).rejects.toThrow(
      "GitHub reference lookup failed with status 503"
    )
  })

  it.each([
    { name: "wrong checkout SHA", head: "f".repeat(40), status: "", files: "" },
    { name: "dirty checkout", head: null, status: " M local.txt\n", files: "" },
    { name: "changed-file mismatch", head: null, status: "", files: "other-file.ts\n" }
  ])("rejects a fresh publication checkout with $name", async ({ head, status, files }) => {
    const assignment = await assignmentFixture()
    const fetcher = vi.fn(async (request: string | URL | Request) => {
      const url = request.toString()
      if (url.endsWith("/access_tokens")) {
        return response({ token: "installation-token", expires_at: "2026-07-19T01:00:00.000Z" }, 201)
      }
      if (url.endsWith("/repos/AndrewCraswell/fencing-club-shopify-theme")) {
        return response({ default_branch: "master" })
      }
      if (url.includes("/git/ref/heads/")) {
        return response({ message: "Not Found" }, 404)
      }
      if (url.includes("/pulls?")) {
        return response([])
      }
      return response({ message: `Unexpected request ${url}` }, 500)
    })
    const gitRunner = vi.fn<GitCommandRunner>(async (arguments_) => {
      if (arguments_[0] === "rev-parse") {
        return { stdout: `${head ?? assignment.baseCommitSha}\n`, stderr: "" }
      }
      if (arguments_[0] === "status") {
        return { stdout: status, stderr: "" }
      }
      if (arguments_.includes("--name-only")) {
        return { stdout: files, stderr: "" }
      }
      return { stdout: "", stderr: "" }
    })
    const publisher = new GitHubAppPublisher({
      tokenProvider,
      fetcher,
      gitRunner
    })

    await expect(publisher.publish(publicationInput(assignment))).rejects.toThrow()
  })
})
