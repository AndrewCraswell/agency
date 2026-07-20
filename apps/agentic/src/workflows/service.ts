import { randomUUID } from "node:crypto"
import { z } from "zod"
import type { PostgresWorkflowJournalStore } from "../persistence/workflowJournalStore"
import type { PostgresWorkflowStore, WorkflowDefinitionRecord } from "../persistence/workflowStore"
import type { NangoWebhookReceipt } from "../webhooks/nango"
import { CompiledWorkflowGraphSchema, compileWorkflowDefinition, WorkflowCompilationError } from "./compiler"
import {
  CreateWorkflowRequestSchema,
  PublishedWorkflowScheduleSchema,
  StartWorkflowRunRequestSchema,
  UpdateWorkflowDraftRequestSchema,
  WorkflowDraftViewSchema,
  WorkflowRunStartSchema,
  WorkflowSummarySchema
} from "./contracts"
import { WorkflowDefinitionV2Schema, type WorkflowDefinitionV2 } from "./definitionV2"
import { JsonValueSchema, jsonValueDigest } from "./executionContracts"
import { validateJsonValue } from "./jsonSchema"
import type { WorkflowModelCatalogPort, WorkflowModelSnapshot } from "./modelCatalog"
import { simulatePhase2Workflow } from "./phase2Executor"
import { listProviderOperations } from "./providerCatalog"
import {
  RepositoryAgentReferenceSchema,
  type RepositoryAgentCatalog,
  type RepositoryAgentSnapshot
} from "./repositoryAgents"
import { CURRENT_WORKFLOW_RELEASE_PHASE, listWorkflowStepDefinitions } from "./stepRegistry"

export type WorkflowServiceStore = Pick<
  PostgresWorkflowStore,
  "create" | "get" | "getExecutionPackage" | "getPublishedVersion" | "list" | "listVersions" | "publish" | "updateDraft"
>

export type WorkflowServiceJournal = Pick<
  PostgresWorkflowJournalStore,
  | "cancelRun"
  | "getRunDetail"
  | "prepareRun"
  | "listPendingWaits"
  | "resumeWait"
  | "retryActivation"
  | "retryFromHere"
  | "resolveEffect"
>
export type WorkflowRepositoryAgentCatalog = Pick<RepositoryAgentCatalog, "discover" | "resolve">

function defaultWorkflowDefinition(
  repository: WorkflowDefinitionV2["resourceBindings"][string],
  linearTeam: WorkflowDefinitionV2["resourceBindings"][string],
  modelId: string
): WorkflowDefinitionV2 {
  return WorkflowDefinitionV2Schema.parse({
    schemaVersion: "2",
    inputSchema: { type: "object", additionalProperties: true },
    outputSchema: { type: "object", additionalProperties: true },
    constants: {},
    resourceBindings: { repository, linearTeam },
    fixtures: [],
    steps: [
      {
        id: "manual-start",
        label: "Manual start",
        position: { x: 40, y: 120 },
        definition: { kind: "manual_trigger", version: 1 },
        config: {},
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "ready-tasks",
        label: "Get ready tasks",
        position: { x: 320, y: 120 },
        definition: { kind: "provider_data", version: 1 },
        config: { provider: "linear", operation: "linear.ready_issues", binding: linearTeam },
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "triage-task",
        label: "Select next task",
        position: { x: 600, y: 120 },
        definition: { kind: "ai_model", version: 1 },
        config: {
          modelId,
          messages: [
            {
              role: "system",
              content:
                "Select the highest-value task that is ready for implementation. Return only the requested structured result."
            },
            { role: "user", content: "Review these Linear tasks and select one: {{context}}" }
          ],
          outputMode: "structured",
          outputSchema: {
            type: "object",
            additionalProperties: false,
            required: ["approved", "issueId", "identifier", "title", "url"],
            properties: {
              approved: { const: false },
              issueId: { type: "string" },
              identifier: { type: "string" },
              title: { type: "string" },
              url: { type: "string", format: "uri" }
            }
          }
        },
        failurePolicy: { mode: "stop", maximumAttempts: 2 }
      },
      {
        id: "delivery-loop",
        label: "Implement and review",
        position: { x: 880, y: 120 },
        definition: { kind: "bounded_loop", version: 1 },
        config: {
          maximumIterations: 3,
          maximumActivations: 20,
          condition: { path: ["value", "approved"], operator: "not_equals", value: true },
          bodyStepId: "delivery-agent",
          exitStepId: "success",
          onExhaustion: "fail"
        },
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "delivery-agent",
        label: "Implement task",
        position: { x: 1160, y: 40 },
        definition: { kind: "repository_agent", version: 1 },
        config: {
          instructions:
            "Implement the selected Linear task. Address any review feedback from earlier rounds and return the pull request request."
        },
        failurePolicy: { mode: "stop", maximumAttempts: 2 }
      },
      {
        id: "pull-request",
        label: "Create pull request",
        position: { x: 1440, y: 40 },
        definition: { kind: "provider_action", version: 1 },
        config: {
          provider: "github",
          operation: "github.create_or_update_pull_request",
          binding: repository
        },
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "review-change",
        label: "Review change",
        position: { x: 1720, y: 40 },
        definition: { kind: "structured_judgment", version: 1 },
        config: {
          modelId,
          criteria:
            "Review the implementation for correctness, regressions, security, maintainability, and test coverage. Approve only when no actionable issues remain.",
          outputSchema: {
            type: "object",
            additionalProperties: false,
            required: ["value"],
            properties: {
              value: {
                type: "object",
                additionalProperties: false,
                required: ["approved", "feedback"],
                properties: { approved: { type: "boolean" }, feedback: { type: "string" } }
              }
            }
          }
        },
        failurePolicy: { mode: "stop", maximumAttempts: 2 }
      },
      {
        id: "success",
        label: "Delivery complete",
        position: { x: 1160, y: 240 },
        definition: { kind: "success", version: 1 },
        config: {},
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      }
    ],
    connections: [
      {
        id: "manual-to-ready",
        source: { stepId: "manual-start", port: "input" },
        target: { stepId: "ready-tasks", port: "query" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "ready-to-triage",
        source: { stepId: "ready-tasks", port: "result" },
        target: { stepId: "triage-task", port: "context" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "triage-to-loop",
        source: { stepId: "triage-task", port: "response" },
        target: { stepId: "delivery-loop", port: "state" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "loop-to-agent",
        source: { stepId: "delivery-loop", port: "iteration" },
        target: { stepId: "delivery-agent", port: "context" },
        outcome: "success",
        mappings: [{ sourcePath: ["state"], targetPath: [] }]
      },
      {
        id: "agent-to-pr",
        source: { stepId: "delivery-agent", port: "result" },
        target: { stepId: "pull-request", port: "request" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "pr-to-review",
        source: { stepId: "pull-request", port: "result" },
        target: { stepId: "review-change", port: "evidence" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "review-to-loop",
        source: { stepId: "review-change", port: "judgment" },
        target: { stepId: "delivery-loop", port: "state" },
        outcome: "success",
        loopBack: true,
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "loop-to-success",
        source: { stepId: "delivery-loop", port: "result" },
        target: { stepId: "success", port: "result" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      }
    ]
  })
}

type TriggerSummary = { kind: "manual" | "webhook" | "schedule"; label: string; enabled: boolean }

function triggerSummary(workflow: WorkflowDefinitionRecord): TriggerSummary[] {
  const triggers: TriggerSummary[] = []
  for (const step of workflow.draft.steps) {
    if (step.definition.kind === "manual_trigger") {
      triggers.push({ kind: "manual", label: step.label, enabled: true })
    }
    if (step.definition.kind === "provider_event") {
      triggers.push({ kind: "webhook", label: step.label, enabled: true })
    }
    if (step.definition.kind === "schedule") {
      triggers.push({ kind: "schedule", label: step.label, enabled: true })
    }
  }
  return triggers
}

function compilationValidation(
  definition: WorkflowDefinitionV2,
  workflowId: string,
  workflowVersion: number,
  agentSnapshots: RepositoryAgentSnapshot[] = [],
  modelSnapshots: WorkflowModelSnapshot[] = []
) {
  try {
    compileWorkflowDefinition({
      workflowId,
      workflowVersion,
      definition,
      maximumPhase: CURRENT_WORKFLOW_RELEASE_PHASE,
      agentSnapshots,
      modelSnapshots
    })
    return { valid: true, issues: [] }
  } catch (error) {
    if (!(error instanceof WorkflowCompilationError)) throw error
    return {
      valid: false,
      issues: error.issues.map((issue) => ({
        code: issue.code,
        message: issue.message,
        nodeId: issue.stepId,
        connectionId: issue.connectionId
      }))
    }
  }
}

function webhookEvent(
  receipt: NangoWebhookReceipt
): { provider: "github" | "linear"; eventKey: string; correlationKey?: string } | null {
  const source = `${receipt.from ?? ""} ${receipt.providerConfigKey ?? ""}`.toLowerCase()
  let provider: "github" | "linear" | null = null
  if (source.includes("github")) provider = "github"
  if (source.includes("linear")) provider = "linear"
  const action = receipt.providerEventAction?.toLowerCase()
  const objectType = receipt.providerObjectType?.toLowerCase()
  if (provider === null || action === undefined || objectType === undefined) return null
  const correlationKey =
    receipt.providerResourceId === undefined || receipt.providerObjectId === undefined
      ? undefined
      : `${provider}:${receipt.providerResourceId}:${objectType.toLowerCase()}:${receipt.providerObjectId}`
  if (provider === "github" && objectType.includes("pull")) {
    let suffix = action
    if (action === "opened") suffix = "created"
    if (action === "synchronize") suffix = "updated"
    return { provider, eventKey: `pull_request.${suffix}`, ...(correlationKey === undefined ? {} : { correlationKey }) }
  }
  if (provider === "linear" && objectType.includes("comment"))
    return { provider, eventKey: `task.comment.${action}`, ...(correlationKey === undefined ? {} : { correlationKey }) }
  if (provider === "linear" && objectType.includes("issue"))
    return { provider, eventKey: `task.${action}`, ...(correlationKey === undefined ? {} : { correlationKey }) }
  return null
}

function configString(config: Record<string, unknown>, name: string): string | null {
  const value = config[name]
  return typeof value === "string" ? value : null
}

export class WorkflowService {
  readonly #store: WorkflowServiceStore
  readonly #journal: WorkflowServiceJournal
  readonly #repositoryAgents: WorkflowRepositoryAgentCatalog | undefined
  readonly #models: WorkflowModelCatalogPort | undefined

  constructor(
    store: WorkflowServiceStore,
    journal: WorkflowServiceJournal,
    repositoryAgents?: WorkflowRepositoryAgentCatalog,
    models?: WorkflowModelCatalogPort
  ) {
    this.#store = store
    this.#journal = journal
    this.#repositoryAgents = repositoryAgents
    this.#models = models
  }

  definitions() {
    return { schemaVersion: "1" as const, definitions: listWorkflowStepDefinitions() }
  }

  async runDetail(runIdInput: string) {
    const runId = z.uuid().parse(runIdInput)
    const detail = await this.#journal.getRunDetail(runId)
    if (detail === null) throw new Error(`Workflow run ${runId} was not found`)
    return { schemaVersion: "1" as const, ...detail }
  }

  async cancelRun(runIdInput: string, inputValue: unknown) {
    const runId = z.uuid().parse(runIdInput)
    const input = z
      .object({ reason: z.string().trim().min(1).max(500).optional() })
      .strict()
      .parse(inputValue)
    return { schemaVersion: "1" as const, run: await this.#journal.cancelRun({ runId, ...input }) }
  }

  async retryActivation(runIdInput: string, activationIdInput: string) {
    const runId = z.uuid().parse(runIdInput)
    const activationId = z.string().trim().min(1).parse(activationIdInput)
    return { schemaVersion: "1" as const, activation: await this.#journal.retryActivation({ runId, activationId }) }
  }

  async retryFromHere(runIdInput: string, activationIdInput: string) {
    const runId = z.uuid().parse(runIdInput)
    const activationId = z.string().trim().min(1).parse(activationIdInput)
    return { schemaVersion: "1" as const, ...(await this.#journal.retryFromHere({ runId, activationId })) }
  }

  async resumeRunWait(runIdInput: string, inputValue: unknown) {
    const runId = z.uuid().parse(runIdInput)
    const input = z
      .object({
        correlationKey: z.string().trim().min(1).max(500),
        event: z.record(z.string(), JsonValueSchema)
      })
      .strict()
      .parse(inputValue)
    return { schemaVersion: "1" as const, resumed: await this.#journal.resumeWait({ runId, ...input }) }
  }

  async runAgain(runIdInput: string, inputValue: unknown) {
    const sourceRunId = z.uuid().parse(runIdInput)
    const request = z
      .object({ input: z.record(z.string(), JsonValueSchema).optional() })
      .strict()
      .parse(inputValue)
    const detail = await this.#journal.getRunDetail(sourceRunId)
    if (detail === null) throw new Error(`Workflow run ${sourceRunId} was not found`)
    if (detail.run.triggerIdentity.startsWith("child:"))
      throw new Error("Child workflow runs must be started through their parent workflow")
    const originalInput = z.record(z.string(), JsonValueSchema).parse(detail.run.sealedManifest.input)
    const runInput = request.input ?? originalInput
    const inputIssues = validateJsonValue(detail.graph.inputSchema, runInput)
    if (inputIssues.length > 0) throw new Error(inputIssues.map((issue) => `${issue.path}: ${issue.message}`).join(" "))
    let triggerKind = "manual_trigger"
    let triggerPort = "input"
    if (detail.run.triggerIdentity.startsWith("schedule:")) {
      triggerKind = "schedule"
      triggerPort = "fire"
    } else if (detail.run.triggerIdentity.startsWith("webhook:")) {
      triggerKind = "provider_event"
      triggerPort = "event"
    }
    const triggers = detail.graph.steps.filter(({ definition }) => definition.kind === triggerKind)
    if (triggers.length !== 1 || triggers[0] === undefined)
      throw new Error("The immutable package has no unambiguous operator trigger")
    const triggerIdentity = `rerun:${sourceRunId}:${randomUUID()}`
    const prepared = await this.#journal.prepareRun({
      packageDigest: detail.run.packageDigest,
      requestDigest: jsonValueDigest({ packageDigest: detail.run.packageDigest, triggerIdentity, input: runInput }),
      triggerIdentity,
      sealedManifest: { ...detail.run.sealedManifest, input: runInput, sourceRunId },
      initialActivations: [{ stepId: triggers[0].id, inputBindings: { [triggerPort]: runInput } }]
    })
    return {
      schemaVersion: "1" as const,
      runId: prepared.run.runId,
      created: prepared.created,
      version: detail.executionPackage.workflowVersion
    }
  }

  async resolveEffect(runIdInput: string, effectIdInput: string, inputValue: unknown) {
    const runId = z.uuid().parse(runIdInput)
    const effectId = z.uuid().parse(effectIdInput)
    const input = z
      .object({
        outcome: z.enum(["occurred", "absent", "indeterminate"]),
        reason: z.string().trim().min(1).max(2_000),
        result: z.record(z.string(), JsonValueSchema).optional()
      })
      .strict()
      .parse(inputValue)
    return { schemaVersion: "1" as const, effect: await this.#journal.resolveEffect({ runId, effectId, ...input }) }
  }

  async repositoryAgentDefinitions(input: unknown) {
    if (this.#repositoryAgents === undefined) throw new Error("Repository agent discovery is unavailable")
    return { schemaVersion: "1" as const, agents: await this.#repositoryAgents.discover(input) }
  }

  async modelDefinitions() {
    if (this.#models === undefined) throw new Error("Model catalog is unavailable")
    return { schemaVersion: "1" as const, models: await this.#models.list() }
  }

  providerDefinitions() {
    return { schemaVersion: "1" as const, operations: listProviderOperations() }
  }

  async list() {
    return Promise.all(
      (await this.#store.list()).map((workflow) =>
        WorkflowSummarySchema.parse({
          workflowId: workflow.workflowId,
          name: workflow.name,
          description: workflow.description,
          status: workflow.status,
          draftRevision: workflow.draftRevision,
          publishedVersion: workflow.publishedVersion,
          triggers: triggerSummary(workflow),
          updatedAt: workflow.updatedAt.toISOString()
        })
      )
    )
  }

  async create(input: unknown) {
    const request = CreateWorkflowRequestSchema.parse(input)
    return this.#draftView(
      await this.#store.create({
        name: request.name,
        description: request.description,
        draft: defaultWorkflowDefinition(request.repository, request.linearTeam, request.modelId)
      })
    )
  }

  async draft(workflowId: string) {
    return this.#draftView(await this.#requireWorkflow(workflowId))
  }

  async updateDraft(workflowId: string, input: unknown) {
    const request = UpdateWorkflowDraftRequestSchema.parse(input)
    return this.#draftView(
      await this.#store.updateDraft({
        workflowId,
        expectedRevision: request.expectedRevision,
        name: request.name,
        description: request.description,
        draft: request.content
      })
    )
  }

  async validate(workflowId: string) {
    const workflow = await this.#requireWorkflow(workflowId)
    const [agentSnapshots, modelSnapshots] = await Promise.all([
      this.#resolveRepositoryAgents(workflow.draft),
      this.#resolveModels(workflow.draft)
    ])
    return compilationValidation(
      workflow.draft,
      workflowId,
      (workflow.publishedVersion ?? 0) + 1,
      agentSnapshots,
      modelSnapshots
    )
  }

  async publish(workflowId: string) {
    const workflow = await this.#requireWorkflow(workflowId)
    const [agentSnapshots, modelSnapshots] = await Promise.all([
      this.#resolveRepositoryAgents(workflow.draft),
      this.#resolveModels(workflow.draft)
    ])
    const validation = compilationValidation(
      workflow.draft,
      workflowId,
      (workflow.publishedVersion ?? 0) + 1,
      agentSnapshots,
      modelSnapshots
    )
    if (!validation.valid) throw new Error(validation.issues.map(({ message }) => message).join(" "))
    await this.#store.publish(workflowId, agentSnapshots, modelSnapshots)
    return this.draft(workflowId)
  }

  async test(workflowId: string, input: unknown) {
    const request = z
      .object({
        input: JsonValueSchema.default({}),
        fixtureId: z.string().optional(),
        stopAtStepId: z.string().optional()
      })
      .strict()
      .parse(input)
    const workflow = await this.#requireWorkflow(workflowId)
    const fixture =
      request.fixtureId === undefined ? undefined : workflow.draft.fixtures.find(({ id }) => id === request.fixtureId)
    if (request.fixtureId !== undefined && fixture === undefined) {
      throw new Error(`Fixture ${request.fixtureId} was not found`)
    }
    const simulationInput = fixture?.workflowInput ?? request.input
    const startedAt = Date.now()
    const steps = await simulatePhase2Workflow(workflow.draft, simulationInput, request.stopAtStepId, fixture)
    return {
      schemaVersion: "1" as const,
      mode: request.stopAtStepId === undefined ? ("draft" as const) : ("run_to_here" as const),
      simulated: true as const,
      draftRevision: workflow.draftRevision,
      fixtureId: fixture?.id ?? null,
      elapsedMs: Math.max(0, Date.now() - startedAt),
      steps
    }
  }

  async start(workflowId: string, input: unknown) {
    const request = StartWorkflowRunRequestSchema.parse(input)
    const version = await this.#store.getPublishedVersion(workflowId)
    if (version === null) throw new Error("Publish the workflow before starting a run")
    const executionPackage = await this.#store.getExecutionPackage(workflowId, version.version)
    if (executionPackage === null) throw new Error("Published workflow has no execution package")
    const graph = CompiledWorkflowGraphSchema.parse(executionPackage.content.graph)
    const inputIssues = validateJsonValue(graph.inputSchema, request.input)
    if (inputIssues.length > 0) throw new Error(inputIssues.map((issue) => `${issue.path}: ${issue.message}`).join(" "))
    const triggers = graph.steps.filter((step) => {
      if (request.trigger.type === "manual") return step.definition.kind === "manual_trigger"
      if (request.trigger.type === "schedule") {
        return step.definition.kind === "schedule" && step.id === request.trigger.stepId
      }
      return step.definition.kind === "provider_event" && step.id === request.trigger.stepId
    })
    if (triggers.length !== 1) throw new Error("Trigger is stale, unavailable, or ambiguous")
    const trigger = triggers[0]
    if (trigger === undefined) throw new Error("Trigger is unavailable")
    const triggerIdentity = `${request.trigger.type}:${request.trigger.key}`
    const requestDigest = jsonValueDigest({
      packageDigest: executionPackage.packageDigest,
      triggerIdentity,
      input: request.input
    })
    let triggerPort = "input"
    if (request.trigger.type === "schedule") triggerPort = "fire"
    if (request.trigger.type === "webhook") triggerPort = "event"
    const prepared = await this.#journal.prepareRun({
      packageDigest: executionPackage.packageDigest,
      requestDigest,
      triggerIdentity,
      sealedManifest: { input: request.input, resources: executionPackage.content.resourceReferences },
      initialActivations: [{ stepId: trigger.id, inputBindings: { [triggerPort]: request.input } }]
    })
    return WorkflowRunStartSchema.parse({
      runId: prepared.run.runId,
      created: prepared.created,
      version: version.version
    })
  }

  async receiveWebhook(receipt: NangoWebhookReceipt, deliveryKey: string): Promise<number> {
    const event = webhookEvent(receipt)
    if (event === null) return 0
    if (event.correlationKey !== undefined) {
      const correlationKey = event.correlationKey
      const waits = await this.#journal.listPendingWaits(correlationKey)
      await Promise.all(waits.map(({ runId }) => this.#journal.resumeWait({ runId, correlationKey, event })))
    }
    const workflows = await this.#store.list()
    const matches = workflows.flatMap((workflow) => {
      if (workflow.publishedVersion === null) return []
      return workflow.draft.steps
        .filter(
          (step) =>
            step.definition.kind === "provider_event" &&
            configString(step.config, "provider") === event.provider &&
            configString(step.config, "eventKey") === event.eventKey
        )
        .map((step) => ({ workflowId: workflow.workflowId, stepId: step.id }))
    })
    await Promise.all(
      matches.map((match) =>
        this.start(match.workflowId, {
          input: { event },
          trigger: { type: "webhook", key: `${deliveryKey}:${event.eventKey}`, stepId: match.stepId }
        })
      )
    )
    return matches.length
  }

  async schedules() {
    const workflows = await this.#store.list()
    return workflows.flatMap((workflow) => {
      if (workflow.publishedVersion === null) return []
      return workflow.draft.steps.flatMap((step) => {
        if (step.definition.kind !== "schedule") return []
        const intervalSeconds = step.config.intervalSeconds
        if (typeof intervalSeconds !== "number") return []
        return [
          PublishedWorkflowScheduleSchema.parse({
            workflowId: workflow.workflowId,
            version: workflow.publishedVersion,
            nodeId: step.id,
            label: step.label,
            intervalSeconds
          })
        ]
      })
    })
  }

  async #draftView(workflow: WorkflowDefinitionRecord) {
    const versions = await this.#store.listVersions(workflow.workflowId)
    return WorkflowDraftViewSchema.parse({
      schemaVersion: "2",
      workflowId: workflow.workflowId,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      draftRevision: workflow.draftRevision,
      publishedVersion: workflow.publishedVersion,
      content: workflow.draft,
      versions: versions.map((version) => ({
        version: version.version,
        contentDigest: version.contentDigest,
        publishedAt: version.publishedAt.toISOString()
      })),
      updatedAt: workflow.updatedAt.toISOString()
    })
  }

  async #resolveRepositoryAgents(definition: WorkflowDefinitionV2): Promise<RepositoryAgentSnapshot[]> {
    const references = new Map<string, z.infer<typeof RepositoryAgentReferenceSchema>>()
    for (const step of definition.steps.filter(({ definition: item }) => item.kind === "repository_agent")) {
      const parsed = RepositoryAgentReferenceSchema.safeParse(step.config.agentReference)
      if (!parsed.success) continue
      references.set(parsed.data.contentDigest, parsed.data)
    }
    if (references.size === 0) return []
    const repositoryAgents = this.#repositoryAgents
    if (repositoryAgents === undefined) throw new Error("Repository agent resolution is unavailable")
    return Promise.all([...references.values()].map((reference) => repositoryAgents.resolve(reference)))
  }

  async #resolveModels(definition: WorkflowDefinitionV2): Promise<WorkflowModelSnapshot[]> {
    const modelIds = new Set<string>()
    for (const step of definition.steps.filter(
      ({ definition: item }) => item.kind === "ai_model" || item.kind === "structured_judgment"
    )) {
      if (typeof step.config.modelId === "string") modelIds.add(step.config.modelId)
    }
    if (modelIds.size === 0) return []
    const models = this.#models
    if (models === undefined) throw new Error("Model catalog resolution is unavailable")
    return Promise.all([...modelIds].sort().map((modelId) => models.resolve(modelId)))
  }

  async #requireWorkflow(workflowId: string): Promise<WorkflowDefinitionRecord> {
    const workflow = await this.#store.get(workflowId)
    if (workflow === null) throw new Error("Workflow not found")
    return workflow
  }
}
