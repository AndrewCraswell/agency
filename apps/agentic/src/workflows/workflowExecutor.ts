import { createHash } from "node:crypto"
import { z } from "zod"
import type {
  ExecutionPackageRecord,
  JournalRunRecord,
  WorkflowActivationRecord,
  WorkflowAttemptRecord
} from "../persistence/workflowJournalStore"
import type { ArtifactStorePort } from "../prototype/artifacts"
import { CompiledWorkflowGraphSchema } from "./compiler"
import type { WorkflowConnectionSchema, WorkflowStepInstance } from "./definition"
import {
  JsonValueSchema,
  WorkflowArtifactReferenceSchema,
  jsonValueDigest,
  type ActivationScopeSegment,
  type JsonValue
} from "./executionContracts"
import { validateJsonValue } from "./jsonSchema"
import { WorkflowModelExecutionError, type WorkflowModelExecutor } from "./modelExecutor"
import {
  WorkflowProviderExecutionError,
  type WorkflowProviderActionExecutor,
  type WorkflowProviderDataExecutor
} from "./providerExecutor"
import type { RepositoryAgentExecutor } from "./repositoryAgentExecutor"
import type { RepositoryDataExecutor } from "./repositoryDataExecutor"
import { getWorkflowStepDefinition } from "./stepRegistry"

const JsonObjectSchema = z.record(z.string(), JsonValueSchema)
type JsonObject = z.infer<typeof JsonObjectSchema>
type WorkflowConnection = z.infer<typeof WorkflowConnectionSchema>

export type WorkflowStepResult = {
  output: JsonObject
  terminalStatus: "succeeded" | "failed" | null
  error: JsonObject | null
  data: Array<{ name: string; kind: "artifact"; payload: JsonObject }>
  usage?: JsonObject
  evidence?: JsonObject
}

type StepExecutionContext = {
  activationId: string
  attemptOrdinal: number
  scope?: ActivationScopeSegment[]
  artifactStore?: ArtifactStorePort
}

const MAXIMUM_MARKDOWN_BYTES = 65_536
const MAXIMUM_COLLECTION_ITEMS = 1_000
const MAXIMUM_EXECUTOR_PHASE = 7

function readPath(value: JsonValue, path: string[]): JsonValue {
  let current = value
  for (const segment of path) {
    if (current === null || Array.isArray(current) || typeof current !== "object" || !(segment in current)) {
      throw new Error(`Mapping source path ${path.join(".")} is unavailable`)
    }
    current = current[segment] ?? null
  }
  return current
}

function writePath(target: JsonValue, path: string[], value: JsonValue): JsonValue {
  if (path.length === 0) return value
  if (target === null || Array.isArray(target) || typeof target !== "object") {
    throw new Error(`Mapping target path ${path.join(".")} requires an object`)
  }
  const [head, ...tail] = path
  if (head === undefined) return value
  const child = target[head]
  return { ...target, [head]: writePath(child === undefined ? {} : child, tail, value) }
}

function objectValue(value: JsonValue | undefined): JsonObject {
  return value === undefined ? {} : JsonObjectSchema.parse(value)
}

const DeterministicExpressionSchema = z
  .object({
    path: z.array(z.string()),
    operator: z.enum([
      "equals",
      "not_equals",
      "greater_than",
      "greater_than_or_equal",
      "less_than",
      "less_than_or_equal",
      "exists",
      "truthy"
    ]),
    value: JsonValueSchema.optional()
  })
  .strict()

function optionalPath(value: JsonValue, path: string[]): JsonValue | undefined {
  let current: JsonValue | undefined = value
  for (const segment of path) {
    if (current === undefined || current === null || Array.isArray(current) || typeof current !== "object")
      return undefined
    current = current[segment]
  }
  return current
}

function evaluateExpression(input: JsonObject, expressionInput: JsonValue | undefined): boolean {
  const expression = DeterministicExpressionSchema.parse(expressionInput)
  const actual = optionalPath(input, expression.path)
  if (expression.operator === "exists") return actual !== undefined
  if (expression.operator === "truthy") {
    if (typeof actual === "boolean") return actual
    if (typeof actual === "number") return actual !== 0
    if (typeof actual === "string") return actual.length > 0
    return actual !== undefined && actual !== null
  }
  if (expression.operator === "equals")
    return actual !== undefined && jsonValueDigest(actual) === jsonValueDigest(expression.value ?? null)
  if (expression.operator === "not_equals")
    return actual === undefined || jsonValueDigest(actual) !== jsonValueDigest(expression.value ?? null)
  if (typeof actual !== "number" || typeof expression.value !== "number") {
    throw new Error(`${expression.operator} requires numeric operands`)
  }
  if (expression.operator === "greater_than") return actual > expression.value
  if (expression.operator === "greater_than_or_equal") return actual >= expression.value
  if (expression.operator === "less_than") return actual < expression.value
  return actual <= expression.value
}

export function projectConnectionOutput(connection: WorkflowConnection, output: JsonObject): JsonObject {
  const sourceValue = output[connection.source.port]
  if (sourceValue === undefined) throw new Error(`Step did not produce port ${connection.source.port}`)
  let targetValue: JsonValue = {}
  for (const mapping of connection.mappings) {
    targetValue = writePath(targetValue, mapping.targetPath, readPath(sourceValue, mapping.sourcePath))
  }
  return { [connection.target.port]: targetValue }
}

function mappedFields(input: JsonObject, mappings: JsonObject): JsonObject {
  const result: JsonObject = {}
  for (const [target, source] of Object.entries(mappings)) {
    if (typeof source !== "string") throw new Error(`Mapping ${target} must contain a dot-separated source path`)
    result[target] = readPath(input, source.split(".").filter(Boolean))
  }
  return result
}

function resolveActivationInput(
  graph: z.infer<typeof CompiledWorkflowGraphSchema>,
  step: WorkflowStepInstance,
  storedInput: JsonObject
): JsonObject {
  const incoming = graph.connections
    .filter(
      (connection) =>
        connection.target.stepId === step.id &&
        connection.outcome === "success" &&
        Object.keys(storedInput).some((key) => key === connection.id || key.startsWith(`${connection.id}:`))
    )
    .sort((left, right) => left.id.localeCompare(right.id))
  if (incoming.length === 0) return storedInput
  const definition = getWorkflowStepDefinition(step.definition.kind, step.definition.version, MAXIMUM_EXECUTOR_PHASE)
  const resolved: JsonObject = {}
  for (const connection of incoming) {
    const port = definition.inputs.find(({ name }) => name === connection.target.port)
    if (port?.cardinality === "many") {
      const current = resolved[connection.target.port]
      const contributions = Object.entries(storedInput)
        .filter(([key]) => key === connection.id || key.startsWith(`${connection.id}:`))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, value]) => JsonObjectSchema.parse(value)[connection.target.port] ?? null)
      resolved[connection.target.port] = [...(Array.isArray(current) ? current : []), ...contributions]
    } else {
      const contribution = JsonObjectSchema.parse(storedInput[connection.id])
      Object.assign(resolved, contribution)
    }
  }
  return resolved
}

export function downstreamActivations(
  graph: z.infer<typeof CompiledWorkflowGraphSchema>,
  sourceStepId: string,
  output: JsonObject,
  sourceScope: ActivationScopeSegment[] = []
): Array<{
  stepId: string
  scope: ActivationScopeSegment[]
  inputBindings: JsonObject
  dependencyCount: number
  deferred?: boolean
}> {
  const outgoing = graph.connections.filter(
    (connection) => connection.source.stepId === sourceStepId && connection.outcome === "success"
  )
  const sourceStep = graph.steps.find(({ id }) => id === sourceStepId)
  const selectedBranch =
    sourceStep?.definition.kind === "switch"
      ? z.object({ key: z.string() }).passthrough().parse(output.branch).key
      : null
  if (sourceStep?.definition.kind === "for_each") {
    const config = z
      .object({
        maximumItems: z.number().int().min(1).max(MAXIMUM_COLLECTION_ITEMS),
        concurrency: z.number().int().min(1).max(MAXIMUM_COLLECTION_ITEMS),
        bodyStepId: z.string().trim().min(1),
        joinStepId: z.string().trim().min(1)
      })
      .strict()
      .parse(sourceStep.config)
    const items = z.array(JsonObjectSchema).max(config.maximumItems).parse(output.item)
    const bodyConnections = outgoing.filter(({ target }) => target.stepId === config.bodyStepId)
    const itemActivations = items.flatMap((item, index) => {
      const inputBindings: JsonObject = {}
      for (const connection of bodyConnections) {
        inputBindings[connection.id] = projectConnectionOutput(connection, { item })
      }
      if (Object.keys(inputBindings).length === 0) return []
      return [
        {
          stepId: config.bodyStepId,
          scope: [...sourceScope, { kind: "item" as const, key: `${sourceStep.id}:${String(index).padStart(6, "0")}` }],
          inputBindings,
          dependencyCount: 0,
          ...(index >= config.concurrency ? { deferred: true } : {})
        }
      ]
    })
    const join = graph.steps.find(({ id }) => id === config.joinStepId)
    if (join?.definition.kind !== "join") throw new Error(`For each ${sourceStep.id} has no valid join`)
    const joinConfig = z
      .object({ policy: z.enum(["all", "any", "quorum"]), quorum: z.number().int().min(1).optional() })
      .strict()
      .parse(join.config)
    let dependencyCount = items.length
    if (joinConfig.policy === "any") dependencyCount = Math.min(items.length, 1)
    if (joinConfig.policy === "quorum") dependencyCount = Math.min(items.length, joinConfig.quorum ?? 1)
    return [...itemActivations, { stepId: config.joinStepId, scope: sourceScope, inputBindings: {}, dependencyCount }]
  }
  const byTarget = new Map<string, JsonObject>()
  for (const connection of outgoing) {
    if (output[connection.source.port] === undefined) continue
    if (selectedBranch !== null && connection.branchKey !== selectedBranch) continue
    const current = byTarget.get(connection.target.stepId) ?? {}
    const owningForEach = graph.steps.find(
      (candidate) =>
        candidate.definition.kind === "for_each" && candidate.config.joinStepId === connection.target.stepId
    )
    const owningBranch = graph.steps.find(
      (candidate) =>
        (candidate.definition.kind === "condition" || candidate.definition.kind === "switch") &&
        candidate.config.joinStepId === connection.target.stepId
    )
    const itemScope = sourceScope.at(-1)
    const branchScope = sourceScope.at(-1)
    let bindingKey = connection.id
    if (owningForEach !== undefined && itemScope?.kind === "item") {
      bindingKey = `${connection.id}:${itemScope.key}`
    } else if (owningBranch !== undefined && branchScope?.kind === "branch") {
      bindingKey = `${connection.id}:${branchScope.key}`
    }
    current[bindingKey] = projectConnectionOutput(connection, output)
    byTarget.set(connection.target.stepId, current)
  }
  return [...byTarget.entries()].map(([stepId, inputBindings]) => {
    const incomingCount = graph.connections.filter(
      (connection) =>
        connection.target.stepId === stepId && connection.outcome === "success" && connection.loopBack !== true
    ).length
    const owningForEach = graph.steps.find(
      (candidate) => candidate.definition.kind === "for_each" && candidate.config.joinStepId === stepId
    )
    const owningBranch = graph.steps.find(
      (candidate) =>
        (candidate.definition.kind === "condition" || candidate.definition.kind === "switch") &&
        candidate.config.joinStepId === stepId
    )
    let scope = sourceScope
    if (sourceStep?.definition.kind === "condition") {
      const selectedPort = output.true === undefined ? "false" : "true"
      scope = [...scope, { kind: "branch", key: `${sourceStep.id}:${selectedPort}` }]
    }
    if (sourceStep?.definition.kind === "switch" && selectedBranch !== null) {
      scope = [...scope, { kind: "branch", key: `${sourceStep.id}:${selectedBranch}` }]
    }
    if (sourceStep?.definition.kind === "bounded_loop") {
      const currentLoop = sourceScope.at(-1)
      const iteration = currentLoop?.kind === "loop" && currentLoop.key === sourceStep.id ? currentLoop.iteration : 0
      if (output.iteration !== undefined && currentLoop?.kind !== "loop") {
        scope = [...scope, { kind: "loop", key: sourceStep.id, iteration }]
      }
      if (output.result !== undefined && currentLoop?.kind === "loop" && currentLoop.key === sourceStep.id)
        scope = scope.slice(0, -1)
    }
    const loopBack = outgoing.find(
      ({ target }) =>
        target.stepId === stepId && target.port === "state" && sourceStepId !== stepId && target.stepId === stepId
    )
    if (loopBack?.loopBack === true) {
      const currentLoop = sourceScope.at(-1)
      if (currentLoop?.kind !== "loop") throw new Error(`Loop-back ${loopBack.id} has no iteration scope`)
      scope = [
        ...sourceScope.slice(0, -1),
        { kind: "loop", key: currentLoop.key, iteration: currentLoop.iteration + 1 }
      ]
    }
    if (owningForEach !== undefined && sourceScope.at(-1)?.kind === "item") scope = sourceScope.slice(0, -1)
    if (owningBranch !== undefined && scope.at(-1)?.kind === "branch") scope = scope.slice(0, -1)
    const target = graph.steps.find(({ id }) => id === stepId)
    let dependencyCount = Math.max(0, incomingCount - Object.keys(inputBindings).length)
    if (loopBack?.loopBack === true) dependencyCount = 0
    if (target?.definition.kind === "exclusive_merge") dependencyCount = 0
    return {
      stepId,
      scope,
      inputBindings,
      dependencyCount
    }
  })
}

function templateValue(values: JsonObject, path: string): JsonValue {
  return readPath(values, path.split(".").filter(Boolean))
}

function renderMarkdown(template: string, values: JsonObject): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/gu, (_match, path: string) => {
    const value = templateValue(values, path)
    return typeof value === "string" ? value : JSON.stringify(value)
  })
}

function collectItems(step: WorkflowStepInstance, input: JsonObject): JsonValue {
  const items = z.array(JsonValueSchema).parse(input.items)
  const maximumItems = z
    .number()
    .int()
    .min(1)
    .max(MAXIMUM_COLLECTION_ITEMS)
    .parse(step.config.maximumItems ?? MAXIMUM_COLLECTION_ITEMS)
  if (items.length > maximumItems) throw new Error(`Collect received ${items.length} items; maximum is ${maximumItems}`)
  if (step.config.mode !== "keyed") return items
  const keyField = z.string().trim().min(1).parse(step.config.keyField)
  return Object.fromEntries(
    items.map((item) => {
      const object = JsonObjectSchema.parse(item)
      const key = object[keyField]
      if (typeof key !== "string" && typeof key !== "number") {
        throw new Error(`Collect item is missing scalar key field ${keyField}`)
      }
      return [String(key), item]
    })
  )
}

export async function executeWorkflowStep(
  step: WorkflowStepInstance,
  inputValue: unknown,
  context?: StepExecutionContext
): Promise<WorkflowStepResult> {
  const input = JsonObjectSchema.parse(inputValue)
  const definition = getWorkflowStepDefinition(step.definition.kind, step.definition.version, MAXIMUM_EXECUTOR_PHASE)
  const configIssues = validateJsonValue(definition.configSchema, step.config)
  if (configIssues.length > 0) {
    throw new Error(configIssues.map((issue) => `${issue.path}: ${issue.message}`).join(" "))
  }
  let result: WorkflowStepResult
  if (step.definition.kind === "manual_trigger") {
    result = { output: { input: input.input ?? {} }, terminalStatus: null, error: null, data: [] }
  } else if (step.definition.kind === "provider_event") {
    result = { output: { event: input.event ?? {} }, terminalStatus: null, error: null, data: [] }
  } else if (step.definition.kind === "schedule") {
    result = { output: { fire: input.fire ?? {} }, terminalStatus: null, error: null, data: [] }
  } else if (step.definition.kind === "set_fields") {
    result = {
      output: { value: { ...objectValue(input.input), ...objectValue(step.config.fields) } },
      terminalStatus: null,
      error: null,
      data: []
    }
  } else if (step.definition.kind === "map_fields") {
    result = {
      output: { value: mappedFields(objectValue(input.input), objectValue(step.config.mappings)) },
      terminalStatus: null,
      error: null,
      data: []
    }
  } else if (step.definition.kind === "validate") {
    const value = input.value ?? {}
    const issues = validateJsonValue(step.config.schema, value)
    if (issues.length > 0) {
      result = {
        output: {},
        terminalStatus: "failed",
        error: {
          code: "validation_failed",
          message: issues.map((issue) => `${issue.path}: ${issue.message}`).join(" ")
        },
        data: []
      }
    } else {
      result = { output: { value }, terminalStatus: null, error: null, data: [] }
    }
  } else if (step.definition.kind === "success") {
    result = { output: { result: objectValue(input.result) }, terminalStatus: "succeeded", error: null, data: [] }
  } else if (step.definition.kind === "failure") {
    result = {
      output: {},
      terminalStatus: "failed",
      error: {
        code: typeof step.config.code === "string" ? step.config.code : "workflow_failed",
        message: typeof step.config.message === "string" ? step.config.message : "Workflow failed",
        ...objectValue(input.error)
      },
      data: []
    }
  } else if (step.definition.kind === "compose_markdown") {
    if (context === undefined) throw new Error("Compose Markdown requires attempt provenance")
    const content = Buffer.from(renderMarkdown(z.string().parse(step.config.template), objectValue(input.values)))
    if (content.byteLength > MAXIMUM_MARKDOWN_BYTES) {
      throw new Error(`Markdown artifact exceeds ${MAXIMUM_MARKDOWN_BYTES} bytes`)
    }
    const sha256 = createHash("sha256").update(content).digest("hex")
    const artifactId = jsonValueDigest({
      activationId: context.activationId,
      attemptOrdinal: context.attemptOrdinal,
      name: "markdown",
      sha256
    })
    await context.artifactStore?.write(
      `workflow/${context.activationId}/${context.attemptOrdinal}/${artifactId}.md`,
      content,
      "text/markdown"
    )
    const reference = WorkflowArtifactReferenceSchema.parse({
      artifactId,
      kind: "markdown",
      mediaType: "text/markdown",
      sha256,
      byteLength: content.byteLength,
      producerActivationId: context.activationId,
      producerAttemptId: `${context.activationId}:${context.attemptOrdinal}`,
      classification: "internal"
    })
    result = {
      output: { markdown: reference },
      terminalStatus: null,
      error: null,
      data: [{ name: "markdown", kind: "artifact", payload: { ...reference } }]
    }
  } else if (step.definition.kind === "collect") {
    result = { output: { collection: collectItems(step, input) }, terminalStatus: null, error: null, data: [] }
  } else if (step.definition.kind === "condition") {
    const value = objectValue(input.input)
    const port = evaluateExpression(value, step.config.expression) ? "true" : "false"
    result = { output: { [port]: value }, terminalStatus: null, error: null, data: [] }
  } else if (step.definition.kind === "switch") {
    const value = objectValue(input.input)
    const config = z
      .object({
        cases: z
          .array(z.object({ key: z.string().trim().min(1), when: DeterministicExpressionSchema }).strict())
          .min(1),
        defaultKey: z.string().trim().min(1).optional(),
        joinStepId: z.string().trim().min(1)
      })
      .strict()
      .parse(step.config)
    const selected = config.cases.find(({ when }) => evaluateExpression(value, when))?.key ?? config.defaultKey
    if (selected === undefined) throw new Error("Switch matched no case and has no default branch")
    result = { output: { branch: { key: selected, value } }, terminalStatus: null, error: null, data: [] }
  } else if (step.definition.kind === "for_each") {
    const maximumItems = z.number().int().min(1).max(MAXIMUM_COLLECTION_ITEMS).parse(step.config.maximumItems)
    const items = z.array(JsonObjectSchema).max(maximumItems).parse(input.items)
    result = { output: { item: items }, terminalStatus: null, error: null, data: [] }
  } else if (step.definition.kind === "exclusive_merge") {
    const branches = z.array(JsonObjectSchema).length(1).parse(input.branches)
    result = { output: { value: branches[0]! }, terminalStatus: null, error: null, data: [] }
  } else if (step.definition.kind === "join") {
    const branches = z.array(JsonObjectSchema).parse(input.branches)
    result = { output: { results: branches }, terminalStatus: null, error: null, data: [] }
  } else if (step.definition.kind === "bounded_loop") {
    const config = z
      .object({
        maximumIterations: z.number().int().min(1).max(1000),
        maximumActivations: z.number().int().min(1).max(100_000),
        condition: DeterministicExpressionSchema,
        bodyStepId: z.string().trim().min(1),
        exitStepId: z.string().trim().min(1),
        onExhaustion: z.enum(["fail", "complete"])
      })
      .strict()
      .parse(step.config)
    const state = objectValue(input.state)
    const loopScope = context?.scope?.at(-1)
    const iteration = loopScope?.kind === "loop" && loopScope.key === step.id ? loopScope.iteration : 0
    if (!evaluateExpression(state, config.condition)) {
      result = { output: { result: state }, terminalStatus: null, error: null, data: [] }
    } else if (iteration >= config.maximumIterations) {
      result =
        config.onExhaustion === "complete"
          ? { output: { result: state }, terminalStatus: null, error: null, data: [] }
          : {
              output: {},
              terminalStatus: "failed",
              error: { code: "loop_exhausted", message: `Loop exhausted after ${config.maximumIterations} iterations` },
              data: []
            }
    } else {
      result = { output: { iteration: { state, index: iteration } }, terminalStatus: null, error: null, data: [] }
    }
  } else {
    throw new Error(`Workflow executor does not support ${step.definition.kind}`)
  }
  if (result.error === null) {
    const outputSchema = {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        definition.outputs.map((port) => [
          port.name,
          port.cardinality === "many" ? { type: "array", items: port.schema } : port.schema
        ])
      ),
      required: definition.outputs.filter(({ cardinality }) => cardinality === "one").map(({ name }) => name)
    }
    const outputIssues = validateJsonValue(outputSchema, result.output)
    if (outputIssues.length > 0) {
      throw new Error(outputIssues.map((issue) => `${issue.path}: ${issue.message}`).join(" "))
    }
  }
  return result
}

export type WorkflowJournal = {
  listReadyActivations(limit?: number): Promise<WorkflowActivationRecord[]>
  getRun(runId: string): Promise<JournalRunRecord | null>
  getExecutionPackage(packageDigest: string): Promise<Pick<ExecutionPackageRecord, "packageDigest" | "content"> | null>
  leaseActivation(input: {
    runId: string
    activationId: string
    leaseOwner: string
    leaseDurationMs: number
  }): Promise<WorkflowAttemptRecord>
  completeAttempt(input: {
    runId: string
    activationId: string
    ordinal: number
    leaseOwner: string
    fencingToken: number
    output: JsonObject
    data?: Array<{ name: string; kind: "artifact"; payload: JsonObject }>
    usage?: JsonObject
    evidence?: JsonObject
    downstream?: Array<{
      stepId: string
      scope?: ActivationScopeSegment[]
      inputBindings?: JsonObject
      dependencyCount?: number
      deferred?: boolean
    }>
    releases?: Array<{ stepId: string; scope: ActivationScopeSegment[] }>
    loopBudgets?: Array<{ key: string; maximumActivations: number }>
    checkpoint: { cursor: string; committed: boolean }
    terminalStatus?: "succeeded"
  }): Promise<void>
  failAttempt(input: {
    runId: string
    activationId: string
    ordinal: number
    leaseOwner: string
    fencingToken: number
    error: JsonObject
    terminalStatus?: "failed"
  }): Promise<void>
  suspendAttempt(input: {
    runId: string
    activationId: string
    ordinal: number
    leaseOwner: string
    fencingToken: number
    correlationKey: string
    acceptedInputSchema: JsonObject
    expiresAt: Date
  }): Promise<unknown>
  listExpiredWaits(limit?: number): Promise<Array<{ runId: string; correlationKey: string }>>
  timeoutWait(input: { runId: string; correlationKey: string }): Promise<unknown>
  invokeChildWorkflow(input: {
    parentRunId: string
    parentActivationId: string
    parentAttemptOrdinal: number
    leaseOwner: string
    fencingToken: number
    childPackageDigest: string
    interfaceDigest: string
    childInput: JsonObject
    childTriggerStepId: string
    childTriggerPort: string
  }): Promise<unknown>
  listChildRunLinks(limit?: number): Promise<
    Array<{
      parentRunId: string
      childRunId: string
      terminalStatus: "succeeded" | "failed" | null
    }>
  >
  getChildRunCompletion(childRunId: string): Promise<{
    status: "succeeded" | "failed"
    output: JsonObject
    error: JsonObject | null
  } | null>
  recordChildRunCompletion(input: {
    childRunId: string
    status: "succeeded" | "failed"
    output: JsonObject
    error: JsonObject | null
  }): Promise<unknown>
  resumeWait(input: { runId: string; correlationKey: string; event: JsonObject; outputPort?: string }): Promise<unknown>
  failWait(input: { runId: string; correlationKey: string; error: JsonObject }): Promise<unknown>
}

export class WorkflowDispatcher {
  readonly #journal: WorkflowJournal
  readonly #workerId: string
  readonly #artifactStoreForRun: ((runId: string) => ArtifactStorePort) | undefined
  readonly #repositoryAgentExecutor: RepositoryAgentExecutor | undefined
  readonly #repositoryDataExecutor: RepositoryDataExecutor | undefined
  readonly #modelExecutor: WorkflowModelExecutor | undefined
  readonly #providerDataExecutor: WorkflowProviderDataExecutor | undefined
  readonly #providerActionExecutor: WorkflowProviderActionExecutor | undefined
  readonly #now: () => Date

  constructor(
    journal: WorkflowJournal,
    workerId: string,
    artifactStoreForRun?: (runId: string) => ArtifactStorePort,
    repositoryAgentExecutor?: RepositoryAgentExecutor,
    repositoryDataExecutor?: RepositoryDataExecutor,
    modelExecutor?: WorkflowModelExecutor,
    providerDataExecutor?: WorkflowProviderDataExecutor,
    providerActionExecutor?: WorkflowProviderActionExecutor,
    now: () => Date = () => new Date()
  ) {
    this.#journal = journal
    this.#workerId = z.string().trim().min(1).parse(workerId)
    this.#artifactStoreForRun = artifactStoreForRun
    this.#repositoryAgentExecutor = repositoryAgentExecutor
    this.#repositoryDataExecutor = repositoryDataExecutor
    this.#modelExecutor = modelExecutor
    this.#providerDataExecutor = providerDataExecutor
    this.#providerActionExecutor = providerActionExecutor
    this.#now = now
  }

  async dispatchReady(limit = 25): Promise<number> {
    const childLinks = await this.#journal.listChildRunLinks(limit)
    for (const link of childLinks) {
      const completion =
        link.terminalStatus === null ? await this.#journal.getChildRunCompletion(link.childRunId) : null
      if (completion !== null) {
        await this.#journal.recordChildRunCompletion({ childRunId: link.childRunId, ...completion })
        if (completion.status === "succeeded") {
          const output = objectValue(completion.output.result)
          await this.#journal.resumeWait({
            runId: link.parentRunId,
            correlationKey: `child:${link.childRunId}`,
            event: output,
            outputPort: "output"
          })
        } else {
          await this.#journal.failWait({
            runId: link.parentRunId,
            correlationKey: `child:${link.childRunId}`,
            error: completion.error ?? {
              code: "child_workflow_failed",
              message: `Child workflow ${link.childRunId} failed`
            }
          })
        }
      }
    }
    const expiredWaits = await this.#journal.listExpiredWaits(limit)
    for (const wait of expiredWaits) {
      await this.#journal.timeoutWait({ runId: wait.runId, correlationKey: wait.correlationKey })
    }
    const activations = await this.#journal.listReadyActivations(limit)
    let completed = 0
    for (const activation of activations) {
      try {
        await this.#execute(activation)
        completed += 1
      } catch (error) {
        if (error instanceof Error && error.message.includes("not ready")) continue
        throw error
      }
    }
    return completed
  }

  async #execute(activation: WorkflowActivationRecord): Promise<void> {
    const run = await this.#journal.getRun(activation.runId)
    if (run === null) throw new Error(`Run ${activation.runId} is unavailable`)
    const executionPackage = await this.#journal.getExecutionPackage(run.packageDigest)
    if (executionPackage === null) throw new Error(`Execution package ${run.packageDigest} is unavailable`)
    const graph = CompiledWorkflowGraphSchema.parse(executionPackage.content.graph)
    const step = graph.steps.find(({ id }) => id === activation.stepId)
    if (step === undefined) throw new Error(`Step ${activation.stepId} is unavailable in the execution package`)
    const attempt = await this.#journal.leaseActivation({
      runId: activation.runId,
      activationId: activation.activationId,
      leaseOwner: this.#workerId,
      leaseDurationMs: 60_000
    })
    if (step.definition.kind === "wait") {
      const resolvedInput = resolveActivationInput(graph, step, attempt.input)
      const correlationTemplate = z.string().trim().min(1).parse(step.config.correlation)
      const correlationKey = renderMarkdown(correlationTemplate, objectValue(resolvedInput.context))
      const expiresAfterSeconds = z.number().int().min(1).parse(step.config.expiresAfterSeconds)
      const eventSchema = JsonObjectSchema.parse(step.config.eventSchema)
      await this.#journal.suspendAttempt({
        runId: activation.runId,
        activationId: activation.activationId,
        ordinal: attempt.ordinal,
        leaseOwner: this.#workerId,
        fencingToken: attempt.fencingToken,
        correlationKey,
        acceptedInputSchema: eventSchema,
        expiresAt: new Date(this.#now().getTime() + expiresAfterSeconds * 1000)
      })
      return
    }
    if (step.definition.kind === "child_workflow") {
      const resolvedInput = resolveActivationInput(graph, step, attempt.input)
      const childPackageDigest = z
        .string()
        .regex(/^[0-9a-f]{64}$/u)
        .parse(step.config.packageDigest)
      const interfaceDigest = z
        .string()
        .regex(/^[0-9a-f]{64}$/u)
        .parse(step.config.interfaceDigest)
      const childPackage = await this.#journal.getExecutionPackage(childPackageDigest)
      if (childPackage === null) throw new Error(`Child execution package ${childPackageDigest} is unavailable`)
      const childGraph = CompiledWorkflowGraphSchema.parse(childPackage.content.graph)
      const triggers = childGraph.steps.filter(({ definition }) => definition.kind === "manual_trigger")
      if (triggers.length !== 1 || triggers[0] === undefined) {
        throw new Error("Child workflow requires exactly one manual trigger")
      }
      await this.#journal.invokeChildWorkflow({
        parentRunId: activation.runId,
        parentActivationId: activation.activationId,
        parentAttemptOrdinal: attempt.ordinal,
        leaseOwner: this.#workerId,
        fencingToken: attempt.fencingToken,
        childPackageDigest,
        interfaceDigest,
        childInput: objectValue(resolvedInput.input),
        childTriggerStepId: triggers[0].id,
        childTriggerPort: "input"
      })
      return
    }
    let result: WorkflowStepResult
    try {
      const resolvedInput = resolveActivationInput(graph, step, attempt.input)
      if (step.definition.kind === "repository_agent") {
        if (this.#repositoryAgentExecutor === undefined) throw new Error("Repository agent execution is unavailable")
        result = {
          output: await this.#repositoryAgentExecutor({
            runId: activation.runId,
            activationId: activation.activationId,
            attemptOrdinal: attempt.ordinal,
            step,
            input: resolvedInput,
            snapshots: executionPackage.content.agentSnapshots
          }),
          terminalStatus: null,
          error: null,
          data: []
        }
      } else if (step.definition.kind === "repository_data") {
        if (this.#repositoryDataExecutor === undefined) throw new Error("Repository data execution is unavailable")
        result = {
          output: await this.#repositoryDataExecutor(step, resolvedInput),
          terminalStatus: null,
          error: null,
          data: []
        }
      } else if (step.definition.kind === "ai_model" || step.definition.kind === "structured_judgment") {
        if (this.#modelExecutor === undefined) throw new Error("Model execution is unavailable")
        const modelResult = await this.#modelExecutor({
          runId: activation.runId,
          activationId: activation.activationId,
          attemptOrdinal: attempt.ordinal,
          step,
          context: resolvedInput,
          snapshots: executionPackage.content.modelSnapshots
        })
        result = {
          output: modelResult.output,
          terminalStatus: null,
          error: null,
          data: modelResult.data,
          usage: modelResult.usage,
          evidence: modelResult.evidence
        }
      } else if (step.definition.kind === "provider_data") {
        if (this.#providerDataExecutor === undefined) throw new Error("Provider data execution is unavailable")
        result = {
          output: await this.#providerDataExecutor(step, resolvedInput),
          terminalStatus: null,
          error: null,
          data: []
        }
      } else if (step.definition.kind === "provider_action") {
        if (this.#providerActionExecutor === undefined) throw new Error("Provider action execution is unavailable")
        result = {
          output: await this.#providerActionExecutor({
            runId: activation.runId,
            activationId: activation.activationId,
            attemptOrdinal: attempt.ordinal,
            step,
            request: objectValue(resolvedInput.request)
          }),
          terminalStatus: null,
          error: null,
          data: []
        }
      } else {
        result = await executeWorkflowStep(step, resolvedInput, {
          activationId: activation.activationId,
          attemptOrdinal: attempt.ordinal,
          scope: activation.scope,
          artifactStore: this.#artifactStoreForRun?.(activation.runId)
        })
      }
    } catch (error) {
      result = {
        output: {},
        terminalStatus: "failed",
        error: {
          code:
            error instanceof WorkflowModelExecutionError || error instanceof WorkflowProviderExecutionError
              ? error.code
              : "step_failed",
          message: error instanceof Error ? error.message : "Unknown step failure"
        },
        data: []
      }
    }
    if (result.error !== null) {
      await this.#journal.failAttempt({
        runId: activation.runId,
        activationId: activation.activationId,
        ordinal: attempt.ordinal,
        leaseOwner: this.#workerId,
        fencingToken: attempt.fencingToken,
        error: result.error,
        terminalStatus: "failed"
      })
      return
    }
    const downstream = downstreamActivations(graph, step.id, result.output, activation.scope)
    const loopBudgets = graph.steps
      .filter(({ definition }) => definition.kind === "bounded_loop")
      .map((loop) => ({
        key: loop.id,
        maximumActivations: z.number().int().min(1).max(100_000).parse(loop.config.maximumActivations)
      }))
    const releases: Array<{ stepId: string; scope: ActivationScopeSegment[] }> = []
    const itemScope = activation.scope.at(-1)
    if (itemScope?.kind === "item") {
      const owner = graph.steps.find(
        (candidate) =>
          candidate.definition.kind === "for_each" &&
          candidate.config.joinStepId !== undefined &&
          downstream.some(
            ({ stepId, scope }) =>
              stepId === candidate.config.joinStepId && scope.length === activation.scope.length - 1
          )
      )
      if (owner !== undefined) {
        const config = z
          .object({
            concurrency: z.number().int().min(1).max(MAXIMUM_COLLECTION_ITEMS),
            bodyStepId: z.string().trim().min(1)
          })
          .passthrough()
          .parse(owner.config)
        const separator = itemScope.key.lastIndexOf(":")
        const index = Number.parseInt(itemScope.key.slice(separator + 1), 10)
        if (Number.isSafeInteger(index)) {
          releases.push({
            stepId: config.bodyStepId,
            scope: [
              ...activation.scope.slice(0, -1),
              { kind: "item", key: `${owner.id}:${String(index + config.concurrency).padStart(6, "0")}` }
            ]
          })
        }
      }
    }
    await this.#journal.completeAttempt({
      runId: activation.runId,
      activationId: activation.activationId,
      ordinal: attempt.ordinal,
      leaseOwner: this.#workerId,
      fencingToken: attempt.fencingToken,
      output: result.output,
      data: result.data,
      usage: result.usage,
      evidence: result.evidence,
      downstream,
      releases,
      loopBudgets,
      checkpoint: { cursor: `${activation.activationId}:${attempt.ordinal}`, committed: true },
      ...(result.terminalStatus === "succeeded" ? { terminalStatus: "succeeded" as const } : {})
    })
  }
}
