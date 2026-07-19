import type { ArtifactStoreFactory } from "../azure/artifactStore"
import type { GitHubAppPublisher } from "../github/githubAppPublisher"
import type { LinearClient } from "../linear/client"
import type {
  ControlPlaneStore,
  ReviewControlPlaneStore,
  ReviewCycleRecord,
  WorkflowRunRecord
} from "../persistence/controlPlaneStore"
import { runRepairer } from "./repairRunner"
import { runReviewer, type ReviewResult } from "./reviewerRunner"
import type { ReviewLoopActions } from "./reviewLoopExecutor"

type ReviewProviderStore = ControlPlaneStore & ReviewControlPlaneStore
type GitHubReviewPort = Pick<
  GitHubAppPublisher,
  "abandonPullRequest" | "installationToken" | "mergePullRequest" | "recordReviewComment"
>
type LinearReviewPort = Pick<LinearClient, "recordAgentActivity">

export interface ReviewLoopProviderOptions {
  store: ReviewProviderStore
  github: GitHubReviewPort
  linear: LinearReviewPort
  artifactRoot(runId: string): string
  modelProviderApiKey: string
  workspaceSecretKey: string
  artifactStoreFactory?: ArtifactStoreFactory
}

function pullRequestNumber(run: WorkflowRunRecord): number {
  if (run.pullRequestNumber === null) {
    throw new Error(`Review run ${run.runId} has no pull request`)
  }
  return run.pullRequestNumber
}

function workItemId(run: WorkflowRunRecord): string {
  if (run.sourceWorkItemId === null) {
    throw new Error(`Review run ${run.runId} has no Linear work item`)
  }
  return run.sourceWorkItemId
}

function reviewComment(cycle: ReviewCycleRecord, review: ReviewResult): string {
  const findings = review.findings.map((finding) => {
    const location =
      finding.locator.line === null
        ? `${finding.locator.path} (${finding.locator.symbol})`
        : `${finding.locator.path}:${finding.locator.line}`
    return `- **${finding.severity}** ${location}: ${finding.finding}\n  Evidence: ${finding.evidence}`
  })
  return [
    `## Independent review round ${cycle.reviewRound}`,
    `Candidate: \`${cycle.candidateCommitSha}\``,
    `Disposition: **${review.disposition}**`,
    findings.length === 0 ? "No approval-blocking findings." : findings.join("\n")
  ].join("\n\n")
}

export function linearOutcomeEvidence(input: {
  run: WorkflowRunRecord
  disposition: "merged" | "abandoned"
  candidateCommitSha: string
  review: ReviewResult
  history: ReviewCycleRecord[]
  mergedCommitSha?: string
}): string {
  const rounds = input.history.map((cycle) => {
    const findingCount =
      cycle.reviewRound === input.review.reviewAttempt ? input.review.findings.length : cycle.findings.length
    return `- Round ${cycle.reviewRound}: ${cycle.status}, candidate \`${cycle.candidateCommitSha}\`, ${findingCount} finding(s)`
  })
  const result =
    input.disposition === "merged"
      ? `Merged as \`${input.mergedCommitSha}\``
      : "Abandoned after the final bounded review exchange"
  return [
    `## Autonomous delivery ${input.disposition}`,
    `Run: \`${input.run.runId}\``,
    `Pull request: #${pullRequestNumber(input.run)}`,
    `Final reviewed candidate: \`${input.candidateCommitSha}\``,
    result,
    "### Review evidence",
    ...rounds
  ].join("\n")
}

export class ReviewLoopProviderActions implements ReviewLoopActions {
  readonly #store: ReviewProviderStore
  readonly #github: GitHubReviewPort
  readonly #linear: LinearReviewPort
  readonly #artifactRoot: (runId: string) => string
  readonly #modelProviderApiKey: string
  readonly #workspaceSecretKey: string
  readonly #artifactStoreFactory: ArtifactStoreFactory | undefined

  constructor(options: ReviewLoopProviderOptions) {
    this.#store = options.store
    this.#github = options.github
    this.#linear = options.linear
    this.#artifactRoot = options.artifactRoot
    this.#modelProviderApiKey = options.modelProviderApiKey
    this.#workspaceSecretKey = options.workspaceSecretKey
    this.#artifactStoreFactory = options.artifactStoreFactory
  }

  async review(run: WorkflowRunRecord, cycle: ReviewCycleRecord): Promise<ReviewResult> {
    const githubToken = await this.#github.installationToken()
    const output = await runReviewer({
      run,
      cycle,
      artifactRoot: this.#artifactRoot(run.runId),
      ...(this.#artifactStoreFactory === undefined
        ? {}
        : { artifactStore: this.#artifactStoreFactory.forRun(run.runId, this.#artifactRoot(run.runId)) }),
      githubToken,
      modelProviderApiKey: this.#modelProviderApiKey,
      workspaceSecretKey: this.#workspaceSecretKey
    })
    await this.#store.createWorkspaceLease({
      provider: "daytona",
      workspaceId: output.workspaceId,
      runId: run.runId,
      role: "reviewer",
      roleAttempt: cycle.reviewRound,
      lifecycleState: "deleted",
      labels: {
        repository: `${run.repositoryOwner}/${run.repositoryName}`,
        candidateCommitSha: cycle.candidateCommitSha,
        roleExecutionId: output.review.roleAttempt.roleExecutionId
      },
      conversationId: output.conversationId,
      profileName: "reviewer",
      retentionUntil: output.retentionUntil,
      expiresAt: output.expiresAt
    })
    await this.#store.updateReviewCycle({
      runId: run.runId,
      reviewRound: cycle.reviewRound,
      status: "running",
      reviewerWorkspaceId: output.workspaceId
    })
    await this.#github.recordReviewComment(
      run.repositoryOwner,
      run.repositoryName,
      pullRequestNumber(run),
      reviewComment(cycle, output.review)
    )
    return output.review
  }

  async merge(run: WorkflowRunRecord, cycle: ReviewCycleRecord, review: ReviewResult): Promise<void> {
    const mergedCommitSha = await this.#github.mergePullRequest(
      run.repositoryOwner,
      run.repositoryName,
      pullRequestNumber(run),
      cycle.candidateCommitSha
    )
    const history = await this.#store.listReviewCyclesForRun(run.runId)
    await this.#linear.recordAgentActivity(
      workItemId(run),
      "completed",
      linearOutcomeEvidence({
        run,
        disposition: "merged",
        candidateCommitSha: cycle.candidateCommitSha,
        review,
        history,
        mergedCommitSha
      })
    )
  }

  async repair(
    run: WorkflowRunRecord,
    cycle: ReviewCycleRecord,
    review: ReviewResult,
    coderWorkspace: Parameters<ReviewLoopActions["repair"]>[3]
  ): Promise<{ candidateCommitSha: string }> {
    const githubToken = await this.#github.installationToken()
    const output = await runRepairer({
      run,
      cycle,
      review,
      coderWorkspace,
      artifactRoot: this.#artifactRoot(run.runId),
      ...(this.#artifactStoreFactory === undefined
        ? {}
        : { artifactStore: this.#artifactStoreFactory.forRun(run.runId, this.#artifactRoot(run.runId)) }),
      githubToken,
      modelProviderApiKey: this.#modelProviderApiKey,
      workspaceSecretKey: this.#workspaceSecretKey
    })
    await this.#store.transitionWorkspaceLease({
      provider: "daytona",
      workspaceId: coderWorkspace.workspaceId,
      expectedVersion: coderWorkspace.version,
      lifecycleState: "stopped",
      conversationId: coderWorkspace.conversationId,
      profileName: "coder"
    })
    await this.#github.recordReviewComment(
      run.repositoryOwner,
      run.repositoryName,
      pullRequestNumber(run),
      `Applied review round ${cycle.reviewRound} in retained workspace \`${coderWorkspace.workspaceId}\`. New candidate: \`${output.candidateCommitSha}\`.`
    )
    await this.#store.recordWorkflowEvent(run.runId, {
      sourceId: `repair:${cycle.reviewRound}:${output.candidateCommitSha}`,
      node: "repair.publish",
      outcome: "completed",
      summary: `Published repaired candidate ${output.candidateCommitSha}`,
      details: {
        reviewedCandidateCommitSha: cycle.candidateCommitSha,
        candidateCommitSha: output.candidateCommitSha,
        addressedFindingIds: output.repair.addressedFindingIds,
        declinedFindings: output.repair.declinedFindings
      },
      createdAt: new Date()
    })
    return { candidateCommitSha: output.candidateCommitSha }
  }

  async abandon(run: WorkflowRunRecord, cycle: ReviewCycleRecord, review: ReviewResult): Promise<void> {
    const history = await this.#store.listReviewCyclesForRun(run.runId)
    const evidence = linearOutcomeEvidence({
      run,
      disposition: "abandoned",
      candidateCommitSha: cycle.candidateCommitSha,
      review,
      history
    })
    await this.#github.recordReviewComment(run.repositoryOwner, run.repositoryName, pullRequestNumber(run), evidence)
    await this.#github.abandonPullRequest(
      run.repositoryOwner,
      run.repositoryName,
      pullRequestNumber(run),
      cycle.candidateCommitSha
    )
    await this.#linear.recordAgentActivity(workItemId(run), "canceled", evidence)
  }
}
