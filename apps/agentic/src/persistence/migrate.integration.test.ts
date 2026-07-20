import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { WorkflowDefinitionV2Schema } from "../workflows/definitionV2"
import * as schema from "./schema"
import { PostgresWorkflowScheduleStore } from "./workflowScheduleStore"
import { PostgresWorkflowStore } from "./workflowStore"

const describePostgres = process.env.POSTGRES_API_URL === undefined ? describe.skip : describe
const migrationsFolder = fileURLToPath(new URL("../../drizzle/", import.meta.url))
const migrationJournalUrl = new URL("../../drizzle/meta/_journal.json", import.meta.url)
const initialDraft = WorkflowDefinitionV2Schema.parse({
  schemaVersion: "2",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  constants: {},
  resourceBindings: {},
  fixtures: [],
  steps: [
    {
      id: "manual",
      label: "Manual",
      position: { x: 0, y: 0 },
      definition: { kind: "manual_trigger", version: 1 },
      config: {},
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    },
    {
      id: "success",
      label: "Success",
      position: { x: 200, y: 0 },
      definition: { kind: "success", version: 1 },
      config: {},
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    }
  ],
  connections: [
    {
      id: "manual-success",
      source: { stepId: "manual", port: "input" },
      target: { stepId: "success", port: "result" },
      outcome: "success",
      mappings: [{ sourcePath: [], targetPath: [] }]
    }
  ]
})

function databaseIdentifier(value: string) {
  if (!/^agency_migration_[a-f0-9]+$/u.test(value)) {
    throw new Error("Invalid migration test database name")
  }
  return `"${value}"`
}

describePostgres.sequential("PostgreSQL migrations", () => {
  it("applies the complete chain to a clean database and persists a workflow", async () => {
    const sourceUrl = new URL(process.env.POSTGRES_API_URL ?? "")
    const databaseName = `agency_migration_${randomUUID().replaceAll("-", "")}`
    const adminPool = new pg.Pool({ connectionString: sourceUrl.toString(), max: 1 })
    const testUrl = new URL(sourceUrl)
    testUrl.pathname = `/${databaseName}`
    let testPool: pg.Pool | undefined

    try {
      await adminPool.query(`CREATE DATABASE ${databaseIdentifier(databaseName)}`)
      testPool = new pg.Pool({ connectionString: testUrl.toString(), max: 2 })
      const database = drizzle(testPool, { schema })

      await migrate(database, { migrationsFolder, migrationsSchema: "agentic", migrationsTable: "migrations" })
      await migrate(database, { migrationsFolder, migrationsSchema: "agentic", migrationsTable: "migrations" })

      const migrationJournal = z
        .object({ entries: z.array(z.object({ tag: z.string().min(1) })) })
        .parse(JSON.parse(await readFile(migrationJournalUrl, "utf8")))
      const migrationResult = await testPool.query<{ count: number }>(
        'SELECT count(*)::integer AS count FROM "agentic"."migrations"'
      )
      expect(migrationResult.rows[0]?.count).toBe(migrationJournal.entries.length)

      const objectResult = await testPool.query<{
        runEvents: string | null
        runLinks: string | null
        runLinksIndex: string | null
      }>(
        `SELECT
          to_regclass('agentic.workflow_run_events')::text AS "runEvents",
          to_regclass('agentic.workflow_run_links')::text AS "runLinks",
          to_regclass('agentic.workflow_run_links_child_uidx')::text AS "runLinksIndex"`
      )
      expect(objectResult.rows[0]).toEqual({
        runEvents: "agentic.workflow_run_events",
        runLinks: "agentic.workflow_run_links",
        runLinksIndex: "agentic.workflow_run_links_child_uidx"
      })

      const workflowStore = new PostgresWorkflowStore(database)
      const created = await workflowStore.create({
        name: "Migration proof",
        description: "Clean migration workflow",
        draft: initialDraft
      })
      expect(created).toMatchObject({ draftRevision: 1, status: "draft", activePublishedVersion: null })

      const updated = await workflowStore.updateDraft({
        workflowId: created.workflowId,
        expectedRevision: 1,
        name: "Publication proof",
        description: created.description,
        draft: initialDraft
      })
      expect(updated).toMatchObject({ draftRevision: 2, name: "Publication proof" })
      await expect(
        workflowStore.updateDraft({
          workflowId: created.workflowId,
          expectedRevision: 1,
          name: "Stale update",
          description: created.description,
          draft: initialDraft
        })
      ).rejects.toThrow("Workflow draft revision conflict")

      await expect(workflowStore.publish(created.workflowId, [], [], 1)).rejects.toThrow(
        "Workflow draft changed during publication"
      )
      const published = await workflowStore.publish(created.workflowId, [], [], 2)
      expect(published).toMatchObject({ workflowId: created.workflowId, version: 1, content: initialDraft })
      await expect(workflowStore.get(created.workflowId)).resolves.toMatchObject({
        draftRevision: 2,
        status: "draft",
        activePublishedVersion: 1
      })

      const changedDraft = WorkflowDefinitionV2Schema.parse({
        ...initialDraft,
        steps: initialDraft.steps.map((step) =>
          step.id === "success" ? { ...step, label: "Changed after publication" } : step
        )
      })
      await workflowStore.updateDraft({
        workflowId: created.workflowId,
        expectedRevision: 2,
        name: "Publication proof",
        description: created.description,
        draft: changedDraft
      })

      await expect(workflowStore.getActivePublishedVersion(created.workflowId)).resolves.toMatchObject({
        version: 1,
        content: initialDraft
      })
      await expect(workflowStore.getExecutionPackage(created.workflowId, 1)).resolves.toMatchObject({
        workflowId: created.workflowId,
        workflowVersion: 1,
        content: {
          graph: { steps: expect.arrayContaining([expect.objectContaining({ id: "success", label: "Success" })]) }
        }
      })

      const scheduleStoreA = new PostgresWorkflowScheduleStore(database)
      const scheduleStoreB = new PostgresWorkflowScheduleStore(database)
      const synchronizedAt = new Date("2026-07-20T09:00:00.000Z")
      await scheduleStoreA.synchronize(
        [
          {
            workflowId: created.workflowId,
            version: 1,
            nodeId: "daily-delivery",
            label: "Daily delivery",
            intervalSeconds: 300,
            scheduleExpression: null,
            timezone: "UTC"
          },
          {
            workflowId: created.workflowId,
            version: 1,
            nodeId: "weekday-delivery",
            label: "Weekday delivery",
            intervalSeconds: null,
            scheduleExpression: "0 10 * * 1-5",
            timezone: "UTC"
          }
        ],
        synchronizedAt
      )
      const persistedSchedules = await scheduleStoreA.list()
      const persistedSchedule = persistedSchedules.find(({ triggerNodeId }) => triggerNodeId === "daily-delivery")
      expect(persistedSchedule).toMatchObject({
        workflowId: created.workflowId,
        workflowVersion: 1,
        triggerNodeId: "daily-delivery",
        enabled: true,
        nextRunAt: new Date("2026-07-20T09:05:00.000Z")
      })
      expect(persistedSchedules.find(({ triggerNodeId }) => triggerNodeId === "weekday-delivery")).toMatchObject({
        intervalSeconds: null,
        scheduleExpression: "0 10 * * 1-5",
        timezone: "UTC",
        nextRunAt: new Date("2026-07-20T10:00:00.000Z")
      })

      const dueAt = new Date("2026-07-20T09:05:01.000Z")
      const [claimsA, claimsB] = await Promise.all([
        scheduleStoreA.claimDue({ owner: "worker-a", now: dueAt, leaseDurationMs: 30_000, limit: 10 }),
        scheduleStoreB.claimDue({ owner: "worker-b", now: dueAt, leaseDurationMs: 30_000, limit: 10 })
      ])
      const claims = [...claimsA, ...claimsB]
      expect(claims).toHaveLength(1)
      const firstClaim = claims[0]!
      const firstOwner = claimsA.length === 1 ? "worker-a" : "worker-b"
      await (firstOwner === "worker-a" ? scheduleStoreA : scheduleStoreB).failClaim({
        schedule: firstClaim,
        owner: firstOwner,
        now: dueAt,
        error: new Error("Temporary dispatch failure")
      })

      const [retryClaim] = await scheduleStoreA.claimDue({
        owner: "worker-a",
        now: dueAt,
        leaseDurationMs: 30_000,
        limit: 10
      })
      expect(retryClaim?.nextRunAt).toEqual(firstClaim.nextRunAt)
      const completedAt = new Date("2026-07-20T09:05:02.000Z")
      await scheduleStoreA.completeClaim({ schedule: retryClaim!, owner: "worker-a", now: completedAt })

      const completedSchedule = (await scheduleStoreA.list()).find(
        ({ triggerNodeId }) => triggerNodeId === "daily-delivery"
      )
      expect(completedSchedule).toMatchObject({
        lastSuccessfulAt: completedAt,
        nextRunAt: new Date("2026-07-20T09:10:02.000Z"),
        failureCode: null,
        failureDetails: null
      })
      await expect(
        scheduleStoreA.update({
          scheduleId: completedSchedule!.scheduleId,
          expectedRevision: completedSchedule!.revision,
          enabled: false,
          intervalSeconds: 600,
          scheduleExpression: null,
          timezone: "UTC",
          now: completedAt
        })
      ).resolves.toMatchObject({ enabled: false, intervalSeconds: 600 })
      await expect(
        scheduleStoreB.update({
          scheduleId: completedSchedule!.scheduleId,
          expectedRevision: completedSchedule!.revision,
          enabled: true,
          intervalSeconds: 300,
          scheduleExpression: null,
          timezone: "UTC",
          now: completedAt
        })
      ).rejects.toThrow("Workflow schedule revision conflict")
    } finally {
      await testPool?.end()
      await adminPool.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        [databaseName]
      )
      await adminPool.query(`DROP DATABASE IF EXISTS ${databaseIdentifier(databaseName)}`)
      await adminPool.end()
    }
  }, 30_000)
})
