import { describe, expect, it, vi } from "vitest"
import type { IntegrationCredentialBroker } from "../integrations/broker"
import { ProviderExecutionPortResolver, type ProviderExecutionPort } from "../integrations/providerPorts"
import type { IntegrationConnectionStore } from "../persistence/integrationStore"
import type { WorkflowEffectRecord } from "../persistence/workflowJournalStore"
import type { WorkflowStepInstance } from "./definition"
import type { JsonValue } from "./executionContracts"
import {
  WorkflowProviderExecutionError,
  WorkflowProviderExecutor,
  type ProviderEffectJournal
} from "./providerExecutor"

const connectionId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e31"
const runId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f"
const activationId = "a".repeat(64)
const now = new Date("2026-07-19T12:00:00.000Z")

function step(
  provider: "github" | "linear",
  operation: string,
  name: string,
  externalId: string,
  capabilities: string[]
): WorkflowStepInstance {
  return {
    id: "provider",
    label: "Provider",
    position: { x: 0, y: 0 },
    definition: {
      kind: operation.includes(".repository") || operation.endsWith(".issue") ? "provider_data" : "provider_action",
      version: 1
    },
    config: {
      provider,
      operation,
      binding: {
        connectionId,
        provider,
        resourceType: provider === "github" ? "repository" : "team",
        externalId,
        name,
        capabilities
      }
    },
    failurePolicy: { mode: "stop", maximumAttempts: 1 }
  }
}

function connection(provider: "github" | "linear") {
  return {
    connectionId,
    provider,
    providerConfigKey: `${provider}-integration`,
    nangoConnectionId: `${provider}-connection`,
    displayName: provider,
    status: "connected" as const,
    errorCode: null,
    lastCheckedAt: now,
    disconnectedAt: null,
    createdAt: now,
    updatedAt: now
  }
}

function effect(status: WorkflowEffectRecord["status"] = "prepared"): WorkflowEffectRecord {
  return {
    effectId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e32",
    runId,
    activationId,
    effectSlot: "provider-action",
    attemptOrdinal: 1,
    provider: "linear",
    requestDigest: "b".repeat(64),
    idempotencyKey: `${runId}:${activationId}:provider-action`,
    status,
    request: {},
    result: null,
    reconciliation: null,
    createdAt: now,
    updatedAt: now
  }
}

function dependencies(
  provider: "github" | "linear",
  resource: { resourceType: "repository" | "team"; externalId: string; name: string; stale?: boolean }
) {
  const request = vi.fn<IntegrationCredentialBroker["request"]>()
  const broker = { request } as unknown as IntegrationCredentialBroker
  const store = {
    getConnection: vi.fn(async () => connection(provider)),
    listResources: vi.fn(async () => [
      {
        connectionId,
        ...resource,
        stale: resource.stale ?? false,
        lastDiscoveredAt: now,
        createdAt: now,
        updatedAt: now
      }
    ])
  } as unknown as IntegrationConnectionStore
  const prepared = effect()
  const journal: ProviderEffectJournal = {
    reserveEffect: vi.fn<ProviderEffectJournal["reserveEffect"]>(async () => ({
      effect: prepared,
      dispatchable: true,
      reason: "prepared"
    })),
    beginEffectDispatch: vi.fn<ProviderEffectJournal["beginEffectDispatch"]>(async () => ({
      ...prepared,
      status: "dispatching"
    })),
    confirmEffect: vi.fn<ProviderEffectJournal["confirmEffect"]>(async () => ({
      ...prepared,
      status: "confirmed",
      result: {}
    })),
    classifyEffectFailure: vi.fn<ProviderEffectJournal["classifyEffectFailure"]>(async (_effectId, status) => ({
      ...prepared,
      status,
      reconciliation: {}
    }))
  }
  return { broker, request, store, journal }
}

function expectSuccessfulDispatch(values: ReturnType<typeof dependencies>) {
  expect(values.journal.reserveEffect).toHaveBeenCalledBefore(
    values.journal.beginEffectDispatch as ReturnType<typeof vi.fn>
  )
  expect(values.journal.beginEffectDispatch).toHaveBeenCalledBefore(values.request)
  expect(values.journal.confirmEffect).toHaveBeenCalledAfter(values.request)
  expect(values.journal.classifyEffectFailure).not.toHaveBeenCalled()
}

type GithubReadCase = {
  operation: "github.pull_request" | "github.pull_request_comments" | "github.pull_request_reviews" | "github.checks"
  query: Record<string, JsonValue>
  endpoint: string
  params?: { per_page: number }
  response: JsonValue
}

type GithubActionCase = {
  operation:
    | "github.create_or_update_pull_request"
    | "github.add_pull_request_comment"
    | "github.submit_pull_request_review"
    | "github.request_reviewers"
    | "github.add_labels"
    | "github.remove_label"
    | "github.set_check_status"
    | "github.merge_pull_request"
    | "github.close_pull_request"
  request: Record<string, JsonValue>
  expectedCall: { method: string; endpoint: string; data?: Record<string, JsonValue> }
}

type LinearActionCase = {
  operation:
    | "linear.create_issue"
    | "linear.update_issue"
    | "linear.add_comment"
    | "linear.add_label"
    | "linear.remove_label"
  request: Record<string, JsonValue>
  expectedMutation: string
  expectedVariables: Record<string, JsonValue>
}

describe("WorkflowProviderExecutor", () => {
  it("executes reads and durable actions through a substitutable provider port", async () => {
    const values = dependencies("github", { resourceType: "repository", externalId: "42", name: "octo/agency" })
    const read = vi.fn<ProviderExecutionPort["read"]>(async () => ({ source: "fixture-read" }))
    const act = vi.fn<ProviderExecutionPort["act"]>(async () => ({ source: "fixture-action" }))
    const executor = new WorkflowProviderExecutor(
      values.broker,
      values.store,
      values.journal,
      new ProviderExecutionPortResolver([{ provider: "github", resourceType: "repository", read, act }])
    )

    await expect(
      executor.read(step("github", "github.repository", "octo/agency", "42", ["repository.read"]), {})
    ).resolves.toEqual({ result: { source: "fixture-read" } })
    await expect(
      executor.act({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("github", "github.close_pull_request", "octo/agency", "42", ["pull_request.write"]),
        request: { pullRequestNumber: 7 }
      })
    ).resolves.toEqual({ result: { source: "fixture-action" } })

    expect(read).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: "github-connection", provider: "github" }),
      "github.repository",
      expect.objectContaining({ externalId: "42", name: "octo/agency" }),
      {}
    )
    expect(act).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: "github-connection", provider: "github" }),
      "github.close_pull_request",
      expect.objectContaining({ externalId: "42", name: "octo/agency" }),
      { pullRequestNumber: 7 }
    )
    expect(values.request).not.toHaveBeenCalled()
    expect(values.journal.confirmEffect).toHaveBeenCalledWith(expect.any(String), { source: "fixture-action" })
  })

  it("performs a bounded GitHub read through its sealed resource connection", async () => {
    const values = dependencies("github", { resourceType: "repository", externalId: "42", name: "octo/agency" })
    values.request.mockResolvedValue({ id: 42, full_name: "octo/agency" })
    const executor = new WorkflowProviderExecutor(values.broker, values.store, values.journal)

    await expect(
      executor.read(step("github", "github.repository", "octo/agency", "42", ["repository.read"]), {})
    ).resolves.toEqual({
      result: { id: 42, full_name: "octo/agency" }
    })
    expect(values.request).toHaveBeenCalledWith(expect.objectContaining({ connectionId: "github-connection" }), {
      method: "GET",
      endpoint: "/repos/octo/agency"
    })
  })

  it("routes supported GitHub read operations to the expected REST endpoints", async () => {
    const cases: GithubReadCase[] = [
      {
        operation: "github.pull_request",
        query: { pullRequestNumber: 7 },
        endpoint: "/repos/octo/agency/pulls/7",
        response: { id: 7, state: "open" }
      },
      {
        operation: "github.pull_request_comments",
        query: { pullRequestNumber: 7 },
        endpoint: "/repos/octo/agency/issues/7/comments",
        params: { per_page: 100 },
        response: [{ id: 1, body: "Ship it" }]
      },
      {
        operation: "github.pull_request_reviews",
        query: { pullRequestNumber: 7 },
        endpoint: "/repos/octo/agency/pulls/7/reviews",
        params: { per_page: 100 },
        response: [{ id: 2, state: "APPROVED" }]
      },
      {
        operation: "github.checks",
        query: { pullRequestNumber: 7, ref: "feature/new-flow" },
        endpoint: "/repos/octo/agency/commits/feature%2Fnew-flow/check-runs",
        params: { per_page: 100 },
        response: { total_count: 1, check_runs: [{ id: 3, conclusion: "success" }] }
      }
    ]
    for (const testCase of cases) {
      const values = dependencies("github", { resourceType: "repository", externalId: "42", name: "octo/agency" })
      values.request.mockResolvedValue(testCase.response)
      const executor = new WorkflowProviderExecutor(values.broker, values.store, values.journal)

      await expect(
        executor.read(step("github", testCase.operation, "octo/agency", "42", ["repository.read"]), {
          query: testCase.query
        })
      ).resolves.toEqual({ result: testCase.response })
      const expectedRequest: { method: string; endpoint: string; params?: { per_page: number } } = {
        method: "GET",
        endpoint: testCase.endpoint
      }
      if (testCase.params !== undefined) {
        expectedRequest.params = testCase.params
      }
      expect(values.request).toHaveBeenCalledWith(expect.objectContaining({ connectionId: "github-connection" }), {
        ...expectedRequest
      })
    }
  })

  it("routes supported Linear read operations through GraphQL", async () => {
    const cases = [
      {
        operation: "linear.issue",
        response: {
          issue: {
            id: "issue-1",
            team: { id: "team-1" },
            identifier: "FEN-42",
            title: "Ship",
            description: "Ready",
            priority: 1,
            url: "https://linear.app/issue/FEN-42",
            state: { id: "state-1", name: "Todo" },
            assignee: { id: "user-1", name: "Casey" },
            labels: { nodes: [{ id: "label-1", name: "frontend" }] }
          }
        },
        expectedSelection: "identifier title description priority"
      },
      {
        operation: "linear.issue_comments",
        response: {
          issue: {
            id: "issue-1",
            team: { id: "team-1" },
            comments: { nodes: [{ id: "comment-1", body: "Looks good", createdAt: now.toISOString(), user: null }] }
          }
        },
        expectedSelection: "comments(first: 100)"
      }
    ] as const
    for (const testCase of cases) {
      const values = dependencies("linear", { resourceType: "team", externalId: "team-1", name: "FEN Frontend" })
      values.request.mockResolvedValue({ data: testCase.response })
      const executor = new WorkflowProviderExecutor(values.broker, values.store, values.journal)

      await expect(
        executor.read(step("linear", testCase.operation, "FEN Frontend", "team-1", ["issue.read"]), {
          query: { issueId: "issue-1" }
        })
      ).resolves.toEqual({ result: testCase.response })
      expect(values.request).toHaveBeenCalledWith(expect.objectContaining({ connectionId: "linear-connection" }), {
        method: "POST",
        endpoint: "/graphql",
        headers: { "Content-Type": "application/json" },
        data: expect.objectContaining({
          query: expect.stringContaining(testCase.expectedSelection),
          variables: { id: "issue-1" }
        })
      })
    }
  })

  it("rejects a Linear task outside the sealed team scope", async () => {
    const values = dependencies("linear", { resourceType: "team", externalId: "team-1", name: "FEN Frontend" })
    values.request.mockResolvedValue({ data: { issue: { id: "issue-1", team: { id: "team-2" } } } })
    const executor = new WorkflowProviderExecutor(values.broker, values.store, values.journal)

    await expect(
      executor.read(step("linear", "linear.issue", "FEN Frontend", "team-1", ["issue.read"]), {
        query: { issueId: "issue-1" }
      })
    ).rejects.toThrow("outside the sealed team scope")
  })

  it("lists ready Linear tasks for the selected team", async () => {
    const values = dependencies("linear", { resourceType: "team", externalId: "team-1", name: "FEN Frontend" })
    const response = { issues: { nodes: [{ id: "issue-1", identifier: "FEN-42", title: "Ship" }] } }
    values.request.mockResolvedValue({ data: response })
    const executor = new WorkflowProviderExecutor(values.broker, values.store, values.journal)

    await expect(
      executor.read(step("linear", "linear.ready_issues", "FEN Frontend", "team-1", ["issue.read"]), {
        query: {}
      })
    ).resolves.toEqual({ result: response })
    expect(values.request).toHaveBeenCalledWith(expect.objectContaining({ connectionId: "linear-connection" }), {
      method: "POST",
      endpoint: "/graphql",
      headers: { "Content-Type": "application/json" },
      data: expect.objectContaining({
        query: expect.stringContaining("AgencyWorkflowReadyIssues"),
        variables: { teamId: "team-1", first: 25 }
      })
    })
  })

  it("reserves, dispatches, and confirms one Linear mutation", async () => {
    const values = dependencies("linear", { resourceType: "team", externalId: "team-1", name: "FEN Frontend" })
    values.request.mockResolvedValue({
      data: {
        issueCreate: {
          success: true,
          issue: { id: "issue-1", identifier: "FEN-42", title: "Ship", url: "https://linear.app/issue/FEN-42" }
        }
      }
    })
    const executor = new WorkflowProviderExecutor(values.broker, values.store, values.journal)

    await expect(
      executor.act({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("linear", "linear.create_issue", "FEN Frontend", "team-1", ["issue.write"]),
        request: { title: "Ship" }
      })
    ).resolves.toMatchObject({ result: { issueCreate: { success: true } } })
    expectSuccessfulDispatch(values)
  })

  it("rejects malformed actions before reserving a durable effect", async () => {
    const values = dependencies("github", { resourceType: "repository", externalId: "42", name: "octo/agency" })
    const executor = new WorkflowProviderExecutor(values.broker, values.store, values.journal)

    await expect(
      executor.act({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("github", "github.add_pull_request_comment", "octo/agency", "42", ["pull_request.write"]),
        request: { pullRequestNumber: 7 }
      })
    ).rejects.toThrow()
    expect(values.journal.reserveEffect).not.toHaveBeenCalled()
    expect(values.request).not.toHaveBeenCalled()
  })

  it("classifies an explicit Linear mutation rejection as failed", async () => {
    const values = dependencies("linear", { resourceType: "team", externalId: "team-1", name: "FEN Frontend" })
    values.request.mockResolvedValue({ data: { issueCreate: { success: false, issue: null } } })
    const executor = new WorkflowProviderExecutor(values.broker, values.store, values.journal)

    await expect(
      executor.act({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("linear", "linear.create_issue", "FEN Frontend", "team-1", ["issue.write"]),
        request: { title: "Ship" }
      })
    ).rejects.toMatchObject({ code: "provider_rejected" })
    expect(values.journal.classifyEffectFailure).toHaveBeenCalledWith(
      expect.any(String),
      "failed",
      expect.objectContaining({ code: "provider_rejected" })
    )
    expect(values.journal.confirmEffect).not.toHaveBeenCalled()
  })

  it("routes supported GitHub actions to expected methods and endpoints", async () => {
    const cases: GithubActionCase[] = [
      {
        operation: "github.create_or_update_pull_request",
        request: { title: "Create PR", head: "feature", base: "main" },
        expectedCall: {
          method: "POST",
          endpoint: "/repos/octo/agency/pulls",
          data: { title: "Create PR", head: "feature", base: "main" }
        }
      },
      {
        operation: "github.create_or_update_pull_request",
        request: { pullRequestNumber: 9, title: "Update PR" },
        expectedCall: {
          method: "PATCH",
          endpoint: "/repos/octo/agency/pulls/9",
          data: { pullRequestNumber: 9, title: "Update PR" }
        }
      },
      {
        operation: "github.add_pull_request_comment",
        request: { pullRequestNumber: 7, body: "Ready" },
        expectedCall: {
          method: "POST",
          endpoint: "/repos/octo/agency/issues/7/comments",
          data: { body: "Ready" }
        }
      },
      {
        operation: "github.submit_pull_request_review",
        request: { pullRequestNumber: 7, body: "Ship it", event: "APPROVE" },
        expectedCall: {
          method: "POST",
          endpoint: "/repos/octo/agency/pulls/7/reviews",
          data: { pullRequestNumber: 7, body: "Ship it", event: "APPROVE" }
        }
      },
      {
        operation: "github.request_reviewers",
        request: { pullRequestNumber: 7, reviewers: ["octocat"] },
        expectedCall: {
          method: "POST",
          endpoint: "/repos/octo/agency/pulls/7/requested_reviewers",
          data: { pullRequestNumber: 7, reviewers: ["octocat"] }
        }
      },
      {
        operation: "github.add_labels",
        request: { pullRequestNumber: 7, labels: ["ready"] },
        expectedCall: {
          method: "POST",
          endpoint: "/repos/octo/agency/issues/7/labels",
          data: { labels: ["ready"] }
        }
      },
      {
        operation: "github.remove_label",
        request: { pullRequestNumber: 7, label: "bug/needs-triage" },
        expectedCall: {
          method: "DELETE",
          endpoint: "/repos/octo/agency/issues/7/labels/bug%2Fneeds-triage"
        }
      },
      {
        operation: "github.set_check_status",
        request: {
          pullRequestNumber: 7,
          name: "ci",
          head_sha: "abc123",
          status: "completed",
          conclusion: "success"
        },
        expectedCall: {
          method: "POST",
          endpoint: "/repos/octo/agency/check-runs",
          data: {
            pullRequestNumber: 7,
            name: "ci",
            head_sha: "abc123",
            status: "completed",
            conclusion: "success"
          }
        }
      },
      {
        operation: "github.merge_pull_request",
        request: { pullRequestNumber: 7, merge_method: "squash" },
        expectedCall: {
          method: "PUT",
          endpoint: "/repos/octo/agency/pulls/7/merge",
          data: { pullRequestNumber: 7, merge_method: "squash" }
        }
      },
      {
        operation: "github.close_pull_request",
        request: { pullRequestNumber: 7 },
        expectedCall: {
          method: "PATCH",
          endpoint: "/repos/octo/agency/pulls/7",
          data: { state: "closed" }
        }
      }
    ]
    for (const testCase of cases) {
      const values = dependencies("github", { resourceType: "repository", externalId: "42", name: "octo/agency" })
      values.request.mockResolvedValue({ ok: true })
      const executor = new WorkflowProviderExecutor(values.broker, values.store, values.journal)

      await expect(
        executor.act({
          runId,
          activationId,
          attemptOrdinal: 1,
          step: step("github", testCase.operation, "octo/agency", "42", ["pull_request.write", "repository.write"]),
          request: testCase.request
        })
      ).resolves.toEqual({ result: { ok: true } })
      expect(values.request).toHaveBeenCalledWith(expect.objectContaining({ connectionId: "github-connection" }), {
        ...testCase.expectedCall
      })
      expectSuccessfulDispatch(values)
    }
  })

  it("routes supported Linear actions through the expected GraphQL mutations", async () => {
    const cases: LinearActionCase[] = [
      {
        operation: "linear.create_issue",
        request: { title: "Ship" },
        expectedMutation: "mutation AgencyCreateIssue",
        expectedVariables: { input: { title: "Ship", teamId: "team-1" } }
      },
      {
        operation: "linear.update_issue",
        request: { issueId: "issue-1", input: { title: "Rename" } },
        expectedMutation: "mutation AgencyUpdateIssue",
        expectedVariables: { id: "issue-1", input: { title: "Rename" } }
      },
      {
        operation: "linear.add_comment",
        request: { issueId: "issue-1", body: "Ready" },
        expectedMutation: "mutation AgencyAddComment",
        expectedVariables: { input: { issueId: "issue-1", body: "Ready" } }
      },
      {
        operation: "linear.add_label",
        request: { issueId: "issue-1", labelId: "label-1" },
        expectedMutation: "issueAddLabel",
        expectedVariables: { id: "issue-1", labelId: "label-1" }
      },
      {
        operation: "linear.remove_label",
        request: { issueId: "issue-1", labelId: "label-1" },
        expectedMutation: "issueRemoveLabel",
        expectedVariables: { id: "issue-1", labelId: "label-1" }
      }
    ]
    for (const testCase of cases) {
      const values = dependencies("linear", { resourceType: "team", externalId: "team-1", name: "FEN Frontend" })
      values.request.mockResolvedValue({ data: { ok: true } })
      const executor = new WorkflowProviderExecutor(values.broker, values.store, values.journal)

      await expect(
        executor.act({
          runId,
          activationId,
          attemptOrdinal: 1,
          step: step("linear", testCase.operation, "FEN Frontend", "team-1", ["issue.write"]),
          request: testCase.request
        })
      ).resolves.toEqual({ result: { ok: true } })
      expect(values.request).toHaveBeenCalledWith(expect.objectContaining({ connectionId: "linear-connection" }), {
        method: "POST",
        endpoint: "/graphql",
        headers: { "Content-Type": "application/json" },
        data: {
          query: expect.stringContaining(testCase.expectedMutation),
          variables: testCase.expectedVariables
        }
      })
      expectSuccessfulDispatch(values)
    }
  })

  it("short-circuits provider actions when reserveEffect returns a confirmed result", async () => {
    const values = dependencies("github", { resourceType: "repository", externalId: "42", name: "octo/agency" })
    const confirmed = effect("confirmed")
    const result = { cached: true }
    values.journal.reserveEffect = vi.fn<ProviderEffectJournal["reserveEffect"]>(async () => ({
      effect: { ...confirmed, result },
      dispatchable: false,
      reason: "confirmed"
    }))
    const executor = new WorkflowProviderExecutor(values.broker, values.store, values.journal)

    await expect(
      executor.act({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("github", "github.add_pull_request_comment", "octo/agency", "42", ["pull_request.write"]),
        request: { pullRequestNumber: 7, body: "Ready" }
      })
    ).resolves.toEqual({ result })
    expect(values.request).not.toHaveBeenCalled()
    expect(values.journal.beginEffectDispatch).not.toHaveBeenCalled()
    expect(values.journal.confirmEffect).not.toHaveBeenCalled()
    expect(values.journal.classifyEffectFailure).not.toHaveBeenCalled()
  })

  it("blocks dispatch for in-progress, conflict, and unknown reserveEffect outcomes", async () => {
    const cases = [
      { status: "dispatching" as const, reason: "in_progress" as const },
      { status: "conflict" as const, reason: "conflict" as const },
      { status: "unknown" as const, reason: "unknown" as const }
    ]
    for (const testCase of cases) {
      const values = dependencies("github", { resourceType: "repository", externalId: "42", name: "octo/agency" })
      values.journal.reserveEffect = vi.fn(async () => ({
        effect: effect(testCase.status),
        dispatchable: false,
        reason: testCase.reason
      }))
      const executor = new WorkflowProviderExecutor(values.broker, values.store, values.journal)

      await expect(
        executor.act({
          runId,
          activationId,
          attemptOrdinal: 1,
          step: step("github", "github.add_pull_request_comment", "octo/agency", "42", ["pull_request.write"]),
          request: { pullRequestNumber: 7, body: "Ready" }
        })
      ).rejects.toMatchObject({ code: `provider_effect_${testCase.reason}` })
      expect(values.journal.beginEffectDispatch).not.toHaveBeenCalled()
      expect(values.request).not.toHaveBeenCalled()
      expect(values.journal.confirmEffect).not.toHaveBeenCalled()
      expect(values.journal.classifyEffectFailure).not.toHaveBeenCalled()
    }
  })

  it("records an ambiguous mutation outcome as unknown and blocks blind success", async () => {
    const values = dependencies("github", { resourceType: "repository", externalId: "42", name: "octo/agency" })
    values.request.mockRejectedValue(new Error("Connection closed after dispatch"))
    const executor = new WorkflowProviderExecutor(values.broker, values.store, values.journal)

    await expect(
      executor.act({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("github", "github.add_pull_request_comment", "octo/agency", "42", ["pull_request.write"]),
        request: { pullRequestNumber: 7, body: "Ready" }
      })
    ).rejects.toMatchObject({ code: "provider_outcome_unknown" })
    expect(values.journal.classifyEffectFailure).toHaveBeenCalledWith(
      expect.any(String),
      "unknown",
      expect.objectContaining({ code: "provider_outcome_unknown" })
    )
    expect(values.journal.confirmEffect).not.toHaveBeenCalled()
  })

  it("classifies non-Error provider dispatch failures as unknown with a default message", async () => {
    const values = dependencies("github", { resourceType: "repository", externalId: "42", name: "octo/agency" })
    values.request.mockRejectedValue("socket reset")
    const executor = new WorkflowProviderExecutor(values.broker, values.store, values.journal)

    await expect(
      executor.act({
        runId,
        activationId,
        attemptOrdinal: 1,
        step: step("github", "github.add_pull_request_comment", "octo/agency", "42", ["pull_request.write"]),
        request: { pullRequestNumber: 7, body: "Ready" }
      })
    ).rejects.toMatchObject({ code: "provider_outcome_unknown", message: "Provider action outcome is unknown" })
    expect(values.journal.classifyEffectFailure).toHaveBeenCalledWith(
      expect.any(String),
      "unknown",
      expect.objectContaining({
        code: "provider_outcome_unknown",
        message: "Provider action outcome is unknown"
      })
    )
    expect(values.journal.confirmEffect).not.toHaveBeenCalled()
  })

  it("rejects stale resources before contacting the provider", async () => {
    const values = dependencies("github", {
      resourceType: "repository",
      externalId: "42",
      name: "octo/agency",
      stale: true
    })
    const executor = new WorkflowProviderExecutor(values.broker, values.store, values.journal)

    try {
      await executor.read(step("github", "github.repository", "octo/agency", "42", ["repository.read"]), {})
      throw new Error("Expected stale resource rejection")
    } catch (error) {
      expect(error).toBeInstanceOf(WorkflowProviderExecutionError)
      expect((error as WorkflowProviderExecutionError).code).toBe("provider_resource_stale")
    }
    expect(values.request).not.toHaveBeenCalled()
  })
})
