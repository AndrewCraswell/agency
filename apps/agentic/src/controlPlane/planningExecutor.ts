import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint"
import { z } from "zod"
import { agents } from "../contracts/agent"
import type { Assignment } from "../contracts/assignment"
import type { PlanningResultSchema } from "../contracts/specialized"
import type { GitHubAppPublisher } from "../github/githubAppPublisher"
import type { LinearClient } from "../linear/client"
import type { ScrumMasterPlanner } from "../orchestrator/scrumMasterPlanner"
import type { WorkflowState } from "../orchestrator/state"
import { createWorkItemIntakeGraph } from "../orchestrator/workItemIntake"
import { WorkItemIntakeRequestSchema } from "../orchestrator/workItemIntakeState"
import type { ControlPlaneStore, ReviewControlPlaneStore, WorkflowRunRecord } from "../persistence/controlPlaneStore"
import type { DispatchOutcome, WorkflowRunExecutor } from "./dispatcher"
import { assignmentFromPlan } from "./planAssignment"

const ExecutorOptionsSchema = z.object({ team: z.string().trim().min(1) }).strict()

type DeliveryWorkflow = {
  invoke(assignment: Assignment): Promise<Pick<WorkflowState, "publicationResult" | "terminalStatus">>
}

export async function executePlanDelivery(
  plan: z.infer<typeof PlanningResultSchema>,
  repository: Assignment["repository"],
  delivery: DeliveryWorkflow,
  onPublished?: (publication: NonNullable<WorkflowState["publicationResult"]>) => Promise<void>
): Promise<DispatchOutcome> {
  const result = await delivery.invoke(assignmentFromPlan(plan, repository))
  if (result.terminalStatus === "published") {
    if (onPublished !== undefined) {
      if (result.publicationResult === null) {
        throw new Error("Published delivery is missing pull-request evidence")
      }
      await onPublished(result.publicationResult)
      return { status: "running", stage: "reviewing", activeRole: "reviewer" }
    }
    return { status: "published", stage: "completed", activeRole: null }
  }
  if (result.terminalStatus === "cancelled") {
    return { status: "cancelled", stage: "completed", activeRole: null }
  }
  if (result.terminalStatus === "failed") {
    return { status: "failed", stage: "completed", activeRole: null }
  }
  return { status: "running", stage: "coding", activeRole: "coder" }
}

export class PlanningRunExecutor implements WorkflowRunExecutor {
  readonly #linear: Pick<LinearClient, "listCandidates" | "recordAgentActivity">
  readonly #github: Pick<GitHubAppPublisher, "resolveDefaultBranchSha">
  readonly #planner: Pick<ScrumMasterPlanner, "plan">
  readonly #store: ControlPlaneStore & Pick<ReviewControlPlaneStore, "createReviewCycle">
  readonly #checkpointer: BaseCheckpointSaver
  readonly #delivery: DeliveryWorkflow
  readonly #team: string

  constructor(input: {
    linear: Pick<LinearClient, "listCandidates" | "recordAgentActivity">
    github: Pick<GitHubAppPublisher, "resolveDefaultBranchSha">
    planner: Pick<ScrumMasterPlanner, "plan">
    store: ControlPlaneStore & Pick<ReviewControlPlaneStore, "createReviewCycle">
    checkpointer: BaseCheckpointSaver
    delivery: DeliveryWorkflow
    team: string
  }) {
    this.#linear = input.linear
    this.#github = input.github
    this.#planner = input.planner
    this.#store = input.store
    this.#checkpointer = input.checkpointer
    this.#delivery = input.delivery
    this.#team = ExecutorOptionsSchema.parse({ team: input.team }).team
  }

  async execute(run: WorkflowRunRecord): Promise<DispatchOutcome> {
    const candidateList = await this.#linear.listCandidates(50)
    const existingRuns = await this.#store.listWorkflowRuns(200)
    const claimedWorkItemIds = new Set(
      existingRuns.flatMap((existingRun) =>
        existingRun.runId === run.runId || existingRun.sourceWorkItemId === null ? [] : [existingRun.sourceWorkItemId]
      )
    )
    let planningCandidates = candidateList.issues.filter((issue) => !claimedWorkItemIds.has(issue.id))
    if (run.sourceWorkItemId !== null) {
      const candidate = candidateList.issues.find((issue) => issue.id === run.sourceWorkItemId)
      if (candidate === undefined) {
        throw new Error(
          `Assigned work item ${run.sourceWorkItemIdentifier ?? run.sourceWorkItemId} is no longer dependency-ready`
        )
      }
      planningCandidates = [candidate]
    }
    if (planningCandidates.length === 0) {
      throw new Error("No unassigned dependency-ready Linear tasks are available")
    }
    const assignedCandidates = { ...candidateList, issues: planningCandidates }
    const workflow = createWorkItemIntakeGraph({
      fetchCandidates: async () => assignedCandidates,
      resolveBaseCommitSha: async (repository) =>
        this.#github.resolveDefaultBranchSha(repository.owner, repository.name),
      runScrumMaster: (input) => this.#planner.plan(input),
      checkpointer: this.#checkpointer,
      onTrace: (runId, reference) => this.#store.recordTrace(runId, reference)
    })
    const state = await workflow.invoke(
      WorkItemIntakeRequestSchema.parse({
        schemaVersion: "1",
        runId: run.runId,
        team: this.#team,
        repository: {
          provider: "github",
          owner: run.repositoryOwner,
          name: run.repositoryName
        }
      })
    )
    await Promise.all(
      state.events.map((event, index) =>
        this.#store.recordWorkflowEvent(run.runId, {
          sourceId: `work-item-intake:${index}:${event.at}`,
          node: event.node,
          outcome: event.outcome,
          summary: event.summary,
          details: { phase: state.phase, failure: state.failure },
          createdAt: new Date(event.at)
        })
      )
    )
    if (state.terminalStatus === "blocked") {
      return { status: "blocked", stage: "planning", activeRole: null }
    }
    if (state.terminalStatus === "failed") {
      return { status: "failed", stage: "planning", activeRole: null }
    }
    const planningResult = state.planningResult
    if (planningResult === null) {
      throw new Error("A ready scrum-master result requires a selected work item")
    }
    const selectedWorkItem = planningResult.sourceWorkItem
    if (run.sourceWorkItemId === null) {
      const activeAgentIds = new Set(
        existingRuns.flatMap((existingRun) =>
          existingRun.status === "queued" || existingRun.status === "running" ? [existingRun.assignedAgentId] : []
        )
      )
      const engineer = agents.find((agent) => agent.role === "engineer" && !activeAgentIds.has(agent.id))
      if (engineer === undefined) {
        throw new Error("No engineering agent is currently available")
      }
      await this.#store.assignWorkflowRun({
        runId: run.runId,
        sourceWorkItemId: selectedWorkItem.id,
        sourceWorkItemIdentifier: selectedWorkItem.identifier,
        assignedAgentId: engineer.id
      })
      await this.#store.recordWorkflowEvent(run.runId, {
        sourceId: "scrum-master-assignment",
        node: "assignEngineer",
        outcome: "completed",
        summary: `Scrum master assigned ${selectedWorkItem.identifier} to ${engineer.name}`,
        details: { workItemId: selectedWorkItem.id, assignedAgentId: engineer.id },
        createdAt: new Date()
      })
      await this.#linear.recordAgentActivity(
        selectedWorkItem.id,
        "started",
        `Scrum master assigned ${selectedWorkItem.identifier} to ${engineer.name}.\n\nRun: \`${run.runId}\`\nRepository: \`${run.repositoryOwner}/${run.repositoryName}\``
      )
    }
    return executePlanDelivery(
      planningResult,
      { provider: "github", owner: run.repositoryOwner, name: run.repositoryName },
      this.#delivery,
      async (publication) => {
        await this.#store.createReviewCycle({
          runId: run.runId,
          reviewRound: 1,
          candidateCommitSha: publication.headCommitSha,
          reviewerAgentId: "reviewer"
        })
      }
    )
  }
}
