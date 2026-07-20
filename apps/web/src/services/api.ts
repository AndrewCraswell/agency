import { z } from "zod"
import { env } from "./env"

const workflowRunSchema = z
  .object({
    runId: z.uuid(),
    status: z.enum(["queued", "running", "blocked", "failed", "cancelled", "published"]),
    stage: z.enum(["intake", "planning", "coding", "reviewing", "repairing", "publishing", "completed"]),
    activeRole: z.enum(["scrum_master", "coder", "reviewer", "repairer"]).nullable(),
    repository: z.string(),
    sourceWorkItemId: z.uuid().nullable(),
    sourceWorkItemIdentifier: z.string().nullable(),
    assignedAgentId: z.string().nullable(),
    pullRequestNumber: z.number().int().positive().nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true })
  })
  .strict()

const linearTaskReferenceSchema = z
  .object({
    id: z.uuid(),
    identifier: z.string(),
    stateType: z.enum(["triage", "backlog", "unstarted", "started", "completed", "canceled", "duplicate"])
  })
  .strict()

const linearTaskSchema = z
  .object({
    schemaVersion: z.literal("1"),
    source: z.literal("linear"),
    id: z.uuid(),
    identifier: z.string(),
    title: z.string(),
    description: z.string(),
    url: z.url(),
    priority: z.number().int(),
    state: z
      .object({ id: z.uuid(), name: z.string(), type: z.enum(["triage", "backlog", "unstarted", "started"]) })
      .strict(),
    team: z.object({ id: z.uuid(), key: z.string(), name: z.string() }).strict(),
    project: z.object({ id: z.uuid(), name: z.string() }).strict().nullable(),
    blockedBy: z.array(linearTaskReferenceSchema),
    blocks: z.array(linearTaskReferenceSchema)
  })
  .strict()

const snapshotSchema = z
  .object({
    schemaVersion: z.literal("1"),
    fetchedAt: z.iso.datetime({ offset: true }),
    agents: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          role: z.enum(["scrum_master", "engineer", "reviewer"]),
          description: z.string()
        })
        .strict()
    ),
    tasks: z.array(linearTaskSchema),
    runs: z.array(workflowRunSchema)
  })
  .strict()

const assignmentResponseSchema = z
  .object({ schemaVersion: z.literal("1"), created: z.boolean(), run: workflowRunSchema })
  .strict()

const workflowEventSchema = z
  .object({
    eventId: z.number().int().positive(),
    node: z.string(),
    outcome: z.enum(["started", "completed", "failed", "skipped", "retried"]),
    summary: z.string(),
    details: z.record(z.string(), z.unknown()),
    createdAt: z.iso.datetime({ offset: true })
  })
  .strict()

const traceReferenceSchema = z
  .object({ traceId: z.uuid(), runId: z.uuid(), projectName: z.string(), name: z.string() })
  .strict()

const workflowTopologySchema = z
  .object({
    graphVersion: z.string(),
    name: z.string(),
    nodes: z.array(
      z
        .object({
          id: z.string(),
          label: z.string(),
          description: z.string(),
          agentId: z.string().nullable(),
          agentName: z.string().nullable(),
          stages: z.array(z.enum(["intake", "planning", "coding", "reviewing", "repairing", "publishing", "completed"]))
        })
        .strict()
    ),
    edges: z.array(
      z
        .object({
          source: z.string(),
          target: z.string(),
          label: z.string(),
          kind: z.enum(["forward", "loop"])
        })
        .strict()
    )
  })
  .strict()

const runDetailSchema = z
  .object({
    schemaVersion: z.literal("1"),
    run: workflowRunSchema,
    workflow: workflowTopologySchema,
    events: z.array(workflowEventSchema)
  })
  .strict()

const apiErrorSchema = z.object({ error: z.string() })

const integrationProviderSchema = z.enum(["github", "linear"])
const integrationResourceCapabilitySchema = z.enum([
  "repository.read",
  "repository.write",
  "pull_request.write",
  "team.read",
  "issue.read",
  "issue.write"
])
const integrationResourceSchema = z
  .object({
    resourceType: z.enum(["repository", "team"]),
    externalId: z.string(),
    name: z.string(),
    capabilities: z.array(integrationResourceCapabilitySchema),
    stale: z.boolean(),
    lastDiscoveredAt: z.iso.datetime({ offset: true })
  })
  .strict()
const integrationConnectionSchema = z
  .object({
    connectionId: z.uuid(),
    provider: integrationProviderSchema,
    displayName: z.string().nullable(),
    status: z.enum(["connected", "degraded", "disconnected"]),
    errorCode: z.string().nullable(),
    lastCheckedAt: z.iso.datetime({ offset: true }).nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    resources: z.array(integrationResourceSchema)
  })
  .strict()
const integrationSettingsSchema = z
  .object({
    schemaVersion: z.literal("2"),
    catalog: z.array(
      z
        .object({
          provider: integrationProviderSchema,
          name: z.string(),
          description: z.string(),
          capabilities: z.array(z.string())
        })
        .strict()
    ),
    connections: z.array(integrationConnectionSchema)
  })
  .strict()
const integrationResourceInventorySchema = z
  .object({
    schemaVersion: z.literal("2"),
    resources: z.array(
      z
        .object({
          connectionId: z.uuid(),
          provider: integrationProviderSchema,
          resource: integrationResourceSchema
        })
        .strict()
    )
  })
  .strict()
const authorizationSessionSchema = z
  .object({
    provider: integrationProviderSchema,
    token: z.string(),
    connectLink: z.url(),
    expiresAt: z.iso.datetime({ offset: true })
  })
  .strict()

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
)
const workflowPositionSchema = z.object({ x: z.number(), y: z.number() }).strict()
export const workflowStepSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    position: workflowPositionSchema,
    definition: z.object({ kind: z.string(), version: z.number().int().positive() }).strict(),
    config: z.record(z.string(), jsonValueSchema),
    failurePolicy: z.object({ mode: z.enum(["stop", "route"]), maximumAttempts: z.number().int().positive() }).strict()
  })
  .strict()
const workflowConnectionSchema = z
  .object({
    id: z.string(),
    source: z.object({ stepId: z.string(), port: z.string() }).strict(),
    target: z.object({ stepId: z.string(), port: z.string() }).strict(),
    outcome: z.enum(["success", "failure"]),
    branchKey: z.string().optional(),
    loopBack: z.boolean().optional(),
    mappings: z.array(z.object({ sourcePath: z.array(z.string()), targetPath: z.array(z.string()) }).strict())
  })
  .strict()
const workflowResourceBindingSchema = z
  .object({
    connectionId: z.uuid(),
    provider: z.enum(["github", "linear"]),
    resourceType: z.enum(["repository", "team"]),
    externalId: z.string(),
    name: z.string(),
    capabilities: z.array(z.string())
  })
  .strict()
const workflowFixtureSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    revision: z.number().int().positive(),
    workflowInput: jsonValueSchema,
    providerResponses: z.record(z.string(), jsonValueSchema),
    modelResponses: z.record(z.string(), jsonValueSchema),
    agentResponses: z.record(z.string(), jsonValueSchema)
  })
  .strict()
const workflowDraftContentSchema = z
  .object({
    schemaVersion: z.literal("2"),
    inputSchema: jsonValueSchema,
    outputSchema: jsonValueSchema,
    steps: z.array(workflowStepSchema),
    connections: z.array(workflowConnectionSchema),
    constants: z.record(z.string(), jsonValueSchema),
    resourceBindings: z.record(z.string(), workflowResourceBindingSchema),
    fixtures: z.array(workflowFixtureSchema)
  })
  .strict()
const workflowSummarySchema = z
  .object({
    workflowId: z.uuid(),
    name: z.string(),
    description: z.string(),
    status: z.enum(["draft", "published", "archived"]),
    draftRevision: z.number().int(),
    publishedVersion: z.number().int().nullable(),
    triggers: z.array(
      z.object({ kind: z.enum(["manual", "webhook", "schedule"]), label: z.string(), enabled: z.boolean() }).strict()
    ),
    updatedAt: z.iso.datetime({ offset: true })
  })
  .strict()
const workflowDraftViewSchema = z
  .object({
    schemaVersion: z.literal("2"),
    workflowId: z.uuid(),
    name: z.string(),
    description: z.string(),
    status: z.enum(["draft", "published", "archived"]),
    draftRevision: z.number().int(),
    publishedVersion: z.number().int().nullable(),
    content: workflowDraftContentSchema,
    versions: z.array(
      z.object({ version: z.number().int(), contentDigest: z.string(), publishedAt: z.iso.datetime({ offset: true }) })
    ),
    updatedAt: z.iso.datetime({ offset: true })
  })
  .strict()
const workflowValidationSchema = z
  .object({
    valid: z.boolean(),
    issues: z.array(
      z
        .object({
          code: z.string(),
          message: z.string(),
          nodeId: z.string().nullable(),
          connectionId: z.string().nullable()
        })
        .strict()
    )
  })
  .strict()
const workflowRunStartSchema = z
  .object({ runId: z.uuid(), created: z.boolean(), version: z.number().int().positive() })
  .strict()
const activationScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("branch"), key: z.string() }).strict(),
  z.object({ kind: z.literal("loop"), key: z.string(), iteration: z.number().int().nonnegative() }).strict(),
  z.object({ kind: z.literal("item"), key: z.string() }).strict()
])
const journalWorkflowRunDetailSchema = z
  .object({
    schemaVersion: z.literal("1"),
    run: z
      .object({
        runId: z.uuid(),
        packageDigest: z.string(),
        requestDigest: z.string(),
        triggerIdentity: z.string(),
        sealedManifest: z.record(z.string(), jsonValueSchema),
        status: z.enum([
          "preparing",
          "runnable",
          "running",
          "waiting",
          "succeeded",
          "failed",
          "cancelled",
          "abandoned"
        ]),
        cancellationGeneration: z.number().int().nonnegative(),
        latestSequence: z.number().int().nonnegative(),
        schedulerCursor: z.string().nullable(),
        pendingCheckpointCursor: z.string().nullable(),
        createdAt: z.iso.datetime({ offset: true }),
        updatedAt: z.iso.datetime({ offset: true }),
        terminalAt: z.iso.datetime({ offset: true }).nullable()
      })
      .strict(),
    executionPackage: z
      .object({
        packageDigest: z.string(),
        workflowId: z.uuid(),
        workflowVersion: z.number().int().positive(),
        contractVersion: z.string(),
        compilerVersion: z.string(),
        compiledPlanDigest: z.string(),
        content: z.record(z.string(), jsonValueSchema),
        createdAt: z.iso.datetime({ offset: true })
      })
      .strict(),
    graph: z
      .object({
        schemaVersion: z.literal("2"),
        inputSchema: jsonValueSchema,
        outputSchema: jsonValueSchema,
        steps: z.array(workflowStepSchema),
        connections: z.array(workflowConnectionSchema),
        fixtures: z.array(workflowFixtureSchema),
        topologicalOrder: z.array(z.string())
      })
      .strict(),
    activations: z.array(
      z
        .object({
          activationId: z.string(),
          runId: z.uuid(),
          stepId: z.string(),
          scope: z.array(activationScopeSchema),
          status: z.enum(["blocked", "ready", "leased", "running", "waiting", "succeeded", "failed", "cancelled"]),
          inputBindings: z.record(z.string(), jsonValueSchema),
          selectedAttemptOrdinal: z.number().int().positive().nullable(),
          nextAttemptOrdinal: z.number().int().positive(),
          dependencyCount: z.number().int().nonnegative(),
          availableAt: z.iso.datetime({ offset: true }).nullable(),
          createdAt: z.iso.datetime({ offset: true }),
          updatedAt: z.iso.datetime({ offset: true })
        })
        .strict()
    ),
    attempts: z.array(
      z
        .object({
          runId: z.uuid(),
          activationId: z.string(),
          ordinal: z.number().int().positive(),
          status: z.enum(["queued", "running", "waiting", "succeeded", "failed", "cancelled", "unknown"]),
          fencingToken: z.number().int().nonnegative(),
          leaseOwner: z.string().nullable(),
          leaseExpiresAt: z.iso.datetime({ offset: true }).nullable(),
          input: z.record(z.string(), jsonValueSchema),
          output: z.record(z.string(), jsonValueSchema).nullable(),
          error: z.record(z.string(), jsonValueSchema).nullable(),
          usage: z.record(z.string(), jsonValueSchema).nullable(),
          evidence: z.record(z.string(), jsonValueSchema),
          createdAt: z.iso.datetime({ offset: true }),
          startedAt: z.iso.datetime({ offset: true }).nullable(),
          finishedAt: z.iso.datetime({ offset: true }).nullable()
        })
        .strict()
    ),
    effects: z.array(
      z
        .object({
          effectId: z.uuid(),
          runId: z.uuid(),
          activationId: z.string(),
          effectSlot: z.string(),
          attemptOrdinal: z.number().int().positive().nullable(),
          provider: z.string(),
          requestDigest: z.string(),
          idempotencyKey: z.string().nullable(),
          status: z.enum(["prepared", "dispatching", "confirmed", "unknown", "conflict", "failed", "resolved"]),
          request: z.record(z.string(), jsonValueSchema),
          result: z.record(z.string(), jsonValueSchema).nullable(),
          reconciliation: z.record(z.string(), jsonValueSchema).nullable(),
          createdAt: z.iso.datetime({ offset: true }),
          updatedAt: z.iso.datetime({ offset: true })
        })
        .strict()
    ),
    waits: z.array(
      z
        .object({
          waitId: z.uuid(),
          runId: z.uuid(),
          activationId: z.string(),
          attemptOrdinal: z.number().int().positive(),
          correlationKey: z.string(),
          acceptedInputSchema: z.record(z.string(), jsonValueSchema),
          authorization: z.record(z.string(), jsonValueSchema).nullable(),
          status: z.enum(["pending", "claimed", "resumed", "timed_out", "cancelled"]),
          consuming: z.number().int(),
          expiresAt: z.iso.datetime({ offset: true }),
          winningEventSequence: z.number().int().nullable(),
          createdAt: z.iso.datetime({ offset: true }),
          updatedAt: z.iso.datetime({ offset: true })
        })
        .strict()
    ),
    data: z.array(
      z
        .object({
          datumId: z.uuid(),
          runId: z.uuid(),
          activationId: z.string(),
          attemptOrdinal: z.number().int().positive(),
          name: z.string(),
          kind: z.enum(["value", "artifact", "external_reference", "observation", "secret_capability"]),
          payload: z.record(z.string(), jsonValueSchema),
          digest: z.string(),
          createdAt: z.iso.datetime({ offset: true })
        })
        .strict()
    ),
    events: z.array(
      z
        .object({
          runId: z.uuid(),
          sequence: z.number().int().positive(),
          transactionId: z.uuid(),
          eventType: z.string(),
          eventVersion: z.number().int().positive(),
          reducerVersion: z.string(),
          causationSequence: z.number().int().nullable(),
          correlationId: z.string().nullable(),
          activationId: z.string().nullable(),
          attemptOrdinal: z.number().int().positive().nullable(),
          payload: z.record(z.string(), jsonValueSchema),
          recordedAt: z.iso.datetime({ offset: true })
        })
        .strict()
    ),
    childLinks: z.array(
      z
        .object({
          parentRunId: z.uuid(),
          parentActivationId: z.string(),
          childRunId: z.uuid(),
          childPackageDigest: z.string(),
          interfaceDigest: z.string(),
          terminalStatus: z.enum(["succeeded", "failed"]).nullable(),
          result: z.record(z.string(), jsonValueSchema).nullable(),
          error: z.record(z.string(), jsonValueSchema).nullable(),
          completedAt: z.iso.datetime({ offset: true }).nullable(),
          createdAt: z.iso.datetime({ offset: true })
        })
        .strict()
    )
  })
  .strict()
const workflowSimulationStepSchema = z
  .object({
    stepId: z.string(),
    status: z.enum(["succeeded", "failed"]),
    input: z.record(z.string(), jsonValueSchema),
    output: z.record(z.string(), jsonValueSchema),
    error: z.record(z.string(), jsonValueSchema).nullable()
  })
  .strict()
const workflowSimulationSchema = z
  .object({
    schemaVersion: z.literal("1"),
    mode: z.enum(["draft", "run_to_here"]),
    simulated: z.literal(true),
    draftRevision: z.number().int().positive(),
    fixtureId: z.string().nullable(),
    elapsedMs: z.number().nonnegative(),
    steps: z.array(workflowSimulationStepSchema)
  })
  .strict()
const workflowPortDefinitionSchema = z
  .object({
    name: z.string(),
    label: z.string(),
    schema: jsonValueSchema,
    cardinality: z.enum(["one", "optional", "many"])
  })
  .strict()
const workflowStepDefinitionSchema = z
  .object({
    kind: z.string(),
    version: z.number().int().positive(),
    phase: z.number().int(),
    category: z.enum(["trigger", "data", "ai", "action", "logic", "terminal"]),
    label: z.string(),
    description: z.string(),
    executionClass: z.enum(["control", "provider", "model", "workspace"]),
    simulationPolicy: z.enum(["deterministic", "fixture", "read_only", "blocked"]),
    mutationPolicy: z.enum(["none", "external_effect"]),
    capabilities: z.array(z.string()),
    configSchema: jsonValueSchema,
    inputs: z.array(workflowPortDefinitionSchema),
    outputs: z.array(workflowPortDefinitionSchema),
    errorSchema: jsonValueSchema,
    executorDigest: z.string()
  })
  .strict()
const workflowStepCatalogSchema = z
  .object({ schemaVersion: z.literal("1"), definitions: z.array(workflowStepDefinitionSchema) })
  .strict()
const repositoryAgentReferenceSchema = z
  .object({
    connectionId: z.uuid(),
    repositoryId: z.string(),
    repositoryName: z.string(),
    ref: z.string(),
    path: z.string(),
    observedCommitSha: z.string(),
    blobSha: z.string(),
    contentDigest: z.string(),
    sourceUrl: z.url(),
    name: z.string(),
    description: z.string(),
    requestedModel: z.string().optional(),
    requestedTools: z.array(z.string())
  })
  .strict()
const repositoryAgentCatalogSchema = z
  .object({ schemaVersion: z.literal("1"), agents: z.array(repositoryAgentReferenceSchema) })
  .strict()
const workflowModelSnapshotSchema = z
  .object({
    modelId: z.string(),
    name: z.string(),
    contextLength: z.number().int().positive(),
    pricing: z.object({ prompt: z.string(), completion: z.string() }).strict(),
    architecture: z.object({ inputModalities: z.array(z.string()), outputModalities: z.array(z.string()) }).strict(),
    supportedParameters: z.array(z.string()),
    observedAt: z.iso.datetime({ offset: true })
  })
  .strict()
const workflowModelCatalogSchema = z
  .object({ schemaVersion: z.literal("1"), models: z.array(workflowModelSnapshotSchema) })
  .strict()
const providerOperationSchema = z
  .object({
    operation: z.string(),
    provider: z.enum(["github", "linear"]),
    mode: z.enum(["read", "write"]),
    resourceType: z.enum(["repository", "team"]),
    capability: integrationResourceCapabilitySchema,
    label: z.string()
  })
  .strict()
const providerOperationCatalogSchema = z
  .object({ schemaVersion: z.literal("1"), operations: z.array(providerOperationSchema) })
  .strict()
const publishedWorkflowScheduleSchema = z
  .object({
    workflowId: z.uuid(),
    version: z.number().int().positive(),
    nodeId: z.string(),
    label: z.string(),
    intervalSeconds: z.number().int().min(10)
  })
  .strict()

export type WorkflowRun = z.infer<typeof workflowRunSchema>
export type LinearTask = z.infer<typeof linearTaskSchema>
export type ControlPlaneSnapshot = z.infer<typeof snapshotSchema>
export type WorkflowEvent = z.infer<typeof workflowEventSchema>
export type WorkflowRunDetail = z.infer<typeof runDetailSchema>
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>
export type IntegrationConnection = z.infer<typeof integrationConnectionSchema>
export type IntegrationSettings = z.infer<typeof integrationSettingsSchema>
export type IntegrationResourceCapability = z.infer<typeof integrationResourceCapabilitySchema>
export type IntegrationResourceInventory = z.infer<typeof integrationResourceInventorySchema>
export type WorkflowStep = z.infer<typeof workflowStepSchema>
export type WorkflowDraftContent = z.infer<typeof workflowDraftContentSchema>
export type WorkflowSummary = z.infer<typeof workflowSummarySchema>
export type WorkflowDraftView = z.infer<typeof workflowDraftViewSchema>
export type WorkflowValidation = z.infer<typeof workflowValidationSchema>
export type PublishedWorkflowSchedule = z.infer<typeof publishedWorkflowScheduleSchema>
export type WorkflowSimulation = z.infer<typeof workflowSimulationSchema>
export type JournalWorkflowRunDetail = z.infer<typeof journalWorkflowRunDetailSchema>
export type WorkflowStepDefinition = z.infer<typeof workflowStepDefinitionSchema>
export type RepositoryAgentReference = z.infer<typeof repositoryAgentReferenceSchema>
export type WorkflowModelSnapshot = z.infer<typeof workflowModelSnapshotSchema>
export type ProviderOperation = z.infer<typeof providerOperationSchema>

export function parseRepositoryAgentReference(value: JsonValue | undefined): RepositoryAgentReference | undefined {
  const result = repositoryAgentReferenceSchema.safeParse(value)
  return result.success ? result.data : undefined
}

async function requestJson<Output>(path: string, schema: z.ZodType<Output>, init?: RequestInit): Promise<Output> {
  let response: Response
  try {
    response = await fetch(`${env.VITE_API_BASE_URL}${path}`, init)
  } catch {
    throw new Error(`Unable to reach the Agency API at ${env.VITE_API_BASE_URL}`)
  }
  const body: unknown = await response.json()
  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(body)
    throw new Error(parsedError.success ? parsedError.data.error : `Request failed with status ${response.status}`)
  }
  return schema.parse(body)
}

export function getControlPlaneSnapshot(): Promise<ControlPlaneSnapshot> {
  return requestJson("/api/control-plane", snapshotSchema)
}

export function assignWorkItem(workItemId: string, agentId: string) {
  return requestJson("/api/control-plane/assign", assignmentResponseSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workItemId, agentId })
  })
}

export function getWorkflowRunDetail(runId: string): Promise<WorkflowRunDetail> {
  return requestJson(`/api/control-plane/runs/${encodeURIComponent(runId)}`, runDetailSchema)
}

export function getJournalWorkflowRunDetail(runId: string): Promise<JournalWorkflowRunDetail> {
  return requestJson(`/api/workflow-runs/${encodeURIComponent(runId)}`, journalWorkflowRunDetailSchema)
}

export function cancelJournalWorkflowRun(runId: string, reason = "Cancelled by operator") {
  return requestJson(
    `/api/workflow-runs/${encodeURIComponent(runId)}/cancel`,
    z.object({ schemaVersion: z.literal("1"), run: journalWorkflowRunDetailSchema.shape.run }).strict(),
    jsonRequest("POST", { reason })
  )
}

export function retryJournalWorkflowActivation(runId: string, activationId: string) {
  return requestJson(
    `/api/workflow-runs/${encodeURIComponent(runId)}/activations/${encodeURIComponent(activationId)}/retry`,
    z
      .object({ schemaVersion: z.literal("1"), activation: journalWorkflowRunDetailSchema.shape.activations.element })
      .strict(),
    jsonRequest("POST", {})
  )
}

export function retryJournalWorkflowFromHere(runId: string, activationId: string) {
  return requestJson(
    `/api/workflow-runs/${encodeURIComponent(runId)}/activations/${encodeURIComponent(activationId)}/retry-from-here`,
    z
      .object({
        schemaVersion: z.literal("1"),
        activation: journalWorkflowRunDetailSchema.shape.activations.element,
        affectedDescendantIds: z.array(z.string())
      })
      .strict(),
    jsonRequest("POST", {})
  )
}

export function resumeJournalWorkflowRun(runId: string, correlationKey: string, event: Record<string, JsonValue>) {
  return requestJson(
    `/api/workflow-runs/${encodeURIComponent(runId)}/resume`,
    z
      .object({ schemaVersion: z.literal("1"), resumed: journalWorkflowRunDetailSchema.shape.waits.element.nullable() })
      .strict(),
    jsonRequest("POST", { correlationKey, event })
  )
}

export function runJournalWorkflowAgain(runId: string, input: Record<string, JsonValue>) {
  return requestJson(
    `/api/workflow-runs/${encodeURIComponent(runId)}/run-again`,
    z
      .object({
        schemaVersion: z.literal("1"),
        runId: z.uuid(),
        created: z.boolean(),
        version: z.number().int().positive()
      })
      .strict(),
    jsonRequest("POST", { input })
  )
}

export function resolveJournalWorkflowEffect(
  runId: string,
  effectId: string,
  input: { outcome: "occurred" | "absent" | "indeterminate"; reason: string; result?: Record<string, JsonValue> }
) {
  return requestJson(
    `/api/workflow-runs/${encodeURIComponent(runId)}/effects/${encodeURIComponent(effectId)}/resolve`,
    z.object({ schemaVersion: z.literal("1"), effect: journalWorkflowRunDetailSchema.shape.effects.element }).strict(),
    jsonRequest("POST", input)
  )
}

function jsonRequest(method: "PATCH" | "POST" | "PUT", body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
}

export function getIntegrationSettings(): Promise<IntegrationSettings> {
  return requestJson("/api/integrations", integrationSettingsSchema)
}

export function getIntegrationResourceInventory(
  capability?: IntegrationResourceCapability
): Promise<IntegrationResourceInventory> {
  const query = capability === undefined ? "" : `?capability=${encodeURIComponent(capability)}`
  return requestJson(`/api/integrations/resources${query}`, integrationResourceInventorySchema)
}

export function startIntegrationAuthorization(provider: IntegrationProvider) {
  return requestJson("/api/integrations/authorize", authorizationSessionSchema, jsonRequest("POST", { provider }))
}

export function completeIntegrationAuthorization(
  provider: IntegrationProvider,
  providerConfigKey: string,
  nangoConnectionId: string
) {
  return requestJson(
    "/api/integrations/complete",
    integrationConnectionSchema,
    jsonRequest("POST", { provider, providerConfigKey, nangoConnectionId })
  )
}

export function startIntegrationReconnect(connectionId: string) {
  return requestJson("/api/integrations/reconnect", authorizationSessionSchema, jsonRequest("POST", { connectionId }))
}

export function refreshIntegrationConnection(connectionId: string) {
  return requestJson(
    `/api/integrations/connections/${encodeURIComponent(connectionId)}`,
    integrationConnectionSchema,
    jsonRequest("POST", {})
  )
}

export function disconnectIntegration(connectionId: string) {
  return requestJson(`/api/integrations/connections/${encodeURIComponent(connectionId)}`, integrationConnectionSchema, {
    method: "DELETE"
  })
}

export function reconcileIntegrations() {
  return requestJson(
    "/api/integrations/reconcile",
    z.object({ checked: z.number(), connected: z.number(), degraded: z.number(), disconnected: z.number() }),
    jsonRequest("POST", {})
  )
}

export function listWorkflows(): Promise<WorkflowSummary[]> {
  return requestJson("/api/workflows", z.array(workflowSummarySchema))
}

export function listPublishedWorkflowSchedules(): Promise<PublishedWorkflowSchedule[]> {
  return requestJson("/api/workflows/schedules", z.array(publishedWorkflowScheduleSchema))
}

export function listWorkflowStepDefinitions(): Promise<WorkflowStepDefinition[]> {
  return requestJson("/api/workflows/steps", workflowStepCatalogSchema).then(({ definitions }) => definitions)
}

export function listWorkflowModels(): Promise<WorkflowModelSnapshot[]> {
  return requestJson("/api/workflows/models", workflowModelCatalogSchema).then(({ models }) => models)
}

export function listProviderOperations(): Promise<ProviderOperation[]> {
  return requestJson("/api/workflows/provider-operations", providerOperationCatalogSchema).then(
    ({ operations }) => operations
  )
}

export function discoverRepositoryAgents(input: {
  connectionId: string
  repositoryId: string
  repositoryName: string
  ref?: string
}): Promise<RepositoryAgentReference[]> {
  return requestJson(
    "/api/workflows/repository-agents/discover",
    repositoryAgentCatalogSchema,
    jsonRequest("POST", input)
  ).then(({ agents }) => agents)
}

export function createWorkflow(
  name: string,
  repository: WorkflowDraftContent["resourceBindings"][string],
  description = ""
) {
  return requestJson("/api/workflows", workflowDraftViewSchema, jsonRequest("POST", { name, description, repository }))
}

export function getWorkflowDraft(workflowId: string): Promise<WorkflowDraftView> {
  return requestJson(`/api/workflows/${encodeURIComponent(workflowId)}/draft`, workflowDraftViewSchema)
}

export function updateWorkflowDraft(
  workflowId: string,
  expectedRevision: number,
  name: string,
  description: string,
  content: WorkflowDraftContent
) {
  return requestJson(
    `/api/workflows/${encodeURIComponent(workflowId)}/draft`,
    workflowDraftViewSchema,
    jsonRequest("PATCH", { expectedRevision, name, description, content })
  )
}

export function validateWorkflow(workflowId: string): Promise<WorkflowValidation> {
  return requestJson(
    `/api/workflows/${encodeURIComponent(workflowId)}/validate`,
    workflowValidationSchema,
    jsonRequest("POST", {})
  )
}

export function publishWorkflow(workflowId: string) {
  return requestJson(
    `/api/workflows/${encodeURIComponent(workflowId)}/publish`,
    workflowDraftViewSchema,
    jsonRequest("POST", {})
  )
}

export function startWorkflowRun(
  workflowId: string,
  trigger: { type: "manual" | "schedule" | "webhook"; key: string; stepId?: string },
  input: JsonValue = {}
) {
  return requestJson(
    `/api/workflows/${encodeURIComponent(workflowId)}/runs`,
    workflowRunStartSchema,
    jsonRequest("POST", { trigger, input })
  )
}

export function testWorkflowDraft(
  workflowId: string,
  options: { input?: JsonValue; fixtureId?: string; stopAtStepId?: string } = {}
): Promise<WorkflowSimulation> {
  return requestJson(
    `/api/workflows/${encodeURIComponent(workflowId)}/test`,
    workflowSimulationSchema,
    jsonRequest("POST", options)
  )
}

export function langSmithTraceUrl(event: WorkflowEvent): string | null {
  const trace = traceReference(event)
  if (!trace.success || env.VITE_LANGSMITH_WORKSPACE_ID === undefined || env.VITE_LANGSMITH_PROJECT_ID === undefined) {
    return null
  }
  const baseUrl = env.VITE_LANGSMITH_BASE_URL.replace(/\/$/u, "")
  return `${baseUrl}/o/${encodeURIComponent(env.VITE_LANGSMITH_WORKSPACE_ID)}/projects/p/${encodeURIComponent(env.VITE_LANGSMITH_PROJECT_ID)}?peek=${encodeURIComponent(trace.data.runId)}`
}

export function traceReference(event: WorkflowEvent) {
  return traceReferenceSchema.safeParse(z.object({ trace: z.unknown() }).safeParse(event.details).data?.trace)
}
