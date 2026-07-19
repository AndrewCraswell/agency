import { resolve } from "node:path"
import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph"
import type { Assignment } from "../contracts/assignment"
import type { WorkerResult } from "../contracts/results"
import type { DraftPullRequestPublisher } from "../github/publisher"
import { traceOperation } from "../observability/tracing"
import {
  type GraphEvent,
  type GraphFailure,
  PHASE_2_GRAPH_SCHEMA_VERSION,
  Phase2GraphStateSchema,
  type Phase2GraphState,
  type PublicationResult,
  type ValidationResult,
  createInitialGraphState
} from "./state"

const Phase2StateAnnotation = Annotation.Root({
  schemaVersion: Annotation<Phase2GraphState["schemaVersion"]>(),
  runId: Annotation<string>(),
  assignmentDigest: Annotation<string>(),
  assignment: Annotation<Assignment>(),
  phase: Annotation<Phase2GraphState["phase"]>(),
  workerResult: Annotation<WorkerResult | null>(),
  validationResult: Annotation<ValidationResult | null>(),
  publicationResult: Annotation<PublicationResult | null>(),
  terminalStatus: Annotation<Phase2GraphState["terminalStatus"]>(),
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

export type Phase2WorkerOptions = {
  assignment: Assignment
  artifactRoot: string
  signal: AbortSignal
  onProgress?: (message: string) => void
}

export type Phase2GraphDependencies = {
  artifactRoot(runId: string): string
  runWorker(options: Phase2WorkerOptions): Promise<WorkerResult>
  publisher: DraftPullRequestPublisher
  now?: () => Date
}

function event(
  dependencies: Phase2GraphDependencies,
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
  return error instanceof Error ? error.message : "Unknown Phase 2 workflow failure"
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

export function createPhase2Graph(dependencies: Phase2GraphDependencies) {
  const activeRuns = new Map<string, AbortController>()
  const prepareAssignment = (stateInput: Phase2GraphState) => {
    const state = Phase2GraphStateSchema.parse(stateInput)
    return {
      phase: "prepared" as const,
      events: [event(dependencies, "prepareAssignment", "completed", `Prepared assignment ${state.assignmentDigest}`)]
    }
  }

  const provisionWorkspace = (stateInput: Phase2GraphState) => {
    const state = Phase2GraphStateSchema.parse(stateInput)
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

  const runCoder = async (stateInput: Phase2GraphState) => {
    const state = Phase2GraphStateSchema.parse(stateInput)
    const signal = activeRuns.get(state.runId)?.signal ?? AbortSignal.abort()
    try {
      const workerResult = await traceOperation(
        {
          name: "phase2.runCoder",
          metadata: {
            runId: state.runId,
            repository: `${state.assignment.repository.owner}/${state.assignment.repository.name}`,
            baseCommitSha: state.assignment.baseCommitSha,
            promptVersion: state.assignment.promptVersion
          },
          tags: ["phase-2", "coder"]
        },
        () =>
          dependencies.runWorker({
            assignment: state.assignment,
            artifactRoot: dependencies.artifactRoot(state.runId),
            signal
          })
      )
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

  const validateResult = (stateInput: Phase2GraphState) => {
    const state = Phase2GraphStateSchema.parse(stateInput)
    if (state.failure?.classification === "cancelled" || state.workerResult?.status === "cancelled") {
      const graphFailure =
        state.failure ?? failure("validateResult", "cancelled", "Worker result records cancellation", false)
      return {
        phase: "cancelled" as const,
        validationResult: {
          disposition: "failed" as const,
          reasons: [graphFailure.message],
          checkedAt: (dependencies.now?.() ?? new Date()).toISOString()
        },
        failure: graphFailure,
        terminalStatus: "cancelled" as const,
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

  const publishDraftPr = async (stateInput: Phase2GraphState) => {
    const state = Phase2GraphStateSchema.parse(stateInput)
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
      const publicationResult = await traceOperation(
        {
          name: "phase2.publishDraftPr",
          metadata: {
            runId: state.runId,
            repository: `${state.assignment.repository.owner}/${state.assignment.repository.name}`,
            baseCommitSha: state.assignment.baseCommitSha
          },
          tags: ["phase-2", "github-publication"]
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

  const recordFailure = (stateInput: Phase2GraphState) => {
    const state = Phase2GraphStateSchema.parse(stateInput)
    const graphFailure =
      state.failure ?? failure("recordFailure", "internal", "Workflow reached failure routing without a typed failure")
    return {
      phase: graphFailure.classification === "cancelled" ? ("cancelled" as const) : ("failed" as const),
      failure: graphFailure,
      terminalStatus: graphFailure.classification === "cancelled" ? ("cancelled" as const) : ("failed" as const),
      events: [event(dependencies, "recordFailure", "completed", graphFailure.message)]
    }
  }

  const stopWorkspace = (stateInput: Phase2GraphState) => {
    const state = Phase2GraphStateSchema.parse(stateInput)
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

  const routeAfterValidation = (stateInput: Phase2GraphState) => {
    const state = Phase2GraphStateSchema.parse(stateInput)
    return state.validationResult?.disposition === "publishable" ? "publishDraftPr" : "recordFailure"
  }

  const checkpointer = new MemorySaver()
  const graph = new StateGraph(Phase2StateAnnotation)
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
    async invoke(assignment: Assignment): Promise<Phase2GraphState> {
      const initialState = createInitialGraphState(assignment)
      const config = {
        configurable: { thread_id: assignment.runId },
        metadata: {
          runId: assignment.runId,
          repository: `${assignment.repository.owner}/${assignment.repository.name}`,
          baseCommitSha: assignment.baseCommitSha,
          graphVersion: PHASE_2_GRAPH_SCHEMA_VERSION,
          promptVersion: assignment.promptVersion,
          workerImageVersion: assignment.workerImageVersion
        },
        tags: ["phase-2", "local-langgraph"]
      }
      const existingSnapshot = await graph.getState(config)
      const existingState = Phase2GraphStateSchema.safeParse(existingSnapshot.values)
      if (existingState.success) {
        if (existingState.data.assignmentDigest !== initialState.assignmentDigest) {
          throw new Error(`Run ${assignment.runId} is already bound to a different assignment digest`)
        }
        if (existingState.data.terminalStatus !== "running") {
          return existingState.data
        }
      }
      const controller = new AbortController()
      activeRuns.set(assignment.runId, controller)
      try {
        const result = await graph.invoke(initialState, { ...config })
        return Phase2GraphStateSchema.parse(result)
      } finally {
        activeRuns.delete(assignment.runId)
      }
    },
    async inspect(runId: string): Promise<Phase2GraphState | null> {
      const snapshot = await graph.getState({ configurable: { thread_id: runId } })
      const state = Phase2GraphStateSchema.safeParse(snapshot.values)
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
