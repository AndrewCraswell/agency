import { createHash, randomUUID } from "node:crypto"
import { z } from "zod"
import { agents, engineeringAgent } from "../contracts/agent"
import type { LinearClient } from "../linear/client"
import type { BindWorkflowRunInput, ControlPlaneStore, WorkflowRunRecord } from "../persistence/controlPlaneStore"
import {
  AgentCatalogSchema,
  AssignWorkItemRequestSchema,
  AssignWorkItemResponseSchema,
  CONTROL_PLANE_SCHEMA_VERSION,
  ControlPlaneRunSnapshotSchema,
  ControlPlaneSnapshotSchema,
  WorkItemQueryResponseSchema,
  WorkItemQuerySchema,
  WorkflowRunViewSchema,
  type WorkItemQuery,
  type WorkItemQueryResponse,
  type WorkItemQueueStatus,
  type WorkflowRunView
} from "./contracts"
import type { TaskInventory, TaskInventoryCache } from "./taskInventoryCache"

const ServiceOptionsSchema = z
  .object({
    repositoryOwner: z.string().trim().min(1),
    repositoryName: z.string().trim().min(1)
  })
  .strict()

type CandidateSource = Pick<LinearClient, "listCandidates" | "listTaskGraph">
const TASK_GRAPH_TTL_MS = 30 * 60 * 1_000
const TASK_GRAPH_RETRY_MS = 5 * 60 * 1_000
const WorkItemCursorSchema = z.object({ offset: z.number().int().nonnegative() }).strict()
const AGE_MILLISECONDS = { day: 24 * 60 * 60 * 1_000, week: 7 * 24 * 60 * 60 * 1_000, month: 30 * 24 * 60 * 60 * 1_000 }

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

function queueStatus(task: TaskInventory[number], run: WorkflowRunView | null): WorkItemQueueStatus | null {
  if (run?.status === "published") {
    return null
  }
  if (run?.status === "blocked" || run?.status === "failed" || run?.status === "cancelled") {
    return "blocked"
  }
  if (run?.status === "queued" || run?.status === "running" || task.state.type === "started") {
    return "in_progress"
  }
  return task.blockedBy.length > 0 ? "blocked" : "todo"
}

function decodeCursor(cursor: string | undefined): number {
  if (cursor === undefined) {
    return 0
  }
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    return WorkItemCursorSchema.parse(value).offset
  } catch {
    throw new z.ZodError([{ code: "custom", path: ["cursor"], message: "Cursor is invalid." }])
  }
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url")
}

function compareWorkItems(
  left: WorkItemQueryResponse["items"][number],
  right: WorkItemQueryResponse["items"][number],
  query: WorkItemQuery
): number {
  let result = 0
  if (query.sort === "priority") {
    result = left.task.priority - right.task.priority
  } else if (query.sort === "created") {
    result = left.task.createdAt.localeCompare(right.task.createdAt)
  } else if (query.sort === "updated") {
    result = left.task.updatedAt.localeCompare(right.task.updatedAt)
  } else {
    result = left.task.identifier.localeCompare(right.task.identifier, undefined, { numeric: true })
  }
  if (result !== 0) {
    return query.direction === "asc" ? result : -result
  }
  return left.task.identifier.localeCompare(right.task.identifier, undefined, { numeric: true })
}

function facet(values: Array<string | null>): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (value !== null) {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .toSorted((left, right) => left.value.localeCompare(right.value))
}

export class ControlPlaneService {
  agents() {
    return AgentCatalogSchema.parse({ schemaVersion: CONTROL_PLANE_SCHEMA_VERSION, agents })
  }

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

  async runSnapshot() {
    const runRecords = await this.#store.listWorkflowRuns(200)
    return ControlPlaneRunSnapshotSchema.parse({
      schemaVersion: CONTROL_PLANE_SCHEMA_VERSION,
      fetchedAt: this.#now().toISOString(),
      agents,
      runs: runRecords.map(runView)
    })
  }

  async queryWorkItems(queryInput: unknown) {
    const query = WorkItemQuerySchema.parse(queryInput)
    const [tasks, runRecords] = await Promise.all([this.#taskInventory(), this.#store.listWorkflowRuns(200)])
    const runs = runRecords.map(runView)
    const rows = tasks.flatMap((task) => {
      const run =
        runs
          .filter((candidate) => candidate.sourceWorkItemId === task.id)
          .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
      const status = queueStatus(task, run)
      return status === null ? [] : [{ task, run, status }]
    })
    const aggregates = {
      all: rows.length,
      todo: rows.filter(({ status }) => status === "todo").length,
      inProgress: rows.filter(({ status }) => status === "in_progress").length,
      blocked: rows.filter(({ status }) => status === "blocked").length,
      repositories: facet(rows.map(({ run }) => run?.repository ?? null)),
      assignees: facet(rows.map(({ run }) => run?.assignedAgentId ?? null)),
      priorities: [0, 1, 2, 3, 4]
        .map((value) => ({ value, count: rows.filter(({ task }) => task.priority === value).length }))
        .filter(({ count }) => count > 0)
    }
    const normalizedQuery = query.q?.toLocaleLowerCase()
    const maximumCreatedAt = query.age === undefined ? undefined : this.#now().getTime() - AGE_MILLISECONDS[query.age]
    const filtered = rows
      .filter(({ task, run, status }) => {
        if (
          normalizedQuery !== undefined &&
          !`${task.identifier} ${task.title} ${task.description}`.toLocaleLowerCase().includes(normalizedQuery)
        ) {
          return false
        }
        if (query.status !== undefined && status !== query.status) return false
        if (query.repository !== undefined && run?.repository !== query.repository) return false
        if (query.assignee !== undefined && run?.assignedAgentId !== query.assignee) return false
        if (query.priority !== undefined && task.priority !== query.priority) return false
        if (maximumCreatedAt !== undefined && new Date(task.createdAt).getTime() > maximumCreatedAt) return false
        return true
      })
      .toSorted((left, right) => compareWorkItems(left, right, query))
    const offset = decodeCursor(query.cursor)
    const items = filtered.slice(offset, offset + query.pageSize)
    const nextOffset = offset + items.length
    return WorkItemQueryResponseSchema.parse({
      schemaVersion: CONTROL_PLANE_SCHEMA_VERSION,
      fetchedAt: this.#now().toISOString(),
      items,
      total: filtered.length,
      previousCursor: offset > 0 ? encodeCursor(Math.max(0, offset - query.pageSize)) : null,
      nextCursor: nextOffset < filtered.length ? encodeCursor(nextOffset) : null,
      aggregates
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
}
