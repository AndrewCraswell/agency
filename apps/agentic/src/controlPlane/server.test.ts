import { once } from "node:events"
import { afterEach, describe, expect, it, vi } from "vitest"
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

async function startServer(webhookService?: Parameters<typeof createControlPlaneServer>[2]) {
  const store = new HttpTestStore()
  const service = new ControlPlaneService(
    { listCandidates: async () => candidates(), listTaskGraph: async () => taskGraph() },
    store,
    { repositoryOwner: "AndrewCraswell", repositoryName: "agency" },
    { now: () => now, runId: () => "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1" }
  )
  const server = createControlPlaneServer(service, "http://localhost:5173", webhookService)
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

    const assignment = await fetch(`${baseUrl}/api/control-plane/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workItemId, agentId: "engineer" })
    })
    expect(assignment.status).toBe(201)
    expect(assignment.headers.get("access-control-allow-origin")).toBe("http://localhost:5173")
    await expect(assignment.json()).resolves.toMatchObject({ created: true, run: { status: "queued" } })

    const detail = await fetch(`${baseUrl}/api/control-plane/runs/b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1`)
    expect(detail.status).toBe(200)
    await expect(detail.json()).resolves.toMatchObject({ run: { status: "queued" }, events: [] })
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

  it("serves health and CORS preflight requests", async () => {
    const baseUrl = await startServer()

    const health = await fetch(`${baseUrl}/api/health`)
    expect(health.status).toBe(200)
    await expect(health.json()).resolves.toEqual({ status: "ok" })

    const preflight = await fetch(`${baseUrl}/api/control-plane`, { method: "OPTIONS" })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get("access-control-allow-methods")).toBe("GET,POST,OPTIONS")
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
