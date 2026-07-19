import { Daytona, type DaytonaConfig, DaytonaTimeoutError } from "@daytona/sdk"

const TERMINAL_STATES = new Set(["archived", "destroyed"])

export type CleanupMode = "archive" | "delete" | "stop"

export interface DaytonaWorkspaceOptions {
  image: string
  resources: {
    cpu: number
    memory: number
    disk: number
  }
  labels: {
    runId: string
    role: string
    repositoryHash: string
    promptVersion: string
    environment: string
  }
  retention: {
    autoArchiveMinutes: number
    autoDeleteMinutes: number
  }
  environment?: Readonly<Record<string, string>>
  createTimeoutMs: number
}

export interface ExecuteCommandOptions {
  commandId: string
  command: string
  workingDirectory: string
  environment?: Readonly<Record<string, string>>
  timeoutMs: number
}

export interface ExecuteCommandResult {
  exitCode: number | null
  output: string
  timedOut: boolean
}

export interface BackgroundSessionResult {
  exitCode: number | null
  stdout: string
  stderr: string
}

export interface SerializableWorkspaceMetadata {
  provider: "daytona"
  workspaceId: string
  state: string | null
  createdAt: string | null
  lastActivityAt: string | null
  resources: {
    cpu: number
    memory: number
    disk: number
  }
  labels: Record<string, string>
}

export interface WorkspaceLogger {
  debug(event: string, details: Readonly<Record<string, unknown>>): void
}

interface DaytonaProcessPort {
  executeCommand(
    command: string,
    cwd?: string,
    env?: Record<string, string>,
    timeoutSeconds?: number
  ): Promise<{ exitCode: number; result: string }>
  createSession(sessionId: string): Promise<void>
  executeSessionCommand(
    sessionId: string,
    request: { command: string; runAsync: boolean },
    timeoutSeconds?: number
  ): Promise<{ cmdId: string }>
  getSessionCommand(sessionId: string, commandId: string): Promise<{ exitCode?: number | null }>
  getSessionCommandLogs(
    sessionId: string,
    commandId: string
  ): Promise<{ output?: string; stdout?: string; stderr?: string }>
}

interface DaytonaFileSystemPort {
  uploadFile(content: Buffer, remotePath: string, timeoutSeconds?: number): Promise<void>
  downloadFile(remotePath: string, timeoutSeconds?: number): Promise<Buffer>
}

export interface DaytonaSandboxPort {
  id: string
  state?: string
  createdAt?: string
  lastActivityAt?: string
  cpu: number
  memory: number
  disk: number
  labels: Record<string, string>
  process: DaytonaProcessPort
  fs: DaytonaFileSystemPort
  refreshData(): Promise<void>
  setAutostopInterval(intervalMinutes: number): Promise<void>
  start(timeoutSeconds?: number): Promise<void>
  stop(timeoutSeconds?: number, force?: boolean): Promise<void>
  archive(): Promise<void>
  delete(timeoutSeconds?: number): Promise<void>
  getSignedPreviewUrl(port: number, expiresInSeconds?: number): Promise<{ url: string; token: string }>
}

export interface DaytonaClientPort {
  get(sandboxIdOrName: string): Promise<DaytonaSandboxPort>
  create(
    params: {
      image: string
      resources: { cpu: number; memory: number; disk: number }
      labels: Record<string, string>
      envVars?: Record<string, string>
      public: boolean
      ephemeral: boolean
      autoStopInterval: number
      autoArchiveInterval: number
      autoDeleteInterval: number
    },
    options: { timeout: number }
  ): Promise<DaytonaSandboxPort>
}

const silentLogger: WorkspaceLogger = {
  debug: () => undefined
}

function millisecondsToSeconds(milliseconds: number): number {
  return Math.max(1, Math.ceil(milliseconds / 1000))
}

function assertPinnedImage(image: string): void {
  const hasDigest = image.includes("@sha256:")
  const finalPathSegment = image.slice(image.lastIndexOf("/") + 1)
  const tag = finalPathSegment.includes(":") ? finalPathSegment.slice(finalPathSegment.lastIndexOf(":") + 1) : null

  if (!hasDigest && (tag === null || tag === "latest")) {
    throw new Error("Daytona workspace image must use an immutable digest or an explicit non-latest tag")
  }
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof DaytonaTimeoutError ||
    (error instanceof Error &&
      (error.name === "DaytonaTimeoutError" || /request timeout: command execution timeout/iu.test(error.message)))
  )
}

export class DaytonaWorkspace {
  readonly #sandbox: DaytonaSandboxPort
  readonly #logger: WorkspaceLogger

  private constructor(sandbox: DaytonaSandboxPort, logger: WorkspaceLogger) {
    this.#sandbox = sandbox
    this.#logger = logger
  }

  static async create(
    client: DaytonaClientPort,
    options: DaytonaWorkspaceOptions,
    logger: WorkspaceLogger = silentLogger
  ): Promise<DaytonaWorkspace> {
    assertPinnedImage(options.image)

    const labels = {
      runId: options.labels.runId,
      role: options.labels.role,
      repositoryHash: options.labels.repositoryHash,
      promptVersion: options.labels.promptVersion,
      environment: options.labels.environment
    }
    const sandbox = await client.create(
      {
        image: options.image,
        resources: options.resources,
        labels,
        ...(options.environment === undefined ? {} : { envVars: { ...options.environment } }),
        public: false,
        ephemeral: false,
        autoStopInterval: 30,
        autoArchiveInterval: options.retention.autoArchiveMinutes,
        autoDeleteInterval: options.retention.autoDeleteMinutes
      },
      { timeout: millisecondsToSeconds(options.createTimeoutMs) }
    )

    await sandbox.setAutostopInterval(30)
    logger.debug("daytona.workspace.created", {
      workspaceId: sandbox.id,
      labels,
      resources: options.resources
    })

    return new DaytonaWorkspace(sandbox, logger)
  }

  static async attach(
    client: DaytonaClientPort,
    workspaceId: string,
    logger: WorkspaceLogger = silentLogger
  ): Promise<DaytonaWorkspace> {
    const sandbox = await client.get(workspaceId)
    if (sandbox.id !== workspaceId) {
      throw new Error(`Daytona returned workspace ${sandbox.id} while attaching ${workspaceId}`)
    }
    await sandbox.refreshData()
    logger.debug("daytona.workspace.attached", { workspaceId })
    return new DaytonaWorkspace(sandbox, logger)
  }

  describe(): SerializableWorkspaceMetadata {
    return {
      provider: "daytona",
      workspaceId: this.#sandbox.id,
      state: this.#sandbox.state ?? null,
      createdAt: this.#sandbox.createdAt ?? null,
      lastActivityAt: this.#sandbox.lastActivityAt ?? null,
      resources: {
        cpu: this.#sandbox.cpu,
        memory: this.#sandbox.memory,
        disk: this.#sandbox.disk
      },
      labels: { ...this.#sandbox.labels }
    }
  }

  async executeCommand(options: ExecuteCommandOptions): Promise<ExecuteCommandResult> {
    this.#logger.debug("daytona.command.started", {
      workspaceId: this.#sandbox.id,
      commandId: options.commandId,
      workingDirectory: options.workingDirectory,
      timeoutMs: options.timeoutMs,
      environmentKeys: Object.keys(options.environment ?? {}).sort()
    })

    try {
      const response = await this.#sandbox.process.executeCommand(
        options.command,
        options.workingDirectory,
        options.environment === undefined ? undefined : { ...options.environment },
        millisecondsToSeconds(options.timeoutMs)
      )
      return {
        exitCode: response.exitCode,
        output: response.result,
        timedOut: false
      }
    } catch (error) {
      if (isTimeoutError(error)) {
        return {
          exitCode: null,
          output: "",
          timedOut: true
        }
      }

      throw error
    }
  }

  async upload(content: Uint8Array, remotePath: string, timeoutMs: number): Promise<void> {
    await this.#sandbox.fs.uploadFile(Buffer.from(content), remotePath, millisecondsToSeconds(timeoutMs))
  }

  async download(remotePath: string, timeoutMs: number): Promise<Buffer> {
    return this.#sandbox.fs.downloadFile(remotePath, millisecondsToSeconds(timeoutMs))
  }

  async signedPreview(port: number, expiresInSeconds: number): Promise<{ url: string; token: string }> {
    const preview = await this.#sandbox.getSignedPreviewUrl(port, expiresInSeconds)
    return { url: preview.url, token: preview.token }
  }

  async startBackgroundSession(sessionId: string, command: string, timeoutMs: number): Promise<string> {
    this.#logger.debug("daytona.session.started", {
      workspaceId: this.#sandbox.id,
      sessionId,
      timeoutMs
    })
    await this.#sandbox.process.createSession(sessionId)
    const result = await this.#sandbox.process.executeSessionCommand(
      sessionId,
      { command, runAsync: true },
      millisecondsToSeconds(timeoutMs)
    )
    return result.cmdId
  }

  async getBackgroundSessionResult(sessionId: string, commandId: string): Promise<BackgroundSessionResult> {
    const [command, logs] = await Promise.all([
      this.#sandbox.process.getSessionCommand(sessionId, commandId),
      this.#sandbox.process.getSessionCommandLogs(sessionId, commandId)
    ])
    return {
      exitCode: command.exitCode ?? null,
      stdout: logs.stdout ?? logs.output ?? "",
      stderr: logs.stderr ?? ""
    }
  }

  async start(timeoutMs: number): Promise<void> {
    await this.#sandbox.refreshData()
    if (this.#sandbox.state === "started") {
      return
    }
    if (TERMINAL_STATES.has(this.#sandbox.state ?? "")) {
      throw new Error(`Cannot start Daytona workspace from ${this.#sandbox.state} state`)
    }

    await this.#sandbox.start(millisecondsToSeconds(timeoutMs))
  }

  async stop(timeoutMs: number): Promise<void> {
    await this.#sandbox.refreshData()
    if (this.#sandbox.state === "stopped" || TERMINAL_STATES.has(this.#sandbox.state ?? "")) {
      return
    }

    await this.#sandbox.stop(millisecondsToSeconds(timeoutMs), false)
  }

  async archive(timeoutMs: number): Promise<void> {
    await this.#sandbox.refreshData()
    if (this.#sandbox.state === "archived" || this.#sandbox.state === "destroyed") {
      return
    }
    if (this.#sandbox.state !== "stopped") {
      await this.#sandbox.stop(millisecondsToSeconds(timeoutMs), false)
      await this.#sandbox.refreshData()
    }

    await this.#sandbox.archive()
  }

  async delete(timeoutMs: number): Promise<void> {
    await this.#sandbox.refreshData()
    if (this.#sandbox.state === "destroyed") {
      return
    }

    await this.#sandbox.delete(millisecondsToSeconds(timeoutMs))
  }

  async cleanup(mode: CleanupMode, timeoutMs: number): Promise<void> {
    if (mode === "archive") {
      await this.archive(timeoutMs)
      return
    }
    if (mode === "delete") {
      await this.delete(timeoutMs)
      return
    }

    await this.stop(timeoutMs)
  }
}

export function createDaytonaClient(config?: DaytonaConfig): DaytonaClientPort {
  return new Daytona(config)
}

export async function withDaytonaWorkspace<Result>(
  client: DaytonaClientPort,
  options: DaytonaWorkspaceOptions,
  operation: (workspace: DaytonaWorkspace) => Promise<Result>,
  cleanupMode: CleanupMode = "stop",
  cleanupTimeoutMs = 60_000,
  logger: WorkspaceLogger = silentLogger
): Promise<Result> {
  const workspace = await DaytonaWorkspace.create(client, options, logger)
  try {
    return await operation(workspace)
  } finally {
    await workspace.cleanup(cleanupMode, cleanupTimeoutMs)
  }
}

export interface ReadinessOptions {
  url: string
  headers?: Readonly<Record<string, string>>
  maxAttempts: number
  requestTimeoutMs: number
  intervalMs: number
}

type HealthFetcher = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number }>
type Sleep = (milliseconds: number) => Promise<void>

const sleep: Sleep = async (milliseconds) => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export async function waitForHttpReadiness(
  options: ReadinessOptions,
  fetcher: HealthFetcher = fetch,
  wait: Sleep = sleep
): Promise<{ attempts: number }> {
  if (options.maxAttempts < 1) {
    throw new Error("Readiness maxAttempts must be at least 1")
  }

  let lastStatus: number | null = null
  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      const response = await fetcher(options.url, {
        headers: options.headers,
        signal: AbortSignal.timeout(options.requestTimeoutMs)
      })
      lastStatus = response.status
      if (response.ok) {
        return { attempts: attempt }
      }
    } catch (error) {
      if (attempt === options.maxAttempts) {
        throw new Error(`Service did not become ready after ${attempt} attempts`, { cause: error })
      }
    }

    if (attempt < options.maxAttempts) {
      await wait(options.intervalMs)
    }
  }

  throw new Error(
    `Service did not become ready after ${options.maxAttempts} attempts${lastStatus === null ? "" : `; last status ${lastStatus}`}`
  )
}
