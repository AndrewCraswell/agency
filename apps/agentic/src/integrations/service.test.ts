import { randomUUID } from "node:crypto"
import { describe, expect, it, vi } from "vitest"
import type { IntegrationConnectionStore } from "../persistence/integrationStore"
import type { BrokerConnection, IntegrationCredentialBroker } from "./broker"
import { ProviderPortResolver, type ProviderConnectionContext } from "./providerPorts"
import { IntegrationService } from "./service"

const now = new Date("2026-07-19T12:00:00.000Z")

class MemoryIntegrationStore implements IntegrationConnectionStore {
  connections: any[] = []
  resources = new Map<string, any[]>()

  listConnections() {
    return Promise.resolve(this.connections)
  }

  getConnection(connectionId: string) {
    return Promise.resolve(this.connections.find((connection) => connection.connectionId === connectionId) ?? null)
  }

  upsertConnection(input: any) {
    const existing = this.connections.find(
      (connection) =>
        connection.providerConfigKey === input.providerConfigKey &&
        connection.nangoConnectionId === input.nangoConnectionId
    )
    if (existing !== undefined) {
      Object.assign(existing, input, {
        lastCheckedAt: input.checkedAt,
        disconnectedAt: null,
        updatedAt: input.checkedAt
      })
      return Promise.resolve(existing)
    }
    const record = {
      connectionId: randomUUID(),
      ...input,
      lastCheckedAt: input.checkedAt,
      disconnectedAt: null,
      createdAt: input.checkedAt,
      updatedAt: input.checkedAt
    }
    this.connections.push(record)
    return Promise.resolve(record)
  }

  updateConnectionHealth(connectionId: string, status: string, errorCode: string | null, checkedAt: Date) {
    const connection = this.connections.find((candidate) => candidate.connectionId === connectionId)
    Object.assign(connection, {
      status,
      errorCode,
      lastCheckedAt: checkedAt,
      disconnectedAt: status === "disconnected" ? checkedAt : null,
      updatedAt: checkedAt
    })
    return Promise.resolve()
  }

  listResources(connectionId: string) {
    return Promise.resolve(this.resources.get(connectionId) ?? [])
  }

  replaceDiscoveredResources(
    connectionId: string,
    resourceType: string,
    resources: Array<{ externalId: string; name: string }>,
    discoveredAt: Date
  ) {
    const previous = this.resources.get(connectionId) ?? []
    const next = previous.map((resource) =>
      resource.resourceType === resourceType ? { ...resource, stale: true, updatedAt: discoveredAt } : resource
    )
    for (const resource of resources) {
      const existing = next.find(
        (candidate) => candidate.resourceType === resourceType && candidate.externalId === resource.externalId
      )
      if (existing === undefined) {
        next.push({
          connectionId,
          resourceType,
          ...resource,
          stale: false,
          lastDiscoveredAt: discoveredAt,
          updatedAt: discoveredAt
        })
      } else {
        Object.assign(existing, { ...resource, stale: false, lastDiscoveredAt: discoveredAt, updatedAt: discoveredAt })
      }
    }
    this.resources.set(connectionId, next)
    return Promise.resolve()
  }
}

function broker(connections: Partial<Record<"github" | "linear", BrokerConnection[]>>) {
  const request = vi.fn(async (connection: BrokerConnection) => {
    if (connection.providerConfigKey === "github-app") {
      return {
        access_token: "must-not-escape",
        total_count: 1,
        repositories: [{ id: 42, full_name: "agency/platform", archived: false }]
      }
    }
    return {
      data: {
        teams: {
          nodes: [{ id: "team-1", key: "ENG", name: "Engineering" }],
          pageInfo: { hasNextPage: false, endCursor: null }
        }
      }
    }
  })
  const value: IntegrationCredentialBroker = {
    createAuthorizationSession: vi.fn(async () => ({
      token: "short-lived-session-token",
      connectLink: "https://connect.nango.dev/session",
      expiresAt: "2026-07-19T12:10:00.000Z"
    })),
    createReconnectSession: vi.fn(async () => ({
      token: "short-lived-reconnect-token",
      connectLink: "https://connect.nango.dev/reconnect",
      expiresAt: "2026-07-19T12:10:00.000Z"
    })),
    listConnections: vi.fn(async (provider: "github" | "linear") => connections[provider] ?? []),
    revoke: vi.fn(async () => undefined),
    request
  }
  return value
}

describe("IntegrationService", () => {
  it("completes authorization, discovers resources, and redacts credentials", async () => {
    const store = new MemoryIntegrationStore()
    const githubConnection = {
      providerConfigKey: "github-app",
      connectionId: "nango-github-1",
      displayName: "Agency installation",
      healthy: true,
      errorCode: null
    }
    const service = new IntegrationService(broker({ github: [githubConnection] }), store, {}, () => now)

    await expect(service.startAuthorization({ provider: "github" })).resolves.toMatchObject({
      provider: "github",
      token: "short-lived-session-token"
    })
    const connection = await service.completeAuthorization({
      provider: "github",
      providerConfigKey: "github-app",
      nangoConnectionId: "nango-github-1"
    })

    expect(connection).toMatchObject({
      provider: "github",
      status: "connected",
      resources: [{ externalId: "42", name: "agency/platform", stale: false }]
    })
    const serialized = JSON.stringify({
      connection,
      stored: store.connections,
      resources: [...store.resources.values()]
    })
    expect(serialized).not.toContain("must-not-escape")
    expect(serialized).not.toContain("access_token")
  })

  it("exposes only Agency connection identity and bound transport to provider adapters", async () => {
    const store = new MemoryIntegrationStore()
    const remote = {
      providerConfigKey: "github-app",
      connectionId: "nango-github-port",
      displayName: "Agency installation",
      healthy: true,
      errorCode: null
    }
    const fakeBroker = broker({ github: [remote] })
    let receivedContext: ProviderConnectionContext | undefined
    const providerPorts = new ProviderPortResolver([
      {
        provider: "github",
        resourceType: "repository",
        capabilities: ["repository.read"],
        async discover(context) {
          receivedContext = context
          await context.request({ method: "GET", endpoint: "/repositories" })
          return [{ externalId: "repository-1", name: "agency/platform" }]
        }
      }
    ])
    const service = new IntegrationService(fakeBroker, store, {}, () => now, providerPorts)

    const connection = await service.completeAuthorization({
      provider: "github",
      providerConfigKey: "github-app",
      nangoConnectionId: remote.connectionId
    })

    expect(Object.keys(receivedContext ?? {}).sort()).toEqual(["connectionId", "provider", "request"])
    expect(receivedContext).toMatchObject({ connectionId: connection.connectionId, provider: "github" })
    expect(fakeBroker.request).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: remote.connectionId, providerConfigKey: remote.providerConfigKey }),
      { method: "GET", endpoint: "/repositories" }
    )
  })

  it("reconciles Linear resources and marks removed connections disconnected", async () => {
    const store = new MemoryIntegrationStore()
    const remote = {
      providerConfigKey: "linear",
      connectionId: "nango-linear-1",
      displayName: "Linear user",
      healthy: true,
      errorCode: null
    }
    const fakeBroker = broker({ linear: [remote] })
    const service = new IntegrationService(fakeBroker, store, {}, () => now)

    await expect(service.reconcile()).resolves.toMatchObject({ connected: 1, degraded: 0, disconnected: 0 })
    const settings = await service.settings()
    expect(settings.connections[0]).toMatchObject({
      provider: "linear",
      resources: [{ externalId: "team-1", name: "ENG Engineering" }]
    })

    vi.mocked(fakeBroker.listConnections).mockResolvedValue([])
    await expect(service.reconcile()).resolves.toMatchObject({ connected: 0, disconnected: 1 })
  })

  it("exposes capability-filtered inventory without selecting a resource", async () => {
    const store = new MemoryIntegrationStore()
    const remote = {
      providerConfigKey: "github-app",
      connectionId: "nango-github-2",
      displayName: null,
      healthy: true,
      errorCode: null
    }
    const fakeBroker = broker({ github: [remote] })
    const service = new IntegrationService(fakeBroker, store, {}, () => now)
    const connection = await service.completeAuthorization({
      provider: "github",
      providerConfigKey: "github-app",
      nangoConnectionId: remote.connectionId
    })

    await expect(service.inventory({ capability: "repository.read" })).resolves.toMatchObject({
      schemaVersion: "2",
      resources: [
        {
          connectionId: connection.connectionId,
          provider: "github",
          resource: {
            externalId: "42",
            capabilities: ["repository.read", "repository.write", "pull_request.write"]
          }
        }
      ]
    })
    await expect(service.inventory({ capability: "team.read" })).resolves.toMatchObject({ resources: [] })
    await expect(service.disconnect(connection.connectionId)).resolves.toMatchObject({ status: "disconnected" })
    expect(fakeBroker.revoke).toHaveBeenCalledOnce()
  })

  it("projects connection summaries and draft or published disconnect impact", async () => {
    const store = new MemoryIntegrationStore()
    const remote = {
      providerConfigKey: "github-app",
      connectionId: "nango-github-impact",
      displayName: "Agency installation",
      healthy: true,
      errorCode: null
    }
    const fakeBroker = broker({ github: [remote] })
    const draftWorkflowId = randomUUID()
    const publishedWorkflowId = randomUUID()
    let connectionId = ""
    function resourceBindings(value?: string): Record<string, { connectionId: string }> {
      return value === undefined ? {} : { repository: { connectionId: value } }
    }
    type WorkflowReader = NonNullable<ConstructorParameters<typeof IntegrationService>[5]>
    const workflowReader: WorkflowReader = {
      list: vi.fn<WorkflowReader["list"]>(async () => [
        {
          workflowId: draftWorkflowId,
          name: "Draft delivery",
          draft: { resourceBindings: resourceBindings(connectionId) }
        },
        { workflowId: publishedWorkflowId, name: "Published delivery", draft: { resourceBindings: resourceBindings() } }
      ]),
      getActivePublishedVersion: vi.fn<WorkflowReader["getActivePublishedVersion"]>(async (workflowId) =>
        workflowId === publishedWorkflowId ? { content: { resourceBindings: resourceBindings(connectionId) } } : null
      )
    }
    const service = new IntegrationService(fakeBroker, store, {}, () => now, undefined, workflowReader)
    const connection = await service.completeAuthorization({
      provider: "github",
      providerConfigKey: "github-app",
      nangoConnectionId: remote.connectionId
    })
    connectionId = connection.connectionId

    expect(connection).toMatchObject({
      providerAccount: "Agency installation",
      lastSuccessfulSyncAt: now.toISOString(),
      latestError: null,
      resourceCounts: { total: 1, active: 1, stale: 0 },
      capabilities: ["pull_request.write", "repository.read", "repository.write"]
    })
    await expect(service.disconnectImpact(connectionId)).resolves.toEqual({
      connectionId,
      affectedWorkflowCount: 2,
      workflows: [
        { workflowId: draftWorkflowId, name: "Draft delivery", usesDraft: true, usesPublishedVersion: false },
        { workflowId: publishedWorkflowId, name: "Published delivery", usesDraft: false, usesPublishedVersion: true }
      ]
    })
  })

  it("rejects invalid authorization completion and missing local connections", async () => {
    const store = new MemoryIntegrationStore()
    const service = new IntegrationService(broker({ github: [] }), store, {}, () => now)

    await expect(
      service.completeAuthorization({
        provider: "github",
        providerConfigKey: "unexpected",
        nangoConnectionId: "missing"
      })
    ).rejects.toThrow("unexpected integration")
    await expect(
      service.completeAuthorization({
        provider: "github",
        providerConfigKey: "github-app",
        nangoConnectionId: "missing"
      })
    ).rejects.toThrow("Nango connection was not found")
    await expect(service.startReconnect({ connectionId: randomUUID() })).rejects.toThrow(
      "Integration connection not found"
    )
  })

  it("creates reconnect sessions and handles missing remote connections", async () => {
    const store = new MemoryIntegrationStore()
    const remote = {
      providerConfigKey: "github-app",
      connectionId: "nango-github-refresh",
      displayName: "GitHub user",
      healthy: true,
      errorCode: null
    }
    const fakeBroker = broker({ github: [remote] })
    const service = new IntegrationService(fakeBroker, store, {}, () => now)
    const connection = await service.completeAuthorization({
      provider: "github",
      providerConfigKey: "github-app",
      nangoConnectionId: remote.connectionId
    })

    await expect(service.startReconnect({ connectionId: connection.connectionId })).resolves.toMatchObject({
      provider: "github",
      token: "short-lived-reconnect-token"
    })
    vi.mocked(fakeBroker.listConnections).mockResolvedValue([])
    await expect(service.refresh(connection.connectionId)).resolves.toMatchObject({ status: "disconnected" })
    await expect(service.inventory({ capability: "repository.read" })).resolves.toMatchObject({ resources: [] })
    await service.disconnect(connection.connectionId)
    expect(fakeBroker.revoke).not.toHaveBeenCalled()
  })

  it("marks broker and resource discovery failures as degraded", async () => {
    const store = new MemoryIntegrationStore()
    const remote = {
      providerConfigKey: "linear",
      connectionId: "nango-linear-degraded",
      displayName: null,
      healthy: false,
      errorCode: "refresh_failed"
    }
    const fakeBroker = broker({ linear: [remote] })
    vi.mocked(fakeBroker.request).mockResolvedValue({ errors: [{ message: "Unavailable" }] })
    const service = new IntegrationService(fakeBroker, store, {}, () => now)

    await expect(service.reconcile()).resolves.toMatchObject({ degraded: 1 })
    expect(store.connections[0]).toMatchObject({ status: "degraded", errorCode: "resource_discovery_failed" })

    vi.mocked(fakeBroker.listConnections).mockRejectedValue(new Error("Nango unavailable"))
    await expect(service.reconcile()).resolves.toMatchObject({ degraded: 1 })
  })
})
