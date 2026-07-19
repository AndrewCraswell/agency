import { describe, expect, it } from "vitest"
import { normalizeGitHubEvent } from "./normalize"

const deliveryId = "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1"
const receivedAt = new Date("2026-07-19T12:00:00.000Z")

function normalize(eventName: string, payload: Record<string, unknown>) {
  return normalizeGitHubEvent({
    deliveryId,
    eventName,
    rawBody: Buffer.from(JSON.stringify(payload)),
    receivedAt,
    assignmentLabel: "agency-agent",
    botLogin: "agency-agent[bot]",
    correlationId: "dff7a1a0-2c52-4e3f-a325-90d314f81820"
  })
}

const repository = { name: "agency", owner: { login: "AndrewCraswell" } }
const sender = { login: "andrew", type: "User" }

describe("normalizeGitHubEvent", () => {
  it("maps the configured issue label to a create command", () => {
    const envelope = normalize("issues", {
      action: "labeled",
      repository,
      sender,
      installation: { id: 42 },
      label: { name: "agency-agent" },
      issue: { number: 123, title: "Bounded task", body: "Untrusted issue body" }
    })

    expect(envelope).toMatchObject({
      operation: "create",
      repository: { owner: "AndrewCraswell", name: "agency" },
      issueNumber: 123,
      untrustedText: { title: "Bounded task", body: "Untrusted issue body" }
    })
  })

  it.each([
    ["/agency resume", "resume"],
    ["/agency retry", "resume"],
    ["/agency cancel", "cancel"]
  ] as const)("parses the exact %s command", (body, operation) => {
    expect(
      normalize("issue_comment", {
        action: "created",
        repository,
        sender,
        issue: { number: 123, title: "Task", body: null },
        comment: { body }
      }).operation
    ).toBe(operation)
  })

  it("ignores prose, unsupported actions, and bot loops", () => {
    expect(
      normalize("issue_comment", {
        action: "created",
        repository,
        sender,
        issue: { number: 123, title: "Task", body: null },
        comment: { body: "please /agency resume now" }
      }).operation
    ).toBe("ignore")
    expect(
      normalize("issues", {
        action: "labeled",
        repository,
        sender: { login: "agency-agent[bot]", type: "Bot" },
        label: { name: "agency-agent" },
        issue: { number: 123, title: "Task", body: null }
      }).operation
    ).toBe("ignore")
  })

  it.each([
    ["pull_request", "synchronize", "request_review"],
    ["pull_request", "closed", "cancel"],
    ["check_run", "completed", "record_evidence"],
    ["check_suite", "completed", "record_evidence"]
  ] as const)("maps %s.%s to %s", (eventName, action, operation) => {
    const payload: Record<string, unknown> = { action, repository, sender }
    if (eventName === "pull_request") {
      payload.pull_request = { number: 42, title: "Agent PR", body: null, head: { sha: "a".repeat(40) } }
    } else {
      payload[eventName] = { id: 99 }
    }
    expect(normalize(eventName, payload).operation).toBe(operation)
  })

  it.each(["approved", "changes_requested"] as const)("maps submitted %s reviews to apply_review", (state) => {
    const envelope = normalize("pull_request_review", {
      action: "submitted",
      repository,
      sender,
      pull_request: { number: 42, title: "Agent PR", body: null, head: { sha: "a".repeat(40) } },
      review: { id: 99, state, body: "Untrusted review body" }
    })

    expect(envelope).toMatchObject({
      operation: "apply_review",
      headCommitSha: "a".repeat(40),
      review: { id: 99, state },
      untrustedText: { body: "Untrusted review body" }
    })
  })
})
