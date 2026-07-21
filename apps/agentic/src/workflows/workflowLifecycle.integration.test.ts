import { randomUUID } from "node:crypto"
import { once } from "node:events"
import { fileURLToPath } from "node:url"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { createControlPlaneServer } from "../controlPlane/server"
import * as schema from "../persistence/schema"
import { PostgresWorkflowJournalStore } from "../persistence/workflowJournalStore"
import { PostgresWorkflowStore } from "../persistence/workflowStore"
import { WorkflowDefinitionSchema } from "./definition"
import { WorkflowService } from "./service"

const describePostgres = process.env.POSTGRES_API_URL === undefined ? describe.skip : describe
const migrationsFolder = fileURLToPath(new URL("../../drizzle/migrations/", import.meta.url))

function databaseIdentifier(value: string) {
  if (!/^agency_lifecycle_[a-f0-9]+$/u.test(value)) throw new Error("Invalid lifecycle test database name")
  return `"${value}"`
}

function manualDefinition(successLabel: string) {
  return WorkflowDefinitionSchema.parse({
    schemaVersion: "2",
    inputSchema: { type: "object", additionalProperties: true },
    outputSchema: { type: "object", additionalProperties: true },
    constants: {},
    resourceBindings: {},
    steps: [
      {
        id: "manual",
        label: "Manual start",
        position: { x: 0, y: 0 },
        definition: { kind: "manual_trigger", version: 1 },
        config: {},
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "success",
        label: successLabel,
        position: { x: 240, y: 0 },
        definition: { kind: "set_fields", version: 1 },
        config: { fields: {} },
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      }
    ],
    connections: [
      {
        id: "manual-success",
        source: { stepId: "manual", port: "input" },
        target: { stepId: "success", port: "input" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      }
    ]
  })
}

async function jsonRequest(url: string, method: string, body?: unknown) {
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
}

describePostgres.sequential("workflow lifecycle HTTP integration", () => {
  it("creates, revises, validates, publishes, reloads, and starts an immutable workflow", async () => {
    const sourceUrl = new URL(process.env.POSTGRES_API_URL ?? "")
    const databaseName = `agency_lifecycle_${randomUUID().replaceAll("-", "")}`
    const adminPool = new pg.Pool({ connectionString: sourceUrl.toString(), max: 1 })
    const testUrl = new URL(sourceUrl)
    testUrl.pathname = `/${databaseName}`
    let testPool: pg.Pool | undefined
    let server: ReturnType<typeof createControlPlaneServer> | undefined

    try {
      await adminPool.query(`CREATE DATABASE ${databaseIdentifier(databaseName)}`)
      testPool = new pg.Pool({ connectionString: testUrl.toString(), max: 4 })
      const database = drizzle(testPool, { schema })
      await migrate(database, { migrationsFolder, migrationsSchema: "agentic", migrationsTable: "migrations" })
      const workflowStore = new PostgresWorkflowStore(database)
      const workflowJournal = new PostgresWorkflowJournalStore(database)
      const workflowService = new WorkflowService(workflowStore, workflowJournal)
      server = createControlPlaneServer(
        {} as never,
        "http://localhost:5173",
        undefined,
        undefined,
        undefined,
        workflowService
      )
      server.listen(0, "127.0.0.1")
      await once(server, "listening")
      const address = server.address()
      if (address === null || typeof address === "string") throw new Error("Expected an IP server address")
      const baseUrl = `http://127.0.0.1:${address.port}`

      const createResponse = await jsonRequest(`${baseUrl}/api/workflows`, "POST", {
        template: "blank",
        name: "Agency self-hosting proof",
        description: "Exercises the durable workflow lifecycle",
        repository: {
          connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
          provider: "github",
          resourceType: "repository",
          externalId: "agency-repository",
          name: "agency/agency",
          capabilities: ["repository.read", "repository.write", "pull_request.write"]
        }
      })
      expect(createResponse.status).toBe(201)
      const created = z
        .object({ workflowId: z.uuid(), draftRevision: z.literal(1), activePublishedVersion: z.null() })
        .passthrough()
        .parse(await createResponse.json())

      const updateResponse = await jsonRequest(`${baseUrl}/api/workflows/${created.workflowId}/draft`, "PATCH", {
        expectedRevision: 1,
        name: "Agency self-hosting proof",
        description: "Exercises the durable workflow lifecycle",
        content: manualDefinition("Published result")
      })
      expect(updateResponse.status).toBe(200)
      await expect(updateResponse.json()).resolves.toMatchObject({ draftRevision: 2 })

      const staleResponse = await jsonRequest(`${baseUrl}/api/workflows/${created.workflowId}/draft`, "PATCH", {
        expectedRevision: 1,
        name: "Stale update",
        description: "Must be rejected",
        content: manualDefinition("Stale result")
      })
      expect(staleResponse.status).toBe(409)
      await expect(staleResponse.json()).resolves.toEqual({ error: "Workflow draft revision conflict" })

      const validationResponse = await jsonRequest(`${baseUrl}/api/workflows/${created.workflowId}/validate`, "POST")
      expect(validationResponse.status).toBe(200)
      await expect(validationResponse.json()).resolves.toMatchObject({ valid: true, issues: [] })

      const publishResponse = await jsonRequest(`${baseUrl}/api/workflows/${created.workflowId}/publish`, "POST")
      expect(publishResponse.status).toBe(200)
      await expect(publishResponse.json()).resolves.toMatchObject({
        draftRevision: 2,
        activePublishedVersion: 1,
        versions: [expect.objectContaining({ version: 1 })]
      })

      const changedResponse = await jsonRequest(`${baseUrl}/api/workflows/${created.workflowId}/draft`, "PATCH", {
        expectedRevision: 2,
        name: "Agency self-hosting proof",
        description: "Exercises the durable workflow lifecycle",
        content: manualDefinition("Changed draft result")
      })
      expect(changedResponse.status).toBe(200)
      await expect(changedResponse.json()).resolves.toMatchObject({
        draftRevision: 3,
        activePublishedVersion: 1,
        content: {
          steps: expect.arrayContaining([expect.objectContaining({ id: "success", label: "Changed draft result" })])
        }
      })

      const executionPackage = await workflowStore.getExecutionPackage(created.workflowId, 1)
      expect(executionPackage?.content.graph).toMatchObject({
        steps: expect.arrayContaining([expect.objectContaining({ id: "success", label: "Published result" })])
      })

      const startResponse = await jsonRequest(`${baseUrl}/api/workflows/${created.workflowId}/runs`, "POST", {
        version: 1,
        input: { issue: "AGENCY-1" },
        trigger: { type: "manual", key: "lifecycle-proof" }
      })
      expect(startResponse.status).toBe(201)
      const started = z
        .object({ runId: z.uuid(), created: z.literal(true), version: z.literal(1) })
        .parse(await startResponse.json())

      const detailResponse = await fetch(`${baseUrl}/api/workflow-runs/${started.runId}`)
      expect(detailResponse.status).toBe(200)
      await expect(detailResponse.json()).resolves.toMatchObject({
        schemaVersion: "2",
        run: { runId: started.runId, status: "runnable", triggerIdentity: "manual:lifecycle-proof" },
        graph: {
          steps: expect.arrayContaining([expect.objectContaining({ id: "success", label: "Published result" })])
        }
      })
    } finally {
      if (server !== undefined) await new Promise<void>((resolve) => server?.close(() => resolve()))
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
