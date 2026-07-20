import { z } from "zod"
import type {
  PostgresWorkflowScheduleStore,
  PublishedScheduleDefinition,
  WorkflowScheduleRecord
} from "../persistence/workflowScheduleStore"

const ScheduleDispatcherOptionsSchema = z
  .object({
    owner: z.string().trim().min(1),
    leaseDurationMs: z.number().int().min(1_000).max(300_000).default(30_000),
    batchSize: z.number().int().min(1).max(100).default(20)
  })
  .strict()

type ScheduleStore = Pick<PostgresWorkflowScheduleStore, "claimDue" | "completeClaim" | "failClaim" | "synchronize">

export type ScheduledRunStarter = (
  workflowId: string,
  input: {
    version: number
    input: Record<string, never>
    trigger: { type: "schedule"; key: string; stepId: string }
  }
) => Promise<unknown>

function triggerKey(schedule: WorkflowScheduleRecord): string {
  return `${schedule.scheduleId}:${schedule.nextRunAt.toISOString()}`
}

export class WorkflowScheduleDispatcher {
  readonly #store: ScheduleStore
  readonly #definitions: () => Promise<PublishedScheduleDefinition[]>
  readonly #startRun: ScheduledRunStarter
  readonly #options: z.output<typeof ScheduleDispatcherOptionsSchema>
  readonly #now: () => Date
  #running = false

  constructor(
    store: ScheduleStore,
    definitions: () => Promise<PublishedScheduleDefinition[]>,
    startRun: ScheduledRunStarter,
    options: z.input<typeof ScheduleDispatcherOptionsSchema>,
    now: () => Date = () => new Date()
  ) {
    this.#store = store
    this.#definitions = definitions
    this.#startRun = startRun
    this.#options = ScheduleDispatcherOptionsSchema.parse(options)
    this.#now = now
  }

  async dispatchDue(): Promise<{ claimed: number; started: number; failed: number; skipped: boolean }> {
    if (this.#running) {
      return { claimed: 0, started: 0, failed: 0, skipped: true }
    }
    this.#running = true
    try {
      const now = this.#now()
      await this.#store.synchronize(await this.#definitions(), now)
      const schedules = await this.#store.claimDue({
        owner: this.#options.owner,
        now,
        leaseDurationMs: this.#options.leaseDurationMs,
        limit: this.#options.batchSize
      })
      let started = 0
      let failed = 0
      for (const schedule of schedules) {
        try {
          await this.#startRun(schedule.workflowId, {
            version: schedule.workflowVersion,
            input: {},
            trigger: { type: "schedule", key: triggerKey(schedule), stepId: schedule.triggerNodeId }
          })
          await this.#store.completeClaim({ schedule, owner: this.#options.owner, now: this.#now() })
          started += 1
        } catch (error) {
          await this.#store.failClaim({ schedule, owner: this.#options.owner, now: this.#now(), error })
          failed += 1
        }
      }
      return { claimed: schedules.length, started, failed, skipped: false }
    } finally {
      this.#running = false
    }
  }
}
