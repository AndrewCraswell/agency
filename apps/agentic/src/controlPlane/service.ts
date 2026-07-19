import { createHash, randomUUID } from "node:crypto"
import { z } from "zod"
import { agents, engineeringAgent } from "../contracts/agent"
import type { LinearClient } from "../linear/client"
import type { BindWorkflowRunInput, ControlPlaneStore, WorkflowRunRecord } from "../persistence/controlPlaneStore"
import {
  AssignWorkItemRequestSchema,
  AssignWorkItemResponseSchema,
  CONTROL_PLANE_SCHEMA_VERSION,
  ControlPlaneSnapshotSchema,
  WorkflowEventViewSchema,
  WorkflowRunDetailSchema,
  WorkflowRunViewSchema,
  type WorkflowRunView
} from "./contracts"
import type { TaskInventory, TaskInventoryCache } from "./taskInventoryCache"
import { deliveryWorkflowTopology } from "./workflowTopology"

const ServiceOptionsSchema = z
  .object({
    repositoryOwner: z.string().trim().min(1),
    repositoryName: z.string().trim().min(1)
  })
  .strict()

type CandidateSource = Pick<LinearClient, "listCandidates" | "listTaskGraph">
const TASK_GRAPH_TTL_MS = 30 * 60 * 1_000
const TASK_GRAPH_RETRY_MS = 5 * 60 * 1_000

function runView(record: WorkflowRunRecord): WorkflowRunView {
  return WorkflowRunViewSchema.parse({
    runId: record.runId,
    status: record.status,
    stage: record.stage,
    activeRole: record.activeRole,
    repository: `${record.repositoryOwner}/${record.repositoryName}`,
    sourceWorkItemId: record.sourceWorkItemId,
    sourceWorkItemIdentifier: record.sourceWorkItemIdentifier,
    assignedAgentId: record.assignedAgentId,
    pullRequestNumber: record.pullRequestNumber,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  })
}

function assignmentRequestDigest(input: Omit<BindWorkflowRunInput, "requestDigest">): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex")
}

export class ControlPlaneService {
  readonly #candidates: CandidateSource
  readonly #store: ControlPlaneStore
  readonly #options: z.output<typeof ServiceOptionsSchema>
  readonly #now: () => Date
  readonly #runId: () => string
  readonly #inventoryPersistence: TaskInventoryCache | null
  #inventoryLoaded = false
  #taskInventoryCache: { value: TaskInventory; expiresAt: number } | null = null
  #taskInventoryRequest: Promise<TaskInventory> | null = null

  constructor(
    candidates: CandidateSource,
    store: ControlPlaneStore,
    options: z.input<typeof ServiceOptionsSchema>,
    runtime: { now?: () => Date; runId?: () => string; taskInventoryCache?: TaskInventoryCache } = {}
  ) {
    this.#candidates = candidates
    this.#store = store
    this.#options = ServiceOptionsSchema.parse(options)
    this.#now = runtime.now ?? (() => new Date())
    this.#runId = runtime.runId ?? randomUUID
    this.#inventoryPersistence = runtime.taskInventoryCache ?? null
  }

  async snapshot() {
    const [tasks, runRecords] = await Promise.all([this.#taskInventory(), this.#store.listWorkflowRuns(50)])
    return ControlPlaneSnapshotSchema.parse({
      schemaVersion: CONTROL_PLANE_SCHEMA_VERSION,
      fetchedAt: this.#now().toISOString(),
      agents,
      tasks,
      runs: runRecords.map(runView)
    })
  }

  async #taskInventory(): Promise<TaskInventory> {
    const now = this.#now().getTime()
    if (this.#taskInventoryCache !== null && this.#taskInventoryCache.expiresAt > now) {
      return this.#taskInventoryCache.value
    }
    if (this.#taskInventoryRequest !== null) {
      return this.#taskInventoryRequest
    }
    this.#taskInventoryRequest = this.#loadTaskInventory(now)
      .catch((error: unknown) => {
        if (this.#taskInventoryCache !== null) {
          this.#taskInventoryCache.expiresAt = now + TASK_GRAPH_RETRY_MS
          return this.#taskInventoryCache.value
        }
        throw error
      })
      .finally(() => {
        this.#taskInventoryRequest = null
      })
    return this.#taskInventoryRequest
  }

  async #loadTaskInventory(now: number): Promise<TaskInventory> {
    if (!this.#inventoryLoaded) {
      this.#inventoryLoaded = true
      const persisted = await this.#inventoryPersistence?.load()
      if (persisted !== undefined && persisted !== null) {
        this.#taskInventoryCache = { value: persisted, expiresAt: now + TASK_GRAPH_TTL_MS }
        return persisted
      }
    }
    const tasks = (await this.#candidates.listTaskGraph()).tasks
    await this.#inventoryPersistence?.save(tasks)
    this.#taskInventoryCache = { value: tasks, expiresAt: now + TASK_GRAPH_TTL_MS }
    return tasks
  }

  async assign(requestInput: unknown) {
    const request = AssignWorkItemRequestSchema.parse(requestInput)
    const agent = engineeringAgent(request.agentId)
    if (agent === null) {
      throw new Error(`Agent ${request.agentId} is not an engineering agent`)
    }
    const existing = await this.#store.findActiveWorkflowRunByWorkItem(request.workItemId)
    if (existing !== null) {
      if (existing.assignedAgentId !== agent.id) {
        throw new Error(`The selected Linear task is already assigned to ${existing.assignedAgentId ?? "another run"}`)
      }
      return AssignWorkItemResponseSchema.parse({
        schemaVersion: CONTROL_PLANE_SCHEMA_VERSION,
        created: false,
        run: runView(existing)
      })
    }
    const runs = await this.#store.listWorkflowRuns(200)
    const activeAgentRun = runs.find(
      (run) => run.assignedAgentId === agent.id && (run.status === "queued" || run.status === "running")
    )
    if (activeAgentRun !== undefined) {
      throw new Error(
        `Agent ${agent.name} is already assigned to ${activeAgentRun.sourceWorkItemIdentifier ?? "a task"}`
      )
    }

    const candidateList = await this.#candidates.listCandidates(50)
    const workItem = candidateList.issues.find((candidate) => candidate.id === request.workItemId)
    if (workItem === undefined) {
      throw new Error("The selected Linear task is not an active assignment candidate")
    }

    const inputWithoutDigest = {
      runId: this.#runId(),
      graphVersion: "delivery-v1",
      repositoryOwner: this.#options.repositoryOwner,
      repositoryName: this.#options.repositoryName,
      sourceWorkItemId: workItem.id,
      sourceWorkItemIdentifier: workItem.identifier,
      assignedAgentId: agent.id
    }
    const created = await this.#store.bindWorkflowRun({
      ...inputWithoutDigest,
      requestDigest: assignmentRequestDigest(inputWithoutDigest)
    })
    return AssignWorkItemResponseSchema.parse({
      schemaVersion: CONTROL_PLANE_SCHEMA_VERSION,
      created: true,
      run: runView(created)
    })
  }

  async runDetail(runIdInput: string) {
    const runId = z.uuid().parse(runIdInput)
    const [record, events] = await Promise.all([
      this.#store.getWorkflowRun(runId),
      this.#store.listWorkflowEvents(runId, 200)
    ])
    if (record === null) {
      throw new Error(`Workflow run ${runId} does not exist`)
    }
    return WorkflowRunDetailSchema.parse({
      schemaVersion: CONTROL_PLANE_SCHEMA_VERSION,
      run: runView(record),
      workflow: deliveryWorkflowTopology,
      events: events.map((event) =>
        WorkflowEventViewSchema.parse({
          eventId: event.eventId,
          node: event.node,
          outcome: event.outcome,
          summary: event.summary,
          details: event.details,
          createdAt: event.createdAt.toISOString()
        })
      )
    })
  }
}
