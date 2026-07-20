import type { IntegrationProvider } from "./contracts"

export type BrokerConnection = {
  providerConfigKey: string
  connectionId: string
  displayName: string | null
  healthy: boolean
  errorCode: string | null
}

export type BrokerAuthorizationSession = {
  token: string
  connectLink: string
  expiresAt: string
}

export interface IntegrationCredentialBroker {
  createAuthorizationSession(provider: IntegrationProvider): Promise<BrokerAuthorizationSession>
  createReconnectSession(connection: BrokerConnection): Promise<BrokerAuthorizationSession>
  listConnections(provider: IntegrationProvider): Promise<BrokerConnection[]>
  revoke(connection: BrokerConnection): Promise<void>
  request(
    connection: BrokerConnection,
    request: {
      method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
      endpoint: string
      headers?: Record<string, string>
      params?: Record<string, string | number>
      data?: unknown
      baseUrlOverride?: string
    }
  ): Promise<unknown>
}
