import { createHash } from "node:crypto"
import type { WebhookEnvelope } from "../contracts/webhook"
import type {
  BindWorkflowRunInput,
  ControlPlaneStore,
  ReviewControlPlaneStore,
  WorkflowRunRecord
} from "../persistence/controlPlaneStore"
import type { WebhookEventRouter } from "./service"

function deterministicUuid(value: string): string {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hexadecimal = bytes.toString("hex")
  return `${hexadecimal.slice(0, 8)}-${hexadecimal.slice(8, 12)}-${hexadecimal.slice(12, 16)}-${hexadecimal.slice(16, 20)}-${hexadecimal.slice(20)}`
}

function correlationKey(envelope: WebhookEnvelope): string | null {
  if (envelope.repository === null) {
    return null
  }
  const workItemNumber = envelope.issueNumber ?? envelope.pullRequestNumber
  if (workItemNumber === null) {
    return null
  }
  return `${envelope.installationId ?? "no-installation"}:${envelope.repository.owner}/${envelope.repository.name}:${workItemNumber}:1`
}

function binding(envelope: WebhookEnvelope, key: string): BindWorkflowRunInput {
  if (envelope.repository === null) {
    throw new Error("A workflow-creating webhook requires a repository")
  }
  const input = {
    runId: deterministicUuid(`run:${key}`),
    graphVersion: "github-delivery-v1",
    repositoryOwner: envelope.repository.owner,
    repositoryName: envelope.repository.name,
    sourceWorkItemId: deterministicUuid(`source:${key}`),
    sourceWorkItemIdentifier: `#${envelope.issueNumber ?? envelope.pullRequestNumber}`
  }
  return { ...input, requestDigest: createHash("sha256").update(JSON.stringify(input)).digest("hex") }
}

export class DurableWebhookRouter implements WebhookEventRouter {
  readonly #store: ControlPlaneStore & ReviewControlPlaneStore

  constructor(store: ControlPlaneStore & ReviewControlPlaneStore) {
    this.#store = store
  }

  async route(envelope: WebhookEnvelope): Promise<void> {
    if (envelope.pullRequestNumber !== null && envelope.repository !== null) {
      const run = await this.#store.findWorkflowRunByPullRequest(
        envelope.repository.owner,
        envelope.repository.name,
        envelope.pullRequestNumber
      )
      if (run !== null && envelope.operation === "request_review") {
        await this.#requestReview(run, envelope)
        return
      }
      if (run !== null && envelope.operation === "apply_review") {
        await this.#applyReview(run, envelope)
        return
      }
      if (run !== null && envelope.operation === "cancel") {
        await this.#store.setWorkflowProgress(run.runId, "cancelled", "completed", null)
        await this.#recordEvent(run, envelope)
        return
      }
    }
    const key = correlationKey(envelope)
    if (envelope.operation === "ignore" || key === null) {
      return
    }
    const runBinding = binding(envelope, key)
    const existing = await this.#store.getWorkflowRun(runBinding.runId)

    if (envelope.operation === "create") {
      const run = existing ?? (await this.#store.bindWorkflowRun(runBinding))
      await this.#store.setWorkflowProgress(run.runId, "blocked", "planning", null)
      await this.#store.recordWorkflowEvent(run.runId, {
        sourceId: `webhook:${envelope.deliveryId}`,
        node: "routeGitHubIssue",
        outcome: "failed",
        summary: "GitHub issue accepted, but GitHub work-item planning is not configured",
        details: { deliveryId: envelope.deliveryId, classification: "unsupported_source_adapter" },
        createdAt: new Date(envelope.receivedAt)
      })
      return
    }

    if (existing === null) {
      return
    }
    if (envelope.operation === "cancel") {
      await this.#store.setWorkflowProgress(existing.runId, "cancelled", "completed", null)
    } else if (envelope.operation === "resume") {
      await this.#store.setWorkflowProgress(existing.runId, "queued", "intake", null)
    }
    await this.#store.recordWorkflowEvent(existing.runId, {
      sourceId: `webhook:${envelope.deliveryId}`,
      node: `webhook.${envelope.eventName}`,
      outcome: "completed",
      summary: `Applied ${envelope.operation} from ${envelope.eventName}.${envelope.action ?? "none"}`,
      details: { deliveryId: envelope.deliveryId, operation: envelope.operation, checkId: envelope.checkId },
      createdAt: new Date(envelope.receivedAt)
    })
  }

  async #requestReview(run: WorkflowRunRecord, envelope: WebhookEnvelope): Promise<void> {
    if (envelope.headCommitSha === null) {
      throw new Error("A review request requires the exact pull-request head commit")
    }
    const latest = await this.#store.latestReviewCycle(run.runId)
    if (latest?.candidateCommitSha === envelope.headCommitSha) {
      return
    }
    const reviewRound = (latest?.reviewRound ?? 0) + 1
    if (reviewRound > 3) {
      if (latest !== null) {
        await this.#store.updateReviewCycle({
          runId: run.runId,
          reviewRound: latest.reviewRound,
          status: "abandoned"
        })
      }
      await this.#store.setWorkflowProgress(run.runId, "blocked", "completed", null)
      await this.#store.recordWorkflowEvent(run.runId, {
        sourceId: `webhook:${envelope.deliveryId}`,
        node: "review.limit",
        outcome: "failed",
        summary: "Abandoned pull request after the third review round",
        details: { deliveryId: envelope.deliveryId, candidateCommitSha: envelope.headCommitSha },
        createdAt: new Date(envelope.receivedAt)
      })
      return
    }
    await this.#store.createReviewCycle({
      runId: run.runId,
      reviewRound,
      candidateCommitSha: envelope.headCommitSha,
      reviewerAgentId: "reviewer"
    })
    await this.#store.setWorkflowProgress(run.runId, "running", "reviewing", "reviewer")
    await this.#recordEvent(run, envelope)
  }

  async #applyReview(run: WorkflowRunRecord, envelope: WebhookEnvelope): Promise<void> {
    const latest = await this.#store.latestReviewCycle(run.runId)
    if (latest === null || envelope.review === null || envelope.headCommitSha !== latest.candidateCommitSha) {
      throw new Error("Review event does not match the current candidate commit")
    }
    const status = envelope.review.state === "approved" ? "approved" : "changes_requested"
    await this.#store.updateReviewCycle({ runId: run.runId, reviewRound: latest.reviewRound, status })
    if (status === "changes_requested" && latest.reviewRound === 3) {
      await this.#store.updateReviewCycle({ runId: run.runId, reviewRound: latest.reviewRound, status: "abandoned" })
      await this.#store.setWorkflowProgress(run.runId, "blocked", "completed", null)
    } else {
      await this.#store.setWorkflowProgress(
        run.runId,
        "running",
        status === "approved" ? "reviewing" : "repairing",
        status === "approved" ? "reviewer" : "repairer"
      )
    }
    await this.#recordEvent(run, envelope)
  }

  async #recordEvent(run: WorkflowRunRecord, envelope: WebhookEnvelope): Promise<void> {
    await this.#store.recordWorkflowEvent(run.runId, {
      sourceId: `webhook:${envelope.deliveryId}`,
      node: `webhook.${envelope.eventName}`,
      outcome: "completed",
      summary: `Applied ${envelope.operation} from ${envelope.eventName}.${envelope.action ?? "none"}`,
      details: {
        deliveryId: envelope.deliveryId,
        operation: envelope.operation,
        pullRequestNumber: envelope.pullRequestNumber,
        headCommitSha: envelope.headCommitSha,
        review: envelope.review
      },
      createdAt: new Date(envelope.receivedAt)
    })
  }
}
