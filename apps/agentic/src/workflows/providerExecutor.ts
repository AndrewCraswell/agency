import { z } from "zod"
import type { IntegrationCredentialBroker, BrokerConnection } from "../integrations/broker"
import type { IntegrationConnectionStore } from "../persistence/integrationStore"
import type { PostgresWorkflowJournalStore } from "../persistence/workflowJournalStore"
import { WorkflowResourceBindingV2Schema, type WorkflowStepInstance } from "./definitionV2"
import { JsonValueSchema, type JsonValue } from "./executionContracts"
import { getProviderOperation } from "./providerCatalog"

const JsonObjectSchema = z.record(z.string(), JsonValueSchema)
const MAXIMUM_ITEMS = 100
const GitHubNameSchema = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u)
const ProviderStepConfigSchema = z
  .object({
    provider: z.enum(["github", "linear"]),
    operation: z.string().trim().min(1),
    binding: WorkflowResourceBindingV2Schema
  })
  .strict()
const GraphqlResponseSchema = z
  .object({
    data: JsonValueSchema.optional(),
    errors: z.array(z.object({ message: z.string() }).passthrough()).optional()
  })
  .passthrough()

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

  constructor(broker: IntegrationCredentialBroker, store: IntegrationConnectionStore, journal: ProviderEffectJournal) {
    this.#broker = broker
    this.#store = store
    this.#journal = journal
  }

  async read(step: WorkflowStepInstance, input: Record<string, JsonValue>): Promise<Record<string, JsonValue>> {
    const { operation, binding, connection } = await this.#resolve(step, "read")
    const query = JsonObjectSchema.parse(input.query ?? {})
    const result =
      operation.provider === "github"
        ? await this.#githubRead(connection, binding.name, operation.operation, query)
        : await this.#linearRead(connection, operation.operation, binding.externalId, query)
    return { result: JsonValueSchema.parse(result) }
  }

  async act(input: {
    runId: string
    activationId: string
    attemptOrdinal: number
    step: WorkflowStepInstance
    request: Record<string, JsonValue>
  }): Promise<Record<string, JsonValue>> {
    const { operation, binding, connection } = await this.#resolve(input.step, "write")
    const request = JsonObjectSchema.parse(input.request)
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
      const result =
        operation.provider === "github"
          ? await this.#githubAction(connection, binding.name, operation.operation, request)
          : await this.#linearAction(connection, operation.operation, binding.externalId, request)
      const normalized = JsonObjectSchema.parse(result)
      await this.#journal.confirmEffect(effect.effect.effectId, normalized)
      return { result: normalized }
    } catch (error) {
      await this.#journal.classifyEffectFailure(effect.effect.effectId, "unknown", {
        code: "provider_outcome_unknown",
        message: error instanceof Error ? error.message : "Provider action outcome is unknown"
      })
      throw new WorkflowProviderExecutionError(
        "provider_outcome_unknown",
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
    const connection: BrokerConnection = {
      providerConfigKey: record.providerConfigKey,
      connectionId: record.nangoConnectionId,
      displayName: record.displayName,
      healthy: true,
      errorCode: null
    }
    return { operation, binding: config.binding, connection }
  }

  async #githubRead(
    connection: BrokerConnection,
    repositoryName: string,
    operation: string,
    query: Record<string, JsonValue>
  ): Promise<JsonValue> {
    const repository = GitHubNameSchema.parse(repositoryName)
    const root = `/repos/${repository}`
    if (operation === "github.repository")
      return JsonValueSchema.parse(await this.#broker.request(connection, { method: "GET", endpoint: root }))
    const pullRequestNumber = z.number().int().positive().parse(query.pullRequestNumber)
    if (operation === "github.pull_request")
      return JsonValueSchema.parse(
        await this.#broker.request(connection, { method: "GET", endpoint: `${root}/pulls/${pullRequestNumber}` })
      )
    if (operation === "github.pull_request_comments")
      return JsonValueSchema.parse(
        await this.#broker.request(connection, {
          method: "GET",
          endpoint: `${root}/issues/${pullRequestNumber}/comments`,
          params: { per_page: MAXIMUM_ITEMS }
        })
      )
    if (operation === "github.pull_request_reviews")
      return JsonValueSchema.parse(
        await this.#broker.request(connection, {
          method: "GET",
          endpoint: `${root}/pulls/${pullRequestNumber}/reviews`,
          params: { per_page: MAXIMUM_ITEMS }
        })
      )
    const reference = z.string().trim().min(1).parse(query.ref)
    return JsonValueSchema.parse(
      await this.#broker.request(connection, {
        method: "GET",
        endpoint: `${root}/commits/${encodeURIComponent(reference)}/check-runs`,
        params: { per_page: MAXIMUM_ITEMS }
      })
    )
  }

  async #linearRead(
    connection: BrokerConnection,
    operation: string,
    teamId: string,
    query: Record<string, JsonValue>
  ): Promise<JsonValue> {
    if (operation === "linear.ready_issues") {
      const limit = z.number().int().min(1).max(MAXIMUM_ITEMS).default(25).parse(query.limit)
      return this.#graphql(
        connection,
        "query AgencyWorkflowReadyIssues($teamId: String!, $first: Int!) { issues(first: $first, filter: { team: { id: { eq: $teamId } }, state: { type: { nin: [completed, canceled] } } }, orderBy: priority) { nodes { id identifier title description priority url state { id name type } assignee { id name } labels { nodes { id name } } } } }",
        { teamId, first: limit }
      )
    }
    const issueId = z.string().trim().min(1).parse(query.issueId)
    const selection =
      operation === "linear.issue_comments"
        ? "comments(first: 100) { nodes { id body createdAt user { id name } } }"
        : "identifier title description priority url state { id name } assignee { id name } labels { nodes { id name } }"
    return this.#graphql(connection, `query AgencyWorkflowIssue($id: String!) { issue(id: $id) { id ${selection} } }`, {
      id: issueId
    })
  }

  async #githubAction(
    connection: BrokerConnection,
    repositoryName: string,
    operation: string,
    request: Record<string, JsonValue>
  ): Promise<Record<string, JsonValue>> {
    const repository = GitHubNameSchema.parse(repositoryName)
    const root = `/repos/${repository}`
    if (operation === "github.create_or_update_pull_request") {
      const number = request.pullRequestNumber
      const endpoint = typeof number === "number" ? `${root}/pulls/${number}` : `${root}/pulls`
      const method = typeof number === "number" ? "PATCH" : "POST"
      return JsonObjectSchema.parse(await this.#broker.request(connection, { method, endpoint, data: request }))
    }
    const pullRequestNumber = z.number().int().positive().parse(request.pullRequestNumber)
    if (operation === "github.add_pull_request_comment")
      return JsonObjectSchema.parse(
        await this.#broker.request(connection, {
          method: "POST",
          endpoint: `${root}/issues/${pullRequestNumber}/comments`,
          data: { body: request.body }
        })
      )
    if (operation === "github.submit_pull_request_review")
      return JsonObjectSchema.parse(
        await this.#broker.request(connection, {
          method: "POST",
          endpoint: `${root}/pulls/${pullRequestNumber}/reviews`,
          data: request
        })
      )
    if (operation === "github.request_reviewers")
      return JsonObjectSchema.parse(
        await this.#broker.request(connection, {
          method: "POST",
          endpoint: `${root}/pulls/${pullRequestNumber}/requested_reviewers`,
          data: request
        })
      )
    if (operation === "github.add_labels")
      return JsonObjectSchema.parse(
        await this.#broker.request(connection, {
          method: "POST",
          endpoint: `${root}/issues/${pullRequestNumber}/labels`,
          data: { labels: request.labels }
        })
      )
    if (operation === "github.remove_label")
      return JsonObjectSchema.parse(
        await this.#broker.request(connection, {
          method: "DELETE",
          endpoint: `${root}/issues/${pullRequestNumber}/labels/${encodeURIComponent(z.string().parse(request.label))}`
        })
      )
    if (operation === "github.set_check_status")
      return JsonObjectSchema.parse(
        await this.#broker.request(connection, { method: "POST", endpoint: `${root}/check-runs`, data: request })
      )
    if (operation === "github.merge_pull_request")
      return JsonObjectSchema.parse(
        await this.#broker.request(connection, {
          method: "PUT",
          endpoint: `${root}/pulls/${pullRequestNumber}/merge`,
          data: request
        })
      )
    return JsonObjectSchema.parse(
      await this.#broker.request(connection, {
        method: "PATCH",
        endpoint: `${root}/pulls/${pullRequestNumber}`,
        data: { state: "closed" }
      })
    )
  }

  async #linearAction(
    connection: BrokerConnection,
    operation: string,
    teamId: string,
    request: Record<string, JsonValue>
  ): Promise<Record<string, JsonValue>> {
    if (operation === "linear.create_issue")
      return this.#graphqlObject(
        connection,
        "mutation AgencyCreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title url } } }",
        { input: { ...request, teamId } }
      )
    if (operation === "linear.update_issue")
      return this.#graphqlObject(
        connection,
        "mutation AgencyUpdateIssue($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { id identifier title url } } }",
        { id: request.issueId, input: request.input }
      )
    if (operation === "linear.add_comment")
      return this.#graphqlObject(
        connection,
        "mutation AgencyAddComment($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { id body url } } }",
        { input: { issueId: request.issueId, body: request.body } }
      )
    const mutation = operation === "linear.add_label" ? "issueAddLabel" : "issueRemoveLabel"
    return this.#graphqlObject(
      connection,
      `mutation AgencyLabel($id: String!, $labelId: String!) { ${mutation}(id: $id, labelId: $labelId) { success } }`,
      { id: request.issueId, labelId: request.labelId }
    )
  }

  async #graphql(
    connection: BrokerConnection,
    query: string,
    variables: Record<string, JsonValue>
  ): Promise<JsonValue> {
    const response = GraphqlResponseSchema.parse(
      await this.#broker.request(connection, {
        method: "POST",
        endpoint: "/graphql",
        headers: { "Content-Type": "application/json" },
        data: { query, variables }
      })
    )
    if (response.errors !== undefined || response.data === undefined)
      throw new Error(response.errors?.map(({ message }) => message).join(" ") ?? "Linear returned no data")
    return response.data
  }

  async #graphqlObject(
    connection: BrokerConnection,
    query: string,
    variables: Record<string, JsonValue>
  ): Promise<Record<string, JsonValue>> {
    return JsonObjectSchema.parse(await this.#graphql(connection, query, variables))
  }
}

export type WorkflowProviderDataExecutor = WorkflowProviderExecutor["read"]
export type WorkflowProviderActionExecutor = WorkflowProviderExecutor["act"]
