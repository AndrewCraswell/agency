import { createHmac } from "node:crypto"
import { once } from "node:events"
import { Nango } from "@nangohq/node"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { LinearCandidateListSchema, LinearTaskGraphSchema } from "../contracts/linear"
import type { TraceReference } from "../observability/tracing"
import type {
  BindWorkflowRunInput,
  ControlPlaneStore,
  WorkflowEventRecord,
  WorkflowRunRecord,
  WorkspaceLeaseInput,
  WorkspaceLeaseRecord,
  WorkspaceLeaseTransition
} from "../persistence/controlPlaneStore"
import type { ProviderDeliveryStore } from "../persistence/providerDeliveryStore"
import { createControlPlaneServer } from "./server"
import { ControlPlaneService } from "./service"

const openServers: ReturnType<typeof createControlPlaneServer>[] = []
const now = new Date("2026-07-19T05:20:00.000Z")
const workItemId = "96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57"

class HttpTestStore implements ControlPlaneStore {
  record: WorkflowRunRecord | null = null

  async bindWorkflowRun(input: BindWorkflowRunInput): Promise<WorkflowRunRecord> {
    const record: WorkflowRunRecord = {
      ...input,
      sourceWorkItemId: input.sourceWorkItemId ?? null,
      sourceWorkItemIdentifier: input.sourceWorkItemIdentifier ?? null,
      assignedAgentId: input.assignedAgentId ?? null,
      status: "queued",
      stage: "intake",
      activeRole: null,
      pullRequestNumber: null,
      retryCount: 0,
      nextAttemptAt: null,
      createdAt: now,
      updatedAt: now
    }
    this.record = record
    return record
  }

  assignWorkflowRun(): Promise<WorkflowRunRecord> {
    throw new Error("Not used by this test")
  }

  findActiveWorkflowRunByWorkItem(): Promise<WorkflowRunRecord | null> {
    return Promise.resolve(this.record)
  }

  listWorkflowRuns(): Promise<WorkflowRunRecord[]> {
    return Promise.resolve(this.record === null ? [] : [this.record])
  }

  getWorkflowRun(): Promise<WorkflowRunRecord | null> {
    return Promise.resolve(this.record)
  }

  listWorkflowEvents(): Promise<WorkflowEventRecord[]> {
    return Promise.resolve([])
  }

  recordWorkflowEvent(): Promise<void> {
    return Promise.resolve()
  }

  recordTrace(_runId: string, _reference: TraceReference): Promise<void> {
    return Promise.resolve()
  }

  setWorkflowProgress(): Promise<WorkflowRunRecord> {
    throw new Error("Not used by this test")
  }

  persistWorkflowState(): Promise<WorkflowRunRecord> {
    throw new Error("Not used by this test")
  }

  createWorkspaceLease(_input: WorkspaceLeaseInput): Promise<WorkspaceLeaseRecord> {
    throw new Error("Not used by this test")
  }

  transitionWorkspaceLease(_input: WorkspaceLeaseTransition): Promise<WorkspaceLeaseRecord> {
    throw new Error("Not used by this test")
  }
}

function candidates() {
  return LinearCandidateListSchema.parse({
    schemaVersion: "1",
    fetchedAt: now.toISOString(),
    team: { id: "9539b499-1c48-4770-ab32-da1cbda14d57", key: "FEN", name: "Frontend" },
    issues: [
      {
        schemaVersion: "1",
        source: "linear",
        id: workItemId,
        identifier: "FEN-42",
        title: "Add profile helper tests",
        description: "Add focused unit coverage.",
        url: "https://linear.app/example/issue/FEN-42",
        priority: 4,
        createdAt: "2026-07-01T05:20:00.000Z",
        updatedAt: now.toISOString(),
        state: { id: "dff7a1a0-2c52-4e3f-a325-90d314f81820", name: "Todo", type: "unstarted" },
        team: { id: "9539b499-1c48-4770-ab32-da1cbda14d57", key: "FEN", name: "Frontend" }
      }
    ]
  })
}

function taskGraph() {
  const candidateList = candidates()
  return LinearTaskGraphSchema.parse({
    schemaVersion: "1",
    fetchedAt: candidateList.fetchedAt,
    team: candidateList.team,
    tasks: candidateList.issues.map((issue) => ({ ...issue, project: null, blockedBy: [], blocks: [] })),
    edges: [],
    levels: [{ depth: 0, taskIds: candidateList.issues.map((issue) => issue.id) }],
    readyTaskIds: candidateList.issues.map((issue) => issue.id),
    blockedTaskIds: []
  })
}

async function startServer(
  webhookService?: Parameters<typeof createControlPlaneServer>[2],
  nangoWebhookReceiver?: Parameters<typeof createControlPlaneServer>[3],
  integrationService?: Parameters<typeof createControlPlaneServer>[4],
  workflowService?: Parameters<typeof createControlPlaneServer>[5],
  providerDeliveryStore?: Parameters<typeof createControlPlaneServer>[7]
) {
  const store = new HttpTestStore()
  const service = new ControlPlaneService(
    { listCandidates: async () => candidates(), listTaskGraph: async () => taskGraph() },
    store,
    { repositoryOwner: "AndrewCraswell", repositoryName: "agency" },
    { now: () => now, runId: () => "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1" }
  )
  const server = createControlPlaneServer(
    service,
    "http://localhost:5173",
    webhookService,
    nangoWebhookReceiver,
    integrationService,
    workflowService,
    undefined,
    providerDeliveryStore
  )
  openServers.push(server)
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected an IP server address")
  }
  return `http://127.0.0.1:${address.port}`
}

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))
  )
})

describe("control-plane HTTP server", () => {
  it("serves the dashboard and creates an assignment", async () => {
    const baseUrl = await startServer()

    const snapshot = await fetch(`${baseUrl}/api/control-plane`)
    expect(snapshot.status).toBe(200)
    await expect(snapshot.json()).resolves.toMatchObject({ tasks: [{ identifier: "FEN-42" }], runs: [] })

    const topology = await fetch(`${baseUrl}/api/control-plane/topology`)
    expect(topology.status).toBe(200)
    await expect(topology.json()).resolves.toMatchObject({
      graphVersion: "delivery-v1",
      nodes: expect.arrayContaining([expect.objectContaining({ id: "planning" })])
    })

    const assignment = await fetch(`${baseUrl}/api/control-plane/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workItemId, agentId: "engineer" })
    })
    expect(assignment.status).toBe(201)
    expect(assignment.headers.get("access-control-allow-origin")).toBe("http://localhost:5173")
    await expect(assignment.json()).resolves.toMatchObject({ created: true, run: { status: "queued" } })
  })

  it("serves independently polled runs and queryable work items", async () => {
    const baseUrl = await startServer()

    const runs = await fetch(`${baseUrl}/api/control-plane/runs`)
    expect(runs.status).toBe(200)
    await expect(runs.json()).resolves.toMatchObject({ agents: expect.any(Array), runs: [] })

    const workItems = await fetch(
      `${baseUrl}/api/control-plane/work-items?q=profile&priority=4&sort=identifier&direction=asc&pageSize=1`
    )
    expect(workItems.status).toBe(200)
    await expect(workItems.json()).resolves.toMatchObject({
      total: 1,
      items: [{ task: { identifier: "FEN-42" }, status: "todo" }],
      nextCursor: null
    })

    const invalid = await fetch(`${baseUrl}/api/control-plane/work-items?status=unknown`)
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toMatchObject({ fieldErrors: [{ field: "status" }] })
  })

  it("returns bounded JSON errors for malformed and unknown requests", async () => {
    const baseUrl = await startServer()

    const malformed = await fetch(`${baseUrl}/api/control-plane/assign`, { method: "POST", body: "{" })
    expect(malformed.status).toBe(400)
    await expect(malformed.json()).resolves.toEqual({
      error: expect.stringContaining("Expected property name or '}' in JSON at position 1")
    })

    const missing = await fetch(`${baseUrl}/missing`)
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toEqual({ error: "Route not found" })
  })

  it("returns structured field errors for invalid workflow creation", async () => {
    const workflowService = {
      create: vi.fn(async () => {
        throw new z.ZodError([{ code: "custom", path: ["name"], message: "Enter a workflow name." }])
      })
    }
    const baseUrl = await startServer(undefined, undefined, undefined, workflowService as never)

    const response = await fetch(`${baseUrl}/api/workflows`, {
      method: "POST",
      body: JSON.stringify({ template: "blank", name: "" })
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      fieldErrors: [{ field: "name", message: "Enter a workflow name." }]
    })
  })

  it("serves health and CORS preflight requests", async () => {
    const baseUrl = await startServer()

    const health = await fetch(`${baseUrl}/api/health`)
    expect(health.status).toBe(200)
    await expect(health.json()).resolves.toEqual({ status: "ok" })

    const preflight = await fetch(`${baseUrl}/api/control-plane`, {
      method: "OPTIONS",
      headers: { Origin: "http://127.0.0.1:5173" }
    })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173")
    expect(preflight.headers.get("access-control-allow-methods")).toBe("DELETE,GET,PATCH,POST,PUT,OPTIONS")
  })

  it("routes the complete workflow lifecycle", async () => {
    const workflowId = "3195de29-2774-4272-be07-6ed600cefd51"
    const scheduleId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e36"
    const workflowService = {
      list: vi.fn(async () => [{ workflowId }]),
      create: vi.fn(async (input) => ({ workflowId, input })),
      delete: vi.fn(async () => ({ workflowId, deleted: true })),
      schedules: vi.fn(async () => [{ workflowId, scheduleId }]),
      updateSchedule: vi.fn(async (_scheduleId, input) => ({ workflowId, scheduleId, revision: 2, input })),
      definitions: vi.fn(() => ({ schemaVersion: "1", definitions: [{ kind: "manual_trigger" }] })),
      draft: vi.fn(async () => ({ workflowId, revision: 1 })),
      updateDraft: vi.fn(async (_id, input) => ({ workflowId, revision: 2, input })),
      validate: vi.fn(async () => ({ valid: true, issues: [] })),
      publish: vi.fn(async () => ({ workflowId, version: 1 })),
      test: vi.fn(async (_id, input) => ({
        runId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e30",
        created: true,
        source: { kind: "draft_test", draftRevision: 1 },
        input
      })),
      start: vi.fn(async (_id, input) => ({ workflowId, runId: "run-1", input })),
      runDetail: vi.fn(async (runId) => ({ schemaVersion: "1", run: { runId, status: "running" } })),
      cancelRun: vi.fn(async (runId, input) => ({ schemaVersion: "1", run: { runId, status: "cancelled", input } })),
      receiveWebhook: vi.fn(async () => [])
    }
    const baseUrl = await startServer(undefined, undefined, undefined, workflowService as never)

    await expect((await fetch(`${baseUrl}/api/workflows`)).json()).resolves.toEqual([{ workflowId }])
    const createRequest = {
      template: "blank",
      name: "Deliver Linear task",
      description: "",
      repository: {
        connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
        provider: "github",
        resourceType: "repository",
        externalId: "42",
        name: "octo/agency",
        capabilities: ["repository.read", "pull_request.write"]
      }
    }
    const created = await fetch(`${baseUrl}/api/workflows`, {
      method: "POST",
      body: JSON.stringify(createRequest)
    })
    expect(created.status).toBe(201)
    expect(workflowService.create).toHaveBeenCalledWith(createRequest)
    const deleted = await fetch(`${baseUrl}/api/workflows/${workflowId}`, { method: "DELETE" })
    expect(deleted.status).toBe(200)
    await expect(deleted.json()).resolves.toEqual({ workflowId, deleted: true })
    expect(workflowService.delete).toHaveBeenCalledWith(workflowId)
    await expect((await fetch(`${baseUrl}/api/workflows/schedules`)).json()).resolves.toEqual([
      { workflowId, scheduleId }
    ])
    const updatedSchedule = await fetch(`${baseUrl}/api/workflows/schedules/${scheduleId}`, {
      method: "PATCH",
      body: JSON.stringify({ expectedRevision: 1, enabled: false, intervalSeconds: 600 })
    })
    expect(updatedSchedule.status).toBe(200)
    expect(workflowService.updateSchedule).toHaveBeenCalledWith(scheduleId, {
      expectedRevision: 1,
      enabled: false,
      intervalSeconds: 600
    })
    await expect((await fetch(`${baseUrl}/api/workflows/steps`)).json()).resolves.toEqual({
      schemaVersion: "1",
      definitions: [{ kind: "manual_trigger" }]
    })
    await expect((await fetch(`${baseUrl}/api/workflows/${workflowId}/draft`)).json()).resolves.toMatchObject({
      revision: 1
    })

    const updated = await fetch(`${baseUrl}/api/workflows/${workflowId}/draft`, {
      method: "PATCH",
      body: JSON.stringify({ revision: 1 })
    })
    await expect(updated.json()).resolves.toMatchObject({ revision: 2 })
    expect(workflowService.updateDraft).toHaveBeenCalledWith(workflowId, { revision: 1 })

    await expect(
      (await fetch(`${baseUrl}/api/workflows/${workflowId}/validate`, { method: "POST" })).json()
    ).resolves.toMatchObject({ valid: true })
    await expect(
      (await fetch(`${baseUrl}/api/workflows/${workflowId}/publish`, { method: "POST" })).json()
    ).resolves.toMatchObject({ version: 1 })
    await expect(
      (
        await fetch(`${baseUrl}/api/workflows/${workflowId}/test`, {
          method: "POST",
          body: JSON.stringify({ expectedRevision: 1, triggerStepId: "manual", input: { issue: "FEN-423" } })
        })
      ).json()
    ).resolves.toMatchObject({
      runId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e30",
      source: { kind: "draft_test", draftRevision: 1 }
    })
    const started = await fetch(`${baseUrl}/api/workflows/${workflowId}/runs`, {
      method: "POST",
      body: JSON.stringify({ version: 1, trigger: { type: "manual" } })
    })
    expect(started.status).toBe(201)
    await expect(started.json()).resolves.toMatchObject({ runId: "run-1" })
    await expect((await fetch(`${baseUrl}/api/workflow-runs/${workflowId}`)).json()).resolves.toMatchObject({
      schemaVersion: "1",
      run: { runId: workflowId, status: "running" }
    })
    expect(workflowService.runDetail).toHaveBeenCalledWith(workflowId)
    const cancelled = await fetch(`${baseUrl}/api/workflow-runs/${workflowId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Operator stopped the run" })
    })
    await expect(cancelled.json()).resolves.toMatchObject({ run: { status: "cancelled" } })
    expect(workflowService.cancelRun).toHaveBeenCalledWith(workflowId, { reason: "Operator stopped the run" })
  })

  it("routes the complete integration lifecycle", async () => {
    const connectionId = "86b72ec2-1c25-4712-b298-0fb4cd888ee4"
    const integrationService = {
      settings: vi.fn(async () => ({ connections: [] })),
      startAuthorization: vi.fn(async () => ({ token: "connect-token" })),
      completeAuthorization: vi.fn(async () => ({ connectionId })),
      startReconnect: vi.fn(async () => ({ token: "reconnect-token" })),
      reconcile: vi.fn(async () => ({ checked: 1 })),
      refresh: vi.fn(async () => ({ connectionId, status: "connected" })),
      inventory: vi.fn(async () => ({ schemaVersion: "2", resources: [] })),
      disconnect: vi.fn(async () => ({ connectionId, status: "disconnected" }))
    }
    const baseUrl = await startServer(undefined, undefined, integrationService as never)

    await expect((await fetch(`${baseUrl}/api/integrations`)).json()).resolves.toEqual({ connections: [] })
    const authorize = await fetch(`${baseUrl}/api/integrations/authorize`, {
      method: "POST",
      body: JSON.stringify({ provider: "github" })
    })
    expect(authorize.status).toBe(201)
    await fetch(`${baseUrl}/api/integrations/complete`, { method: "POST", body: "{}" })
    await fetch(`${baseUrl}/api/integrations/reconnect`, { method: "POST", body: "{}" })
    await fetch(`${baseUrl}/api/integrations/reconcile`, { method: "POST" })
    await fetch(`${baseUrl}/api/integrations/resources?capability=repository.read`)
    await fetch(`${baseUrl}/api/integrations/connections/${connectionId}`, { method: "POST" })
    const disconnected = await fetch(`${baseUrl}/api/integrations/connections/${connectionId}`, {
      method: "DELETE"
    })

    expect(integrationService.startAuthorization).toHaveBeenCalledWith({ provider: "github" })
    expect(integrationService.completeAuthorization).toHaveBeenCalledWith({})
    expect(integrationService.startReconnect).toHaveBeenCalledWith({})
    expect(integrationService.reconcile).toHaveBeenCalledOnce()
    expect(integrationService.inventory).toHaveBeenCalledWith({ capability: "repository.read" })
    expect(integrationService.refresh).toHaveBeenCalledWith(connectionId)
    expect(disconnected.status).toBe(200)
    expect(integrationService.disconnect).toHaveBeenCalledWith(connectionId)
  })

  it("validates and accepts GitHub webhook deliveries", async () => {
    const receive = vi.fn().mockResolvedValueOnce({ created: true }).mockResolvedValueOnce({ created: false })
    const baseUrl = await startServer({ receive } as never)

    const unsupported = await fetch(`${baseUrl}/api/webhooks/github`, { method: "POST", body: "{}" })
    expect(unsupported.status).toBe(415)
    await expect(unsupported.json()).resolves.toEqual({ error: "Expected application/json" })

    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "X-GitHub-Delivery": "delivery-1",
      "X-GitHub-Event": "pull_request",
      "X-Hub-Signature-256": "sha256=signature"
    }
    const accepted = await fetch(`${baseUrl}/api/webhooks/github`, { method: "POST", headers, body: "{}" })
    expect(accepted.status).toBe(202)
    await expect(accepted.json()).resolves.toEqual({ accepted: true, duplicate: false })

    const duplicate = await fetch(`${baseUrl}/api/webhooks/github`, { method: "POST", headers, body: "{}" })
    await expect(duplicate.json()).resolves.toEqual({ accepted: true, duplicate: true })
    expect(receive).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryId: "delivery-1",
        eventName: "pull_request",
        signature: "sha256=signature",
        rawBody: Buffer.from("{}")
      })
    )
  })

  it("verifies and acknowledges Nango webhook deliveries", async () => {
    const signingKey = "nango-webhook-signing-key"
    const nango = new Nango({ apiKey: "nango-api-key", webhookSigningKey: signingKey })
    const events: string[] = []
    const onAcceptedWebhook = vi.fn(() => events.push("logged"))
    const insert = vi.fn(async () => {
      events.push("persisted")
      return { created: true, record: {} as never }
    })
    const providerDeliveryStore = { insert } as unknown as ProviderDeliveryStore
    const baseUrl = await startServer(
      undefined,
      {
        verifyIncomingWebhookRequest: (body, headers) => nango.verifyIncomingWebhookRequest(body, headers),
        onAcceptedWebhook
      },
      undefined,
      undefined,
      providerDeliveryStore
    )
    const body = JSON.stringify({
      type: "forward",
      from: "linear",
      connectionId: "linear-connection",
      providerConfigKey: "linear",
      payload: {
        action: "create",
        type: "Issue",
        data: { title: "Secret work item title", description: "Sensitive work item description" }
      }
    })

    const unsigned = await fetch(`${baseUrl}/api/webhooks/nango`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    })
    expect(unsigned.status).toBe(401)
    await expect(unsigned.json()).resolves.toEqual({ error: "Invalid Nango webhook signature" })

    const invalid = await fetch(`${baseUrl}/api/webhooks/nango`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nango-Hmac-Sha256": "invalid" },
      body
    })
    expect(invalid.status).toBe(401)

    const signature = createHmac("sha256", signingKey).update(body).digest("hex")
    const accepted = await fetch(`${baseUrl}/api/webhooks/nango`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nango-Hmac-Sha256": signature },
      body
    })
    expect(accepted.status).toBe(202)
    await expect(accepted.json()).resolves.toEqual({ accepted: true, duplicate: false })
    expect(events).toEqual(["persisted", "logged"])
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ providerEventAction: "create", providerObjectType: "Issue" }),
      expect.stringMatching(/^[0-9a-f]{64}$/u),
      expect.stringMatching(/^[0-9a-f]{64}$/u)
    )
    expect(JSON.stringify(insert.mock.calls)).not.toContain("Secret work item title")
    expect(JSON.stringify(insert.mock.calls)).not.toContain("Sensitive work item description")
    expect(onAcceptedWebhook).toHaveBeenCalledOnce()
    expect(onAcceptedWebhook).toHaveBeenCalledWith({
      webhookType: "forward",
      from: "linear",
      connectionId: "linear-connection",
      providerConfigKey: "linear",
      providerEventAction: "create",
      providerObjectType: "Issue"
    })
    expect(JSON.stringify(onAcceptedWebhook.mock.calls)).not.toContain("Secret work item title")
    expect(JSON.stringify(onAcceptedWebhook.mock.calls)).not.toContain("Sensitive work item description")

    insert.mockResolvedValueOnce({ created: false, record: {} as never })
    onAcceptedWebhook.mockImplementationOnce(() => {
      throw new Error("logging unavailable")
    })
    const duplicate = await fetch(`${baseUrl}/api/webhooks/nango`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nango-Hmac-Sha256": signature },
      body
    })
    expect(duplicate.status).toBe(202)
    await expect(duplicate.json()).resolves.toEqual({ accepted: true, duplicate: true })
  })

  it("rejects oversized request bodies with a bounded conflict", async () => {
    const baseUrl = await startServer()

    const response = await fetch(`${baseUrl}/api/control-plane/assign`, {
      method: "POST",
      body: JSON.stringify({ padding: "x".repeat(65_536) })
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: "Request body exceeds 65536 bytes" })
  })
})
