import { z } from "zod"
import { WorkflowDefinitionV2Schema, type WorkflowDefinitionV2 } from "./definitionV2"
import {
  ExecutionPackageContentSchema,
  executionPackageDigest,
  type ExecutionPackageContent,
  type JsonValue
} from "./executionContracts"
import { isJsonSchemaAssignable, schemaAtPath, SupportedJsonSchemaSchema } from "./jsonSchema"
import { WorkflowModelSnapshotSchema, type WorkflowModelSnapshot } from "./modelCatalog"
import { getProviderOperation } from "./providerCatalog"
import { RepositoryAgentSnapshotSchema, type RepositoryAgentSnapshot } from "./repositoryAgents"
import { nextScheduleRunAt, scheduleDefinitionFromConfig } from "./scheduleDefinition"
import { getWorkflowStepDefinition, type WorkflowStepDefinition } from "./stepRegistry"

export const WORKFLOW_COMPILER_VERSION = "1" as const
export const WORKFLOW_MAPPING_EXPRESSION_VERSION = "1" as const

export const CompiledWorkflowGraphSchema = z
  .object({
    schemaVersion: z.literal("2"),
    inputSchema: SupportedJsonSchemaSchema,
    outputSchema: SupportedJsonSchemaSchema,
    steps: WorkflowDefinitionV2Schema.shape.steps,
    connections: WorkflowDefinitionV2Schema.shape.connections,
    topologicalOrder: z.array(z.string()),
    fixtures: WorkflowDefinitionV2Schema.shape.fixtures
  })
  .strict()

export type WorkflowCompilationIssue = {
  code: string
  message: string
  stepId: string | null
  connectionId: string | null
}

export class WorkflowCompilationError extends Error {
  readonly issues: WorkflowCompilationIssue[]

  constructor(issues: WorkflowCompilationIssue[]) {
    super(issues.map(({ message }) => message).join(" "))
    this.name = "WorkflowCompilationError"
    this.issues = issues
  }
}

function aggregatePortSchema(ports: WorkflowStepDefinition["inputs"] | WorkflowStepDefinition["outputs"]): JsonValue {
  return {
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(ports.map((port) => [port.name, port.schema])),
    required: ports.filter(({ cardinality }) => cardinality === "one").map(({ name }) => name)
  }
}

function topologicalOrder(definition: WorkflowDefinitionV2, issues: WorkflowCompilationIssue[]): string[] {
  const stepIds = new Set(definition.steps.map(({ id }) => id))
  const incoming = new Map([...stepIds].map((id) => [id, 0]))
  const outgoing = new Map([...stepIds].map((id) => [id, [] as string[]]))
  for (const connection of definition.connections.filter(({ loopBack }) => loopBack !== true)) {
    if (!stepIds.has(connection.source.stepId) || !stepIds.has(connection.target.stepId)) continue
    incoming.set(connection.target.stepId, (incoming.get(connection.target.stepId) ?? 0) + 1)
    outgoing.get(connection.source.stepId)?.push(connection.target.stepId)
  }
  const ready = [...incoming.entries()]
    .filter(([, count]) => count === 0)
    .map(([id]) => id)
    .sort()
  const order: string[] = []
  while (ready.length > 0) {
    const current = ready.shift()
    if (current === undefined) break
    order.push(current)
    for (const target of outgoing.get(current) ?? []) {
      const count = (incoming.get(target) ?? 0) - 1
      incoming.set(target, count)
      if (count === 0) {
        ready.push(target)
        ready.sort()
      }
    }
  }
  if (order.length !== stepIds.size)
    issues.push({
      code: "cycle",
      message: "Workflow connections contain an arbitrary cycle.",
      stepId: null,
      connectionId: null
    })
  return order
}

function validateReachability(
  definition: WorkflowDefinitionV2,
  definitions: Map<string, WorkflowStepDefinition>,
  issues: WorkflowCompilationIssue[]
): void {
  const triggers = definition.steps.filter((step) => definitions.get(step.id)?.category === "trigger")
  const terminals = new Set(
    definition.steps.filter((step) => definitions.get(step.id)?.category === "terminal").map(({ id }) => id)
  )
  if (triggers.length === 0)
    issues.push({ code: "trigger_required", message: "Add at least one trigger.", stepId: null, connectionId: null })
  if (terminals.size === 0)
    issues.push({
      code: "terminal_required",
      message: "Add at least one Success or Failure step.",
      stepId: null,
      connectionId: null
    })
  const outgoing = new Map(definition.steps.map(({ id }) => [id, [] as string[]]))
  const incoming = new Map(definition.steps.map(({ id }) => [id, [] as string[]]))
  for (const connection of definition.connections.filter(({ loopBack }) => loopBack !== true)) {
    outgoing.get(connection.source.stepId)?.push(connection.target.stepId)
    incoming.get(connection.target.stepId)?.push(connection.source.stepId)
  }
  for (const connection of definition.connections.filter(({ loopBack }) => loopBack === true)) {
    incoming.get(connection.target.stepId)?.push(connection.source.stepId)
  }
  const reachable = new Set<string>()
  const pending = triggers.map(({ id }) => id)
  while (pending.length > 0) {
    const current = pending.shift()
    if (current === undefined || reachable.has(current)) continue
    reachable.add(current)
    pending.push(...(outgoing.get(current) ?? []))
  }
  for (const step of definition.steps) {
    if (!reachable.has(step.id))
      issues.push({
        code: "unreachable_step",
        message: `${step.label} is not reachable from a trigger.`,
        stepId: step.id,
        connectionId: null
      })
  }
  const reachesTerminal = new Set<string>(terminals)
  const reversePending = [...terminals]
  while (reversePending.length > 0) {
    const current = reversePending.shift()
    if (current === undefined) continue
    for (const source of incoming.get(current) ?? []) {
      if (!reachesTerminal.has(source)) {
        reachesTerminal.add(source)
        reversePending.push(source)
      }
    }
  }
  for (const step of definition.steps) {
    if (!reachesTerminal.has(step.id))
      issues.push({
        code: "terminal_unreachable",
        message: `${step.label} cannot reach a terminal step.`,
        stepId: step.id,
        connectionId: null
      })
  }
}

function validateConnections(
  definition: WorkflowDefinitionV2,
  definitions: Map<string, WorkflowStepDefinition>,
  issues: WorkflowCompilationIssue[]
): void {
  const connectedInputs = new Set<string>()
  for (const connection of definition.connections) {
    const sourceDefinition = definitions.get(connection.source.stepId)
    const targetDefinition = definitions.get(connection.target.stepId)
    const sourceStep = definition.steps.find(({ id }) => id === connection.source.stepId)
    if (sourceDefinition === undefined || targetDefinition === undefined) {
      issues.push({
        code: "missing_step",
        message: `Connection ${connection.id} references a missing step.`,
        stepId: null,
        connectionId: connection.id
      })
      continue
    }
    if (sourceDefinition.kind === "switch") {
      const rawCases = sourceStep?.config.cases
      const cases = Array.isArray(rawCases) ? rawCases : []
      const declaredKeys = cases.flatMap((candidate) => {
        if (candidate === null || Array.isArray(candidate) || typeof candidate !== "object") return []
        return typeof candidate.key === "string" ? [candidate.key] : []
      })
      const defaultKey = sourceStep?.config.defaultKey
      if (typeof defaultKey === "string") declaredKeys.push(defaultKey)
      if (connection.branchKey === undefined) {
        issues.push({
          code: "switch_branch_required",
          message: `Connection ${connection.id} must select a switch branch.`,
          stepId: connection.source.stepId,
          connectionId: connection.id
        })
      } else if (!declaredKeys.includes(connection.branchKey)) {
        issues.push({
          code: "switch_branch_unknown",
          message: `Connection ${connection.id} selects undeclared branch ${connection.branchKey}.`,
          stepId: connection.source.stepId,
          connectionId: connection.id
        })
      }
    } else if (connection.branchKey !== undefined) {
      issues.push({
        code: "branch_key_invalid",
        message: `Connection ${connection.id} sets a branch key on a non-switch step.`,
        stepId: connection.source.stepId,
        connectionId: connection.id
      })
    }
    if (connection.loopBack === true && targetDefinition.kind !== "bounded_loop") {
      issues.push({
        code: "loop_back_target",
        message: `Connection ${connection.id} marks a loop back edge to a non-loop step.`,
        stepId: connection.target.stepId,
        connectionId: connection.id
      })
    }
    const sourcePort =
      connection.outcome === "failure"
        ? { name: "error", schema: sourceDefinition.errorSchema, cardinality: "one" as const }
        : sourceDefinition.outputs.find(({ name }) => name === connection.source.port)
    const targetPort = targetDefinition.inputs.find(({ name }) => name === connection.target.port)
    if (sourcePort === undefined)
      issues.push({
        code: "source_port",
        message: `Connection ${connection.id} references an unavailable source port.`,
        stepId: connection.source.stepId,
        connectionId: connection.id
      })
    if (targetPort === undefined)
      issues.push({
        code: "target_port",
        message: `Connection ${connection.id} references an unavailable target port.`,
        stepId: connection.target.stepId,
        connectionId: connection.id
      })
    if (sourcePort === undefined || targetPort === undefined) continue
    const inputKey = `${connection.target.stepId}:${connection.target.port}`
    if (connection.loopBack !== true) {
      if (targetPort.cardinality !== "many" && connectedInputs.has(inputKey))
        issues.push({
          code: "input_cardinality",
          message: `${targetDefinition.label} input ${targetPort.label} accepts only one connection.`,
          stepId: connection.target.stepId,
          connectionId: connection.id
        })
      connectedInputs.add(inputKey)
    }
    const sourcePortSchema =
      sourceDefinition.kind === "collect" && sourcePort.name === "collection"
        ? { type: sourceStep?.config.mode === "keyed" ? ("object" as const) : ("array" as const) }
        : sourcePort.schema
    for (const mapping of connection.mappings) {
      const sourceSchema = schemaAtPath(sourcePortSchema, mapping.sourcePath)
      const targetSchema = schemaAtPath(targetPort.schema, mapping.targetPath)
      if (sourceSchema === null || targetSchema === null || !isJsonSchemaAssignable(sourceSchema, targetSchema)) {
        issues.push({
          code: "mapping_type",
          message: `Connection ${connection.id} has an incompatible field mapping.`,
          stepId: connection.target.stepId,
          connectionId: connection.id
        })
      }
    }
  }
  for (const step of definition.steps.filter(({ definition: item }) => item.kind === "switch")) {
    const cases = Array.isArray(step.config.cases) ? step.config.cases : []
    const keys = cases.flatMap((candidate) => {
      if (candidate === null || Array.isArray(candidate) || typeof candidate !== "object") return []
      return typeof candidate.key === "string" ? [candidate.key] : []
    })
    if (typeof step.config.defaultKey === "string") keys.push(step.config.defaultKey)
    const duplicate = keys.find((key, index) => keys.indexOf(key) !== index)
    if (duplicate !== undefined) {
      issues.push({
        code: "switch_branch_duplicate",
        message: `${step.label} declares branch ${duplicate} more than once.`,
        stepId: step.id,
        connectionId: null
      })
    }
    const connected = new Set(
      definition.connections.filter(({ source }) => source.stepId === step.id).map(({ branchKey }) => branchKey)
    )
    for (const key of keys) {
      if (!connected.has(key))
        issues.push({
          code: "switch_branch_unconnected",
          message: `${step.label} branch ${key} is not connected.`,
          stepId: step.id,
          connectionId: null
        })
    }
  }
}

function pathExists(definition: WorkflowDefinitionV2, sourceStepId: string, targetStepId: string): boolean {
  const outgoing = new Map(definition.steps.map(({ id }) => [id, [] as string[]]))
  for (const connection of definition.connections)
    outgoing.get(connection.source.stepId)?.push(connection.target.stepId)
  const visited = new Set<string>()
  const pending = [sourceStepId]
  while (pending.length > 0) {
    const current = pending.shift()
    if (current === undefined || visited.has(current)) continue
    if (current === targetStepId) return true
    visited.add(current)
    pending.push(...(outgoing.get(current) ?? []))
  }
  return false
}

function validateOrchestration(definition: WorkflowDefinitionV2, issues: WorkflowCompilationIssue[]): void {
  for (const step of definition.steps.filter(({ definition: item }) => item.kind === "join")) {
    const incomingCount = definition.connections.filter(
      ({ target, outcome, loopBack }) => target.stepId === step.id && outcome === "success" && loopBack !== true
    ).length
    if (step.config.policy === "quorum") {
      const quorum = typeof step.config.quorum === "number" ? step.config.quorum : 0
      if (quorum > incomingCount) {
        issues.push({
          code: "join_quorum_unsatisfiable",
          message: `${step.label} requires quorum ${quorum}, but only ${incomingCount} success paths enter it.`,
          stepId: step.id,
          connectionId: null
        })
      }
    }
  }
  for (const step of definition.steps.filter(({ definition: item }) => item.kind === "for_each")) {
    const bodyStepId = typeof step.config.bodyStepId === "string" ? step.config.bodyStepId : ""
    const joinStepId = typeof step.config.joinStepId === "string" ? step.config.joinStepId : ""
    const body = definition.steps.find(({ id }) => id === bodyStepId)
    const join = definition.steps.find(({ id }) => id === joinStepId)
    if (body === undefined)
      issues.push({
        code: "for_each_body",
        message: `${step.label} references a missing body step.`,
        stepId: step.id,
        connectionId: null
      })
    if (join?.definition.kind !== "join")
      issues.push({
        code: "for_each_join",
        message: `${step.label} must reference a Join step.`,
        stepId: step.id,
        connectionId: null
      })
    if (body !== undefined && join !== undefined && !pathExists(definition, body.id, join.id)) {
      issues.push({
        code: "for_each_body_exit",
        message: `${step.label} body cannot reach its configured Join.`,
        stepId: step.id,
        connectionId: null
      })
    }
  }
  for (const step of definition.steps.filter(
    ({ definition: item }) => item.kind === "condition" || item.kind === "switch"
  )) {
    const joinStepId = typeof step.config.joinStepId === "string" ? step.config.joinStepId : ""
    const join = definition.steps.find(({ id }) => id === joinStepId)
    if (join?.definition.kind !== "exclusive_merge") {
      issues.push({
        code: "branch_merge",
        message: `${step.label} must reference an Exclusive merge step.`,
        stepId: step.id,
        connectionId: null
      })
      continue
    }
    const branchTargets = definition.connections
      .filter(({ source, outcome }) => source.stepId === step.id && outcome === "success")
      .map(({ target }) => target.stepId)
    for (const targetStepId of branchTargets) {
      if (!pathExists(definition, targetStepId, join.id)) {
        issues.push({
          code: "branch_merge_unreachable",
          message: `${step.label} branch cannot reach its configured Exclusive merge.`,
          stepId: step.id,
          connectionId: null
        })
      }
    }
  }
  for (const step of definition.steps.filter(({ definition: item }) => item.kind === "bounded_loop")) {
    const bodyStepId = typeof step.config.bodyStepId === "string" ? step.config.bodyStepId : ""
    const exitStepId = typeof step.config.exitStepId === "string" ? step.config.exitStepId : ""
    const body = definition.steps.find(({ id }) => id === bodyStepId)
    const exit = definition.steps.find(({ id }) => id === exitStepId)
    if (body === undefined)
      issues.push({
        code: "loop_body",
        message: `${step.label} references a missing body step.`,
        stepId: step.id,
        connectionId: null
      })
    if (exit === undefined)
      issues.push({
        code: "loop_exit",
        message: `${step.label} references a missing exit step.`,
        stepId: step.id,
        connectionId: null
      })
    const backEdges = definition.connections.filter(
      ({ target, loopBack }) => target.stepId === step.id && loopBack === true
    )
    if (backEdges.length !== 1 || backEdges[0]?.target.port !== "state") {
      issues.push({
        code: "loop_back",
        message: `${step.label} requires exactly one loop-back edge to its state input.`,
        stepId: step.id,
        connectionId: backEdges[0]?.id ?? null
      })
    }
    if (
      body !== undefined &&
      backEdges[0] !== undefined &&
      !pathExists(definition, body.id, backEdges[0].source.stepId)
    ) {
      issues.push({
        code: "loop_body_back",
        message: `${step.label} body cannot reach its loop-back edge.`,
        stepId: step.id,
        connectionId: backEdges[0].id
      })
    }
    const iterationTargets = definition.connections.filter(
      ({ source }) => source.stepId === step.id && source.port === "iteration"
    )
    const resultTargets = definition.connections.filter(
      ({ source }) => source.stepId === step.id && source.port === "result"
    )
    if (!iterationTargets.some(({ target }) => target.stepId === bodyStepId)) {
      issues.push({
        code: "loop_body_edge",
        message: `${step.label} iteration output must connect to its body step.`,
        stepId: step.id,
        connectionId: null
      })
    }
    if (!resultTargets.some(({ target }) => target.stepId === exitStepId)) {
      issues.push({
        code: "loop_exit_edge",
        message: `${step.label} result output must connect to its exit step.`,
        stepId: step.id,
        connectionId: null
      })
    }
  }
  for (const connection of definition.connections.filter(({ loopBack }) => loopBack === true)) {
    const target = definition.steps.find(({ id }) => id === connection.target.stepId)
    if (target?.definition.kind !== "bounded_loop") continue
    const expected = definition.connections.filter(
      ({ target: candidateTarget, loopBack }) => candidateTarget.stepId === target.id && loopBack === true
    )
    if (expected.length !== 1)
      issues.push({
        code: "loop_back_duplicate",
        message: `${target.label} has ambiguous loop-back edges.`,
        stepId: target.id,
        connectionId: connection.id
      })
  }
}

export function compileWorkflowDefinition(input: {
  workflowId: string
  workflowVersion: number
  definition: WorkflowDefinitionV2
  maximumPhase: number
  agentSnapshots?: RepositoryAgentSnapshot[]
  modelSnapshots?: WorkflowModelSnapshot[]
}): { content: ExecutionPackageContent; digest: string } {
  const workflowId = z.uuid().parse(input.workflowId)
  const workflowVersion = z.number().int().positive().parse(input.workflowVersion)
  const maximumPhase = z.number().int().min(2).max(7).parse(input.maximumPhase)
  const definition = WorkflowDefinitionV2Schema.parse(input.definition)
  const agentSnapshots = z.array(RepositoryAgentSnapshotSchema).parse(input.agentSnapshots ?? [])
  const modelSnapshots = z.array(WorkflowModelSnapshotSchema).parse(input.modelSnapshots ?? [])
  const issues: WorkflowCompilationIssue[] = []
  const stepIds = new Set<string>()
  const definitions = new Map<string, WorkflowStepDefinition>()
  for (const step of definition.steps) {
    if (stepIds.has(step.id))
      issues.push({
        code: "duplicate_step",
        message: `Step ID ${step.id} is duplicated.`,
        stepId: step.id,
        connectionId: null
      })
    stepIds.add(step.id)
    try {
      definitions.set(step.id, getWorkflowStepDefinition(step.definition.kind, step.definition.version, maximumPhase))
    } catch (error) {
      issues.push({
        code: "step_unavailable",
        message: error instanceof Error ? error.message : "Step is unavailable.",
        stepId: step.id,
        connectionId: null
      })
    }
  }
  for (const step of definition.steps.filter(({ definition: item }) => item.kind === "schedule")) {
    try {
      const schedule = scheduleDefinitionFromConfig(step.config)
      nextScheduleRunAt(schedule, new Date(0), `${workflowId}:${step.id}`)
    } catch (error) {
      issues.push({
        code: "schedule_configuration",
        message: error instanceof Error ? error.message : "Enter a valid schedule.",
        stepId: step.id,
        connectionId: null
      })
    }
  }
  const connectionIds = new Set<string>()
  for (const connection of definition.connections) {
    if (connectionIds.has(connection.id))
      issues.push({
        code: "duplicate_connection",
        message: `Connection ID ${connection.id} is duplicated.`,
        stepId: null,
        connectionId: connection.id
      })
    connectionIds.add(connection.id)
  }
  const referencedAgentDigests = new Set<string>()
  for (const step of definition.steps.filter(({ definition: item }) => item.kind === "repository_agent")) {
    const agentReference = step.config.agentReference
    const contentDigest =
      agentReference !== null && typeof agentReference === "object" && !Array.isArray(agentReference)
        ? agentReference.contentDigest
        : undefined
    if (typeof contentDigest !== "string") {
      issues.push({
        code: "agent_reference",
        message: `${step.label} has no valid repository agent reference.`,
        stepId: step.id,
        connectionId: null
      })
      continue
    }
    if (referencedAgentDigests.has(contentDigest)) continue
    referencedAgentDigests.add(contentDigest)
    if (!agentSnapshots.some((snapshot) => snapshot.reference.contentDigest === contentDigest)) {
      issues.push({
        code: "agent_snapshot",
        message: `${step.label} has no approved repository agent snapshot.`,
        stepId: step.id,
        connectionId: null
      })
    }
  }
  for (const snapshot of agentSnapshots) {
    if (!referencedAgentDigests.has(snapshot.reference.contentDigest)) {
      issues.push({
        code: "agent_snapshot_unreferenced",
        message: `Repository agent snapshot ${snapshot.reference.name} is not referenced by this workflow.`,
        stepId: null,
        connectionId: null
      })
    }
  }
  const referencedModelIds = new Set<string>()
  for (const step of definition.steps.filter(
    ({ definition: item }) => item.kind === "ai_model" || item.kind === "structured_judgment"
  )) {
    const modelId = step.config.modelId
    if (typeof modelId !== "string") {
      issues.push({
        code: "model_reference",
        message: `${step.label} has no valid model ID.`,
        stepId: step.id,
        connectionId: null
      })
      continue
    }
    referencedModelIds.add(modelId)
    const snapshot = modelSnapshots.find((candidate) => candidate.modelId === modelId)
    if (snapshot === undefined) {
      issues.push({
        code: "model_snapshot",
        message: `${step.label} has no approved model catalog snapshot.`,
        stepId: step.id,
        connectionId: null
      })
      continue
    }
    const parameters = step.config.parameters
    if (
      parameters !== undefined &&
      (parameters === null || Array.isArray(parameters) || typeof parameters !== "object")
    ) {
      issues.push({
        code: "model_parameters",
        message: `${step.label} has invalid model parameters.`,
        stepId: step.id,
        connectionId: null
      })
    } else if (parameters !== undefined) {
      for (const parameter of Object.keys(parameters)) {
        if (!snapshot.supportedParameters.some((supported) => supported === parameter)) {
          issues.push({
            code: "model_parameter_unsupported",
            message: `${step.label} model does not advertise ${parameter}.`,
            stepId: step.id,
            connectionId: null
          })
        }
      }
    }
    if (step.config.outputMode === "structured" && !snapshot.supportedParameters.includes("response_format")) {
      issues.push({
        code: "model_structured_output",
        message: `${step.label} model does not advertise structured output.`,
        stepId: step.id,
        connectionId: null
      })
    }
  }
  for (const snapshot of modelSnapshots) {
    if (!referencedModelIds.has(snapshot.modelId)) {
      issues.push({
        code: "model_snapshot_unreferenced",
        message: `Model snapshot ${snapshot.modelId} is not referenced by this workflow.`,
        stepId: null,
        connectionId: null
      })
    }
  }
  const referencedBindingIds = new Set<string>()
  for (const step of definition.steps.filter(
    ({ definition: item }) =>
      item.kind === "provider_event" || item.kind === "provider_data" || item.kind === "provider_action"
  )) {
    const binding = step.config.binding
    if (binding === null || Array.isArray(binding) || typeof binding !== "object") {
      issues.push({
        code: "provider_binding",
        message: `${step.label} has no valid resource binding.`,
        stepId: step.id,
        connectionId: null
      })
      continue
    }
    const connectionId = binding.connectionId
    const externalId = binding.externalId
    if (typeof connectionId !== "string" || typeof externalId !== "string") {
      issues.push({
        code: "provider_binding",
        message: `${step.label} has no valid resource binding.`,
        stepId: step.id,
        connectionId: null
      })
      continue
    }
    const bindingKey = Object.entries(definition.resourceBindings).find(
      ([, candidate]) => candidate.connectionId === connectionId && candidate.externalId === externalId
    )
    if (bindingKey === undefined) {
      issues.push({
        code: "provider_binding_unsealed",
        message: `${step.label} resource binding is not sealed in the workflow.`,
        stepId: step.id,
        connectionId: null
      })
      continue
    }
    referencedBindingIds.add(bindingKey[0])
    const provider = step.config.provider
    if (provider !== bindingKey[1].provider) {
      issues.push({
        code: "provider_binding_mismatch",
        message: `${step.label} provider does not match its resource binding.`,
        stepId: step.id,
        connectionId: null
      })
    }
    if (step.definition.kind === "provider_event") continue
    try {
      const operation = getProviderOperation(z.string().parse(step.config.operation))
      const expectedMode = step.definition.kind === "provider_data" ? "read" : "write"
      if (operation.mode !== expectedMode || operation.provider !== provider) {
        issues.push({
          code: "provider_operation",
          message: `${step.label} operation does not match the node.`,
          stepId: step.id,
          connectionId: null
        })
      }
      if (
        operation.resourceType !== bindingKey[1].resourceType ||
        !bindingKey[1].capabilities.includes(operation.capability)
      ) {
        issues.push({
          code: "provider_capability",
          message: `${step.label} resource does not grant ${operation.capability}.`,
          stepId: step.id,
          connectionId: null
        })
      }
    } catch (error) {
      issues.push({
        code: "provider_operation",
        message: error instanceof Error ? error.message : `${step.label} operation is invalid.`,
        stepId: step.id,
        connectionId: null
      })
    }
  }
  for (const bindingId of Object.keys(definition.resourceBindings)) {
    if (bindingId === "repository") continue
    if (!referencedBindingIds.has(bindingId)) {
      issues.push({
        code: "provider_binding_unreferenced",
        message: `Resource binding ${bindingId} is not referenced by this workflow.`,
        stepId: null,
        connectionId: null
      })
    }
  }
  validateConnections(definition, definitions, issues)
  validateOrchestration(definition, issues)
  validateReachability(definition, definitions, issues)
  const order = topologicalOrder(definition, issues)
  if (issues.length > 0) throw new WorkflowCompilationError(issues)

  const snapshots = [
    ...new Map([...definitions.values()].map((item) => [`${item.kind}@${item.version}`, item])).values()
  ]
    .sort((left, right) => left.kind.localeCompare(right.kind))
    .map((item) => ({
      kind: item.kind,
      version: item.version,
      executorDigest: item.executorDigest,
      configSchema: item.configSchema,
      inputSchema: aggregatePortSchema(item.inputs),
      outputSchema: aggregatePortSchema(item.outputs),
      errorSchema: item.errorSchema,
      executionClass: item.executionClass,
      simulationPolicy: item.simulationPolicy,
      mutationPolicy: item.mutationPolicy,
      capabilities: item.capabilities
    }))
  const graph = {
    schemaVersion: definition.schemaVersion,
    inputSchema: definition.inputSchema,
    outputSchema: definition.outputSchema,
    steps: [...definition.steps].sort((left, right) => left.id.localeCompare(right.id)),
    connections: [...definition.connections].sort((left, right) => left.id.localeCompare(right.id)),
    topologicalOrder: order,
    fixtures: definition.fixtures
  }
  const content = ExecutionPackageContentSchema.parse({
    schemaVersion: "1",
    workflowId,
    workflowVersion,
    compilerVersion: WORKFLOW_COMPILER_VERSION,
    mappingExpressionVersion: WORKFLOW_MAPPING_EXPRESSION_VERSION,
    eventDecoderVersions: { "run.prepared": "1", "attempt.succeeded": "1", "attempt.failed": "1" },
    graph,
    stepDefinitions: snapshots,
    constants: definition.constants,
    resourceReferences: Object.values(definition.resourceBindings),
    agentSnapshots: [...agentSnapshots].sort((left, right) =>
      left.reference.contentDigest.localeCompare(right.reference.contentDigest)
    ),
    modelSnapshots: [...modelSnapshots].sort((left, right) => left.modelId.localeCompare(right.modelId))
  })
  return { content, digest: executionPackageDigest(content) }
}
