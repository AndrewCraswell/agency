import { describe, expect, it, vi } from "vitest"
import { NangoIntegrationCredentialBroker } from "./nangoBroker"

type TestConnection = {
  connection_id: string
  provider_config_key: string
  errors: Array<{ type: string }>
  end_user: { display_name?: string | null; email?: string | null } | null
}

function client() {
  return {
    createConnectSession: vi.fn(),
    createReconnectSession: vi.fn(),
    listConnections: vi.fn(
      async (): Promise<{ connections: TestConnection[] }> => ({
        connections: [
          {
            connection_id: "linear-connection",
            provider_config_key: "linear",
            errors: [],
            end_user: { display_name: "Agency user" }
          }
        ]
      })
    ),
    deleteConnection: vi.fn(),
    proxy: vi.fn()
  }
}

describe("NangoIntegrationCredentialBroker", () => {
  it("lists only connections owned by the configured Agency end user", async () => {
    const nango = client()
    const broker = new NangoIntegrationCredentialBroker(
      { apiKey: "nango-api-key", endUserId: "agency-user", linearIntegrationId: "linear" },
      nango
    )

    await expect(broker.listConnections("linear")).resolves.toEqual([
      {
        providerConfigKey: "linear",
        connectionId: "linear-connection",
        displayName: "Agency user",
        healthy: true,
        errorCode: null
      }
    ])
    expect(nango.listConnections).toHaveBeenCalledWith({
      integrationId: "linear",
      userId: "agency-user",
      limit: 100
    })
  })

  it("creates scoped authorization and reconnect sessions", async () => {
    const nango = client()
    nango.createConnectSession.mockResolvedValue({
      data: {
        token: "connect-token",
        connect_link: "https://connect.example/session",
        expires_at: "2026-07-19T12:10:00Z"
      }
    })
    nango.createReconnectSession.mockResolvedValue({
      data: {
        token: "reconnect-token",
        connect_link: "https://connect.example/reconnect",
        expires_at: "2026-07-19T12:10:00Z"
      }
    })
    const broker = new NangoIntegrationCredentialBroker(
      { apiKey: "nango-api-key", endUserId: "agency-user", githubIntegrationId: "github-app" },
      nango
    )

    await expect(broker.createAuthorizationSession("github")).resolves.toMatchObject({ token: "connect-token" })
    expect(nango.createConnectSession).toHaveBeenCalledWith({
      allowed_integrations: ["github-app"],
      end_user: { id: "agency-user", display_name: "Agency local user" }
    })

    await expect(
      broker.createReconnectSession({
        providerConfigKey: "github-app",
        connectionId: "github-connection",
        displayName: null,
        healthy: true,
        errorCode: null
      })
    ).resolves.toMatchObject({ token: "reconnect-token" })
  })

  it("maps unhealthy connection metadata, proxies requests, and revokes connections", async () => {
    const nango = client()
    nango.listConnections.mockResolvedValue({
      connections: [
        {
          connection_id: "github-connection",
          provider_config_key: "github-app",
          errors: [{ type: "refresh_failed" }],
          end_user: { email: "agency@example.test" }
        },
        {
          connection_id: "anonymous-connection",
          provider_config_key: "github-app",
          errors: [],
          end_user: null
        }
      ]
    })
    nango.proxy.mockResolvedValue({ data: { ok: true } })
    const broker = new NangoIntegrationCredentialBroker(
      { apiKey: "nango-api-key", endUserId: "agency-user", githubIntegrationId: "github-app" },
      nango
    )
    const connection = {
      providerConfigKey: "github-app",
      connectionId: "github-connection",
      displayName: "agency@example.test",
      healthy: false,
      errorCode: "refresh_failed"
    }

    await expect(broker.listConnections("github")).resolves.toEqual([
      connection,
      {
        providerConfigKey: "github-app",
        connectionId: "anonymous-connection",
        displayName: null,
        healthy: true,
        errorCode: null
      }
    ])
    await expect(broker.request(connection, { method: "GET", endpoint: "/user" })).resolves.toEqual({ ok: true })
    await broker.revoke(connection)
    expect(nango.deleteConnection).toHaveBeenCalledWith("github-app", "github-connection")
  })
})
