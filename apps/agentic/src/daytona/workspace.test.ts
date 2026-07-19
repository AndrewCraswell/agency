import { describe, expect, it, vi } from "vitest"
import {
  DaytonaWorkspace,
  type DaytonaClientPort,
  type DaytonaSandboxPort,
  type DaytonaWorkspaceOptions,
  type WorkspaceLogger,
  waitForHttpReadiness,
  withDaytonaWorkspace
} from "./workspace"

type ReadinessFetcher = NonNullable<Parameters<typeof waitForHttpReadiness>[1]>
type ReadinessWait = NonNullable<Parameters<typeof waitForHttpReadiness>[2]>

const workspaceOptions: DaytonaWorkspaceOptions = {
  image: "ghcr.io/openhands/agent-server:1.2.3",
  resources: {
    cpu: 2,
    memory: 4,
    disk: 20
  },
  labels: {
    runId: "run-1",
    role: "coder",
    repositoryHash: "repository-hash",
    promptVersion: "coder-v1",
    environment: "development"
  },
  retention: {
    autoArchiveMinutes: 1_440,
    autoDeleteMinutes: -1
  },
  createTimeoutMs: 90_000
}

class FakeSandbox implements DaytonaSandboxPort {
  id = "sandbox-1"
  state = "started"
  createdAt = "2026-07-18T20:00:00.000Z"
  lastActivityAt = "2026-07-18T20:01:00.000Z"
  cpu = 2
  memory = 4
  disk = 20
  labels = { runId: "run-1" }
  stopCalls = 0
  archiveCalls = 0
  deleteCalls = 0
  autostopIntervals: number[] = []
  uploadedContent: Buffer | null = null
  commandError: Error | null = null
  previewCalls: Array<{ port: number; expiresInSeconds?: number }> = []
  sessions: string[] = []
  sessionCommands: Array<{ sessionId: string; command: string; runAsync: boolean; timeoutSeconds?: number }> = []

  process = {
    executeCommand: async () => {
      if (this.commandError !== null) {
        throw this.commandError
      }
      return { exitCode: 0, result: "command output" }
    },
    createSession: async (sessionId: string) => {
      this.sessions.push(sessionId)
    },
    executeSessionCommand: async (
      sessionId: string,
      request: { command: string; runAsync: boolean },
      timeoutSeconds?: number
    ) => {
      this.sessionCommands.push({ sessionId, ...request, timeoutSeconds })
      return { cmdId: "command-1" }
    },
    getSessionCommand: async () => ({ exitCode: 17 }),
    getSessionCommandLogs: async () => ({ stdout: "server stdout", stderr: "server stderr" })
  }

  fs = {
    uploadFile: async (content: Buffer) => {
      this.uploadedContent = content
    },
    downloadFile: async () => Buffer.from([0, 255, 1, 254])
  }

  refreshData(): Promise<void> {
    return Promise.resolve()
  }

  async setAutostopInterval(intervalMinutes: number): Promise<void> {
    this.autostopIntervals.push(intervalMinutes)
  }

  async start(): Promise<void> {
    this.state = "started"
  }

  async stop(): Promise<void> {
    this.stopCalls += 1
    this.state = "stopped"
  }

  async archive(): Promise<void> {
    this.archiveCalls += 1
    this.state = "archived"
  }

  async delete(): Promise<void> {
    this.deleteCalls += 1
    this.state = "destroyed"
  }

  async getSignedPreviewUrl(port: number, expiresInSeconds?: number): Promise<{ url: string; token: string }> {
    this.previewCalls.push({ port, expiresInSeconds })
    return { url: `https://preview.example/${port}`, token: "preview-token" }
  }
}

class FakeClient implements DaytonaClientPort {
  readonly sandbox: FakeSandbox
  createParams: Parameters<DaytonaClientPort["create"]>[0] | null = null
  createOptions: Parameters<DaytonaClientPort["create"]>[1] | null = null
  createError: Error | null = null

  constructor(sandbox = new FakeSandbox()) {
    this.sandbox = sandbox
  }

  async create(
    params: Parameters<DaytonaClientPort["create"]>[0],
    options: Parameters<DaytonaClientPort["create"]>[1]
  ): Promise<DaytonaSandboxPort> {
    if (this.createError !== null) {
      throw this.createError
    }
    this.createParams = params
    this.createOptions = options
    return this.sandbox
  }
}

describe("DaytonaWorkspace", () => {
  it("creates a private persistent workspace with explicit policy", async () => {
    const client = new FakeClient()

    const workspace = await DaytonaWorkspace.create(client, workspaceOptions)

    expect(client.createParams).toEqual({
      image: workspaceOptions.image,
      resources: workspaceOptions.resources,
      labels: workspaceOptions.labels,
      public: false,
      ephemeral: false,
      autoStopInterval: 30,
      autoArchiveInterval: 1_440,
      autoDeleteInterval: -1
    })
    expect(client.createOptions).toEqual({ timeout: 90 })
    expect(client.sandbox.autostopIntervals).toEqual([30])
    expect(workspace.describe()).toMatchObject({
      provider: "daytona",
      workspaceId: "sandbox-1",
      state: "started"
    })
  })

  it("rejects an unpinned image before creating a workspace", async () => {
    const client = new FakeClient()

    await expect(DaytonaWorkspace.create(client, { ...workspaceOptions, image: "ubuntu:latest" })).rejects.toThrow(
      "must use an immutable digest or an explicit non-latest tag"
    )
    expect(client.createParams).toBeNull()
  })

  it("propagates workspace creation failures", async () => {
    const client = new FakeClient()
    client.createError = new Error("provider unavailable")

    await expect(DaytonaWorkspace.create(client, workspaceOptions)).rejects.toThrow("provider unavailable")
  })

  it("classifies command timeouts without exposing environment values to logs", async () => {
    const client = new FakeClient()
    const timeoutError = new Error("timed out")
    timeoutError.name = "DaytonaTimeoutError"
    client.sandbox.commandError = timeoutError
    const debug = vi.fn<WorkspaceLogger["debug"]>()
    const workspace = await DaytonaWorkspace.create(client, workspaceOptions, { debug })

    const result = await workspace.executeCommand({
      commandId: "validation",
      command: "pnpm test",
      workingDirectory: "/workspace/repository",
      environment: { SECRET_VALUE: "do-not-log" },
      timeoutMs: 30_001
    })

    expect(result).toEqual({ exitCode: null, output: "", timedOut: true })
    expect(debug.mock.calls.flat()).not.toContain("do-not-log")
    expect(debug).toHaveBeenLastCalledWith(
      "daytona.command.started",
      expect.objectContaining({ environmentKeys: ["SECRET_VALUE"] })
    )
  })

  it("classifies command timeouts returned by the generated API client", async () => {
    const client = new FakeClient()
    client.sandbox.commandError = new Error("request timeout: command execution timeout")
    const workspace = await DaytonaWorkspace.create(client, workspaceOptions)

    await expect(
      workspace.executeCommand({
        commandId: "validation",
        command: "pnpm test",
        workingDirectory: "/workspace/repository",
        timeoutMs: 30_000
      })
    ).resolves.toEqual({ exitCode: null, output: "", timedOut: true })
  })

  it("uploads and downloads binary content without text conversion", async () => {
    const client = new FakeClient()
    const workspace = await DaytonaWorkspace.create(client, workspaceOptions)
    const content = Uint8Array.from([0, 255, 1, 254])

    await workspace.upload(content, "/workspace/context/data.bin", 5_000)
    const downloaded = await workspace.download("/workspace/context/data.bin", 5_000)

    expect(client.sandbox.uploadedContent).toEqual(Buffer.from(content))
    expect(downloaded).toEqual(Buffer.from(content))
  })

  it("returns a bounded signed preview URL", async () => {
    const client = new FakeClient()
    const workspace = await DaytonaWorkspace.create(client, workspaceOptions)

    await expect(workspace.signedPreview(8000, 900)).resolves.toEqual({
      url: "https://preview.example/8000",
      token: "preview-token"
    })
    expect(client.sandbox.previewCalls).toEqual([{ port: 8000, expiresInSeconds: 900 }])
  })

  it("starts a long-running command in an asynchronous session", async () => {
    const client = new FakeClient()
    const debug = vi.fn<WorkspaceLogger["debug"]>()
    const workspace = await DaytonaWorkspace.create(client, workspaceOptions, { debug })

    await expect(workspace.startBackgroundSession("agent-server", "run-server", 10_001)).resolves.toBe("command-1")
    expect(client.sandbox.sessions).toEqual(["agent-server"])
    expect(client.sandbox.sessionCommands).toEqual([
      { sessionId: "agent-server", command: "run-server", runAsync: true, timeoutSeconds: 11 }
    ])
    expect(debug).toHaveBeenLastCalledWith(
      "daytona.session.started",
      expect.objectContaining({ sessionId: "agent-server" })
    )
  })

  it("returns background command status and separated logs", async () => {
    const client = new FakeClient()
    const workspace = await DaytonaWorkspace.create(client, workspaceOptions)

    await expect(workspace.getBackgroundSessionResult("agent-server", "command-1")).resolves.toEqual({
      exitCode: 17,
      stdout: "server stdout",
      stderr: "server stderr"
    })
  })

  it("stops the workspace when an operation fails", async () => {
    const client = new FakeClient()

    await expect(
      withDaytonaWorkspace(client, workspaceOptions, async () => {
        throw new Error("agent failed")
      })
    ).rejects.toThrow("agent failed")
    expect(client.sandbox.stopCalls).toBe(1)
  })

  it("makes repeated cleanup idempotent", async () => {
    const client = new FakeClient()
    const workspace = await DaytonaWorkspace.create(client, workspaceOptions)

    await workspace.cleanup("stop", 60_000)
    await workspace.cleanup("stop", 60_000)

    expect(client.sandbox.stopCalls).toBe(1)
  })
})

describe("waitForHttpReadiness", () => {
  it("returns after a bounded retry succeeds", async () => {
    const fetcher = vi
      .fn<ReadinessFetcher>()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    const wait = vi.fn<ReadinessWait>().mockResolvedValue(undefined)

    await expect(
      waitForHttpReadiness(
        { url: "https://agent.example/health", maxAttempts: 3, requestTimeoutMs: 1_000, intervalMs: 10 },
        fetcher,
        wait
      )
    ).resolves.toEqual({ attempts: 2 })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledTimes(1)
  })

  it("stops after the configured number of attempts", async () => {
    const fetcher = vi.fn<ReadinessFetcher>().mockResolvedValue({ ok: false, status: 503 })
    const wait = vi.fn<ReadinessWait>().mockResolvedValue(undefined)

    await expect(
      waitForHttpReadiness(
        { url: "https://agent.example/health", maxAttempts: 2, requestTimeoutMs: 1_000, intervalMs: 10 },
        fetcher,
        wait
      )
    ).rejects.toThrow("after 2 attempts; last status 503")
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
