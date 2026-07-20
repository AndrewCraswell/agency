import { Nango } from "@nangohq/node"
import { z } from "zod"
import type { BrokerAuthorizationSession, BrokerConnection, IntegrationCredentialBroker } from "./broker"
import { IntegrationProviderSchema, type IntegrationProvider } from "./contracts"

const NangoBrokerOptionsSchema = z
  .object({
    apiKey: z.string().min(1),
    endUserId: z.string().min(1),
    githubIntegrationId: z.string().min(1).default("github-app"),
    linearIntegrationId: z.string().min(1).default("linear")
  })
  .strict()

type NangoConnection = {
  connection_id: string
  provider_config_key: string
  errors: Array<{ type: string }>
  end_user: { display_name?: string | null; email?: string | null } | null
}

type NangoBrokerClient = {
  createConnectSession(input: {
    allowed_integrations: string[]
    end_user: { id: string; display_name: string }
  }): Promise<{ data: { token: string; connect_link: string; expires_at: string } }>
  createReconnectSession(input: {
    connection_id: string
    integration_id: string
    end_user: { id: string; display_name: string }
  }): Promise<{ data: { token: string; connect_link: string; expires_at: string } }>
  listConnections(input: { integrationId: string; userId: string; limit: number }): Promise<{
    connections: NangoConnection[]
  }>
  deleteConnection(providerConfigKey: string, connectionId: string): Promise<unknown>
  proxy<T>(input: {
    providerConfigKey: string
    connectionId: string
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    endpoint: string
    headers?: Record<string, string>
    params?: Record<string, string | number>
    data?: unknown
    baseUrlOverride?: string
  }): Promise<{ data: T }>
}

export type NangoBrokerOptions = z.input<typeof NangoBrokerOptionsSchema>

export class NangoIntegrationCredentialBroker implements IntegrationCredentialBroker {
  readonly #client: NangoBrokerClient
  readonly #options: z.output<typeof NangoBrokerOptionsSchema>

  constructor(options: NangoBrokerOptions, client?: NangoBrokerClient) {
    this.#options = NangoBrokerOptionsSchema.parse(options)
    this.#client = client ?? new Nango({ apiKey: this.#options.apiKey })
  }

  async createAuthorizationSession(providerInput: IntegrationProvider): Promise<BrokerAuthorizationSession> {
    const provider = IntegrationProviderSchema.parse(providerInput)
    const result = await this.#client.createConnectSession({
      allowed_integrations: [this.#integrationId(provider)],
      end_user: { id: this.#options.endUserId, display_name: "Agency local user" }
    })
    return { token: result.data.token, connectLink: result.data.connect_link, expiresAt: result.data.expires_at }
  }

  async createReconnectSession(connection: BrokerConnection): Promise<BrokerAuthorizationSession> {
    const result = await this.#client.createReconnectSession({
      connection_id: connection.connectionId,
      integration_id: connection.providerConfigKey,
      end_user: { id: this.#options.endUserId, display_name: "Agency local user" }
    })
    return { token: result.data.token, connectLink: result.data.connect_link, expiresAt: result.data.expires_at }
  }

  async listConnections(providerInput: IntegrationProvider): Promise<BrokerConnection[]> {
    const provider = IntegrationProviderSchema.parse(providerInput)
    const result = await this.#client.listConnections({
      integrationId: this.#integrationId(provider),
      userId: this.#options.endUserId,
      limit: 100
    })
    return result.connections.map((connection) => ({
      providerConfigKey: connection.provider_config_key,
      connectionId: connection.connection_id,
      displayName: connection.end_user?.display_name ?? connection.end_user?.email ?? null,
      healthy: connection.errors.length === 0,
      errorCode: connection.errors[0]?.type ?? null
    }))
  }

  async revoke(connection: BrokerConnection): Promise<void> {
    await this.#client.deleteConnection(connection.providerConfigKey, connection.connectionId)
  }

  async request(
    connection: BrokerConnection,
    request: {
      method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
      endpoint: string
      headers?: Record<string, string>
      params?: Record<string, string | number>
      data?: unknown
      baseUrlOverride?: string
    }
  ): Promise<unknown> {
    const response = await this.#client.proxy<unknown>({
      providerConfigKey: connection.providerConfigKey,
      connectionId: connection.connectionId,
      ...request
    })
    return response.data
  }

  #integrationId(provider: IntegrationProvider): string {
    return provider === "github" ? this.#options.githubIntegrationId : this.#options.linearIntegrationId
  }
}
