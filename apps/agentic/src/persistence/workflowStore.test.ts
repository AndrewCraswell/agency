import { describe, expect, it, vi } from "vitest"
import { WorkflowDefinitionV2Schema } from "../workflows/definitionV2"
import { PostgresWorkflowStore, type WorkflowDefinitionRecord, type WorkflowVersionRecord } from "./workflowStore"

const workflowId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f"
const runId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e30"
const now = new Date("2026-07-19T12:00:00.000Z")
const content = WorkflowDefinitionV2Schema.parse({
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

function workflow(overrides: Partial<WorkflowDefinitionRecord> = {}): WorkflowDefinitionRecord {
  return {
    workflowId,
    name: "Delivery",
    description: "Ships a task",
    status: "draft",
    draftRevision: 1,
    draft: content,
    publishedVersion: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

function version(overrides: Partial<WorkflowVersionRecord> = {}): WorkflowVersionRecord {
  return {
    workflowId,
    version: 1,
    content,
    contentDigest: "a".repeat(64),
    publishedAt: now,
    ...overrides
  }
}

function databaseHarness(input: { select?: unknown[][]; returning?: unknown[][] } = {}) {
  const selectResults = [...(input.select ?? [])]
  const returningResults = [...(input.returning ?? [])]
  const insertedValues: unknown[] = []
  const updatedValues: unknown[] = []
  const nextSelect = async () => selectResults.shift() ?? []

  const selectChain: Record<string, unknown> = {}
  selectChain.where = vi.fn(() => selectChain)
  selectChain.orderBy = vi.fn(() => selectChain)
  selectChain.limit = vi.fn(() => selectChain)
  selectChain.for = vi.fn(nextSelect)
  // oxlint-disable-next-line unicorn/no-thenable -- Drizzle query builders are intentionally awaitable.
  Object.defineProperty(selectChain, "then", {
    value: (resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
      nextSelect().then(resolve, reject)
  })

  function mutationChain() {
    const chain: Record<string, unknown> = {}
    chain.onConflictDoNothing = vi.fn(() => chain)
    chain.returning = vi.fn(async () => returningResults.shift() ?? [])
    chain.where = vi.fn(() => chain)
    // oxlint-disable-next-line unicorn/no-thenable -- Drizzle mutation builders are intentionally awaitable.
    Object.defineProperty(chain, "then", {
      value: (resolve: (value: unknown[]) => unknown) => Promise.resolve([]).then(resolve)
    })
    return chain
  }

  const database = {
    select: vi.fn(() => ({ from: vi.fn(() => selectChain) })),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        insertedValues.push(values)
        return mutationChain()
      })
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => {
        updatedValues.push(values)
        return mutationChain()
      })
    }))
  }
  const transaction = vi.fn(async (operation: (transaction: typeof database) => Promise<unknown>) =>
    operation(database)
  )
  return { database: { ...database, transaction }, insertedValues, updatedValues, transaction }
}

function store(harness: ReturnType<typeof databaseHarness>) {
  return new PostgresWorkflowStore(harness.database as never)
}

describe("PostgresWorkflowStore", () => {
  it("lists and loads workflow drafts and immutable versions", async () => {
    const harness = databaseHarness({ select: [[workflow()], [workflow()], [version()]] })
    const workflowStore = store(harness)

    await expect(workflowStore.list()).resolves.toEqual([workflow()])
    await expect(workflowStore.get(workflowId)).resolves.toEqual(workflow())
    await expect(workflowStore.listVersions(workflowId)).resolves.toEqual([
      expect.objectContaining({
        workflowId,
        version: 1,
        contentDigest: "a".repeat(64),
        publishedAt: now
      })
    ])

    await expect(store(databaseHarness({ select: [[]] })).get(workflowId)).resolves.toBeNull()
  })

  it("creates and optimistically updates a draft", async () => {
    const createHarness = databaseHarness({ returning: [[workflow()]] })
    await expect(
      store(createHarness).create({ name: "Delivery", description: "Ships a task", draft: content })
    ).resolves.toEqual(workflow())
    expect(createHarness.insertedValues[0]).toEqual(expect.objectContaining({ name: "Delivery", draft: content }))

    const updated = workflow({ draftRevision: 2, name: "Updated" })
    const updateHarness = databaseHarness({ returning: [[updated]] })
    await expect(
      store(updateHarness).updateDraft({
        workflowId,
        expectedRevision: 1,
        name: "Updated",
        description: "Ships a task",
        draft: content
      })
    ).resolves.toEqual(updated)
    expect(updateHarness.updatedValues[0]).toEqual(expect.objectContaining({ draftRevision: 2, name: "Updated" }))

    await expect(
      store(databaseHarness({ returning: [[]] })).updateDraft({
        workflowId,
        expectedRevision: 1,
        name: "Conflict",
        description: "",
        draft: content
      })
    ).rejects.toThrow("Workflow draft revision conflict")
  })

  it("publishes the next immutable version under a transaction lock", async () => {
    const publishedVersion = version({ version: 2 })
    const harness = databaseHarness({
      select: [[workflow({ status: "published", publishedVersion: 1 })]],
      returning: [[publishedVersion]]
    })

    await expect(store(harness).publish(workflowId)).resolves.toEqual(publishedVersion)

    expect(harness.transaction).toHaveBeenCalledOnce()
    expect(harness.insertedValues[0]).toEqual(
      expect.objectContaining({
        workflowId,
        version: 2,
        content,
        contentDigest: expect.stringMatching(/^[0-9a-f]{64}$/u)
      })
    )
    expect(harness.insertedValues[1]).toEqual(
      expect.objectContaining({
        workflowId,
        workflowVersion: 2,
        packageDigest: expect.stringMatching(/^[0-9a-f]{64}$/u)
      })
    )
    expect(harness.updatedValues[0]).toEqual(expect.objectContaining({ status: "published", publishedVersion: 2 }))
  })

  it("loads the current published version and handles unpublished or missing rows", async () => {
    await expect(
      store(databaseHarness({ select: [[workflow({ publishedVersion: 1 })], [version()]] })).getPublishedVersion(
        workflowId
      )
    ).resolves.toEqual(version())
    await expect(store(databaseHarness({ select: [[workflow()]] })).getPublishedVersion(workflowId)).resolves.toBeNull()
    await expect(store(databaseHarness({ select: [[]] })).getPublishedVersion(workflowId)).resolves.toBeNull()
    await expect(
      store(databaseHarness({ select: [[workflow({ publishedVersion: 1 })], []] })).getPublishedVersion(workflowId)
    ).resolves.toBeNull()
  })

  it("atomically creates run provenance and suppresses duplicate trigger buckets", async () => {
    const input = {
      runId,
      workflowId,
      version: 1,
      contentDigest: "a".repeat(64),
      repositoryOwner: "agency",
      repositoryName: "example",
      triggerType: "schedule" as const,
      triggerKey: "schedule-1:bucket-1",
      sourceWorkItemId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e32",
      sourceWorkItemIdentifier: "FEN-423"
    }
    const createdHarness = databaseHarness({ returning: [[{ runId }]] })

    await expect(store(createdHarness).startRun(input)).resolves.toBe(true)
    expect(createdHarness.transaction).toHaveBeenCalledOnce()
    expect(createdHarness.insertedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ runId, assignedAgentId: "engineer", status: "queued" }),
        expect.objectContaining({ runId, workflowId, version: 1, triggerType: "schedule" })
      ])
    )

    await expect(store(databaseHarness({ returning: [[]] })).startRun(input)).resolves.toBe(false)
  })
})
