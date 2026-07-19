import { z } from "zod"
import { ReviewResultSchema } from "../contracts/specialized"
import type {
  ControlPlaneStore,
  ReviewControlPlaneStore,
  ReviewCycleRecord,
  WorkflowRunRecord,
  WorkspaceLeaseRecord
} from "../persistence/controlPlaneStore"

export type ReviewLoopStore = Pick<
  ControlPlaneStore,
  "getWorkflowRun" | "recordWorkflowEvent" | "setWorkflowProgress"
> &
  Pick<ReviewControlPlaneStore, "createReviewCycle" | "getWorkspaceLease" | "listReviewCycles" | "updateReviewCycle">

type ReviewResult = z.infer<typeof ReviewResultSchema>

export interface ReviewLoopActions {
  review(run: WorkflowRunRecord, cycle: ReviewCycleRecord): Promise<unknown>
  merge(run: WorkflowRunRecord, cycle: ReviewCycleRecord, review: ReviewResult): Promise<void>
  repair(
    run: WorkflowRunRecord,
    cycle: ReviewCycleRecord,
    review: ReviewResult,
    coderWorkspace: WorkspaceLeaseRecord
  ): Promise<{ candidateCommitSha: string }>
  abandon(run: WorkflowRunRecord, cycle: ReviewCycleRecord, review: ReviewResult): Promise<void>
}

export function reviewAction(
  reviewRound: number,
  disposition: ReviewResult["disposition"]
): "merge" | "repair" | "block" | "abandon" {
  const round = z.number().int().min(1).max(3).parse(reviewRound)
  if (disposition === "approved") {
    return "merge"
  }
  if (round === 3) {
    return "abandon"
  }
  return disposition === "changes_requested" ? "repair" : "block"
}

export class ReviewLoopExecutor {
  readonly #store: ReviewLoopStore
  readonly #actions: ReviewLoopActions
  #active = false

  constructor(store: ReviewLoopStore, actions: ReviewLoopActions) {
    this.#store = store
    this.#actions = actions
  }

  async dispatchPending(): Promise<number> {
    if (this.#active) {
      return 0
    }
    const cycle = (await this.#store.listReviewCycles(["queued"], 20))[0]
    if (cycle === undefined) {
      return 0
    }
    this.#active = true
    try {
      await this.#execute(cycle)
      return 1
    } finally {
      this.#active = false
    }
  }

  async #execute(cycle: ReviewCycleRecord): Promise<void> {
    try {
      const run = await this.#store.getWorkflowRun(cycle.runId)
      if (run === null) {
        throw new Error(`Review run ${cycle.runId} does not exist`)
      }
      await this.#store.updateReviewCycle({ runId: cycle.runId, reviewRound: cycle.reviewRound, status: "running" })
      await this.#store.setWorkflowProgress(run.runId, "running", "reviewing", "reviewer")
      const review = ReviewResultSchema.parse(await this.#actions.review(run, cycle))
      if (review.reviewAttempt !== cycle.reviewRound || review.candidateCommitSha !== cycle.candidateCommitSha) {
        throw new Error("Reviewer output does not match the durable review cycle")
      }
      const action = reviewAction(cycle.reviewRound, review.disposition)
      if (action === "merge") {
        await this.#actions.merge(run, cycle, review)
        await this.#store.updateReviewCycle({
          runId: run.runId,
          reviewRound: cycle.reviewRound,
          status: "merged",
          findings: review.findings
        })
        await this.#store.setWorkflowProgress(run.runId, "published", "completed", null)
      } else if (action === "repair") {
        const coderWorkspace = await this.#store.getWorkspaceLease(run.runId, "coder", 1)
        if (coderWorkspace === null) {
          throw new Error("Repair requires the retained coder workspace")
        }
        await this.#store.setWorkflowProgress(run.runId, "running", "repairing", "repairer")
        const repair = await this.#actions.repair(run, cycle, review, coderWorkspace)
        await this.#store.updateReviewCycle({
          runId: run.runId,
          reviewRound: cycle.reviewRound,
          status: "changes_requested",
          findings: review.findings
        })
        await this.#store.createReviewCycle({
          runId: run.runId,
          reviewRound: cycle.reviewRound + 1,
          candidateCommitSha: repair.candidateCommitSha,
          reviewerAgentId: "reviewer"
        })
        await this.#store.setWorkflowProgress(run.runId, "running", "reviewing", "reviewer")
      } else if (action === "abandon") {
        await this.#actions.abandon(run, cycle, review)
        await this.#store.updateReviewCycle({
          runId: run.runId,
          reviewRound: cycle.reviewRound,
          status: "abandoned",
          findings: review.findings
        })
        await this.#store.setWorkflowProgress(run.runId, "blocked", "completed", null)
      } else {
        await this.#store.updateReviewCycle({
          runId: run.runId,
          reviewRound: cycle.reviewRound,
          status: "blocked",
          findings: review.findings
        })
        await this.#store.setWorkflowProgress(run.runId, "blocked", "reviewing", null)
      }
      await this.#store.recordWorkflowEvent(run.runId, {
        sourceId: `review:${cycle.reviewRound}:${cycle.candidateCommitSha}`,
        node: `review.${action}`,
        outcome: action === "block" || action === "abandon" ? "failed" : "completed",
        summary: `Review round ${cycle.reviewRound} routed to ${action}`,
        details: { disposition: review.disposition, findingIds: review.findings.map((finding) => finding.id) },
        createdAt: new Date()
      })
    } catch (error) {
      await this.#store.updateReviewCycle({
        runId: cycle.runId,
        reviewRound: cycle.reviewRound,
        status: "blocked"
      })
      await this.#store.setWorkflowProgress(cycle.runId, "failed", "reviewing", null)
      await this.#store.recordWorkflowEvent(cycle.runId, {
        sourceId: `review:${cycle.reviewRound}:${cycle.candidateCommitSha}:failure`,
        node: "review.execute",
        outcome: "failed",
        summary: error instanceof Error ? error.message : "Review execution failed",
        details: { reviewRound: cycle.reviewRound, candidateCommitSha: cycle.candidateCommitSha },
        createdAt: new Date()
      })
    }
  }
}
