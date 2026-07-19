import { describe, expect, it } from "vitest"
import { ExecutionHandleSchema, ProviderWorkspaceHandleSchema } from "./agentWorkspace"

describe("workspace contracts", () => {
  it("round-trips serializable provider handles", () => {
    const handle = ProviderWorkspaceHandleSchema.parse({
      schemaVersion: "1",
      provider: "daytona",
      workspaceId: "workspace-1",
      lifecycleState: "running",
      labels: { runId: "run-1", role: "coder" },
      createdAt: "2026-07-19T00:00:00.000Z",
      lastActivityAt: "2026-07-19T00:01:00.000Z"
    })

    expect(ProviderWorkspaceHandleSchema.parse(JSON.parse(JSON.stringify(handle)))).toEqual(handle)
  })

  it("rejects execution handles with live or unknown provider data", () => {
    expect(() =>
      ExecutionHandleSchema.parse({
        schemaVersion: "1",
        provider: "daytona",
        workspaceId: "workspace-1",
        executionId: "execution-1",
        status: "running",
        startedAt: "2026-07-19T00:00:00.000Z",
        endedAt: null,
        sdkClient: { request: () => undefined }
      })
    ).toThrow()
  })
})
