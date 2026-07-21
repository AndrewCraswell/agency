import { describe, expect, it, vi } from "vitest"
import type {
  WorkflowDefinitionRecord,
  WorkflowExecutionPackageRecord,
  WorkflowVersionRecord
} from "../persistence/workflowStore"
import { CompiledWorkflowGraphSchema, compileWorkflowDefinition } from "./compiler"
import { WorkflowDefinitionSchema, type WorkflowDefinition } from "./definition"
import type { WorkflowModelSnapshot } from "./modelCatalog"
import type { RepositoryAgentSnapshot } from "./repositoryAgents"
import { WorkflowService, type WorkflowServiceJournal, type WorkflowServiceStore } from "./service"
import { CURRENT_WORKFLOW_RELEASE_PHASE } from "./stepRegistry"

const workflowId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f"
const runId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e30"
const now = new Date("2026-07-19T12:00:00.000Z")
const linearTeam = {
  connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e32",
  provider: "linear" as const,
  resourceType: "team" as const,
  externalId: "team-1",
  name: "ENG Engineering",
  capabilities: ["team.read", "issue.read", "issue.write"]
}
const selectedModel: WorkflowModelSnapshot = {
  modelId: "openai/gpt-test",
  name: "GPT Test",
  contextLength: 128_000,
  pricing: { prompt: "0.000001", completion: "0.000002" },
  architecture: { inputModalities: ["text"], outputModalities: ["text"] },
  supportedParameters: ["response_format"],
  observedAt: "2026-07-19T12:00:00.000Z"
}
const selectedAgentReference = {
  connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
  repositoryId: "42",
  repositoryName: "agency/repository",
  ref: "main",
  path: ".github/delivery.agent.md",
  observedCommitSha: "a".repeat(40),
  blobSha: "b".repeat(40),
  contentDigest: "d".repeat(64),
  sourceUrl: "https://github.com/agency/repository/blob/main/.github/delivery.agent.md",
  name: "Delivery agent",
  description: "Implements selected delivery work",
  requestedTools: ["read", "edit"]
}
const repositoryAgentExecutionPolicy = {
  validationCommands: [{ id: "diff-check", command: "git diff --check", workingDirectory: ".", timeoutMs: 60_000 }],
  allowedPaths: ["apps/agentic/**"],
  forbiddenPaths: [".git/**"],
  budgets: { maxTurns: 20, maxTokens: 50_000, maxElapsedMs: 600_000 }
}

function content(): WorkflowDefinition {
  return WorkflowDefinitionSchema.parse({
    schemaVersion: "2",
    inputSchema: { type: "object", additionalProperties: true },
    outputSchema: { type: "object", additionalProperties: true },
    constants: {},
    resourceBindings: {},
    steps: [
      {
        id: "manual-start",
        label: "Manual start",
        position: { x: 0, y: 0 },
        definition: { kind: "manual_trigger", version: 1 },
        config: {},
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "set-fields",
        label: "Set fields",
        position: { x: 200, y: 0 },
        definition: { kind: "set_fields", version: 1 },
        config: { fields: { answer: 42 } },
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "success",
        label: "Result",
        position: { x: 400, y: 0 },
        definition: { kind: "set_fields", version: 1 },
        config: { fields: {} },
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      }
    ],
    connections: [
      {
        id: "manual-fields",
        source: { stepId: "manual-start", port: "input" },
        target: { stepId: "set-fields", port: "input" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "fields-success",
        source: { stepId: "set-fields", port: "value" },
        target: { stepId: "success", port: "input" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      }
    ]
  })
}

function workflow(draft = content()): WorkflowDefinitionRecord {
  return {
    workflowId,
    name: "Delivery",
    description: "",
    status: "draft",
    draftRevision: 1,
    draft,
    activePublishedVersion: null,
    createdAt: now,
    updatedAt: now
  }
}

class FakeWorkflowStore implements WorkflowServiceStore {
  async delete(workflowIdInput: string): Promise<void> {
    if (this.current?.workflowId !== workflowIdInput) throw new Error("Workflow not found")
    this.current = null
  }
  current: WorkflowDefinitionRecord | null = null
  versions: WorkflowVersionRecord[] = []
  executionPackage: WorkflowExecutionPackageRecord | null = null

  async list() {
    return this.current === null ? [] : [this.current]
  }

  async get(requestedWorkflowId: string) {
    return this.current?.workflowId === requestedWorkflowId ? this.current : null
  }

  async create(input: Parameters<WorkflowServiceStore["create"]>[0]) {
    this.current = {
      ...workflow(input.draft as WorkflowDefinition),
      name: input.name,
      description: input.description
    }
    return this.current
  }

  async updateDraft(input: Parameters<WorkflowServiceStore["updateDraft"]>[0]) {
    if (this.current === null) throw new Error("Workflow not found")
    this.current = {
      ...this.current,
      name: input.name,
      description: input.description,
      draft: input.draft,
      draftRevision: input.expectedRevision + 1
    }
    return this.current
  }

  async listVersions() {
    return this.versions
  }

  async publish(
    _workflowId = workflowId,
    agentSnapshots: RepositoryAgentSnapshot[] = [],
    modelSnapshots: WorkflowModelSnapshot[] = [],
    expectedRevision?: number
  ) {
    if (this.current === null) throw new Error("Workflow not found")
    if (expectedRevision !== undefined && this.current.draftRevision !== expectedRevision) {
      throw new Error("Workflow draft changed during publication")
    }
    const version = (this.versions[0]?.version ?? 0) + 1
    const compiled = compileWorkflowDefinition({
      workflowId,
      source: { kind: "published", version },
      definition: this.current.draft,
      maximumPhase: CURRENT_WORKFLOW_RELEASE_PHASE,
      agentSnapshots,
      modelSnapshots
    })
    const publishedAt = now
    const versionRecord: WorkflowVersionRecord = {
      workflowId,
      version,
      content: this.current.draft,
      contentDigest: compiled.digest,
      publishedAt
    }
    this.versions = [versionRecord, ...this.versions]
    this.executionPackage = {
      packageDigest: compiled.digest,
      workflowId,
      sourceKind: "published",
      workflowVersion: version,
      draftRevision: null,
      contractVersion: "1",
      compilerVersion: "1",
      compiledPlanDigest: "a".repeat(64),
      content: compiled.content,
      createdAt: now
    }
    this.current = { ...this.current, activePublishedVersion: version }
    return versionRecord
  }

  async getActivePublishedVersion() {
    if (this.current?.activePublishedVersion === null || this.current === null) return null
    return this.versions.find(({ version }) => version === this.current?.activePublishedVersion) ?? null
  }

  async getExecutionPackage() {
    return this.executionPackage
  }
}

function journal() {
  return {
    cancelRun: vi.fn<WorkflowServiceJournal["cancelRun"]>(async () => ({
      runId,
      packageDigest: "a".repeat(64),
      requestDigest: "b".repeat(64),
      triggerIdentity: "manual:request-1",
      sealedManifest: {},
      status: "cancelled",
      cancellationGeneration: 1,
      latestSequence: 2,
      schedulerCursor: null,
      pendingCheckpointCursor: null,
      createdAt: now,
      updatedAt: now,
      terminalAt: now
    })),
    getRunDetail: vi.fn<WorkflowServiceJournal["getRunDetail"]>(async () => null),
    listRuns: vi.fn<WorkflowServiceJournal["listRuns"]>(async () => []),
    publishExecutionPackage: vi.fn<WorkflowServiceJournal["publishExecutionPackage"]>(async (content) => ({
      packageDigest: "a".repeat(64),
      workflowId: content.workflowId,
      sourceKind: content.source.kind,
      workflowVersion: content.source.kind === "published" ? content.source.version : null,
      draftRevision: content.source.kind === "draft_test" ? content.source.draftRevision : null,
      contractVersion: content.schemaVersion,
      compilerVersion: content.compilerVersion,
      compiledPlanDigest: "b".repeat(64),
      content,
      createdAt: now
    })),
    prepareRun: vi.fn<WorkflowServiceJournal["prepareRun"]>(async () => ({
      created: true,
      run: {
        runId,
        packageDigest: "a".repeat(64),
        requestDigest: "b".repeat(64),
        triggerIdentity: "manual:request-1",
        sealedManifest: {},
        status: "runnable",
        cancellationGeneration: 0,
        latestSequence: 1,
        schedulerCursor: null,
        pendingCheckpointCursor: null,
        createdAt: now,
        updatedAt: now,
        terminalAt: null
      }
    })),
    listPendingWaits: vi.fn<WorkflowServiceJournal["listPendingWaits"]>(async () => []),
    resumeWait: vi.fn<WorkflowServiceJournal["resumeWait"]>(async () => null),
    retryActivation: vi.fn<WorkflowServiceJournal["retryActivation"]>(async ({ runId: retryRunId, activationId }) => ({
      runId: retryRunId,
      activationId,
      stepId: "agent",
      scope: [],
      status: "ready",
      inputBindings: {},
      dependencyCount: 0,
      selectedAttemptOrdinal: null,
      nextAttemptOrdinal: 2,
      availableAt: now,
      createdAt: now,
      updatedAt: now
    })),
    retryFromHere: vi.fn<WorkflowServiceJournal["retryFromHere"]>(async ({ runId: retryRunId, activationId }) => ({
      activation: {
        runId: retryRunId,
        activationId,
        stepId: "agent",
        scope: [],
        status: "ready",
        inputBindings: {},
        dependencyCount: 0,
        selectedAttemptOrdinal: null,
        nextAttemptOrdinal: 2,
        availableAt: now,
        createdAt: now,
        updatedAt: now
      },
      affectedDescendantIds: []
    })),
    resolveEffect: vi.fn<WorkflowServiceJournal["resolveEffect"]>(
      async ({ runId: effectRunId, effectId: resolvedEffectId }) => ({
        effectId: resolvedEffectId,
        runId: effectRunId,
        activationId: "a".repeat(64),
        effectSlot: "provider-action",
        attemptOrdinal: 1,
        provider: "github",
        requestDigest: "b".repeat(64),
        idempotencyKey: "effect-1",
        status: "confirmed",
        request: {},
        result: null,
        reconciliation: {},
        createdAt: now,
        updatedAt: now
      })
    )
  }
}

describe("WorkflowService", () => {
  it("returns workflow step definitions", () => {
    const service = new WorkflowService(new FakeWorkflowStore(), journal())

    const response = service.definitions()
    expect(response.schemaVersion).toBe("1")
    expect(response.definitions).toEqual(expect.any(Array))
    expect(response.definitions.some((definition) => definition.kind === "manual_trigger")).toBe(true)
  })

  it("returns run detail when found and rejects when missing", async () => {
    const store = new FakeWorkflowStore()
    store.current = workflow()
    await store.publish()
    const executionPackage = store.executionPackage
    if (executionPackage === null) throw new Error("Expected execution package")
    const workflowJournal = journal()
    workflowJournal.getRunDetail.mockResolvedValueOnce({
      run: {
        runId,
        packageDigest: executionPackage.packageDigest,
        requestDigest: "b".repeat(64),
        triggerIdentity: "manual:request-1",
        sealedManifest: { input: { issue: "FEN-423" }, resources: [] },
        status: "failed",
        cancellationGeneration: 0,
        latestSequence: 2,
        schedulerCursor: null,
        pendingCheckpointCursor: null,
        createdAt: now,
        updatedAt: now,
        terminalAt: now
      },
      executionPackage,
      graph: CompiledWorkflowGraphSchema.parse(executionPackage.content.graph),
      activations: [],
      attempts: [],
      effects: [],
      waits: [],
      data: [],
      events: [],
      childLinks: []
    })
    const service = new WorkflowService(store, workflowJournal)

    await expect(service.runDetail(runId)).resolves.toMatchObject({
      schemaVersion: "2",
      run: expect.objectContaining({ runId }),
      summary: {
        outcome: "failed",
        currentStep: null,
        failure: null,
        actions: [
          {
            key: "cancel",
            label: "Cancel run",
            targetId: null,
            allowed: false,
            disabledReason: "This run has already ended.",
            approvalRequirement: "confirmation",
            consequence: expect.any(String)
          },
          {
            key: "run_again",
            label: "Run again",
            targetId: null,
            allowed: true,
            disabledReason: null,
            approvalRequirement: "confirmation",
            consequence: expect.any(String)
          }
        ]
      }
    })
    await expect(service.runDetail(runId)).rejects.toThrow(`Workflow run ${runId} was not found`)
  })

  it("disables published rerun actions for draft-test run details", async () => {
    const store = new FakeWorkflowStore()
    store.current = workflow()
    await store.publish()
    const publishedPackage = store.executionPackage
    if (publishedPackage === null) throw new Error("Expected execution package")
    const executionPackage = {
      ...publishedPackage,
      sourceKind: "draft_test",
      workflowVersion: null,
      draftRevision: 1,
      content: {
        ...publishedPackage.content,
        source: { kind: "draft_test" as const, draftRevision: 1 }
      }
    }
    const workflowJournal = journal()
    workflowJournal.getRunDetail.mockResolvedValueOnce({
      run: {
        runId,
        packageDigest: executionPackage.packageDigest,
        requestDigest: "b".repeat(64),
        triggerIdentity: "draft_test:request-1",
        sealedManifest: { input: {}, resources: [], source: executionPackage.content.source },
        status: "running",
        cancellationGeneration: 0,
        latestSequence: 1,
        schedulerCursor: null,
        pendingCheckpointCursor: null,
        createdAt: now,
        updatedAt: now,
        terminalAt: null
      },
      executionPackage,
      graph: CompiledWorkflowGraphSchema.parse(executionPackage.content.graph),
      activations: [],
      attempts: [],
      effects: [],
      waits: [],
      data: [],
      events: [],
      childLinks: []
    })
    const service = new WorkflowService(store, workflowJournal)

    await expect(service.runDetail(runId)).resolves.toMatchObject({
      summary: {
        actions: expect.arrayContaining([
          expect.objectContaining({
            key: "run_again",
            allowed: false,
            disabledReason: "Start another test from the current workflow draft."
          })
        ])
      }
    })
  })

  it("cancels a run and forwards parsed input", async () => {
    const workflowJournal = journal()
    const service = new WorkflowService(new FakeWorkflowStore(), workflowJournal)

    await expect(service.cancelRun(runId, { reason: "  no longer needed  " })).resolves.toMatchObject({
      schemaVersion: "1",
      run: expect.objectContaining({ runId, status: "cancelled" })
    })
    expect(workflowJournal.cancelRun).toHaveBeenCalledWith({ runId, reason: "no longer needed" })
  })

  it("retries a failed activation and retries descendants from an activation", async () => {
    const activationId = "activation-1"
    const workflowJournal = journal()
    const service = new WorkflowService(new FakeWorkflowStore(), workflowJournal)

    await expect(service.retryActivation(runId, activationId)).resolves.toMatchObject({
      schemaVersion: "1",
      activation: expect.objectContaining({ runId, activationId })
    })
    expect(workflowJournal.retryActivation).toHaveBeenCalledWith({ runId, activationId })

    await expect(service.retryFromHere(runId, activationId)).resolves.toMatchObject({
      schemaVersion: "1",
      activation: expect.objectContaining({ runId, activationId }),
      affectedDescendantIds: []
    })
    expect(workflowJournal.retryFromHere).toHaveBeenCalledWith({ runId, activationId })
  })

  it.each([
    { outcome: "occurred" as const, result: { ok: true } },
    { outcome: "absent" as const, result: undefined },
    { outcome: "indeterminate" as const, result: undefined }
  ])("resolves effect outcome $outcome", async ({ outcome, result }) => {
    const effectId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e36"
    const workflowJournal = journal()
    const service = new WorkflowService(new FakeWorkflowStore(), workflowJournal)
    const input = {
      outcome,
      reason: `Effect marked as ${outcome}`,
      ...(result === undefined ? {} : { result })
    }

    await expect(service.resolveEffect(runId, effectId, input)).resolves.toMatchObject({
      schemaVersion: "1",
      effect: expect.objectContaining({ runId, effectId })
    })
    expect(workflowJournal.resolveEffect).toHaveBeenCalledWith({
      runId,
      effectId,
      outcome,
      reason: `Effect marked as ${outcome}`,
      ...(result === undefined ? {} : { result })
    })
  })

  it("seals and starts a durable live draft test without publishing the workflow", async () => {
    const store = new FakeWorkflowStore()
    store.current = workflow()
    const workflowJournal = journal()
    const service = new WorkflowService(store, workflowJournal)

    await expect(
      service.test(workflowId, {
        expectedRevision: 1,
        triggerStepId: "manual-start",
        input: { issue: "REQUEST-456" }
      })
    ).resolves.toEqual({
      runId,
      created: true,
      source: { kind: "draft_test", draftRevision: 1 }
    })
    expect(workflowJournal.publishExecutionPackage).toHaveBeenCalledWith(
      expect.objectContaining({ source: { kind: "draft_test", draftRevision: 1 } })
    )
    expect(workflowJournal.prepareRun).toHaveBeenCalledWith({
      packageDigest: "a".repeat(64),
      requestDigest: expect.stringMatching(/^[0-9a-f]{64}$/u),
      triggerIdentity: expect.stringMatching(/^draft_test:/u),
      sealedManifest: {
        input: { issue: "REQUEST-456" },
        resources: [],
        source: { kind: "draft_test", draftRevision: 1 }
      },
      initialActivations: [{ stepId: "manual-start", inputBindings: { input: { issue: "REQUEST-456" } } }]
    })
    expect(store.current.activePublishedVersion).toBeNull()
    const sealedPackage = workflowJournal.publishExecutionPackage.mock.calls[0]?.[0]
    if (sealedPackage === undefined) throw new Error("Expected a sealed draft-test package")
    store.current.draft.steps[1]!.label = "Changed after test started"
    const sealedGraph = CompiledWorkflowGraphSchema.parse(sealedPackage.graph)
    expect(sealedGraph.steps.find(({ id }) => id === "set-fields")?.label).toBe("Set fields")

    await expect(
      service.test(workflowId, { expectedRevision: 2, triggerStepId: "manual-start", input: {} })
    ).rejects.toThrow("Workflow draft changed before testing")
    await expect(
      service.test(workflowId, { expectedRevision: 1, triggerStepId: "set-fields", input: {} })
    ).rejects.toThrow("Select an available trigger step")
  })

  it("injects draft schedule and provider-event inputs after external ingress", async () => {
    const source = content()
    source.resourceBindings = {
      repo: {
        connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
        provider: "github",
        resourceType: "repository",
        externalId: "42",
        name: "agency/repository",
        capabilities: ["provider.events"]
      }
    }
    source.steps[0] = {
      ...source.steps[0]!,
      id: "schedule-start",
      label: "Every minute",
      definition: { kind: "schedule", version: 1 },
      config: { timezone: "UTC", intervalSeconds: 60 }
    }
    source.steps[1] = {
      ...source.steps[1]!,
      label: "Trigger results",
      definition: { kind: "join", version: 1 },
      config: { policy: "any" }
    }
    source.steps.push({
      id: "webhook-start",
      label: "Webhook start",
      position: { x: 0, y: 160 },
      definition: { kind: "provider_event", version: 1 },
      config: {
        provider: "github",
        eventKey: "pull_request.created",
        binding: {
          connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
          externalId: "42"
        }
      },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    source.connections[0] = {
      ...source.connections[0]!,
      source: { stepId: "schedule-start", port: "fire" },
      target: { stepId: "set-fields", port: "branches" }
    }
    source.connections[1] = {
      ...source.connections[1]!,
      source: { stepId: "set-fields", port: "results" },
      mappings: [{ sourcePath: ["[]"], targetPath: [] }]
    }
    source.connections.push({
      id: "webhook-success",
      source: { stepId: "webhook-start", port: "event" },
      target: { stepId: "set-fields", port: "branches" },
      outcome: "success",
      mappings: [{ sourcePath: [], targetPath: [] }]
    })
    const store = new FakeWorkflowStore()
    store.current = workflow(source)
    const workflowJournal = journal()
    const service = new WorkflowService(store, workflowJournal)

    await service.test(workflowId, {
      expectedRevision: 1,
      triggerStepId: "schedule-start",
      input: { scheduledAt: "2026-07-20T12:00:00.000Z" }
    })
    await service.test(workflowId, {
      expectedRevision: 1,
      triggerStepId: "webhook-start",
      input: { action: "opened" }
    })

    expect(workflowJournal.prepareRun).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        initialActivations: [
          {
            stepId: "schedule-start",
            inputBindings: { fire: { scheduledAt: "2026-07-20T12:00:00.000Z" } }
          }
        ]
      })
    )
    expect(workflowJournal.prepareRun).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        initialActivations: [{ stepId: "webhook-start", inputBindings: { event: { action: "opened" } } }]
      })
    )
    expect(store.current.activePublishedVersion).toBeNull()
  })

  it("propagates create, update, and publish conflicts from the store", async () => {
    const store = new FakeWorkflowStore()
    store.current = workflow()
    const service = new WorkflowService(store, journal())
    const repository = {
      connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
      provider: "github" as const,
      resourceType: "repository" as const,
      externalId: "42",
      name: "agency/repository",
      capabilities: ["repository.read", "pull_request.write"]
    }

    vi.spyOn(store, "create").mockRejectedValueOnce(new Error("Workflow name already exists"))
    await expect(
      service.create({
        template: "agency_delivery",
        name: "Delivery",
        repository,
        linearTeam,
        modelId: selectedModel.modelId,
        agentReference: selectedAgentReference
      })
    ).rejects.toThrow("Workflow name already exists")

    vi.spyOn(store, "updateDraft").mockRejectedValueOnce(new Error("Draft revision mismatch"))
    await expect(
      service.updateDraft(workflowId, {
        expectedRevision: 1,
        name: "Updated",
        description: "V2",
        content: content()
      })
    ).rejects.toThrow("Draft revision mismatch")

    vi.spyOn(store, "publish").mockRejectedValueOnce(new Error("Draft changed during publish"))
    await expect(service.publish(workflowId)).rejects.toThrow("Draft changed during publish")
  })

  it("creates, validates, updates, and publishes compiled V2 definitions", async () => {
    const store = new FakeWorkflowStore()
    const models = { list: vi.fn(async () => [selectedModel]), resolve: vi.fn(async () => selectedModel) }
    const service = new WorkflowService(store, journal(), undefined, models)

    const repository = {
      connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
      provider: "github" as const,
      resourceType: "repository" as const,
      externalId: "42",
      name: "agency/repository",
      capabilities: ["repository.read", "pull_request.write"]
    }
    const created = await service.create({
      template: "agency_delivery",
      name: "Delivery",
      repository,
      linearTeam,
      modelId: selectedModel.modelId,
      agentReference: selectedAgentReference
    })
    expect(created).toMatchObject({ schemaVersion: "3", draftRevision: 1 })
    expect(created.content.resourceBindings).toEqual({ repository, linearTeam })
    expect(created.content.steps.map(({ id }) => id)).toEqual([
      "manual-start",
      "ready-tasks",
      "triage-task",
      "delivery-loop",
      "delivery-agent",
      "pull-request",
      "review-change",
      "success"
    ])
    expect(created.content.connections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "review-to-loop", loopBack: true }),
        expect.objectContaining({ id: "loop-to-success" })
      ])
    )
    await expect(service.validate(workflowId)).resolves.toEqual({
      schemaVersion: "1",
      draftRevision: 1,
      valid: false,
      issues: [
        expect.objectContaining({
          code: "agent_snapshot",
          nodeId: "delivery-agent"
        })
      ]
    })

    const next = content()
    next.steps[1] = { ...next.steps[1]!, label: "Compose fields" }
    await service.updateDraft(workflowId, {
      expectedRevision: 1,
      name: "Updated",
      description: "V2",
      content: next
    })
    const published = await service.publish(workflowId)
    expect(published).toMatchObject({ activePublishedVersion: 1, name: "Updated" })
    expect(store.executionPackage?.content.graph).toMatchObject({ schemaVersion: "2" })
    await expect(service.list()).resolves.toEqual([
      expect.objectContaining({ triggers: [{ kind: "manual", label: "Manual start", enabled: true }] })
    ])
  })

  it("requires a repository when creating a blank workflow", async () => {
    const store = new FakeWorkflowStore()
    const service = new WorkflowService(store, journal())
    const repository = {
      connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
      provider: "github" as const,
      resourceType: "repository" as const,
      externalId: "42",
      name: "agency/repository",
      capabilities: ["repository.read"]
    }

    await expect(service.create({ template: "blank", name: "Repository workflow", repository })).resolves.toMatchObject(
      {
        name: "Repository workflow",
        content: { resourceBindings: { repository }, steps: [], connections: [] }
      }
    )
    await expect(service.create({ template: "blank", name: "Missing repository" })).rejects.toThrow(
      "Invalid input: expected object, received undefined"
    )
    await expect(
      service.create({ template: "agency_delivery", name: "Incomplete starter", repository: undefined })
    ).rejects.toThrow("Invalid input: expected object, received undefined")
  })

  it("lists no workflows when the store is empty", async () => {
    const service = new WorkflowService(new FakeWorkflowStore(), journal())

    await expect(service.list()).resolves.toEqual([])
  })

  it("rejects compiler-invalid drafts", async () => {
    const invalid = content()
    invalid.connections = []
    const store = new FakeWorkflowStore()
    store.current = workflow(invalid)
    const service = new WorkflowService(store, journal())

    await expect(service.validate(workflowId)).resolves.toMatchObject({ valid: false })
    await expect(service.publish(workflowId)).rejects.toThrow("not reachable from a trigger")
  })

  it("returns compiler validation issues with node and connection targets", async () => {
    const invalid = content()
    invalid.connections[0] = {
      ...invalid.connections[0]!,
      target: { stepId: "set-fields", port: "value" }
    }
    const store = new FakeWorkflowStore()
    store.current = workflow(invalid)
    const service = new WorkflowService(store, journal())

    const validation = await service.validate(workflowId)

    expect(validation.valid).toBe(false)
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "target_port",
          nodeId: "set-fields",
          connectionId: "manual-fields"
        })
      ])
    )
  })

  it("resolves and pins repository-agent snapshots for validation and publication", async () => {
    const source = content()
    const reference = {
      connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
      repositoryId: "42",
      repositoryName: "agency/repository",
      ref: "main",
      path: ".github/reviewer.agent.md",
      observedCommitSha: "a".repeat(40),
      blobSha: "b".repeat(40),
      contentDigest: "d".repeat(64),
      sourceUrl: "https://github.com/agency/repository/blob/main/.github/reviewer.agent.md",
      name: "Reviewer",
      description: "Reviews candidate changes",
      requestedTools: ["read"]
    }
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "repository_agent", version: 1 },
      config: { agentReference: reference, ...repositoryAgentExecutionPolicy }
    }
    source.connections[0] = { ...source.connections[0]!, target: { stepId: "set-fields", port: "context" } }
    source.connections[1] = {
      ...source.connections[1]!,
      source: { stepId: "set-fields", port: "result" },
      target: { stepId: "success", port: "input" }
    }
    const snapshot: RepositoryAgentSnapshot = {
      reference,
      content: "---\nname: Reviewer\ndescription: Reviews candidate changes\n---\nReview.",
      body: "Review.",
      parserVersion: "1",
      effectiveModel: null,
      effectiveTools: ["read"]
    }
    const repositoryAgents = {
      discover: vi.fn(async () => [reference]),
      resolve: vi.fn(async () => snapshot)
    }
    const store = new FakeWorkflowStore()
    store.current = workflow(source)
    const service = new WorkflowService(store, journal(), repositoryAgents)

    await expect(service.validate(workflowId)).resolves.toEqual({
      schemaVersion: "1",
      draftRevision: 1,
      valid: true,
      issues: []
    })
    await expect(service.publish(workflowId)).resolves.toMatchObject({ activePublishedVersion: 1 })
    expect(repositoryAgents.resolve).toHaveBeenCalledTimes(2)
    expect(store.executionPackage?.content.agentSnapshots).toEqual([snapshot])
  })

  it("deduplicates repository-agent references by content digest before resolving", async () => {
    const source = content()
    const reference = {
      connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
      repositoryId: "42",
      repositoryName: "agency/repository",
      ref: "main",
      path: ".github/reviewer.agent.md",
      observedCommitSha: "a".repeat(40),
      blobSha: "b".repeat(40),
      contentDigest: "d".repeat(64),
      sourceUrl: "https://github.com/agency/repository/blob/main/.github/reviewer.agent.md",
      name: "Reviewer",
      description: "Reviews candidate changes",
      requestedTools: ["read"]
    }
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "repository_agent", version: 1 },
      config: { agentReference: reference, ...repositoryAgentExecutionPolicy }
    }
    source.connections[0] = { ...source.connections[0]!, target: { stepId: "set-fields", port: "context" } }
    source.steps[2] = {
      ...source.steps[2]!,
      label: "Agent results",
      definition: { kind: "join", version: 1 },
      config: { policy: "any" }
    }
    source.connections[1] = {
      ...source.connections[1]!,
      source: { stepId: "set-fields", port: "result" },
      target: { stepId: "success", port: "branches" }
    }
    source.steps.push({
      id: "second-agent",
      label: "Second agent",
      position: { x: 280, y: 200 },
      definition: { kind: "repository_agent", version: 1 },
      config: {
        agentReference: { ...reference, path: ".github/reviewer-copy.agent.md" },
        ...repositoryAgentExecutionPolicy
      },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    source.steps.push({
      id: "result",
      label: "Result",
      position: { x: 620, y: 0 },
      definition: { kind: "set_fields", version: 1 },
      config: { fields: {} },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    source.connections.push({
      id: "manual-second-agent",
      source: { stepId: "manual-start", port: "input" },
      target: { stepId: "second-agent", port: "context" },
      outcome: "success",
      mappings: [{ sourcePath: [], targetPath: [] }]
    })
    source.connections.push({
      id: "second-agent-success",
      source: { stepId: "second-agent", port: "result" },
      target: { stepId: "success", port: "branches" },
      outcome: "success",
      mappings: [{ sourcePath: [], targetPath: [] }]
    })
    source.connections.push({
      id: "agents-result",
      source: { stepId: "success", port: "results" },
      target: { stepId: "result", port: "input" },
      outcome: "success",
      mappings: [{ sourcePath: ["[]"], targetPath: [] }]
    })
    const snapshot: RepositoryAgentSnapshot = {
      reference,
      content: "---\nname: Reviewer\ndescription: Reviews candidate changes\n---\nReview.",
      body: "Review.",
      parserVersion: "1",
      effectiveModel: null,
      effectiveTools: ["read"]
    }
    const repositoryAgents = {
      discover: vi.fn(async () => [reference]),
      resolve: vi.fn(async () => snapshot)
    }
    const store = new FakeWorkflowStore()
    store.current = workflow(source)
    const service = new WorkflowService(store, journal(), repositoryAgents)

    await expect(service.validate(workflowId)).resolves.toEqual({
      schemaVersion: "1",
      draftRevision: 1,
      valid: true,
      issues: []
    })
    expect(repositoryAgents.resolve).toHaveBeenCalledTimes(1)
  })

  it("surfaces repository-agent resolution errors and unavailable catalog failures", async () => {
    const source = content()
    const reference = {
      connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
      repositoryId: "42",
      repositoryName: "agency/repository",
      ref: "main",
      path: ".github/reviewer.agent.md",
      observedCommitSha: "a".repeat(40),
      blobSha: "b".repeat(40),
      contentDigest: "d".repeat(64),
      sourceUrl: "https://github.com/agency/repository/blob/main/.github/reviewer.agent.md",
      name: "Reviewer",
      description: "Reviews candidate changes",
      requestedTools: ["read"]
    }
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "repository_agent", version: 1 },
      config: { agentReference: reference, ...repositoryAgentExecutionPolicy }
    }
    source.connections[0] = { ...source.connections[0]!, target: { stepId: "set-fields", port: "context" } }
    source.connections[1] = { ...source.connections[1]!, source: { stepId: "set-fields", port: "result" } }

    const store = new FakeWorkflowStore()
    store.current = workflow(source)
    const failingAgents = {
      discover: vi.fn(async () => [reference]),
      resolve: vi.fn(async () => {
        throw new Error("Repository agent .github/reviewer.agent.md changed content")
      })
    }
    const service = new WorkflowService(store, journal(), failingAgents)
    await expect(service.validate(workflowId)).rejects.toThrow(
      "Repository agent .github/reviewer.agent.md changed content"
    )

    const noCatalogService = new WorkflowService(store, journal())
    await expect(noCatalogService.validate(workflowId)).resolves.toEqual({
      schemaVersion: "1",
      draftRevision: 1,
      valid: false,
      issues: [expect.objectContaining({ code: "agent_snapshot", nodeId: "set-fields" })]
    })
  })

  it("resolves and pins model catalog snapshots for validation and publication", async () => {
    const source = content()
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "ai_model", version: 1 },
      config: {
        modelId: "openai/gpt-test",
        messages: [{ role: "user", content: "Classify the input." }],
        outputMode: "structured",
        outputSchema: { type: "object", properties: { label: { type: "string" } } }
      }
    }
    source.connections[0] = { ...source.connections[0]!, target: { stepId: "set-fields", port: "context" } }
    source.connections[1] = { ...source.connections[1]!, source: { stepId: "set-fields", port: "response" } }
    const snapshot: WorkflowModelSnapshot = {
      modelId: "openai/gpt-test",
      name: "GPT Test",
      contextLength: 128_000,
      pricing: { prompt: "0.000001", completion: "0.000002" },
      architecture: { inputModalities: ["text"], outputModalities: ["text"] },
      supportedParameters: ["response_format"],
      observedAt: "2026-07-19T12:00:00.000Z"
    }
    const models = { list: vi.fn(async () => [snapshot]), resolve: vi.fn(async () => snapshot) }
    const store = new FakeWorkflowStore()
    store.current = workflow(source)
    const service = new WorkflowService(store, journal(), undefined, models)

    await expect(service.modelDefinitions()).resolves.toEqual({ schemaVersion: "1", models: [snapshot] })
    await expect(service.validate(workflowId)).resolves.toEqual({
      schemaVersion: "1",
      draftRevision: 1,
      valid: true,
      issues: []
    })
    await expect(service.publish(workflowId)).resolves.toMatchObject({ activePublishedVersion: 1 })
    expect(models.resolve).toHaveBeenCalledTimes(2)
    expect(store.executionPackage?.content.modelSnapshots).toEqual([snapshot])
  })

  it("deduplicates model references and resolves in stable sorted order", async () => {
    const source = content()
    source.steps[1] = {
      ...source.steps[1]!,
      id: "model-z",
      definition: { kind: "ai_model", version: 1 },
      config: {
        modelId: "zeta/model",
        messages: [{ role: "user", content: "Summarize" }],
        outputMode: "structured",
        outputSchema: { type: "object", properties: { summary: { type: "string" } } }
      }
    }
    source.steps.push({
      id: "model-a",
      label: "Model A",
      position: { x: 180, y: 220 },
      definition: { kind: "structured_judgment", version: 1 },
      config: {
        modelId: "alpha/model",
        criteria: "Determine whether the request is valid.",
        outputSchema: { type: "object", properties: { decision: { type: "string" } } }
      },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    source.steps.push({
      id: "model-z-2",
      label: "Model Z duplicate",
      position: { x: 380, y: 220 },
      definition: { kind: "ai_model", version: 1 },
      config: {
        modelId: "zeta/model",
        messages: [{ role: "user", content: "Classify" }],
        outputMode: "text"
      },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    source.steps[2] = {
      ...source.steps[2]!,
      label: "Model results",
      definition: { kind: "join", version: 1 },
      config: { policy: "any" }
    }
    source.steps.push({
      id: "result",
      label: "Result",
      position: { x: 600, y: 0 },
      definition: { kind: "set_fields", version: 1 },
      config: { fields: {} },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    source.connections[0] = {
      ...source.connections[0]!,
      target: { stepId: "model-z", port: "context" }
    }
    source.connections[1] = {
      ...source.connections[1]!,
      source: { stepId: "model-z", port: "response" },
      target: { stepId: "success", port: "branches" }
    }
    source.connections.push({
      id: "manual-model-a",
      source: { stepId: "manual-start", port: "input" },
      target: { stepId: "model-a", port: "evidence" },
      outcome: "success",
      mappings: [{ sourcePath: [], targetPath: [] }]
    })
    source.connections.push({
      id: "model-a-success",
      source: { stepId: "model-a", port: "judgment" },
      target: { stepId: "success", port: "branches" },
      outcome: "success",
      mappings: [{ sourcePath: [], targetPath: [] }]
    })
    source.connections.push({
      id: "manual-model-z-2",
      source: { stepId: "manual-start", port: "input" },
      target: { stepId: "model-z-2", port: "context" },
      outcome: "success",
      mappings: [{ sourcePath: [], targetPath: [] }]
    })
    source.connections.push({
      id: "model-z-2-success",
      source: { stepId: "model-z-2", port: "response" },
      target: { stepId: "success", port: "branches" },
      outcome: "success",
      mappings: [{ sourcePath: [], targetPath: [] }]
    })
    source.connections.push({
      id: "models-result",
      source: { stepId: "success", port: "results" },
      target: { stepId: "result", port: "input" },
      outcome: "success",
      mappings: [{ sourcePath: ["[]"], targetPath: [] }]
    })

    const store = new FakeWorkflowStore()
    store.current = workflow(source)
    const modelSnapshot = (modelId: string): WorkflowModelSnapshot => ({
      modelId,
      name: modelId,
      contextLength: 128_000,
      pricing: { prompt: "0.000001", completion: "0.000002" },
      architecture: { inputModalities: ["text"], outputModalities: ["text"] },
      supportedParameters: ["response_format"],
      observedAt: "2026-07-19T12:00:00.000Z"
    })
    const models = {
      list: vi.fn(async () => []),
      resolve: vi.fn(async (modelId: string) => modelSnapshot(modelId))
    }
    const service = new WorkflowService(store, journal(), undefined, models)

    await expect(service.validate(workflowId)).resolves.toEqual({
      schemaVersion: "1",
      draftRevision: 1,
      valid: true,
      issues: []
    })
    expect(models.resolve).toHaveBeenCalledTimes(2)
    expect(models.resolve).toHaveBeenNthCalledWith(1, "alpha/model")
    expect(models.resolve).toHaveBeenNthCalledWith(2, "zeta/model")
  })

  it("surfaces model resolution and unavailable model catalog failures", async () => {
    const source = content()
    source.steps[1] = {
      ...source.steps[1]!,
      definition: { kind: "ai_model", version: 1 },
      config: {
        modelId: "openai/gpt-test",
        messages: [{ role: "user", content: "Classify" }],
        outputMode: "text"
      }
    }
    source.connections[0] = { ...source.connections[0]!, target: { stepId: "set-fields", port: "context" } }
    source.connections[1] = { ...source.connections[1]!, source: { stepId: "set-fields", port: "response" } }
    const store = new FakeWorkflowStore()
    store.current = workflow(source)
    const failingModels = {
      list: vi.fn(async () => []),
      resolve: vi.fn(async () => {
        throw new Error("Model openai/gpt-test is unavailable")
      })
    }
    const service = new WorkflowService(store, journal(), undefined, failingModels)
    await expect(service.validate(workflowId)).rejects.toThrow("Model openai/gpt-test is unavailable")

    const noCatalogService = new WorkflowService(store, journal())
    await expect(noCatalogService.validate(workflowId)).rejects.toThrow("Model catalog resolution is unavailable")
  })

  it("prepares a journal run from the immutable execution package", async () => {
    const store = new FakeWorkflowStore()
    store.current = workflow()
    await store.publish()
    const workflowJournal = journal()
    const service = new WorkflowService(store, workflowJournal)

    await expect(
      service.start(workflowId, {
        version: 1,
        input: { issue: "FEN-423" },
        trigger: { type: "manual", key: "request-1" }
      })
    ).resolves.toEqual({ runId, created: true, source: { kind: "published", version: 1 } })
    expect(workflowJournal.prepareRun).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerIdentity: "manual:request-1",
        sealedManifest: expect.objectContaining({ input: { issue: "FEN-423" } }),
        initialActivations: [{ stepId: "manual-start", inputBindings: { input: { issue: "FEN-423" } } }]
      })
    )
  })

  it("starts schedule and webhook triggers using the expected trigger port", async () => {
    const source = content()
    source.resourceBindings = {
      repo: {
        connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
        provider: "github",
        resourceType: "repository",
        externalId: "42",
        name: "agency/repository",
        capabilities: ["provider.events"]
      }
    }
    source.steps[0] = {
      ...source.steps[0]!,
      id: "schedule-start",
      label: "Every minute",
      definition: { kind: "schedule", version: 1 },
      config: { timezone: "UTC", intervalSeconds: 60 }
    }
    source.steps[1] = {
      ...source.steps[1]!,
      label: "Trigger results",
      definition: { kind: "join", version: 1 },
      config: { policy: "any" }
    }
    source.steps.push({
      id: "webhook-start",
      label: "Webhook start",
      position: { x: 0, y: 160 },
      definition: { kind: "provider_event", version: 1 },
      config: {
        provider: "github",
        eventKey: "pull_request.created",
        binding: {
          connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
          externalId: "42"
        }
      },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    source.connections[0] = {
      ...source.connections[0]!,
      source: { stepId: "schedule-start", port: "fire" },
      target: { stepId: "set-fields", port: "branches" }
    }
    source.connections[1] = {
      ...source.connections[1]!,
      source: { stepId: "set-fields", port: "results" },
      mappings: [{ sourcePath: ["[]"], targetPath: [] }]
    }
    source.connections.push({
      id: "webhook-fields",
      source: { stepId: "webhook-start", port: "event" },
      target: { stepId: "set-fields", port: "branches" },
      outcome: "success",
      mappings: [{ sourcePath: [], targetPath: [] }]
    })
    const store = new FakeWorkflowStore()
    store.current = workflow(source)
    await store.publish()
    const workflowJournal = journal()
    const service = new WorkflowService(store, workflowJournal)

    await expect(
      service.start(workflowId, {
        version: 1,
        input: { when: "now" },
        trigger: { type: "schedule", key: "cron-1", stepId: "schedule-start" }
      })
    ).resolves.toEqual({ runId, created: true, source: { kind: "published", version: 1 } })
    expect(workflowJournal.prepareRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        triggerIdentity: "schedule:cron-1",
        initialActivations: [{ stepId: "schedule-start", inputBindings: { fire: { when: "now" } } }]
      })
    )

    await expect(
      service.start(workflowId, {
        version: 1,
        input: { event: "opened" },
        trigger: { type: "webhook", key: "delivery-1", stepId: "webhook-start" }
      })
    ).resolves.toEqual({ runId, created: true, source: { kind: "published", version: 1 } })
    expect(workflowJournal.prepareRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        triggerIdentity: "webhook:delivery-1",
        initialActivations: [{ stepId: "webhook-start", inputBindings: { event: { event: "opened" } } }]
      })
    )
  })

  it("rejects stale, ambiguous, and malformed start trigger requests", async () => {
    const store = new FakeWorkflowStore()
    store.current = workflow()
    await store.publish()
    const service = new WorkflowService(store, journal())

    await expect(
      service.start(workflowId, {
        version: 1,
        input: {},
        trigger: { type: "schedule", key: "cron-1", stepId: "missing-step" }
      })
    ).rejects.toThrow("Trigger is stale, unavailable, or ambiguous")

    const ambiguous = content()
    ambiguous.steps.push({
      id: "manual-start-2",
      label: "Manual start 2",
      position: { x: 0, y: 220 },
      definition: { kind: "manual_trigger", version: 1 },
      config: {},
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    ambiguous.steps.push({
      id: "set-fields-2",
      label: "Set fields 2",
      position: { x: 220, y: 220 },
      definition: { kind: "set_fields", version: 1 },
      config: { fields: { value: 2 } },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    ambiguous.steps.push({
      id: "success-2",
      label: "Result 2",
      position: { x: 420, y: 220 },
      definition: { kind: "set_fields", version: 1 },
      config: { fields: {} },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    ambiguous.connections.push({
      id: "manual-2-fields",
      source: { stepId: "manual-start-2", port: "input" },
      target: { stepId: "set-fields-2", port: "input" },
      outcome: "success",
      mappings: [{ sourcePath: [], targetPath: [] }]
    })
    ambiguous.connections.push({
      id: "fields-2-success-2",
      source: { stepId: "set-fields-2", port: "value" },
      target: { stepId: "success-2", port: "input" },
      outcome: "success",
      mappings: [{ sourcePath: [], targetPath: [] }]
    })
    const ambiguousStore = new FakeWorkflowStore()
    ambiguousStore.current = workflow(ambiguous)
    await expect(ambiguousStore.publish()).rejects.toThrow("A workflow can contain only one Manual run trigger")

    await expect(
      service.start(workflowId, { version: 1, trigger: { type: "webhook", key: "x", stepId: "BAD_STEP" } })
    ).rejects.toThrow(/Invalid string/u)

    await expect(
      service.start(workflowId, { version: 2, trigger: { type: "manual", key: "stale-version" } })
    ).rejects.toThrow("Published version 2 is not active")
  })

  it("runs the same immutable package again with a fresh trigger identity", async () => {
    const store = new FakeWorkflowStore()
    store.current = workflow()
    await store.publish()
    const executionPackage = store.executionPackage
    if (executionPackage === null) throw new Error("Expected execution package")
    const workflowJournal = journal()
    workflowJournal.getRunDetail.mockResolvedValueOnce({
      run: {
        runId,
        packageDigest: executionPackage.packageDigest,
        requestDigest: "b".repeat(64),
        triggerIdentity: "manual:request-1",
        sealedManifest: { input: { issue: "FEN-423" }, resources: [] },
        status: "failed",
        cancellationGeneration: 0,
        latestSequence: 2,
        schedulerCursor: null,
        pendingCheckpointCursor: null,
        createdAt: now,
        updatedAt: now,
        terminalAt: now
      },
      executionPackage,
      graph: CompiledWorkflowGraphSchema.parse(executionPackage.content.graph),
      activations: [],
      attempts: [],
      effects: [],
      waits: [],
      data: [],
      events: [],
      childLinks: []
    })
    const service = new WorkflowService(store, workflowJournal)

    await expect(service.runAgain(runId, {})).resolves.toEqual({ runId, created: true, version: 1, schemaVersion: "1" })
    expect(workflowJournal.prepareRun).toHaveBeenCalledWith(
      expect.objectContaining({
        packageDigest: executionPackage.packageDigest,
        triggerIdentity: expect.stringMatching(new RegExp(`^rerun:${runId}:[0-9a-f-]{36}$`, "u")),
        sealedManifest: expect.objectContaining({ input: { issue: "FEN-423" }, sourceRunId: runId }),
        initialActivations: [{ stepId: "manual-start", inputBindings: { input: { issue: "FEN-423" } } }]
      })
    )
  })

  it("runs schedule and webhook executions again with trigger-specific ports", async () => {
    const scheduleSource = content()
    scheduleSource.steps[0] = {
      ...scheduleSource.steps[0]!,
      id: "schedule-start",
      definition: { kind: "schedule", version: 1 },
      config: { timezone: "UTC", intervalSeconds: 60 }
    }
    scheduleSource.connections[0] = {
      ...scheduleSource.connections[0]!,
      source: { stepId: "schedule-start", port: "fire" }
    }
    const scheduleStore = new FakeWorkflowStore()
    scheduleStore.current = workflow(scheduleSource)
    await scheduleStore.publish()
    const scheduleExecutionPackage = scheduleStore.executionPackage
    if (scheduleExecutionPackage === null) throw new Error("Expected execution package")
    const scheduleJournal = journal()
    scheduleJournal.getRunDetail.mockResolvedValueOnce({
      run: {
        runId,
        packageDigest: scheduleExecutionPackage.packageDigest,
        requestDigest: "b".repeat(64),
        triggerIdentity: "schedule:cron-1",
        sealedManifest: { input: { when: "now" }, resources: [] },
        status: "failed",
        cancellationGeneration: 0,
        latestSequence: 2,
        schedulerCursor: null,
        pendingCheckpointCursor: null,
        createdAt: now,
        updatedAt: now,
        terminalAt: now
      },
      executionPackage: scheduleExecutionPackage,
      graph: CompiledWorkflowGraphSchema.parse(scheduleExecutionPackage.content.graph),
      activations: [],
      attempts: [],
      effects: [],
      waits: [],
      data: [],
      events: [],
      childLinks: []
    })
    const scheduleService = new WorkflowService(scheduleStore, scheduleJournal)
    await expect(scheduleService.runAgain(runId, {})).resolves.toEqual({
      runId,
      created: true,
      version: 1,
      schemaVersion: "1"
    })
    expect(scheduleJournal.prepareRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initialActivations: [{ stepId: "schedule-start", inputBindings: { fire: { when: "now" } } }]
      })
    )

    const webhookSource = content()
    webhookSource.resourceBindings = {
      repo: {
        connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
        provider: "github",
        resourceType: "repository",
        externalId: "42",
        name: "agency/repository",
        capabilities: ["provider.events"]
      }
    }
    webhookSource.steps[0] = {
      ...webhookSource.steps[0]!,
      id: "webhook-start",
      definition: { kind: "provider_event", version: 1 },
      config: {
        provider: "github",
        eventKey: "pull_request.created",
        binding: {
          connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
          externalId: "42"
        }
      }
    }
    webhookSource.connections[0] = {
      ...webhookSource.connections[0]!,
      source: { stepId: "webhook-start", port: "event" }
    }
    const webhookStore = new FakeWorkflowStore()
    webhookStore.current = workflow(webhookSource)
    await webhookStore.publish()
    const webhookExecutionPackage = webhookStore.executionPackage
    if (webhookExecutionPackage === null) throw new Error("Expected execution package")
    const webhookJournal = journal()
    webhookJournal.getRunDetail.mockResolvedValueOnce({
      run: {
        runId,
        packageDigest: webhookExecutionPackage.packageDigest,
        requestDigest: "b".repeat(64),
        triggerIdentity: "webhook:delivery-1",
        sealedManifest: { input: { event: { action: "opened" } }, resources: [] },
        status: "failed",
        cancellationGeneration: 0,
        latestSequence: 2,
        schedulerCursor: null,
        pendingCheckpointCursor: null,
        createdAt: now,
        updatedAt: now,
        terminalAt: now
      },
      executionPackage: webhookExecutionPackage,
      graph: CompiledWorkflowGraphSchema.parse(webhookExecutionPackage.content.graph),
      activations: [],
      attempts: [],
      effects: [],
      waits: [],
      data: [],
      events: [],
      childLinks: []
    })
    const webhookService = new WorkflowService(webhookStore, webhookJournal)
    await expect(webhookService.runAgain(runId, {})).resolves.toEqual({
      runId,
      created: true,
      version: 1,
      schemaVersion: "1"
    })
    expect(webhookJournal.prepareRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initialActivations: [{ stepId: "webhook-start", inputBindings: { event: { event: { action: "opened" } } } }]
      })
    )
  })

  it("rejects run-again for missing runs, child runs, invalid input, and stale trigger graph", async () => {
    const store = new FakeWorkflowStore()
    store.current = workflow()
    await store.publish()
    const executionPackage = store.executionPackage
    if (executionPackage === null) throw new Error("Expected execution package")
    const workflowJournal = journal()
    const service = new WorkflowService(store, workflowJournal)

    await expect(service.runAgain(runId, {})).rejects.toThrow(`Workflow run ${runId} was not found`)

    workflowJournal.getRunDetail.mockResolvedValueOnce({
      run: {
        runId,
        packageDigest: executionPackage.packageDigest,
        requestDigest: "b".repeat(64),
        triggerIdentity: "child:workflow:step",
        sealedManifest: { input: { issue: "FEN-423" }, resources: [] },
        status: "failed",
        cancellationGeneration: 0,
        latestSequence: 2,
        schedulerCursor: null,
        pendingCheckpointCursor: null,
        createdAt: now,
        updatedAt: now,
        terminalAt: now
      },
      executionPackage,
      graph: CompiledWorkflowGraphSchema.parse(executionPackage.content.graph),
      activations: [],
      attempts: [],
      effects: [],
      waits: [],
      data: [],
      events: [],
      childLinks: []
    })
    await expect(service.runAgain(runId, {})).rejects.toThrow(
      "Child workflow runs must be started through their parent workflow"
    )

    workflowJournal.getRunDetail.mockResolvedValueOnce({
      run: {
        runId,
        packageDigest: executionPackage.packageDigest,
        requestDigest: "b".repeat(64),
        triggerIdentity: "manual:request-1",
        sealedManifest: { input: { issue: "FEN-423" }, resources: [] },
        status: "failed",
        cancellationGeneration: 0,
        latestSequence: 2,
        schedulerCursor: null,
        pendingCheckpointCursor: null,
        createdAt: now,
        updatedAt: now,
        terminalAt: now
      },
      executionPackage,
      graph: CompiledWorkflowGraphSchema.parse(executionPackage.content.graph),
      activations: [],
      attempts: [],
      effects: [],
      waits: [],
      data: [],
      events: [],
      childLinks: []
    })
    await expect(service.runAgain(runId, { input: [] })).rejects.toThrow(/expected record, received array/iu)

    const staleSource = content()
    staleSource.steps.push({
      id: "manual-start-2",
      label: "Manual start 2",
      position: { x: 40, y: 240 },
      definition: { kind: "manual_trigger", version: 1 },
      config: {},
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    staleSource.steps.push({
      id: "set-fields-2",
      label: "Set fields 2",
      position: { x: 320, y: 240 },
      definition: { kind: "set_fields", version: 1 },
      config: { fields: {} },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    staleSource.steps.push({
      id: "success-2",
      label: "Result 2",
      position: { x: 600, y: 240 },
      definition: { kind: "set_fields", version: 1 },
      config: { fields: {} },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    })
    staleSource.connections.push({
      id: "manual2-fields2",
      source: { stepId: "manual-start-2", port: "input" },
      target: { stepId: "set-fields-2", port: "input" },
      outcome: "success",
      mappings: [{ sourcePath: [], targetPath: [] }]
    })
    staleSource.connections.push({
      id: "fields2-success2",
      source: { stepId: "set-fields-2", port: "value" },
      target: { stepId: "success-2", port: "input" },
      outcome: "success",
      mappings: [{ sourcePath: [], targetPath: [] }]
    })
    const staleStore = new FakeWorkflowStore()
    staleStore.current = workflow(staleSource)
    await expect(staleStore.publish()).rejects.toThrow("A workflow can contain only one Manual run trigger")
  })

  it("lists schedules and routes matching provider events", async () => {
    const scheduled = content()
    scheduled.steps[0] = {
      ...scheduled.steps[0]!,
      id: "schedule-start",
      label: "Every minute",
      definition: { kind: "schedule", version: 1 },
      config: { timezone: "UTC", intervalSeconds: 60 }
    }
    scheduled.connections[0] = {
      ...scheduled.connections[0]!,
      source: { stepId: "schedule-start", port: "fire" }
    }
    const store = new FakeWorkflowStore()
    store.current = workflow(scheduled)
    await store.publish()
    store.current = { ...store.current, draft: content() }
    const workflowJournal = journal()
    workflowJournal.listPendingWaits.mockResolvedValueOnce([
      {
        waitId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e34",
        runId,
        activationId: "a".repeat(64),
        attemptOrdinal: 1,
        correlationKey: "github:repo-42:pull_request.created:84",
        acceptedInputSchema: { type: "object" },
        authorization: null,
        status: "pending",
        consuming: 1,
        expiresAt: new Date("2026-07-19T13:00:00.000Z"),
        winningEventSequence: null,
        createdAt: now,
        updatedAt: now
      }
    ])
    const scheduleId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e35"
    const scheduleStore = {
      list: vi.fn(async () => [
        {
          scheduleId,
          workflowId,
          workflowVersion: 1,
          triggerNodeId: "schedule-start",
          label: "Every minute",
          enabled: true,
          intervalSeconds: 60,
          scheduleExpression: null,
          timezone: "UTC",
          nextRunAt: new Date("2026-07-19T12:01:00.000Z"),
          lastAttemptedAt: null,
          lastSuccessfulAt: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          failureCode: null,
          failureDetails: null,
          revision: 1,
          createdAt: now,
          updatedAt: now
        }
      ]),
      update: vi.fn()
    }
    const service = new WorkflowService(store, workflowJournal, undefined, undefined, scheduleStore, () => now)

    await expect(service.schedules()).resolves.toEqual([
      {
        scheduleId,
        workflowId,
        workflowVersion: 1,
        triggerNodeId: "schedule-start",
        label: "Every minute",
        enabled: true,
        intervalSeconds: 60,
        scheduleExpression: null,
        timezone: "UTC",
        nextRunAt: "2026-07-19T12:01:00.000Z",
        lastAttemptedAt: null,
        lastSuccessfulAt: null,
        health: "scheduled",
        latestError: null,
        revision: 1
      }
    ])
    await expect(service.receiveWebhook({ webhookType: "unknown" }, "missing")).resolves.toBe(0)
    await service.receiveWebhook(
      {
        webhookType: "forward",
        from: "github",
        providerEventAction: "opened",
        providerObjectType: "Pull_Request",
        providerObjectId: "84",
        providerResourceId: "repo-42"
      },
      "delivery-1"
    )
    expect(workflowJournal.resumeWait).toHaveBeenCalledWith(
      expect.objectContaining({
        runId,
        correlationKey: "github:repo-42:pull_request.created:84"
      })
    )
  })

  it("filters schedules and routes linear webhook events to matching published triggers", async () => {
    const source = content()
    source.steps[0] = {
      ...source.steps[0]!,
      id: "linear-event",
      label: "Linear event",
      definition: { kind: "provider_event", version: 1 },
      config: { provider: "linear", eventKey: "task.comment.created", binding: linearTeam }
    }
    source.resourceBindings = { linearTeam }
    source.connections[0] = {
      ...source.connections[0]!,
      source: { stepId: "linear-event", port: "event" },
      target: { stepId: "set-fields", port: "input" }
    }
    const store = new FakeWorkflowStore()
    store.current = workflow(source)
    await store.publish()
    store.current = { ...store.current, draft: content() }
    const workflowJournal = journal()
    const service = new WorkflowService(store, workflowJournal, undefined, undefined, {
      list: vi.fn(async () => []),
      update: vi.fn()
    })
    const startSpy = vi
      .spyOn(service, "start")
      .mockResolvedValue({ runId, created: true, source: { kind: "published", version: 1 } })

    await expect(service.schedules()).resolves.toEqual([])

    await expect(
      service.receiveWebhook(
        {
          webhookType: "forward",
          from: "linear",
          providerConfigKey: "linear-prod",
          providerEventAction: "created",
          providerObjectType: "Comment",
          providerObjectId: "84",
          providerResourceId: "team-1"
        },
        "delivery-42"
      )
    ).resolves.toBe(1)

    expect(startSpy).toHaveBeenCalledWith(workflowId, {
      version: 1,
      input: {
        provider: "linear",
        resourceType: "team",
        resourceId: "team-1",
        eventKey: "task.comment.created",
        objectType: "task.comment",
        objectId: "84"
      },
      trigger: {
        type: "webhook",
        key: "delivery-42:task.comment.created:linear-event",
        stepId: "linear-event"
      }
    })
  })

  it("updates a durable schedule with optimistic concurrency", async () => {
    const scheduleId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e36"
    const updatedAt = new Date("2026-07-19T12:05:00.000Z")
    const updated = {
      scheduleId,
      workflowId,
      workflowVersion: 2,
      triggerNodeId: "schedule-start",
      label: "Delivery schedule",
      enabled: false,
      intervalSeconds: 600,
      scheduleExpression: null,
      timezone: "UTC",
      nextRunAt: new Date("2026-07-19T12:15:00.000Z"),
      lastAttemptedAt: now,
      lastSuccessfulAt: now,
      leaseOwner: null,
      leaseExpiresAt: null,
      failureCode: null,
      failureDetails: null,
      revision: 3,
      createdAt: now,
      updatedAt
    }
    const scheduleStore = {
      list: vi.fn(async () => [updated]),
      update: vi.fn(async () => updated)
    }
    const service = new WorkflowService(
      new FakeWorkflowStore(),
      journal(),
      undefined,
      undefined,
      scheduleStore,
      () => updatedAt
    )

    await expect(
      service.updateSchedule(scheduleId, { expectedRevision: 2, enabled: false, intervalSeconds: 600 })
    ).resolves.toMatchObject({ scheduleId, enabled: false, health: "disabled", revision: 3 })
    expect(scheduleStore.update).toHaveBeenCalledWith({
      scheduleId,
      expectedRevision: 2,
      enabled: false,
      intervalSeconds: 600,
      scheduleExpression: null,
      timezone: "UTC",
      now: updatedAt
    })
  })

  it("exposes repository agent discovery and model definitions errors when unavailable", async () => {
    const service = new WorkflowService(new FakeWorkflowStore(), journal())

    await expect(
      service.repositoryAgentDefinitions({
        connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
        repositoryId: "42",
        repositoryName: "agency/repository",
        ref: "main"
      })
    ).rejects.toThrow("Repository agent discovery is unavailable")
    await expect(service.modelDefinitions()).rejects.toThrow("Model catalog is unavailable")
  })

  it("forwards repository agent discovery inputs and outputs", async () => {
    const reference = {
      connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
      repositoryId: "42",
      repositoryName: "agency/repository",
      ref: "main",
      path: ".github/reviewer.agent.md",
      observedCommitSha: "a".repeat(40),
      blobSha: "b".repeat(40),
      contentDigest: "d".repeat(64),
      sourceUrl: "https://github.com/agency/repository/blob/main/.github/reviewer.agent.md",
      name: "Reviewer",
      description: "Reviews candidate changes",
      requestedTools: ["read"]
    }
    const repositoryAgents = {
      discover: vi.fn(async () => [reference]),
      resolve: vi.fn(async () => {
        throw new Error("resolve should not run in discovery")
      })
    }
    const service = new WorkflowService(new FakeWorkflowStore(), journal(), repositoryAgents)
    const request = {
      connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
      repositoryId: "42",
      repositoryName: "agency/repository",
      ref: "main"
    }

    await expect(service.repositoryAgentDefinitions(request)).resolves.toEqual({
      schemaVersion: "1",
      agents: [reference]
    })
    expect(repositoryAgents.discover).toHaveBeenCalledWith(request)
  })

  it("rejects missing workflows and unpublished starts", async () => {
    const store = new FakeWorkflowStore()
    const service = new WorkflowService(store, journal())
    await expect(service.draft(workflowId)).rejects.toThrow("Workflow not found")
    store.current = workflow()
    await expect(service.start(workflowId, { version: 1, trigger: { type: "manual" } })).rejects.toThrow(
      "Publish the workflow before starting a run"
    )
  })
})
