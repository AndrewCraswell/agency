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
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    state: z
      .object({ id: z.uuid(), name: z.string(), type: z.enum(["triage", "backlog", "unstarted", "started"]) })
      .strict(),
    team: z.object({ id: z.uuid(), key: z.string(), name: z.string() }).strict(),
    project: z.object({ id: z.uuid(), name: z.string() }).strict().nullable(),
    blockedBy: z.array(linearTaskReferenceSchema),
    blocks: z.array(linearTaskReferenceSchema)
  })
  .strict()

const agentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    role: z.enum(["scrum_master", "engineer", "reviewer"]),
    description: z.string()
  })
  .strict()

const controlPlaneRunSnapshotSchema = z
  .object({
    schemaVersion: z.literal("1"),
    fetchedAt: z.iso.datetime({ offset: true }),
    agents: z.array(agentSchema),
    runs: z.array(workflowRunSchema)
  })
  .strict()
const workItemQueueStatusSchema = z.enum(["todo", "in_progress", "blocked"])
const workItemFacetSchema = z.object({ value: z.string(), count: z.number().int().nonnegative() }).strict()
const workItemQueryResponseSchema = z
  .object({
    schemaVersion: z.literal("1"),
    fetchedAt: z.iso.datetime({ offset: true }),
    items: z.array(
      z
        .object({ task: linearTaskSchema, run: workflowRunSchema.nullable(), status: workItemQueueStatusSchema })
        .strict()
    ),
    total: z.number().int().nonnegative(),
    previousCursor: z.string().nullable(),
    nextCursor: z.string().nullable(),
    aggregates: z
      .object({
        all: z.number().int().nonnegative(),
        todo: z.number().int().nonnegative(),
        inProgress: z.number().int().nonnegative(),
        blocked: z.number().int().nonnegative(),
        repositories: z.array(workItemFacetSchema),
        assignees: z.array(workItemFacetSchema),
        priorities: z.array(z.object({ value: z.number().int(), count: z.number().int().nonnegative() }).strict())
      })
      .strict()
  })
  .strict()

const assignmentResponseSchema = z
  .object({ schemaVersion: z.literal("1"), created: z.boolean(), run: workflowRunSchema })
  .strict()

const apiErrorSchema = z
  .object({
    error: z.string(),
    fieldErrors: z.array(z.object({ field: z.string(), message: z.string() }).strict()).optional()
  })
  .strict()

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
    providerAccount: z.string().nullable(),
    status: z.enum(["connected", "degraded", "disconnected"]),
    lastSuccessfulSyncAt: z.iso.datetime({ offset: true }).nullable(),
    latestError: z.string().nullable(),
    lastCheckedAt: z.iso.datetime({ offset: true }).nullable(),
    resourceCounts: z
      .object({
        total: z.number().int().nonnegative(),
        active: z.number().int().nonnegative(),
        stale: z.number().int().nonnegative()
      })
      .strict(),
    capabilities: z.array(integrationResourceCapabilitySchema),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    resources: z.array(integrationResourceSchema)
  })
  .strict()
  .transform((connection) => ({
    ...connection,
    displayName: connection.providerAccount,
    errorCode: connection.latestError
  }))
const integrationDisconnectImpactSchema = z
  .object({
    connectionId: z.uuid(),
    affectedWorkflowCount: z.number().int().nonnegative(),
    workflows: z.array(
      z
        .object({
          workflowId: z.uuid(),
          name: z.string(),
          usesDraft: z.boolean(),
          usesPublishedVersion: z.boolean()
        })
        .strict()
    )
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
const integrationProviderEventSchema = z
  .object({
    provider: integrationProviderSchema,
    resourceType: z.enum(["repository", "team"]),
    eventKey: z.string(),
    label: z.string()
  })
  .strict()
const integrationProviderEventCatalogSchema = z
  .object({ schemaVersion: z.literal("2"), events: z.array(integrationProviderEventSchema) })
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
const workflowDraftContentSchema = z
  .object({
    schemaVersion: z.literal("2"),
    inputSchema: jsonValueSchema,
    outputSchema: jsonValueSchema,
    steps: z.array(workflowStepSchema),
    connections: z.array(workflowConnectionSchema),
    constants: z.record(z.string(), jsonValueSchema),
    resourceBindings: z.record(z.string(), workflowResourceBindingSchema)
  })
  .strict()
const workflowSummarySchema = z
  .object({
    workflowId: z.uuid(),
    name: z.string(),
    description: z.string(),
    status: z.enum(["draft", "archived"]),
    draftRevision: z.number().int(),
    activePublishedVersion: z.number().int().nullable(),
    triggers: z.array(
      z.object({ kind: z.enum(["manual", "webhook", "schedule"]), label: z.string(), enabled: z.boolean() }).strict()
    ),
    updatedAt: z.iso.datetime({ offset: true })
  })
  .strict()
const workflowDraftViewSchema = z
  .object({
    schemaVersion: z.literal("3"),
    workflowId: z.uuid(),
    name: z.string(),
    description: z.string(),
    status: z.enum(["draft", "archived"]),
    draftRevision: z.number().int(),
    activePublishedVersion: z.number().int().nullable(),
    content: workflowDraftContentSchema,
    versions: z.array(
      z.object({ version: z.number().int(), contentDigest: z.string(), publishedAt: z.iso.datetime({ offset: true }) })
    ),
    updatedAt: z.iso.datetime({ offset: true })
  })
  .strict()
const workflowValidationSchema = z
  .object({
    schemaVersion: z.literal("1"),
    draftRevision: z.number().int().positive(),
    valid: z.boolean(),
    issues: z.array(
      z
        .object({
          code: z.string(),
          message: z.string(),
          nodeId: z.string().nullable(),
          connectionId: z.string().nullable(),
          field: z.string().nullable()
        })
        .strict()
    )
  })
  .strict()
const workflowRunStartSchema = z
  .object({
    runId: z.uuid(),
    created: z.boolean(),
    source: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("published"), version: z.number().int().positive() }).strict(),
      z.object({ kind: z.literal("draft_test"), draftRevision: z.number().int().positive() }).strict()
    ])
  })
  .strict()
const activationScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("branch"), key: z.string() }).strict(),
  z.object({ kind: z.literal("loop"), key: z.string(), iteration: z.number().int().nonnegative() }).strict(),
  z.object({ kind: z.literal("item"), key: z.string() }).strict()
])
const workflowRunDetailSchema = z
  .object({
    schemaVersion: z.literal("2"),
    summary: z
      .object({
        outcome: z.enum([
          "preparing",
          "runnable",
          "running",
          "waiting",
          "succeeded",
          "failed",
          "cancelled",
          "abandoned"
        ]),
        currentStep: z.object({ stepId: z.string(), label: z.string() }).strict().nullable(),
        failure: z
          .object({
            stepId: z.string(),
            stepLabel: z.string(),
            cause: z.string(),
            downstreamEffect: z.string(),
            occurredAt: z.iso.datetime({ offset: true }).nullable(),
            recommendedAction: z.string()
          })
          .strict()
          .nullable(),
        actions: z.array(
          z
            .object({
              key: z.enum(["cancel", "retry_step", "retry_from_here", "resume", "run_again", "resolve_effect"]),
              label: z.string(),
              targetId: z.string().nullable(),
              allowed: z.boolean(),
              disabledReason: z.string().nullable(),
              targetLabel: z.string(),
              consequence: z.string(),
              approvalRequirement: z.enum(["none", "confirmation", "required"]),
              requiredCapability: z.string().nullable()
            })
            .strict()
        )
      })
      .strict(),
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
        sourceKind: z.enum(["published", "draft_test"]),
        workflowVersion: z.number().int().positive().nullable(),
        draftRevision: z.number().int().positive().nullable(),
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
    mutationPolicy: z.enum(["none", "external_effect"]),
    capabilities: z.array(z.string()),
    configSchema: jsonValueSchema,
    inputs: z.array(workflowPortDefinitionSchema),
    outputs: z.array(workflowPortDefinitionSchema),
    errorSchema: jsonValueSchema,
    ui: z
      .object({
        fields: z.array(
          z
            .object({
              key: z.string(),
              label: z.string(),
              description: z.string(),
              control: z.enum(["text", "multiline", "number", "boolean", "select", "object_rows", "json"]),
              group: z.enum(["basic", "advanced"]),
              required: z.boolean(),
              secret: z.boolean(),
              immutable: z.boolean(),
              minimum: z.number().optional(),
              maximum: z.number().optional(),
              options: z.array(z.string()).optional()
            })
            .strict()
        )
      })
      .strict(),
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
const workflowGeneratedSchemaSchema = z.object({ schemaVersion: z.literal("1"), schema: jsonValueSchema }).strict()
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
const workflowScheduleSchema = z
  .object({
    scheduleId: z.uuid(),
    workflowId: z.uuid(),
    workflowVersion: z.number().int().positive(),
    triggerNodeId: z.string(),
    label: z.string(),
    enabled: z.boolean(),
    intervalSeconds: z.number().int().min(10).nullable(),
    scheduleExpression: z.string().nullable(),
    timezone: z.string(),
    nextRunAt: z.iso.datetime({ offset: true }),
    lastAttemptedAt: z.iso.datetime({ offset: true }).nullable(),
    lastSuccessfulAt: z.iso.datetime({ offset: true }).nullable(),
    health: z.enum(["disabled", "scheduled", "running", "retrying"]),
    latestError: z.string().nullable(),
    revision: z.number().int().positive()
  })
  .strict()

export type WorkflowRun = z.infer<typeof workflowRunSchema>
export type ControlPlaneRunSnapshot = z.infer<typeof controlPlaneRunSnapshotSchema>
export type WorkItemQueueStatus = z.infer<typeof workItemQueueStatusSchema>
export type WorkItemQueryResponse = z.infer<typeof workItemQueryResponseSchema>
export type WorkItemQuery = {
  q?: string
  status?: WorkItemQueueStatus
  repository?: string
  assignee?: string
  priority?: number
  age?: "day" | "week" | "month"
  sort?: "priority" | "created" | "updated" | "identifier"
  direction?: "asc" | "desc"
  cursor?: string
  pageSize?: number
}
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>
export type IntegrationConnection = z.input<typeof integrationConnectionSchema> & {
  displayName?: string | null
  errorCode?: string | null
}
export type IntegrationSettings = Omit<z.input<typeof integrationSettingsSchema>, "connections"> & {
  connections: IntegrationConnection[]
}
export type IntegrationDisconnectImpact = z.infer<typeof integrationDisconnectImpactSchema>
export type IntegrationResourceCapability = z.infer<typeof integrationResourceCapabilitySchema>
export type IntegrationResourceInventory = z.infer<typeof integrationResourceInventorySchema>
export type IntegrationProviderEvent = z.infer<typeof integrationProviderEventSchema>
export type WorkflowStep = z.infer<typeof workflowStepSchema>
export type WorkflowDraftContent = z.infer<typeof workflowDraftContentSchema>
export type WorkflowSummary = z.infer<typeof workflowSummarySchema>
export type WorkflowDraftView = z.infer<typeof workflowDraftViewSchema>
export type WorkflowValidation = z.infer<typeof workflowValidationSchema>
export type WorkflowSchedule = z.infer<typeof workflowScheduleSchema>
export type PublishedWorkflowSchedule = {
  workflowId: string
  version: number
  nodeId: string
  label: string
  intervalSeconds: number
}
export type WorkflowRunDetail = z.infer<typeof workflowRunDetailSchema>
export type WorkflowStepDefinition = z.infer<typeof workflowStepDefinitionSchema>
export type RepositoryAgentReference = z.infer<typeof repositoryAgentReferenceSchema>
export type WorkflowModelSnapshot = z.infer<typeof workflowModelSnapshotSchema>
export type ProviderOperation = z.infer<typeof providerOperationSchema>
export type WorkflowResourceBinding = WorkflowDraftContent["resourceBindings"][string]
export type CreateWorkflowRequest =
  | {
      template: "blank"
      name: string
      description: string
      repository: WorkflowResourceBinding
    }
  | {
      template: "agency_delivery"
      name: string
      description: string
      repository: WorkflowResourceBinding
      linearTeam: WorkflowResourceBinding
      modelId: string
    }

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: ReadonlyArray<{ field: string; message: string }> = []
  ) {
    super(message)
    this.name = "ApiRequestError"
  }
}

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
    if (parsedError.success) {
      throw new ApiRequestError(parsedError.data.error, parsedError.data.fieldErrors)
    }
    throw new ApiRequestError(`Request failed with status ${response.status}`)
  }
  return schema.parse(body)
}

export function getControlPlaneRunSnapshot(): Promise<ControlPlaneRunSnapshot> {
  return requestJson("/api/control-plane/runs", controlPlaneRunSnapshotSchema)
}

export function queryWorkItems(query: WorkItemQuery): Promise<WorkItemQueryResponse> {
  const parameters = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      parameters.set(key, String(value))
    }
  }
  const suffix = parameters.size === 0 ? "" : `?${parameters.toString()}`
  return requestJson(`/api/control-plane/work-items${suffix}`, workItemQueryResponseSchema)
}

export function assignWorkItem(workItemId: string, agentId: string) {
  return requestJson("/api/control-plane/assign", assignmentResponseSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workItemId, agentId })
  })
}

export function getWorkflowRunDetail(runId: string): Promise<WorkflowRunDetail> {
  return requestJson(`/api/workflow-runs/${encodeURIComponent(runId)}`, workflowRunDetailSchema)
}

export function cancelJournalWorkflowRun(runId: string, reason = "Cancelled by operator") {
  return requestJson(
    `/api/workflow-runs/${encodeURIComponent(runId)}/cancel`,
    z.object({ schemaVersion: z.literal("1"), run: workflowRunDetailSchema.shape.run }).strict(),
    jsonRequest("POST", { reason })
  )
}

export function retryJournalWorkflowActivation(runId: string, activationId: string) {
  return requestJson(
    `/api/workflow-runs/${encodeURIComponent(runId)}/activations/${encodeURIComponent(activationId)}/retry`,
    z.object({ schemaVersion: z.literal("1"), activation: workflowRunDetailSchema.shape.activations.element }).strict(),
    jsonRequest("POST", {})
  )
}

export function retryJournalWorkflowFromHere(runId: string, activationId: string) {
  return requestJson(
    `/api/workflow-runs/${encodeURIComponent(runId)}/activations/${encodeURIComponent(activationId)}/retry-from-here`,
    z
      .object({
        schemaVersion: z.literal("1"),
        activation: workflowRunDetailSchema.shape.activations.element,
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
      .object({ schemaVersion: z.literal("1"), resumed: workflowRunDetailSchema.shape.waits.element.nullable() })
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
    z.object({ schemaVersion: z.literal("1"), effect: workflowRunDetailSchema.shape.effects.element }).strict(),
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

export function listIntegrationProviderEvents(): Promise<IntegrationProviderEvent[]> {
  return requestJson("/api/integrations/provider-events", integrationProviderEventCatalogSchema).then(
    ({ events }) => events
  )
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

export function getIntegrationDisconnectImpact(connectionId: string): Promise<IntegrationDisconnectImpact> {
  return requestJson(
    `/api/integrations/connections/${encodeURIComponent(connectionId)}/impact`,
    integrationDisconnectImpactSchema
  )
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

export function listWorkflowSchedules(): Promise<WorkflowSchedule[]> {
  return requestJson("/api/workflows/schedules", z.array(workflowScheduleSchema))
}

export function listPublishedWorkflowSchedules(): Promise<PublishedWorkflowSchedule[]> {
  return listWorkflowSchedules().then((schedules) =>
    schedules.flatMap((schedule) => {
      if (!schedule.enabled || schedule.intervalSeconds === null) {
        return []
      }
      return [
        {
          workflowId: schedule.workflowId,
          version: schedule.workflowVersion,
          nodeId: schedule.triggerNodeId,
          label: schedule.label,
          intervalSeconds: schedule.intervalSeconds
        }
      ]
    })
  )
}

export function listWorkflowStepDefinitions(): Promise<WorkflowStepDefinition[]> {
  return requestJson("/api/workflows/steps", workflowStepCatalogSchema).then(({ definitions }) => definitions)
}

export function listWorkflowModels(): Promise<WorkflowModelSnapshot[]> {
  return requestJson("/api/workflows/models", workflowModelCatalogSchema).then(({ models }) => models)
}

export function generateWorkflowSchema(input: { modelId: string; prompt: string }): Promise<JsonValue> {
  return requestJson("/api/workflows/generate-schema", workflowGeneratedSchemaSchema, {
    method: "POST",
    body: JSON.stringify(input)
  }).then(({ schema }) => schema)
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

export function createWorkflow(request: CreateWorkflowRequest) {
  return requestJson("/api/workflows", workflowDraftViewSchema, jsonRequest("POST", request))
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
  version: number,
  trigger: { type: "manual" | "schedule" | "webhook"; key: string; stepId?: string },
  input: JsonValue = {}
) {
  return requestJson(
    `/api/workflows/${encodeURIComponent(workflowId)}/runs`,
    workflowRunStartSchema,
    jsonRequest("POST", { version, trigger, input })
  )
}

export function testWorkflowDraft(
  workflowId: string,
  options: { expectedRevision: number; triggerStepId: string; input?: JsonValue }
) {
  return requestJson(
    `/api/workflows/${encodeURIComponent(workflowId)}/test`,
    workflowRunStartSchema,
    jsonRequest("POST", options)
  )
}
