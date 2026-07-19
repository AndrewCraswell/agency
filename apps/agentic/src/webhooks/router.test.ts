import { describe, expect, it, vi } from "vitest"
import type { WebhookEnvelope } from "../contracts/webhook"
import { DurableWebhookRouter } from "./router"

function envelope(operation: WebhookEnvelope["operation"], deliveryId: string): WebhookEnvelope {
  return {
    schemaVersion: "1",
    provider: "github",
    deliveryId,
    correlationId: "dff7a1a0-2c52-4e3f-a325-90d314f81820",
    eventName: operation === "create" ? "issues" : "issue_comment",
    action: operation === "create" ? "labeled" : "created",
    operation,
    installationId: "42",
    repository: { owner: "AndrewCraswell", name: "agency" },
    actor: { login: "andrew", type: "User" },
    issueNumber: 123,
    pullRequestNumber: null,
    headCommitSha: null,
    review: null,
    checkId: null,
    command: operation === "cancel" ? "cancel" : null,
    untrustedText: { title: "Task", body: null },
    payloadDigest: "a".repeat(64),
    receivedAt: "2026-07-19T12:00:00.000Z"
  }
}

function pullRequestEnvelope(
  operation: WebhookEnvelope["operation"],
  overrides: Partial<WebhookEnvelope> = {}
): WebhookEnvelope {
  return {
    ...envelope(operation, "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1"),
    eventName: operation === "apply_review" ? "pull_request_review" : "pull_request",
    action: operation === "apply_review" ? "submitted" : "opened",
    issueNumber: null,
    pullRequestNumber: 42,
    headCommitSha: "a".repeat(40),
    ...overrides
  }
}

describe("DurableWebhookRouter", () => {
  it("queues one reviewer round for an exact pull-request head", async () => {
    const record = { runId: "21faf61d-4497-5bc6-8582-096d77f9fd3f" }
    const store = {
      findWorkflowRunByPullRequest: vi.fn(async () => record),
      latestReviewCycle: vi.fn(async () => null),
      createReviewCycle: vi.fn(async (input) => ({ ...input, status: "queued" })),
      setWorkflowProgress: vi.fn(async () => record),
      recordWorkflowEvent: vi.fn(async () => undefined)
    }
    const router = new DurableWebhookRouter(store as never)
    const reviewRequest = {
      ...envelope("request_review", "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1"),
      eventName: "pull_request",
      action: "opened",
      issueNumber: null,
      pullRequestNumber: 42,
      headCommitSha: "a".repeat(40)
    }

    await router.route(reviewRequest)

    expect(store.createReviewCycle).toHaveBeenCalledWith({
      runId: record.runId,
      reviewRound: 1,
      candidateCommitSha: "a".repeat(40),
      reviewerAgentId: "reviewer"
    })
    expect(store.setWorkflowProgress).toHaveBeenCalledWith(record.runId, "running", "reviewing", "reviewer")
  })

  it("creates one deterministic run and records the unsupported source boundary", async () => {
    const record = { runId: "21faf61d-4497-5bc6-8582-096d77f9fd3f" }
    const store = {
      getWorkflowRun: vi.fn(async () => null),
      bindWorkflowRun: vi.fn(async () => record),
      setWorkflowProgress: vi.fn(async () => record),
      recordWorkflowEvent: vi.fn(async () => undefined)
    }
    const router = new DurableWebhookRouter(store as never)

    await router.route(envelope("create", "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1"))

    expect(store.bindWorkflowRun).toHaveBeenCalledWith(
      expect.objectContaining({ graphVersion: "github-delivery-v1", repositoryName: "agency" })
    )
    expect(store.setWorkflowProgress).toHaveBeenCalledWith(record.runId, "blocked", "planning", null)
    expect(store.recordWorkflowEvent).toHaveBeenCalledWith(
      record.runId,
      expect.objectContaining({ summary: expect.stringContaining("not configured") })
    )
  })

  it("cancels a correlated run idempotently", async () => {
    const record = { runId: "21faf61d-4497-5bc6-8582-096d77f9fd3f" }
    const store = {
      getWorkflowRun: vi.fn(async () => record),
      bindWorkflowRun: vi.fn(),
      setWorkflowProgress: vi.fn(async () => record),
      recordWorkflowEvent: vi.fn(async () => undefined)
    }
    const router = new DurableWebhookRouter(store as never)

    await router.route(envelope("cancel", "9539b499-1c48-4770-ab32-da1cbda14d57"))

    expect(store.setWorkflowProgress).toHaveBeenCalledWith(record.runId, "cancelled", "completed", null)
    expect(store.recordWorkflowEvent).toHaveBeenCalledOnce()
  })

  it("resumes existing work and ignores uncorrelated evidence", async () => {
    const record = { runId: "21faf61d-4497-5bc6-8582-096d77f9fd3f" }
    const store = {
      getWorkflowRun: vi.fn(async () => record),
      setWorkflowProgress: vi.fn(async () => record),
      recordWorkflowEvent: vi.fn(async () => undefined)
    }
    const router = new DurableWebhookRouter(store as never)

    await router.route(envelope("resume", "9539b499-1c48-4770-ab32-da1cbda14d57"))
    await router.route({ ...envelope("record_evidence", "858355f6-a892-4fa9-af05-66c5085cc901"), repository: null })

    expect(store.setWorkflowProgress).toHaveBeenCalledWith(record.runId, "queued", "intake", null)
    expect(store.recordWorkflowEvent).toHaveBeenCalledOnce()
  })

  it("deduplicates the current review head and abandons a fourth candidate", async () => {
    const record = { runId: "21faf61d-4497-5bc6-8582-096d77f9fd3f" }
    const currentCycle = { reviewRound: 3, candidateCommitSha: "a".repeat(40) }
    const store = {
      findWorkflowRunByPullRequest: vi.fn(async () => record),
      latestReviewCycle: vi
        .fn()
        .mockResolvedValueOnce(currentCycle)
        .mockResolvedValueOnce({ ...currentCycle, candidateCommitSha: "b".repeat(40) }),
      createReviewCycle: vi.fn(),
      updateReviewCycle: vi.fn(),
      setWorkflowProgress: vi.fn(async () => record),
      recordWorkflowEvent: vi.fn(async () => undefined)
    }
    const router = new DurableWebhookRouter(store as never)

    await router.route(pullRequestEnvelope("request_review"))
    await router.route(pullRequestEnvelope("request_review"))

    expect(store.createReviewCycle).not.toHaveBeenCalled()
    expect(store.updateReviewCycle).toHaveBeenCalledWith({ runId: record.runId, reviewRound: 3, status: "abandoned" })
    expect(store.setWorkflowProgress).toHaveBeenCalledWith(record.runId, "blocked", "completed", null)
  })

  it.each([
    ["approved", 1, "reviewing", "reviewer"],
    ["changes_requested", 1, "repairing", "repairer"]
  ] as const)("applies a matching %s review", async (state, reviewRound, stage, activeRole) => {
    const record = { runId: "21faf61d-4497-5bc6-8582-096d77f9fd3f" }
    const store = {
      findWorkflowRunByPullRequest: vi.fn(async () => record),
      latestReviewCycle: vi.fn(async () => ({ reviewRound, candidateCommitSha: "a".repeat(40) })),
      updateReviewCycle: vi.fn(),
      setWorkflowProgress: vi.fn(async () => record),
      recordWorkflowEvent: vi.fn(async () => undefined)
    }
    const router = new DurableWebhookRouter(store as never)

    await router.route(pullRequestEnvelope("apply_review", { review: { id: 99, state }, action: "submitted" }))

    expect(store.updateReviewCycle).toHaveBeenCalledWith({ runId: record.runId, reviewRound, status: state })
    expect(store.setWorkflowProgress).toHaveBeenCalledWith(record.runId, "running", stage, activeRole)
  })

  it("abandons third-round requested changes and rejects stale review evidence", async () => {
    const record = { runId: "21faf61d-4497-5bc6-8582-096d77f9fd3f" }
    const store = {
      findWorkflowRunByPullRequest: vi.fn(async () => record),
      latestReviewCycle: vi
        .fn()
        .mockResolvedValueOnce({ reviewRound: 3, candidateCommitSha: "a".repeat(40) })
        .mockResolvedValueOnce(null),
      updateReviewCycle: vi.fn(),
      setWorkflowProgress: vi.fn(async () => record),
      recordWorkflowEvent: vi.fn(async () => undefined)
    }
    const router = new DurableWebhookRouter(store as never)
    const requestedChanges = pullRequestEnvelope("apply_review", {
      review: { id: 99, state: "changes_requested" }
    })

    await router.route(requestedChanges)
    await expect(router.route(requestedChanges)).rejects.toThrow("does not match the current candidate")

    expect(store.updateReviewCycle).toHaveBeenLastCalledWith({
      runId: record.runId,
      reviewRound: 3,
      status: "abandoned"
    })
    expect(store.setWorkflowProgress).toHaveBeenCalledWith(record.runId, "blocked", "completed", null)
  })

  it("cancels a pull-request-correlated run", async () => {
    const record = { runId: "21faf61d-4497-5bc6-8582-096d77f9fd3f" }
    const store = {
      findWorkflowRunByPullRequest: vi.fn(async () => record),
      setWorkflowProgress: vi.fn(async () => record),
      recordWorkflowEvent: vi.fn(async () => undefined)
    }
    const router = new DurableWebhookRouter(store as never)

    await router.route(pullRequestEnvelope("cancel", { action: "closed" }))

    expect(store.setWorkflowProgress).toHaveBeenCalledWith(record.runId, "cancelled", "completed", null)
  })
})
