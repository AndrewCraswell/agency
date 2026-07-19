import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph"
import { z } from "zod"
import { LinearCandidateListSchema, LinearWorkItemSchema } from "../contracts/linear"
import { PlanningResultSchema, PromptVersionSchema } from "../contracts/specialized"
import { traceOperation } from "../observability/tracing"
import { resolvePrompt } from "../prompts/registry"
import {
  WORK_ITEM_INTAKE_SCHEMA_VERSION,
  type WorkItemIntakeEvent,
  type WorkItemIntakeFailure,
  type WorkItemIntakeRequest,
  WorkItemIntakeStateSchema,
  type WorkItemIntakeState,
  createInitialWorkItemIntakeState
} from "./workItemIntakeState"

const ResolvedScrumMasterPromptSchema = z
  .object({
    schemaVersion: PromptVersionSchema.shape.schemaVersion,
    role: z.literal("scrum_master"),
    version: PromptVersionSchema.shape.version,
    sha256: PromptVersionSchema.shape.sha256,
    content: z.string().min(1)
  })
  .strict()

const ScrumMasterInvocationSchema = z
  .object({
    output: z.unknown(),
    rawResponse: z.string()
  })
  .strict()

const WorkItemIntakeAnnotation = Annotation.Root({
  schemaVersion: Annotation<WorkItemIntakeState["schemaVersion"]>(),
  runId: Annotation<string>(),
  requestDigest: Annotation<string>(),
  request: Annotation<WorkItemIntakeRequest>(),
  phase: Annotation<WorkItemIntakeState["phase"]>(),
  candidates: Annotation<WorkItemIntakeState["candidates"]>(),
  baseCommitSha: Annotation<WorkItemIntakeState["baseCommitSha"]>(),
  prompt: Annotation<WorkItemIntakeState["prompt"]>(),
  planningResult: Annotation<WorkItemIntakeState["planningResult"]>(),
  rawScrumMasterResponse: Annotation<WorkItemIntakeState["rawScrumMasterResponse"]>(),
  terminalStatus: Annotation<WorkItemIntakeState["terminalStatus"]>(),
  failure: Annotation<WorkItemIntakeState["failure"]>(),
  events: Annotation<WorkItemIntakeEvent[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  })
})

export type ScrumMasterInvocationInput = {
  request: WorkItemIntakeRequest
  candidates: z.infer<typeof LinearCandidateListSchema>
  baseCommitSha: string
  prompt: z.infer<typeof ResolvedScrumMasterPromptSchema>
  signal: AbortSignal
}

export type WorkItemIntakeDependencies = {
  fetchCandidates(team: string): Promise<unknown>
  resolveBaseCommitSha(repository: WorkItemIntakeRequest["repository"]): Promise<string>
  runScrumMaster(input: ScrumMasterInvocationInput): Promise<unknown>
  loadScrumMasterPrompt?: () => Promise<unknown>
  now?: () => Date
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown work-item intake failure"
}

function failure(
  node: WorkItemIntakeFailure["node"],
  classification: WorkItemIntakeFailure["classification"],
  message: string,
  retryable = false
): WorkItemIntakeFailure {
  return { node, classification, message, retryable }
}

function event(
  dependencies: WorkItemIntakeDependencies,
  node: WorkItemIntakeEvent["node"],
  outcome: WorkItemIntakeEvent["outcome"],
  summary: string
): WorkItemIntakeEvent {
  return { node, outcome, at: (dependencies.now?.() ?? new Date()).toISOString(), summary }
}

function sameWorkItem(left: unknown, right: unknown): boolean {
  return JSON.stringify(LinearWorkItemSchema.parse(left)) === JSON.stringify(LinearWorkItemSchema.parse(right))
}

export function createWorkItemIntakeGraph(dependencies: WorkItemIntakeDependencies) {
  const activeRuns = new Map<string, AbortController>()

  const fetchLinearCandidates = async (stateInput: WorkItemIntakeState) => {
    const state = WorkItemIntakeStateSchema.parse(stateInput)
    try {
      const candidates = LinearCandidateListSchema.parse(await dependencies.fetchCandidates(state.request.team))
      return {
        candidates,
        phase: "candidates_fetched" as const,
        events: [
          event(
            dependencies,
            "fetchLinearCandidates",
            "completed",
            `Fetched ${candidates.issues.length} Linear candidates for ${candidates.team.key}`
          )
        ]
      }
    } catch (error) {
      const graphFailure = failure("fetchLinearCandidates", "linear", errorMessage(error), true)
      return {
        phase: "failed" as const,
        terminalStatus: "failed" as const,
        failure: graphFailure,
        events: [event(dependencies, "fetchLinearCandidates", "failed", graphFailure.message)]
      }
    }
  }

  const resolveBaseCommit = async (stateInput: WorkItemIntakeState) => {
    const state = WorkItemIntakeStateSchema.parse(stateInput)
    if (state.failure !== null) {
      return { events: [event(dependencies, "resolveBaseCommit", "skipped", "Skipped after candidate fetch failure")] }
    }
    try {
      const baseCommitSha = z
        .string()
        .regex(/^[0-9a-f]{40}$/u)
        .parse(await dependencies.resolveBaseCommitSha(state.request.repository))
      return {
        baseCommitSha,
        phase: "base_resolved" as const,
        events: [event(dependencies, "resolveBaseCommit", "completed", `Resolved base commit ${baseCommitSha}`)]
      }
    } catch (error) {
      const graphFailure = failure("resolveBaseCommit", "repository", errorMessage(error), true)
      return {
        phase: "failed" as const,
        terminalStatus: "failed" as const,
        failure: graphFailure,
        events: [event(dependencies, "resolveBaseCommit", "failed", graphFailure.message)]
      }
    }
  }

  const runScrumMaster = async (stateInput: WorkItemIntakeState) => {
    const state = WorkItemIntakeStateSchema.parse(stateInput)
    if (state.failure !== null || state.candidates === null || state.baseCommitSha === null) {
      return {
        events: [event(dependencies, "runScrumMaster", "skipped", "Skipped because intake context is incomplete")]
      }
    }
    const candidates = state.candidates
    const baseCommitSha = state.baseCommitSha
    const signal = activeRuns.get(state.runId)?.signal ?? AbortSignal.abort()
    try {
      const prompt = ResolvedScrumMasterPromptSchema.parse(
        await (dependencies.loadScrumMasterPrompt?.() ?? resolvePrompt("scrum_master"))
      )
      const invocation = ScrumMasterInvocationSchema.parse(
        await traceOperation(
          {
            name: "workItemIntake.runScrumMaster",
            metadata: {
              runId: state.runId,
              repository: `${state.request.repository.owner}/${state.request.repository.name}`,
              baseCommitSha,
              promptVersion: prompt.version,
              promptDigest: prompt.sha256,
              linearTeam: candidates.team.key
            },
            tags: ["work-item-intake", "scrum-master", "linear-triage"]
          },
          () =>
            dependencies.runScrumMaster({
              request: state.request,
              candidates,
              baseCommitSha,
              prompt,
              signal
            })
        )
      )
      const planningResult = PlanningResultSchema.parse(invocation.output)
      const { content: _content, ...promptIdentity } = prompt
      return {
        prompt: PromptVersionSchema.parse(promptIdentity),
        planningResult,
        rawScrumMasterResponse: invocation.rawResponse,
        phase: "planned" as const,
        events: [
          event(
            dependencies,
            "runScrumMaster",
            "completed",
            `Scrum master returned a ${planningResult.disposition} plan for ${planningResult.sourceWorkItem.identifier}`
          )
        ]
      }
    } catch (error) {
      const isCancelled = error instanceof Error && error.name === "AbortError"
      const graphFailure = failure(
        "runScrumMaster",
        isCancelled ? "cancelled" : "malformed_response",
        errorMessage(error),
        !isCancelled
      )
      return {
        phase: "failed" as const,
        terminalStatus: "failed" as const,
        failure: graphFailure,
        events: [event(dependencies, "runScrumMaster", "failed", graphFailure.message)]
      }
    }
  }

  const validatePlan = (stateInput: WorkItemIntakeState) => {
    const state = WorkItemIntakeStateSchema.parse(stateInput)
    if (
      state.failure !== null ||
      state.candidates === null ||
      state.baseCommitSha === null ||
      state.prompt === null ||
      state.planningResult === null
    ) {
      return { events: [event(dependencies, "validatePlan", "skipped", "Skipped because no complete plan exists")] }
    }

    const selectedCandidate = state.candidates.issues.find(
      (candidate) => candidate.id === state.planningResult?.sourceWorkItem.id
    )
    const reasons: string[] = []
    if (selectedCandidate === undefined || !sameWorkItem(selectedCandidate, state.planningResult.sourceWorkItem)) {
      reasons.push("Selected Linear work item is absent from or differs from the fetched candidate set")
    }
    if (state.planningResult.baseCommitSha !== state.baseCommitSha) {
      reasons.push("Planning result base SHA differs from the independently resolved base commit")
    }
    if (
      state.planningResult.roleAttempt.prompt.version !== state.prompt.version ||
      state.planningResult.roleAttempt.prompt.sha256 !== state.prompt.sha256
    ) {
      reasons.push("Planning result prompt identity differs from the invoked prompt")
    }
    if (reasons.length > 0) {
      const graphFailure = failure("validatePlan", "validation", reasons.join("; "))
      return {
        phase: "failed" as const,
        terminalStatus: "failed" as const,
        failure: graphFailure,
        events: [event(dependencies, "validatePlan", "failed", graphFailure.message)]
      }
    }

    const isReady = state.planningResult.disposition === "ready"
    return {
      phase: isReady ? ("ready" as const) : ("blocked" as const),
      terminalStatus: isReady ? ("ready" as const) : ("blocked" as const),
      events: [
        event(
          dependencies,
          "validatePlan",
          "completed",
          isReady ? "Validated engineer handoff" : "Validated blocked scrum-master outcome"
        )
      ]
    }
  }

  const checkpointer = new MemorySaver()
  const graph = new StateGraph(WorkItemIntakeAnnotation)
    .addNode("fetchLinearCandidates", fetchLinearCandidates)
    .addNode("resolveBaseCommit", resolveBaseCommit)
    .addNode("runScrumMaster", runScrumMaster)
    .addNode("validatePlan", validatePlan)
    .addEdge(START, "fetchLinearCandidates")
    .addEdge("fetchLinearCandidates", "resolveBaseCommit")
    .addEdge("resolveBaseCommit", "runScrumMaster")
    .addEdge("runScrumMaster", "validatePlan")
    .addEdge("validatePlan", END)
    .compile({ checkpointer })

  return {
    graph,
    checkpointer,
    async invoke(request: WorkItemIntakeRequest): Promise<WorkItemIntakeState> {
      const initialState = createInitialWorkItemIntakeState(request)
      const config = {
        configurable: { thread_id: request.runId },
        metadata: {
          runId: request.runId,
          repository: `${request.repository.owner}/${request.repository.name}`,
          graphVersion: WORK_ITEM_INTAKE_SCHEMA_VERSION,
          linearTeam: request.team
        },
        tags: ["work-item-intake", "linear-triage"]
      }
      const existingSnapshot = await graph.getState(config)
      const existingState = WorkItemIntakeStateSchema.safeParse(existingSnapshot.values)
      if (existingState.success) {
        if (existingState.data.requestDigest !== initialState.requestDigest) {
          throw new Error(`Run ${request.runId} is already bound to a different intake request`)
        }
        if (existingState.data.terminalStatus !== "running") {
          return existingState.data
        }
      }
      const controller = new AbortController()
      activeRuns.set(request.runId, controller)
      try {
        return WorkItemIntakeStateSchema.parse(await graph.invoke(initialState, config))
      } finally {
        activeRuns.delete(request.runId)
      }
    },
    async inspect(runId: string): Promise<WorkItemIntakeState | null> {
      const snapshot = await graph.getState({ configurable: { thread_id: runId } })
      const state = WorkItemIntakeStateSchema.safeParse(snapshot.values)
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
