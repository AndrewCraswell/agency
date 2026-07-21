import { z } from "zod"
import type { IntegrationCredentialBroker } from "../integrations/broker"
import {
  createDefaultProviderExecutionPortResolver,
  ProviderMutationRejectedError
} from "../integrations/providerExecutionAdapters"
import type { ProviderConnectionContext, ProviderExecutionPortResolver } from "../integrations/providerPorts"
import type { IntegrationConnectionStore } from "../persistence/integrationStore"
import type { PostgresWorkflowJournalStore } from "../persistence/workflowJournalStore"
import { WorkflowResourceBindingSchema, type WorkflowStepInstance } from "./definition"
import { JsonValueSchema, type JsonValue } from "./executionContracts"
import { getProviderOperation, validateProviderOperationInput } from "./providerCatalog"

const JsonObjectSchema = z.record(z.string(), JsonValueSchema)
const ProviderStepConfigSchema = z
  .object({
    provider: z.enum(["github", "linear"]),
    operation: z.string().trim().min(1),
    binding: WorkflowResourceBindingSchema
  })
  .strict()
export type ProviderEffectJournal = Pick<
  PostgresWorkflowJournalStore,
  "reserveEffect" | "beginEffectDispatch" | "confirmEffect" | "classifyEffectFailure"
>
export class WorkflowProviderExecutionError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "WorkflowProviderExecutionError"
    this.code = code
  }
}

export class WorkflowProviderExecutor {
  readonly #broker: IntegrationCredentialBroker
  readonly #store: IntegrationConnectionStore
  readonly #journal: ProviderEffectJournal
  readonly #providerPorts: ProviderExecutionPortResolver

  constructor(
    broker: IntegrationCredentialBroker,
    store: IntegrationConnectionStore,
    journal: ProviderEffectJournal,
    providerPorts: ProviderExecutionPortResolver = createDefaultProviderExecutionPortResolver()
  ) {
    this.#broker = broker
    this.#store = store
    this.#journal = journal
    this.#providerPorts = providerPorts
  }

  async read(step: WorkflowStepInstance, input: Record<string, JsonValue>): Promise<Record<string, JsonValue>> {
    const { operation, binding, context } = await this.#resolve(step, "read")
    const queryInput = JsonObjectSchema.parse(input.query ?? {})
    const query = JsonObjectSchema.parse(validateProviderOperationInput(operation.operation, queryInput))
    const port = this.#providerPorts.resolve(operation.provider, operation.resourceType)
    const result = await port.read(context, operation.operation, binding, query)
    return { result: JsonValueSchema.parse(result) }
  }

  async act(input: {
    runId: string
    activationId: string
    attemptOrdinal: number
    step: WorkflowStepInstance
    request: Record<string, JsonValue>
  }): Promise<Record<string, JsonValue>> {
    const { operation, binding, context } = await this.#resolve(input.step, "write")
    const request = JsonObjectSchema.parse(validateProviderOperationInput(operation.operation, input.request))
    const effect = await this.#journal.reserveEffect({
      runId: input.runId,
      activationId: input.activationId,
      effectSlot: "provider-action",
      attemptOrdinal: input.attemptOrdinal,
      provider: operation.provider,
      request: { operation: operation.operation, binding, request },
      idempotencyKey: `${input.runId}:${input.activationId}:provider-action`
    })
    if (effect.effect.status === "confirmed" && effect.effect.result !== null) return { result: effect.effect.result }
    if (!effect.dispatchable) {
      throw new WorkflowProviderExecutionError(
        `provider_effect_${effect.reason}`,
        `Provider effect cannot dispatch while its durable status is ${effect.effect.status}`
      )
    }
    await this.#journal.beginEffectDispatch(effect.effect.effectId)
    try {
      const port = this.#providerPorts.resolve(operation.provider, operation.resourceType)
      const result = await port.act(context, operation.operation, binding, request)
      const normalized = JsonObjectSchema.parse(result)
      await this.#journal.confirmEffect(effect.effect.effectId, normalized)
      return { result: normalized }
    } catch (error) {
      const rejected = error instanceof ProviderMutationRejectedError
      const code = rejected ? "provider_rejected" : "provider_outcome_unknown"
      await this.#journal.classifyEffectFailure(effect.effect.effectId, rejected ? "failed" : "unknown", {
        code,
        message: error instanceof Error ? error.message : "Provider action outcome is unknown"
      })
      throw new WorkflowProviderExecutionError(
        code,
        error instanceof Error ? error.message : "Provider action outcome is unknown"
      )
    }
  }

  async #resolve(step: WorkflowStepInstance, mode: "read" | "write") {
    const config = ProviderStepConfigSchema.parse(step.config)
    const operation = getProviderOperation(config.operation)
    if (operation.mode !== mode || operation.provider !== config.provider) {
      throw new WorkflowProviderExecutionError(
        "provider_operation_mismatch",
        `${config.operation} is not a ${config.provider} ${mode} operation`
      )
    }
    if (config.binding.provider !== operation.provider || config.binding.resourceType !== operation.resourceType) {
      throw new WorkflowProviderExecutionError(
        "provider_binding_mismatch",
        "Provider resource binding does not match the operation"
      )
    }
    if (!config.binding.capabilities.includes(operation.capability)) {
      throw new WorkflowProviderExecutionError(
        "provider_capability_missing",
        `Resource binding lacks ${operation.capability}`
      )
    }
    const record = await this.#store.getConnection(config.binding.connectionId)
    if (record === null || record.status !== "connected" || record.provider !== operation.provider) {
      throw new WorkflowProviderExecutionError("provider_connection_unavailable", "Provider connection is unavailable")
    }
    const resource = (await this.#store.listResources(record.connectionId)).find(
      (candidate) =>
        candidate.resourceType === config.binding.resourceType &&
        candidate.externalId === config.binding.externalId &&
        candidate.name === config.binding.name &&
        !candidate.stale
    )
    if (resource === undefined)
      throw new WorkflowProviderExecutionError("provider_resource_stale", "Provider resource binding is stale")
    const connection = {
      providerConfigKey: record.providerConfigKey,
      connectionId: record.nangoConnectionId,
      displayName: record.displayName,
      healthy: true,
      errorCode: null
    }
    const context: ProviderConnectionContext = {
      connectionId: connection.connectionId,
      provider: operation.provider,
      request: (request) => this.#broker.request(connection, request)
    }
    return { operation, binding: config.binding, context }
  }
}

export type WorkflowProviderDataExecutor = WorkflowProviderExecutor["read"]
export type WorkflowProviderActionExecutor = WorkflowProviderExecutor["act"]
