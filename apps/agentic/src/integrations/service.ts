import { z } from "zod"
import type { IntegrationConnectionRecord, IntegrationConnectionStore } from "../persistence/integrationStore"
import type { BrokerConnection, IntegrationCredentialBroker } from "./broker"
import {
  AuthorizationSessionSchema,
  CompleteAuthorizationRequestSchema,
  INTEGRATION_SCHEMA_VERSION,
  IntegrationConnectionSchema,
  IntegrationProviderSchema,
  IntegrationResourceInventoryRequestSchema,
  IntegrationResourceInventorySchema,
  IntegrationSettingsSchema,
  StartAuthorizationRequestSchema,
  StartReconnectRequestSchema,
  type IntegrationProvider,
  type IntegrationResourceCapability
} from "./contracts"

const IntegrationServiceOptionsSchema = z
  .object({
    githubIntegrationId: z.string().min(1).default("github-app"),
    linearIntegrationId: z.string().min(1).default("linear")
  })
  .strict()

const GitHubRepositoriesSchema = z
  .object({
    total_count: z.number().int().nonnegative(),
    repositories: z.array(
      z
        .object({ id: z.number().int().positive(), full_name: z.string().min(1), archived: z.boolean().default(false) })
        .passthrough()
    )
  })
  .passthrough()

const LinearTeamsSchema = z
  .object({
    data: z
      .object({
        teams: z.object({
          nodes: z.array(z.object({ id: z.string().min(1), key: z.string(), name: z.string() })),
          pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() })
        })
      })
      .optional(),
    errors: z.array(z.object({ message: z.string() }).passthrough()).optional()
  })
  .passthrough()

const catalog = [
  {
    provider: "github" as const,
    name: "GitHub",
    description: "Repository access, pull requests, issues, checks, and provider events.",
    capabilities: ["repositories", "pull requests", "issues", "webhooks"]
  },
  {
    provider: "linear" as const,
    name: "Linear",
    description: "Teams, issues, comments, workflow states, and provider events.",
    capabilities: ["teams", "issues", "comments", "webhooks"]
  }
]

function resourceCapabilities(
  provider: IntegrationProvider,
  resourceType: "repository" | "team"
): IntegrationResourceCapability[] {
  if (provider === "github" && resourceType === "repository") {
    return ["repository.read", "repository.write", "pull_request.write"]
  }
  if (provider === "linear" && resourceType === "team") {
    return ["team.read", "issue.read", "issue.write"]
  }
  return []
}

export class IntegrationService {
  readonly #broker: IntegrationCredentialBroker
  readonly #store: IntegrationConnectionStore
  readonly #options: z.output<typeof IntegrationServiceOptionsSchema>
  readonly #now: () => Date

  constructor(
    broker: IntegrationCredentialBroker,
    store: IntegrationConnectionStore,
    options: z.input<typeof IntegrationServiceOptionsSchema>,
    now: () => Date = () => new Date()
  ) {
    this.#broker = broker
    this.#store = store
    this.#options = IntegrationServiceOptionsSchema.parse(options)
    this.#now = now
  }

  async settings() {
    const connections = await this.#store.listConnections()
    return IntegrationSettingsSchema.parse({
      schemaVersion: INTEGRATION_SCHEMA_VERSION,
      catalog,
      connections: await Promise.all(connections.map((connection) => this.#connectionView(connection)))
    })
  }

  async inventory(input: unknown) {
    const { capability } = IntegrationResourceInventoryRequestSchema.parse(input)
    const connections = await this.#store.listConnections()
    const resources = await Promise.all(
      connections
        .filter((connection) => connection.status === "connected")
        .map(async (connection) => {
          const discovered = await this.#store.listResources(connection.connectionId)
          return discovered
            .filter((resource) => !resource.stale)
            .map((resource) => ({
              connectionId: connection.connectionId,
              provider: connection.provider,
              resource: {
                resourceType: resource.resourceType,
                externalId: resource.externalId,
                name: resource.name,
                capabilities: resourceCapabilities(connection.provider, resource.resourceType),
                stale: resource.stale,
                lastDiscoveredAt: resource.lastDiscoveredAt.toISOString()
              }
            }))
            .filter(({ resource }) => capability === undefined || resource.capabilities.includes(capability))
        })
    )
    return IntegrationResourceInventorySchema.parse({
      schemaVersion: INTEGRATION_SCHEMA_VERSION,
      resources: resources.flat()
    })
  }

  async startAuthorization(input: unknown) {
    const { provider } = StartAuthorizationRequestSchema.parse(input)
    const session = await this.#broker.createAuthorizationSession(provider)
    return AuthorizationSessionSchema.parse({ provider, ...session })
  }

  async startReconnect(input: unknown) {
    const { connectionId } = StartReconnectRequestSchema.parse(input)
    const connection = await this.#requireConnection(connectionId)
    const session = await this.#broker.createReconnectSession(this.#brokerConnection(connection))
    return AuthorizationSessionSchema.parse({ provider: connection.provider, ...session })
  }

  async completeAuthorization(input: unknown) {
    const completion = CompleteAuthorizationRequestSchema.parse(input)
    if (completion.providerConfigKey !== this.#integrationId(completion.provider)) {
      throw new Error("Authorization completed for an unexpected integration")
    }
    const connections = await this.#broker.listConnections(completion.provider)
    const brokerConnection = connections.find(
      (connection) =>
        connection.connectionId === completion.nangoConnectionId &&
        connection.providerConfigKey === completion.providerConfigKey
    )
    if (brokerConnection === undefined) {
      throw new Error("Nango connection was not found after authorization")
    }
    const record = await this.#persistBrokerConnection(completion.provider, brokerConnection)
    await this.#refreshResources(record)
    return this.#connectionView(await this.#requireConnection(record.connectionId))
  }

  async reconcile(): Promise<{ checked: number; connected: number; degraded: number; disconnected: number }> {
    const existing = await this.#store.listConnections()
    let checked = 0
    for (const provider of IntegrationProviderSchema.options) {
      const providerRecords = existing.filter((connection) => connection.provider === provider)
      let remoteConnections: BrokerConnection[]
      try {
        remoteConnections = await this.#broker.listConnections(provider)
      } catch {
        for (const connection of providerRecords) {
          await this.#store.updateConnectionHealth(
            connection.connectionId,
            "degraded",
            "connection_check_failed",
            this.#now()
          )
        }
        checked += providerRecords.length
        continue
      }
      const remoteKeys = new Set(remoteConnections.map((connection) => connection.connectionId))
      for (const remote of remoteConnections) {
        const record = await this.#persistBrokerConnection(provider, remote)
        await this.#refreshResources(record)
        checked += 1
      }
      for (const connection of providerRecords) {
        if (!remoteKeys.has(connection.nangoConnectionId)) {
          await this.#store.updateConnectionHealth(connection.connectionId, "disconnected", null, this.#now())
          checked += 1
        }
      }
    }
    const reconciled = await this.#store.listConnections()
    return {
      checked,
      connected: reconciled.filter((connection) => connection.status === "connected").length,
      degraded: reconciled.filter((connection) => connection.status === "degraded").length,
      disconnected: reconciled.filter((connection) => connection.status === "disconnected").length
    }
  }

  async refresh(connectionId: string) {
    const connection = await this.#requireConnection(connectionId)
    const remoteConnections = await this.#broker.listConnections(connection.provider)
    const remote = remoteConnections.find((candidate) => candidate.connectionId === connection.nangoConnectionId)
    if (remote === undefined) {
      await this.#store.updateConnectionHealth(connection.connectionId, "disconnected", null, this.#now())
      return this.#connectionView(await this.#requireConnection(connection.connectionId))
    }
    const refreshed = await this.#persistBrokerConnection(connection.provider, remote)
    await this.#refreshResources(refreshed)
    return this.#connectionView(await this.#requireConnection(connection.connectionId))
  }

  async disconnect(connectionId: string) {
    const connection = await this.#requireConnection(connectionId)
    if (connection.status !== "disconnected") {
      await this.#broker.revoke(this.#brokerConnection(connection))
    }
    await this.#store.updateConnectionHealth(connection.connectionId, "disconnected", null, this.#now())
    return this.#connectionView(await this.#requireConnection(connection.connectionId))
  }

  async #persistBrokerConnection(provider: IntegrationProvider, connection: BrokerConnection) {
    return this.#store.upsertConnection({
      provider,
      providerConfigKey: connection.providerConfigKey,
      nangoConnectionId: connection.connectionId,
      displayName: connection.displayName,
      status: connection.healthy ? "connected" : "degraded",
      errorCode: connection.errorCode,
      checkedAt: this.#now()
    })
  }

  async #refreshResources(connection: IntegrationConnectionRecord): Promise<void> {
    if (connection.status === "disconnected") {
      return
    }
    try {
      if (connection.provider === "github") {
        const repositories: Array<z.infer<typeof GitHubRepositoriesSchema>["repositories"][number]> = []
        let page = 1
        let totalCount = 0
        do {
          const response = GitHubRepositoriesSchema.parse(
            await this.#broker.request(this.#brokerConnection(connection), {
              method: "GET",
              endpoint: "/installation/repositories",
              params: { per_page: 100, page }
            })
          )
          repositories.push(...response.repositories)
          totalCount = response.total_count
          page += 1
        } while (repositories.length < totalCount)
        await this.#store.replaceDiscoveredResources(
          connection.connectionId,
          "repository",
          repositories
            .filter((repository) => !repository.archived)
            .map((repository) => ({ externalId: String(repository.id), name: repository.full_name })),
          this.#now()
        )
      } else {
        const teams: Array<{ id: string; key: string; name: string }> = []
        let cursor: string | null = null
        let hasNextPage = true
        while (hasNextPage) {
          const response = LinearTeamsSchema.parse(
            await this.#broker.request(this.#brokerConnection(connection), {
              method: "POST",
              endpoint: "/graphql",
              headers: { "Content-Type": "application/json" },
              data: {
                query:
                  "query AgencyIntegrationTeams($after: String) { teams(first: 100, after: $after) { nodes { id key name } pageInfo { hasNextPage endCursor } } }",
                variables: { after: cursor }
              }
            })
          )
          if (response.data === undefined || response.errors !== undefined) {
            throw new Error("Linear team discovery failed")
          }
          teams.push(...response.data.teams.nodes)
          hasNextPage = response.data.teams.pageInfo.hasNextPage
          cursor = response.data.teams.pageInfo.endCursor
        }
        await this.#store.replaceDiscoveredResources(
          connection.connectionId,
          "team",
          teams.map((team) => ({ externalId: team.id, name: `${team.key} ${team.name}` })),
          this.#now()
        )
      }
    } catch {
      await this.#store.updateConnectionHealth(
        connection.connectionId,
        "degraded",
        "resource_discovery_failed",
        this.#now()
      )
    }
  }

  async #connectionView(connection: IntegrationConnectionRecord) {
    const resources = await this.#store.listResources(connection.connectionId)
    return IntegrationConnectionSchema.parse({
      connectionId: connection.connectionId,
      provider: connection.provider,
      displayName: connection.displayName,
      status: connection.status,
      errorCode: connection.errorCode,
      lastCheckedAt: connection.lastCheckedAt?.toISOString() ?? null,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
      resources: resources.map((resource) => ({
        resourceType: resource.resourceType,
        externalId: resource.externalId,
        name: resource.name,
        capabilities: resourceCapabilities(connection.provider, resource.resourceType),
        stale: resource.stale,
        lastDiscoveredAt: resource.lastDiscoveredAt.toISOString()
      }))
    })
  }

  async #requireConnection(connectionId: string): Promise<IntegrationConnectionRecord> {
    const connection = await this.#store.getConnection(connectionId)
    if (connection === null) {
      throw new Error("Integration connection not found")
    }
    return connection
  }

  #brokerConnection(connection: IntegrationConnectionRecord): BrokerConnection {
    return {
      providerConfigKey: connection.providerConfigKey,
      connectionId: connection.nangoConnectionId,
      displayName: connection.displayName,
      healthy: connection.status === "connected",
      errorCode: connection.errorCode
    }
  }

  #integrationId(provider: IntegrationProvider): string {
    return provider === "github" ? this.#options.githubIntegrationId : this.#options.linearIntegrationId
  }
}
