import { inspect } from "node:util"
import { describe, expect, it, vi } from "vitest"
import {
  EXECUTION_CONTRACT_VERSION,
  executionPackageDigest,
  jsonValueDigest,
  type ExecutionPackageContent
} from "../workflows/executionContracts"
import {
  PostgresWorkflowJournalStore,
  StaleWorkflowLeaseError,
  type WorkflowRunEventRecord
} from "./workflowJournalStore"

const runId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e30"
const activationId = "a".repeat(64)
const effectId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e31"
const waitId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e34"
const childRunId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e36"
const childActivationId = "b".repeat(64)
const now = new Date("2026-07-19T12:00:00.000Z")

function executionPackage(): ExecutionPackageContent {
  return {
    schemaVersion: EXECUTION_CONTRACT_VERSION,
    workflowId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f",
    workflowVersion: 1,
    compilerVersion: "1.0.0",
    mappingExpressionVersion: "1",
    eventDecoderVersions: { "run.prepared": "1" },
    graph: { nodes: [], edges: [] },
    stepDefinitions: [],
    constants: {},
    resourceReferences: [],
    agentSnapshots: [],
    modelSnapshots: []
  }
}

function executionPackageRecord(content = executionPackage(), overrides: Record<string, unknown> = {}) {
  return {
    packageDigest: executionPackageDigest(content),
    workflowId: content.workflowId,
    workflowVersion: content.workflowVersion,
    contractVersion: content.schemaVersion,
    compilerVersion: content.compilerVersion,
    compiledPlanDigest: jsonValueDigest(content.graph),
    content,
    createdAt: now,
    ...overrides
  }
}

function activation(overrides: Record<string, unknown> = {}) {
  return {
    activationId,
    runId,
    stepId: "create-pull-request",
    scope: [],
    status: "ready",
    inputBindings: { title: "Ship it" },
    selectedAttemptOrdinal: null,
    nextAttemptOrdinal: 2,
    dependencyCount: 0,
    availableAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

function attempt(overrides: Record<string, unknown> = {}) {
  return {
    runId,
    activationId,
    ordinal: 2,
    status: "running",
    fencingToken: 2,
    leaseOwner: "worker-1",
    leaseExpiresAt: new Date("2026-07-19T12:01:00.000Z"),
    input: { title: "Ship it" },
    output: null,
    error: null,
    usage: null,
    evidence: {},
    createdAt: now,
    startedAt: now,
    finishedAt: null,
    ...overrides
  }
}

function effect(overrides: Record<string, unknown> = {}) {
  return {
    effectId,
    runId,
    activationId,
    effectSlot: "pull-request",
    attemptOrdinal: 2,
    provider: "github",
    requestDigest: "b".repeat(64),
    idempotencyKey: "agency-pr-1",
    status: "unknown",
    request: { title: "Ship it" },
    result: null,
    reconciliation: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

function wait(overrides: Record<string, unknown> = {}) {
  return {
    waitId,
    runId,
    activationId,
    attemptOrdinal: 2,
    correlationKey: "github:octo/agency:pull-request:42",
    acceptedInputSchema: { type: "object" },
    authorization: null,
    status: "pending",
    consuming: 1,
    expiresAt: new Date("2026-07-19T13:00:00.000Z"),
    winningEventSequence: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

function runLink(overrides: Record<string, unknown> = {}) {
  return {
    parentRunId: runId,
    parentActivationId: activationId,
    childRunId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e35",
    childPackageDigest: "e".repeat(64),
    interfaceDigest: "f".repeat(64),
    terminalStatus: null,
    result: null,
    error: null,
    completedAt: null,
    createdAt: now,
    ...overrides
  }
}

function run(overrides: Record<string, unknown> = {}) {
  return {
    runId,
    packageDigest: "c".repeat(64),
    requestDigest: "d".repeat(64),
    triggerIdentity: "manual:1",
    sealedManifest: {},
    status: "running",
    cancellationGeneration: 0,
    latestSequence: 1,
    schedulerCursor: null,
    pendingCheckpointCursor: null,
    createdAt: now,
    updatedAt: now,
    terminalAt: null,
    ...overrides
  }
}

function event(sequence: number, eventType: string): WorkflowRunEventRecord {
  return {
    runId,
    sequence,
    transactionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e32",
    eventType,
    eventVersion: 1,
    reducerVersion: "1",
    causationSequence: sequence === 1 ? null : sequence - 1,
    correlationId: null,
    activationId: sequence === 1 ? null : activationId,
    attemptOrdinal: sequence === 1 ? null : 2,
    payload: {},
    recordedAt: now
  }
}

function databaseHarness(input: { selects?: unknown[][]; returns?: unknown[][] } = {}) {
  const selectResults = [...(input.selects ?? [])]
  const returningResults = [...(input.returns ?? [])]
  const insertedValues: unknown[] = []
  const updatedValues: unknown[] = []
  const conflictUpdates: unknown[] = []
  const nextSelect = async () => selectResults.shift() ?? []

  function selectChain() {
    const chain: Record<string, unknown> = {}
    chain.where = vi.fn(() => chain)
    chain.orderBy = vi.fn(() => chain)
    chain.limit = vi.fn(() => chain)
    chain.for = vi.fn(nextSelect)
    // oxlint-disable-next-line unicorn/no-thenable -- Drizzle query builders are intentionally awaitable.
    Object.defineProperty(chain, "then", {
      value: (resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
        nextSelect().then(resolve, reject)
    })
    return chain
  }

  function mutationChain() {
    const chain: Record<string, unknown> = {}
    chain.onConflictDoNothing = vi.fn(() => chain)
    chain.onConflictDoUpdate = vi.fn((value: unknown) => {
      conflictUpdates.push(value)
      return chain
    })
    chain.where = vi.fn(() => chain)
    chain.returning = vi.fn(async () => returningResults.shift() ?? [])
    // oxlint-disable-next-line unicorn/no-thenable -- Drizzle mutation builders are intentionally awaitable.
    Object.defineProperty(chain, "then", {
      value: (resolve: (value: unknown[]) => unknown) => Promise.resolve([]).then(resolve)
    })
    return chain
  }

  const database = {
    select: vi.fn(() => ({ from: vi.fn(() => selectChain()) })),
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
  return { database: { ...database, transaction }, insertedValues, updatedValues, conflictUpdates, transaction }
}

function store(harness: ReturnType<typeof databaseHarness>) {
  return new PostgresWorkflowJournalStore(harness.database as never, {
    now: () => now,
    newId: () => "019c230c-60c6-7bd8-a9f8-9e5f51b09e33"
  })
}

describe("PostgresWorkflowJournalStore", () => {
  it("publishes a stable execution package and rejects version drift", async () => {
    const content = executionPackage()
    const record = executionPackageRecord(content)
    const harness = databaseHarness({ selects: [[record]] })

    await expect(store(harness).publishExecutionPackage(content)).resolves.toEqual(record)
    expect(harness.insertedValues[0]).toEqual(
      expect.objectContaining({ packageDigest: record.packageDigest, compiledPlanDigest: record.compiledPlanDigest })
    )

    const drifted = executionPackageRecord(content, { packageDigest: "f".repeat(64) })
    await expect(store(databaseHarness({ selects: [[drifted]] })).publishExecutionPackage(content)).rejects.toThrow(
      "already has a different execution package"
    )
  })

  it("prepares initial activations once and returns an idempotent run", async () => {
    const preparedRun = run({ status: "runnable", latestSequence: 1 })
    const createdHarness = databaseHarness({ returns: [[preparedRun]] })

    await expect(
      store(createdHarness).prepareRun({
        packageDigest: preparedRun.packageDigest,
        requestDigest: preparedRun.requestDigest,
        triggerIdentity: preparedRun.triggerIdentity,
        sealedManifest: { source: "manual" },
        initialActivations: [
          { stepId: "manual-trigger" },
          { stepId: "blocked-step", dependencyCount: 1, inputBindings: { value: 1 } }
        ]
      })
    ).resolves.toEqual({ run: preparedRun, created: true })
    expect(createdHarness.insertedValues).toHaveLength(3)
    expect(createdHarness.insertedValues[1]).toEqual([
      expect.objectContaining({ stepId: "manual-trigger", status: "ready", dependencyCount: 0 }),
      expect.objectContaining({ stepId: "blocked-step", status: "blocked", dependencyCount: 1 })
    ])
    expect(createdHarness.insertedValues[2]).toEqual(
      expect.objectContaining({ eventType: "run.prepared", payload: { activationCount: 2 } })
    )

    const existingHarness = databaseHarness({ selects: [[preparedRun]], returns: [[]] })
    await expect(
      store(existingHarness).prepareRun({
        packageDigest: preparedRun.packageDigest,
        requestDigest: preparedRun.requestDigest,
        triggerIdentity: preparedRun.triggerIdentity,
        sealedManifest: {},
        initialActivations: []
      })
    ).resolves.toEqual({ run: preparedRun, created: false })
    expect(existingHarness.insertedValues).toHaveLength(1)

    await expect(
      store(databaseHarness({ selects: [[preparedRun]], returns: [[]] })).prepareRun({
        packageDigest: preparedRun.packageDigest,
        requestDigest: "e".repeat(64),
        triggerIdentity: preparedRun.triggerIdentity,
        sealedManifest: {},
        initialActivations: []
      })
    ).rejects.toThrow("reused with a different request digest")
  })

  it("projects immutable graph and persisted run evidence for diagnostics", async () => {
    const content = executionPackage()
    content.graph = {
      schemaVersion: "2",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      steps: [],
      connections: [],
      topologicalOrder: [],
      fixtures: []
    }
    const packageRecord = executionPackageRecord(content, { packageDigest: "c".repeat(64) })
    const harness = databaseHarness({
      selects: [
        [run()],
        [packageRecord],
        [activation()],
        [attempt()],
        [effect()],
        [wait()],
        [],
        [event(1, "run.prepared")],
        []
      ]
    })

    await expect(store(harness).getRunDetail(runId)).resolves.toMatchObject({
      run: { runId },
      executionPackage: { packageDigest: "c".repeat(64) },
      graph: { schemaVersion: "2", steps: [] },
      activations: [expect.objectContaining({ activationId })],
      attempts: [expect.objectContaining({ ordinal: 2 })],
      effects: [expect.objectContaining({ effectId })],
      waits: [expect.objectContaining({ waitId })],
      data: [],
      events: [expect.objectContaining({ sequence: 1 })],
      childLinks: []
    })
  })

  it("cancels nonterminal run state and increments its cancellation generation", async () => {
    const cancelled = run({ status: "cancelled", cancellationGeneration: 1, latestSequence: 2, terminalAt: now })
    const harness = databaseHarness({ selects: [[run()]], returns: [[cancelled]] })

    await expect(store(harness).cancelRun({ runId, reason: "Operator stopped the run" })).resolves.toEqual(cancelled)

    expect(harness.updatedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "cancelled", leaseOwner: null, leaseExpiresAt: null }),
        expect.objectContaining({ status: "cancelled", updatedAt: now }),
        expect.objectContaining({ status: "cancelled", cancellationGeneration: 1, latestSequence: 2, terminalAt: now })
      ])
    )
    expect(harness.insertedValues).toContainEqual(
      expect.objectContaining({
        eventType: "run.cancelled",
        sequence: 2,
        payload: { reason: "Operator stopped the run", priorStatus: "running", cancellationGeneration: 1 }
      })
    )
  })

  it("retries only a failed unselected activation and preserves prior evidence", async () => {
    const failedActivation = activation({ status: "failed", selectedAttemptOrdinal: null, nextAttemptOrdinal: 3 })
    const readyActivation = activation({
      status: "ready",
      selectedAttemptOrdinal: null,
      nextAttemptOrdinal: 3,
      availableAt: now
    })
    const harness = databaseHarness({
      selects: [[run({ status: "failed" })], [failedActivation], []],
      returns: [[readyActivation]]
    })

    await expect(store(harness).retryActivation({ runId, activationId })).resolves.toEqual(readyActivation)

    expect(harness.insertedValues).toContainEqual(
      expect.objectContaining({
        eventType: "activation.retry_requested",
        payload: { priorStatus: "failed", nextAttemptOrdinal: 3 }
      })
    )
    expect(harness.updatedValues).toContainEqual(expect.objectContaining({ status: "running", terminalAt: null }))
  })

  it("blocks retry while an external effect outcome is unresolved", async () => {
    const failedActivation = activation({ status: "failed", selectedAttemptOrdinal: null })
    const harness = databaseHarness({ selects: [[run({ status: "failed" })], [failedActivation], [{ effectId }]] })

    await expect(store(harness).retryActivation({ runId, activationId })).rejects.toThrow("unresolved external effect")
    expect(harness.updatedValues).toEqual([])
    expect(harness.insertedValues).toEqual([])
  })

  it("retries from here when every reachable descendant is blocked and unselected", async () => {
    const descendantId = "b".repeat(64)
    const graph = {
      schemaVersion: "2" as const,
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      steps: [
        {
          id: "create-pull-request",
          label: "Create pull request",
          position: { x: 0, y: 0 },
          definition: { kind: "provider_action", version: 1 },
          config: {},
          failurePolicy: { mode: "stop", maximumAttempts: 2 }
        },
        {
          id: "success",
          label: "Success",
          position: { x: 320, y: 0 },
          definition: { kind: "success", version: 1 },
          config: {},
          failurePolicy: { mode: "stop", maximumAttempts: 1 }
        }
      ],
      connections: [
        {
          id: "to-success",
          source: { stepId: "create-pull-request", port: "result" },
          target: { stepId: "success", port: "result" },
          outcome: "success" as const,
          mappings: [{ sourcePath: [], targetPath: [] }]
        }
      ],
      fixtures: [],
      topologicalOrder: ["create-pull-request", "success"]
    }
    const packageRecord = executionPackageRecord({ ...executionPackage(), graph }, { packageDigest: "c".repeat(64) })
    const failedActivation = activation({ status: "failed", selectedAttemptOrdinal: null })
    const blockedDescendant = activation({
      activationId: descendantId,
      stepId: "success",
      status: "blocked",
      dependencyCount: 1
    })
    const readyActivation = activation({ status: "ready", selectedAttemptOrdinal: null })
    const harness = databaseHarness({
      selects: [[run({ status: "failed" })], [packageRecord], [failedActivation], [blockedDescendant], []],
      returns: [[readyActivation]]
    })

    await expect(store(harness).retryFromHere({ runId, activationId })).resolves.toEqual({
      activation: readyActivation,
      affectedDescendantIds: [descendantId]
    })
    expect(harness.insertedValues).toContainEqual(
      expect.objectContaining({
        eventType: "activation.retry_from_here_requested",
        payload: { affectedDescendantIds: [descendantId] }
      })
    )
  })

  it("requires Run again when a reachable descendant selected successful output", async () => {
    const descendantId = "b".repeat(64)
    const graph = {
      schemaVersion: "2" as const,
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      steps: [
        {
          id: "create-pull-request",
          label: "Create pull request",
          position: { x: 0, y: 0 },
          definition: { kind: "provider_action", version: 1 },
          config: {},
          failurePolicy: { mode: "stop", maximumAttempts: 2 }
        },
        {
          id: "success",
          label: "Success",
          position: { x: 320, y: 0 },
          definition: { kind: "success", version: 1 },
          config: {},
          failurePolicy: { mode: "stop", maximumAttempts: 1 }
        }
      ],
      connections: [
        {
          id: "to-success",
          source: { stepId: "create-pull-request", port: "result" },
          target: { stepId: "success", port: "result" },
          outcome: "success" as const,
          mappings: [{ sourcePath: [], targetPath: [] }]
        }
      ],
      fixtures: [],
      topologicalOrder: ["create-pull-request", "success"]
    }
    const packageRecord = executionPackageRecord({ ...executionPackage(), graph }, { packageDigest: "c".repeat(64) })
    const failedActivation = activation({ status: "failed", selectedAttemptOrdinal: null })
    const succeededDescendant = activation({
      activationId: descendantId,
      stepId: "success",
      status: "succeeded",
      selectedAttemptOrdinal: 1
    })
    const harness = databaseHarness({
      selects: [[run({ status: "failed" })], [packageRecord], [failedActivation], [succeededDescendant]]
    })

    await expect(store(harness).retryFromHere({ runId, activationId })).rejects.toThrow("run again instead")
    expect(harness.updatedValues).toEqual([])
    expect(harness.insertedValues).toEqual([])
  })

  it("records a reasoned operator confirmation for an unknown effect", async () => {
    const unknownEffect = effect({ status: "unknown", reconciliation: { code: "provider_outcome_unknown" } })
    const confirmedEffect = effect({
      status: "confirmed",
      result: { pullRequestNumber: 42 },
      reconciliation: {
        code: "provider_outcome_unknown",
        latest: {
          source: "operator",
          outcome: "occurred",
          reason: "Verified in GitHub",
          recordedAt: now.toISOString()
        },
        history: [
          { source: "operator", outcome: "occurred", reason: "Verified in GitHub", recordedAt: now.toISOString() }
        ]
      }
    })
    const harness = databaseHarness({ selects: [[run()], [unknownEffect]], returns: [[confirmedEffect]] })

    await expect(
      store(harness).resolveEffect({
        runId,
        effectId,
        outcome: "occurred",
        reason: "Verified in GitHub",
        result: { pullRequestNumber: 42 }
      })
    ).resolves.toEqual(confirmedEffect)
    expect(harness.insertedValues).toContainEqual(
      expect.objectContaining({
        eventType: "effect.operator_resolved",
        payload: { effectId, outcome: "occurred", reason: "Verified in GitHub" }
      })
    )
    expect(harness.updatedValues).toContainEqual(
      expect.objectContaining({ status: "confirmed", result: { pullRequestNumber: 42 } })
    )
  })

  it("does not reinterpret an effect that no longer needs confirmation", async () => {
    const harness = databaseHarness({ selects: [[run()], [effect({ status: "confirmed", result: { id: 42 } })]] })

    await expect(
      store(harness).resolveEffect({ runId, effectId, outcome: "absent", reason: "Could not find it" })
    ).rejects.toThrow("does not need confirmation")
    expect(harness.updatedValues).toEqual([])
    expect(harness.insertedValues).toEqual([])
  })

  it("leases a ready activation with an immutable ordinal and fencing token", async () => {
    const harness = databaseHarness({ selects: [[activation()]], returns: [[attempt()]] })

    await expect(
      store(harness).leaseActivation({ runId, activationId, leaseOwner: "worker-1", leaseDurationMs: 60_000 })
    ).resolves.toEqual(attempt())

    expect(harness.transaction).toHaveBeenCalledOnce()
    expect(harness.insertedValues[0]).toEqual(
      expect.objectContaining({ runId, activationId, ordinal: 2, fencingToken: 2, status: "running" })
    )
    expect(harness.updatedValues[0]).toEqual(expect.objectContaining({ status: "running", nextAttemptOrdinal: 3 }))
  })

  it("rejects a stale worker before publishing output or events", async () => {
    const harness = databaseHarness({ selects: [[run()]], returns: [[]] })

    await expect(
      store(harness).completeAttempt({
        runId,
        activationId,
        ordinal: 2,
        leaseOwner: "stale-worker",
        fencingToken: 1,
        output: { pullRequestNumber: 42 },
        data: [{ name: "pull-request", kind: "external_reference", payload: { number: 42 } }],
        checkpoint: { cursor: "checkpoint-2", committed: true }
      })
    ).rejects.toBeInstanceOf(StaleWorkflowLeaseError)

    expect(harness.insertedValues).toEqual([])
    expect(harness.updatedValues).toHaveLength(1)
  })

  it("atomically publishes output, downstream activation, checkpoint, and event", async () => {
    const harness = databaseHarness({
      selects: [[run()]],
      returns: [[{ ordinal: 2 }], [{ activationId }]]
    })

    await expect(
      store(harness).completeAttempt({
        runId,
        activationId,
        ordinal: 2,
        leaseOwner: "worker-1",
        fencingToken: 2,
        output: { pullRequestNumber: 42 },
        data: [{ name: "pull-request", kind: "external_reference", payload: { number: 42 } }],
        downstream: [
          {
            stepId: "notify",
            inputBindings: { "create-notify": { number: 42 } },
            dependencyCount: 0,
            deferred: true
          }
        ],
        releases: [{ stepId: "notify", scope: [] }],
        checkpoint: { cursor: "checkpoint-2", committed: true }
      })
    ).resolves.toBeUndefined()

    expect(harness.updatedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "succeeded", output: { pullRequestNumber: 42 } }),
        expect.objectContaining({ status: "succeeded", selectedAttemptOrdinal: 2 }),
        expect.objectContaining({ latestSequence: 2, schedulerCursor: "checkpoint-2" })
      ])
    )
    expect(harness.insertedValues).toEqual(
      expect.arrayContaining([
        [expect.objectContaining({ name: "pull-request", digest: jsonValueDigest({ number: 42 }) })],
        [expect.objectContaining({ stepId: "notify", status: "blocked", dependencyCount: 0 })],
        expect.objectContaining({ eventType: "attempt.succeeded", sequence: 2 })
      ])
    )
    expect(harness.conflictUpdates).toHaveLength(1)
    expect(inspect((harness.conflictUpdates[0] as { set: { status: unknown } }).set.status, { depth: 5 })).toContain(
      "blocked"
    )
    expect(
      inspect((harness.conflictUpdates[0] as { set: { inputBindings: unknown } }).set.inputBindings, { depth: 5 })
    ).toContain("blocked")
    expect(harness.updatedValues).toContainEqual(
      expect.objectContaining({
        status: "ready",
        availableAt: now
      })
    )
  })

  it("rejects downstream work that exceeds a keyed loop activation budget", async () => {
    const loopScope = [{ kind: "loop" as const, key: "review-loop", iteration: 0 }]
    const harness = databaseHarness({
      selects: [[run()], [{ activationId, scope: loopScope }]],
      returns: [[{ ordinal: 2 }], [{ activationId }]]
    })

    await expect(
      store(harness).completeAttempt({
        runId,
        activationId,
        ordinal: 2,
        leaseOwner: "worker-1",
        fencingToken: 2,
        output: { result: "continue" },
        downstream: [
          {
            stepId: "repair",
            scope: [{ kind: "loop", key: "review-loop", iteration: 1 }],
            inputBindings: { state: { result: "continue" } }
          }
        ],
        loopBudgets: [{ key: "review-loop", maximumActivations: 1 }],
        checkpoint: { cursor: "checkpoint-2", committed: true }
      })
    ).rejects.toThrow("Loop review-loop exceeded its maximum of 1 activations")

    expect(harness.insertedValues).toEqual([])
  })

  it("atomically suspends a leased attempt on a durable wait", async () => {
    const harness = databaseHarness({
      selects: [[run()]],
      returns: [[{ ordinal: 2 }], [{ activationId }], [wait()]]
    })

    await expect(
      store(harness).suspendAttempt({
        runId,
        activationId,
        ordinal: 2,
        leaseOwner: "worker-1",
        fencingToken: 2,
        correlationKey: "github:octo/agency:pull-request:42",
        acceptedInputSchema: { type: "object" },
        expiresAt: new Date("2026-07-19T13:00:00.000Z")
      })
    ).resolves.toMatchObject({ waitId, status: "pending" })

    expect(harness.updatedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "waiting", leaseOwner: null, leaseExpiresAt: null }),
        expect.objectContaining({ status: "waiting" }),
        expect.objectContaining({ status: "waiting", latestSequence: 2 })
      ])
    )
    expect(harness.insertedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ correlationKey: "github:octo/agency:pull-request:42", status: "pending" }),
        expect.objectContaining({ eventType: "attempt.waiting", sequence: 2 })
      ])
    )
  })

  it("resumes a pending wait exactly once and derives downstream work from its package", async () => {
    const content = executionPackage()
    content.graph = {
      schemaVersion: "2",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      steps: [
        {
          id: "wait",
          label: "Wait",
          position: { x: 0, y: 0 },
          definition: { kind: "wait", version: 1 },
          config: { correlation: "key", expiresAfterSeconds: 60, eventSchema: { type: "object" } },
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
          id: "wait-success",
          source: { stepId: "wait", port: "output" },
          target: { stepId: "success", port: "result" },
          outcome: "success",
          mappings: [{ sourcePath: [], targetPath: [] }]
        }
      ],
      topologicalOrder: ["wait", "success"],
      fixtures: []
    }
    const harness = databaseHarness({
      selects: [[run()], [activation({ stepId: "wait", status: "waiting" })], [executionPackageRecord(content)]],
      returns: [[wait({ status: "resumed", winningEventSequence: 2 })], [{ ordinal: 2 }], [{ activationId }]]
    })

    await expect(
      store(harness).resumeWait({
        runId,
        correlationKey: "github:octo/agency:pull-request:42",
        event: { eventKey: "pull_request.updated" },
        outputPort: "output"
      })
    ).resolves.toMatchObject({ status: "resumed" })

    expect(harness.insertedValues).toEqual(
      expect.arrayContaining([
        [expect.objectContaining({ stepId: "success", status: "ready" })],
        expect.objectContaining({ eventType: "wait.resumed", sequence: 2 })
      ])
    )
    expect(harness.updatedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "succeeded", output: { output: { eventKey: "pull_request.updated" } } }),
        expect.objectContaining({ status: "succeeded", selectedAttemptOrdinal: 2 })
      ])
    )
  })

  it("fails a still-pending wait immediately with the supplied error", async () => {
    const error = { code: "child_failed", message: "Child failed" }
    const harness = databaseHarness({
      selects: [[run()]],
      returns: [[wait({ status: "cancelled", winningEventSequence: 2 })], [{ ordinal: 2 }], [{ activationId }]]
    })

    await expect(
      store(harness).failWait({
        runId,
        correlationKey: "github:octo/agency:pull-request:42",
        error
      })
    ).resolves.toMatchObject({ status: "cancelled" })

    expect(harness.updatedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "failed", error }),
        expect.objectContaining({ status: "failed", terminalAt: now })
      ])
    )
    expect(harness.insertedValues).toContainEqual(
      expect.objectContaining({
        eventType: "wait.failed",
        payload: { waitId, code: "child_failed" }
      })
    )
  })

  it("times out only a still-pending wait", async () => {
    const harness = databaseHarness({
      selects: [[run()]],
      returns: [[wait({ status: "timed_out", winningEventSequence: 2 })], [{ ordinal: 2 }], [{ activationId }]]
    })

    await expect(
      store(harness).timeoutWait({
        runId,
        correlationKey: "github:octo/agency:pull-request:42"
      })
    ).resolves.toMatchObject({ status: "timed_out" })

    expect(harness.updatedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "failed", error: expect.objectContaining({ code: "wait_timed_out" }) }),
        expect.objectContaining({ status: "failed", terminalAt: now })
      ])
    )
    expect(harness.insertedValues).toContainEqual(expect.objectContaining({ eventType: "wait.timed_out" }))
  })

  it("does not resume a wait when no pending unexpired record wins", async () => {
    const harness = databaseHarness({ selects: [[run()]], returns: [[]] })

    await expect(
      store(harness).resumeWait({
        runId,
        correlationKey: "github:octo/agency:pull-request:42",
        event: { eventKey: "pull_request.updated" }
      })
    ).resolves.toBeNull()

    expect(harness.insertedValues).toEqual([])
    expect(harness.updatedValues).toEqual([expect.objectContaining({ status: "resumed" })])
  })

  it("does not time out a wait when no pending expired record exists", async () => {
    const harness = databaseHarness({ selects: [[run()]], returns: [[]] })

    await expect(
      store(harness).timeoutWait({
        runId,
        correlationKey: "github:octo/agency:pull-request:42"
      })
    ).resolves.toBeNull()

    expect(harness.insertedValues).toEqual([])
    expect(harness.updatedValues).toEqual([expect.objectContaining({ status: "timed_out" })])
  })

  it("does not fail a wait when no pending record exists", async () => {
    const harness = databaseHarness({ selects: [[run()]], returns: [[]] })

    await expect(
      store(harness).failWait({
        runId,
        correlationKey: "github:octo/agency:pull-request:42",
        error: { code: "child_failed", message: "Child failed" }
      })
    ).resolves.toBeNull()

    expect(harness.insertedValues).toEqual([])
    expect(harness.updatedValues).toEqual([expect.objectContaining({ status: "cancelled" })])
  })

  it("locks the parent run before reusing an existing child invocation", async () => {
    const existing = runLink()
    const harness = databaseHarness({ selects: [[run()], [existing]] })

    await expect(
      store(harness).invokeChildWorkflow({
        parentRunId: runId,
        parentActivationId: activationId,
        parentAttemptOrdinal: 2,
        leaseOwner: "worker-1",
        fencingToken: 2,
        childPackageDigest: existing.childPackageDigest,
        interfaceDigest: existing.interfaceDigest,
        childInput: { issue: "FEN-423" },
        childTriggerStepId: "manual",
        childTriggerPort: "input"
      })
    ).resolves.toEqual(existing)

    expect(harness.insertedValues).toEqual([])
    expect(harness.updatedValues).toEqual([])
  })

  it("lists child run links ordered by creation time", async () => {
    const firstLink = runLink({ childRunId })
    const secondLink = runLink({
      childRunId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e37",
      terminalStatus: "succeeded",
      result: { pullRequestNumber: 42 },
      completedAt: now
    })
    const harness = databaseHarness({ selects: [[firstLink, secondLink]] })

    await expect(store(harness).listChildRunLinks(2)).resolves.toEqual([firstLink, secondLink])
    expect(harness.insertedValues).toEqual([])
    expect(harness.updatedValues).toEqual([])
  })

  it("returns child completion for a succeeded child run", async () => {
    const childRun = run({ runId: childRunId, status: "succeeded", packageDigest: "c".repeat(64) })
    const graph = {
      schemaVersion: "2" as const,
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      steps: [
        {
          id: "success",
          label: "Success",
          position: { x: 0, y: 0 },
          definition: { kind: "success", version: 1 },
          config: {},
          failurePolicy: { mode: "stop", maximumAttempts: 1 }
        }
      ],
      connections: [],
      topologicalOrder: ["success"],
      fixtures: []
    }
    const childPackage = executionPackageRecord({ ...executionPackage(), graph }, { packageDigest: "c".repeat(64) })
    const childActivation = activation({
      runId: childRunId,
      activationId: childActivationId,
      stepId: "success",
      status: "succeeded",
      selectedAttemptOrdinal: 4
    })
    const childAttempt = attempt({
      runId: childRunId,
      activationId: childActivationId,
      ordinal: 4,
      status: "succeeded",
      output: { done: true },
      error: null,
      finishedAt: now
    })
    const harness = databaseHarness({ selects: [[childRun], [childPackage], [childActivation], [childAttempt]] })

    await expect(store(harness).getChildRunCompletion(childRunId)).resolves.toEqual({
      status: "succeeded",
      output: { done: true },
      error: null
    })
  })

  it("returns child completion for a failed child run", async () => {
    const childRun = run({ runId: childRunId, status: "failed", packageDigest: "c".repeat(64) })
    const graph = {
      schemaVersion: "2" as const,
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      steps: [
        {
          id: "failure",
          label: "Failure",
          position: { x: 0, y: 0 },
          definition: { kind: "failure", version: 1 },
          config: {},
          failurePolicy: { mode: "stop", maximumAttempts: 1 }
        }
      ],
      connections: [],
      topologicalOrder: ["failure"],
      fixtures: []
    }
    const childPackage = executionPackageRecord({ ...executionPackage(), graph }, { packageDigest: "c".repeat(64) })
    const childActivation = activation({
      runId: childRunId,
      activationId: childActivationId,
      stepId: "failure",
      status: "failed",
      selectedAttemptOrdinal: null
    })
    const childAttempt = attempt({
      runId: childRunId,
      activationId: childActivationId,
      status: "failed",
      output: null,
      error: { code: "child_failed", message: "Step failed" },
      finishedAt: now
    })
    const harness = databaseHarness({ selects: [[childRun], [childPackage], [childActivation], [childAttempt]] })

    await expect(store(harness).getChildRunCompletion(childRunId)).resolves.toEqual({
      status: "failed",
      output: {},
      error: { code: "child_failed", message: "Step failed" }
    })
  })

  it("returns null child completion for nonterminal child runs", async () => {
    const harness = databaseHarness({ selects: [[run({ runId: childRunId, status: "running" })]] })

    await expect(store(harness).getChildRunCompletion(childRunId)).resolves.toBeNull()
    expect(harness.insertedValues).toEqual([])
    expect(harness.updatedValues).toEqual([])
  })

  it("records child run completion once and allows idempotent replay", async () => {
    const completed = runLink({
      childRunId,
      terminalStatus: "succeeded",
      result: { done: true },
      error: null,
      completedAt: now
    })
    const firstHarness = databaseHarness({ returns: [[completed]] })

    await expect(
      store(firstHarness).recordChildRunCompletion({
        childRunId,
        status: "succeeded",
        output: { done: true },
        error: null
      })
    ).resolves.toEqual(completed)

    const secondHarness = databaseHarness({ selects: [[completed]], returns: [[]] })
    await expect(
      store(secondHarness).recordChildRunCompletion({
        childRunId,
        status: "succeeded",
        output: { done: true },
        error: null
      })
    ).resolves.toEqual(completed)
  })

  it("rejects conflicting child run completion after a terminal link is set", async () => {
    const existing = runLink({
      childRunId,
      terminalStatus: "succeeded",
      result: { done: true },
      error: null,
      completedAt: now
    })
    const harness = databaseHarness({ selects: [[existing]], returns: [[]] })

    await expect(
      store(harness).recordChildRunCompletion({
        childRunId,
        status: "failed",
        output: { done: true },
        error: { code: "child_failed", message: "conflict" }
      })
    ).rejects.toThrow("conflicts with its immutable link")
  })

  it("publishes a failed attempt with event payload code and terminal status", async () => {
    const harness = databaseHarness({ selects: [[run()]], returns: [[{ ordinal: 2 }], [{ activationId }]] })

    await expect(
      store(harness).failAttempt({
        runId,
        activationId,
        ordinal: 2,
        leaseOwner: "worker-1",
        fencingToken: 2,
        error: { code: "provider_failed", message: "GitHub API error" },
        terminalStatus: "failed"
      })
    ).resolves.toBeUndefined()

    expect(harness.updatedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "failed", error: { code: "provider_failed", message: "GitHub API error" } }),
        expect.objectContaining({ status: "failed", updatedAt: now }),
        expect.objectContaining({ status: "failed", latestSequence: 2, terminalAt: now })
      ])
    )
    expect(harness.insertedValues).toContainEqual(
      expect.objectContaining({
        eventType: "attempt.failed",
        sequence: 2,
        payload: { code: "provider_failed" }
      })
    )
  })

  it("rejects stale failAttempt workers before publishing failure events", async () => {
    const harness = databaseHarness({ selects: [[run()]], returns: [[]] })

    await expect(
      store(harness).failAttempt({
        runId,
        activationId,
        ordinal: 2,
        leaseOwner: "stale-worker",
        fencingToken: 1,
        error: { code: "provider_failed", message: "Lease lost" }
      })
    ).rejects.toBeInstanceOf(StaleWorkflowLeaseError)

    expect(harness.insertedValues).toEqual([])
    expect(harness.updatedValues).toHaveLength(1)
  })

  it("blocks redispatch when a logical effect has an unknown outcome", async () => {
    const request = { title: "Ship it" }
    const requestDigest = jsonValueDigest(request)
    const harness = databaseHarness({
      selects: [[effect({ request, requestDigest })]],
      returns: [[]]
    })

    await expect(
      store(harness).reserveEffect({
        runId,
        activationId,
        effectSlot: "pull-request",
        attemptOrdinal: 3,
        provider: "github",
        request,
        idempotencyKey: "agency-pr-1"
      })
    ).resolves.toMatchObject({ dispatchable: false, reason: "unknown", effect: { status: "unknown" } })
  })

  it("returns a newly reserved logical effect as dispatchable", async () => {
    const request = { title: "Ship it" }
    const prepared = effect({ status: "prepared", request, requestDigest: jsonValueDigest(request) })
    const harness = databaseHarness({ returns: [[prepared]] })

    await expect(
      store(harness).reserveEffect({
        runId,
        activationId,
        effectSlot: "pull-request",
        provider: "github",
        request
      })
    ).resolves.toMatchObject({ dispatchable: true, reason: "prepared", effect: { status: "prepared" } })
    expect(harness.updatedValues).toEqual([])
  })

  it("marks reuse of a logical effect with a different request as conflict", async () => {
    const harness = databaseHarness({ selects: [[effect()]], returns: [[]] })

    await expect(
      store(harness).reserveEffect({
        runId,
        activationId,
        effectSlot: "pull-request",
        provider: "github",
        request: { title: "A different title" }
      })
    ).resolves.toMatchObject({ dispatchable: false, reason: "conflict", effect: { status: "conflict" } })
    expect(harness.updatedValues[0]).toEqual(expect.objectContaining({ status: "conflict" }))
  })

  it("begins effect dispatch only from prepared status", async () => {
    const dispatching = effect({ status: "dispatching" })
    const readyHarness = databaseHarness({ returns: [[dispatching]] })

    await expect(store(readyHarness).beginEffectDispatch(effectId)).resolves.toEqual(dispatching)
    expect(readyHarness.updatedValues).toEqual([expect.objectContaining({ status: "dispatching" })])

    await expect(store(databaseHarness({ returns: [[]] })).beginEffectDispatch(effectId)).rejects.toThrow(
      "not prepared for dispatch"
    )
  })

  it("confirms a dispatching effect and rejects invalid preconditions", async () => {
    const confirmed = effect({ status: "confirmed", result: { pullRequestNumber: 42 } })
    const dispatchingHarness = databaseHarness({ returns: [[confirmed]] })

    await expect(store(dispatchingHarness).confirmEffect(effectId, { pullRequestNumber: 42 })).resolves.toEqual(
      confirmed
    )
    expect(dispatchingHarness.updatedValues).toEqual([
      expect.objectContaining({ status: "confirmed", result: { pullRequestNumber: 42 } })
    ])

    await expect(
      store(databaseHarness({ returns: [[]] })).confirmEffect(effectId, { pullRequestNumber: 42 })
    ).rejects.toThrow("is not dispatching")
  })

  it("classifies a dispatch failure and rejects non-dispatching effects", async () => {
    const unknown = effect({
      status: "unknown",
      reconciliation: { code: "provider_outcome_unknown", source: "provider" }
    })
    const harness = databaseHarness({ returns: [[unknown]] })

    await expect(
      store(harness).classifyEffectFailure(effectId, "unknown", {
        code: "provider_outcome_unknown",
        source: "provider"
      })
    ).resolves.toEqual(unknown)
    expect(harness.updatedValues).toEqual([
      expect.objectContaining({
        status: "unknown",
        reconciliation: { code: "provider_outcome_unknown", source: "provider" }
      })
    ])

    await expect(
      store(databaseHarness({ returns: [[]] })).classifyEffectFailure(effectId, "failed", {
        code: "provider_failed"
      })
    ).rejects.toThrow("is not dispatching")
  })

  it("resolves unknown effect outcomes as absent or indeterminate with immutable events", async () => {
    const absentEffect = effect({ status: "unknown", reconciliation: { code: "provider_outcome_unknown" } })
    const resolvedEffect = effect({
      status: "resolved",
      reconciliation: {
        code: "provider_outcome_unknown",
        latest: {
          source: "operator",
          outcome: "absent",
          reason: "No matching pull request exists",
          recordedAt: now.toISOString()
        },
        history: [
          {
            source: "operator",
            outcome: "absent",
            reason: "No matching pull request exists",
            recordedAt: now.toISOString()
          }
        ]
      }
    })
    const absentHarness = databaseHarness({ selects: [[run()], [absentEffect]], returns: [[resolvedEffect]] })

    await expect(
      store(absentHarness).resolveEffect({
        runId,
        effectId,
        outcome: "absent",
        reason: "No matching pull request exists"
      })
    ).resolves.toEqual(resolvedEffect)
    expect(absentHarness.insertedValues).toContainEqual(
      expect.objectContaining({
        eventType: "effect.operator_resolved",
        payload: { effectId, outcome: "absent", reason: "No matching pull request exists" }
      })
    )

    const indeterminateEffect = effect({ status: "conflict", reconciliation: { code: "digest_mismatch" } })
    const unknownAgain = effect({
      status: "unknown",
      reconciliation: {
        code: "digest_mismatch",
        latest: {
          source: "operator",
          outcome: "indeterminate",
          reason: "Provider audit unavailable",
          recordedAt: now.toISOString()
        },
        history: [
          {
            source: "operator",
            outcome: "indeterminate",
            reason: "Provider audit unavailable",
            recordedAt: now.toISOString()
          }
        ]
      }
    })
    const indeterminateHarness = databaseHarness({
      selects: [[run()], [indeterminateEffect]],
      returns: [[unknownAgain]]
    })

    await expect(
      store(indeterminateHarness).resolveEffect({
        runId,
        effectId,
        outcome: "indeterminate",
        reason: "Provider audit unavailable"
      })
    ).resolves.toEqual(unknownAgain)
    expect(indeterminateHarness.insertedValues).toContainEqual(
      expect.objectContaining({
        eventType: "effect.operator_resolved",
        payload: { effectId, outcome: "indeterminate", reason: "Provider audit unavailable" }
      })
    )
  })

  it("rebuilds a projection from ordered stored events only", async () => {
    const harness = databaseHarness({ selects: [[event(1, "run.prepared"), event(2, "attempt.succeeded")]] })
    const reduce = vi.fn((projection: string[], current: WorkflowRunEventRecord) => [...projection, current.eventType])

    await expect(store(harness).replay(runId, [], reduce)).resolves.toEqual(["run.prepared", "attempt.succeeded"])
    expect(reduce).toHaveBeenCalledTimes(2)
    expect(harness.insertedValues).toEqual([])
    expect(harness.updatedValues).toEqual([])
  })
})
