import { describe, expect, it, vi } from "vitest"
import { createNangoGitHubTokenProvider } from "./nangoTokenProvider"

function client(connectionIds: string[], credentials: unknown = { type: "APP", access_token: "github-token" }) {
  return {
    listConnections: vi.fn(async () => ({
      connections: connectionIds.map((connectionId) => ({ connection_id: connectionId }))
    })),
    getToken: vi.fn(async () => credentials)
  }
}

describe("createNangoGitHubTokenProvider", () => {
  it("discovers and reuses the only connection for an integration", async () => {
    const nango = client(["connection-1"])
    const tokenProvider = createNangoGitHubTokenProvider({ apiKey: "nango-key" }, nango)

    await expect(tokenProvider()).resolves.toBe("github-token")
    await expect(tokenProvider()).resolves.toBe("github-token")

    expect(nango.listConnections).toHaveBeenCalledOnce()
    expect(nango.getToken).toHaveBeenCalledWith("github-app", "connection-1")
  })

  it("uses an explicitly configured integration and connection", async () => {
    const nango = client([])
    const tokenProvider = createNangoGitHubTokenProvider(
      { apiKey: "nango-key", integrationId: "agency-github", connectionId: "connection-2" },
      nango
    )

    await expect(tokenProvider()).resolves.toBe("github-token")
    expect(nango.listConnections).not.toHaveBeenCalled()
    expect(nango.getToken).toHaveBeenCalledWith("agency-github", "connection-2")
  })

  it.each([
    { name: "missing", connections: [] },
    { name: "multiple", connections: ["connection-1", "connection-2"] }
  ])("rejects $name connection discovery", async ({ connections }) => {
    const tokenProvider = createNangoGitHubTokenProvider({ apiKey: "nango-key" }, client(connections))

    await expect(tokenProvider()).rejects.toThrow(`found ${connections.length}`)
  })

  it("rejects credentials that are not a GitHub App access token", async () => {
    const tokenProvider = createNangoGitHubTokenProvider(
      { apiKey: "nango-key" },
      client(["connection-1"], { type: "OAUTH2", access_token: "wrong-token-type" })
    )

    await expect(tokenProvider()).rejects.toThrow()
  })
})
