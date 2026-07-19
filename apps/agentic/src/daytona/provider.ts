import {
  type AgentWorkspace,
  ExecutionHandleSchema,
  type ProviderWorkspaceHandle,
  ProviderWorkspaceHandleSchema,
  type WorkspaceCommandOptions,
  type WorkspaceCreateOptions,
  type WorkspaceExecutionOptions
} from "../workspace/agentWorkspace"
import { DaytonaWorkspace, type DaytonaClientPort, type WorkspaceLogger } from "./workspace"

function requiredLabel(labels: Readonly<Record<string, string>>, name: string): string {
  const value = labels[name]
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required Daytona workspace label ${name}`)
  }
  return value
}

function handleFor(workspace: DaytonaWorkspace, lifecycleState: ProviderWorkspaceHandle["lifecycleState"]) {
  const metadata = workspace.describe()
  return ProviderWorkspaceHandleSchema.parse({
    schemaVersion: "1",
    provider: "daytona",
    workspaceId: metadata.workspaceId,
    lifecycleState,
    labels: metadata.labels,
    createdAt: metadata.createdAt,
    lastActivityAt: metadata.lastActivityAt
  })
}

export class DaytonaWorkspaceProvider implements AgentWorkspace {
  readonly #client: DaytonaClientPort
  readonly #logger: WorkspaceLogger | undefined
  readonly #workspaces = new Map<string, Promise<DaytonaWorkspace>>()

  constructor(client: DaytonaClientPort, logger?: WorkspaceLogger) {
    this.#client = client
    this.#logger = logger
  }

  async create(options: WorkspaceCreateOptions): Promise<ProviderWorkspaceHandle> {
    const workspaceOptions = {
      image: options.image,
      resources: options.resources,
      labels: {
        runId: requiredLabel(options.labels, "runId"),
        role: requiredLabel(options.labels, "role"),
        repositoryHash: requiredLabel(options.labels, "repositoryHash"),
        promptVersion: requiredLabel(options.labels, "promptVersion"),
        environment: requiredLabel(options.labels, "environment")
      },
      retention: options.retention,
      ...(options.environment === undefined ? {} : { environment: options.environment }),
      createTimeoutMs: options.createTimeoutMs
    }
    const workspace = await DaytonaWorkspace.create(this.#client, workspaceOptions, this.#logger)
    const handle = handleFor(workspace, "running")
    this.#workspaces.set(handle.workspaceId, Promise.resolve(workspace))
    return handle
  }

  async start(handle: ProviderWorkspaceHandle, timeoutMs: number): Promise<ProviderWorkspaceHandle> {
    const workspace = await this.#workspace(handle)
    await workspace.start(timeoutMs)
    return handleFor(workspace, "running")
  }

  async execute(
    handle: ProviderWorkspaceHandle,
    options: WorkspaceExecutionOptions
  ): Promise<ReturnType<typeof ExecutionHandleSchema.parse>> {
    const workspace = await this.#workspace(handle)
    const commandId = await workspace.startBackgroundSession(options.executionId, options.command, options.timeoutMs)
    return ExecutionHandleSchema.parse({
      schemaVersion: "1",
      provider: "daytona",
      workspaceId: handle.workspaceId,
      executionId: commandId,
      status: "running",
      startedAt: new Date().toISOString(),
      endedAt: null
    })
  }

  async executeCommand(handle: ProviderWorkspaceHandle, options: WorkspaceCommandOptions) {
    const workspace = await this.#workspace(handle)
    return workspace.executeCommand(options)
  }

  async upload(
    handle: ProviderWorkspaceHandle,
    content: Uint8Array,
    remotePath: string,
    timeoutMs: number
  ): Promise<void> {
    const workspace = await this.#workspace(handle)
    await workspace.upload(content, remotePath, timeoutMs)
  }

  async download(handle: ProviderWorkspaceHandle, remotePath: string, timeoutMs: number): Promise<Uint8Array> {
    const workspace = await this.#workspace(handle)
    return workspace.download(remotePath, timeoutMs)
  }

  async stop(handle: ProviderWorkspaceHandle, timeoutMs: number): Promise<ProviderWorkspaceHandle> {
    const workspace = await this.#workspace(handle)
    await workspace.stop(timeoutMs)
    return handleFor(workspace, "stopped")
  }

  async archive(handle: ProviderWorkspaceHandle, timeoutMs: number): Promise<ProviderWorkspaceHandle> {
    const workspace = await this.#workspace(handle)
    await workspace.archive(timeoutMs)
    return handleFor(workspace, "archived")
  }

  async destroy(handle: ProviderWorkspaceHandle, timeoutMs: number): Promise<ProviderWorkspaceHandle> {
    const workspace = await this.#workspace(handle)
    await workspace.delete(timeoutMs)
    this.#workspaces.delete(handle.workspaceId)
    return handleFor(workspace, "deleted")
  }

  async #workspace(handleInput: ProviderWorkspaceHandle): Promise<DaytonaWorkspace> {
    const handle = ProviderWorkspaceHandleSchema.parse(handleInput)
    if (handle.provider !== "daytona") {
      throw new Error(`Daytona provider cannot operate on ${handle.provider} workspace ${handle.workspaceId}`)
    }

    let workspacePromise = this.#workspaces.get(handle.workspaceId)
    if (workspacePromise === undefined) {
      workspacePromise = DaytonaWorkspace.attach(this.#client, handle.workspaceId, this.#logger)
      this.#workspaces.set(handle.workspaceId, workspacePromise)
    }

    let workspace: DaytonaWorkspace
    try {
      workspace = await workspacePromise
    } catch (error) {
      this.#workspaces.delete(handle.workspaceId)
      throw error
    }

    const labels = workspace.describe().labels
    for (const [name, value] of Object.entries(handle.labels)) {
      if (labels[name] !== value) {
        throw new Error(`Daytona workspace ${handle.workspaceId} label ${name} does not match its handle`)
      }
    }
    return workspace
  }
}
