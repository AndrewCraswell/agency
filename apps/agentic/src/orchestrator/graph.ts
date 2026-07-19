import { resolve } from "node:path"
import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph"
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint"
import type { Assignment } from "../contracts/assignment"
import type { WorkerResult } from "../contracts/results"
import type { DraftPullRequestPublisher } from "../github/publisher"
import { traceOperation } from "../observability/tracing"
import type { ControlPlaneStore } from "../persistence/controlPlaneStore"
import {
  type GraphEvent,
  type GraphFailure,
  WORKFLOW_SCHEMA_VERSION,
  WorkflowStateSchema,
  type WorkflowState,
  type PublicationResult,
  type ValidationResult,
  createInitialGraphState
} from "./state"

const WorkflowStateAnnotation = Annotation.Root({
  schemaVersion: Annotation<WorkflowState["schemaVersion"]>(),
  runId: Annotation<string>(),
  assignmentDigest: Annotation<string>(),
  assignment: Annotation<Assignment>(),
  phase: Annotation<WorkflowState["phase"]>(),
  workerResult: Annotation<WorkerResult | null>(),
  validationResult: Annotation<ValidationResult | null>(),
  publicationResult: Annotation<PublicationResult | null>(),
  terminalStatus: Annotation<WorkflowState["terminalStatus"]>(),
  failure: Annotation<GraphFailure | null>(),
  cleanupFailure: Annotation<GraphFailure | null>(),
  events: Annotation<GraphEvent[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),
  artifactReferences: Annotation<string[]>({
    reducer: (current, update) => [...new Set([...current, ...update])],
    default: () => []
  })
})

export type WorkerExecutionOptions = {
  assignment: Assignment
  artifactRoot: string
  signal: AbortSignal
  onProgress?: (message: string) => void
}

export type WorkflowGraphDependencies = {
  artifactRoot(runId: string): string
  runWorker(options: WorkerExecutionOptions): Promise<WorkerResult>
  publisher: DraftPullRequestPublisher
  checkpointer?: BaseCheckpointSaver
  controlPlaneStore?: ControlPlaneStore
  now?: () => Date
}

export async function recordCoderWorkspaceLease(
  store: Pick<ControlPlaneStore, "createWorkspaceLease">,
  assignment: Assignment,
  workerResult: WorkerResult
): Promise<void> {
  await store.createWorkspaceLease({
    provider: "daytona",
    workspaceId: workerResult.workspace.workspaceId,
    runId: assignment.runId,
    role: "coder",
    roleAttempt: 1,
    lifecycleState: workerResult.workspace.lifecycleState,
    labels: {
      repository: `${assignment.repository.owner}/${assignment.repository.name}`,
      promptVersion: assignment.promptVersion,
      roleExecutionId: assignment.roleExecutionId
    },
    ...(workerResult.conversationId === null ? {} : { conversationId: workerResult.conversationId }),
    profileName: "coder",
    retentionUntil: new Date(workerResult.workspace.retentionUntil),
    expiresAt: new Date(workerResult.workspace.expiresAt)
  })
}

function workflowThreadId(runId: string): string {
  return `workflow:${runId}`
}

function event(
  dependencies: WorkflowGraphDependencies,
  node: GraphEvent["node"],
  outcome: GraphEvent["outcome"],
  summary: string
): GraphEvent {
  return {
    node,
    outcome,
    at: (dependencies.now?.() ?? new Date()).toISOString(),
    summary
  }
}

function failure(
  node: GraphFailure["node"],
  classification: GraphFailure["classification"],
  message: string,
  retryable = false
): GraphFailure {
  return { node, classification, message, retryable }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown workflow failure"
}

function validateWorkerResult(workerResult: WorkerResult | null): ValidationResult {
  const checkedAt = new Date().toISOString()
  if (workerResult === null) {
    return { disposition: "failed", reasons: ["Coder returned no worker result"], checkedAt }
  }

  const reasons: string[] = []
  if (workerResult.status !== "completed") {
    reasons.push(`Coder finished with ${workerResult.status} status`)
  }
  if (workerResult.patchArtifact === null) {
    reasons.push("Coder produced no patch artifact")
  }
  if (workerResult.changedFiles.length === 0) {
    reasons.push("Coder produced no changed files")
  }
  if (workerResult.validationResults.some((result) => result.timedOut || result.exitCode !== 0)) {
    reasons.push("Independent validation did not pass")
  }

  return {
    disposition: reasons.length === 0 ? "publishable" : "failed",
    reasons,
    checkedAt
  }
}

export function createWorkflowGraph(dependencies: WorkflowGraphDependencies) {
  const activeRuns = new Map<string, AbortController>()
  const prepareAssignment = (stateInput: WorkflowState) => {
    const state = WorkflowStateSchema.parse(stateInput)
    return {
      phase: "prepared" as const,
      events: [event(dependencies, "prepareAssignment", "completed", `Prepared assignment ${state.assignmentDigest}`)]
    }
  }

  const provisionWorkspace = (stateInput: WorkflowState) => {
    const state = WorkflowStateSchema.parse(stateInput)
    return {
      phase: "running" as const,
      events: [
        event(
          dependencies,
          "provisionWorkspace",
          "completed",
          `Delegated workspace provisioning for run ${state.runId} to the proven worker boundary`
        )
      ]
    }
  }

  const runCoder = async (stateInput: WorkflowState) => {
    const state = WorkflowStateSchema.parse(stateInput)
    const signal = activeRuns.get(state.runId)?.signal ?? AbortSignal.abort()
    try {
      const workerResult = await traceOperation(
        {
          name: "workflow.runCoder",
          metadata: {
            runId: state.runId,
            repository: `${state.assignment.repository.owner}/${state.assignment.repository.name}`,
            baseCommitSha: state.assignment.baseCommitSha,
            promptVersion: state.assignment.promptVersion
          },
          tags: ["workflow", "coder"],
          onTrace: (reference) => dependencies.controlPlaneStore?.recordTrace(state.runId, reference)
        },
        () =>
          dependencies.runWorker({
            assignment: state.assignment,
            artifactRoot: dependencies.artifactRoot(state.runId),
            signal
          })
      )
      if (dependencies.controlPlaneStore !== undefined) {
        await recordCoderWorkspaceLease(dependencies.controlPlaneStore, state.assignment, workerResult)
      }
      return {
        workerResult,
        artifactReferences: workerResult.artifacts.map((artifact) => artifact.relativePath),
        events: [event(dependencies, "runCoder", "completed", `Coder finished with ${workerResult.status} status`)]
      }
    } catch (error) {
      const isCancelled = error instanceof Error && error.name === "AbortError"
      const graphFailure = failure("runCoder", isCancelled ? "cancelled" : "worker", errorMessage(error))
      return {
        failure: graphFailure,
        terminalStatus: isCancelled ? ("cancelled" as const) : ("failed" as const),
        events: [event(dependencies, "runCoder", "failed", graphFailure.message)]
      }
    }
  }

  const validateResult = (stateInput: WorkflowState) => {
    const state = WorkflowStateSchema.parse(stateInput)
    if (state.failure !== null || state.workerResult?.status === "cancelled") {
      const graphFailure =
        state.failure ?? failure("validateResult", "cancelled", "Worker result records cancellation", false)
      const isCancelled = graphFailure.classification === "cancelled"
      return {
        phase: isCancelled ? ("cancelled" as const) : ("failed" as const),
        validationResult: {
          disposition: "failed" as const,
          reasons: [graphFailure.message],
          checkedAt: (dependencies.now?.() ?? new Date()).toISOString()
        },
        failure: graphFailure,
        terminalStatus: isCancelled ? ("cancelled" as const) : ("failed" as const),
        events: [event(dependencies, "validateResult", "failed", graphFailure.message)]
      }
    }
    const validationResult = validateWorkerResult(state.workerResult)
    if (validationResult.disposition === "publishable") {
      return {
        phase: "validated" as const,
        validationResult,
        events: [event(dependencies, "validateResult", "completed", "Worker result is publishable")]
      }
    }

    const graphFailure = failure("validateResult", "validation", validationResult.reasons.join("; "))
    return {
      phase: "failed" as const,
      validationResult,
      failure: graphFailure,
      terminalStatus: "failed" as const,
      events: [event(dependencies, "validateResult", "failed", graphFailure.message)]
    }
  }

  const publishDraftPr = async (stateInput: WorkflowState) => {
    const state = WorkflowStateSchema.parse(stateInput)
    const workerResult = state.workerResult
    const patchArtifact = workerResult?.patchArtifact
    if (workerResult === null || patchArtifact === null || patchArtifact === undefined) {
      const graphFailure = failure("publishDraftPr", "publication", "Publishable state is missing its patch artifact")
      return {
        phase: "failed" as const,
        failure: graphFailure,
        terminalStatus: "failed" as const,
        events: [event(dependencies, "publishDraftPr", "failed", graphFailure.message)]
      }
    }

    try {
      await dependencies.controlPlaneStore?.setWorkflowProgress(state.runId, "running", "publishing", null)
      const publicationResult = await traceOperation(
        {
          name: "workflow.publishDraftPr",
          metadata: {
            runId: state.runId,
            repository: `${state.assignment.repository.owner}/${state.assignment.repository.name}`,
            baseCommitSha: state.assignment.baseCommitSha
          },
          tags: ["workflow", "github-publication"],
          onTrace: (reference) => dependencies.controlPlaneStore?.recordTrace(state.runId, reference)
        },
        () =>
          dependencies.publisher.publish({
            assignment: state.assignment,
            workerResult,
            patchArtifactPath: resolve(dependencies.artifactRoot(state.runId), patchArtifact)
          })
      )
      return {
        phase: "published" as const,
        publicationResult,
        terminalStatus: "published" as const,
        events: [
          event(
            dependencies,
            "publishDraftPr",
            "completed",
            `Published draft pull request ${publicationResult.pullRequestNumber}`
          )
        ]
      }
    } catch (error) {
      const graphFailure = failure("publishDraftPr", "publication", errorMessage(error))
      return {
        phase: "failed" as const,
        failure: graphFailure,
        terminalStatus: "failed" as const,
        events: [event(dependencies, "publishDraftPr", "failed", graphFailure.message)]
      }
    }
  }

  const recordFailure = (stateInput: WorkflowState) => {
    const state = WorkflowStateSchema.parse(stateInput)
    const graphFailure =
      state.failure ?? failure("recordFailure", "internal", "Workflow reached failure routing without a typed failure")
    return {
      phase: graphFailure.classification === "cancelled" ? ("cancelled" as const) : ("failed" as const),
      failure: graphFailure,
      terminalStatus: graphFailure.classification === "cancelled" ? ("cancelled" as const) : ("failed" as const),
      events: [event(dependencies, "recordFailure", "completed", graphFailure.message)]
    }
  }

  const stopWorkspace = (stateInput: WorkflowState) => {
    const state = WorkflowStateSchema.parse(stateInput)
    const lifecycleState = state.workerResult?.workspace.lifecycleState
    if (
      lifecycleState !== undefined &&
      lifecycleState !== "stopped" &&
      lifecycleState !== "archived" &&
      lifecycleState !== "deleted"
    ) {
      const cleanupFailure = failure(
        "stopWorkspace",
        "cleanup",
        `Worker returned workspace in ${lifecycleState} state instead of a cleaned-up state`
      )
      return {
        phase: "cleaned_up" as const,
        cleanupFailure,
        events: [event(dependencies, "stopWorkspace", "failed", cleanupFailure.message)]
      }
    }

    return {
      phase: "cleaned_up" as const,
      events: [event(dependencies, "stopWorkspace", "completed", "Workspace cleanup is complete")]
    }
  }

  const routeAfterValidation = (stateInput: WorkflowState) => {
    const state = WorkflowStateSchema.parse(stateInput)
    return state.validationResult?.disposition === "publishable" ? "publishDraftPr" : "recordFailure"
  }

  const checkpointer = dependencies.checkpointer ?? new MemorySaver()
  const graph = new StateGraph(WorkflowStateAnnotation)
    .addNode("prepareAssignment", prepareAssignment)
    .addNode("provisionWorkspace", provisionWorkspace)
    .addNode("runCoder", runCoder)
    .addNode("validateResult", validateResult)
    .addNode("publishDraftPr", publishDraftPr)
    .addNode("recordFailure", recordFailure)
    .addNode("stopWorkspace", stopWorkspace)
    .addEdge(START, "prepareAssignment")
    .addEdge("prepareAssignment", "provisionWorkspace")
    .addEdge("provisionWorkspace", "runCoder")
    .addEdge("runCoder", "validateResult")
    .addConditionalEdges("validateResult", routeAfterValidation, ["publishDraftPr", "recordFailure"])
    .addEdge("publishDraftPr", "stopWorkspace")
    .addEdge("recordFailure", "stopWorkspace")
    .addEdge("stopWorkspace", END)
    .compile({ checkpointer })

  return {
    graph,
    checkpointer,
    async invoke(assignment: Assignment): Promise<WorkflowState> {
      const initialState = createInitialGraphState(assignment)
      const existingRun = await dependencies.controlPlaneStore?.getWorkflowRun(assignment.runId)
      if (existingRun === null) {
        await dependencies.controlPlaneStore?.bindWorkflowRun({
          runId: assignment.runId,
          requestDigest: initialState.assignmentDigest,
          graphVersion: WORKFLOW_SCHEMA_VERSION,
          repositoryOwner: assignment.repository.owner,
          repositoryName: assignment.repository.name
        })
      } else if (
        existingRun !== undefined &&
        (existingRun.repositoryOwner !== assignment.repository.owner ||
          existingRun.repositoryName !== assignment.repository.name)
      ) {
        throw new Error(`Run ${assignment.runId} is bound to a different repository`)
      }
      const config = {
        configurable: { thread_id: workflowThreadId(assignment.runId) },
        metadata: {
          runId: assignment.runId,
          repository: `${assignment.repository.owner}/${assignment.repository.name}`,
          baseCommitSha: assignment.baseCommitSha,
          graphVersion: WORKFLOW_SCHEMA_VERSION,
          promptVersion: assignment.promptVersion,
          workerImageVersion: assignment.workerImageVersion
        },
        tags: ["workflow", "local-langgraph"]
      }
      const existingSnapshot = await graph.getState(config)
      const existingState = WorkflowStateSchema.safeParse(existingSnapshot.values)
      if (existingState.success) {
        if (existingState.data.assignmentDigest !== initialState.assignmentDigest) {
          throw new Error(`Run ${assignment.runId} is already bound to a different assignment digest`)
        }
        if (existingState.data.terminalStatus !== "running") {
          await dependencies.controlPlaneStore?.persistWorkflowState(existingState.data)
          return existingState.data
        }
      }
      await dependencies.controlPlaneStore?.setWorkflowProgress(assignment.runId, "running", "coding", "coder")
      const controller = new AbortController()
      activeRuns.set(assignment.runId, controller)
      try {
        const result = WorkflowStateSchema.parse(await graph.invoke(initialState, { ...config }))
        await dependencies.controlPlaneStore?.persistWorkflowState(result)
        return result
      } finally {
        activeRuns.delete(assignment.runId)
      }
    },
    async inspect(runId: string): Promise<WorkflowState | null> {
      const snapshot = await graph.getState({ configurable: { thread_id: workflowThreadId(runId) } })
      const state = WorkflowStateSchema.safeParse(snapshot.values)
      return state.success ? state.data : null
    },
    cancel(runId: string): boolean {
      const controller = activeRuns.get(runId)
      if (controller === undefined) {
        return false
      }
      controller.abort()
      return true
    }
  }
}
