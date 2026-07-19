import { z } from "zod"
import type { ControlPlaneStore, WorkflowRunRecord } from "../persistence/controlPlaneStore"

const DispatcherOptionsSchema = z
  .object({
    maxConcurrentRuns: z.number().int().positive().max(10).default(10)
  })
  .strict()

const DispatchOutcomeSchema = z
  .object({
    status: z.enum(["running", "blocked", "failed", "cancelled", "published"]),
    stage: z.enum(["planning", "coding", "reviewing", "repairing", "publishing", "completed"]),
    activeRole: z.enum(["scrum_master", "coder", "reviewer", "repairer"]).nullable()
  })
  .strict()

export type DispatchOutcome = z.infer<typeof DispatchOutcomeSchema>

export interface WorkflowRunExecutor {
  execute(run: WorkflowRunRecord): Promise<DispatchOutcome>
}

type DispatcherStore = Pick<ControlPlaneStore, "listWorkflowRuns" | "setWorkflowProgress">

export class QueuedRunDispatcher {
  readonly #store: DispatcherStore
  readonly #executor: WorkflowRunExecutor
  readonly #maxConcurrentRuns: number
  readonly #activeRunIds = new Set<string>()

  constructor(
    store: DispatcherStore,
    executor: WorkflowRunExecutor,
    options: z.input<typeof DispatcherOptionsSchema> = {}
  ) {
    this.#store = store
    this.#executor = executor
    this.#maxConcurrentRuns = DispatcherOptionsSchema.parse(options).maxConcurrentRuns
  }

  async dispatchPending(): Promise<number> {
    const availableSlots = this.#maxConcurrentRuns - this.#activeRunIds.size
    if (availableSlots <= 0) {
      return 0
    }
    const runs = await this.#store.listWorkflowRuns(200)
    const queuedRuns = runs
      .filter((run) => run.status === "queued" && !this.#activeRunIds.has(run.runId))
      .slice(0, availableSlots)
    await Promise.all(queuedRuns.map((run) => this.#dispatch(run)))
    return queuedRuns.length
  }

  async #dispatch(run: WorkflowRunRecord): Promise<void> {
    this.#activeRunIds.add(run.runId)
    try {
      await this.#store.setWorkflowProgress(run.runId, "running", "planning", "scrum_master")
      const outcome = DispatchOutcomeSchema.parse(await this.#executor.execute(run))
      await this.#store.setWorkflowProgress(run.runId, outcome.status, outcome.stage, outcome.activeRole)
    } catch {
      await this.#store.setWorkflowProgress(run.runId, "failed", "planning", null)
    } finally {
      this.#activeRunIds.delete(run.runId)
    }
  }
}
