import { generateKeyPairSync } from "node:crypto"
import { readFile } from "node:fs/promises"
import { describe, expect, it, vi } from "vitest"
import { AssignmentSchema, type Assignment } from "../contracts/assignment"
import { WorkerResultSchema, type WorkerResult } from "../contracts/results"
import { GitHubAppPublisher, type GitCommandRunner } from "./githubAppPublisher"
import type { DraftPullRequestInput } from "./publisher"

const fixtureUrl = new URL("../../tests/fixtures/phase-1-repair-assignment.json", import.meta.url)
const timestamp = "2026-07-19T00:00:00.000Z"

async function assignmentFixture(): Promise<Assignment> {
  return AssignmentSchema.parse(JSON.parse(await readFile(fixtureUrl, "utf8")))
}

function privateKey(): string {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2_048 })
  return pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString()
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
      appId: "123",
      installationId: "456",
      privateKey: privateKey(),
      fetcher,
      gitRunner,
      now: () => new Date(timestamp)
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
      appId: "123",
      installationId: "456",
      privateKey: privateKey(),
      fetcher,
      gitRunner,
      now: () => new Date(timestamp)
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
      appId: "123",
      installationId: "456",
      privateKey: privateKey(),
      fetcher,
      gitRunner,
      now: () => new Date(timestamp)
    })

    await expect(publisher.publish(publicationInput(assignment))).rejects.toThrow("is not owned by run")
    expect(gitRunner).not.toHaveBeenCalled()
  })
})
