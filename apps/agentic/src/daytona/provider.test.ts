import { describe, expect, it } from "vitest"
import { DaytonaWorkspaceProvider } from "./provider"
import type { DaytonaClientPort, DaytonaSandboxPort } from "./workspace"

function fakeSandbox(): DaytonaSandboxPort {
  const files = new Map<string, Buffer>()
  const sandbox: DaytonaSandboxPort = {
    id: "workspace-1",
    state: "started",
    createdAt: "2026-07-19T00:00:00.000Z",
    lastActivityAt: "2026-07-19T00:01:00.000Z",
    cpu: 4,
    memory: 8,
    disk: 10,
    labels: {},
    process: {
      executeCommand: async () => ({ exitCode: 0, result: "ok" }),
      createSession: async () => undefined,
      executeSessionCommand: async () => ({ cmdId: "command-1" }),
      getSessionCommand: async () => ({ exitCode: 0 }),
      getSessionCommandLogs: async () => ({ stdout: "ok", stderr: "" })
    },
    fs: {
      uploadFile: async (content, remotePath) => {
        files.set(remotePath, content)
      },
      downloadFile: async (remotePath) => files.get(remotePath) ?? Buffer.alloc(0)
    },
    refreshData: async () => undefined,
    setAutostopInterval: async () => undefined,
    start: async () => {
      sandbox.state = "started"
    },
    stop: async () => {
      sandbox.state = "stopped"
    },
    archive: async () => {
      sandbox.state = "archived"
    },
    delete: async () => {
      sandbox.state = "destroyed"
    },
    getSignedPreviewUrl: async () => ({ url: "https://workspace.example", token: "preview-token" })
  }
  return sandbox
}

describe("DaytonaWorkspaceProvider", () => {
  it("implements the serializable workspace contract without exposing the SDK sandbox", async () => {
    const sandbox = fakeSandbox()
    const client: DaytonaClientPort = {
      create: async (params) => {
        sandbox.labels = params.labels
        return sandbox
      }
    }
    const provider = new DaytonaWorkspaceProvider(client)
    const handle = await provider.create({
      image: "example.test/worker:1.0.0",
      resources: { cpu: 4, memory: 8, disk: 10 },
      labels: {
        runId: "run-1",
        role: "coder",
        repositoryHash: "repository-hash",
        promptVersion: "v1",
        environment: "test"
      },
      retention: { autoArchiveMinutes: 60, autoDeleteMinutes: 120 },
      createTimeoutMs: 30_000
    })

    expect(JSON.parse(JSON.stringify(handle))).toEqual(handle)
    expect(handle).not.toHaveProperty("sandbox")
    await expect(
      provider.executeCommand(handle, {
        commandId: "test",
        command: "true",
        workingDirectory: "/workspace",
        timeoutMs: 1_000
      })
    ).resolves.toEqual({ exitCode: 0, output: "ok", timedOut: false })
    await expect(provider.stop(handle, 1_000)).resolves.toMatchObject({ lifecycleState: "stopped" })
  })

  it("rejects a handle whose labels do not match the attached workspace", async () => {
    const sandbox = fakeSandbox()
    const client: DaytonaClientPort = {
      create: async (params) => {
        sandbox.labels = params.labels
        return sandbox
      }
    }
    const provider = new DaytonaWorkspaceProvider(client)
    const handle = await provider.create({
      image: "example.test/worker:1.0.0",
      resources: { cpu: 4, memory: 8, disk: 10 },
      labels: {
        runId: "run-1",
        role: "coder",
        repositoryHash: "repository-hash",
        promptVersion: "v1",
        environment: "test"
      },
      retention: { autoArchiveMinutes: 60, autoDeleteMinutes: 120 },
      createTimeoutMs: 30_000
    })

    await expect(
      provider.start({ ...handle, labels: { ...handle.labels, runId: "other-run" } }, 1_000)
    ).rejects.toThrow("label runId does not match")
  })

  it("supports execution, binary transfer, archive, and destroy through serializable handles", async () => {
    const sandbox = fakeSandbox()
    const client: DaytonaClientPort = {
      create: async (params) => {
        sandbox.labels = params.labels
        return sandbox
      }
    }
    const provider = new DaytonaWorkspaceProvider(client)
    const handle = await provider.create({
      image: "example.test/worker:1.0.0",
      resources: { cpu: 4, memory: 8, disk: 10 },
      labels: {
        runId: "run-1",
        role: "coder",
        repositoryHash: "repository-hash",
        promptVersion: "v1",
        environment: "test"
      },
      retention: { autoArchiveMinutes: 60, autoDeleteMinutes: 120 },
      environment: { FEATURE_FLAG: "enabled" },
      createTimeoutMs: 30_000
    })

    await expect(
      provider.execute(handle, { executionId: "role-1", command: "run", timeoutMs: 1_000 })
    ).resolves.toMatchObject({ workspaceId: "workspace-1", executionId: "command-1", status: "running" })
    await provider.upload(handle, Uint8Array.from([0, 255]), "/workspace/data.bin", 1_000)
    await expect(provider.download(handle, "/workspace/data.bin", 1_000)).resolves.toEqual(Buffer.from([0, 255]))
    const archived = await provider.archive(handle, 1_000)
    expect(archived.lifecycleState).toBe("archived")
    await expect(provider.destroy(archived, 1_000)).resolves.toMatchObject({ lifecycleState: "deleted" })
    await expect(provider.start(handle, 1_000)).rejects.toThrow("is not attached")
  })

  it("rejects missing labels, wrong providers, and unattached workspace handles", async () => {
    const sandbox = fakeSandbox()
    const client: DaytonaClientPort = {
      create: async (params) => {
        sandbox.labels = params.labels
        return sandbox
      }
    }
    const provider = new DaytonaWorkspaceProvider(client)
    const options = {
      image: "example.test/worker:1.0.0",
      resources: { cpu: 4, memory: 8, disk: 10 },
      labels: {
        runId: "run-1",
        role: "coder",
        repositoryHash: "repository-hash",
        promptVersion: "v1",
        environment: "test"
      },
      retention: { autoArchiveMinutes: 60, autoDeleteMinutes: 120 },
      createTimeoutMs: 30_000
    }

    await expect(provider.create({ ...options, labels: { ...options.labels, role: "" } })).rejects.toThrow(
      "Missing required Daytona workspace label role"
    )
    const handle = await provider.create(options)
    await expect(provider.start({ ...handle, provider: "azure" }, 1_000)).rejects.toThrow(
      "Daytona provider cannot operate on azure workspace"
    )
    const detachedProvider = new DaytonaWorkspaceProvider(client)
    await expect(detachedProvider.start(handle, 1_000)).rejects.toThrow("is not attached")
  })
})
