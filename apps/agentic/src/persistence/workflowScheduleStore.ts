import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import { createSelectSchema } from "drizzle-zod"
import { z } from "zod"
import { ScheduleDefinitionSchema, nextScheduleRunAt, type ScheduleDefinition } from "../workflows/scheduleDefinition"
import { workflowScheduleOccurrences, workflowSchedules } from "./schema"

const WorkflowScheduleRecordSchema = createSelectSchema(workflowSchedules, {
  enabled: z
    .number()
    .int()
    .transform((value) => value === 1)
})

export type WorkflowScheduleRecord = z.infer<typeof WorkflowScheduleRecordSchema>
export type PublishedScheduleDefinition = ScheduleDefinition & {
  workflowId: string
  version: number
  nodeId: string
  label: string
}

type WorkflowScheduleDatabase = NodePgDatabase<{
  workflowSchedules: typeof workflowSchedules
  workflowScheduleOccurrences: typeof workflowScheduleOccurrences
}>

function occurrenceId(schedule: WorkflowScheduleRecord): string {
  return `${schedule.scheduleId}:${schedule.nextRunAt.toISOString()}`
}

function scheduleDefinition(value: {
  intervalSeconds: number | null
  scheduleExpression: string | null
  timezone: string
}): ScheduleDefinition {
  return ScheduleDefinitionSchema.parse({
    intervalSeconds: value.intervalSeconds,
    scheduleExpression: value.scheduleExpression,
    timezone: value.timezone
  })
}

export class PostgresWorkflowScheduleStore {
  readonly #database: WorkflowScheduleDatabase

  constructor(database: WorkflowScheduleDatabase) {
    this.#database = database
  }

  async synchronize(definitions: PublishedScheduleDefinition[], now: Date): Promise<void> {
    const activeKeys = new Set(definitions.map(({ workflowId, nodeId }) => `${workflowId}:${nodeId}`))
    await this.#database.transaction(async (transaction) => {
      const existing = await transaction.select().from(workflowSchedules)
      const existingByKey = new Map(
        existing.map((schedule) => [`${schedule.workflowId}:${schedule.triggerNodeId}`, schedule])
      )
      for (const definition of definitions) {
        const parsedDefinition = scheduleDefinition(definition)
        const key = `${definition.workflowId}:${definition.nodeId}`
        const current = existingByKey.get(key)
        const changed =
          current !== undefined &&
          (current.workflowVersion !== definition.version ||
            current.label !== definition.label ||
            current.intervalSeconds !== parsedDefinition.intervalSeconds ||
            current.scheduleExpression !== parsedDefinition.scheduleExpression ||
            current.timezone !== parsedDefinition.timezone)
        if (current === undefined) {
          await transaction.insert(workflowSchedules).values({
            workflowId: definition.workflowId,
            workflowVersion: definition.version,
            triggerNodeId: definition.nodeId,
            label: definition.label,
            ...parsedDefinition,
            nextRunAt: nextScheduleRunAt(parsedDefinition, now, key)
          })
        } else if (changed) {
          await transaction
            .update(workflowSchedules)
            .set({
              workflowVersion: definition.version,
              label: definition.label,
              ...parsedDefinition,
              nextRunAt: nextScheduleRunAt(parsedDefinition, now, key),
              leaseOwner: null,
              leaseExpiresAt: null,
              failureCode: null,
              failureDetails: null,
              updatedAt: now,
              revision: current.revision + 1
            })
            .where(
              and(
                eq(workflowSchedules.scheduleId, current.scheduleId),
                eq(workflowSchedules.revision, current.revision)
              )
            )
        }
      }
      for (const schedule of existing) {
        if (!activeKeys.has(`${schedule.workflowId}:${schedule.triggerNodeId}`) && schedule.enabled === 1) {
          await transaction
            .update(workflowSchedules)
            .set({
              enabled: 0,
              leaseOwner: null,
              leaseExpiresAt: null,
              updatedAt: now,
              revision: schedule.revision + 1
            })
            .where(
              and(
                eq(workflowSchedules.scheduleId, schedule.scheduleId),
                eq(workflowSchedules.revision, schedule.revision)
              )
            )
        }
      }
    })
  }

  async list(): Promise<WorkflowScheduleRecord[]> {
    const rows = await this.#database.select().from(workflowSchedules).orderBy(asc(workflowSchedules.label))
    return rows.map((row) => WorkflowScheduleRecordSchema.parse(row))
  }

  async update(input: {
    scheduleId: string
    expectedRevision: number
    enabled: boolean
    intervalSeconds: number | null
    scheduleExpression: string | null
    timezone: string
    now: Date
  }): Promise<WorkflowScheduleRecord> {
    const definition = scheduleDefinition(input)
    const rows = await this.#database
      .update(workflowSchedules)
      .set({
        enabled: input.enabled ? 1 : 0,
        ...definition,
        nextRunAt: nextScheduleRunAt(definition, input.now, input.scheduleId),
        leaseOwner: null,
        leaseExpiresAt: null,
        failureCode: null,
        failureDetails: null,
        revision: input.expectedRevision + 1,
        updatedAt: input.now
      })
      .where(
        and(
          eq(workflowSchedules.scheduleId, z.uuid().parse(input.scheduleId)),
          eq(workflowSchedules.revision, z.number().int().positive().parse(input.expectedRevision))
        )
      )
      .returning()
    if (rows[0] === undefined) {
      throw new Error("Workflow schedule revision conflict")
    }
    return WorkflowScheduleRecordSchema.parse(rows[0])
  }

  async claimDue(input: {
    owner: string
    now: Date
    leaseDurationMs: number
    limit: number
  }): Promise<WorkflowScheduleRecord[]> {
    const candidates = await this.#database
      .select()
      .from(workflowSchedules)
      .where(
        and(
          eq(workflowSchedules.enabled, 1),
          lte(workflowSchedules.nextRunAt, input.now),
          or(isNull(workflowSchedules.leaseExpiresAt), lte(workflowSchedules.leaseExpiresAt, input.now))
        )
      )
      .orderBy(asc(workflowSchedules.nextRunAt))
      .limit(z.number().int().positive().max(100).parse(input.limit))
    const claimed: WorkflowScheduleRecord[] = []
    for (const candidate of candidates) {
      const rows = await this.#database
        .update(workflowSchedules)
        .set({
          leaseOwner: input.owner,
          leaseExpiresAt: new Date(input.now.getTime() + input.leaseDurationMs),
          lastAttemptedAt: input.now,
          revision: candidate.revision + 1,
          updatedAt: input.now
        })
        .where(
          and(
            eq(workflowSchedules.scheduleId, candidate.scheduleId),
            eq(workflowSchedules.revision, candidate.revision),
            eq(workflowSchedules.enabled, 1),
            lte(workflowSchedules.nextRunAt, input.now),
            or(isNull(workflowSchedules.leaseExpiresAt), lte(workflowSchedules.leaseExpiresAt, input.now))
          )
        )
        .returning()
      if (rows[0] !== undefined) {
        claimed.push(WorkflowScheduleRecordSchema.parse(rows[0]))
      }
    }
    return claimed
  }

  async beginOccurrence(input: { schedule: WorkflowScheduleRecord; dispatchedAt: Date }): Promise<void> {
    const latenessMs = Math.max(0, input.dispatchedAt.getTime() - input.schedule.nextRunAt.getTime())
    await this.#database
      .insert(workflowScheduleOccurrences)
      .values({
        occurrenceId: occurrenceId(input.schedule),
        scheduleId: input.schedule.scheduleId,
        scheduledAt: input.schedule.nextRunAt,
        timezone: input.schedule.timezone,
        status: "dispatching",
        attemptCount: 1,
        dispatchedAt: input.dispatchedAt,
        latenessMs,
        disposition: latenessMs === 0 ? "on_time" : "latest",
        updatedAt: input.dispatchedAt
      })
      .onConflictDoUpdate({
        target: workflowScheduleOccurrences.occurrenceId,
        set: {
          status: "dispatching",
          attemptCount: sql`${workflowScheduleOccurrences.attemptCount} + 1`,
          dispatchedAt: input.dispatchedAt,
          latenessMs,
          lastError: null,
          updatedAt: input.dispatchedAt
        }
      })
  }

  async completeClaim(input: {
    schedule: WorkflowScheduleRecord
    owner: string
    now: Date
    runId?: string
  }): Promise<void> {
    const definition = scheduleDefinition(input.schedule)
    await this.#database
      .update(workflowScheduleOccurrences)
      .set({
        status: "started",
        runId: input.runId === undefined ? null : z.uuid().parse(input.runId),
        lastError: null,
        updatedAt: input.now
      })
      .where(eq(workflowScheduleOccurrences.occurrenceId, occurrenceId(input.schedule)))
    await this.#finishClaim(input, {
      nextRunAt: nextScheduleRunAt(
        definition,
        input.schedule.nextRunAt,
        `${input.schedule.workflowId}:${input.schedule.triggerNodeId}`
      ),
      lastSuccessfulAt: input.now,
      failureCode: null,
      failureDetails: null
    })
  }

  async failClaim(input: {
    schedule: WorkflowScheduleRecord
    owner: string
    now: Date
    error: unknown
  }): Promise<void> {
    const message = input.error instanceof Error ? input.error.message : "Scheduled run dispatch failed"
    await this.#database
      .update(workflowScheduleOccurrences)
      .set({ status: "failed", lastError: message.slice(0, 2_000), updatedAt: input.now })
      .where(eq(workflowScheduleOccurrences.occurrenceId, occurrenceId(input.schedule)))
    await this.#finishClaim(input, { failureCode: "dispatch_failed", failureDetails: message.slice(0, 2_000) })
  }

  async #finishClaim(
    input: { schedule: WorkflowScheduleRecord; owner: string; now: Date },
    result: {
      nextRunAt?: Date
      lastSuccessfulAt?: Date
      failureCode: string | null
      failureDetails: string | null
    }
  ): Promise<void> {
    const rows = await this.#database
      .update(workflowSchedules)
      .set({
        ...result,
        leaseOwner: null,
        leaseExpiresAt: null,
        revision: input.schedule.revision + 1,
        updatedAt: input.now
      })
      .where(
        and(
          eq(workflowSchedules.scheduleId, input.schedule.scheduleId),
          eq(workflowSchedules.revision, input.schedule.revision),
          eq(workflowSchedules.leaseOwner, input.owner)
        )
      )
      .returning({ scheduleId: workflowSchedules.scheduleId })
    if (rows[0] === undefined) {
      throw new Error("Workflow schedule lease was lost")
    }
  }
}
